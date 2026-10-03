/* Le PDF d'une pièce, ouvert dans un nouvel onglet depuis la page projet.
   Seul le client du workspace qu'il désigne le lit. Tout refus répond 404,
   comme une pièce inconnue : la route ne dit jamais qu'une pièce existe. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { dispositionInline, pieceLisible } from "../../../lib/pieces/pieces-r2";
import { workspacesVisibles } from "../../../lib/portail/appartenances";
import { getPortalContext } from "../../../lib/portail/context";
import { listWorkspaces } from "../../../lib/portail/workspaces";

export const prerender = false;

const introuvable = () => new Response("Introuvable", { status: 404 });

export const GET: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user) return introuvable();
  const chemin = context.params.chemin ?? "";
  const portee = workspacesVisibles(await listWorkspaces(), meta).map((w) => w.slug);
  if (!pieceLisible(chemin, client?.slug ?? null, portee)) return introuvable();
  const objet = await env.PORTAL_FILES.get(`pieces/${chemin}`);
  if (!objet) return introuvable();
  return new Response(objet.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": dispositionInline(chemin.split("/").pop()!),
      "x-content-type-options": "nosniff",
      "cache-control": "private",
    },
  });
};
