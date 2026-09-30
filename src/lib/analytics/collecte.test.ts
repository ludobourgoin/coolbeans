import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Sqlite } from "./d1-sqlite.testutil";
import { collecterAnalytics, estHeureDeCollecte, joursACollecter } from "./collecte";
import { sourceCloudflare, type ReponseJour } from "./cloudflare";
import { ecrireJour, lireCollectes, lireJours, lireVitaux, type D1Analytics } from "./store";
import type { JourAnalytics, SourceAnalytics } from "./types";

const SITE = "7257179f83b6445d93703f1d1f305a4a";
const MAINTENANT = new Date("2026-09-29T04:05:00Z");
const TOUT = ["2000-01-01", "2100-01-01"] as const;

const mesure = (jour: string): JourAnalytics => ({
  siteTag: SITE,
  jour,
  visites: 1,
  pagesVues: 2,
  echantillon: 1,
  pages: [{ valeur: "/", visites: 1, pagesVues: 2 }],
  provenances: [],
  appareils: [],
  vitaux: [],
});

describe("joursACollecter", () => {
  it("rend J-1 à J-7 en UTC, du plus récent au plus ancien", () => {
    expect(joursACollecter(MAINTENANT)).toEqual([
      "2026-09-28",
      "2026-09-27",
      "2026-09-26",
      "2026-09-25",
      "2026-09-24",
      "2026-09-23",
      "2026-09-22",
    ]);
  });

  it("franchit la fin de février", () => {
    expect(joursACollecter(new Date("2026-03-01T04:05:00Z"))).toEqual([
      "2026-02-28",
      "2026-02-27",
      "2026-02-26",
      "2026-02-25",
      "2026-02-24",
      "2026-02-23",
      "2026-02-22",
    ]);
  });

  it("franchit le changement d'année", () => {
    const jours = joursACollecter(new Date("2027-01-01T04:05:00Z"));
    expect(jours[0]).toBe("2026-12-31");
    expect(jours[6]).toBe("2026-12-25");
  });
});

describe("estHeureDeCollecte", () => {
  it("ne retient que le second passage de 04:00 UTC", () => {
    expect(estHeureDeCollecte(new Date("2026-09-29T04:05:00Z"))).toBe(true);
    expect(estHeureDeCollecte(new Date("2026-09-29T04:09:59Z"))).toBe(true);
    expect(estHeureDeCollecte(new Date("2026-09-29T04:00:00Z"))).toBe(false);
    expect(estHeureDeCollecte(new Date("2026-09-29T04:10:00Z"))).toBe(false);
    expect(estHeureDeCollecte(new Date("2026-09-29T05:05:00Z"))).toBe(false);
    expect(estHeureDeCollecte(new Date("2026-09-29T03:05:00Z"))).toBe(false);
  });
});

