/* Les projets Linear d'une sous-team, pour le portail (spec 2026-09-30, barre
 * par workspace, §4). Chaque workspace naît avec sa sous-team ; la barre et la
 * page d'un projet affichent ses projets.
 *
 * Lecture en liste blanche. Le résumé d'un projet est le champ GraphQL
 * `description`. Le texte long, `content`, porte le brief interne et les liens
 * du CRM : il ne se demande jamais.
 *
 * Linear est lu au plus une fois toutes les 10 minutes par sous-team, dans le
 * cache du Worker. Le KV est écarté : son quota gratuit de 1 000 écritures par
 * jour tomberait dès sept workspaces consultés en continu.
 */
import { graphql } from "./linear-graphql";

export type TypeStatut = "backlog" | "planned" | "started" | "paused" | "completed" | "canceled";

export interface StatutLinear {
  nom: string;
  type: TypeStatut;
}

export interface ProjetLinear {
  /** Les douze caractères qui terminent l'adresse Linear du projet. */
  slugId: string;
  /** Le dernier segment de l'adresse Linear : le nom en minuscules, puis le slugId. */
  segment: string;
  nom: string;
  /** Le résumé, écrit pour le client. Vide : rien à afficher. */
  resume: string;
  statut: StatutLinear;
  /** AAAA-MM-JJ */
  debut: string | null;
  fin: string | null;
  /** ISO 8601 */
  misAJour: string;
}

interface NoeudProjet {
  slugId: string;
  url: string;
  name: string;
  description: string;
  startDate: string | null;
  targetDate: string | null;
  updatedAt: string;
  status: { name: string; type: string };
}

export const REQUETE_PROJETS = `query ProjetsDeLaTeam($id: String!) {
  team(id: $id) {
    projects(first: 100) {
      nodes { slugId url name description startDate targetDate updatedAt status { name type } }
    }
  }
}`;

/** Les noeuds de l'API, sans les projets annulés, sous la forme du portail. */
export function normaliserProjets(noeuds: NoeudProjet[]): ProjetLinear[] {
  return noeuds
    .filter((n) => n.status.type !== "canceled")
    .map((n) => ({
      slugId: n.slugId,
      segment: n.url.split("/").pop() || n.slugId,
      nom: n.name,
      resume: n.description.trim(),
      statut: { nom: n.status.name, type: n.status.type as TypeStatut },
      debut: n.startDate,
      fin: n.targetDate,
      misAJour: n.updatedAt,
    }));
}

const GROUPE: Record<TypeStatut, number> = {
  started: 0,
  paused: 0,
  planned: 1,
  backlog: 1,
  completed: 2,
  canceled: 3,
};

/** En cours, puis à venir, puis terminés. Le plus récemment modifié en tête de chaque groupe. */
export function trierProjets(projets: ProjetLinear[]): ProjetLinear[] {
  return [...projets].sort(
    (a, b) => (GROUPE[a.statut.type] ?? 3) - (GROUPE[b.statut.type] ?? 3) || b.misAJour.localeCompare(a.misAJour),
  );
}

export async function lireProjetsLinear(apiKey: string, teamId: string, signal?: AbortSignal): Promise<ProjetLinear[]> {
  const data = await graphql<{ team: { projects: { nodes: NoeudProjet[] } } | null }>(
    apiKey,
    REQUETE_PROJETS,
    { id: teamId },
    signal,
  );
  if (!data.team) throw new Error(`Linear : team ${teamId} introuvable`);
  return trierProjets(normaliserProjets(data.team.projects.nodes));
}

/* ---- Ce que lit le client ------------------------------------------------ */

const LIBELLE_PAR_NOM: Record<string, string> = {
  Proposal: "Proposition",
  Backlog: "À venir",
  Planned: "Planifié",
  "In Progress": "En cours",
  Paused: "En pause",
  Completed: "Terminé",
};

const LIBELLE_PAR_TYPE: Record<TypeStatut, string> = {
  backlog: "À venir",
  planned: "Planifié",
  started: "En cours",
  paused: "En pause",
  completed: "Terminé",
  canceled: "Annulé",
};

export function libelleStatut(s: StatutLinear): string {
  return LIBELLE_PAR_NOM[s.nom] ?? LIBELLE_PAR_TYPE[s.type] ?? s.nom;
}

/** Un projet validé a quitté Proposal et Backlog : ses dates s'affichent. */
export function estValide(s: StatutLinear): boolean {
  return s.type === "planned" || s.type === "started" || s.type === "paused" || s.type === "completed";
}

/* ---- Cache --------------------------------------------------------------- */

export type EntreeCache = { ok: true; projets: ProjetLinear[] } | { ok: false };

export interface CacheProjets {
  lire(cle: string): Promise<EntreeCache | undefined>;
  ecrire(cle: string, entree: EntreeCache, secondes: number): Promise<void>;
}

export const DUREE_SUCCES = 600;
export const DUREE_ECHEC = 60;
export const DELAI_MS = 2000;

/**
 * Les projets de la sous-team. `null` : Linear n'a pas répondu, l'appelant se
 * replie sur les documents. Ne lève jamais : une page ne casse pas à cause de
 * Linear. L'échec se garde 60 secondes, pour qu'une panne ne ralentisse pas
 * chaque page.
 */
export async function projetsDeLaTeam(
  teamId: string,
  options: { apiKey?: string; cache: CacheProjets; lire?: typeof lireProjetsLinear },
): Promise<ProjetLinear[] | null> {
  const { apiKey, cache, lire = lireProjetsLinear } = options;
  if (!apiKey) return null;
  const cle = `v1:linear-projets:${teamId}`;
  const connu = await cache.lire(cle).catch(() => undefined);
  if (connu) return connu.ok ? connu.projets : null;

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);
  // La course garantit l'abandon même si l'appel ignore le signal.
  const delai = new Promise<never>((_, rejeter) => {
    controleur.signal.addEventListener("abort", () => rejeter(new Error("Linear : délai dépassé")));
  });
  try {
    const projets = await Promise.race([lire(apiKey, teamId, controleur.signal), delai]);
    await cache.ecrire(cle, { ok: true, projets }, DUREE_SUCCES).catch(() => {});
    return projets;
  } catch {
    await cache.ecrire(cle, { ok: false }, DUREE_ECHEC).catch(() => {});
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

const ORIGINE_CACHE = "https://cache.coolbeans.internal/";

/** Le cache du Worker. Absent (Vitest, Node) : un cache qui ne garde rien. */
export function cacheWorker(): CacheProjets {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return { lire: async () => undefined, ecrire: async () => {} };
  const adresse = (cle: string) => ORIGINE_CACHE + encodeURIComponent(cle);
  return {
    async lire(cle) {
      const reponse = await cache.match(adresse(cle));
      return reponse ? ((await reponse.json()) as EntreeCache) : undefined;
    },
    async ecrire(cle, entree, secondes) {
      await cache.put(
        adresse(cle),
        new Response(JSON.stringify(entree), {
          headers: { "content-type": "application/json", "cache-control": `max-age=${secondes}` },
        }),
      );
    },
  };
}
