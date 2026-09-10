// Bascule de visibilité d'un document. Réservée à l'admin (spec §5).
//
// Deux vérifications, et les deux comptent : le rôle, et l'appartenance du
// document au client courant. La seconde vit dans le WHERE de la requête
// (`basculerVisibilite`) plutôt qu'ici : un identifiant deviné ne doit pas
// suffire à démasquer le document d'un autre client, même pour un admin qui
// regarde un autre workspace.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../lib/portail/context";
import { isAdmin } from "../../../lib/portail/metadata";
import { basculerVisibilite } from "../../../lib/portail/documents/store";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  // 404 et non 403 : un rôle non-admin n'a pas à apprendre que cette route
  // existe.
  if (!user || !isAdmin(meta) || !client) return new Response("Introuvable", { status: 404 });

  let charge: { id?: unknown; visible?: unknown };
  try {
    charge = await context.request.json();
  } catch {
    return new Response("Corps illisible", { status: 400 });
  }

  const id = typeof charge.id === "string" ? charge.id : "";
  if (!id || typeof charge.visible !== "boolean") {
    return new Response("Paramètres invalides", { status: 400 });
  }

  const change = await basculerVisibilite(env.PORTAL_DB, id, client.slug, charge.visible);
  if (!change) return new Response("Introuvable", { status: 404 });

  return new Response(JSON.stringify({ ok: true, visible: charge.visible }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
