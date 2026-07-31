import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

// L'espace client et toute la doc exigent une session Clerk.
// Le contrôle par projet (qui voit quelle doc) se fait dans la route doc,
// via publicMetadata — voir src/pages/docs/[project]/[...slug].astro.
const isProtected = createRouteMatcher(["/espace(.*)", "/docs(.*)"]);

export const onRequest = clerkMiddleware((auth, context, next) => {
  if (isProtected(context.request) && !auth().userId) {
    return auth().redirectToSignIn();
  }
  return next();
});