describe("collecterAnalytics", () => {
  let db: D1Analytics;
  beforeEach(() => {
    ({ db } = d1Sqlite());
  });

  const VITAUX = [
    { appareil: "mobile" as const, lcp: { bon: 2, moyen: 0, mauvais: 0 }, inp: { bon: 1, moyen: 0, mauvais: 0 }, cls: { bon: 2, moyen: 0, mauvais: 0 } },
  ];

  it("écrit les vitaux avec le reste du jour", async () => {
    const source: SourceAnalytics = async (jour) => [{ ...mesure(jour), vitaux: VITAUX }];
    await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(await lireVitaux(db, SITE, "2026-09-28", "2026-09-28")).toEqual(VITAUX);
  });

  it("garde les vitaux exacts d'un jour déjà collecté face à une lecture échantillonnée", async () => {
    const jour = "2026-09-25";
    await ecrireJour(db, jour, [{ ...mesure(jour), vitaux: VITAUX }], "2026-09-28T04:05:00.000Z");
    const estimes = [{ ...VITAUX[0], lcp: { bon: 0, moyen: 0, mauvais: 90 } }];
    const source: SourceAnalytics = async (j) =>
      j === jour ? [{ ...mesure(j), echantillon: 10, vitaux: estimes }] : [mesure(j)];
    await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(await lireVitaux(db, SITE, jour, jour)).toEqual(VITAUX);
  });

  it("interroge les sept jours exacts, du plus ancien au plus récent", async () => {
    // J-7 en premier : lui seul n'est jamais retenté à un passage suivant, il
    // doit donc être collecté avant qu'un éventuel plafond de subrequests
    // n'interrompe la boucle.
    const source = vi.fn<SourceAnalytics>(async (jour) => [mesure(jour)]);
    const r = await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    const ordreAttendu = [...joursACollecter(MAINTENANT)].reverse();
    expect(source.mock.calls.map(([jour]) => jour)).toEqual(ordreAttendu);
    expect(r).toEqual({ collectes: ordreAttendu, echecs: [] });
    expect(await lireCollectes(db, ...TOUT)).toEqual([...joursACollecter(MAINTENANT)].sort());
  });

  it("n'écrit jamais un jour antérieur à J-7, même si la source en rend", async () => {
    // Garde-fou contre un adaptateur qui rendrait autre chose que le jour demandé.
    const source: SourceAnalytics = async (jour) => [mesure(jour), mesure("2026-01-01")];
    await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(await lireJours(db, SITE, "2000-01-01", "2026-09-21")).toEqual([]);
    expect(await lireJours(db, SITE, ...TOUT)).toHaveLength(7);
  });

  it("un jour en échec n'empêche pas les autres", async () => {
    const source: SourceAnalytics = async (jour) => {
      if (jour === "2026-09-25") throw new Error("Cloudflare GraphQL, HTTP 500");
      return [mesure(jour)];
    };
    const r = await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(r.echecs).toEqual([{ jour: "2026-09-25", message: "Cloudflare GraphQL, HTTP 500" }]);
    expect(r.collectes).toHaveLength(6);
    expect(await lireCollectes(db, ...TOUT)).not.toContain("2026-09-25");
  });

  it("relancer la collecte ne double rien", async () => {
    const source: SourceAnalytics = async (jour) => [mesure(jour)];
    await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(await lireJours(db, SITE, ...TOUT)).toHaveLength(7);
  });

  it("ne réécrit jamais un jour déjà collecté avec une lecture échantillonnée", async () => {
    const jour = "2026-09-25";
    await ecrireJour(db, jour, [mesure(jour)], "2026-09-28T04:05:00.000Z");
    const source: SourceAnalytics = async (j) =>
      j === jour ? [{ ...mesure(j), visites: 999, echantillon: 10 }] : [mesure(j)];
    const r = await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(r.echecs).toEqual([
      { jour, message: "lecture échantillonnée, chiffres précédents conservés" },
    ]);
    expect(r.collectes).not.toContain(jour);
    // Les chiffres exacts déjà en base n'ont pas bougé.
    expect(await lireJours(db, SITE, jour, jour)).toEqual([
      { jour, visites: 1, pagesVues: 2, echantillon: 1 },
    ]);
  });

  it("garde les vitaux exacts quand l'API rend des vitaux échantillonnés, de la réponse à D1", async () => {
    const jour = "2026-09-25";
    await ecrireJour(db, jour, [{ ...mesure(jour), vitaux: VITAUX }], "2026-09-28T04:05:00.000Z");

    // Réponse GraphQL brute : trafic exact (sampleInterval 1), vitaux
    // échantillonnés (sampleInterval 10) pour ce même site et ce même jour.
    const reponse: ReponseJour = {
      totaux: [{ avg: { sampleInterval: 1 }, count: 2, dimensions: { siteTag: SITE }, sum: { visits: 1 } }],
      pages: [],
      provenances: [],
      appareils: [],
      vitaux: [
        {
          avg: { sampleInterval: 10 },
          sum: {
            lcpGood: 0,
            lcpNeedsImprovement: 0,
            lcpPoor: 90,
            inpGood: 0,
            inpNeedsImprovement: 0,
            inpPoor: 0,
            clsGood: 0,
            clsNeedsImprovement: 0,
            clsPoor: 0,
          },
          dimensions: { siteTag: SITE, deviceType: "mobile" },
        },
      ],
    };
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { viewer: { accounts: [reponse] } }, errors: null })),
    );
    const source = sourceCloudflare({ token: "t", compte: "c", fetch });

    const r = await collecterAnalytics({ db, source, maintenant: MAINTENANT });

    expect(r.echecs).toContainEqual({
      jour,
      message: "lecture échantillonnée, chiffres précédents conservés",
    });
    expect(await lireVitaux(db, SITE, jour, jour)).toEqual(VITAUX);
  });

  it("écrit quand même un jour jamais collecté, même si la lecture est échantillonnée", async () => {
    const jour = "2026-09-25";
    const source: SourceAnalytics = async (j) =>
      j === jour ? [{ ...mesure(j), visites: 999, echantillon: 10 }] : [mesure(j)];
    const r = await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(r.echecs).toEqual([]);
    expect(r.collectes).toContain(jour);
    expect(await lireJours(db, SITE, jour, jour)).toEqual([
      { jour, visites: 999, pagesVues: 2, echantillon: 10 },
    ]);
  });
});
