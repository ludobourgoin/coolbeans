import { expect, test } from "vitest";
import { orphelines, pagesDepuisEntrees, type EntreeDuRepo, type PageDuRepo } from "./sync";

const entrees: EntreeDuRepo[] = [
  { id: "unlockbreath/plateforme-5840", data: { titre: "UnlockBreath x Coolbeans", objet: "Plateforme", date: new Date("2026-08-04T00:00:00Z") } },
  { id: "unlockbreath/plateforme-v2-5840", data: { titre: "UnlockBreath x Coolbeans", objet: "Plateforme V2", date: new Date("2026-08-20T00:00:00Z"), versionDe: "unlockbreath/plateforme-5840" } },
  { id: "unlockbreath-studio/site-9999", data: { titre: "Voisin", objet: "Site", date: new Date("2026-09-01T00:00:00Z") } },
];

test("une version de devis ne produit pas de ligne", () => {
  // Elle n'a pas d'URL propre : src/pages/devis/[...slug].astro ne construit
  // de route que pour les racines, donc l'enregistrer mènerait à une 404.
  const pages = pagesDepuisEntrees("devis", entrees, "unlockbreath");
  expect(pages.map((p) => p.cleSource)).toEqual(["devis/unlockbreath/plateforme-5840"]);
});

test("un client dont le slug préfixe un autre ne ramasse pas ses pages", () => {
  expect(pagesDepuisEntrees("devis", entrees, "unlockbreath-studio").map((p) => p.cleSource)).toEqual([
    "devis/unlockbreath-studio/site-9999",
  ]);
});

test("le nom affiché vient de l'objet, l'URL du site public", () => {
  const [page] = pagesDepuisEntrees("cadrage", entrees, "unlockbreath");
  expect(page.titre).toBe("Plateforme");
  expect(page.url).toBe("https://coolbeans.cc/cadrage/unlockbreath/plateforme-5840");
  expect(page.date).toBe("2026-08-04");
});

function page(cleSource: string): PageDuRepo {
  return { cleSource, titre: "x", url: "https://coolbeans.cc/x", date: "2026-09-01" };
}

test("une page retirée du repo est signalée, pas supprimée", () => {
  // Sa ligne reste en base : une suppression silencieuse ferait disparaître un
  // document que le client voyait la veille.
  const mortes = orphelines(
    ["devis/amusoire/refonte-4325", "cadrage/amusoire/audit-1111"],
    [page("devis/amusoire/refonte-4325")],
  );
  expect([...mortes]).toEqual(["cadrage/amusoire/audit-1111"]);
});

test("rien n'est orphelin quand le repo porte toutes les clés", () => {
  const mortes = orphelines(["devis/amusoire/refonte-4325"], [page("devis/amusoire/refonte-4325")]);
  expect(mortes.size).toBe(0);
});

test("les lignes sans clé de source ne sont jamais orphelines", () => {
  // Un fichier déposé ou un lien externe ne vient pas du repo : le repo n'a
  // donc rien à dire sur son existence.
  expect(orphelines([null, null], []).size).toBe(0);
});
