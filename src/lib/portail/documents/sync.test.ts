import { expect, test } from "vitest";
import { orphelines, type PageDuRepo } from "./sync";

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
