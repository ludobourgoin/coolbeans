// Lecture et écriture des affaires du pipeline commercial (team CRM).
//
// Le cockpit /espace/devis affiche l'état de l'affaire Linear, et lui seul :
// le statut dérivé du document (publié / envoyé / répondu) a été retiré de la
// vue le 2026-09-01. Un devis dont le YAML ne porte pas de `linear.affaire`
// n'a donc plus de statut — c'est voulu, ça rend le rattachement oublié
// visible plutôt que de le masquer derrière un repli.

import { graphql } from "./linear-graphql";
// L'UUID de Ludo vit déjà dans linear.ts et n'a pas à être recopié : un même
// identifiant écrit à deux endroits finit toujours par diverger.
import { LUDO_LINEAR_USER_ID } from "./linear";

/** Clé de la team du pipeline commercial. */
export const TEAM_CRM = "CRM";

export interface EtatAffaire {
  /** UUID interne de l'issue, requis pour toute mutation. */
  issueId: string;
  /** Identifiant lisible, ex. « CRM-74 ». */
  identifier: string;
  numero: number;
  url: string;
  /** Nom de l'état, emoji compris : « 🏆 Signée ». */
  etat: string;
  /** Type Linear de l'état (backlog, started, completed…). */
  type: string;
  /** Position dans le pipeline — c'est elle qui ordonne, jamais le nom. */
  position: number;
}

/**
 * Numéro d'affaire porté par un champ `linear.affaire` de YAML de devis.
 *
 * Les deux formes cohabitent dans src/content/devis : l'identifiant court
 * (« CRM-9 », les premiers devis) et l'URL complète (« https://linear.app/
 * coolbeans-hq/issue/CRM-74 », ce qu'on colle depuis Linear aujourd'hui).
 * Aucune des deux n'est à corriger : la fonction accepte les deux.
 *
 * Rend null sur tout ce qui n'est pas une référence CRM lisible — champ
 * absent, texte libre, ou issue d'une autre team (un devis rattaché à AMU-3
 * serait une erreur de saisie, pas une affaire du pipeline).
 */
