// Adaptateur Cloudflare Web Analytics (spec 2026-09-29-portail-analytics-design.md §3.1).
//
// Seul fichier du module qui connaît Cloudflare. Il interroge l'API GraphQL
// pour UN jour à la fois : c'est la seule façon d'obtenir des chiffres exacts.
// Sur une fenêtre de plusieurs jours, ou au-delà de sept jours, l'API ne garde
// qu'une mesure sur dix (sondes du 2026-09-29, `avg.sampleInterval` = 10).
//
// La requête ne filtre aucun site : une seule interrogation du compte rend tous
// les sites enregistrés. La collecte n'a donc pas besoin du registre clients.

import type { JourAnalytics, Ligne, SourceAnalytics } from "./types";

export const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

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
    }
  }
}`;

interface Groupe {
  count: number;
  sum: { visits: number };
  avg?: { sampleInterval: number };
  dimensions: Record<string, string | undefined>;
}

export interface ReponseJour {
  totaux: Groupe[];
  pages: Groupe[];
  provenances: Groupe[];
  appareils: Groupe[];
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

export function normaliserJour(jour: string, reponse: ReponseJour): JourAnalytics[] {
  const parSite = new Map<string, JourAnalytics>();
  for (const g of reponse.totaux) {
    const siteTag = g.dimensions.siteTag;
    if (!siteTag) continue;
    parSite.set(siteTag, {
      siteTag,
      jour,
      visites: g.sum.visits,
      pagesVues: g.count,
      // Une moyenne fractionnaire (1,5) veut dire qu'une partie du jour est
      // estimée : on arrondit au-dessus pour ne jamais la faire passer pour exacte.
      echantillon: Math.max(1, Math.ceil(g.avg?.sampleInterval ?? 1)),
      pages: [],
      provenances: [],
      appareils: [],
    });
  }

  const repartir = (
    groupes: Groupe[],
    cible: "pages" | "provenances" | "appareils",
    dimension: string,
    siVide: string,
  ) => {
    for (const g of groupes) {
      const site = parSite.get(g.dimensions.siteTag ?? "");
      if (!site) continue;
      cumuler(site[cible], g.dimensions[dimension] || siVide, g.sum.visits, g.count);
    }
  };
  repartir(reponse.pages, "pages", "requestPath", "/");
  // Une provenance égale au site lui-même est de la navigation interne :
  // Cloudflare lui compte 0 visite. Elle n'a rien à faire dans « Provenance ».
  repartir(
    reponse.provenances.filter((g) => g.sum.visits > 0),
    "provenances",
    "refererHost",
    "",
  );
  repartir(reponse.appareils, "appareils", "deviceType", "autre");

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
