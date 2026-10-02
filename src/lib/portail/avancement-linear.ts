/* L'avancement d'un projet Linear, pour la page projet du portail : ses issues
 * rangées par jalon, avec leur état et leur échéance. Décision de Ludo du
 * 2026-10-01 : le client voit toutes les issues du projet, sauf les annulées et
 * celles en Triage, pas encore qualifiées.
 *
 * Lecture en liste blanche, comme pour les projets : titre, type d'état,
 * échéance et jalon. Jamais la description, les commentaires, l'assigné ni
 * l'estimate. Les titres sont écrits pour être lus par le client, c'est une
 * règle de la skill linear.
 */
import { graphql } from "./linear-graphql";
import { lectureEnCache, type CacheLinear } from "./projets-linear";

export type TypeEtat = "backlog" | "unstarted" | "started" | "completed";

export interface NoeudJalon {
  id: string;
  name: string;
  targetDate: string | null;
  sortOrder: number;
}

export interface NoeudIssue {
  title: string;
  dueDate: string | null;
  /** L'ordre manuel de la vue Linear. */
  sortOrder: number;
  state: { type: string };
  projectMilestone: { id: string } | null;
}

export interface IssueAvancement {
  titre: string;
  etat: TypeEtat;
  /** AAAA-MM-JJ */
  echeance: string | null;
}

export interface GroupeAvancement {
  /** `null` : les issues sans jalon. */
  jalon: { nom: string; date: string | null } | null;
  issues: IssueAvancement[];
}

export interface Avancement {
  faites: number;
  total: number;
  groupes: GroupeAvancement[];
}

export const REQUETE_AVANCEMENT = `query AvancementDuProjet($id: String!) {
  project(id: $id) {
    projectMilestones(first: 50) { nodes { id name targetDate sortOrder } }
    issues(first: 150) { nodes { title dueDate sortOrder state { type } projectMilestone { id } } }
  }
}`;

const VISIBLES: readonly string[] = ["backlog", "unstarted", "started", "completed"];

/** L'ordre manuel de Linear, les faites en dernier (décision de Ludo du 2026-10-02). */
const ordreIssues = (a: { etat: TypeEtat; ordre: number }, b: { etat: TypeEtat; ordre: number }) =>
  Number(a.etat === "completed") - Number(b.etat === "completed") || a.ordre - b.ordre;

/** Les jalons datés d'abord, dans l'ordre des dates, puis l'ordre de Linear. */
const ordreJalons = (a: NoeudJalon, b: NoeudJalon) =>
  (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || a.sortOrder - b.sortOrder;

export function construireAvancement(jalons: NoeudJalon[], noeuds: NoeudIssue[]): Avancement {
  const visibles = noeuds.filter((n) => VISIBLES.includes(n.state.type));
  type IssueTriable = IssueAvancement & { ordre: number };
  const versIssue = (n: NoeudIssue): IssueTriable => ({
    titre: n.title,
    etat: n.state.type as TypeEtat,
    echeance: n.dueDate,
    ordre: n.sortOrder,
  });

  const groupes: Array<{ jalon: GroupeAvancement["jalon"]; issues: IssueTriable[] }> = [...jalons]
    .sort(ordreJalons)
    .map((j) => ({
    jalon: { nom: j.name, date: j.targetDate },
    issues: visibles.filter((n) => n.projectMilestone?.id === j.id).map(versIssue),
  }));
  const connus = new Set(jalons.map((j) => j.id));
  groupes.push({
    jalon: null,
    issues: visibles.filter((n) => !n.projectMilestone || !connus.has(n.projectMilestone.id)).map(versIssue),
  });

  return {
    faites: visibles.filter((n) => n.state.type === "completed").length,
    total: visibles.length,
    groupes: groupes
      .filter((g) => g.issues.length > 0)
      .map((g) => ({
        ...g,
        issues: [...g.issues].sort(ordreIssues).map(({ ordre: _, ...i }): IssueAvancement => i),
      })),
  };
}

const LIBELLES: Record<TypeEtat, string> = {
  backlog: "À venir",
  unstarted: "À faire",
  started: "En cours",
  completed: "Fait",
};

export const libelleEtat = (etat: TypeEtat): string => LIBELLES[etat];

export async function lireAvancement(apiKey: string, slugId: string, signal?: AbortSignal): Promise<Avancement> {
  const data = await graphql<{
    project: { projectMilestones: { nodes: NoeudJalon[] }; issues: { nodes: NoeudIssue[] } } | null;
  }>(apiKey, REQUETE_AVANCEMENT, { id: slugId }, signal);
  if (!data.project) throw new Error(`Linear : projet ${slugId} introuvable`);
  return construireAvancement(data.project.projectMilestones.nodes, data.project.issues.nodes);
}

/** L'avancement du projet, en cache 10 minutes. `null` : Linear n'a pas répondu. */
export function avancementDuProjet(
  slugId: string,
  options: { apiKey?: string; cache: CacheLinear<Avancement>; lire?: typeof lireAvancement },
): Promise<Avancement | null> {
  const lire = options.lire ?? lireAvancement;
  return lectureEnCache(`v1:linear-avancement:${slugId}`, {
    apiKey: options.apiKey,
    cache: options.cache,
    lire: (apiKey, signal) => lire(apiKey, slugId, signal),
  });
}
