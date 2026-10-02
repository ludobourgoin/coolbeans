import { describe, expect, it, test } from "vitest";
import { cheminProjet, ongletOuvert, ongletsDuProjet, packActif, projetsDuWorkspace, slugIdDe } from "./projets-portail";
import type { ProjetLinear } from "../portail/projets-linear";
import { lecture, type Lecture } from "./acces";
import type { DocumentProjet } from "./projet";
import type { ProjetPortail } from "./projets-portail";

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
  id: "uuid-salon",
  pack: false,
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
  id: "uuid-association",
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
        idLinear: "uuid-salon",
        pack: false,
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
        idLinear: "uuid-association",
        pack: false,
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
        idLinear: null,
        pack: false,
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

  it("avec la vraie règle de lecture, la proposition d'un revendeur est grisée pour le client, active pour le revendeur (I4)", () => {
    // Le contrôle de fuite ne vaut rien s'il ne tourne jamais avec la vraie
    // règle `lecture` : une proposition (collection devis) d'un workspace hors
    // Coolbeans est adressée au revendeur, pas au client final (acces.ts §3).
    const workspace = { slug: "amusoire", organisation: "trigger" };
    const client = { role: "client" as const, portee: ["amusoire"] };
    const revendeur = { role: "revendeur" as const, portee: ["amusoire"] };
    const lireClient = (d: DocumentProjet) => lecture(d, client, workspace);
    const lireRevendeur = (d: DocumentProjet) => lecture(d, revendeur, workspace);

    const ongletClient = ongletsDuProjet([proposition], "salon-533", lireClient).find(
      (o) => o.etape === "proposition",
    )!;
    expect(ongletClient.racine).toBeNull();
    expect(ongletClient.ids).toEqual([]);

    const ongletRevendeur = ongletsDuProjet([proposition], "salon-533", lireRevendeur).find(
      (o) => o.etape === "proposition",
    )!;
    expect(ongletRevendeur.racine).not.toBeNull();
    expect(ongletRevendeur.ids).toEqual([proposition.id]);
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

describe("packActif", () => {
  const projet = (o: Partial<ProjetPortail>): ProjetPortail => ({
    slugId: "8947ac98efef",
    segment: "pack-dheures-octobre-2026-8947ac98efef",
    titre: "Pack d'heures, octobre 2026",
    resume: null,
    statut: { nom: "In Progress", type: "started" },
    debut: null,
    fin: null,
    nomenclature: "pack-heures-973",
    idLinear: "uuid-pack",
    pack: true,
    ...o,
  });

  it("rend le pack planifié ou en cours, premier dans l'ordre de la barre", () => {
    const refonte = projet({ pack: false, idLinear: "uuid-refonte" });
    expect(packActif([refonte, projet({})])?.idLinear).toBe("uuid-pack");
    expect(packActif([projet({ statut: { nom: "Planned", type: "planned" } })])?.idLinear).toBe("uuid-pack");
  });

  it("ignore un pack pas encore payé, terminé, ou sans identifiant Linear", () => {
    expect(packActif([projet({ statut: { nom: "Proposal", type: "backlog" } })])).toBeUndefined();
    expect(packActif([projet({ statut: { nom: "Completed", type: "completed" } })])).toBeUndefined();
    expect(packActif([projet({ idLinear: null, statut: null })])).toBeUndefined();
  });
});
