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
      return authObject.redirectToSignIn();
    }
  }
  return next();
});
