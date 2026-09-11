import { describe, expect, it } from "vitest";
import { corpsEvenement, idEvenement, lendemain } from "./google-calendar";
import type { Livraison } from "./linear-milestones";

const L: Livraison = {
  milestoneId: "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80",
  cleTeam: "LIT",
  etiquette: "Intégration",
  date: "2026-09-12",
  projetNom: "Site vitrine LittleBox",
  projetUrl: "https://linear.app/coolbeans-hq/project/littlebox",
};

describe("idEvenement", () => {
  it("derive un identifiant valide pour Google", () => {
    const id = idEvenement(L.milestoneId);
    expect(id).toBe("lm8b6f09dde6bb41fe9bdb617b6b85af80");
    // Google n'accepte que les caracteres a-v et 0-9, longueur 5 a 1024.
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
  });

  it("est stable", () => {
    expect(idEvenement(L.milestoneId)).toBe(idEvenement(L.milestoneId));
  });
});

describe("lendemain", () => {
  it("ajoute un jour", () => {
    expect(lendemain("2026-09-12")).toBe("2026-09-13");
  });

  it("franchit une fin de mois", () => {
    expect(lendemain("2026-09-30")).toBe("2026-10-01");
  });

  it("franchit une fin d'annee", () => {
    expect(lendemain("2026-12-31")).toBe("2027-01-01");
  });

  it("ignore une heure eventuellement presente dans l'entree", () => {
    expect(lendemain("2026-09-12T08:30:00Z")).toBe("2026-09-13");
  });
});

describe("corpsEvenement", () => {
  it("compose un evenement journee entiere marque livraisons", () => {
    expect(corpsEvenement(L)).toEqual({
      id: "lm8b6f09dde6bb41fe9bdb617b6b85af80",
      summary: "LIT-Intégration",
      description: 'Site vitrine LittleBox\nhttps://linear.app/coolbeans-hq/project/littlebox',
      start: { date: "2026-09-12" },
      end: { date: "2026-09-13" },
      transparency: "transparent",
      extendedProperties: { private: { source: "livraisons" } },
    });
  });
});
