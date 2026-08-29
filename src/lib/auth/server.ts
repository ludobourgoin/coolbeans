// Fabrique de l'instance Better Auth (spec 2026-08-19 §3).
//
// Construite PAR REQUETE, jamais au niveau module : sur Workers, les bindings
// (D1) n'existent pas a l'import. Une instance construite une fois pour
// toutes leverait au premier appel, et le message ne dirait pas pourquoi.
//
// La configuration fonctionnelle vit dans options.ts, partagee avec le script
// qui genere le schema SQL : c'est ce qui empeche la base et le code de
// diverger.

import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { optionsAuth } from "./options";

/**
 * Instance Better Auth pour une requete.
 *
 * @param env bindings du Worker (PORTAL_DB, BETTER_AUTH_SECRET)
 * @param baseURL origine REELLE de la requete. Le portail est servi sur
 *   my.coolbeans.cc via la reecriture d'hote de src/worker.ts : une baseURL
 *   figee casserait les cookies en deploye sans que rien ne se voie en local.
 */
export function createAuth(env: Env, baseURL: string) {
  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    ...withCloudflare(
      {
        // d1Native : aucun ORM. Le repo n'en utilise nulle part, et en
        // ajouter un pour l'auth serait une dependance de plus a maintenir.
        // Pas de KV en secondary storage : son TTL minimum de 60 s est un
        // piege documente, pour un gain nul a cette echelle.
        d1Native: env.PORTAL_DB,
        // Geolocalisation et detection d'IP coupees : withCloudflare les
        // active par defaut et exige alors un contexte `cf`. Un portail
        // client prive n'a aucun usage de ces donnees, et ne pas les
        // collecter vaut mieux que les collecter sans les lire.
        autoDetectIpAddress: false,
        geolocationTracking: false,
      },
      optionsAuth(env),
    ),
  });
}
