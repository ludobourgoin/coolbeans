import { describe, expect, it, vi } from "vitest";
import { d1Sqlite } from "./d1-sqlite.testutil";
import { ecrireJour, type LigneJour, type LigneRepartition } from "./store";
import {
  chargerTableau,
  choisirSite,
  construireTableau,
  fenetre,
  lirePeriode,
  lundiDe,
} from "./tableau";

const SITE = "7257179f83b6445d93703f1d1f305a4a";
const AUTRE = "2ad7fb260e2a498a900a5d97d41b6853";
const MAINTENANT = new Date("2026-09-29T10:00:00Z");

describe("lirePeriode", () => {
  it("accepte 30j et 6m, retombe sur 30j pour tout le reste", () => {
    expect(lirePeriode("6m")).toBe("6m");
    expect(lirePeriode("30j")).toBe("30j");
    expect(lirePeriode(null)).toBe("30j");
    expect(lirePeriode("12m")).toBe("30j");
    expect(lirePeriode("6M")).toBe("30j");
  });
});

describe("choisirSite", () => {
  const sites = [
    { host: "revolutionsdouces.org", siteTag: "4b3f282e3f8a4d90ac63fbeb41577e72" },
    { host: "construire-habiter-autrement.org", siteTag: "7b1613c4d8524beaae503934203801a4" },
  ];

  it("rend le site demandé s'il appartient au client", () => {
    expect(choisirSite(sites, "construire-habiter-autrement.org")).toBe(sites[1]);
  });

  it("retombe sur le premier site pour un host absent", () => {
    expect(choisirSite(sites, null)).toBe(sites[0]);
  });

  it("ne sort jamais de la liste du client", () => {
    // Le host d'un autre client, ou un siteTag glissé à la place du host.
    expect(choisirSite(sites, "setencorpsmieux.fr")).toBe(sites[0]);
    expect(choisirSite(sites, "7257179f83b6445d93703f1d1f305a4a")).toBe(sites[0]);
  });

  it("rend null pour un client sans site", () => {
    expect(choisirSite([], "coolbeans.cc")).toBeNull();
  });
});

describe("fenetre", () => {
  it("couvre 30 jours finissant la veille, en UTC", () => {
    expect(fenetre("30j", MAINTENANT)).toEqual({ du: "2026-08-30", au: "2026-09-28" });
  });

  it("couvre 182 jours pour 6 mois", () => {
    expect(fenetre("6m", MAINTENANT)).toEqual({ du: "2026-03-31", au: "2026-09-28" });
  });
});

describe("lundiDe", () => {
  it("rend le lundi (UTC) de la semaine", () => {
    expect(lundiDe("2026-09-28")).toBe("2026-09-28"); // lundi
    expect(lundiDe("2026-09-27")).toBe("2026-09-21"); // dimanche
    expect(lundiDe("2026-10-01")).toBe("2026-09-28"); // jeudi
  });
});

