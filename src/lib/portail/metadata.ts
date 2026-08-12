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

/**
 * @deprecated Les clés de mapping décrivent le client, pas l'utilisateur.
 * Voir clients.ts. Retiré en Task 9.
 */
export type PortalMetadataKey =
  | "role"
  | "projects"
  | "asana_team_gid"
  | "uptimerobot_monitor_ids";

export interface PortalMetadata {
  role: PortalRole;
  /** Slug dans le registre des clients. `null` si le mapping n'est pas posé. */
  client: string | null;

  /** @deprecated Migré vers le registre. Retiré en Task 9. */
  projects: string[];
  /** @deprecated Migré vers le registre. Retiré en Task 9. */
  asana_team_gid: string | null;
  /** @deprecated Migré vers le registre. Retiré en Task 9. */
  uptimerobot_monitor_ids: string[];
}

/**
 * @deprecated Les mappings décrivent le client, pas l'utilisateur. Voir clients.ts. Retiré en Task 9.
 */
export type PortalModule = "projets" | "site" | "doc" | "support";

/**
 * @deprecated Les mappings décrivent le client, pas l'utilisateur. Voir clients.ts. Retiré en Task 9.
 *
 * Clé(s) sans lesquelles un module ne peut rien afficher.
 *
 * Ressources n'y figure pas : son contenu est commun à tous les clients et ne
 * dépend d'aucun mapping.
 */
export const MODULE_REQUIREMENTS: Record<PortalModule, readonly PortalMetadataKey[]> = {
  projets: ["asana_team_gid"],
  support: ["asana_team_gid"],
  site: ["uptimerobot_monitor_ids"],
  doc: ["projects"],
};

/**
 * Un GID Asana saisi sans guillemets dans l'éditeur JSON de Clerk arrive en
 * `number` et perd sa nature d'identifiant. On accepte les deux, on renvoie
 * toujours une chaîne. Les entrées vides ou non scalaires sont écartées.
 */
function asId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  // Number.isFinite écarte NaN et Infinity ; les GID dépassent Number.MAX_SAFE_INTEGER
  // en théorie, mais Clerk les rendrait déjà tronqués — on ne peut que les relayer.
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Tolère la valeur scalaire là où un tableau est attendu : écrire
 * `"projects": "amusoire"` est l'erreur de saisie la plus naturelle.
 */
function asIdList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const entry of raw) {
    const id = asId(entry);
    // Un doublon de saisie ne doit pas produire deux fois la même carte.
    if (id !== null && !out.includes(id)) out.push(id);
  }
  return out;
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
    // Champs dépréciés, conservés le temps que les appelants migrent (Task 9).
    projects: asIdList(meta.projects),
    asana_team_gid: asId(meta.asana_team_gid),
    uptimerobot_monitor_ids: asIdList(meta.uptimerobot_monitor_ids),
  };
}

export function isAdmin(meta: PortalMetadata): boolean {
  return meta.role === "admin";
}

/** Une clé est « posée » si elle porte une valeur exploitable, pas seulement si elle existe. */
function hasKey(meta: PortalMetadata, key: PortalMetadataKey): boolean {
  switch (key) {
    case "role":
      return true; // toujours résolu par readPortalMetadata, jamais manquant
    case "asana_team_gid":
      return meta.asana_team_gid !== null;
    case "projects":
      return meta.projects.length > 0;
    case "uptimerobot_monitor_ids":
      return meta.uptimerobot_monitor_ids.length > 0;
  }
}

/**
 * @deprecated Les mappings décrivent le client, pas l'utilisateur. Voir clients.ts. Retiré en Task 9.
 *
 * Clés manquantes pour ce module. Tableau vide = le module peut s'afficher.
 * C'est ce que l'empty state montre à un admin, et tait à un client.
 */
export function missingKeysFor(
  module: PortalModule,
  meta: PortalMetadata,
): PortalMetadataKey[] {
  return MODULE_REQUIREMENTS[module].filter((key) => !hasKey(meta, key));
}
