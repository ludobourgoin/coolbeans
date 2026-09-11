import { describe, expect, it } from "vitest";
import { livraisonsDepuisProjets, type ProjetLinear } from "./linear-milestones";

const projet = (
  nom: string,
  cleTeam: string,
  typeStatut: string,
  milestones: Array<{ id: string; name: string; targetDate: string | null }>,
): ProjetLinear => ({
  id: `p-${nom}`,
  name: nom,
  url: `https://linear.app/coolbeans-hq/project/${nom}`,
  status: { type: typeStatut },
  teams: { nodes: [{ key: cleTeam }] },
  projectMilestones: {
    nodes: milestones.map((m) => ({ ...m, description: null })),
    pageInfo: { hasNextPage: false },
  },
});

describe("livraisonsDepuisProjets", () => {
  it("projette une milestone datee", () => {
    const r = livraisonsDepuisProjets([
      projet("Site vitrine LittleBox", "LIT", "started", [
        { id: "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80", name: "Intégration conforme à la maquette", targetDate: "2026-09-12" },
      ]),
    ]);
    expect(r).toEqual([
      {
        milestoneId: "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80",
        cleTeam: "LIT",
        etiquette: "Intégration",
        date: "2026-09-12",
        projetNom: "Site vitrine LittleBox",
        projetUrl: "https://linear.app/coolbeans-hq/project/Site vitrine LittleBox",
      },
    ]);
  });

  it("ecarte une milestone sans date cible", () => {
    const r = livraisonsDepuisProjets([
      projet("Site web CAFA", "CAF", "backlog", [{ id: "a", name: "Livraison V1", targetDate: null }]),
    ]);
    expect(r).toEqual([]);
  });

  it("ecarte un projet annule", () => {
    const r = livraisonsDepuisProjets([
      projet("Refonte du site En Haut", "ENH", "canceled", [{ id: "b", name: "Livraison V1", targetDate: "2026-10-01" }]),
    ]);
    expect(r).toEqual([]);
  });

  it("ecarte le gabarit Test de la team MOD", () => {
    const r = livraisonsDepuisProjets([
      projet("Test", "MOD", "backlog", [{ id: "c", name: "Livraison", targetDate: "2026-10-01" }]),
    ]);
    expect(r).toEqual([]);
  });

  it("garde un projet nomme Test dans une autre team", () => {
    const r = livraisonsDepuisProjets([
      projet("Test", "COO", "backlog", [{ id: "d", name: "Livraison", targetDate: "2026-10-01" }]),
    ]);
    expect(r).toHaveLength(1);
  });

  it("ecarte un projet sans team", () => {
    const sansTeam = { ...projet("Orphelin", "X", "started", [{ id: "e", name: "Livraison", targetDate: "2026-10-01" }]), teams: { nodes: [] } };
    expect(livraisonsDepuisProjets([sansTeam])).toEqual([]);
  });

  it("tolere un statut absent", () => {
    const sansStatut = { ...projet("Sans statut", "COO", "started", [{ id: "f", name: "Livraison", targetDate: "2026-10-01" }]), status: null };
    expect(livraisonsDepuisProjets([sansStatut])).toHaveLength(1);
  });
});
