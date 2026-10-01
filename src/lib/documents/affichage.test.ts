import { describe, expect, it, test, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import type { DevisData } from "../devis";
import type { ReponseDevis } from "../devis/reponses";
import {
  afficherReponseDevis,
  afficherReponseDocument,
  dateReponse,
  perimetreDevis,
  selecteurFormulaire,
} from "./affichage";
import type { ReponseDocument } from "./reponses";

const document = (surcharge: Partial<ReponseDocument> = {}): ReponseDocument => ({
  id: 1,
  type: "cadrage",
  slug: "aurelie-malbec/precommande-livre-6284",
  decision: null,
  reponses: JSON.stringify([{ question: "PayPal ou Stripe ?", reponse: "Stripe", decisif: true }]),
  message: "Merci",
  prenom: "Aurélie",
  nom: "Malbec",
  email: "aurelie@example.com",
  photoR2: null,
  origine: "formulaire",
  canal: "formulaire",
  createdAt: "2026-09-16 11:59:00",
  ...surcharge,
});

const devis = (surcharge: Partial<ReponseDevis> = {}): ReponseDevis => ({
  id: 1,
  slug: "cafa/site-8791",
  decision: "validation",
  message: null,
  prenom: "Suzanne",
  nom: "Salerno",
  email: "suzanne@example.com",
  raisonSociale: "CAFA Toulouse",
  siren: "123456789",
  adresse: "1 rue du Port, 31000 Toulouse",
  tva: null,
  createdAt: "2026-09-01 08:00:00",
  ...surcharge,
});

describe("dateReponse", () => {
  it("lit l'UTC de D1 et rend la date de Paris", () => {
    expect(dateReponse("2026-09-16 11:59:00")).toBe("16 septembre 2026");
    // 22 h 30 UTC le 30 septembre, c'est déjà le 1er octobre à Paris.
    expect(dateReponse("2026-09-30 22:30:00")).toBe("1er octobre 2026");
  });

  it("rend une chaîne vide sur une date illisible", () => {
    expect(dateReponse("n'importe quoi")).toBe("");
  });
});

describe("afficherReponseDocument", () => {
  it("ne porte jamais les valeurs d'identité, seulement leurs libellés", () => {
    const a = afficherReponseDocument(document());
    const serialise = JSON.stringify(a);
    for (const valeur of ["Aurélie", "Malbec", "aurelie@example.com"]) {
      expect(serialise).not.toContain(valeur);
    }
    expect(a.identite).toEqual(["Prénom", "Nom", "Email", "Consentement"]);
    expect(a.reponses).toEqual([{ question: "PayPal ou Stripe ?", reponse: "Stripe" }]);
    expect(a.message).toBe("Merci");
  });

  it("annonce une photo sans la montrer, et traduit la décision d'un livrable", () => {
    expect(afficherReponseDocument(document({ photoR2: "temoignage/x.jpg" })).identite).toContain(
      "Photo",
    );
    const livrable = afficherReponseDocument(
      document({ type: "livrable", decision: "validation", reponses: null, message: "  " }),
      2,
    );
    expect(livrable).toMatchObject({ decision: "Je valide ce livrable", version: 2, reponses: [] });
    expect(livrable.message).toBeUndefined();
  });
});

describe("afficherReponseDevis", () => {
  it("biffe les coordonnées de facturation présentes, sans ligne pour les absentes", () => {
    const a = afficherReponseDevis(devis());
    expect(a.decision).toBe("Je valide cette proposition");
    expect(a.identite).toEqual([
      "Prénom",
      "Nom",
      "Email",
      "Raison sociale",
      "SIREN",
      "Adresse",
      "Consentement",
    ]);
    const serialise = JSON.stringify(a);
    for (const valeur of ["Suzanne", "CAFA Toulouse", "123456789", "rue du Port"]) {
      expect(serialise).not.toContain(valeur);
    }
  });
});

describe("décision reçue par mail", () => {
  it("n'affiche pas de consentement : le client n'a jamais coché la case", () => {
    const livrable = afficherReponseDocument(
      document({ type: "livrable", decision: "retours", canal: "mail", origine: "reprise" }),
    );
    expect(livrable.canal).toBe("mail");
    expect(livrable.identite).toEqual(["Prénom", "Nom", "Email"]);
    const proposition = afficherReponseDevis(devis({ canal: "mail" }));
    expect(proposition.identite).not.toContain("Consentement");
    expect(afficherReponseDevis(devis()).identite).toContain("Consentement");
  });
});

describe("perimetreDevis", () => {
  const data = {
    sections: [
      {
        budget: {
          lignes: [
            { label: "Socle", montant: 1000, optionnel: false, defaut: false },
            { label: "**Option A**", montant: 250, optionnel: true, defaut: true },
            { label: "Option B", montant: 480, optionnel: true, defaut: false },
          ],
        },
      },
    ],
  } as unknown as DevisData;

  it("relit les options cochées dans le YAML et garde le montant enregistré", () => {
    expect(perimetreDevis(data, "[2]", 1480)).toEqual({
      options: ["Option B"],
      montant: expect.stringContaining("1"),
    });
    expect(perimetreDevis(data, "[]", 1000)?.options).toEqual([]);
  });

  it("ne dit rien sans options enregistrées ou sur un JSON illisible", () => {
    expect(perimetreDevis(data, null, null)).toBeUndefined();
    expect(perimetreDevis(data, "{", null)).toBeUndefined();
  });
});

test("un cadrage clos ne masque que son propre formulaire", () => {
  // Deux chapitres sur une page : répondre au premier ne doit pas retirer
  // le formulaire du second (documents de domaine CAFA, 2026-09-29).
  expect(selecteurFormulaire("cadrage", "cafa/nom-de-domaine-9042")).toBe(
    '[data-cadrage-formulaire][data-slug="cafa/nom-de-domaine-9042"]',
  );
});

test("les autres documents masquent leur formulaire unique, comme avant", () => {
  expect(selecteurFormulaire("devis", "x")).toBe("[data-devis-reponse]");
  expect(selecteurFormulaire("livrable", "x")).toBe("[data-livrable-reponse]");
  expect(selecteurFormulaire("temoignage", "x")).toBe("[data-temoignage-formulaire]");
});

test("sur la page projet, le sélecteur se limite à l'étape du document clos", () => {
  // Deux étapes d'un même projet peuvent porter un livrable (production et
  // livraison) : sans portée, clore l'un masquerait aussi le formulaire de
  // l'autre (spec 2026-09-30, I1).
  expect(selecteurFormulaire("livrable", "x", "livraison-")).toBe(
    '[data-etape-volet="livraison"] [data-livrable-reponse]',
  );
  expect(selecteurFormulaire("cadrage", "cafa/nom-de-domaine-9042", "production-")).toBe(
    '[data-etape-volet="production"] [data-cadrage-formulaire][data-slug="cafa/nom-de-domaine-9042"]',
  );
});
