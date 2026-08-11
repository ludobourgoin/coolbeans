// Contexte utilisateur du portail, mémoïsé pour la durée d'une requête.
//
// `Astro.locals.currentUser()` de @clerk/astro n'est pas mémoïsé : chaque appel
// refait un `users.getUser()` bloquant vers la Backend API Clerk. Or le layout
// du portail a besoin du metadata (la nav dépend du rôle et des slugs de doc)
// et les pages aussi — soit deux allers-retours réseau par rendu si chacun
// appelle de son côté.
//
// On range donc le résultat dans `locals`, qui vit le temps d'une requête.

import type { User } from "@clerk/backend";
import type { APIContext } from "astro";
import { readPortalMetadata, type PortalMetadata } from "./metadata";

const CACHE_KEY = "__portalContext";

export interface PortalContext {
  /** `null` si personne n'est connecté. */
  user: User | null;
  meta: PortalMetadata;
}

type WithCache = APIContext["locals"] & { [CACHE_KEY]?: Promise<PortalContext> };

/**
 * L'utilisateur courant et son publicMetadata, lus une seule fois par requête.
 * Ne lève jamais : sans session, renvoie le metadata par défaut (rôle client,
 * tout vide), ce qui mène aux empty states plutôt qu'à une 500 — critère
 * d'acceptation 7.
 */
export function getPortalContext(locals: APIContext["locals"]): Promise<PortalContext> {
  const cache = locals as WithCache;
  // On mémoïse la promesse, pas sa valeur résolue : deux appels concurrents
  // dans le même rendu partagent ainsi le même aller-retour réseau.
  cache[CACHE_KEY] ??= locals.currentUser().then((user) => ({
    user: user ?? null,
    meta: readPortalMetadata(user?.publicMetadata),
  }));
  return cache[CACHE_KEY];
}

/** Raccourci quand seul le metadata est utile. */
export async function getPortalMeta(locals: APIContext["locals"]): Promise<PortalMetadata> {
  return (await getPortalContext(locals)).meta;
}
