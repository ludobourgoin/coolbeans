import { describe, expect, it } from "vitest";
import { lireAction } from "./actions-admin";

const projets = ["boutique-shopify-390"];

describe("lireAction", () => {
  it("lit un rattachement, et un détachement", () => {
    expect(lireAction({ action: "rattacher", id: "facture-024624", projet: "boutique-shopify-390" }, projets)).toEqual({
      action: "rattacher",
      id: "facture-024624",
      projet: "boutique-shopify-390",
    });
    expect(lireAction({ action: "rattacher", id: "facture-024624", projet: "" }, projets)).toEqual({
      action: "rattacher",
      id: "facture-024624",
      projet: null,
    });
  });
  it("refuse un projet inconnu", () => {
    expect(lireAction({ action: "rattacher", id: "facture-024624", projet: "x-123" }, projets)).toEqual({
      erreur: "Projet inconnu : x-123.",
    });
  });
  it("lit un règlement daté et refuse une date mal formée", () => {
    expect(lireAction({ action: "regler", id: "facture-024624", date: "2026-10-05" }, projets)).toEqual({
      action: "regler",
      id: "facture-024624",
      date: "2026-10-05",
    });
    expect(lireAction({ action: "regler", id: "facture-024624", date: "05/10/2026" }, projets)).toEqual({
      erreur: "Date attendue au format AAAA-MM-JJ.",
    });
  });
  it("lit une annulation de règlement", () => {
    expect(lireAction({ action: "annuler-reglement", id: "facture-024624" }, projets)).toEqual({
      action: "annuler-reglement",
      id: "facture-024624",
    });
  });
  it("refuse une action ou un identifiant inconnus", () => {
    expect(lireAction({ action: "supprimer", id: "facture-024624" }, projets)).toEqual({ erreur: "Action inconnue." });
    expect(lireAction({ action: "regler", id: "", date: "2026-10-05" }, projets)).toEqual({
      erreur: "Identifiant de pièce manquant.",
    });
    expect(lireAction(null, projets)).toEqual({ erreur: "Corps de requête illisible." });
  });
});
