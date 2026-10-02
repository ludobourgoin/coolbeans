import { describe, expect, it } from "vitest";
import { dateFr, libellePiece, montantEuros, nomDuPdf, statutPiece } from "./affichage";

const NB = " ";

describe("libellePiece", () => {
  it("nomme chaque type, numéro sans zéros de tête", () => {
    expect(libellePiece({ type: "devis", categorie: null, numero: "004330" })).toBe(`Devis n°${NB}4330`);
    expect(libellePiece({ type: "facture", categorie: "acompte", numero: "024617" })).toBe(`Facture d'acompte n°${NB}24617`);
    expect(libellePiece({ type: "facture", categorie: "intermediaire", numero: "024630" })).toBe(
      `Facture intermédiaire n°${NB}24630`,
    );
    expect(libellePiece({ type: "facture", categorie: "solde", numero: "024624" })).toBe(`Facture de solde n°${NB}24624`);
    expect(libellePiece({ type: "facture", categorie: null, numero: "024625" })).toBe(`Facture n°${NB}24625`);
    expect(libellePiece({ type: "avoir", categorie: null, numero: "000012" })).toBe(`Avoir n°${NB}12`);
  });
});

describe("statutPiece", () => {
  const facture = { type: "facture" as const, reglee_le: null, echeance: null };
  it("dit le règlement, avec ou sans date", () => {
    expect(statutPiece({ ...facture, statut: "reglee", reglee_le: "2026-04-12" })).toBe("Réglée le 12/04/2026");
    expect(statutPiece({ ...facture, statut: "reglee" })).toBe("Réglée");
  });
  it("dit l'échéance d'une facture à régler", () => {
    expect(statutPiece({ ...facture, statut: "a_regler", echeance: "2026-09-30" })).toBe("À régler, échéance le 30/09/2026");
    expect(statutPiece({ ...facture, statut: "a_regler" })).toBe("À régler");
  });
  it("dit l'annulation", () => {
    expect(statutPiece({ ...facture, statut: "annulee" })).toBe("Annulée");
  });
  it("ne dit rien pour un devis ni pour un avoir", () => {
    expect(statutPiece({ type: "devis", statut: null, reglee_le: null, echeance: null })).toBeNull();
    expect(statutPiece({ type: "avoir", statut: "reglee", reglee_le: null, echeance: null })).toBeNull();
  });
});

describe("montantEuros", () => {
  it("met une espace fine entre les milliers et une insécable avant l'euro", () => {
    expect(montantEuros(352800)).toBe("3 528,00 €");
    expect(montantEuros(90000)).toBe("900,00 €");
  });
  it("affiche un avoir négatif", () => {
    expect(montantEuros(-643333)).toBe("-6 433,33 €");
  });
});

describe("dateFr et nomDuPdf", () => {
  it("écrit la date en jj/mm/aaaa", () => {
    expect(dateFr("2026-08-24")).toBe("24/08/2026");
  });
  it("nomme le PDF téléchargé d'après le libellé", () => {
    expect(nomDuPdf({ type: "facture", categorie: "solde", numero: "024624" })).toBe("Facture de solde 24624.pdf");
  });
});
