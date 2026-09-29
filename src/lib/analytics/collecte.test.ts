import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Sqlite } from "./d1-sqlite.testutil";
import { collecterAnalytics, estHeureDeCollecte, joursACollecter } from "./collecte";
import { lireCollectes, lireJours, type D1Analytics } from "./store";
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

  it("interroge les sept jours exacts, et seulement eux", async () => {
    const source = vi.fn<SourceAnalytics>(async (jour) => [mesure(jour)]);
    const r = await collecterAnalytics({ db, source, maintenant: MAINTENANT });
    expect(source.mock.calls.map(([jour]) => jour)).toEqual(joursACollecter(MAINTENANT));
    expect(r).toEqual({ collectes: joursACollecter(MAINTENANT), echecs: [] });
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
});
