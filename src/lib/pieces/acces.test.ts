import { describe, expect, it } from "vitest";
import type { Piece } from "./piece";
import { pieceLisibleParClient } from "./acces";

const piece = (over: Partial<Piece> = {}): Piece => ({
  id: "facture-024624",
  type: "facture",
  numero: "024624",
  categorie: "solde",
  emise_le: "2026-08-24",
  echeance: "2026-08-24",
  ht: 294000,
  tva: 58800,
  ttc: 352800,
  statut: "a_regler",
  reglee_le: null,
  client: "fylgo",
  organisation: null,
  projet: "boutique-shopify-390",
  raison_sociale: "ABEAM DRINKS",
  r2_key: "pieces/fylgo/facture-024624.pdf",
  ...over,
});

describe("pieceLisibleParClient", () => {
  it("ouvre la pièce rattachée du workspace courant", () => {
    expect(pieceLisibleParClient(piece(), "fylgo", ["fylgo"])).toBe(true);
  });
  it("refuse la pièce d'un autre client", () => {
    expect(pieceLisibleParClient(piece(), "oide", ["oide", "fylgo"])).toBe(false);
  });
  it("refuse un workspace hors de la portée du compte", () => {
    expect(pieceLisibleParClient(piece(), "fylgo", ["oide"])).toBe(false);
  });
  it("refuse une pièce sans projet", () => {
    expect(pieceLisibleParClient(piece({ projet: null }), "fylgo", ["fylgo"])).toBe(false);
  });
  it("refuse une pièce de revendeur", () => {
    expect(pieceLisibleParClient(piece({ client: null, organisation: "trigger" }), "trigger", ["trigger"])).toBe(false);
  });
  it("refuse une pièce inconnue ou sans workspace courant", () => {
    expect(pieceLisibleParClient(null, "fylgo", ["fylgo"])).toBe(false);
    expect(pieceLisibleParClient(piece(), null, ["fylgo"])).toBe(false);
  });
});
