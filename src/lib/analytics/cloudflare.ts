// Adaptateur Cloudflare Web Analytics (spec 2026-09-29-portail-analytics-design.md §3.1,
// Core Web Vitals : spec 2026-09-30-portail-core-web-vitals-design.md §3.2 et §3.3).
//
// Seul fichier du module qui connaît Cloudflare. Il interroge l'API GraphQL
// pour UN jour à la fois : c'est la seule façon d'obtenir des chiffres exacts.
// Sur une fenêtre de plusieurs jours, ou au-delà de sept jours, l'API ne garde
// qu'une mesure sur dix (sondes du 2026-09-29, `avg.sampleInterval` = 10).
//
// La requête ne filtre aucun site : une seule interrogation du compte rend tous
// les sites enregistrés. La collecte n'a donc pas besoin du registre clients.
// Les Core Web Vitals voyagent dans la même requête : aucun appel de plus sur
// le budget de 50 du plan Workers Free.

import {
  METRIQUES,
  type Appareil,
  type Compteurs,
  type JourAnalytics,
  type Ligne,
  type SourceAnalytics,
  type VitauxAppareil,
} from "./types";

export const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

// La page n'affiche que le top 10 : ce plafond n'appauvrit pas l'affichage,
// il borne les écritures D1 si un robot inonde un site (le jeton du snippet
// posé sur la page est public, donc rejouable).
export const LIGNES_MAX = 100;

const TYPES_APPAREILS = new Set(["mobile", "desktop", "tablet"]);

/**
 * Tout ce que Cloudflare ne range pas dans mobile, desktop ou tablet (vide,
 * « smarttv », un futur type d'appareil) tombe dans « autre », pour que les
 * lignes fusionnent au lieu de se disperser.
 */
function normaliserAppareil(valeur: string): Appareil {
  return TYPES_APPAREILS.has(valeur) ? (valeur as Appareil) : "autre";
}

// Le cron tourne sans surveillance : une requête qui pend indéfiniment
// bloquerait les jours suivants jusqu'à la limite CPU du Worker.
export const DELAI_GRAPHQL_MS = 10_000;

export const REQUETE_JOUR = `query ($compte: String!, $jour: Date!) {
  viewer {
    accounts(filter: { accountTag: $compte }) {
      totaux: rumPageloadEventsAdaptiveGroups(limit: 1000, filter: { date_geq: $jour, date_leq: $jour }) {
        count
        sum { visits }
        avg { sampleInterval }
        dimensions { siteTag }
      }
      pages: rumPageloadEventsAdaptiveGroups(limit: 5000, orderBy: [count_DESC], filter: { date_geq: $jour, date_leq: $jour }) {
        count
        sum { visits }
        dimensions { siteTag requestPath }
      }
      provenances: rumPageloadEventsAdaptiveGroups(limit: 5000, orderBy: [sum_visits_DESC], filter: { date_geq: $jour, date_leq: $jour }) {
        count
        sum { visits }
        dimensions { siteTag refererHost }
      }
      appareils: rumPageloadEventsAdaptiveGroups(limit: 1000, filter: { date_geq: $jour, date_leq: $jour }) {
        count
        sum { visits }
        dimensions { siteTag deviceType }
      }
      vitaux: rumWebVitalsEventsAdaptiveGroups(limit: 1000, filter: { date_geq: $jour, date_leq: $jour }) {
        avg { sampleInterval }
        sum { lcpGood lcpNeedsImprovement lcpPoor inpGood inpNeedsImprovement inpPoor clsGood clsNeedsImprovement clsPoor }
        dimensions { siteTag deviceType }
      }
    }
  }
}`;

interface Groupe {
  count: number;
  sum: { visits: number };
  avg?: { sampleInterval: number };
  dimensions: Record<string, string | undefined>;
}

/** Un groupe du jeu rumWebVitalsEventsAdaptiveGroups : un site, un type d'appareil. */
export interface GroupeVitaux {
  avg?: { sampleInterval: number };
  sum: {
    lcpGood: number;
    lcpNeedsImprovement: number;
    lcpPoor: number;
    inpGood: number;
    inpNeedsImprovement: number;
    inpPoor: number;
    clsGood: number;
    clsNeedsImprovement: number;
    clsPoor: number;
  };
  dimensions: { siteTag?: string; deviceType?: string };
}

export interface ReponseJour {
  totaux: Groupe[];
  pages: Groupe[];
  provenances: Groupe[];
  appareils: Groupe[];
  vitaux: GroupeVitaux[];
}

/** Ajoute une ligne, ou la cumule avec celle qui porte déjà la même valeur. */
function cumuler(lignes: Ligne[], valeur: string, visites: number, pagesVues: number): void {
  const existante = lignes.find((l) => l.valeur === valeur);
  if (existante) {
    existante.visites += visites;
    existante.pagesVues += pagesVues;
    return;
  }
  lignes.push({ valeur, visites, pagesVues });
}

const totalDe = (c: Compteurs): number => c.bon + c.moyen + c.mauvais;

/** Ajoute les vitaux d'un appareil, ou les cumule avec ceux du même appareil. */
function cumulerVitaux(vitaux: VitauxAppareil[], ajout: VitauxAppareil): void {
  const existant = vitaux.find((v) => v.appareil === ajout.appareil);
  if (!existant) {
    vitaux.push(ajout);
    return;
  }
  for (const m of METRIQUES) {
    existant[m].bon += ajout[m].bon;
    existant[m].moyen += ajout[m].moyen;
    existant[m].mauvais += ajout[m].mauvais;
  }
}

