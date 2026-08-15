// Création d'un ticket de messagerie (spec 2026-08-15-messagerie-portail-design.md).
// Ordre des opérations, du bloquant au best-effort — D1 D'ABORD (§6 : si la
// création Linear échoue, le ticket existe côté client et sera ré-appairé) :
//   1. session + validation + mappings client (team ET projet Support) ;
//   2. quota journalier KV (repris tel quel de l'ancien /api/support) ;
//   3. ligne D1 tickets + message initial + upload R2 des pièces jointes ;
//   4. issue Linear (projet Support, assignée à Ludo, priorité) → majIssue ;
//   5. emails Resend (interne + accusé) — best-effort.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { renderConfirmationSupport } from "../../../emails/support-confirmation";
import { citation, esc, kv, renderTransactionnel, titreSection } from "../../../emails/transactionnel";
import { getPortalContext } from "../../../lib/portail/context";
import { LUDO_LINEAR_USER_ID, createSupportTicket } from "../../../lib/portail/linear";
import { cleR2, validerFichiers } from "../../../lib/portail/messagerie/fichiers";
import { prioriteFromUrgence } from "../../../lib/portail/messagerie/regles";
import {
  ajouterMessage,
  ajouterPieceJointe,
  creerTicket,
  majIssue,
} from "../../../lib/portail/messagerie/store";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Demandes par utilisateur et par jour. Au-delà : 429 et message clair. */
const QUOTA_PAR_JOUR = 5;

const CONTACT_DIRECT = "écrivez-moi à ludo@coolbeans.cc";

