import { expect, test } from "vitest";
import { sectionsCadrage, sectionsDevis, sectionsLivrable, sectionsTemoignage } from "./sections";

test("les sections d'une proposition suivent ses sections, ancres de version comprises", () => {
  const d = { sections: [{ titre: "Le projet" }, { titre: "Budget" }] };
  expect(sectionsDevis(d)).toEqual([
    { titre: "Le projet", ancre: "le-projet" },
    { titre: "Budget", ancre: "budget" },
  ]);
  expect(sectionsDevis(d, 2).map((s) => s.ancre)).toEqual(["v2-le-projet", "v2-budget"]);
});

test("un cadrage liste son intro, puis son comparatif et son simulateur s'il en a", () => {
  const d = {
    intro: [{ titre: "Le contexte" }],
    comparatif: { titre: "Les deux voies", simulateur: { titre: "Votre budget" } },
  };
  expect(sectionsCadrage(d).map((s) => s.titre)).toEqual(["Le contexte", "Les deux voies", "Votre budget"]);
  expect(sectionsCadrage({ intro: [{ titre: "Seul" }] }).map((s) => s.titre)).toEqual(["Seul"]);
});

test("un livrable ne liste que les blocs qu'il affiche", () => {
  const d = {
    sections: [{ titre: "Ce qui change" }],
    parcours: [],
    parcoursTitre: "Le parcours",
    aVerifier: [{}],
    aVerifierTitre: "À vérifier",
    suite: [],
    suiteTitre: "La suite",
  };
  expect(sectionsLivrable(d).map((s) => s.titre)).toEqual(["Ce qui change", "À vérifier"]);
  expect(sectionsLivrable({ ...d, message: { titre: "Le message" }, parcours: [{}] }).map((s) => s.titre)).toEqual([
    "Ce qui change",
    "Le parcours",
    "Le message",
    "À vérifier",
  ]);
});

test("un témoignage liste son intro, puis la page à valider", () => {
  const d = { intro: [{ titre: "Merci" }], casClient: { titre: "Votre page" } };
  expect(sectionsTemoignage(d).map((s) => s.ancre)).toEqual(["merci", "votre-page"]);
});
