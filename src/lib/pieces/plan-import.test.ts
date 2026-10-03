import { describe, expect, it } from "vitest";
import type { Piece } from "./piece";
import {
  normaliserRaison,
  pdfDeLaPiece,
  planifierImport,
  sqlEcriture,
  statutFinal,
  type EntreeImport,
  type PieceManifeste,
} from "./plan-import";

const solde: PieceManifeste = {
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
  raison_sociale: "ABEAM DRINKS",
  client: "fylgo",
  projet: "boutique-shopify-390",
};

const entree = (over: Partial<EntreeImport> = {}): EntreeImport => ({
  manifeste: [solde],
  fiches: [
    { slug: "fylgo", genre: "client", raisonsSociales: ["ABEAM DRINKS"] },
    { slug: "trigger", genre: "organisation", raisonsSociales: ["TRIGGER"] },
  ],
  pdfs: ["Facture_024624_Coolbeans_Ludovic_Bourgoin_ABEAM_DRINKS.pdf"],
  existantes: [],
  projetsConnus: ["boutique-shopify-390", "refonte-432"],
  ...over,
});

const enBase = (over: Partial<Piece> = {}): Piece => ({
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

describe("planifierImport", () => {
  it("crée une pièce nouvelle avec sa clé R2 et le projet du manifeste", () => {
    const plan = planifierImport(entree());
    expect(plan.nouvelles).toHaveLength(1);
    expect(plan.nouvelles[0]).toMatchObject({
      r2_key: "pieces/fylgo/facture-024624.pdf",
      projet: "boutique-shopify-390",
      statut: "a_regler",
      reglee_le: null,
    });
    expect(plan.pdfs["facture-024624"]).toBe("Facture_024624_Coolbeans_Ludovic_Bourgoin_ABEAM_DRINKS.pdf");
  });

  it("range sous l'organisation une pièce adressée à un revendeur", () => {
    const plan = planifierImport(
      entree({
        manifeste: [{ ...solde, client: undefined, organisation: "trigger", raison_sociale: "TRIGGER", projet: "refonte-432" }],
      }),
    );
    expect(plan.nouvelles[0]).toMatchObject({ client: null, organisation: "trigger", r2_key: "pieces/trigger/facture-024624.pdf" });
  });

  it("ignore la casse et les espaces en trop de la raison sociale", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, raison_sociale: "  abeam   drinks " }] }));
    expect(plan.ecartees).toEqual([]);
  });

  it("écarte une raison sociale absente de la fiche", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, raison_sociale: "AUTRE SAS" }] }));
    expect(plan.ecartees).toEqual([{ id: "facture-024624", motif: "« AUTRE SAS » absente des raisonsSociales de fylgo" }]);
  });

  it("écarte une fiche introuvable", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, client: "inconnu" }] }));
    expect(plan.ecartees[0].motif).toBe("fiche clients/inconnu introuvable");
  });

  it("écarte une pièce sans PDF", () => {
    const plan = planifierImport(entree({ pdfs: [] }));
    expect(plan.ecartees[0].motif).toBe("aucun PDF pour facture 024624");
  });

  it("écarte un projet absent de la table PROJETS", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, projet: "projet-999" }] }));
    expect(plan.ecartees[0].motif).toBe("projet « projet-999 » absent de la table PROJETS");
  });

  it("écarte des montants incohérents", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, ttc: 352801 }] }));
    expect(plan.ecartees[0].motif).toBe("HT + TVA ne fait pas le TTC");
  });

  it("écarte un identifiant qui ne suit pas type-numéro", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, id: "facture-24624" }] }));
    expect(plan.ecartees[0].motif).toBe("identifiant « facture-24624 » différent de « facture-024624 »");
  });

  it("annonce une pièce inchangée et n'en renvoie pas le PDF", () => {
    const plan = planifierImport(entree({ existantes: [enBase()] }));
    expect(plan.inchangees).toEqual(["facture-024624"]);
    expect(plan.modifiees).toEqual([]);
    expect(plan.pdfs).toEqual({});
  });

  it("ne repasse jamais une facture réglée en à régler, et garde la date posée dans l'admin", () => {
    const plan = planifierImport(entree({ existantes: [enBase({ statut: "reglee", reglee_le: "2026-09-30" })] }));
    expect(plan.inchangees).toEqual(["facture-024624"]);
  });

  it("garde le projet rattaché dans l'admin", () => {
    const plan = planifierImport(
      entree({ manifeste: [{ ...solde, projet: "refonte-432" }], existantes: [enBase({ projet: "boutique-shopify-390" })] }),
    );
    expect(plan.inchangees).toEqual(["facture-024624"]);
  });

  it("passe une facture à régler en réglée avec la date du manifeste", () => {
    const plan = planifierImport(
      entree({ manifeste: [{ ...solde, statut: "reglee", reglee_le: "2026-10-05" }], existantes: [enBase()] }),
    );
    expect(plan.modifiees).toEqual([
      { piece: expect.objectContaining({ statut: "reglee", reglee_le: "2026-10-05" }), champs: ["statut", "reglee_le"] },
    ]);
  });
});

describe("règles unitaires", () => {
  it("statutFinal ne descend jamais vers a_regler", () => {
    expect(statutFinal("reglee", "a_regler")).toBe("reglee");
    expect(statutFinal("annulee", "a_regler")).toBe("annulee");
    expect(statutFinal("a_regler", "reglee")).toBe("reglee");
    expect(statutFinal(null, "a_regler")).toBe("a_regler");
    expect(statutFinal(null, null)).toBeNull();
  });

  it("normaliserRaison met en capitales et resserre les espaces", () => {
    expect(normaliserRaison(" 3bnbw  -  Oïde ")).toBe("3BNBW - OÏDE");
  });

  it("pdfDeLaPiece trouve le PDF par type et numéro", () => {
    const pdfs = ["Devis_004330_Coolbeans_X.pdf", "Facture_024617_Coolbeans_X.pdf"];
    expect(pdfDeLaPiece("devis", "004330", pdfs)).toBe("Devis_004330_Coolbeans_X.pdf");
    expect(pdfDeLaPiece("facture", "004330", pdfs)).toBeUndefined();
  });

  it("sqlEcriture double les apostrophes et laisse le projet en place à la mise à jour", () => {
    const sql = sqlEcriture([enBase({ raison_sociale: "L'ATELIER" })]);
    expect(sql).toContain("'L''ATELIER'");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(sql).not.toMatch(/projet = excluded\.projet/);
  });
});