describe("construireTableau", () => {
  const jours: LigneJour[] = [
    { jour: "2026-09-22", visites: 2, pagesVues: 3, echantillon: 1 },
    { jour: "2026-09-24", visites: 5, pagesVues: 8, echantillon: 1 },
    { jour: "2026-09-28", visites: 1, pagesVues: 1, echantillon: 1 },
  ];
  // Le 23 est collecté sans trafic ; du 25 au 27, rien n'a été collecté.
  const collectes = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-28"];
  const repartitions: LigneRepartition[] = [
    { dimension: "page", valeur: "/", visites: 6, pagesVues: 9 },
    { dimension: "page", valeur: "/contact", visites: 2, pagesVues: 3 },
    { dimension: "provenance", valeur: "", visites: 6, pagesVues: 8 },
    { dimension: "provenance", valeur: "m.facebook.com", visites: 2, pagesVues: 4 },
    { dimension: "appareil", valeur: "mobile", visites: 6, pagesVues: 9 },
    { dimension: "appareil", valeur: "desktop", visites: 2, pagesVues: 3 },
  ];
  const base = { periode: "30j" as const, jours, repartitions, collectes, vitaux: [] };

  it("totalise la période", () => {
    const t = construireTableau(base);
    expect(t.visites).toBe(8);
    expect(t.pagesVues).toBe(12);
  });

  it("une barre par jour collecté, à 0 sans trafic, aucune pour un jour jamais collecté", () => {
    expect(construireTableau(base).barres).toEqual([
      { debut: "2026-09-22", visites: 2, pagesVues: 3, partielle: false },
      { debut: "2026-09-23", visites: 0, pagesVues: 0, partielle: false },
      { debut: "2026-09-24", visites: 5, pagesVues: 8, partielle: false },
      { debut: "2026-09-28", visites: 1, pagesVues: 1, partielle: false },
    ]);
  });

  it("regroupe par semaine, du lundi, sur 6 mois, et marque les semaines de moins de 7 jours collectés", () => {
    // 3 jours collectés dans la semaine du 21, 1 seul dans celle du 28 :
    // les deux sont partielles.
    expect(construireTableau({ ...base, periode: "6m" }).barres).toEqual([
      { debut: "2026-09-21", visites: 7, pagesVues: 11, partielle: true },
      { debut: "2026-09-28", visites: 1, pagesVues: 1, partielle: true },
    ]);
  });

  it("une semaine de 7 jours collectés n'est pas partielle, contrairement à sa voisine incomplète", () => {
    const semaineComplete = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
    const semainePartielle = ["2026-09-21", "2026-09-22"];
    const t = construireTableau({
      periode: "6m",
      jours: [],
      repartitions: [],
      collectes: [...semaineComplete, ...semainePartielle],
      vitaux: [],
    });
    expect(t.barres).toEqual([
      { debut: "2026-09-14", visites: 0, pagesVues: 0, partielle: false },
      { debut: "2026-09-21", visites: 0, pagesVues: 0, partielle: true },
    ]);
  });

  it("classe les pages par pages vues, la provenance et les appareils par visites", () => {
    const t = construireTableau(base);
    expect(t.pages).toEqual([
      { libelle: "/", valeur: 9, part: 0.75 },
      { libelle: "/contact", valeur: 3, part: 0.25 },
    ]);
    expect(t.provenances).toEqual([
      { libelle: "Accès direct", valeur: 6, part: 0.75 },
      { libelle: "m.facebook.com", valeur: 2, part: 0.25 },
    ]);
    expect(t.appareils).toEqual([
      { libelle: "Mobile", valeur: 6, part: 0.75 },
      { libelle: "Ordinateur", valeur: 2, part: 0.25 },
    ]);
  });

  it("garde les 10 premières pages, les égalités par ordre alphabétique", () => {
    const beaucoup: LigneRepartition[] = Array.from({ length: 12 }, (_, i) => ({
      dimension: "page",
      valeur: `/p${String(i).padStart(2, "0")}`,
      visites: 1,
      pagesVues: 1,
    }));
    const t = construireTableau({ ...base, repartitions: beaucoup });
    expect(t.pages).toHaveLength(10);
    expect(t.pages[0].libelle).toBe("/p00");
    expect(t.pages[9].libelle).toBe("/p09");
  });

  it("signale un jour estimé par Cloudflare", () => {
    expect(construireTableau(base).estime).toBe(false);
    const estimes = [...jours, { jour: "2026-09-23", visites: 10, pagesVues: 10, echantillon: 10 }];
    expect(construireTableau({ ...base, jours: estimes }).estime).toBe(true);
  });

  it("ne divise jamais par zéro", () => {
    const t = construireTableau({
      periode: "30j",
      jours: [],
      repartitions: [],
      collectes: ["2026-09-28"],
      vitaux: [],
    });
    expect(t.visites).toBe(0);
    expect(t.pages).toEqual([]);
    expect(t.barres).toEqual([{ debut: "2026-09-28", visites: 0, pagesVues: 0, partielle: false }]);
  });

  it("note la vitesse sur la période, null sans aucune mesure", () => {
    expect(construireTableau(base).vitesse).toBeNull();
    const vitaux = [
      {
        appareil: "mobile" as const,
        lcp: { bon: 20, moyen: 0, mauvais: 0 },
        inp: { bon: 0, moyen: 0, mauvais: 0 },
        cls: { bon: 0, moyen: 0, mauvais: 0 },
      },
    ];
    expect(construireTableau({ ...base, vitaux }).vitesse?.lcp.global).toEqual({
      note: "bon",
      mesures: 20,
      partBonne: 1,
    });
  });
});

