/* Le PDF d'une pièce pour le client (spec 2026-10-02, §5). Tout refus répond
   404, comme une pièce inconnue : la route ne dit jamais qu'une pièce existe. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { db } from "../../../lib/devis/reponses";
import { pieceLisibleParClient } from "../../../lib/pieces/acces";
import { reponsePdf } from "../../../lib/pieces/reponse-pdf";
import { lireSansPanne, pieceParId } from "../../../lib/pieces/store";
import { workspacesVisibles } from "../../../lib/portail/appartenances";
import { getPortalContext } from "../../../lib/portail/context";
import { listWorkspaces } from "../../../lib/portail/workspaces";

export const prerender = false;

const introuvable = () => new Response("Introuvable", { status: 404 });

export const GET: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user) return introuvable();
  const piece = await lireSansPanne(() => pieceParId(db(), context.params.id ?? ""), null);
  const portee = workspacesVisibles(await listWorkspaces(), meta).map((w) => w.slug);
  if (!piece || !pieceLisibleParClient(piece, client?.slug ?? null, portee)) return introuvable();
  const objet = await env.PORTAL_FILES.get(piece.r2_key);
  if (!objet) return introuvable();
  return reponsePdf(objet, piece);
};
