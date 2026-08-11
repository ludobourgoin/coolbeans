// Schéma canonique du publicMetadata Clerk (tâche S0.6).
//
// Trois mappings relient un utilisateur Clerk à ses données, et ils sont posés
// À LA MAIN dans le dashboard Clerk à l'onboarding. C'est le garde-fou 03 du
// doc master : « trois mappings posés à la main = incohérences garanties ».
// Ce fichier est la contrepartie exécutable du bloc de référence — il est la
// seule source de vérité sur la forme attendue et sur ce qui manque.
//
// Bloc de référence (documentation : docs/superpowers/specs/2026-08-11-portail-publicmetadata.md) :
//
//   {
//     "role": "client",                        // ou "admin"
//     "projects": ["amusoire"],                // slugs doc  → module Doc
//     "asana_team_gid": "1217116359107690",    // team Asana → modules Projets + Support
//     "uptimerobot_monitor_ids": ["800123456"] // monitors   → module Mon site
//   }
//
// La lecture est volontairement tolérante : la saisie est manuelle, dans un
// éditeur JSON libre. Une valeur mal typée doit dégrader vers un empty state
// qui nomme la clé, jamais vers une 500 (critère d'acceptation 7).

/** Rôle applicatif. Tout ce qui n'est pas exactement "admin" est un client. */
export type PortalRole = "client" | "admin";

/** Les clés du schéma canonique, telles qu'écrites dans le dashboard Clerk. */
export type PortalMetadataKey =
  | "role"
  | "projects"
  | "asana_team_gid"
  | "uptimerobot_monitor_ids";

export interface PortalMetadata {
  role: PortalRole;
  /** Slugs de doc autorisés. Vide = aucun accès doc. */
  projects: string[];
  /** GID de la team Asana du client. `null` si le mapping n'est pas posé. */
  asana_team_gid: string | null;
  /** IDs des monitors UptimeRobot. Tableau dès la V1 pour préparer le multi-sites. */
  uptimerobot_monitor_ids: string[];
}

/** Modules du portail qui dépendent d'au moins une clé de metadata. */
export type PortalModule = "projets" | "site" | "doc" | "support";

/**
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

/**
 * Lit le publicMetadata d'un utilisateur Clerk. Ne lève jamais : toute forme
 * inattendue dégrade vers la valeur vide de la clé concernée.
 */
export function readPortalMetadata(raw: unknown): PortalMetadata {
  const meta = (raw ?? {}) as Record<string, unknown>;
  return {
    role: meta.role === "admin" ? "admin" : "client",
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
 * Clés manquantes pour ce module. Tableau vide = le module peut s'afficher.
 * C'est ce que l'empty state montre à un admin, et tait à un client.
 */
export function missingKeysFor(
  module: PortalModule,
  meta: PortalMetadata,
): PortalMetadataKey[] {
  return MODULE_REQUIREMENTS[module].filter((key) => !hasKey(meta, key));
}
