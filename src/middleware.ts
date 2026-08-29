import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";
import { lireSession } from "./lib/auth/session";

// L'espace client et toute la doc exigent une session.
// Le middleware ne tranche QUE la question « connecté ou non ». Le contrôle
// par workspace (qui voit quoi) se fait dans les routes, via la portée du
// compte — voir src/lib/portail/appartenances.ts.
const PROTECTED = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (PROTECTED.some((re) => re.test(pathname))) {
    const { user } = await lireSession(context);
    if (!user) {
      const signIn = new URL("/connexion", context.request.url);
      signIn.searchParams.set("redirect_url", context.request.url);
      return context.redirect(signIn.href);
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
