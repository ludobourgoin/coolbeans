import { describe, expect, it } from "vitest";
import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";
import { calculer, joursPage } from "./calc";
import type { Chiffrage } from "./types";

const cat = CATALOGUE_DEFAUT; // tjm 600, joursSemaine 3, semainesMarge 1

const base = (patch: Partial<Chiffrage>): Chiffrage => ({ ...nouveauChiffrage(cat), ...patch });

describe("joursPage — portée UX/UI et intégration", () => {
  it("UX + UI + intégration sur une page complexe = 2 + 1,5", () => {
    expect(joursPage({ label: "Accueil", niveau: "complexe", ux: true, ui: true, integ: true }, cat)).toBe(3.5);
  });
  it("UX seul sur une page standard = 1 × 40 %", () => {
    expect(joursPage({ label: "", niveau: "standard", ux: true, ui: false, integ: false }, cat)).toBeCloseTo(0.4);
  });
  it("UI seul sur une page standard = 1 × 70 %", () => {
    expect(joursPage({ label: "", niveau: "standard", ux: false, ui: true, integ: false }, cat)).toBeCloseTo(0.7);
  });
  it("intégration seule = jours d'intégration du niveau", () => {
    expect(joursPage({ label: "", niveau: "simple", ux: false, ui: false, integ: true }, cat)).toBe(0.5);
  });
  it("rien de coché = 0", () => {
    expect(joursPage({ label: "", niveau: "complexe", ux: false, ui: false, integ: false }, cat)).toBe(0);
  });
});

describe("calculer — chaîne complète du configurateur", () => {
  // 1 page complexe complète (3,5 j) + 1 dev pack2 (1 j) + setup CMS (0,5 j) + 1 ligne libre (1 j) = 6 j
  const c = base({
    pages: [{ label: "Accueil", niveau: "complexe", ux: true, ui: true, integ: true }],
    devLines: [{ label: "Scénario Make", level: "pack2" }],
    autres: [{ label: "Migration", jours: 1 }],
    setupCms: true,
    gestionProjet: true,
  });
  const r = calculer(c, cat);

  it("totalise la production", () => {
    expect(r.totalJoursProduction).toBe(6);
    expect(r.sousTotal).toBe(3600);
  });
  it("estime le délai avec arrondi supérieur au 0,5", () => {
    // 6 j / 3 j/sem = 2 → semainesBase 2, +1 de marge = 3
    expect(r.semainesBase).toBe(2);
    expect(r.semainesTotal).toBe(3);
  });
  it("détaille la gestion de projet (hebdo + forfait CMS)", () => {
    expect(r.gestion.hebdo).toBeCloseTo(3 * 0.15);
    expect(r.gestion.cms).toBe(0.5);
    expect(r.gestion.jours).toBeCloseTo(0.95);
    expect(r.gestion.montant).toBeCloseTo(570);
  });
  it("suit l'ordre affinité → gestion → urgence → marge → réduction", () => {
    expect(r.sousTotalAvantUrgence).toBeCloseTo(3600 + 570);
    expect(r.majorationUrgence).toBe(0);
    expect(r.margeMontant).toBe(0);
    expect(r.totalSuggere).toBeCloseTo(4170);
  });
  it("dérive TVA, TTC, net et TJM depuis le prix (suggéré par défaut)", () => {
    expect(r.prix).toBeCloseTo(4170);
    expect(r.tva).toBeCloseTo(834);
    expect(r.ttc).toBeCloseTo(5004);
    expect(r.net).toBeCloseTo(4170 * 0.74);
    expect(r.tjmVendu).toBeCloseTo(4170 / 6);
  });
});

describe("calculer — modificateurs", () => {
  const lignes = { pages: [{ label: "P", niveau: "standard" as const, ux: true, ui: true, integ: true }] }; // 2 j

  it("affinité « envie » applique la remise avant gestion", () => {
    const r = calculer(base({ ...lignes, affinite: "envie", gestionProjet: false }), cat);
    expect(r.ajusteAffinite).toBeCloseTo(1200 * 0.8);
  });
  it("urgence majore production + gestion", () => {
    const r = calculer(base({ ...lignes, gestionProjet: true, urgence: true }), cat);
    // 2 j → semainesTotal 2 ; gestion = 2 × 0,15 × 600 = 180
    expect(r.majorationUrgence).toBeCloseTo((1200 + 180) * 0.2);
  });
  it("la marge s'applique après urgence, la réduction en dernier avec plancher 0", () => {
    const r = calculer(base({ ...lignes, gestionProjet: false, margePct: 10, reductionMontant: 5000 }), cat);
    expect(r.margeMontant).toBeCloseTo(120);
    expect(r.totalSuggere).toBe(0);
  });
  it("le TJM vendu exclut la marge Coolbeans", () => {
    const r = calculer(base({ ...lignes, gestionProjet: false, margePct: 20, prixRetenu: 1440 }), cat);
    // marge = 1200 × 0,2 = 240 ; (1440 − 240) / 2 = 600
    expect(r.tjmVendu).toBeCloseTo(600);
  });
  it("un chiffrage vide ne divise pas par zéro", () => {
    const r = calculer(base({}), cat);
    expect(r.totalJoursProduction).toBe(0);
    expect(r.semainesTotal).toBe(0);
    expect(r.tjmVendu).toBeNull();
  });
});

describe("calculer — mode libre", () => {
  it("somme les postes et calcule le TJM effectif depuis le prix retenu", () => {
    const r = calculer(
      base({ mode: "libre", postes: [{ label: "Wireframes", jours: 1 }, { label: "Intégration", jours: 8 }], prixRetenu: 3250 }),
      cat,
    );
    expect(r.totalJoursProduction).toBe(9);
    expect(r.tjmEffectif).toBeCloseTo(3250 / 9);
    // en libre : pas de gestion/affinité/marge appliquées
    expect(r.gestion.montant).toBe(0);
    expect(r.totalSuggere).toBe(9 * 600);
  });
});