export function numeroAffaire(ref: string | undefined | null): number | null {
  if (typeof ref !== "string") return null;
  const m = ref.match(/\bCRM-(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * État courant des affaires demandées, en une seule requête.
 *
 * Les numéros absents de la Map rendue sont ceux dont l'issue n'existe plus
 * (supprimée, ou numéro saisi de travers) : la page affiche « — », comme pour
 * un devis sans affaire du tout.
 */
export async function fetchEtatsAffaires(
  apiKey: string,
  numeros: number[],
): Promise<Map<number, EtatAffaire>> {
  const map = new Map<number, EtatAffaire>();
  if (numeros.length === 0) return map;
  const data = await graphql<{
    issues: {
      nodes: Array<{
        id: string;
        identifier: string;
        number: number;
        url: string;
        state: { name: string; type: string; position: number };
      }>;
    };
  }>(
    apiKey,
    // first: 250 — le pipeline commercial n'aura pas 250 devis publiés avant
    // longtemps. Au-delà il faudra paginer par curseur, comme le board de la
    // messagerie ; ce n'est pas géré ici.
    `query AffairesCrm($team: String!, $numeros: [Float!]!) {
      issues(
        filter: { team: { key: { eq: $team } }, number: { in: $numeros } }
        includeArchived: true
        first: 250
      ) {
        nodes { id identifier number url state { name type position } }
      }
    }`,
    { team: TEAM_CRM, numeros },
  );
  for (const n of data.issues.nodes) {
    map.set(n.number, {
      issueId: n.id,
      identifier: n.identifier,
      numero: n.number,
      url: n.url,
      etat: n.state.name,
      type: n.state.type,
      position: n.state.position,
    });
  }
  return map;
}

export interface EtatCrm {
  id: string;
  name: string;
  type: string;
  position: number;
}

/**
 * Les états de la team CRM, et l'UUID de la team.
 *
 * Mémorisé à l'échelle de l'isolate : un pipeline ne change pas entre deux
 * requêtes, et la validation d'un devis en a besoin deux fois (l'état
 * « Signée » et l'état « Todo » de la sous-tâche).
 *
 * Résolu à chaud plutôt que codé en dur, contrairement au label Support de
 * linear.ts : le pipeline commercial a déjà été refondu une fois (17 états
 * ramenés à 13, le 2026-08-29) et le sera encore. Un UUID en dur y survivrait
 * mal, et échouerait en silence.
 */
let cacheEtats: { teamId: string; etats: EtatCrm[] } | null = null;

export async function etatsCrm(apiKey: string): Promise<{ teamId: string; etats: EtatCrm[] }> {
  if (cacheEtats) return cacheEtats;
  const data = await graphql<{
    teams: {
      nodes: Array<{
        id: string;
        states: { nodes: Array<{ id: string; name: string; type: string; position: number }> };
      }>;
    };
  }>(
    apiKey,
    `query EtatsCrm($team: String!) {
      teams(filter: { key: { eq: $team } }, first: 1) {
        nodes { id states(first: 50) { nodes { id name type position } } }
      }
    }`,
    { team: TEAM_CRM },
  );
  const team = data.teams.nodes[0];
  if (!team) throw new Error(`Linear : team ${TEAM_CRM} introuvable.`);
  cacheEtats = { teamId: team.id, etats: team.states.nodes };
  return cacheEtats;
}

/** Vide le cache d'états — réservé aux tests. */
export function _resetCacheEtats(): void {
  cacheEtats = null;
}

/**
 * Retrouve un état par son nom, emoji et casse ignorés.
 *
 * Les états du pipeline sont préfixés d'un emoji (« 🏆 Signée », « 📝 Proposition
 * envoyée »). Comparer les noms bruts casserait au premier changement d'emoji,
 * qui est le genre de retouche qu'on fait sans y penser.
 */
export function trouverEtat(etats: EtatCrm[], nom: string): EtatCrm | undefined {
  const normaliser = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
      .trim()
      .toLowerCase();
  const cible = normaliser(nom);
  return etats.find((e) => normaliser(e.name) === cible);
}

/** Passe une affaire dans l'état nommé. Sans effet si l'état n'existe pas. */
export async function changerEtatAffaire(
  apiKey: string,
  issueId: string,
  nomEtat: string,
): Promise<boolean> {
  const { etats } = await etatsCrm(apiKey);
  const etat = trouverEtat(etats, nomEtat);
  if (!etat) return false;
  const data = await graphql<{ issueUpdate: { success: boolean } }>(
    apiKey,
    `mutation ChangerEtat($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }`,
    { id: issueId, stateId: etat.id },
  );
  return data.issueUpdate.success;
}

export interface TacheLinear {
  id: string;
  identifier: string;
  url: string;
}

/**
 * Sous-issue d'une affaire CRM.
 *
 * L'état est forcé à « Todo » : une issue créée par API sans stateId atterrit
 * dans l'état par défaut de la team, soit « 📥 Triage lead » ici — la boîte de
 * réception des leads entrants, où une tâche de facturation n'a rien à faire
 * (constat du 2026-08-29). Si l'état n'est pas trouvé, on laisse Linear
 * décider : une tâche mal rangée vaut mieux qu'une tâche non créée.
 */
export async function creerSousTache(options: {
  apiKey: string;
  parentId: string;
  title: string;
  description: string;
}): Promise<TacheLinear> {
  const { apiKey, parentId, title, description } = options;
  const { teamId, etats } = await etatsCrm(apiKey);
  const todo = trouverEtat(etats, "Todo");
  const data = await graphql<{
    issueCreate: {
      success: boolean;
      issue: { id: string; identifier: string; url: string } | null;
    };
  }>(
    apiKey,
    `mutation CreerSousTache($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id identifier url } }
    }`,
    {
      input: {
        teamId,
        parentId,
        title,
        description,
        assigneeId: LUDO_LINEAR_USER_ID,
        ...(todo ? { stateId: todo.id } : {}),
      },
    },
  );
  const issue = data.issueCreate.issue;
  if (!data.issueCreate.success || !issue) {
    throw new Error("Linear : issueCreate a échoué sans erreur GraphQL.");
  }
  return issue;
}
