// Ouverture d'un fil depuis Linear, après délai de grâce (migration 0003).
// Jumelle de publier.ts : le webhook enfile quand le label « Support » est
// posé, le cron relit l'issue et décide. Le re-fetch est là aussi LE mécanisme
// d'annulation — retirer le « >> » ou le label pendant le délai annule tout,
// sans que le client ait rien vu passer.
import { Resend } from "resend";
import { SUPPORT_LABEL_ID, fetchIssue } from "../linear";
import { renderReponseMessagerie } from "../../../emails/messagerie-reponse";
import { corpsPublieDescription, retireImagesLinear } from "./regles";
import {
  ajouterMessage,
  creerTicket,
  majEmailStatus,
  ouverturesDues,
  purgerOuverturesAbandonnees,
  supprimerOuverture,
  ticketParIssueUuid,
} from "./store";

/** Même borne d'abandon que les publications. */
const DELAI_ABANDON_MS = 24 * 60 * 60 * 1000;

type DecisionOuverture =
  | { type: "annuler"; raison: string }
  | { type: "ouvrir"; objet: string; corps: string; url: string; imagesRetirees: number };

/**
 * Décision pure, à partir de la version courante de l'issue. Trois annulations
 * distinctes, toutes légitimes et toutes silencieuses : l'issue a disparu, le
 * label a été retiré, ou il n'y a pas (plus) de bloc « >> » à publier.
 */
export function decisionOuverture(
  issue: { title: string; description: string | null; url: string; labelIds: string[] } | null,
): DecisionOuverture {
  if (!issue) return { type: "annuler", raison: "issue supprimée" };
  if (!issue.labelIds.includes(SUPPORT_LABEL_ID)) {
    return { type: "annuler", raison: "label Support retiré" };
  }
  const corps = corpsPublieDescription(issue.description);
  if (corps === null) return { type: "annuler", raison: "pas de bloc >> dans la description" };
  const { texte, imagesRetirees } = retireImagesLinear(corps);
  if (!texte) return { type: "annuler", raison: "bloc >> vide après retrait des images" };
  return { type: "ouvrir", objet: issue.title, corps: texte, url: issue.url, imagesRetirees };
}

export async function ouvrirLesDues(
  db: D1Database,
  options: { apiKey: string; resendKey: string; maintenant: string; baseUrl: string },
): Promise<{ ouverts: number; annules: number; reportes: number; abandonnes: number }> {
  const avant = new Date(Date.parse(options.maintenant) - DELAI_ABANDON_MS).toISOString();
  const abandonnes = await purgerOuverturesAbandonnees(db, avant);

  const dues = await ouverturesDues(db, options.maintenant);
  let ouverts = 0;
  let annules = 0;
  let reportes = 0;
  for (const due of dues) {
    try {
      // Un fil existe déjà pour cette issue : le formulaire du portail l'a
      // créée, ou une ouverture précédente est passée. Dans les deux cas il
      // n'y a rien à ouvrir — surtout pas un doublon du même fil.
      const existant = await ticketParIssueUuid(db, due.linear_issue_uuid);
      if (existant) {
        await supprimerOuverture(db, due.linear_issue_uuid);
        annules += 1;
        continue;
      }

      const issue = await fetchIssue(options.apiKey, due.linear_issue_uuid);
      const decision = decisionOuverture(issue);
      if (decision.type === "annuler") {
        await supprimerOuverture(db, due.linear_issue_uuid);
        annules += 1;
        continue;
      }

      const ticketId = crypto.randomUUID();
      await creerTicket(db, {
        id: ticketId,
        client: due.client,
        linear_issue_uuid: due.linear_issue_uuid,
        linear_issue_url: decision.url,
        // Le destinataire tient lieu d'auteur : c'est lui que le board salue
        // et que les réponses suivantes notifient. Résolu par le webhook, qui
        // seul a un contexte Clerk.
        author_user_id: due.destinataire_user_id,
        author_prenom: due.destinataire_prenom,
        author_email: due.destinataire_email,
        created_via: "admin",
        objet: decision.objet,
        created_at: options.maintenant,
        last_message_at: options.maintenant,
        masque: 0,
        ouvert_depuis_linear: 1,
      });

      const messageId = crypto.randomUUID();
      await ajouterMessage(db, {
        id: messageId,
        ticket_id: ticketId,
        direction: "coolbeans",
        body: decision.corps,
        // Pas de commentaire à l'origine : le message vient de la description.
        linear_comment_id: null,
        email_status: "none",
        created_at: options.maintenant,
      });

      const resend = new Resend(options.resendKey);
      const email = renderReponseMessagerie({
        objet: decision.objet,
        corps: decision.corps,
        prenom: due.destinataire_prenom,
        urlTicket: `${options.baseUrl}/messagerie/${ticketId}`,
      });
      let error: unknown = null;
      try {
        ({ error } = await resend.emails.send({
          from: "Ludo de Coolbeans <support@coolbeans.cc>",
          to: due.destinataire_email,
          replyTo: "ludo@coolbeans.cc",
          subject: email.subject,
          html: email.html,
          text: email.text,
        }));
      } catch (envoiErr) {
        error = envoiErr;
      }
      await majEmailStatus(db, messageId, error ? "failed" : "sent");
      if (error) console.error("messagerie: email d'ouverture non envoyé", error);
      if (decision.imagesRetirees > 0) {
        try {
          await resend.emails.send({
            from: "Support Coolbeans <support@coolbeans.cc>",
            to: "ludo@coolbeans.cc",
            subject: `Messagerie — ${decision.imagesRetirees} image(s) retirée(s) (${decision.objet})`,
            text: `Le fil ouvert sur « ${decision.objet} » contenait ${decision.imagesRetirees} image(s) uploads.linear.app, invisibles côté client. Renvoie-les en pièce jointe si nécessaire.`,
          });
        } catch (alerteErr) {
          console.error("messagerie: alerte « images retirées » non envoyée", alerteErr);
        }
      }

      await supprimerOuverture(db, due.linear_issue_uuid);
      ouverts += 1;
    } catch (err) {
      // Panne (réseau, 429, 401…) : on garde la ligne pending, elle repassera
      // au tick suivant. Une panne sur un due ne bloque pas les autres.
      console.error("messagerie: ouverture reportée (erreur sur ce due)", due.linear_issue_uuid, err);
      reportes += 1;
      continue;
    }
  }
  return { ouverts, annules, reportes, abandonnes };
}
