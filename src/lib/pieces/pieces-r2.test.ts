import { describe, expect, it } from "vitest";
import { dispositionInline, pieceLisible, piecesDuDossier, prefixeDuProjet } from "./pieces-r2";

describe("prefixeDuProjet", () => {
  it("range les pièces par workspace puis par projet Linear", () => {
    expect(prefixeDuProjet("fylgo", "42d0fb9d1281")).toBe("pieces/fylgo/42d0fb9d1281/");
  });
});

describe("piecesDuDossier", () => {
  it("garde les PDF, les nomme par leur fichier et les trie par nom", () => {
    expect(
      piecesDuDossier([
        "pieces/fylgo/42d0fb9d1281/Facture de solde 24624.pdf",
        "pieces/fylgo/42d0fb9d1281/notes.txt",
        "pieces/fylgo/42d0fb9d1281/Devis 4330.pdf",
      ]),
    ).toEqual([
      { libelle: "Devis 4330", href: "/api/pieces/fylgo/42d0fb9d1281/Devis%204330.pdf" },
      {
        libelle: "Facture de solde 24624",
        href: "/api/pieces/fylgo/42d0fb9d1281/Facture%20de%20solde%2024624.pdf",
      },
    ]);
  });
});

describe("pieceLisible", () => {
  const chemin = "fylgo/42d0fb9d1281/Devis 4330.pdf";
  it("ouvre une pièce du workspace courant, dans la portée du compte", () => {
    expect(pieceLisible(chemin, "fylgo", ["fylgo"])).toBe(true);
  });
  it("refuse la pièce d'un autre workspace, ou hors de la portée", () => {
    expect(pieceLisible(chemin, "oide", ["oide", "fylgo"])).toBe(false);
    expect(pieceLisible(chemin, "fylgo", ["oide"])).toBe(false);
    expect(pieceLisible(chemin, null, ["fylgo"])).toBe(false);
  });
  it("refuse un chemin qui sort du dossier du projet ou qui n'est pas un PDF", () => {
    expect(pieceLisible("fylgo/../oide/Devis 4329.pdf", "fylgo", ["fylgo"])).toBe(false);
    expect(pieceLisible("fylgo/Devis 4330.pdf", "fylgo", ["fylgo"])).toBe(false);
    expect(pieceLisible("fylgo/42d0fb9d1281/notes.txt", "fylgo", ["fylgo"])).toBe(false);
  });
});

describe("dispositionInline", () => {
  it("encode le nom du fichier selon la RFC 8187, apostrophe comprise", () => {
    expect(dispositionInline("Facture d'acompte 24617.pdf")).toBe(
      "inline; filename*=UTF-8''Facture%20d%27acompte%2024617.pdf",
    );
  });
});
