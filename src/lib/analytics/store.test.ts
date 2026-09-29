import { beforeEach, describe, expect, it } from "vitest";
import { d1Sqlite } from "./d1-sqlite.testutil";
import {
  ecrireJour,
  etatCollecte,
  lireCollectes,
  lireJours,
  lireRepartitions,
  type D1Analytics,
} from "./store";
import type { JourAnalytics } from "./types";

const SITE = "7257179f83b6445d93703f1d1f305a4a";
const AUTRE = "2ad7fb260e2a498a900a5d97d41b6853";
const COLLECTE = "2026-09-29T04:05:00.000Z";

function mesure(jour: string, p: Partial<JourAnalytics> = {}): JourAnalytics {
  return {
    siteTag: SITE,
    jour,
    visites: 3,
    pagesVues: 5,
    echantillon: 1,
    pages: [
      { valeur: "/", visites: 2, pagesVues: 3 },
      { valeur: "/contact", visites: 1, pagesVues: 2 },
    ],
    provenances: [{ valeur: "", visites: 3, pagesVues: 5 }],
    appareils: [{ valeur: "mobile", visites: 3, pagesVues: 5 }],
    ...p,
  };
}

const pagesDe = async (db: D1Analytics, siteTag: string, du: string, au: string) =>
  (await lireRepartitions(db, siteTag, du, au))
    .filter((r) => r.dimension === "page")
    .sort((a, b) => a.valeur.localeCompare(b.valeur));

describe("store analytics (D1)", () => {
  let db: D1Analytics;
  beforeEach(() => {
    ({ db } = d1Sqlite());
  });

  it("écrit un jour et le relit", async () => {
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28")], COLLECTE);
    expect(await lireJours(db, SITE, "2026-09-01", "2026-09-30")).toEqual([
      { jour: "2026-09-28", visites: 3, pagesVues: 5, echantillon: 1 },
    ]);
    expect(await lireCollectes(db, "2026-09-01", "2026-09-30")).toEqual(["2026-09-28"]);
  });

  it("réécrire un jour efface les pages qui n'ont plus de visite", async () => {
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28")], COLLECTE);
    await ecrireJour(
      db,
      "2026-09-28",
      [mesure("2026-09-28", { pages: [{ valeur: "/", visites: 2, pagesVues: 3 }] })],
      "2026-09-30T04:05:00.000Z",
    );
    expect(await pagesDe(db, SITE, "2026-09-28", "2026-09-28")).toEqual([
      { dimension: "page", valeur: "/", visites: 2, pagesVues: 3 },
    ]);
  });

  it("réécrire un jour laisse les autres jours intacts", async () => {
    await ecrireJour(db, "2026-09-27", [mesure("2026-09-27")], COLLECTE);
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28")], COLLECTE);
    await ecrireJour(db, "2026-09-28", [], COLLECTE);
    expect(await lireJours(db, SITE, "2026-09-01", "2026-09-30")).toEqual([
      { jour: "2026-09-27", visites: 3, pagesVues: 5, echantillon: 1 },
    ]);
  });

  it("enregistre un jour collecté sans trafic", async () => {
    await ecrireJour(db, "2026-09-27", [], COLLECTE);
    expect(await lireJours(db, SITE, "2026-09-01", "2026-09-30")).toEqual([]);
    expect(await lireCollectes(db, "2026-09-01", "2026-09-30")).toEqual(["2026-09-27"]);
  });

  it("additionne les répartitions sur la période, pour le seul site demandé", async () => {
    await ecrireJour(
      db,
      "2026-09-27",
      [mesure("2026-09-27"), mesure("2026-09-27", { siteTag: AUTRE })],
      COLLECTE,
    );
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28")], COLLECTE);
    expect(await pagesDe(db, SITE, "2026-09-27", "2026-09-28")).toEqual([
      { dimension: "page", valeur: "/", visites: 4, pagesVues: 6 },
      { dimension: "page", valeur: "/contact", visites: 2, pagesVues: 4 },
    ]);
  });

  it("donne le premier jour collecté et l'heure de la dernière collecte", async () => {
    expect(await etatCollecte(db)).toEqual({ premierJour: null, derniereCollecte: null });
    await ecrireJour(db, "2026-09-28", [], "2026-09-29T04:05:00.000Z");
    await ecrireJour(db, "2026-09-22", [], "2026-09-29T04:05:01.000Z");
    expect(await etatCollecte(db)).toEqual({
      premierJour: "2026-09-22",
      derniereCollecte: "2026-09-29T04:05:01.000Z",
    });
  });
});
