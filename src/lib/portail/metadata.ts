// Schema applicatif d'un compte du portail (spec 2026-08-19 §3.1, §5.3).
//
// Le type de compte vit sur l'utilisateur Better Auth (`portalRole`), sa
// portee sur ses appartenances organisation/team. Un meme compte peut donc
// etre revendeur ici et n'avoir aucun acces la — ce qu'un publicMetadata plat
// ne savait pas exprimer.
//
// La lecture reste tolerante : une forme inattendue mene a un empty state,
// jamais a une 500.

/** Type de compte. Liste blanche : l'inconnu retombe sur `client`. */
export type PortalRole = "admin" | "revendeur" | "client";

const ROLES: readonly string[] = ["admin", "revendeur", "client"];

export interface PortalMetadata {
  role: PortalRole;
  /** Slug du revendeur (registre des organisations). */
  organisation: string | null;
  /** Slug du workspace client (registre des clients). */
  workspace: string | null;
}

function asSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * LA regle de securite de ce fichier : liste blanche.
 *
 * L'ancienne disait « tout ce qui n'est pas exactement admin est un client ».
 * Avec un troisieme type elle ne casse rien, mais elle ne reconnait jamais
 * `revendeur` — silencieusement. Une liste blanche echoue du bon cote : une
 * valeur inconnue retombe sur le type le moins ouvert, jamais sur un autre.
 */
function asRole(value: unknown): PortalRole {
  return typeof value === "string" && ROLES.includes(value) ? (value as PortalRole) : "client";
}

export function readPortalMetadata(raw: unknown): PortalMetadata {
  const meta = (raw ?? {}) as Record<string, unknown>;
  return {
    role: asRole(meta.portalRole),
    organisation: asSlug(meta.organisation),
    workspace: asSlug(meta.workspace),
  };
}

export function isAdmin(meta: PortalMetadata): boolean {
  return meta.role === "admin";
}

export function isRevendeur(meta: PortalMetadata): boolean {
  return meta.role === "revendeur";
}
