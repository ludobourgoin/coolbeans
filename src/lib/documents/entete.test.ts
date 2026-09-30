import { expect, test } from "vitest";
import { grouperVersions, libelleOnglet, ligneDate, titreEntete } from "./entete";

const le22 = new Date(2026, 8, 22);

test("un onglet de version affiche son numéro et sa date courte", () => {
  expect(libelleOnglet({ date: le22, version: 2 })).toBe("V2 · 22 sept. 2026");
});

test("un onglet nommé affiche son nom", () => {
  expect(libelleOnglet({ date: le22, version: 2, onglet: "Acheter le nom" })).toBe("Acheter le nom");
});

test("la ligne de date mentionne la version quand il y en a plusieurs", () => {
  expect(ligneDate({ date: le22, version: 2 }, true, "Proposition")).toBe("Version 2 du 22 septembre 2026");
});

test("un document seul ou un chapitre nommé perd la mention de version (spec §7)", () => {
  expect(ligneDate({ date: le22, version: 1 }, false, "Proposition")).toBe("Proposition du 22 septembre 2026");
  expect(ligneDate({ date: le22, version: 2, onglet: "Acheter le nom" }, true, "Document")).toBe(
    "Document du 22 septembre 2026",
  );
});

test("le premier du mois s'écrit « 1er »", () => {
  expect(ligneDate({ date: new Date(2026, 9, 1), version: 1 }, false, "Document")).toBe("Document du 1er octobre 2026");
});

test("le titre de l'en-tête est le nom du projet Linear", () => {
  expect(titreEntete({ titre: "CAFA-TO x Coolbeans", projet: "site-web-879", linear: { projet: "Site web CAFA" } })).toBe(
    "Site web CAFA",
  );
});

test("hors nomenclature, le titre de l'en-tête est celui du document", () => {
  expect(titreEntete({ titre: "En Haut x Coolbeans", linear: {} })).toBe("En Haut x Coolbeans");
});

test("les versions se groupent sous leur racine, dans l'ordre", () => {
  const e = (id: string, version: number, versionDe?: string) => ({ id, data: { version, versionDe } });
  const groupes = grouperVersions([e("a-v3", 3, "a"), e("b", 1), e("a", 1), e("a-v2", 2, "a")]);
  expect(groupes.map((g) => g.map((x) => x.id))).toEqual([["b"], ["a", "a-v2", "a-v3"]]);
});
