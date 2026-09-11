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
  };
}

const REQUETE = `
  query Livraisons {
    projects(first: 250) {
      nodes {
        id
        name
        url
        status { type }
        teams(first: 1) { nodes { key } }
        projectMilestones(first: 50) {
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
  const data = await graphql<{ projects: { nodes: ProjetLinear[] } }>(apiKey, REQUETE, {});
  return livraisonsDepuisProjets(data.projects.nodes);
}
