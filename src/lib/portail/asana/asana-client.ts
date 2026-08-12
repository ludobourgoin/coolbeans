// Accès HTTP à l'API Asana. `fetch` et `sleep` sont injectés : c'est ce qui
// rend la pagination et le backoff testables sans réseau.
//
// Une seule requête par projet (corrections §2), pas une par section : le brief
// d'origine en faisait cinq, soit plusieurs centaines par passage à vingt
// clients, pour un résultat identique. Le filtrage des tâches multi-homées se
// fait ensuite en mémoire sur `memberships`.

import type { AsanaProject, AsanaTask } from "./types";

const BASE = "https://app.asana.com/api/1.0";

export const PROJECT_FIELDS = "name,notes,due_on,completed,archived";

/**
 * `assignee` sert de FILTRE (§6 : assigné + deadline obligatoires) et n'entre
 * jamais dans le snapshot — le brief §5 interdit d'y exposer les assignees.
 */
export const TASK_FIELDS =
  "name,due_on,completed,assignee,memberships.project.gid,memberships.section.name";

export interface AsanaClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Retentatives sur 429. Défaut 3. */
  maxRetries?: number;
  /** Garde-fou anti-boucle sur la pagination. Défaut 20, soit 2 000 éléments. */
  maxPages?: number;
}

export interface AsanaClient {
  listProjects(teamGid: string): Promise<AsanaProject[]>;
  listTasks(projectGid: string): Promise<AsanaTask[]>;
  /** Requêtes réellement émises, retentatives comprises. Alimente meta:last_sync. */
  readonly stats: { requests: number };
}

interface Page<T> {
  data?: T[];
  next_page?: { offset?: string } | null;
}

const attenteParDefaut = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createAsanaClient(options: AsanaClientOptions): AsanaClient {
  const {
    token,
    fetchImpl = fetch,
    sleep = attenteParDefaut,
    maxRetries = 3,
    maxPages = 20,
  } = options;

  const stats = { requests: 0 };

  async function requete(url: string): Promise<Response> {
    for (let essai = 0; ; essai++) {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      stats.requests += 1;

      if (res.status !== 429) return res;
      if (essai >= maxRetries) return res;

      // Un 429 consomme du quota : retenter sans respecter Retry-After
      // aggrave la situation au lieu de la résoudre. Sans en-tête exploitable,
      // backoff exponentiel — jamais de retentative immédiate.
      const entete = Number(res.headers.get("Retry-After"));
      const ms = Number.isFinite(entete) && entete > 0 ? entete * 1000 : 2 ** essai * 1000;
      await sleep(ms);
    }
  }

  async function getAll<T>(chemin: string, params: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let offset: string | undefined;
    let page = 0;

    do {
      if (page >= maxPages) {
        throw new Error(`Asana : pagination anormalement longue sur ${chemin} (${maxPages} pages)`);
      }
      const url = new URL(BASE + chemin);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      url.searchParams.set("limit", "100");
      if (offset) url.searchParams.set("offset", offset);

      const res = await requete(url.toString());
      if (!res.ok) {
        // Le corps peut contenir des détails, mais aussi être vide ou du HTML :
        // on ne met que le statut dans le message, jamais le token ni l'URL
        // complète (elle est sans secret, mais autant garder les logs sobres).
        throw new Error(`Asana ${res.status} sur ${chemin}`);
      }

      const body = (await res.json()) as Page<T>;
      out.push(...(body.data ?? []));
      offset = body.next_page?.offset;
      page += 1;
    } while (offset);

    return out;
  }

  return {
    stats,
    listProjects: (teamGid) =>
      getAll<AsanaProject>(`/teams/${teamGid}/projects`, { opt_fields: PROJECT_FIELDS }),
    listTasks: (projectGid) =>
      getAll<AsanaTask>("/tasks", { project: projectGid, opt_fields: TASK_FIELDS }),
  };
}
