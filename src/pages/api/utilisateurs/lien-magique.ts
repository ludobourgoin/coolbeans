// Fabrique un lien de connexion et le RENVOIE, au lieu de l'envoyer par mail.
//
// Réservé à l'admin. Sert quand Ludo veut écrire lui-même à son client, avec
// ses mots, plutôt que de laisser partir le mail type du portail.
//
// Le lien vaut connexion : il ne se journalise pas, il ne se met pas en cache,
// et il ne transite que dans cette réponse.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../lib/portail/context";
import { isAdmin } from "../../../lib/portail/metadata";
import { EN_TETE_CAPTURE, reserverCapture, retirerLien } from "../../../lib/auth/capture-lien";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { user, meta } = await getPortalContext(context);
  // 404 et non 403 : un rôle non-admin n'a pas à apprendre que cette route
  // existe.
  if (!user || !isAdmin(meta)) return new Response("Introuvable", { status: 404 });

  let charge: { email?: unknown };
  try {
    charge = await context.request.json();
  } catch {
    return new Response("Corps illisible", { status: 400 });
  }
  const email = typeof charge.email === "string" ? charge.email.trim() : "";
  if (!email) return new Response("Adresse manquante", { status: 400 });

  const origine = new URL(context.request.url).origin;
  const jeton = reserverCapture();

  try {
    const { createAuth } = await import("../../../lib/auth/server");
    await createAuth(env, origine).api.signInMagicLink({
      body: { email, callbackURL: "/" },
      headers: new Headers({ [EN_TETE_CAPTURE]: jeton }),
    });
  } catch {
    retirerLien(jeton); // libère la réservation
    return new Response("Lien impossible à générer.", { status: 400 });
  }

  const url = retirerLien(jeton);
  if (!url) {
    /* `disableSignUp` est actif : une adresse inconnue ne crée pas de compte,
       et le plugin n'appelle alors jamais sendMagicLink. C'est le cas nominal
       d'une faute de frappe, pas une panne. */
    return new Response("Aucun compte pour cette adresse.", { status: 404 });
  }

  return new Response(JSON.stringify({ url }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
