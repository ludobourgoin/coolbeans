import { describe, expect, it } from "vitest";
import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";
import { calculer } from "./calc";
import { toDevis } from "./toDevis";
import type { Chiffrage } from "./types";

const cat = CATALOGUE_DEFAUT;
const AT = "2026-08-11T10:00:00.000Z";
const build = (patch: Partial<Chiffrage>) => {
  const c: Chiffrage = {
    ...nouveauChiffrage(cat),
    nom: "Atelier Vasseur — refonte",
    objectif: "Un site qui reflète le savoir-faire de l'atelier.",
    clientSlug: "atelier-vasseur",
    projetSlug: "refonte-site",
    prixRetenu: 6400,
    ...patch,
  };
  return toDevis(c, cat, calculer(c, cat), AT);
};
const titres = (d: ReturnType<typeof build>) => d.sections.map((s) => s.titre);

describe("toDevis — en-tête et budget", () => {
  it("porte nom et objectif dans l'en-tête, pas en section", () => {
    const d = build({ pages: [{ label: "Accueil", niveau: "simple", ux: true, ui: true, integ: true }] });
    expect(d.titre).toBe("Atelier Vasseur — refonte");
    expect(d.objet).toBe("Un site qui reflète le savoir-faire de l'atelier.");
    expect(d.date).toBe(AT);
    expect(titres(d)).not.toContain("Objectif");
  });
  it("un seul montant : le prix retenu, mention HT, conditions de règlement", () => {
    const d = build({ pages: [{ label: "Accueil", niveau: "simple", ux: true, ui: true, integ: true }] });
    const budget = d.sections.find((s) => s.titre === "Budget")!.budget!;
    expect(budget.lignes).toEqual([{ label: "Forfait global de la prestation", prix: 6400 }]);
    expect(budget.mention).toBe("HT");
    expect(budget.reglement).toBe(cat.catalog.devisTexts.conditionsReglement);
    // aucun jour ni prix par ligne ailleurs
    expect(JSON.stringify(d.sections.filter((s) => s.titre !== "Budget"))).not.toMatch(/\d+ ?j\b/);
  });
});

describe("toDevis — sections conditionnelles, dans l'ordre", () => {
  it("mission complète : toutes les sections, ordre fixe", () => {
    const d = build({
      pages: [{ label: "Accueil", niveau: "complexe", ux: true, ui: true, integ: true }],
      devLines: [{ label: "Formulaire de devis avec upload", level: "pack2" }],
      setupCms: true,
      gestionProjet: true,
    });
    expect(titres(d)).toEqual([
      "Pages", "Fonctionnalités", "Stack technique", "Budget",
      "Ce que ça comprend", "Planning", "Hors périmètre",
    ]);
  });
  it("mission sans page : ni Pages ni Stack technique, pas de placeholder", () => {
    const d = build({ devLines: [{ label: "Connexion Webflow → HubSpot", level: "pack2" }], gestionProjet: false });
    expect(titres(d)).not.toContain("Pages");
    expect(titres(d)).not.toContain("Stack technique");
    expect(titres(d)).toContain("Fonctionnalités");
  });
  it("une page cochée à 0 jour n'apparaît pas", () => {
    const d = build({
      pages: [
        { label: "Accueil", niveau: "simple", ux: true, ui: true, integ: true },
        { label: "Fantôme", niveau: "simple", ux: false, ui: false, integ: false },
      ],
    });
    expect(d.sections.find((s) => s.titre === "Pages")!.liste).toEqual(["Accueil"]);
  });
});

describe("toDevis — ajouts automatiques", () => {
  it("« Ce que ça comprend » = base + clientLabels cochés + gestion de projet", () => {
    const d = build({ setupCms: true, setupDomaine: true, gestionProjet: true,
      pages: [{ label: "A", niveau: "simple", ux: true, ui: true, integ: true }] });
    const liste = d.sections.find((s) => s.titre === "Ce que ça comprend")!.liste!;
    expect(liste).toContain(cat.catalog.setup.cms.clientLabel);
    expect(liste).toContain(cat.catalog.setup.domaine.clientLabel);
    expect(liste).not.toContain(cat.catalog.setup.multilingue.clientLabel);
    expect(liste.at(-1)).toBe(
      "Suivi de projet : points hebdomadaires jusqu'à la livraison, comptes-rendus, planning à jour",
    );
  });
  it("hors périmètre nomme la page en portée partielle UX/UI", () => {
    const d = build({
      pages: [
        { label: "Accueil", niveau: "standard", ux: true, ui: false, integ: false },
        { label: "Contact", niveau: "standard", ux: false, ui: true, integ: false },
      ],
    });
    const hors = d.sections.find((s) => s.titre === "Hors périmètre")!.liste!;
    expect(hors).toContain("Le design UI de la page « Accueil » (fourni par un tiers)");
    expect(hors).toContain("Les wireframes de la page « Contact » (fournis par un tiers)");
  });
  it("planning : une seule ligne en semaines, virgule française", () => {
    // 1 page simple complète = 1 j → 0,5 sem + 1 de marge = 1,5
    const d = build({ pages: [{ label: "A", niveau: "simple", ux: true, ui: true, integ: true }] });
    expect(d.sections.find((s) => s.titre === "Planning")!.texte).toBe(
      "Livraison estimée à 1,5 semaines à réception de l'acompte.",
    );
  });
});

describe("toDevis — garde-fous", () => {
  it("refuse le mode libre", () => {
    const c: Chiffrage = { ...nouveauChiffrage(cat), mode: "libre", postes: [{ label: "X", jours: 1 }], prixRetenu: 600 };
    expect(() => toDevis(c, cat, calculer(c, cat), AT)).toThrow();
  });
  it("refuse un prix retenu absent", () => {
    const c: Chiffrage = { ...nouveauChiffrage(cat), prixRetenu: null,
      pages: [{ label: "A", niveau: "simple", ux: true, ui: true, integ: true }] };
    expect(() => toDevis(c, cat, calculer(c, cat), AT)).toThrow();
  });
});
