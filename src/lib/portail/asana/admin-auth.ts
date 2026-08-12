// Garde de POST /api/admin/sync (brief §8).
//
// Extraite dans son propre module pour être testable sans `astro:*` — même
// motif que src/lib/portail/require-admin.ts.
//
// Cette route n'est PAS derrière Clerk : src/middleware.ts ne protège que
// /espace et /docs. Le secret partagé est donc la seule barrière, et un secret
// non posé doit fermer la route, jamais l'ouvrir.

export const SYNC_SECRET_HEADER = "x-admin-sync-secret";

/**
 * Comparaison à durée constante. L'écart de timing d'un `===` sur des chaînes
 * est indétectable à travers le réseau en pratique, mais le coût de faire
 * juste est de six lignes — et c'est un secret de longue durée, pas un jeton
 * de session.
 */
export function isAuthorizedSync(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
