// Registre des clients du portail (spec 2026-08-12).
//
// Un client est l'unité à laquelle se rattachent une doc, une team Asana et des
// monitors. Avant ce registre, ces trois mappings vivaient sur chaque
// utilisateur Clerk : deux contacts d'un même client pouvaient diverger, et
// rien ne permettait d'énumérer les clients — donc pas de sélecteur possible.
//
// Les fonctions `*In` prennent la liste en argument : c'est ce qui les rend
// testables sans `astro:content`, indisponible sous Vitest.

export interface PortalWorkspace {
  /** Nom du fichier YAML, sans extension. */
  slug: string;
  nom: string;
  /** Prénom du contact principal — salutation en vue admin-basculé. */
  prenom?: string;
  /** Slug dans la collection `docs`. Absent = ce client n'a pas de doc. */
  doc?: string;
  /** UUID de la team Linear où le formulaire support crée ses tickets. */
  linearTeamId?: string;
  /** UUID du projet « Support » (evergreen) de la team : la messagerie y crée ses tickets. */
  linearSupportProjectId?: string;
  uptimerobot_monitor_ids: string[];
  /**
   * Workspace « à moi » (Coolbeans, Spinoza…) par opposition aux workspaces
   * clients : le sélecteur les affiche en tête, avant le liseret.
   */
  perso?: boolean;
  /** Emoji affiché devant le nom dans le sélecteur (workspaces clients). */
  emoji?: string;
  /** Début de la relation (YYYY-MM-DD) : fonde le tri chronologique des clients. */
  depuis?: string;
  /**
   * Sort le client du sélecteur sans rien supprimer : sa fiche, sa doc et ses
   * instantanés KV restent, et il reste résoluble par son slug. Archiver n'est
   * pas supprimer — c'est ce qui permet de garder un ancien client accessible
   * sans allonger la liste indéfiniment.
   */
  archive: boolean;
}

/** Client affiché par défaut à l'admin, et tête de liste du sélecteur. */
export const DEFAULT_WORKSPACE = "coolbeans";

/** Modules dont l'affichage dépend d'un mapping du client. */
export type PortalModule = "projets" | "site" | "doc" | "support";

/** Clés de mapping d'un client, telles que nommées dans le YAML. */
export type WorkspaceMappingKey =
  | "doc"
  | "linearTeamId"
  | "linearSupportProjectId"
  | "uptimerobot_monitor_ids";

/**
 * Mapping sans lequel un module ne peut rien afficher.
 * Ressources n'y figure pas : son contenu est commun à tous les clients.
 *
 * Projets ne réclame plus rien depuis le retrait du sync Asana : il ne
 * dépendait que d'`asana_team_gid`, dont plus aucun code ne se sert. Son empty
 * state ne relève donc plus d'un mapping manquant mais d'un module à refaire —
 * c'est ce que dit sa page. Support exige la team Linear du client et son
 * projet « Support » evergreen : sans eux, ni le formulaire ni la messagerie
 * n'ont où créer leurs tickets (COO-30).
 */
export const MODULE_REQUIREMENTS: Record<PortalModule, readonly WorkspaceMappingKey[]> = {
  projets: [],
  support: ["linearTeamId", "linearSupportProjectId"],
  site: ["uptimerobot_monitor_ids"],
  doc: ["doc"],
};

/**
 * Ordre du sélecteur de workspace : les persos d'abord (Coolbeans en tête —
 * c'est le défaut — puis les autres par nom), ensuite les clients par date
 * `depuis` croissante ; un client sans date part en fin de liste, par nom.
 */
export function sortWorkspaces(clients: PortalWorkspace[]): PortalWorkspace[] {
  return [...clients].sort((a, b) => {
    if (Boolean(a.perso) !== Boolean(b.perso)) return a.perso ? -1 : 1;
    if (a.perso) {
      if (a.slug === DEFAULT_WORKSPACE) return -1;
      if (b.slug === DEFAULT_WORKSPACE) return 1;
      return a.nom.localeCompare(b.nom, "fr");
    }
    if (a.depuis !== b.depuis) {
      if (!a.depuis) return 1;
      if (!b.depuis) return -1;
      return a.depuis.localeCompare(b.depuis);
    }
    return a.nom.localeCompare(b.nom, "fr");
  });
}

/**
 * Les clients à proposer dans le sélecteur : les actifs, plus le client courant
 * s'il est archivé. Sans cette exception, le `<select>` afficherait sa première
 * option alors qu'on se trouve ailleurs — l'écran mentirait sur son contexte.
 */
export function selectableWorkspaces(
  clients: PortalWorkspace[],
  current: PortalWorkspace | null,
): PortalWorkspace[] {
  return sortWorkspaces(clients.filter((c) => !c.archive || c.slug === current?.slug));
}

export function getWorkspaceIn(
  clients: PortalWorkspace[],
  slug: string | null | undefined,
): PortalWorkspace | null {
  if (!slug) return null;
  return clients.find((c) => c.slug === slug) ?? null;
}

export function findWorkspaceByDocIn(clients: PortalWorkspace[], docSlug: string): PortalWorkspace | null {
  return clients.find((c) => c.doc === docSlug) ?? null;
}

function hasMapping(client: PortalWorkspace, key: WorkspaceMappingKey): boolean {
  switch (key) {
    case "doc":
      return Boolean(client.doc);
    case "linearTeamId":
      return Boolean(client.linearTeamId);
    case "linearSupportProjectId":
      return Boolean(client.linearSupportProjectId);
    case "uptimerobot_monitor_ids":
      return client.uptimerobot_monitor_ids.length > 0;
  }
}

/**
 * Clés manquantes pour ce module. Tableau vide = le module peut s'afficher.
 * Sans client du tout, tout est réputé manquant plutôt que de lever.
 */
export function missingKeysFor(
  module: PortalModule,
  client: PortalWorkspace | null,
): WorkspaceMappingKey[] {
  const required = MODULE_REQUIREMENTS[module];
  if (!client) return [...required];
  return required.filter((key) => !hasMapping(client, key));
}

/* ---- Accès à la collection ------------------------------------------- */

export async function listWorkspaces(): Promise<PortalWorkspace[]> {
  const { getCollection } = await import("astro:content");
  const entries = await getCollection("clients");
  return sortWorkspaces(entries.map((e) => ({ slug: e.id, ...e.data })));
}

export async function getWorkspace(slug: string | null | undefined): Promise<PortalWorkspace | null> {
  return getWorkspaceIn(await listWorkspaces(), slug);
}

export async function findWorkspaceByDoc(docSlug: string): Promise<PortalWorkspace | null> {
  return findWorkspaceByDocIn(await listWorkspaces(), docSlug);
}
