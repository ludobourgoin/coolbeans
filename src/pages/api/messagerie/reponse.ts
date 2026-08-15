// Réponse d'un client sur un ticket (spec §6) : D1 (journal) PUIS commentaire
// Linear PUIS email à Ludo — les deux derniers best-effort, le portail fait foi.
// Garde d'accès : le ticket doit appartenir au client courant de la session
// (portée organisation, spec §6 — pas de garde par auteur).

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { citation, esc, renderTransactionnel } from "../../../emails/transactionnel";
import { getPortalContext } from "../../../lib/portail/context";
import { createComment } from "../../../lib/portail/linear";
import { cleR2, validerFichiers } from "../../../lib/portail/messagerie/fichiers";
import { ajouterMessage, ajouterPieceJointe, ticketParId } from "../../../lib/portail/messagerie/store";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const CONTACT_DIRECT = "écrivez-moi à ludo@coolbeans.cc";

export const POST: APIRoute = async (context) => {
  const { request } = context;
  const { user, client } = await getPortalContext(context);
  if (!user) return json({ error: "Session expirée — reconnectez-vous puis réessayez." }, 401);

  const fd = await request.formData();
  const ticketId = String(fd.get("ticketId") ?? "");
  const message = String(fd.get("message") ?? "").trim().slice(0, 5000);
  const fichiers = fd.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (!message && fichiers.length === 0) return json({ error: "Le message est vide." }, 400);
  const erreurFichiers = validerFichiers(fichiers);
  if (erreurFichiers) return json({ error: erreurFichiers }, 400);

  const ticket = await ticketParId(env.PORTAL_DB, ticketId);
  // `!client` inclus explicitement pour que TS narrowe `client` en non-null
  // ensuite (client.slug, ci-dessous) — équivalent en pratique au `!==` seul.
  if (!ticket || !client || ticket.client !== client.slug) {
    return json({ error: "Ticket introuvable." }, 404);
  }

  const maintenant = new Date().toISOString();
  const messageId = crypto.randomUUID();
  const liens: string[] = [];
  try {
    // Porteur toujours inséré : le 400 ci-dessus garantit message OU fichiers,
    // donc les pièces jointes ci-dessous se rattachent toujours à une ligne réelle.
    await ajouterMessage(env.PORTAL_DB, {
      id: messageId,
      ticket_id: ticketId,
      direction: "client",
      body: message,
      linear_comment_id: null,
      email_status: "none",
      created_at: maintenant,
    });
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
    // générique Astro — même contrat que nouveau.ts.
    console.error("messagerie: enregistrement de la réponse (D1/R2) échoué", err);
    return json({ error: `Envoi impossible pour le moment — ${CONTACT_DIRECT}.` }, 500);
  }

  // Commentaire Linear : posté via le token de Ludo, donc Linear ne le
  // notifiera pas — c'est l'email Resend ci-dessous qui prévient (spec §7).
  if (ticket.linear_issue_uuid && env.LINEAR_API_KEY) {
    try {
      await createComment({
        apiKey: env.LINEAR_API_KEY,
        issueId: ticket.linear_issue_uuid,
        body: `**${ticket.author_prenom} (portail)** :\n\n${message}` +
          (liens.length ? `\n\nPièces jointes :\n${liens.join("\n")}` : ""),
      });
    } catch (err) {
      console.error("messagerie: commentaire Linear non posté (le journal D1 fait foi)", err);
    }
  }

  // Email à Ludo, best-effort : le journal D1 fait foi même si Resend échoue.
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const html = renderTransactionnel({
      preheader: `${client.nom} — ${ticket.objet}`,
      kicker: `Messagerie · ${esc(client.nom)}`,
      titre: `Réponse de ${esc(ticket.author_prenom)}`,
      contenu: citation(esc(message).replace(/\n/g, "<br>")),
      cta: ticket.linear_issue_url
        ? { label: "Ouvrir dans Linear", url: ticket.linear_issue_url }
        : undefined,
      piedContexte: "Réponse re&ccedil;ue via le portail my.coolbeans.cc.",
    });
    const { error: erreurEmail } = await resend.emails.send({
      from: "Support Coolbeans <support@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: ticket.author_email || undefined,
      subject: `Réponse ${client.nom} — ${ticket.objet}`,
      html,
      text: [
        `Client : ${client.nom}`,
        `De : ${ticket.author_prenom}${ticket.author_email ? ` — ${ticket.author_email}` : ""}`,
        ticket.linear_issue_url ? `Ticket : ${ticket.linear_issue_url}` : "Ticket : Linear indisponible",
        "",
        message,
      ].join("\n"),
    });
    if (erreurEmail) {
      console.error("messagerie: notification de réponse non envoyée", erreurEmail);
    }
  } catch (err) {
    console.error("messagerie: envoi Resend échoué", err);
  }

  return json({ ok: true }, 200);
};
