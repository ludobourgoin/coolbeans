import { describe, expect, it, test } from "vitest";
import { cheminProjet, ongletOuvert, ongletsDuProjet, projetsDuWorkspace, slugIdDe } from "./projets-portail";
import type { ProjetLinear } from "../portail/projets-linear";
import type { Lecture } from "./acces";
import type { DocumentProjet } from "./projet";

const docSalon = (o: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id" | "etape">): DocumentProjet => ({
  statut: "publie",
  projet: "salon-533",
  titreProjet: "Site du salon, édition 2026",
  date: new Date("2026-09-01"),
  ...o,
});

const lisibleSiPublie = (d: DocumentProjet): Lecture =>
  d.statut === "publie" ? { lisible: true, bandeau: null } : { lisible: false };

const salon = (o: Partial<ProjetLinear> = {}): ProjetLinear => ({
  slugId: "e6c1e495a56f",
  segment: "site-du-salon-edition-2026-e6c1e495a56f",
  nom: "Site du salon, édition 2026",
  resume: "Le site du salon.",
  statut: { nom: "In Progress", type: "started" },
  debut: "2026-08-28",
  fin: "2026-10-02",
  misAJour: "2026-09-30T10:00:00Z",
  ...o,
});

const association = salon({
  slugId: "9a42140d4288",
  segment: "site-de-lassociation-revolutions-douces-9a42140d4288",
  nom: "Site de l'association Rev'Olutions Douces",
  resume: "",
  misAJour: "2026-09-29T10:00:00Z",
});

describe("projetsDuWorkspace", () => {
  it("Linear donne la liste, les titres, le résumé et l'ordre", () => {
    const projets = projetsDuWorkspace([association, salon()], [], "rev", () => true);
    expect(projets).toEqual([
      {
        slugId: "e6c1e495a56f",
        segment: "site-du-salon-edition-2026-e6c1e495a56f",
        titre: "Site du salon, édition 2026",
        resume: "Le site du salon.",
        statut: { nom: "In Progress", type: "started" },
        debut: "2026-08-28",
        fin: "2026-10-02",
        nomenclature: "salon-533",
      },
      {
        slugId: "9a42140d4288",
        segment: "site-de-lassociation-revolutions-douces-9a42140d4288",
        titre: "Site de l'association Rev'Olutions Douces",
        resume: null,
        statut: { nom: "In Progress", type: "started" },
        debut: "2026-08-28",
        fin: "2026-10-02",
        nomenclature: null,
      },
    ]);
  });

  it("Linear muet : les projets de la table qui ont un document lisible", () => {
    const documents = [docSalon({ collection: "devis", id: "revolutions-douces/salon-2026-5336", etape: "proposition" })];
    expect(projetsDuWorkspace(null, documents, "rev", (d) => d.statut === "publie")).toEqual([
      {
        slugId: "e6c1e495a56f",
        segment: "e6c1e495a56f",
        titre: "Site du salon, édition 2026",
        resume: null,
        statut: null,
        debut: null,
        fin: null,
        nomenclature: "salon-533",
      },
    ]);
  });

  it("Linear muet et document illisible : aucun projet", () => {
    const documents = [docSalon({ collection: "devis", id: "x", etape: "proposition", statut: "brouillon" })];
    expect(projetsDuWorkspace(null, documents, "rev", (d) => d.statut === "publie")).toEqual([]);
  });

  it("Linear muet et workspace sans clé : aucun projet", () => {
    const documents = [docSalon({ collection: "devis", id: "x", etape: "proposition" })];
    expect(projetsDuWorkspace(null, documents, undefined, () => true)).toEqual([]);
  });

  it("le chemin d'un projet suit son segment", () => {
    expect(cheminProjet({ segment: "site-du-salon-edition-2026-e6c1e495a56f" })).toBe(
      "/projets/site-du-salon-edition-2026-e6c1e495a56f",
    );
  });

  it("un projet Linear d'un autre client n'a pas de nomenclature (spec §4.3)", () => {
    // site-web-879 appartient à caf (CAFA) dans la table ; lu ici dans un
    // workspace de clé rev, il ne doit pas en porter les documents.
    const caf = salon({ slugId: "2361b9acfd1a", segment: "site-web-caf-2361b9acfd1a" });
    const projets = projetsDuWorkspace([caf], [], "rev", () => true);
    expect(projets[0].nomenclature).toBeNull();
  });
});

