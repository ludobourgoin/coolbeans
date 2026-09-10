// Service d'un fichier déposé. R2 est PRIVÉ : session valide, appartenance du
// document au client courant, ET visibilité pour les rôles non-admin.
//
// C'EST LE PIÈGE PRINCIPAL DE LA FONCTIONNALITÉ (spec §5) : sans le contrôle
// de visibilité ici, un client qui connaît un identifiant récupère un document
// masqué, alors même que la liste ne le lui a jamais montré. Le test qui couvre
// ce cas est l'un des deux qui comptent.
//
// Reprend le patron de /api/messagerie/fichier/[id].ts, y compris l'allowlist
// de MIME : servir un `text/html` déposé tel quel, en inline, sur l'origine qui
// porte le cookie de session, c'est un XSS stocké.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../../lib/portail/context";
import { isAdmin } from "../../../../lib/portail/metadata";
import { documentParId } from "../../../../lib/portail/documents/store";
import { peutServirFichier, serviceFichier } from "../../../../lib/portail/documents/acces";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  const doc = user ? await documentParId(env.PORTAL_DB, context.params.id ?? "") : null;

  // Toute la règle vit dans `peutServirFichier`, testée seule : cette route
  // n'est qu'un transport.
  const autorise = peutServirFichier({
    connecte: Boolean(user),
    clientCourant: client?.slug ?? null,
    admin: isAdmin(meta),
    doc,
  });
  if (!autorise || !doc?.r2_key) return new Response("Introuvable", { status: 404 });

  const objet = await env.PORTAL_FILES.get(doc.r2_key);
  if (!objet) return new Response("Fichier absent du stockage", { status: 404 });

  const { contentType, disposition } = serviceFichier(doc.mime, doc.titre);

  return new Response(objet.body, {
    headers: {
      "content-type": contentType,
      "content-disposition": disposition,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
};
