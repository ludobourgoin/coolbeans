// Registre des clients du portail (spec 2026-08-12).
//
// Un client est l'unité à laquelle se rattachent une doc, une team Asana et des
// monitors. Avant ce registre, ces trois mappings vivaient sur chaque
// utilisateur Clerk : deux contacts d'un même client pouvaient diverger, et
// rien ne permettait d'énumérer les clients — donc pas de sélecteur possible.
//
// Les fonctions `*In` prennent la liste en argument : c'est ce qui les rend
// testables sans `astro:content`, indisponible sous Vitest.

export interface PortalClient {
  /** Nom du fichier YAML, sans extension. */
  slug: string;
  nom: string;
  /** Slug dans la collection `docs`. Absent = ce client n'a pas de doc. */
  doc?: string;
  /** UUID de la team Linear où le formulaire support crée ses tickets. */
  linearTeamId?: string;
  uptimerobot_monitor_ids: string[];
  /**
   * Sort le client du sélecteur sans rien supprimer : sa fiche, sa doc et ses
   * instantanés KV restent, et il reste résoluble par son slug. Archiver n'est
   * pas supprimer — c'est ce qui permet de garder un ancien client accessible
   * sans allonger la liste indéfiniment.
   */
  archive: boolean;
}

/** Client affiché par défaut à l'admin, et tête de liste du sélecteur. */
export const DEFAULT_CLIENT = "coolbeans";

/** Modules dont l'affichage dépend d'un mapping du client. */
export type PortalModule = "projets" | "site" | "doc" | "support";

/** Clés de mapping d'un client, telles que nommées dans le YAML. */
export type ClientMappingKey = "doc" | "linearTeamId" | "uptimerobot_monitor_ids";

/**
 * Mapping sans lequel un module ne peut rien afficher.
 * Ressources n'y figure pas : son contenu est commun à tous les clients.
 *
 * Projets ne réclame plus rien depuis le retrait du sync Asana : il ne
 * dépendait que d'`asana_team_gid`, dont plus aucun code ne se sert. Son empty
 * state ne relève donc plus d'un mapping manquant mais d'un module à refaire —
 * c'est ce que dit sa page. Support exige la team Linear du client : sans elle,
 * le formulaire n'a nulle part où créer ses tickets (COO-30).
 */
export const MODULE_REQUIREMENTS: Record<PortalModule, readonly ClientMappingKey[]> = {
  projets: [],
  support: ["linearTeamId"],
  site: ["uptimerobot_monitor_ids"],
  doc: ["doc"],
};

/** Coolbeans en tête — c'est le défaut — puis les autres par nom. */
export function sortClients(clients: PortalClient[]): PortalClient[] {
  return [...clients].sort((a, b) => {
    if (a.slug === DEFAULT_CLIENT) return -1;
    if (b.slug === DEFAULT_CLIENT) return 1;
    return a.nom.localeCompare(b.nom, "fr");
  });
}

/**
 * Les clients à proposer dans le sélecteur : les actifs, plus le client courant
 * s'il est archivé. Sans cette exception, le `<select>` afficherait sa première
 * option alors qu'on se trouve ailleurs — l'écran mentirait sur son contexte.
 */
export function selectableClients(
  clients: PortalClient[],
  current: PortalClient | null,
): PortalClient[] {
  return sortClients(clients.filter((c) => !c.archive || c.slug === current?.slug));
}

export function getClientIn(
  clients: PortalClient[],
  slug: string | null | undefined,
): PortalClient | null {
  if (!slug) return null;
  return clients.find((c) => c.slug === slug) ?? null;
}

export function findClientByDocIn(clients: PortalClient[], docSlug: string): PortalClient | null {
  return clients.find((c) => c.doc === docSlug) ?? null;
}

function hasMapping(client: PortalClient, key: ClientMappingKey): boolean {
  switch (key) {
    case "doc":
      return Boolean(client.doc);
    case "linearTeamId":
      return Boolean(client.linearTeamId);
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
  client: PortalClient | null,
): ClientMappingKey[] {
  const required = MODULE_REQUIREMENTS[module];
  if (!client) return [...required];
  return required.filter((key) => !hasMapping(client, key));
}

/* ---- Accès à la collection ------------------------------------------- */

export async function listClients(): Promise<PortalClient[]> {
  const { getCollection } = await import("astro:content");
  const entries = await getCollection("clients");
  return sortClients(entries.map((e) => ({ slug: e.id, ...e.data })));
}

export async function getClient(slug: string | null | undefined): Promise<PortalClient | null> {
  return getClientIn(await listClients(), slug);
}

export async function findClientByDoc(docSlug: string): Promise<PortalClient | null> {
  return findClientByDocIn(await listClients(), docSlug);
}
