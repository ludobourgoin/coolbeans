import { describe, expect, it } from "vitest";
import { construireVitesse, MESURES_MIN, noter } from "./vitaux";
import type { Appareil, VitauxAppareil } from "./types";

type Triplet = [bon: number, moyen: number, mauvais: number];

const c = (bon: number, moyen: number, mauvais: number) => ({ bon, moyen, mauvais });
const ligne = (
  appareil: Appareil,
  lcp: Triplet,
  inp: Triplet = [0, 0, 0],
  cls: Triplet = [0, 0, 0],
): VitauxAppareil => ({ appareil, lcp: c(...lcp), inp: c(...inp), cls: c(...cls) });

describe("noter", () => {
  it("ne note pas sous 20 mesures, mais les compte", () => {
    expect(MESURES_MIN).toBe(20);
    expect(noter(c(19, 0, 0))).toEqual({ note: null, mesures: 19, partBonne: 1 });
  });

  it("note dès 20 mesures", () => {
    expect(noter(c(20, 0, 0))).toEqual({ note: "bon", mesures: 20, partBonne: 1 });
  });

  it("15 bonnes sur 20 font exactement 75 % : « bon »", () => {
    expect(noter(c(15, 0, 5)).note).toBe("bon");
  });

  it("14 bonnes sur 20 ne suffisent pas", () => {
    expect(noter(c(14, 6, 0)).note).toBe("moyen");
  });

  it("« moyen » quand bonnes et moyennes font au moins 75 %, « mauvais » sinon", () => {
    expect(noter(c(10, 5, 5)).note).toBe("moyen");
    expect(noter(c(10, 4, 6)).note).toBe("mauvais");
  });

  it("ne dépend d'aucun arrondi flottant", () => {
    // 75 % de 28 font 21 : 21 bonnes donnent « bon », 20 non.
    expect(noter(c(21, 7, 0)).note).toBe("bon");
    expect(noter(c(20, 8, 0)).note).toBe("moyen");
  });

  it("rend la part des mesures bonnes, et 0 sans mesure", () => {
    expect(noter(c(30, 6, 4)).partBonne).toBe(0.75);
    expect(noter(c(0, 0, 0))).toEqual({ note: null, mesures: 0, partBonne: 0 });
  });
});

describe("construireVitesse", () => {
  it("rend null sans aucune mesure", () => {
    expect(construireVitesse([])).toBeNull();
    expect(construireVitesse([ligne("mobile", [0, 0, 0])])).toBeNull();
  });

  it("note le global sur tous les appareils, mobile et ordinateur séparément", () => {
    const v = construireVitesse([
      ligne("mobile", [15, 5, 0]),
      ligne("desktop", [20, 0, 0]),
      ligne("tablet", [3, 0, 0]),
      ligne("autre", [2, 0, 0]),
    ])!;
    expect(v.lcp.global).toEqual({ note: "bon", mesures: 45, partBonne: 40 / 45 });
    expect(v.lcp.mobile).toEqual({ note: "bon", mesures: 20, partBonne: 0.75 });
    expect(v.lcp.ordinateur).toEqual({ note: "bon", mesures: 20, partBonne: 1 });
  });

  it("compte tablette et « autre » dans le global seulement", () => {
    const v = construireVitesse([ligne("tablet", [12, 0, 0]), ligne("autre", [10, 0, 0])])!;
    expect(v.lcp.global.mesures).toBe(22);
    expect(v.lcp.mobile).toEqual({ note: null, mesures: 0, partBonne: 0 });
    expect(v.lcp.ordinateur).toEqual({ note: null, mesures: 0, partBonne: 0 });
  });

  it("note chaque métrique avec ses propres compteurs", () => {
    const v = construireVitesse([ligne("mobile", [20, 0, 0], [2, 0, 0], [0, 0, 20])])!;
    expect(v.lcp.global.note).toBe("bon");
    expect(v.inp.global).toEqual({ note: null, mesures: 2, partBonne: 1 });
    expect(v.cls.global.note).toBe("mauvais");
  });

  it("rend une vitesse dès qu'une seule métrique a une mesure", () => {
    const v = construireVitesse([ligne("mobile", [0, 0, 0], [1, 0, 0])]);
    expect(v?.inp.global.mesures).toBe(1);
    expect(v?.lcp.global.mesures).toBe(0);
  });
});