describe("slugIdDe", () => {
  it("lit l'identifiant court qui termine le segment", () => {
    expect(slugIdDe("site-du-salon-edition-2026-e6c1e495a56f")).toBe("e6c1e495a56f");
    expect(slugIdDe("e6c1e495a56f")).toBe("e6c1e495a56f");
    expect(slugIdDe("ancien-nom-e6c1e495a56f")).toBe("e6c1e495a56f");
  });

  it("refuse un segment sans identifiant court", () => {
    expect(slugIdDe("salon-533")).toBeNull();
    expect(slugIdDe("site-e6c1e495a56")).toBeNull();
    expect(slugIdDe("site-E6C1E495A56F")).toBeNull();
    expect(slugIdDe("")).toBeNull();
  });
});

describe("ongletsDuProjet", () => {
  const proposition = docSalon({ collection: "devis", id: "revolutions-douces/salon-2026-5336", etape: "proposition" });

  it("une étape sans document est grisée ; l'audit n'apparaît qu'avec un audit", () => {
    const onglets = ongletsDuProjet([proposition], "salon-533", lisibleSiPublie);
    expect(onglets.map((o) => o.etape)).toEqual(["cadrage", "proposition", "production", "livraison", "suivi"]);
    expect(onglets.map((o) => o.libelle)).toEqual([
      "1 · Cadrage",
      "2 · Proposition",
      "3 · Production",
      "4 · Livraison",
      "5 · Suivi",
    ]);
    expect(onglets.filter((o) => o.racine).map((o) => o.etape)).toEqual(["proposition"]);
    expect(onglets.find((o) => o.etape === "proposition")!.ids).toEqual(["revolutions-douces/salon-2026-5336"]);
  });

  it("un brouillon compte comme absent pour le client", () => {
    const cadrage = docSalon({ collection: "cadrage", id: "revolutions-douces/brief-5330", etape: "cadrage", statut: "brouillon" });
    const onglet = ongletsDuProjet([cadrage], "salon-533", lisibleSiPublie).find((o) => o.etape === "cadrage")!;
    expect(onglet.racine).toBeNull();
    expect(onglet.ids).toEqual([]);
  });

  it("l'admin lit le brouillon sous son bandeau", () => {
    const cadrage = docSalon({ collection: "cadrage", id: "revolutions-douces/brief-5330", etape: "cadrage", statut: "brouillon" });
    const admin = (d: DocumentProjet): Lecture =>
      d.statut === "publie" ? { lisible: true, bandeau: null } : { lisible: true, bandeau: "brouillon" };
    const onglet = ongletsDuProjet([cadrage], "salon-533", admin).find((o) => o.etape === "cadrage")!;
    expect(onglet.racine?.id).toBe("revolutions-douces/brief-5330");
    expect(onglet.bandeaux).toEqual({ "revolutions-douces/brief-5330": "brouillon" });
  });

  it("l'audit prend l'onglet 0 quand le projet en a un", () => {
    const audit = docSalon({ collection: "cadrage", id: "revolutions-douces/audit-5331", etape: "audit" });
    const onglets = ongletsDuProjet([audit, proposition], "salon-533", lisibleSiPublie);
    expect(onglets[0]).toMatchObject({ etape: "audit", libelle: "0 · Audit" });
  });

  it("un projet sans document de la table a toutes ses étapes grisées", () => {
    const onglets = ongletsDuProjet([proposition], null, lisibleSiPublie);
    expect(onglets).toHaveLength(5);
    expect(onglets.every((o) => o.racine === null)).toBe(true);
  });
});

describe("ongletOuvert", () => {
  const documents = [
    docSalon({ collection: "devis", id: "p", etape: "proposition", date: new Date("2026-09-01") }),
    docSalon({ collection: "livrable", id: "l", etape: "livraison", date: new Date("2026-09-20") }),
  ];
  const onglets = ongletsDuProjet(documents, "salon-533", lisibleSiPublie);

  it("ouvre l'étape que l'adresse demande", () => {
    expect(ongletOuvert(onglets, "proposition")).toBe("proposition");
  });

  it("ouvre le document le plus récent sans demande, ou si la demande est grisée ou inconnue", () => {
    expect(ongletOuvert(onglets, null)).toBe("livraison");
    expect(ongletOuvert(onglets, "cadrage")).toBe("livraison");
    expect(ongletOuvert(onglets, "zzz")).toBe("livraison");
  });

  it("n'ouvre rien quand tout est grisé", () => {
    expect(ongletOuvert(ongletsDuProjet([], "salon-533", lisibleSiPublie), null)).toBeNull();
  });
});
