import { clerkMiddleware } from "@clerk/astro/server";
import { getActionContext } from "astro:actions";

// L'espace client et toute la doc exigent une session Clerk.
// Le contrôle par client (qui voit quelle doc) se fait dans la route doc,
// via publicMetadata — voir src/pages/docs/[client]/[...slug].astro.
// NB : @clerk/astro v4 n'exporte plus createRouteMatcher, d'où le matcher maison.
const PROTECTED = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];

export const onRequest = clerkMiddleware(async (auth, context, next) => {
  const { pathname } = new URL(context.request.url);
  if (PROTECTED.some((re) => re.test(pathname))) {
    const authObject = auth();
    if (!authObject.userId) {
      // Page de connexion maison (/connexion, en français) plutôt que la
      // page hébergée Clerk (accounts.*, anglais uniquement).
      const signIn = new URL("/connexion", context.request.url);
      signIn.searchParams.set("redirect_url", context.request.url);
      return context.redirect(signIn.href);
    }
  }

  /* Post/Redirect/Get pour portail.choisirClient.
     Le sélecteur (ClientSwitcher) vit dans la nav globale du portail et
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
  if (action?.calledFrom === "form" && action.name === "portail.choisirClient") {
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
