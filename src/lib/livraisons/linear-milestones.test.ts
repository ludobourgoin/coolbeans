import { describe, expect, it } from "vitest";
import { livraisonsDepuisMilestones, type MilestoneLinear, type ProjetDeMilestone } from "./linear-milestones";

const projet = (nom: string, cleTeam: string, typeStatut: string | null): ProjetDeMilestone => ({
  id: `p-${nom}`,
  name: nom,
  url: `https://linear.app/coolbeans-hq/project/${nom}`,
  status: typeStatut === null ? null : { type: typeStatut },
  teams: { nodes: cleTeam ? [{ key: cleTeam }] : [] },
});

const milestone = (
  id: string,
  name: string,
  targetDate: string | null,
  projetLie: ProjetDeMilestone | null,
): MilestoneLinear => ({
  id,
  name,
  description: null,
  targetDate,
  project: projetLie,
});

describe("livraisonsDepuisMilestones", () => {
  it("projette une milestone datee", () => {
    const r = livraisonsDepuisMilestones([
      milestone(
        "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80",
        "Intégration conforme à la maquette",
        "2026-09-12",
        projet("Site vitrine LittleBox", "LIT", "started"),
      ),
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
    const r = livraisonsDepuisMilestones([
      milestone("a", "Livraison V1", null, projet("Site web CAFA", "CAF", "backlog")),
    ]);
    expect(r).toEqual([]);
  });

  it("ecarte un projet annule", () => {
    const r = livraisonsDepuisMilestones([
      milestone("b", "Livraison V1", "2026-10-01", projet("Refonte du site En Haut", "ENH", "canceled")),
    ]);
    expect(r).toEqual([]);
  });

  it("ecarte le gabarit Test de la team MOD", () => {
    const r = livraisonsDepuisMilestones([
      milestone("c", "Livraison", "2026-10-01", projet("Test", "MOD", "backlog")),
    ]);
    expect(r).toEqual([]);
  });

  it("garde un projet nomme Test dans une autre team", () => {
    const r = livraisonsDepuisMilestones([
      milestone("d", "Livraison", "2026-10-01", projet("Test", "COO", "backlog")),
    ]);
    expect(r).toHaveLength(1);
  });

  it("ecarte un projet sans team", () => {
    const r = livraisonsDepuisMilestones([
      milestone("e", "Livraison", "2026-10-01", projet("Orphelin", "", "started")),
    ]);
    expect(r).toEqual([]);
  });

  it("tolere un statut absent", () => {
    const r = livraisonsDepuisMilestones([
      milestone("f", "Livraison", "2026-10-01", projet("Sans statut", "COO", null)),
    ]);
    expect(r).toHaveLength(1);
  });

  it("ecarte une milestone sans projet", () => {
    const r = livraisonsDepuisMilestones([milestone("g", "Livraison", "2026-10-01", null)]);
    expect(r).toEqual([]);
  });
});
