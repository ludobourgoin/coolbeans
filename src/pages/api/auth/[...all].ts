// Handler Better Auth : /api/auth/* (connexion, deconnexion, lien magique,
// invitations, organisations).
//
// `env` vient de "cloudflare:workers" comme partout ailleurs dans le repo
// (devis-reponse.ts, linear-webhook.ts) : c'est un proxy resolu au moment de
// la requete, donc compatible avec une instance d'auth construite par requete.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createAuth } from "../../../lib/auth/server";

// Obligatoire : une route prerendue ne verrait jamais la requete.
export const prerender = false;

const handler: APIRoute = ({ request }) => {
  // baseURL = l'origine REELLE de la requete, jamais une constante. Le portail
  // est servi sur my.coolbeans.cc via la reecriture d'hote de src/worker.ts :
  // une baseURL figee casserait les cookies en deploye, et ca ne se verrait
  // pas en local.
  return createAuth(env, new URL(request.url).origin).handler(request);
};

export const GET = handler;
export const POST = handler;
