// Format commun des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3).
//
// L'adaptateur Cloudflare le produit ; la collecte, le stockage et la page ne
// connaissent que lui. Passer à Umami ou Plausible revient à écrire un autre
// adaptateur qui rend ce même format.

export type Dimension = "page" | "provenance" | "appareil";

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
}

/** Rend les mesures de tous les sites du compte pour un jour UTC. */
export type SourceAnalytics = (jour: string) => Promise<JourAnalytics[]>;

/** Un site mesuré, tel que le déclare le registre des clients. */
export interface SiteAnalytics {
  host: string;
  siteTag: string;
}
