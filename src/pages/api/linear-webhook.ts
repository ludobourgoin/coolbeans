// Réception des webhooks Linear (événements Comment). Enfile la publication
// avec un délai de grâce de 3 min — le cron (src/worker.ts) fera le re-fetch
// et l'envoi. Répondre 200 vite : Linear retente sinon, et l'idempotence D1
// absorbe de toute façon les doublons.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { enfilerPublication, ticketParIssueUuid } from "../../lib/portail/messagerie/store";
import { analyserEvenement, signatureValide } from "../../lib/portail/messagerie/webhook";

export const prerender = false;

const DELAI_DE_GRACE_MS = 3 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  const secret = env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("linear-webhook: LINEAR_WEBHOOK_SECRET absent de cet environnement");
    return new Response(null, { status: 503 });
  }
  const rawBody = await request.text();
  const ok = await signatureValide(secret, rawBody, request.headers.get("linear-signature"));
  if (!ok) return new Response(null, { status: 401 });

  const evenement = analyserEvenement(JSON.parse(rawBody));
  if (!evenement) return new Response(null, { status: 200 });

  const ticket = await ticketParIssueUuid(env.PORTAL_DB, evenement.issueId);
  // Commentaire >> sur une issue hors messagerie (issue de projet classique) :
  // rien à publier, ce n'est pas un ticket.
  if (!ticket) return new Response(null, { status: 200 });

  const maintenant = Date.now();
  await enfilerPublication(env.PORTAL_DB, {
    linear_comment_id: evenement.commentId,
    ticket_id: ticket.id,
    publish_after: new Date(maintenant + DELAI_DE_GRACE_MS).toISOString(),
    created_at: new Date(maintenant).toISOString(),
  });
  return new Response(null, { status: 200 });
};
