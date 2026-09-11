// Lecture seule des milestones Linear datees, projetees en livraisons.
//
// Aucune mutation : ce module ne fait que lire. Le filtre "milestone sans
// date cible" n'est pas arbitraire, il traduit la regle "pas de date tant que
// l'acompte n'est pas encaisse" : une affaire non signee ne porte donc aucun
// evenement, sans que ce code connaisse la notion de signature.
//
// La requete interroge la racine `projectMilestones` et non `projects`.
// La forme par projets (projects -> projectMilestones imbriquee, chacune
// paginee a 250) depasse le plafond de complexite de l'API Linear et se
// fait refuser en production. La racine `projectMilestones` porte son
// projet en relation directe, tient en une seule page et suffit aux besoins
// du module.

import { graphql } from "../portail/linear-graphql";
import { etiquetteMilestone } from "./etiquette";

export interface Livraison {
  milestoneId: string;
  cleTeam: string;
  etiquette: string;
  date: string;
  projetNom: string;
  projetUrl: string;
}

export interface ProjetDeMilestone {
  id: string;
  name: string;
  url: string;
  status: { type: string } | null;
  teams: { nodes: Array<{ key: string }> };
}

export interface MilestoneLinear {
  id: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  project: ProjetDeMilestone | null;
}

// Le parametre `includeArchived: true` est ajoute par precaution. La spec
// veut qu'une milestone terminee garde son evenement : "Une milestone
// terminee garde son evenement. Le calendrier est une trace des echeances,
// il ne reecrit pas le passe." Aucune donnee actuellement disponible ne
// permet de verifier le comportement de Linear si un projet archive porte
// une milestone : le workspace ne compte que des projets archives gabarit
// (vides), sans milestone. Le parametre couvre ce cas non teste.
const REQUETE = `
  query Livraisons {
    projectMilestones(first: 250, includeArchived: true) {
      pageInfo { hasNextPage }
      nodes {
        id
        name
        description
        targetDate
        project {
          id
          name
          url
          status { type }
          teams(first: 1) { nodes { key } }
        }
      }
    }
  }
`;

export function livraisonsDepuisMilestones(milestones: MilestoneLinear[]): Livraison[] {
  const livraisons: Livraison[] = [];
  for (const milestone of milestones) {
    if (!milestone.targetDate) continue;

    const projet = milestone.project;
    if (!projet) continue;
    if (projet.status?.type === "canceled") continue;
    const cleTeam = projet.teams.nodes[0]?.key;
    if (!cleTeam) continue;
    // Gabarit du modele client : jamais un engagement reel.
    if (cleTeam === "MOD" && projet.name === "Test") continue;

    livraisons.push({
      milestoneId: milestone.id,
      cleTeam,
      etiquette: etiquetteMilestone({
        nom: milestone.name,
        description: milestone.description,
      }),
      date: milestone.targetDate,
      projetNom: projet.name,
      projetUrl: projet.url,
    });
  }
  return livraisons;
}

export async function lireLivraisons(apiKey: string): Promise<Livraison[]> {
  const data = await graphql<{ projectMilestones: { pageInfo: { hasNextPage: boolean }; nodes: MilestoneLinear[] } }>(
    apiKey,
    REQUETE,
    {},
  );
  // Sans ce garde-fou, une milestone au-dela de la page ne serait pas
  // "perdue" mais supprimee a la synchronisation suivante : mieux vaut
  // arreter la synchronisation en le journalisant que d'effacer ce que le
  // code n'a pas vu.
  if (data.projectMilestones.pageInfo.hasNextPage) {
    throw new Error("Livraisons : plus de 250 milestones Linear, pagination requise");
  }
  return livraisonsDepuisMilestones(data.projectMilestones.nodes);
}
