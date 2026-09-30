// Stockage D1 des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3.3,
// Core Web Vitals, spec 2026-09-30-portail-core-web-vitals-design.md §3.4).
//
// Un jour s'écrit d'un bloc, dans un seul `batch` : on efface tout ce qu'on
// savait de ce jour, puis on réécrit. Une page qui n'a plus de visite ce
// jour-là disparaît donc aussi, ce qu'un INSERT OR REPLACE ne ferait pas. Et
// un seul batch par jour tient la collecte loin du plafond de 50 requêtes par
// exécution du plan Workers Free.

import type { Appareil, Dimension, JourAnalytics, VitauxAppareil } from "./types";

/** Sous-ensemble de l'API D1 utilisé ici. `env.PORTAL_DB` le satisfait. */
export interface D1Statement {
  bind(...valeurs: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface D1Analytics {
  prepare(sql: string): D1Statement;
  batch(instructions: D1Statement[]): Promise<unknown>;
}

export interface LigneJour {
  jour: string;
  visites: number;
  pagesVues: number;
  echantillon: number;
}

export interface LigneRepartition {
  dimension: Dimension;
  valeur: string;
  visites: number;
  pagesVues: number;
}

const DIMENSIONS = [
  ["page", "pages"],
  ["provenance", "provenances"],
  ["appareil", "appareils"],
] as const;

export async function ecrireJour(
  db: D1Analytics,
  jour: string,
  sites: JourAnalytics[],
  collecteLe: string,
): Promise<void> {
  const instructions: D1Statement[] = [
    db.prepare("DELETE FROM analytics_jours WHERE jour = ?").bind(jour),
    db.prepare("DELETE FROM analytics_repartitions WHERE jour = ?").bind(jour),
    db.prepare("DELETE FROM analytics_vitaux WHERE jour = ?").bind(jour),
  ];
  for (const site of sites) {
    instructions.push(
      db
        .prepare(
          "INSERT INTO analytics_jours (site_tag, jour, visites, pages_vues, echantillon) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(site.siteTag, jour, site.visites, site.pagesVues, site.echantillon),
    );
    for (const [dimension, cle] of DIMENSIONS) {
      for (const ligne of site[cle]) {
        instructions.push(
          db
            .prepare(
              "INSERT INTO analytics_repartitions (site_tag, jour, dimension, valeur, visites, pages_vues) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(site.siteTag, jour, dimension, ligne.valeur, ligne.visites, ligne.pagesVues),
        );
      }
    }
    for (const v of site.vitaux) {
      instructions.push(
        db
          .prepare(
            "INSERT INTO analytics_vitaux (site_tag, jour, appareil, lcp_bon, lcp_moyen, lcp_mauvais, inp_bon, inp_moyen, inp_mauvais, cls_bon, cls_moyen, cls_mauvais) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            site.siteTag,
            jour,
            v.appareil,
            v.lcp.bon,
            v.lcp.moyen,
            v.lcp.mauvais,
            v.inp.bon,
            v.inp.moyen,
            v.inp.mauvais,
            v.cls.bon,
            v.cls.moyen,
            v.cls.mauvais,
          ),
      );
    }
  }
  instructions.push(
    db
      .prepare("INSERT OR REPLACE INTO analytics_collectes (jour, collecte_le) VALUES (?, ?)")
      .bind(jour, collecteLe),
  );
  await db.batch(instructions);
}

export async function lireJours(
  db: D1Analytics,
  siteTag: string,
  du: string,
  au: string,
): Promise<LigneJour[]> {
  const { results } = await db
    .prepare(
      "SELECT jour, visites, pages_vues AS pagesVues, echantillon FROM analytics_jours WHERE site_tag = ? AND jour BETWEEN ? AND ? ORDER BY jour",
    )
    .bind(siteTag, du, au)
    .all<LigneJour>();
  return results;
}

/** Répartitions sommées sur la période : une ligne par (dimension, valeur). */
export async function lireRepartitions(
  db: D1Analytics,
  siteTag: string,
  du: string,
  au: string,
): Promise<LigneRepartition[]> {
  const { results } = await db
    .prepare(
      "SELECT dimension, valeur, SUM(visites) AS visites, SUM(pages_vues) AS pagesVues FROM analytics_repartitions WHERE site_tag = ? AND jour BETWEEN ? AND ? GROUP BY dimension, valeur",
    )
    .bind(siteTag, du, au)
    .all<LigneRepartition>();
  return results;
}

interface LigneVitaux {
  appareil: Appareil;
  lcpBon: number;
  lcpMoyen: number;
  lcpMauvais: number;
  inpBon: number;
  inpMoyen: number;
  inpMauvais: number;
  clsBon: number;
  clsMoyen: number;
  clsMauvais: number;
}

/** Vitaux sommés sur la période, une entrée par appareil mesuré, triés par appareil. */
export async function lireVitaux(
  db: D1Analytics,
  siteTag: string,
  du: string,
  au: string,
): Promise<VitauxAppareil[]> {
  const { results } = await db
    .prepare(
      "SELECT appareil, SUM(lcp_bon) AS lcpBon, SUM(lcp_moyen) AS lcpMoyen, SUM(lcp_mauvais) AS lcpMauvais, SUM(inp_bon) AS inpBon, SUM(inp_moyen) AS inpMoyen, SUM(inp_mauvais) AS inpMauvais, SUM(cls_bon) AS clsBon, SUM(cls_moyen) AS clsMoyen, SUM(cls_mauvais) AS clsMauvais FROM analytics_vitaux WHERE site_tag = ? AND jour BETWEEN ? AND ? GROUP BY appareil ORDER BY appareil",
    )
    .bind(siteTag, du, au)
    .all<LigneVitaux>();
  return results.map((r) => ({
    appareil: r.appareil,
    lcp: { bon: r.lcpBon, moyen: r.lcpMoyen, mauvais: r.lcpMauvais },
    inp: { bon: r.inpBon, moyen: r.inpMoyen, mauvais: r.inpMauvais },
    cls: { bon: r.clsBon, moyen: r.clsMoyen, mauvais: r.clsMauvais },
  }));
}

/** Jours collectés dans la fenêtre, triés du plus ancien au plus récent. */
export async function lireCollectes(db: D1Analytics, du: string, au: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT jour FROM analytics_collectes WHERE jour BETWEEN ? AND ? ORDER BY jour")
    .bind(du, au)
    .all<{ jour: string }>();
  return results.map((r) => r.jour);
}

export async function etatCollecte(
  db: D1Analytics,
): Promise<{ premierJour: string | null; derniereCollecte: string | null }> {
  const { results } = await db
    .prepare(
      "SELECT MIN(jour) AS premierJour, MAX(collecte_le) AS derniereCollecte FROM analytics_collectes",
    )
    .all<{ premierJour: string | null; derniereCollecte: string | null }>();
  return results[0] ?? { premierJour: null, derniereCollecte: null };
}
