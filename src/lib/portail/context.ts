// Contexte du portail, mémoïsé pour la durée d'une requête.
//
// `Astro.locals.currentUser()` de @clerk/astro n'est pas mémoïsé : chaque appel
// refait un `users.getUser()` bloquant vers la Backend API Clerk. Le layout et
// la page en ont tous deux besoin — sans mémoïsation, deux allers-retours
// réseau par rendu. On y adjoint la résolution du client courant, qui lit la
// collection et le cookie, pour n'avoir qu'un seul point d'entrée.
//
// Prend l'APIContext complet et non `locals` seul : la résolution a besoin des
// cookies.

import type { User } from "@clerk/backend";
import type { APIContext } from "astro";
import { listClients, type PortalClient } from "./clients";

/* On ne demande que ce dont la résolution a besoin. `Astro` dans une page est
   un AstroGlobal, pas un APIContext : exiger le type complet ne compilerait
   pas. Ce Pick accepte les deux, ainsi que le contexte d'une Action. */
export type PortalRequestContext = Pick<APIContext, "locals" | "cookies">;
import { CLIENT_COOKIE, resolveCurrentClient } from "./current-client";
import { readPortalMetadata, type PortalMetadata } from "./metadata";

const USER_CACHE_KEY = "__portalUser";
const CACHE_KEY = "__portalContext";

export interface PortalContext {
  /** `null` si personne n'est connecté. */
  user: User | null;
  meta: PortalMetadata;
  /** Client dont les données doivent s'afficher. `null` si aucun n'est résolu. */
  client: PortalClient | null;
}

type WithCache = APIContext["locals"] & {
  [USER_CACHE_KEY]?: Promise<User | null>;
  [CACHE_KEY]?: Promise<PortalContext>;
};

/** L'appel Clerk lui-même, mémoïsé — les deux entrées ci-dessous le partagent. */
function getUser(locals: APIContext["locals"]): Promise<User | null> {
  const cache = locals as WithCache;
  cache[USER_CACHE_KEY] ??= locals.currentUser().then((u) => u ?? null);
  return cache[USER_CACHE_KEY];
}

/**
 * L'utilisateur, son metadata et le client courant, résolus une seule fois par
 * requête. Ne lève jamais : sans session, renvoie le metadata par défaut et un
 * client nul, ce qui mène aux empty states plutôt qu'à une 500.
 */
export function getPortalContext(context: PortalRequestContext): Promise<PortalContext> {
  const cache = context.locals as WithCache;
  // On mémoïse la promesse, pas sa valeur : deux appels concurrents dans le
  // même rendu partagent le même aller-retour réseau.
  cache[CACHE_KEY] ??= (async () => {
    const user = await getUser(context.locals);
    const meta = readPortalMetadata(user?.publicMetadata);
    const clients = await listClients();
    const cookie = context.cookies.get(CLIENT_COOKIE)?.value ?? null;
    return { user, meta, client: resolveCurrentClient(clients, meta, cookie) };
  })();
  return cache[CACHE_KEY];
}

/**
 * Force le client courant pour le reste de la requête. Utilisé par la route
 * de doc quand l'URL impose un contexte : sans ça, tout appelant ultérieur
 * de getPortalContext — le layout, notamment — verrait le client d'avant la
 * bascule, et la nav contredirait la page.
 *
 * Suppose que getPortalContext a déjà été appelé une première fois dans la
 * requête (c'est le cas au point d'appel actuel, qui lit `meta` et `client`
 * juste avant) : sans ça, on n'a ni user ni meta réels à partir desquels
 * dériver un contexte, et les fabriquer à vide produirait un contexte faux
 * plutôt qu'une erreur visible.
 */
export function overrideCurrentClient(context: PortalRequestContext, client: PortalClient): void {
  const cache = context.locals as WithCache;
  const previous = cache[CACHE_KEY];
  if (!previous) {
    throw new Error(
      "overrideCurrentClient : appeler getPortalContext avant, pour amorcer le contexte de la requête.",
    );
  }
  cache[CACHE_KEY] = previous.then((ctx) => ({ ...ctx, client }));
}
