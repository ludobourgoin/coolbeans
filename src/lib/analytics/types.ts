// Format commun des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3).
//
// L'adaptateur Cloudflare le produit ; la collecte, le stockage et la page ne
// connaissent que lui. Passer à Umami ou Plausible revient à écrire un autre
// adaptateur qui rend ce même format.

export type Dimension = "page" | "provenance" | "appareil";

/** Type d'appareil tel que la collecte le range : tout type inconnu tombe dans « autre ». */
export type Appareil = "mobile" | "desktop" | "tablet" | "autre";

/** Les trois Core Web Vitals que Google note (spec 2026-09-30-portail-core-web-vitals-design.md). */
export type Metrique = "lcp" | "inp" | "cls";

export const METRIQUES: readonly Metrique[] = ["lcp", "inp", "cls"];

/** Mesures d'une métrique, comptées par note de Google. */
export interface Compteurs {
  bon: number;
  /** « Needs improvement » chez Cloudflare, « À améliorer » à l'écran. */
  moyen: number;
  mauvais: number;
}

/** Core Web Vitals d'un site sur un type d'appareil, pour un jour ou une période. */
export interface VitauxAppareil {
  appareil: Appareil;
  lcp: Compteurs;
  inp: Compteurs;
  cls: Compteurs;
}

export interface Ligne {
  valeur: string;
  visites: number;
  pagesVues: number;
}

export interface JourAnalytics {
  siteTag: string;
  /** AAAA-MM-JJ, jour UTC. */
  jour: string;
  visites: number;
  pagesVues: number;
  /** Taux d'échantillonnage du jour : 1 = exact, 10 = une mesure sur dix. */
  echantillon: number;
  pages: Ligne[];
  provenances: Ligne[];
  appareils: Ligne[];
  /** Core Web Vitals du jour, une entrée par appareil qui a au moins une mesure. */
  vitaux: VitauxAppareil[];
}

/** Rend les mesures de tous les sites du compte pour un jour UTC. */
export type SourceAnalytics = (jour: string) => Promise<JourAnalytics[]>;

/** Un site mesuré, tel que le déclare le registre des clients. */
export interface SiteAnalytics {
  host: string;
  siteTag: string;
}
