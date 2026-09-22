/* Empreinte git du déploiement, lue par la bande d'environnement d'un autre
   hôte. Une page de staging la demande à la production pour savoir si ce
   qu'on est en train de lire correspond à ce que le client voit.

   SSR et non prérendue. Un point de terminaison prérendu devient un fichier
   statique, et les en-têtes posés dans la réponse sont perdus : il faudrait
   les redéclarer dans `public/_headers`, à un endroit sans rapport avec ce
   fichier. Ici tout tient en un seul endroit, au prix d'une route Worker
   dont le corps fait quarante octets.

   `access-control-allow-origin` ouvert : staging.coolbeans.cc interroge
   coolbeans.cc, ce sont deux origines distinctes. Le contenu exposé est une
   empreinte de commit public, il n'y a rien à protéger.

   `no-store` : une empreinte mise en cache dirait que la production est à
   jour alors qu'elle vient de changer, ce qui est exactement l'erreur que ce
   point de terminaison sert à détecter.

   L'HISTORIQUE est exposé, pas seulement l'empreinte de tête, et c'est le
   sens de la comparaison qui l'impose. La publication se fait par
   `git merge --no-ff staging` sur `main` : le commit de fusion naît sur
   `main` et n'est donc JAMAIS un ancêtre de `staging`. Chercher l'empreinte
   de production dans l'historique de staging échoue toujours, y compris
   quand les deux sont en phase. Constaté le 2026-09-22 sur le déploiement
   `7c82b46`, qui annonçait un écart inconnu alors qu'il n'y en avait aucun.

   L'inverse est vrai : `main` contient tous les commits de `staging` comme
   ancêtres. C'est donc staging qui cherche SES empreintes dans l'historique
   de la production, et le rang de la première trouvée donne le nombre de
   commits d'avance. */
import type { APIRoute } from "astro";

export const prerender = false;

declare const __GIT_SHA__: string;
declare const __GIT_HISTORIQUE__: string[];

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ sha: __GIT_SHA__, historique: __GIT_HISTORIQUE__ }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
