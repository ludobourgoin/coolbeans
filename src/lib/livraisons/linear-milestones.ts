// Lecture seule des milestones Linear datees, projetees en livraisons.
//
// Aucune mutation : ce module ne fait que lire. Le filtre "milestone sans
// date cible" n'est pas arbitraire, il traduit la regle "pas de date tant que
// l'acompte n'est pas encaisse" : une affaire non signee ne porte donc aucun
// evenement, sans que ce code connaisse la notion de signature.

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

export interface ProjetLinear {
  id: string;
  name: string;
  url: string;
  status: { type: string } | null;
  teams: { nodes: Array<{ key: string }> };
  projectMilestones: {
    nodes: Array<{ id: string; name: string; description: string | null; targetDate: string | null }>;
    pageInfo: { hasNextPage: boolean };
  };
}

// `includeArchived: true` sur `projects` : un projet archive garde ses
// evenements passes (spec, section "Cycle complet"). Sans ce drapeau, les
// connexions Linear excluent les archives par defaut et un projet termine
// perdrait ses milestones datees a l'heure suivante.
const REQUETE = `
  query Livraisons {
    projects(first: 250, includeArchived: true) {
      pageInfo { hasNextPage }
      nodes {
        id
        name
        url
        status { type }
        teams(first: 1) { nodes { key } }
        projectMilestones(first: 250) {
          pageInfo { hasNextPage }
          nodes { id name description targetDate }
        }
      }
    }
  }
`;

export function livraisonsDepuisProjets(projets: ProjetLinear[]): Livraison[] {
  const livraisons: Livraison[] = [];
  for (const projet of projets) {
    if (projet.status?.type === "canceled") continue;
    const cleTeam = projet.teams.nodes[0]?.key;
    if (!cleTeam) continue;
    // Gabarit du modele client : jamais un engagement reel.
    if (cleTeam === "MOD" && projet.name === "Test") continue;

    for (const milestone of projet.projectMilestones.nodes) {
      if (!milestone.targetDate) continue;
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
  }
  return livraisons;
}

export async function lireLivraisons(apiKey: string): Promise<Livraison[]> {
  const data = await graphql<{ projects: { pageInfo: { hasNextPage: boolean }; nodes: ProjetLinear[] } }>(
    apiKey,
    REQUETE,
    {},
  );
  // Sans pagination, un projet ou une milestone au-dela de la page ne serait
  // pas "perdu" mais supprime a la synchronisation suivante : mieux vaut
  // arreter la synchronisation en le journalisant que d'effacer ce que le
  // code n'a pas vu.
  if (data.projects.pageInfo.hasNextPage) {
    throw new Error("Livraisons : plus de 250 projets Linear, pagination requise");
  }
  for (const projet of data.projects.nodes) {
    if (projet.projectMilestones.pageInfo.hasNextPage) {
      throw new Error(`Livraisons : plus de 250 milestones pour le projet ${projet.name}, pagination requise`);
    }
  }
  return livraisonsDepuisProjets(data.projects.nodes);
}