export const POST: APIRoute = async (context) => {
  const { request } = context;
  const { user, client } = await getPortalContext(context);
  if (!user) return json({ error: "Session expirée — reconnectez-vous puis réessayez." }, 401);

  const fd = await request.formData();
  const objet = String(fd.get("objet") ?? "").trim().slice(0, 200);
  const description = String(fd.get("description") ?? "").trim().slice(0, 5000);
  const urgence = String(fd.get("urgence") ?? "");
  const fichiers = fd.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (!objet) return json({ error: "L'objet est obligatoire." }, 400);
  const erreurFichiers = validerFichiers(fichiers);
  if (erreurFichiers) return json({ error: erreurFichiers }, 400);
  if (!client?.linearTeamId || !client?.linearSupportProjectId) {
    return json({ error: `La messagerie n'est pas encore raccordée — ${CONTACT_DIRECT}.` }, 409);
  }
  const apiKey = env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("messagerie: LINEAR_API_KEY absent de cet environnement");
    return json({ error: `Envoi impossible pour le moment — ${CONTACT_DIRECT}.` }, 503);
  }

  // Quota : clé datée, donc remise à zéro naturelle à minuit UTC ; le TTL ne
  // sert qu'à nettoyer. KV est en cohérence différée — assez bon pour un
  // garde-fou, ce n'est pas un compteur comptable.
  const jour = new Date().toISOString().slice(0, 10);
  const quotaKey = `support:quota:${user.id}:${jour}`;
  const dejaEnvoyees = Number((await env.PORTAL_KV.get(quotaKey)) ?? "0");
  if (dejaEnvoyees >= QUOTA_PAR_JOUR) {
    return json(
      {
        error: `Vous avez atteint la limite de ${QUOTA_PAR_JOUR} demandes pour aujourd'hui. Pour une urgence, ${CONTACT_DIRECT}.`,
      },
      429,
    );
  }

  const emailClient = user.primaryEmailAddress?.emailAddress ?? null;
  const nomClient =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || emailClient || user.id;

  const descriptionTicket = [
    description,
    "",
    "---",
    `Demande envoyée depuis le portail myCoolbeans par **${nomClient}**${
      emailClient ? ` (${emailClient})` : ""
    } le ${jour}.`,
  ].join("\n");

  // Le compteur ne bouge qu'une fois le ticket D1 posé : un échec plus loin
  // dans la requête (R2, Linear) laisse quand même une trace consommée, mais
  // c'est le même compromis que l'ancien /api/support — un garde-fou, pas un
  // compteur comptable.
  try {
    await env.PORTAL_KV.put(quotaKey, String(dejaEnvoyees + 1), { expirationTtl: 60 * 60 * 48 });
  } catch (err) {
    console.error("messagerie: quota KV non incrémenté", err);
  }

  const maintenant = new Date().toISOString();
  const ticketId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const liens: string[] = [];
  try {
    await creerTicket(env.PORTAL_DB, {
      id: ticketId,
      client: client.slug,
      linear_issue_uuid: null,
      linear_issue_url: null,
      author_clerk_id: user.id,
      author_prenom: user.firstName ?? "Client",
      author_email: emailClient ?? "",
      created_via: "portail",
      objet,
      created_at: maintenant,
      last_message_at: maintenant,
    });
    // Message porteur : posé dès qu'il y a une description OU des fichiers, sinon
    // les pièces jointes n'auraient aucune ligne `messages` à référencer (FK,
    // invisibles au JOIN de piecesJointesDuTicket) — body vide accepté ici.
    if (description || fichiers.length > 0) {
      await ajouterMessage(env.PORTAL_DB, {
        id: messageId,
        ticket_id: ticketId,
        direction: "client",
        body: description,
        linear_comment_id: null,
        email_status: "none",
        created_at: maintenant,
      });
    }
    for (const f of fichiers) {
      const cle = cleR2(client.slug, ticketId, f.name);
      await env.PORTAL_FILES.put(cle, f.stream(), { httpMetadata: { contentType: f.type } });
      const pieceId = crypto.randomUUID();
      await ajouterPieceJointe(env.PORTAL_DB, {
        id: pieceId,
        message_id: messageId,
        r2_key: cle,
        filename: f.name,
        size: f.size,
        mime: f.type,
      });
      liens.push(`[${f.name}](https://my.coolbeans.cc/api/messagerie/fichier/${pieceId})`);
    }
  } catch (err) {
    // Chaîne bloquante D1/R2 : le front attend du JSON, pas la page d'erreur
    // générique Astro. Pas de rollback R2 en v1 — un log suffit, ça reste
    // rattrapable à la main vu le faible volume attendu.
    console.error("messagerie: création du ticket (D1/R2) échouée", err);
    return json({ error: `Envoi impossible pour le moment — ${CONTACT_DIRECT}.` }, 500);
  }

  // Best-effort : le ticket existe déjà côté client (D1), un échec Linear ici
  // laisse un ticket orphelin (linear_issue_uuid null) à ré-appairer plutôt
  // que de faire échouer toute la requête (spec §9).
  let ticket: { issueId: string; identifier: string; url: string } | null = null;
  try {
    ticket = await createSupportTicket({
      apiKey,
      teamId: client.linearTeamId,
      projectId: client.linearSupportProjectId,
      assigneeId: LUDO_LINEAR_USER_ID,
      priority: prioriteFromUrgence(urgence),
      title: objet,
      description: descriptionTicket + (liens.length ? `\n\nPièces jointes :\n${liens.join("\n")}` : ""),
    });
    await majIssue(env.PORTAL_DB, ticketId, ticket.issueId, ticket.url);
  } catch (err) {
    console.error("messagerie: création issue Linear échouée, ticket D1 orphelin à reprendre", err);
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);

    const htmlInterne = renderTransactionnel({
      preheader: `${client.nom} — ${objet}`,
      kicker: `Support · ${esc(client.nom)}`,
      titre: "Nouvelle demande support",
      contenu: [
        kv([
          ["Client", esc(client.nom)],
          ["De", esc(nomClient) + (emailClient ? ` — ${esc(emailClient)}` : "")],
          ["Ticket", ticket ? esc(ticket.identifier) : "— (Linear indisponible)"],
          ["Date", jour],
        ]),
        titreSection(`Demande — ${esc(objet)}`),
        citation(esc(description).replace(/\n/g, "<br>")),
      ].join(""),
      cta: ticket ? { label: "Ouvrir dans Linear", url: ticket.url } : undefined,
      piedContexte: "Demande re&ccedil;ue via le portail my.coolbeans.cc.",
    });

    const { error: erreurInterne } = await resend.emails.send({
      from: "Support Coolbeans <support@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: emailClient ?? undefined,
      subject: `Support ${client.nom} — ${objet}${ticket ? ` (${ticket.identifier})` : ""}`,
      html: htmlInterne,
      text: [
        `Client : ${client.nom}`,
        `De : ${nomClient}${emailClient ? ` — ${emailClient}` : ""}`,
        ticket ? `Ticket : ${ticket.identifier} — ${ticket.url}` : "Ticket : Linear indisponible",
        `Date : ${jour}`,
        "",
        `Demande — ${objet} :`,
        description,
      ].join("\n"),
    });
    if (erreurInterne) {
      console.error("messagerie: notification interne non envoyée", erreurInterne);
    }

    if (emailClient) {
      const confirmation = renderConfirmationSupport({
        objet,
        description,
        prenom: user.firstName ?? undefined,
      });
      const { error: erreurConfirmation } = await resend.emails.send({
        from: "Ludo de Coolbeans <support@coolbeans.cc>",
        to: emailClient,
        replyTo: "ludo@coolbeans.cc",
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      });
      if (erreurConfirmation) {
        console.error("messagerie: accusé de réception non envoyé", erreurConfirmation);
      }
    }
  } catch (err) {
    console.error("messagerie: envoi Resend échoué", err);
  }

  return json({ ok: true, ticketId }, 200);
};