describe("chargerTableau", () => {
  const mesure = (siteTag: string, jour: string) => ({
    siteTag,
    jour,
    visites: 2,
    pagesVues: 3,
    echantillon: 1,
    pages: [{ valeur: "/", visites: 2, pagesVues: 3 }],
    provenances: [],
    appareils: [],
    vitaux: [],
  });

  it("rend un tableau nul tant qu'aucun jour n'est collecté", async () => {
    const { db } = d1Sqlite();
    expect(await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT })).toEqual({
      ok: true,
      depuis: null,
      derniereCollecte: null,
      tableau: null,
    });
  });

  it("lit D1 et construit le tableau du site", async () => {
    const { db } = d1Sqlite();
    await ecrireJour(db, "2026-09-28", [mesure(SITE, "2026-09-28")], "2026-09-29T04:05:00.000Z");
    const r = await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT });
    if (!r.ok) throw new Error("chargement en échec");
    expect(r.depuis).toBe("2026-09-28");
    expect(r.derniereCollecte).toBe("2026-09-29T04:05:00.000Z");
    expect(r.tableau?.visites).toBe(2);
  });

  it("ne montre jamais les chiffres d'un autre site", async () => {
    const { db } = d1Sqlite();
    await ecrireJour(db, "2026-09-28", [mesure(AUTRE, "2026-09-28")], "2026-09-29T04:05:00.000Z");
    const r = await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT });
    if (!r.ok) throw new Error("chargement en échec");
    expect(r.tableau?.visites).toBe(0);
    expect(r.tableau?.pages).toEqual([]);
  });

  it("rend ok: false quand D1 échoue, sans lever, et journalise l'échec", async () => {
    // Aucune migration : les tables n'existent pas.
    const { db } = d1Sqlite([]);
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT }),
    ).resolves.toEqual({ ok: false });
    expect(espion).toHaveBeenCalledOnce();
    espion.mockRestore();
  });

  it("note les vitaux du seul site demandé", async () => {
    const { db } = d1Sqlite();
    const vitaux = (lcpBon: number, lcpMauvais: number) => [
      {
        appareil: "mobile" as const,
        lcp: { bon: lcpBon, moyen: 0, mauvais: lcpMauvais },
        inp: { bon: 0, moyen: 0, mauvais: 0 },
        cls: { bon: 0, moyen: 0, mauvais: 0 },
      },
    ];
    await ecrireJour(
      db,
      "2026-09-28",
      [
        { ...mesure(SITE, "2026-09-28"), vitaux: vitaux(20, 0) },
        { ...mesure(AUTRE, "2026-09-28"), vitaux: vitaux(0, 50) },
      ],
      "2026-09-29T04:05:00.000Z",
    );
    const r = await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT });
    if (!r.ok) throw new Error("chargement en échec");
    expect(r.tableau?.vitesse?.lcp.global).toEqual({ note: "bon", mesures: 20, partBonne: 1 });
  });

  it("sans la table analytics_vitaux, la page passe en « indisponible » sans lever", async () => {
    // Le code publié avant la migration 0012 : la mise en service doit l'appliquer d'abord.
    const { db } = d1Sqlite(["0011_analytics.sql"]);
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT }),
    ).resolves.toEqual({ ok: false });
    espion.mockRestore();
  });
});
