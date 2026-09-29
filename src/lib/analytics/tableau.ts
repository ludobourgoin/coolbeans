// Ce que la page Analytics affiche (spec 2026-09-29-portail-analytics-design.md §5).
//
// `construireTableau` est pure : elle reçoit les lignes lues dans D1 et rend
// les totaux, les barres du graphique et les trois classements.
// `chargerTableau` fait les lectures et ne lève jamais : une base en panne
// donne un état vide sur la page, pas une 500.

import {
  etatCollecte,
  lireCollectes,
  lireJours,
  lireRepartitions,
  type D1Analytics,
  type LigneJour,
  type LigneRepartition,
} from "./store";
import type { Dimension, SiteAnalytics } from "./types";

export type Periode = "30j" | "6m";

export const DUREE_JOURS: Record<Periode, number> = { "30j": 30, "6m": 182 };

export function lirePeriode(valeur: string | null): Periode {
  return valeur === "6m" ? "6m" : "30j";
}

/**
 * Le site demandé s'il appartient au client, sinon son premier site. Le
 * paramètre d'URL est un host cherché dans la liste du client : aucune valeur
 * venue de l'URL ne peut désigner le site d'un autre client.
 */
export function choisirSite(sites: SiteAnalytics[], host: string | null): SiteAnalytics | null {
  return sites.find((s) => s.host === host) ?? sites[0] ?? null;
}

function decaler(jour: string, jours: number): string {
  const date = new Date(`${jour}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

/** Fenêtre de la période : se termine à J-1 (UTC), dernier jour complet. */
export function fenetre(periode: Periode, maintenant: Date): { du: string; au: string } {
  const au = decaler(maintenant.toISOString().slice(0, 10), -1);
  return { du: decaler(au, -(DUREE_JOURS[periode] - 1)), au };
}

/** Lundi (UTC) de la semaine d'un jour. */
export function lundiDe(jour: string): string {
  const depuisLundi = (new Date(`${jour}T00:00:00Z`).getUTCDay() + 6) % 7;
  return decaler(jour, -depuisLundi);
}

export interface Barre {
  /** Jour de la barre, ou lundi de la semaine sur 6 mois. */
  debut: string;
  visites: number;
  pagesVues: number;
}

export interface Classement {
  libelle: string;
  valeur: number;
  /** Part du total de la liste, entre 0 et 1. */
  part: number;
}

export interface Tableau {
  visites: number;
  pagesVues: number;
  barres: Barre[];
  pages: Classement[];
  provenances: Classement[];
  appareils: Classement[];
  /** Vrai si un jour de la période n'est pas exact (`echantillon > 1`). */
  estime: boolean;
}

const LIBELLES_APPAREILS: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Ordinateur",
  tablet: "Tablette",
  autre: "Autre",
};

function classer(
  lignes: LigneRepartition[],
  mesure: "visites" | "pagesVues",
  limite: number,
  libeller: (valeur: string) => string,
): Classement[] {
  const total = lignes.reduce((somme, l) => somme + l[mesure], 0);
  return lignes
    .filter((l) => l[mesure] > 0)
    .sort((a, b) => b[mesure] - a[mesure] || a.valeur.localeCompare(b.valeur))
    .slice(0, limite)
    .map((l) => ({
      libelle: libeller(l.valeur),
      valeur: l[mesure],
      part: total === 0 ? 0 : l[mesure] / total,
    }));
}

export function construireTableau(o: {
  periode: Periode;
  jours: LigneJour[];
  repartitions: LigneRepartition[];
  collectes: string[];
}): Tableau {
  const parJour = new Map(o.jours.map((j) => [j.jour, j]));
  let visites = 0;
  let pagesVues = 0;
  let estime = false;
  const barres: Barre[] = [];

  // Seuls les jours collectés comptent : un jour collecté sans trafic vaut 0,
  // un jour jamais collecté n'a pas de barre.
  for (const jour of [...o.collectes].sort()) {
    const ligne = parJour.get(jour);
    const v = ligne?.visites ?? 0;
    const p = ligne?.pagesVues ?? 0;
    visites += v;
    pagesVues += p;
    if ((ligne?.echantillon ?? 1) > 1) estime = true;

    const debut = o.periode === "6m" ? lundiDe(jour) : jour;
    const derniere = barres.at(-1);
    if (derniere && derniere.debut === debut) {
      derniere.visites += v;
      derniere.pagesVues += p;
    } else {
      barres.push({ debut, visites: v, pagesVues: p });
    }
  }

  const de = (dimension: Dimension) => o.repartitions.filter((r) => r.dimension === dimension);
  return {
    visites,
    pagesVues,
    barres,
    estime,
    pages: classer(de("page"), "pagesVues", 10, (v) => v),
    provenances: classer(de("provenance"), "visites", 10, (v) => (v === "" ? "Accès direct" : v)),
    appareils: classer(de("appareil"), "visites", Infinity, (v) => LIBELLES_APPAREILS[v] ?? v),
  };
}

export type Chargement =
  | { ok: true; depuis: string | null; derniereCollecte: string | null; tableau: Tableau | null }
  | { ok: false };

export async function chargerTableau(
  db: D1Analytics,
  o: { siteTag: string; periode: Periode; maintenant: Date },
): Promise<Chargement> {
  try {
    const { du, au } = fenetre(o.periode, o.maintenant);
    const [etat, collectes, jours, repartitions] = await Promise.all([
      etatCollecte(db),
      lireCollectes(db, du, au),
      lireJours(db, o.siteTag, du, au),
      lireRepartitions(db, o.siteTag, du, au),
    ]);
    return {
      ok: true,
      depuis: etat.premierJour,
      derniereCollecte: etat.derniereCollecte,
      tableau:
        collectes.length === 0
          ? null
          : construireTableau({ periode: o.periode, jours, repartitions, collectes }),
    };
  } catch {
    return { ok: false };
  }
}
