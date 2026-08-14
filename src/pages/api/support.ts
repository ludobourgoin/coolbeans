// Réception d'une demande support du portail (COO-30, COO-31, COO-33).
//
// Ordre des opérations, du bloquant au best-effort :
//   1. session Clerk + validation des champs + team Linear du client ;
//   2. quota journalier par utilisateur (KV) — garde-fou anti-abus simple,
//      la session Clerk exigée en amont écarte déjà le spam anonyme ;
//   3. création du ticket Linear — c'est LE livrable : son échec fait
//      échouer la requête ;
//   4. emails Resend (notification interne + accusé client) — best-effort :
//      le ticket existe déjà, un email raté se rattrape, même logique que
//      l'accusé du devis.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { renderConfirmationSupport } from "../../emails/support-confirmation";
import { citation, esc, kv, renderTransactionnel, titreSection } from "../../emails/transactionnel";
import { getPortalContext } from "../../lib/portail/context";
import { createSupportTicket } from "../../lib/portail/linear";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Demandes par utilisateur et par jour. Au-delà : 429 et message clair. */
const QUOTA_PAR_JOUR = 5;

const CONTACT_DIRECT = "écrivez-moi à ludo@coolbeans.cc";

export const POST: APIRoute = async (context) => {
  const { user, client } = await getPortalContext(context);
  if (!user) return json({ error: "Session expirée — reconnectez-vous puis réessayez." }, 401);

  const data = await context.request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const { objet, description } = data as Record<string, unknown>;
  if (typeof objet !== "string" || !objet.trim()) {
    return json({ error: "Merci de renseigner l'objet de votre demande." }, 400);
  }
  if (typeof description !== "string" || !description.trim()) {
    return json({ error: "Merci de décrire votre demande." }, 400);
  }
  // Mêmes plafonds que les maxlength du formulaire : un POST direct ne doit
  // pas pouvoir pousser un pavé arbitraire dans Linear.
  const titre = objet.trim().slice(0, 200);
  const corps = description.trim().slice(0, 5000);

  if (!client?.linearTeamId) {
    return json(
      { error: `Le support n'est pas encore raccordé pour votre compte — ${CONTACT_DIRECT}.` },
      409,
    );
  }
  const apiKey = env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("support: LINEAR_API_KEY absent de cet environnement");
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
    corps,
    "",
    "---",
    `Demande envoyée depuis le portail myCoolbeans par **${nomClient}**${
      emailClient ? ` (${emailClient})` : ""
    } le ${jour}.`,
  ].join("\n");

  let ticket;
  try {
    ticket = await createSupportTicket({
      apiKey,
      teamId: client.linearTeamId,
      title: titre,
      description: descriptionTicket,
    });
  } catch (err) {
    console.error("support: création du ticket Linear échouée", err);
    return json(
      { error: `Envoi impossible, réessayez dans un instant ou ${CONTACT_DIRECT}.` },
      502,
    );
  }

  // Le compteur ne bouge qu'après un ticket réellement créé : un échec Linear
  // ne doit pas consommer le quota de l'utilisateur.
  try {
    await env.PORTAL_KV.put(quotaKey, String(dejaEnvoyees + 1), { expirationTtl: 60 * 60 * 48 });
  } catch (err) {
    console.error("support: quota KV non incrémenté", err);
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);

    const htmlInterne = renderTransactionnel({
      preheader: `${client.nom} — ${titre}`,
      kicker: `Support · ${esc(client.nom)}`,
      titre: "Nouvelle demande support",
      contenu: [
        kv([
          ["Client", esc(client.nom)],
          ["De", esc(nomClient) + (emailClient ? ` — ${esc(emailClient)}` : "")],
          ["Ticket", esc(ticket.identifier)],
          ["Date", jour],
        ]),
        titreSection(`Demande — ${esc(titre)}`),
        citation(esc(corps).replace(/\n/g, "<br>")),
      ].join(""),
      cta: { label: "Ouvrir dans Linear", url: ticket.url },
      piedContexte: "Demande re&ccedil;ue via le portail my.coolbeans.cc.",
    });

    const { error: erreurInterne } = await resend.emails.send({
      from: "Support Coolbeans <support@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: emailClient ?? undefined,
      subject: `Support ${client.nom} — ${titre} (${ticket.identifier})`,
      html: htmlInterne,
      text: [
        `Client : ${client.nom}`,
        `De : ${nomClient}${emailClient ? ` — ${emailClient}` : ""}`,
        `Ticket : ${ticket.identifier} — ${ticket.url}`,
        `Date : ${jour}`,
        "",
        `Demande — ${titre} :`,
        corps,
      ].join("\n"),
    });
    if (erreurInterne) {
      console.error("support: notification interne non envoyée", erreurInterne);
    }

    if (emailClient) {
      const confirmation = renderConfirmationSupport({
        objet: titre,
        description: corps,
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
        console.error("support: accusé de réception non envoyé", erreurConfirmation);
      }
    }
  } catch (err) {
    console.error("support: envoi Resend échoué", err);
  }

  return json({ ok: true }, 200);
};
