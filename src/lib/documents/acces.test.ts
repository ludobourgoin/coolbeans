import { expect, test } from "vitest";
import { cheminPortail, documentDuPortail, lecture, versionsDuPortail, type CompteLecteur } from "./acces";
import type { DocumentProjet } from "./projet";

const direct = { slug: "cafa", organisation: "coolbeans" };
const revendu = { slug: "amusoire", organisation: "trigger" };

const client = (slug: string): CompteLecteur => ({ role: "client", portee: [slug] });
const revendeur: CompteLecteur = { role: "revendeur", portee: ["amusoire"] };
const admin: CompteLecteur = { role: "admin", portee: ["cafa", "amusoire", "coolbeans"] };

const proposition = { collection: "devis" as const, statut: "publie" as const };
const cadrage = { collection: "cadrage" as const, statut: "publie" as const };

test("un client lit un document publié de son workspace", () => {
  expect(lecture(proposition, client("cafa"), direct)).toEqual({ lisible: true, bandeau: null });
});

test("hors de la portée du compte, rien ne se lit, même publié", () => {
  // Une adresse tapée à la main ne doit rien ouvrir (point de vigilance 1).
  expect(lecture(proposition, client("amusoire"), direct)).toEqual({ lisible: false });
  expect(lecture(proposition, revendeur, direct)).toEqual({ lisible: false });
});

test("un brouillon ou une trame ne se lit que par l'admin, sous le bandeau", () => {
  for (const statut of ["brouillon", "trame"] as const) {
    const doc = { collection: "cadrage" as const, statut };
    expect(lecture(doc, client("cafa"), direct)).toEqual({ lisible: false });
    expect(lecture(doc, revendeur, revendu)).toEqual({ lisible: false });
    expect(lecture(doc, admin, direct)).toEqual({ lisible: true, bandeau: "brouillon" });
  }
});

test("la proposition d'un workspace de revendeur ne se lit que par le revendeur et l'admin", () => {
  expect(lecture(proposition, revendeur, revendu)).toEqual({ lisible: true, bandeau: null });
  expect(lecture(proposition, client("amusoire"), revendu)).toEqual({ lisible: false });
  expect(lecture(proposition, admin, revendu)).toEqual({ lisible: true, bandeau: "revendeur" });
});

test("le bandeau de brouillon prime sur celui du revendeur", () => {
  const brouillon = { collection: "devis" as const, statut: "brouillon" as const };
  expect(lecture(brouillon, admin, revendu)).toEqual({ lisible: true, bandeau: "brouillon" });
});

test("les autres documents d'un workspace de revendeur se lisent par ses invités", () => {
  expect(lecture(cadrage, client("amusoire"), revendu)).toEqual({ lisible: true, bandeau: null });
});

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  ...p,
});

const cafa = [
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791", statut: "brouillon" }),
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison" }),
];

test("une adresse du portail désigne une racine, jamais une version", () => {
  expect(documentDuPortail(cafa, "site-web-879", "proposition")?.id).toBe("cafa/site-web-8791");
  expect(documentDuPortail(cafa, "site-web-879", "livraison")?.collection).toBe("livrable");
  expect(documentDuPortail(cafa, "site-web-879", "suivi")).toBeUndefined();
  expect(documentDuPortail(cafa, "inconnu-000", "proposition")).toBeUndefined();
});

test("le chemin du portail se construit depuis le projet et l'étape", () => {
  expect(cheminPortail(cafa[0])).toBe("/projets/site-web-879/proposition");
  expect(() => cheminPortail({ etape: "proposition" })).toThrow();
});

test("une V2 en brouillon disparaît pour le client et porte son bandeau pour l'admin", () => {
  // Point de vigilance 2.
  const pour = (compte: CompteLecteur) => versionsDuPortail(cafa, cafa[0], (d) => lecture(d, compte, direct));
  expect(pour(client("cafa"))).toEqual({ ids: ["cafa/site-web-8791"], bandeaux: {} });
  expect(pour(admin)).toEqual({
    ids: ["cafa/site-web-8791", "cafa/site-web-v2-4106"],
    bandeaux: { "cafa/site-web-v2-4106": "brouillon" },
  });
});
