import { clerkMiddleware } from "@clerk/astro/server";

// L'espace client et toute la doc exigent une session Clerk.
// Le contrôle par projet (qui voit quelle doc) se fait dans la route doc,
// via publicMetadata — voir src/pages/docs/[project]/[...slug].astro.
// NB : @clerk/astro v4 n'exporte plus createRouteMatcher, d'où le matcher maison.
const PROTECTED = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];

export const onRequest = clerkMiddleware((auth, context, next) => {
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
  return next();
});
