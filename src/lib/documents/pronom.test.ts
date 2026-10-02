import { describe, expect, it, vi } from "vitest";
import {
  ouVous,
  pronomDuCompte,
  pronomDuDocument,
  verifierPronoms,
  type DocumentPronom,
  type Registres,
} from "./pronom";

const fiches = [
  { slug: "cafa", cle: "caf", organisation: "coolbeans", tutoiement: false },
  { slug: "miharu", cle: "mih", organisation: "trigger", tutoiement: false },
  { slug: "coolbeans", organisation: "coolbeans", tutoiement: true },
];
const organisations = [
  { slug: "coolbeans", tutoiement: true },
  { slug: "trigger", tutoiement: true },
];

const registres = (documents: DocumentPronom[]): Registres => ({ documents, fiches, organisations });

describe("pronomDuDocument", () => {
  it("la clé du document gagne sur la fiche", () => {
    const doc: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879", tutoiement: true };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("tu");
  });

  it("un client direct suit sa fiche", () => {
    const doc: DocumentPronom = { collection: "livrable", id: "cafa/site-web-8791", projet: "site-web-879" };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("vous");
  });

  it("une version sans projet hérite de sa racine, clé comprise", () => {
    const racine: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879", tutoiement: true };
    const v2: DocumentPronom = { collection: "devis", id: "cafa/site-web-v2-4106", versionDe: "cafa/site-web-8791" };
    expect(pronomDuDocument(v2, registres([racine, v2]))).toBe("tu");
  });

  it("une version sans clé hérite de la fiche de sa racine", () => {
    const racine: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" };
    const v2: DocumentPronom = { collection: "devis", id: "cafa/site-web-v2-4106", versionDe: "cafa/site-web-8791" };
    expect(pronomDuDocument(v2, registres([racine, v2]))).toBe("vous");
  });

  it("une proposition chez un revendeur suit l'organisation", () => {
    const doc: DocumentPronom = { collection: "devis", id: "miharu/formulaire-brochures-8314", projet: "formulaire-brochures-831" };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("tu");
  });

  it("un autre document chez un revendeur suit la fiche du client final", () => {
    const doc: DocumentPronom = { collection: "livrable", id: "miharu/formulaire-brochures-8314", projet: "formulaire-brochures-831" };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("vous");
  });

  it("une organisation inconnue ne résout rien", () => {
    const doc: DocumentPronom = { collection: "devis", id: "miharu/formulaire-brochures-8314", projet: "formulaire-brochures-831" };
    expect(pronomDuDocument(doc, { documents: [doc], fiches, organisations: [] })).toBeUndefined();
  });

  it("une fiche sans pronom ne résout rien", () => {
    const doc: DocumentPronom = { collection: "livrable", id: "cafa/site-web-8791", projet: "site-web-879" };
    const sansPronom = fiches.map((f) => ({ ...f, tutoiement: undefined }));
    expect(pronomDuDocument(doc, { documents: [doc], fiches: sansPronom, organisations })).toBeUndefined();
  });

  it("un document sans projet ni clé ne résout rien", () => {
    const doc: DocumentPronom = { collection: "cadrage", id: "veronique-berthet/manuscrit-bb-4812" };
    expect(pronomDuDocument(doc, registres([doc]))).toBeUndefined();
  });
});

describe("verifierPronoms", () => {
  it("nomme chaque document sans pronom", () => {
    const ok: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" };
    const hors: DocumentPronom = { collection: "cadrage", id: "veronique-berthet/manuscrit-bb-4812" };
    expect(verifierPronoms(registres([ok, hors]), ["cadrage/veronique-berthet/manuscrit-bb-4812"])).toEqual([
      "cadrage/veronique-berthet/manuscrit-bb-4812 : hors nomenclature, il doit porter sa propre clé tutoiement",
    ]);
  });

  it("ne dit rien quand tout résout", () => {
    const ok: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" };
    expect(verifierPronoms(registres([ok]))).toEqual([]);
  });
});

describe("pronomDuCompte", () => {
  it("un client suit la fiche de son workspace", () => {
    expect(pronomDuCompte({ role: "client", organisation: "coolbeans", workspace: "cafa" }, { fiches, organisations })).toBe("vous");
  });
  it("un revendeur suit son organisation", () => {
    expect(pronomDuCompte({ role: "revendeur", organisation: "trigger", workspace: null }, { fiches, organisations })).toBe("tu");
  });
  it("un admin suit la fiche coolbeans", () => {
    expect(pronomDuCompte({ role: "admin", organisation: null, workspace: null }, { fiches, organisations })).toBe("tu");
  });
  it("un client sans workspace ne résout rien", () => {
    expect(pronomDuCompte({ role: "client", organisation: "coolbeans", workspace: null }, { fiches, organisations })).toBeUndefined();
  });
});

describe("ouVous", () => {
  it("garde un pronom résolu", () => {
    expect(ouVous("tu", "test")).toBe("tu");
  });
  it("replie sur le vous et le signale", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ouVous(undefined, "compte client")).toBe("vous");
    expect(warn).toHaveBeenCalledWith("pronom non résolu (compte client) : repli sur le vous");
    warn.mockRestore();
  });
});
