import { expect, test } from "vitest";
import { verifierNomenclature, type DocumentProjet } from "./projet";

/** Un document réduit à ce que la vérification lit. */
const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  ...p,
});

const cafa = [
  doc({ collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", versionDe: "cafa/site-web-8791" }),
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  doc({ collection: "cadrage", id: "cafa/achat-domaine-4520", etape: "cadrage", versionDe: "cafa/nom-de-domaine-9042" }),
];

test("un projet cohérent ne produit aucune erreur", () => {
  expect(verifierNomenclature(cafa, [])).toEqual([]);
});

test("une version hérite du projet de sa racine et n'a pas à le porter", () => {
  // achat-domaine n'a ni projet ni étape à elle : son étape par défaut
  // (cadrage) ne compte pas, seule la racine en a une.
  const avecCadrage = [
    ...cafa,
    doc({ collection: "cadrage", id: "cafa/brief-2222", etape: "cadrage", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  ];
  expect(verifierNomenclature(avecCadrage, [])).toEqual([]);
});

test("une racine sans projet est une erreur, sauf si elle est hors nomenclature", () => {
  const seule = [doc({ collection: "devis", id: "en-haut" })];
  expect(verifierNomenclature(seule, [])).toEqual(["devis/en-haut : aucun projet, et absent de HORS_NOMENCLATURE"]);
  expect(verifierNomenclature(seule, ["devis/en-haut"])).toEqual([]);
});

test("un projet absent de la table est une erreur", () => {
  const faux = [doc({ collection: "devis", id: "x/y-1234", projet: "inconnu-123", titreProjet: "Y" })];
  expect(verifierNomenclature(faux, [])).toEqual(["devis/x/y-1234 : projet « inconnu-123 » absent de la table de nomenclature"]);
});

test("deux documents d'un projet à la même étape font échouer le build", () => {
  const doublon = [
    ...cafa,
    doc({ collection: "cadrage", id: "cafa/autre-1111", etape: "production", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  ];
  expect(verifierNomenclature(doublon, [])).toEqual([
    "projet site-web-879 : 2 documents à l'étape production (cadrage/cafa/nom-de-domaine-9042, cadrage/cafa/autre-1111)",
  ]);
});

test("les documents d'un projet affichent tous le même nom Linear", () => {
  const diverge = [...cafa.slice(0, 2), { ...cafa[2], titreProjet: "Site web du CAFA" }];
  expect(verifierNomenclature(diverge, [])).toEqual([
    "projet site-web-879 : linear.projet diverge (« Site web CAFA », « Site web du CAFA »)",
  ]);
});

test("une racine rattachée à un projet doit porter son nom Linear", () => {
  const sansTitre = [doc({ collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" })];
  expect(verifierNomenclature(sansTitre, [])).toEqual(["devis/cafa/site-web-8791 : linear.projet manquant"]);
});

test("une version qui désigne une racine absente est une erreur", () => {
  const orpheline = [doc({ collection: "devis", id: "cafa/site-web-v3-9999", versionDe: "cafa/disparu-0000" })];
  expect(verifierNomenclature(orpheline, [])).toEqual([
    "devis/cafa/site-web-v3-9999 : versionDe « cafa/disparu-0000 » ne désigne aucune racine de devis",
  ]);
});

test("le statut ne compte pas : une trame occupe son étape comme un document publié", () => {
  const trame = [
    ...cafa,
    doc({ collection: "temoignage", id: "cafa/site-web-0001", etape: "suivi", statut: "trame", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  ];
  expect(verifierNomenclature(trame, [])).toEqual([]);
});
