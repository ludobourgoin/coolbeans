import { expect, test } from "vitest";
import { DEFINITIONS, ETAPES, ETAPE_HABITUELLE, definitionEtape } from "./etapes";

test("la frise suit l'ordre des étapes, l'audit en tête", () => {
  expect(DEFINITIONS.map((d) => d.etape)).toEqual([...ETAPES]);
  expect(DEFINITIONS.map((d) => d.numero)).toEqual([0, 1, 2, 3, 4, 5]);
});

test("cadrage reste l'étape 1, l'audit prend le zéro", () => {
  // Arbitrage du 2026-09-29 : le zéro place l'audit avant le cycle sans
  // renuméroter les projets qui n'en ont pas.
  expect(definitionEtape("cadrage").numero).toBe(1);
  expect(definitionEtape("audit").numero).toBe(0);
});

test("chaque étape a sa teinte, et aucune n'est prise deux fois", () => {
  const teintes = DEFINITIONS.map((d) => d.teinte);
  expect(new Set(teintes).size).toBe(teintes.length);
  expect(definitionEtape("audit").teinte).toBe("teal");
});

test("chaque collection a une étape habituelle", () => {
  expect(ETAPE_HABITUELLE).toEqual({
    cadrage: "cadrage",
    devis: "proposition",
    livrable: "livraison",
    temoignage: "suivi",
  });
});
