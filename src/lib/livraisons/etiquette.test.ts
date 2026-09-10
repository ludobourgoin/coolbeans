import { describe, expect, it } from "vitest";
import { etiquetteMilestone, titreEvenement } from "./etiquette";

const m = (nom: string, description?: string) => ({ nom, description });

describe("etiquetteMilestone", () => {
  it("coupe au premier connecteur", () => {
    expect(etiquetteMilestone(m("Intégration conforme à la maquette"))).toBe("Intégration");
    expect(etiquetteMilestone(m("Compléments de contenu et ajustements"))).toBe("Compléments de contenu");
    expect(etiquetteMilestone(m("Livrer V1 à Amusoire"))).toBe("Livrer V1");
  });

  it("coupe sur la ponctuation", () => {
    expect(etiquetteMilestone(m("Livraison finale (retours client)"))).toBe("Livraison finale");
    expect(etiquetteMilestone(m("Intégration Git + convention de branche"))).toBe("Intégration Git");
  });

  it("retire un préfixe de code", () => {
    expect(etiquetteMilestone(m("P7 · Moteur d'observations"))).toBe("Moteur d'observations");
    expect(etiquetteMilestone(m("S1 — Progression et notes"))).toBe("Progression");
  });

  it("laisse intact un nom déjà court", () => {
    expect(etiquetteMilestone(m("Mise en ligne V1"))).toBe("Mise en ligne V1");
    expect(etiquetteMilestone(m("Support & compte"))).toBe("Support & compte");
  });

  it("tronque au-delà de 30 caractères", () => {
    const long = "Reconstruction intégrale du dispositif de mesure";
    const r = etiquetteMilestone(m(long));
    expect(r.length).toBeLessThanOrEqual(30);
    expect(r.endsWith("…")).toBe(true);
  });

  it("la ligne Agenda de la description l'emporte", () => {
    expect(
      etiquetteMilestone(m("Livraison et mise en ligne", "Contexte interne.\nAgenda : Mise en ligne\nSuite.")),
    ).toBe("Mise en ligne");
  });

  it("ignore une description sans ligne Agenda", () => {
    expect(etiquetteMilestone(m("Bilan pilote (J+14)", "Rien de particulier."))).toBe("Bilan pilote");
  });
});

describe("titreEvenement", () => {
  it("préfixe par la clé de team", () => {
    expect(titreEvenement("LIT", "Intégration")).toBe("LIT-Intégration");
  });
});
