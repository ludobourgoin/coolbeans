// Garde admin, extraite de src/actions/index.ts pour rester testable sous
// Vitest : `astro:actions` est un module virtuel, indisponible hors du build
// Astro (même contrainte que `astro:content`, déjà contournée dans clients.ts
// via les fonctions `*In`).
//
// Lève une Error ordinaire — pas une ActionError, `astro:actions` n'étant pas
// importable ici. L'appelant (l'Action) la convertit.

import type { APIContext } from "astro";

export async function requireAdmin(locals: APIContext["locals"]): Promise<void> {
  const user = await locals.currentUser();
  const role = ((user?.publicMetadata ?? {}) as { role?: string }).role;
  if (!user || role !== "admin") {
    throw new Error("Réservé à l'administrateur.");
  }
}
