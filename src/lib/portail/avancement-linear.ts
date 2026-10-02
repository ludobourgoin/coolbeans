/* L'avancement d'un projet Linear, pour la page projet du portail : ses issues
 * rangées par jalon, avec leur état et leur échéance. Décision de Ludo du
 * 2026-10-01 : le client voit toutes les issues du projet, sauf les annulées et
 * celles en Triage, pas encore qualifiées.
 *
 * Lecture en liste blanche, comme pour les projets : titre, état, échéance,
 * jalon, et l'estimate, qui ne s'affiche que sur un pack d'heures. Jamais la
 * description, les commentaires ni l'assigné. Les titres sont écrits pour être
 * lus par le client, c'est une règle de la skill linear.
 *
 * Un pack d'heures (décision du 2026-10-02) se lit autrement : ses issues sont
 * les demandes du client, chiffrées en heures. Celles à chiffrer et celles non
 * retenues restent visibles, et la jauge compte les heures restantes.
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
  /** En heures sur un pack (échelle Fibonacci de Linear). */
  estimate: number | null;
  state: { type: string; name: string };
  projectMilestone: { id: string } | null;
}

/** Ce que le cache garde d'un projet : ses jalons et ses issues, bruts. */
export interface DetailProjet {
  jalons: NoeudJalon[];
  issues: NoeudIssue[];
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
    issues(first: 150) { nodes { title dueDate sortOrder estimate state { type name } projectMilestone { id } } }
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


/* ---- Pack d'heures ------------------------------------------------------ */

export type StatutDemande = "a-chiffrer" | "chiffree" | "acceptee" | "en-cours" | "faite" | "non-retenue";

/** Le statut Linear qui porte une demande chiffrée, en attente du go du client. */
export const ETAT_CHIFFREE = "Chiffrée";

export function statutDemande(etat: { type: string; name: string }): StatutDemande {
  if (etat.name === ETAT_CHIFFREE) return "chiffree";
  switch (etat.type) {
    case "unstarted":
      return "acceptee";
    case "started":
      return "en-cours";
    case "completed":
      return "faite";
    case "canceled":
    case "duplicate":
      return "non-retenue";
    default:
      return "a-chiffrer";
  }
}

const LIBELLES_DEMANDE: Record<StatutDemande, string> = {
  "a-chiffrer": "À chiffrer",
  chiffree: "Chiffrée, attend ton accord",
  acceptee: "Acceptée",
  "en-cours": "En cours",
  faite: "Faite",
  "non-retenue": "Non retenue",
};

export const libelleDemande = (statut: StatutDemande): string => LIBELLES_DEMANDE[statut];

/** Les heures sortent du pack au go du client : acceptée, en cours ou faite. */
const ENGAGEES: readonly StatutDemande[] = ["acceptee", "en-cours", "faite"];
/** Se replient sous la liste : ce qui est clos. */
const CLOSES: readonly StatutDemande[] = ["faite", "non-retenue"];

export interface DemandePack {
  titre: string;
  statut: StatutDemande;
  heures: number | null;
  echeance: string | null;
}

export interface HeuresPack {
  /** Heures commandées. `null` : la proposition n'est pas encore validée. */
  total: number | null;
  engagees: number;
  /** Peut passer sous zéro : un dépassement se montre, il ne se cache pas. */
  restantes: number | null;
  /** Les ouvertes d'abord, dans l'ordre de Linear, puis les faites, puis les non retenues. */
  demandes: DemandePack[];
}

export function construireHeures(noeuds: NoeudIssue[], total: number | null): HeuresPack {
  const lues = noeuds
    .filter((n) => n.state.type !== "duplicate")
    .map((n) => ({ n, statut: statutDemande(n.state) }));
  const engagees = lues
    .filter((l) => ENGAGEES.includes(l.statut))
    .reduce((somme, l) => somme + (l.n.estimate ?? 0), 0);
  const demandes = lues
    .sort(
      (a, b) =>
        Number(CLOSES.includes(a.statut)) - Number(CLOSES.includes(b.statut)) ||
        Number(a.statut === "non-retenue") - Number(b.statut === "non-retenue") ||
        a.n.sortOrder - b.n.sortOrder,
    )
    .map(({ n, statut }): DemandePack => ({ titre: n.title, statut, heures: n.estimate, echeance: n.dueDate }));
  return { total, engagees, restantes: total === null ? null : total - engagees, demandes };
}

/* ---- Lecture ------------------------------------------------------------- */

export async function lireDetail(apiKey: string, slugId: string, signal?: AbortSignal): Promise<DetailProjet> {
  const data = await graphql<{
    project: { projectMilestones: { nodes: NoeudJalon[] }; issues: { nodes: NoeudIssue[] } } | null;
  }>(apiKey, REQUETE_AVANCEMENT, { id: slugId }, signal);
  if (!data.project) throw new Error(`Linear : projet ${slugId} introuvable`);
  return { jalons: data.project.projectMilestones.nodes, issues: data.project.issues.nodes };
}

/**
 * Les jalons et les issues du projet, bruts, en cache 10 minutes : la page en
 * tire l'avancement ou les heures d'un pack. `null` : Linear n'a pas répondu.
 */
export function detailDuProjet(
  slugId: string,
  options: { apiKey?: string; cache: CacheLinear<DetailProjet>; lire?: typeof lireDetail },
): Promise<DetailProjet | null> {
  const lire = options.lire ?? lireDetail;
  return lectureEnCache(`v2:linear-detail:${slugId}`, {
    apiKey: options.apiKey,
    cache: options.cache,
    lire: (apiKey, signal) => lire(apiKey, slugId, signal),
  });
}
