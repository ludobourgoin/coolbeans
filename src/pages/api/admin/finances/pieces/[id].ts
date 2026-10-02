/* Le PDF de n'importe quelle pièce, pour l'admin : pièces de revendeur et
   pièces sans projet comprises. Sous /api/admin/, donc gardée par le
   middleware (src/lib/portail/garde-admin.ts) : rien à vérifier ici. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { db } from "../../../../../lib/devis/reponses";
import { reponsePdf } from "../../../../../lib/pieces/reponse-pdf";
import { pieceParId } from "../../../../../lib/pieces/store";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const piece = await pieceParId(db(), context.params.id ?? "");
  const objet = piece ? await env.PORTAL_FILES.get(piece.r2_key) : null;
  if (!piece || !objet) return new Response("Introuvable", { status: 404 });
  return reponsePdf(objet, piece);
};
