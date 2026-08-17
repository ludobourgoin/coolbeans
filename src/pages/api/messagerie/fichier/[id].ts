// Téléchargement d'une pièce jointe. R2 est PRIVÉ (spec §4) : session Clerk
// + le fichier doit appartenir à un ticket du client courant. L'admin passe
// par le même chemin (son client courant suit le sélecteur).

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../../lib/portail/context";
import { messageParId, pieceJointeParId, ticketParId } from "../../../../lib/portail/messagerie/store";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { user, client } = await getPortalContext(context);
  if (!user) return new Response("Introuvable", { status: 404 });

  const piece = await pieceJointeParId(env.PORTAL_DB, context.params.id ?? "");
  if (!piece) return new Response("Introuvable", { status: 404 });
  const message = await messageParId(env.PORTAL_DB, piece.message_id);
  const ticket = message ? await ticketParId(env.PORTAL_DB, message.ticket_id) : null;
  if (!ticket || ticket.client !== client?.slug) return new Response("Introuvable", { status: 404 });

  const objet = await env.PORTAL_FILES.get(piece.r2_key);
  if (!objet) return new Response("Fichier absent du stockage", { status: 404 });

  // Le MIME et le nom de fichier sont fournis par le client au moment de
  // l'upload (nouveau.ts/reponse.ts) : servir tel quel ouvre à du XSS stocké
  // (ex. mime "text/html" affiché inline sur l'origine my.coolbeans.cc, qui
  // porte le cookie de session Clerk). On ne fait confiance qu'à une
  // allowlist restreinte pour l'affichage inline ; tout le reste part en
  // téléchargement forcé, jamais exécuté par le navigateur.
  const mimeSur = piece.mime.startsWith("image/") || piece.mime === "application/pdf";
  const contentType = mimeSur ? piece.mime : "application/octet-stream";
  const filenameEncode = encodeURIComponent(piece.filename);
  const disposition = mimeSur
    ? `inline; filename*=UTF-8''${filenameEncode}`
    : `attachment; filename*=UTF-8''${filenameEncode}`;

  return new Response(objet.body, {
    headers: {
      "content-type": contentType,
      "content-disposition": disposition,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
};
