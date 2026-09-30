import { describe, expect, it, test } from "vitest";
import {
  cheminProjet,
  ongletOuvert,
  ongletsDuProjet,
  projetsDuWorkspace,
  sectionsProjets,
  slugIdDe,
} from "./projets-portail";
import type { ProjetLinear } from "../portail/projets-linear";
import type { Lecture } from "./acces";
import type { DocumentProjet } from "./projet";

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  date: new Date(2026, 8, 1),
  ...p,
});

const documents = [
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison", date: new Date(2026, 8, 17) }),
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production", statut: "brouillon" }),
  doc({ collection: "devis", id: "unlockbreath/plateforme-3271", projet: "plateforme-327", titreProjet: "Plateforme UnlockBreath" }),
];

const publies = (d: DocumentProjet) => d.statut === "publie";

test("une section par projet du client, une entrée par document lisible, dans l'ordre de la frise", () => {
  expect(sectionsProjets(documents, "caf", publies)).toEqual([
    {
      projet: "site-web-879",
      titre: "Site web CAFA",
      entrees: [
        { label: "2 · Proposition", chemin: "/projets/site-web-879/proposition" },
        { label: "4 · Livraison", chemin: "/projets/site-web-879/livraison" },
      ],
    },
  ]);
});

test("un document que le compte ne lit pas n'a pas d'entrée", () => {
  const tout = sectionsProjets(documents, "caf", () => true);
  expect(tout[0].entrees.map((e) => e.label)).toEqual(["2 · Proposition", "3 · Production", "4 · Livraison"]);
});

test("un projet sans document lisible n'a pas de section", () => {
  expect(sectionsProjets(documents, "caf", () => false)).toEqual([]);
});

test("les projets se rangent du plus récent au plus ancien", () => {
  // Deux projets réels du client `set` dans la nomenclature.
  const set = [
    doc({ collection: "devis", id: "setencorpsmieux/site-internet-7402", projet: "refonte-740", titreProjet: "Refonte", date: new Date(2026, 6, 1) }),
    doc({ collection: "devis", id: "osmose/identite-et-site-2814", projet: "osmose-281", titreProjet: "Osmose", date: new Date(2026, 8, 3) }),
  ];
  expect(sectionsProjets(set, "set", publies).map((s) => s.projet)).toEqual(["osmose-281", "refonte-740"]);
});

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
