import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";
import { lireSession } from "./lib/auth/session";
import { decisionAcces, estRouteProtegee } from "./lib/portail/garde-admin";

// Le middleware ne décide plus : il obéit. Les règles vivent dans
// src/lib/portail/garde-admin.ts, où elles sont testables sans build Astro.
//
// Le contrôle par workspace (quel CLIENT voit quoi) reste dans les routes, via
// src/lib/portail/appartenances.ts — c'est une question de portée, pas de
// droit d'entrée.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  if (estRouteProtegee(pathname)) {
    const { user, meta } = await lireSession(context);
    const decision = decisionAcces(pathname, Boolean(user), meta);

    if (decision === "connexion") {
      const signIn = new URL("/connexion", context.request.url);
      signIn.searchParams.set("redirect_url", context.request.url);
      return context.redirect(signIn.href);
    }

    // 404 plutôt qu'une redirection : une redirection avouerait que la page
    // existe. Sur /espace/admin/finances, l'aveu apprend à un client que Ludo
    // tient un suivi de trésorerie et à quelle adresse.
    //
    // On réécrit vers la vraie page 404 pour que la réponse soit indiscernable
    // d'une URL morte. Pas de boucle possible : /404 n'est pas une route
    // protégée, elle ressort en « passe » au tour suivant.
    if (decision === "introuvable") {
      const rendu = await context.rewrite("/404");
      return new Response(rendu.body, { status: 404, headers: rendu.headers });
    }
  }

  /* Post/Redirect/Get pour portail.choisirWorkspace.
     Le sélecteur (WorkspaceSwitcher) vit dans la nav globale du portail et
     poste en formulaire natif vers la page courante (`?_astroAction=…`).
     Sans interception ici, le comportement par défaut d'Astro réécrit le
     résultat de l'action puis RE-REND cette même page : sur /docs/<projet>,
     la règle « l'URL gagne » de la route doc écrase alors aussitôt le
     cookie qu'on vient de poser avec le propriétaire de LA DOC AFFICHÉE, et
     un F5 redemande le renvoi du formulaire (l'URL garde le paramètre
     d'action).
     On appelle donc le handler nous-mêmes et on émet la redirection 303 —
     ActionAPIContext n'expose pas context.redirect(), d'où l'obligation de
     le faire ici plutôt que dans l'Action (voir src/actions/index.ts). */
  const { action, setActionResult, serializeActionResult } = getActionContext(context);
  if (action?.calledFrom === "form" && action.name === "portail.choisirWorkspace") {
    const result = await action.handler();
    if (!result.error) {
      return context.redirect(result.data.redirectTo, 303);
    }
    // Erreur (client inconnu, garde admin...) : on repasse la main au flux
    // normal, la page affichera l'erreur via Astro.getActionResult().
    setActionResult(action.name, serializeActionResult(result));
  }

  return next();
});