export function normaliserJour(jour: string, reponse: ReponseJour): JourAnalytics[] {
  const parSite = new Map<string, JourAnalytics>();
  const nouveauSite = (
    siteTag: string,
    visites: number,
    pagesVues: number,
    echantillon: number,
  ): JourAnalytics => ({
    siteTag,
    jour,
    visites,
    pagesVues,
    echantillon,
    pages: [],
    provenances: [],
    appareils: [],
    vitaux: [],
  });

  for (const g of reponse.totaux) {
    const siteTag = g.dimensions.siteTag;
    if (!siteTag) continue;
    parSite.set(
      siteTag,
      // Une moyenne fractionnaire (1,5) veut dire qu'une partie du jour est
      // estimée : on arrondit au-dessus pour ne jamais la faire passer pour exacte.
      nouveauSite(siteTag, g.sum.visits, g.count, Math.max(1, Math.ceil(g.avg?.sampleInterval ?? 1))),
    );
  }

  const repartir = (
    groupes: Groupe[],
    cible: "pages" | "provenances" | "appareils",
    dimension: string,
    normaliser: (valeur: string) => string,
  ) => {
    for (const g of groupes) {
      const site = parSite.get(g.dimensions.siteTag ?? "");
      if (!site) continue;
      cumuler(site[cible], normaliser(g.dimensions[dimension] ?? ""), g.sum.visits, g.count);
    }
  };
  repartir(reponse.pages, "pages", "requestPath", (v) => v || "/");
  // Une provenance égale au site lui-même est de la navigation interne :
  // Cloudflare lui compte 0 visite. Elle n'a rien à faire dans « Provenance ».
  repartir(
    reponse.provenances.filter((g) => g.sum.visits > 0),
    "provenances",
    "refererHost",
    (v) => v,
  );
  repartir(reponse.appareils, "appareils", "deviceType", normaliserAppareil);

  // Le classement plafonne les lignes par site et par dimension, après la
  // fusion des doublons : la page n'affiche jamais plus que le top 10, ce
  // plafond ne fait que borner les écritures D1.
  const plafonner = (lignes: Ligne[], mesure: "visites" | "pagesVues"): void => {
    lignes.sort((a, b) => b[mesure] - a[mesure] || a.valeur.localeCompare(b.valeur));
    lignes.length = Math.min(lignes.length, LIGNES_MAX);
  };
  for (const site of parSite.values()) {
    plafonner(site.pages, "pagesVues");
    plafonner(site.provenances, "visites");
    plafonner(site.appareils, "visites");
  }

  // Core Web Vitals, après les répartitions : un site créé ici n'a pas de
  // pages, de provenances ni d'appareils à recevoir.
  for (const g of reponse.vitaux) {
    const siteTag = g.dimensions.siteTag;
    if (!siteTag) continue;
    const s = g.sum;
    const vitaux: VitauxAppareil = {
      appareil: normaliserAppareil(g.dimensions.deviceType ?? ""),
      lcp: { bon: s.lcpGood, moyen: s.lcpNeedsImprovement, mauvais: s.lcpPoor },
      inp: { bon: s.inpGood, moyen: s.inpNeedsImprovement, mauvais: s.inpPoor },
      cls: { bon: s.clsGood, moyen: s.clsNeedsImprovement, mauvais: s.clsPoor },
    };
    // Un groupe qui ne porte que FCP ou TTFB n'a rien à écrire.
    if (METRIQUES.every((m) => totalDe(vitaux[m]) === 0)) continue;
    // Un site peut avoir des vitaux sans aucun chargement de page le même jour
    // (Rév'olutions Douces le 2026-09-29) : il reçoit une entrée à 0 visite
    // plutôt que de perdre ses mesures.
    let site = parSite.get(siteTag);
    if (!site) {
      site = nouveauSite(siteTag, 0, 0, 1);
      parSite.set(siteTag, site);
    }
    // Des vitaux estimés rendent le jour estimé : l'invariant de la collecte
    // (jamais d'estimé écrit sur de l'exact) les couvre sans code en plus.
    site.echantillon = Math.max(site.echantillon, Math.ceil(g.avg?.sampleInterval ?? 1));
    cumulerVitaux(site.vitaux, vitaux);
  }

  return [...parSite.values()];
}

interface CorpsGraphQL {
  data?: { viewer: { accounts: ReponseJour[] } } | null;
  errors?: Array<{ message: string }> | null;
}

export function sourceCloudflare(o: {
  token: string;
  compte: string;
  fetch?: typeof fetch;
}): SourceAnalytics {
  // Enveloppé : dans un Worker, `fetch` détaché de globalThis lève
  // « Illegal invocation ».
  const appeler =
    o.fetch ?? ((entree: RequestInfo | URL, init?: RequestInit) => fetch(entree, init));

  return async (jour) => {
    const reponse = await appeler(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${o.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: REQUETE_JOUR, variables: { compte: o.compte, jour } }),
      signal: AbortSignal.timeout(DELAI_GRAPHQL_MS),
    });
    if (!reponse.ok) throw new Error(`Cloudflare GraphQL, HTTP ${reponse.status}`);

    const corps = (await reponse.json()) as CorpsGraphQL;
    if (corps.errors?.length) {
      throw new Error(`Cloudflare GraphQL, ${corps.errors.map((e) => e.message).join(" / ")}`);
    }
    const compte = corps.data?.viewer.accounts[0];
    if (!compte) throw new Error("Cloudflare GraphQL, compte introuvable dans la réponse");
    return normaliserJour(jour, compte);
  };
}
