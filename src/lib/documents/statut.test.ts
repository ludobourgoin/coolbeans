import { expect, test } from "vitest";
import { construitesEnProduction } from "./statut";

/** Une entrée réduite à ce que le filtre lit, et rien de plus. */
const doc = (id: string, statut: "trame" | "brouillon" | "publie") => ({ id, data: { statut } });

test("en production, seuls les documents publiés sortent du build", () => {
  const entrees = [doc("a", "publie"), doc("b", "brouillon"), doc("c", "trame")];
  expect(construitesEnProduction(entrees, false).map((e) => e.id)).toEqual(["a"]);
});

test("trame et brouillon se comportent à l'identique côté client", () => {
  // Ils ne se distinguent que pour Ludo. Si un jour l'un des deux sort du
  // build, c'est une page non relue servie à une cliente : c'est arrivé le
  // 2026-09-22 sur la V2 du livrable CAFA.
  expect(construitesEnProduction([doc("b", "brouillon")], false)).toEqual([]);
  expect(construitesEnProduction([doc("c", "trame")], false)).toEqual([]);
});

test("en développement local, tout reste lisible", () => {
  // Masquer un document ne doit pas revenir à le perdre : c'est là que Ludo
  // le relit avant de le publier.
  const entrees = [doc("a", "publie"), doc("b", "brouillon"), doc("c", "trame")];
  expect(construitesEnProduction(entrees, true).map((e) => e.id)).toEqual(["a", "b", "c"]);
});

test("le filtre ne réordonne ni ne recopie les entrées", () => {
  // Les routes de devis et de livrable trient ensuite par numéro de version :
  // elles reçoivent bien les mêmes objets, pas des copies.
  const a = doc("a", "publie");
  const b = doc("b", "publie");
  const sortie = construitesEnProduction([a, b], false);
  expect(sortie[0]).toBe(a);
  expect(sortie[1]).toBe(b);
});
