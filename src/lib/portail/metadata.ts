// Schéma canonique du publicMetadata Clerk.
//
// Depuis la spec 2026-08-12, il ne porte plus que deux clés : le rôle et un
// pointeur vers le registre des clients. Les mappings (doc, team Asana,
// monitors) ont migré sur le client — voir src/lib/portail/clients.ts. Un
// mapping vit donc une fois par client, plus une fois par contact, ce qui
// règle le garde-fou 03 au lieu de l'aggraver.
//
//   { "role": "client", "client": "amusoire" }
//
// La lecture reste tolérante : la saisie se fait à la main dans un éditeur
// JSON sans validation, et une forme inattendue doit mener à un empty state,
// jamais à une 500 (critère d'acceptation 7).

/** Rôle applicatif. Tout ce qui n'est pas exactement "admin" est un client. */
export type PortalRole = "client" | "admin";

export interface PortalMetadata {
  role: PortalRole;
  /** Slug dans le registre des clients. `null` si le mapping n'est pas posé. */
  client: string | null;
}

function asSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * TEMPORAIRE — à retirer une fois tous les comptes migrés.
 *
 * Entre le déploiement de cette spec et la mise à jour manuelle des comptes
 * dans le dashboard Clerk, un utilisateur n'a pas encore de clé `client`. On
 * lit alors l'ancien `projects[0]`, sans quoi son portail casse pendant la
 * fenêtre. Voir la section Migration de la spec.
 */
function legacyClient(meta: Record<string, unknown>): string | null {
  const raw = meta.projects;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return asSlug(first);
}

/**
 * Lit le publicMetadata d'un utilisateur Clerk. Ne lève jamais : toute forme
 * inattendue dégrade vers la valeur vide de la clé concernée.
 */
export function readPortalMetadata(raw: unknown): PortalMetadata {
  const meta = (raw ?? {}) as Record<string, unknown>;
  return {
    role: meta.role === "admin" ? "admin" : "client",
    client: asSlug(meta.client) ?? legacyClient(meta),
  };
}

export function isAdmin(meta: PortalMetadata): boolean {
  return meta.role === "admin";
}
