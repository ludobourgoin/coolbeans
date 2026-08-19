// Réception des webhooks Linear. Deux événements comptent :
//
//   Comment — un « >> » sur un ticket existant : réponse à publier.
//   Issue   — le label « Support » posé ou retiré : fil à ouvrir ou à masquer.
//
// Dans les deux cas on enfile avec un délai de grâce de 3 min et le cron
// (src/worker.ts) fait le re-fetch et l'envoi. Répondre 200 vite : Linear
// retente sinon, et l'idempotence D1 absorbe de toute façon les doublons.
import type { APIRoute } from "astro";
import { clerkClient } from "@clerk/astro/server";
import { env } from "cloudflare:workers";
import {
  enfilerOuverture,
  enfilerPublication,
  masquerTicket,
  ticketParIssueUuid,
} from "../../lib/portail/messagerie/store";
import {
  analyserEvenement,
  analyserEvenementIssue,
  signatureValide,
} from "../../lib/portail/messagerie/webhook";
import { listWorkspaces, moduleCoupe } from "../../lib/portail/workspaces";

export const prerender = false;

const DELAI_DE_GRACE_MS = 3 * 60 * 1000;

export const POST: APIRoute = async (context) => {
  const { request } = context;
  const secret = env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("linear-webhook: LINEAR_WEBHOOK_SECRET absent de cet environnement");
    return new Response(null, { status: 503 });
  }
  const rawBody = await request.text();
  const ok = await signatureValide(secret, rawBody, request.headers.get("linear-signature"));
  if (!ok) return new Response(null, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Body signé mais pas du JSON valide : rien à publier, pas un 500 (Linear retenterait pour rien).
    return new Response(null, { status: 200 });
  }

  const maintenant = Date.now();

  const evenementIssue = analyserEvenementIssue(payload);
  if (evenementIssue) {
    await traiterIssue(context, evenementIssue, maintenant);
    return new Response(null, { status: 200 });
  }

  const evenement = analyserEvenement(payload);
  if (!evenement) return new Response(null, { status: 200 });

  const ticket = await ticketParIssueUuid(env.PORTAL_DB, evenement.issueId);
  // Commentaire >> sur une issue hors messagerie (issue de projet classique) :
  // rien à publier, ce n'est pas un ticket.
  if (!ticket) return new Response(null, { status: 200 });

  await enfilerPublication(env.PORTAL_DB, {
    linear_comment_id: evenement.commentId,
    ticket_id: ticket.id,
    publish_after: new Date(maintenant + DELAI_DE_GRACE_MS).toISOString(),
    created_at: new Date(maintenant).toISOString(),
  });
  return new Response(null, { status: 200 });
};

async function traiterIssue(
  context: Parameters<APIRoute>[0],
  evenement: { issueId: string; teamId: string; support: boolean },
  maintenant: number,
): Promise<void> {
  const existant = await ticketParIssueUuid(env.PORTAL_DB, evenement.issueId);

  // Label retiré : le fil sort du portail sans rien perdre, et il y revient si
  // le label est reposé. Détruire la ligne rendrait le portail menteur — le
  // mail d'ouverture, lui, est déjà chez le client.
  if (existant) {
    const masque = existant.masque === 1;
    if (masque !== !evenement.support) {
      await masquerTicket(env.PORTAL_DB, evenement.issueId, !evenement.support);
    }
    return;
  }
  if (!evenement.support) return;

  // La team dit de quel client il s'agit. Une team sans fiche portail (CRM,
  // Coolbeans interne, Scolies…) ou dont la messagerie est coupée ignore le
  // label : il reste un simple marqueur, sans effet de bord.
  const client = (await listWorkspaces()).find((c) => c.linearTeamId === evenement.teamId);
  if (!client || moduleCoupe("support", client)) return;

  // Destinataire résolu ici, où Clerk est joignable : le cron n'a pas de
  // contexte Astro. Sans utilisateur rattaché au client, personne à notifier —
  // on n'ouvre pas un fil que personne ne verra.
  let destinataire;
  try {
    const users = await clerkClient(context).users.getUserList({ limit: 100 });
    destinataire = users.data.find(
      (u) => (u.publicMetadata as { client?: string }).client === client.slug,
    );
  } catch (err) {
    // Clerk en panne : ne pas enfiler à l'aveugle, Linear rejouera le webhook.
    console.error("linear-webhook: destinataire non résolu (Clerk)", err);
    return;
  }
  const email = destinataire?.emailAddresses[0]?.emailAddress;
  if (!destinataire || !email) {
    console.error("linear-webhook: aucun utilisateur Clerk pour le client", client.slug);
    return;
  }

  await enfilerOuverture(env.PORTAL_DB, {
    linear_issue_uuid: evenement.issueId,
    client: client.slug,
    destinataire_clerk_id: destinataire.id,
    destinataire_prenom: destinataire.firstName ?? client.prenom ?? client.nom,
    destinataire_email: email,
    publish_after: new Date(maintenant + DELAI_DE_GRACE_MS).toISOString(),
    created_at: new Date(maintenant).toISOString(),
  });
}
