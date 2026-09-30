import { expect, test } from "vitest";
import { frise, friseAvec } from "./frise";
import type { DocumentProjet } from "./projet";

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  ...p,
});

const cafa: DocumentProjet[] = [
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production" }),
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison" }),
  doc({ collection: "devis", id: "autre/projet-1234", projet: "plateforme-327", titreProjet: "Plateforme UnlockBreath" }),
];
const devisCafa = { collection: "devis" as const, id: "cafa/site-web-8791" };

test("cinq pastilles numérotées de 1 à 5 quand le projet n'a pas d'audit", () => {
  const p = frise(cafa, devisCafa, false);
  expect(p.map((x) => x.numero)).toEqual([1, 2, 3, 4, 5]);
  expect(p.map((x) => x.libelle)).toEqual(["Cadrage", "Proposition", "Production", "Livraison", "Suivi"]);
});

test("seule l'étape du document courant est colorée", () => {
  const p = frise(cafa, devisCafa, false);
  expect(p.filter((x) => x.courante).map((x) => x.etape)).toEqual(["proposition"]);
});

test("les pastilles mènent aux documents du projet, et à eux seuls", () => {
  const p = frise(cafa, devisCafa, false);
  expect(p.map((x) => x.href)).toEqual([
    undefined,
    "/devis/cafa/site-web-8791",
    "/cadrage/cafa/nom-de-domaine-9042",
    "/livrable/cafa/site-web-8791",
    undefined,
  ]);
});

test("une version ne crée pas de pastille, même si son étape par défaut est libre", () => {
  const avecVersion = [...cafa, doc({ collection: "cadrage", id: "cafa/achat-domaine-4520", etape: "cadrage", projet: undefined, versionDe: "cafa/nom-de-domaine-9042" })];
  expect(frise(avecVersion, devisCafa, false)[0].href).toBeUndefined();
});

test("en production, un document en trame ou en brouillon est estompé", () => {
  const brouillon = cafa.map((d) => (d.collection === "livrable" ? { ...d, statut: "brouillon" as const } : d));
  expect(frise(brouillon, devisCafa, false)[3].href).toBeUndefined();
});

test("en développement local, il reste cliquable pour la relecture", () => {
  const trame = cafa.map((d) => (d.collection === "livrable" ? { ...d, statut: "trame" as const } : d));
  expect(frise(trame, devisCafa, true)[3].href).toBe("/livrable/cafa/site-web-8791");
});

test("un audit ajoute la pastille 0 en tête, même en trame", () => {
  const avecAudit = [...cafa, doc({ collection: "cadrage", id: "cafa/audit-1111", etape: "audit", statut: "trame" })];
  const p = frise(avecAudit, devisCafa, false);
  expect(p.map((x) => x.numero)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(p[0]).toMatchObject({ libelle: "Audit", teinte: "teal", href: undefined });
});

test("un document hors nomenclature n'a pas de frise", () => {
  const seul = [doc({ collection: "devis", id: "en-haut", projet: undefined })];
  expect(frise(seul, { collection: "devis", id: "en-haut" }, false)).toEqual([]);
});

test("un document inconnu n'a pas de frise", () => {
  expect(frise(cafa, { collection: "devis", id: "absent" }, false)).toEqual([]);
});

test("dans le portail, la frise suit ce que le compte lit et pointe vers le portail", () => {
  const lisible = (d: DocumentProjet) => d.collection !== "livrable";
  const url = (d: DocumentProjet) => `/projets/${d.projet}/${d.etape}`;
  const p = friseAvec(cafa, devisCafa, lisible, url);
  expect(p.map((x) => x.href)).toEqual([
    undefined,
    "/projets/site-web-879/proposition",
    "/projets/site-web-879/production",
    undefined,
    undefined,
  ]);
});
