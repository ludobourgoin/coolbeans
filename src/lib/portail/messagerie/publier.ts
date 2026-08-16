// Publication des commentaires >> après délai de grâce (spec §7). Appelé par
// le cron de src/worker.ts. Le re-fetch au moment de l'envoi est LE mécanisme
// central : édition = correction, suppression ou retrait du >> = annulation.
import { Resend } from "resend";
import { fetchComment } from "../linear";
import { renderReponseMessagerie } from "../../../emails/messagerie-reponse";
import { corpsPublie, retireImagesLinear } from "./regles";
import {
  ajouterMessage,
  majEmailStatus,
  publicationsDues,
  purgerPublicationsAbandonnees,
  supprimerPublication,
  ticketParId,
} from "./store";

/** Un due retenté sans succès pendant plus de 24 h est abandonné (voir purgerPublicationsAbandonnees). */
const DELAI_ABANDON_MS = 24 * 60 * 60 * 1000;

export function decisionPublication(
  commentaire: { body: string } | null,
): { type: "annuler" } | { type: "publier"; corps: string; imagesRetirees: number } {
  if (!commentaire) return { type: "annuler" };
  const corps = corpsPublie(commentaire.body);
  if (corps === null) return { type: "annuler" };
  const { texte, imagesRetirees } = retireImagesLinear(corps);
  if (!texte) return { type: "annuler" };
  return { type: "publier", corps: texte, imagesRetirees };
}

export async function publierLesDues(
  db: D1Database,
  options: { apiKey: string; resendKey: string; maintenant: string; baseUrl: string },
): Promise<{ publies: number; annules: number; reportes: number; abandonnes: number }> {
  // Purge en tête de run : borne le retry infini d'un due empoisonné (spec
  // §7 — sans ça, une ligne pending qui échoue systématiquement au re-fetch
  // Linear serait retentée toutes les 5 min indéfiniment).
  const avant = new Date(Date.parse(options.maintenant) - DELAI_ABANDON_MS).toISOString();
  const abandonnes = await purgerPublicationsAbandonnees(db, avant);

  const dues = await publicationsDues(db, options.maintenant);
  let publies = 0;
  let annules = 0;
  let reportes = 0;
  for (const due of dues) {
    try {
      const commentaire = await fetchComment(options.apiKey, due.linear_comment_id);
      const decision = decisionPublication(commentaire);
      if (decision.type === "annuler") {
        await supprimerPublication(db, due.linear_comment_id);
        annules += 1;
        continue;
      }
      const ticket = await ticketParId(db, due.ticket_id);
      if (!ticket) {
        await supprimerPublication(db, due.linear_comment_id);
        continue;
      }
      const messageId = crypto.randomUUID();
      const insere = await ajouterMessage(db, {
        id: messageId,
        ticket_id: ticket.id,
        direction: "coolbeans",
        body: decision.corps,
        linear_comment_id: due.linear_comment_id,
        email_status: "none",
        created_at: options.maintenant,
      });
      // insere=false : webhook rejoué, le message existe déjà — ne pas renvoyer l'email.
      if (insere) {
        if (!ticket.author_email) {
          // Aucun email à notifier : sans ce chemin, le statut restait "none"
          // à vie (aucun code ne le faisait jamais transiter vers "failed").
          await majEmailStatus(db, messageId, "failed");
          console.error("messagerie: pas d'email de réponse envoyé, author_email vide", ticket.id);
        } else {
          const resend = new Resend(options.resendKey);
          const email = renderReponseMessagerie({
            objet: ticket.objet,
            corps: decision.corps,
            prenom: ticket.author_prenom,
            urlTicket: `${options.baseUrl}/messagerie/${ticket.id}`,
          });
          // Un throw (panne réseau...) doit être traité comme {error} : sans ce
          // catch, le message resterait "none" à vie (insere=false au retry).
          let error: unknown = null;
          try {
            ({ error } = await resend.emails.send({
              from: "Ludo de Coolbeans <support@coolbeans.cc>",
              to: ticket.author_email,
              replyTo: "ludo@coolbeans.cc",
              subject: email.subject,
              html: email.html,
              text: email.text,
            }));
          } catch (envoiErr) {
            error = envoiErr;
          }
          await majEmailStatus(db, messageId, error ? "failed" : "sent");
          if (error) console.error("messagerie: email de réponse non envoyé", error);
          if (decision.imagesRetirees > 0) {
            // Alerte Ludo, best-effort : une image Linear (CDN privé) a été
            // retirée du message. Sous try/catch pour ne pas faire échouer
            // toute la publication (déjà actée en D1) si Resend est en panne.
            try {
              await resend.emails.send({
                from: "Support Coolbeans <support@coolbeans.cc>",
                to: "ludo@coolbeans.cc",
                subject: `Messagerie — ${decision.imagesRetirees} image(s) retirée(s) (${ticket.objet})`,
                text: `Le message publié sur « ${ticket.objet} » contenait ${decision.imagesRetirees} image(s) uploads.linear.app, invisibles côté client. Renvoie-les en pièce jointe si nécessaire.`,
              });
            } catch (alerteErr) {
              console.error("messagerie: alerte « images retirées » non envoyée", alerteErr);
            }
          }
        }
      }
      await supprimerPublication(db, due.linear_comment_id);
      publies += 1;
    } catch (err) {
      // fetchComment jette sur toute panne autre qu'une suppression (durci en
      // T4 : réseau, 429, 401…). On ne supprime PAS la ligne pending — elle
      // sera retentée au tick suivant, c'est le retry naturel. Une panne sur
      // un due ne doit jamais bloquer le traitement des autres.
      console.error("messagerie: publication reportée (erreur sur ce due)", due.linear_comment_id, err);
      reportes += 1;
      continue;
    }
  }
  return { publies, annules, reportes, abandonnes };
}
