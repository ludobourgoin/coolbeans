import { describe, expect, it } from "vitest";
import { STATUT_LABEL, statutDevis } from "./statut";
import type { ReponseDevis } from "./reponses";

const reponse: ReponseDevis = {
  id: 1,
  slug: "cafa",
  decision: "validation",
  message: null,
  prenom: "Suzanne",
  nom: "Salerno",
  email: "s@s.fr",
  createdAt: "2026-08-17T12:00:00Z",
};

describe("statutDevis", () => {
  it("sans envoi ni réponse : publié", () => {
    expect(statutDevis(undefined, undefined)).toBe("publie");
  });

  it("envoi seul : envoyé", () => {
    expect(statutDevis({ date: new Date("2026-08-18") }, undefined)).toBe("envoye");
  });

  it("réponse prioritaire, même sans envoi noté dans le YAML", () => {
    expect(statutDevis(undefined, reponse)).toBe("repondu");
    expect(statutDevis({ date: new Date("2026-08-18") }, reponse)).toBe("repondu");
  });

  it("libellés d'affichage", () => {
    expect(STATUT_LABEL).toEqual({ publie: "Publié", envoye: "Envoyé", repondu: "Répondu" });
  });
});
