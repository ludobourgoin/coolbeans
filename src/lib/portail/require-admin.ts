// Garde admin, extraite de src/actions/index.ts pour rester testable sous
// Vitest : `astro:actions` est un module virtuel, indisponible hors du build
// Astro (même contrainte que `astro:content`, déjà contournée dans clients.ts
// via les fonctions `*In`).
//
// Depuis la bascule vers Better Auth (2026-08-26), elle ne lit plus la session
// elle-même : elle reçoit le compte déjà résolu. La lecture de session passe
// par `cloudflare:workers`, qui n'existe pas sous Vitest — la garder ici
// aurait rendu ce fichier intestable, c'est-à-dire aurait annulé la raison
// même de son extraction.
//
// Lève une Error ordinaire — pas une ActionError, `astro:actions` n'étant pas
// importable ici. L'appelant (l'Action) la convertit.

import { isAdmin, type PortalMetadata } from "./metadata";

export function requireAdmin(meta: PortalMetadata): void {
  if (!isAdmin(meta)) {
    throw new Error("Réservé à l'administrateur.");
  }
}
