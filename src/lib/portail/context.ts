// Contexte du portail, mémoïsé pour la durée d'une requête.
//
// La mémoïsation vient de l'époque Clerk, où chaque `currentUser()` refaisait
// un aller-retour bloquant vers sa Backend API. Elle reste utile avec Better
// Auth : la session est en D1, et la résolution des slugs coûte une requête de
// plus. Le layout et la page demandent tous deux ce contexte — sans
// mémoïsation, ce serait deux fois le travail par rendu.
//
// On y adjoint la résolution du client courant, qui lit la collection et le
// cookie, pour n'avoir qu'un seul point d'entrée.
//
// Prend l'APIContext complet et non `locals` seul : la résolution a besoin des
// cookies.

import type { APIContext } from "astro";
import { listWorkspaces, type PortalWorkspace } from "./workspaces";

/* On ne demande que ce dont la résolution a besoin. `Astro` dans une page est
   un AstroGlobal, pas un APIContext : exiger le type complet ne compilerait
   pas. Ce Pick accepte les deux, ainsi que le contexte d'une Action. */
export type PortalRequestContext = Pick<APIContext, "locals" | "cookies" | "request">;
import { WORKSPACE_COOKIE, resolveCurrentWorkspace } from "./current-workspace";
import { type PortalMetadata } from "./metadata";
import { lireSession, type SessionPortail } from "../auth/session";

const CACHE_KEY = "__portalContext";

export interface PortalContext {
  /** `null` si personne n'est connecté. */
  user: SessionPortail["user"];
  meta: PortalMetadata;
  /** Client dont les données doivent s'afficher. `null` si aucun n'est résolu. */
  client: PortalWorkspace | null;
}

type WithCache = APIContext["locals"] & {
  [CACHE_KEY]?: Promise<PortalContext>;
};

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
    const { user, meta } = await lireSession(context);
    const clients = await listWorkspaces();
    const cookie = context.cookies.get(WORKSPACE_COOKIE)?.value ?? null;
    return { user, meta, client: resolveCurrentWorkspace(clients, meta, cookie) };
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
export function overrideCurrentWorkspace(context: PortalRequestContext, client: PortalWorkspace): void {
  const cache = context.locals as WithCache;
  const previous = cache[CACHE_KEY];
  if (!previous) {
    throw new Error(
      "overrideCurrentWorkspace : appeler getPortalContext avant, pour amorcer le contexte de la requête.",
    );
  }
  cache[CACHE_KEY] = previous.then((ctx) => ({ ...ctx, client }));
}
