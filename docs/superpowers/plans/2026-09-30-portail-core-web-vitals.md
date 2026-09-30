# Core Web Vitals dans la page Analytics : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la page `/espace/analytics` note LCP, INP et CLS mesurés chez les visiteurs, sur la période choisie, tous appareils confondus puis mobile et ordinateur.

**Architecture:** les vitaux voyagent avec le trafic : un alias de plus dans la requête GraphQL du jour, une table D1 de plus écrite dans le même batch. Une unité pure (`vitaux.ts`) calcule la note à partir des compteurs sommés sur la période. Un composant Astro affiche trois cartes sous les listes.

**Tech Stack:** Astro 6 (SSR sur Cloudflare Workers), D1, vitest avec `node:sqlite`, Tailwind v4 sur les tokens de `global.css`.

**Spec:** `docs/superpowers/specs/2026-09-30-portail-core-web-vitals-design.md`. Elle complète `docs/superpowers/specs/2026-09-29-portail-analytics-design.md` (COO-16). Lire les deux avant la première tâche.

## Global Constraints

- Dossier de travail : `/Users/ludovicbourgoin/dev/coolbeans-core-web-vitals`, branche `feat/core-web-vitals`. Avant le premier edit de chaque tâche : `pwd`, `git branch --show-current`, `git status --short`.
- `git add` des seuls fichiers de la tâche, jamais `git add -A` ni `git add .`.
- Chaque message de commit finit par la ligne `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`, précédée d'une ligne vide.
- Aucun push, aucune migration distante (`--remote`), aucun `wrangler deploy`. Le local seulement.
- Plan Workers Free : la collecte de nuit reste sous 50 appels externes. Cette fonctionnalité n'en ajoute aucun.
- Seuil de note : `MESURES_MIN = 20`. Règle : `bon × 4 ≥ total × 3` donne « bon », sinon `(bon + moyen) × 4 ≥ total × 3` donne « moyen », sinon « mauvais ».
- Appareils : `mobile`, `desktop`, `tablet`, tout le reste devient `autre`.
- Libellés affichés : « Bon », « À améliorer », « Mauvais », « Pas assez de mesures ». Métriques : Affichage (LCP), Réactivité (INP), Stabilité (CLS).
- Tests : `npx vitest run src/lib/analytics` depuis le worktree. Pas de `tsc` dans le repo, ne pas lancer `npx tsc` (il téléchargerait une autre version).
- Un hook relit le français des fichiers `.md`, `.mdx`, `.astro` écrits. Il exige U+00A0 avant `:`, `%` et à l'intérieur des guillemets « », U+202F avant `;`, `?`, `!`, et interdit les tirets cadratins. S'il bloque, corriger ce qu'il signale.

## Review Focus

- Une lecture échantillonnée d'un jour déjà collecté ne doit pas écraser ses vitaux exacts : test dans la tâche 2 (`collecte.test.ts`).
- Un site qui a des vitaux sans aucun chargement de page ce jour-là (Rév'olutions Douces, 2026-09-29) garde ses mesures : test sur la réponse réelle dans la tâche 1.
- Le cas limite de 15 bonnes sur 20, et 21 sur 28, ne dépend pas d'un arrondi flottant : tests dans la tâche 3.
- Une base sans la table `analytics_vitaux` (code publié avant la migration 0012) met la page en état « indisponible », sans 500 : test dans la tâche 4. La mise en service applique donc 0012 avant tout push.
- Les vitaux d'un autre site ou hors de la fenêtre ne comptent jamais : tests dans les tâches 2 et 4.

---

### Task 1 : types et adaptateur Cloudflare

**Files:**
- Modify: `src/lib/analytics/types.ts`
- Modify: `src/lib/analytics/cloudflare.ts` (fichier entier ci-dessous)
- Test: `src/lib/analytics/cloudflare.test.ts`
- Modify (helpers de test, type seulement) : `src/lib/analytics/store.test.ts`, `src/lib/analytics/collecte.test.ts`, `src/lib/analytics/tableau.test.ts`

**Interfaces:**
- Consumes : rien.
- Produces :
  - `types.ts` : `type Appareil = "mobile" | "desktop" | "tablet" | "autre"`, `type Metrique = "lcp" | "inp" | "cls"`, `const METRIQUES: readonly Metrique[]`, `interface Compteurs { bon; moyen; mauvais }`, `interface VitauxAppareil { appareil: Appareil; lcp: Compteurs; inp: Compteurs; cls: Compteurs }`, `JourAnalytics.vitaux: VitauxAppareil[]`.
  - `cloudflare.ts` : `interface GroupeVitaux`, `ReponseJour.vitaux: GroupeVitaux[]`, alias `vitaux` dans `REQUETE_JOUR`.

- [ ] **Step 1 : ajouter les types**

Dans `src/lib/analytics/types.ts`, après `export type Dimension = ...`, ajouter :

```ts
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
```

Dans `interface JourAnalytics`, après `appareils: Ligne[];` :

```ts
  /** Core Web Vitals du jour, une entrée par appareil qui a au moins une mesure. */
  vitaux: VitauxAppareil[];
```

- [ ] **Step 2 : mettre les helpers de test au nouveau type**

Ajouter `vitaux: [],` après `appareils: ...` dans chaque objet `JourAnalytics` construit par un test :

- `src/lib/analytics/store.test.ts`, fonction `mesure` : après `appareils: [{ valeur: "mobile", visites: 3, pagesVues: 5 }],`.
- `src/lib/analytics/collecte.test.ts`, constante `mesure` : après `appareils: [],`.
- `src/lib/analytics/tableau.test.ts`, `mesure` du `describe("chargerTableau")` : après `appareils: [],`.

Run: `npx vitest run src/lib/analytics`
Expected: PASS, 50 tests (aucun comportement n'a changé).

- [ ] **Step 3 : écrire les tests de l'adaptateur**

Dans `src/lib/analytics/cloudflare.test.ts` :

1. Import : `import { GRAPHQL_URL, LIGNES_MAX, REQUETE_JOUR, normaliserJour, sourceCloudflare, type ReponseJour } from "./cloudflare";`
2. Dans `REPONSE_26_SEPTEMBRE`, après `appareils: [...]`, ajouter `vitaux: [],`.
3. `const vide = (): ReponseJour => ({ totaux: [], pages: [], provenances: [], appareils: [], vitaux: [] });`
4. Dans le test « rend un JourAnalytics par site, sur une réponse réelle », l'objet attendu pour `SALON` gagne `vitaux: [],` après `appareils`.
5. Après la fonction `groupe`, ajouter la réponse réelle et les helpers :

```ts
// Réponse réelle de l'API pour le 2026-09-29, totaux et vitaux, enregistrée le
// 2026-09-30. Rév'olutions Douces (REV) y a une mesure de vitaux et aucun
// chargement de page.
const REPONSE_29_SEPTEMBRE: ReponseJour = {
  totaux: [
    { avg: { sampleInterval: 1 }, count: 22, dimensions: { siteTag: SECM }, sum: { visits: 6 } },
    { avg: { sampleInterval: 1 }, count: 33, dimensions: { siteTag: SALON }, sum: { visits: 20 } },
    { avg: { sampleInterval: 1 }, count: 1, dimensions: { siteTag: COOLBEANS }, sum: { visits: 1 } },
  ],
  pages: [],
  provenances: [],
  appareils: [],
  vitaux: [
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "mobile", siteTag: SALON },
      sum: { clsGood: 19, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 9, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 19, lcpNeedsImprovement: 3, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "mobile", siteTag: SECM },
      sum: { clsGood: 2, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 1, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 19, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "tablet", siteTag: SALON },
      sum: { clsGood: 2, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 1, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 2, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "desktop", siteTag: SALON },
      sum: { clsGood: 2, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 0, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 4, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "desktop", siteTag: SECM },
      sum: { clsGood: 1, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 0, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 1, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "mobile", siteTag: REV },
      sum: { clsGood: 1, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 0, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 1, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
  ],
};

type Triplet = [bon: number, moyen: number, mauvais: number];

function groupeVitaux(
  siteTag: string,
  deviceType: string,
  m: { lcp?: Triplet; inp?: Triplet; cls?: Triplet },
  sampleInterval = 1,
) {
  const [lcpGood, lcpNeedsImprovement, lcpPoor] = m.lcp ?? [0, 0, 0];
  const [inpGood, inpNeedsImprovement, inpPoor] = m.inp ?? [0, 0, 0];
  const [clsGood, clsNeedsImprovement, clsPoor] = m.cls ?? [0, 0, 0];
  return {
    avg: { sampleInterval },
    sum: { lcpGood, lcpNeedsImprovement, lcpPoor, inpGood, inpNeedsImprovement, inpPoor, clsGood, clsNeedsImprovement, clsPoor },
    dimensions: { siteTag, deviceType },
  };
}

const c = (bon: number, moyen: number, mauvais: number) => ({ bon, moyen, mauvais });
```

6. Après le `describe("normaliserJour")` existant, ajouter :

```ts
describe("normaliserJour, Core Web Vitals", () => {
  it("rattache les vitaux à leur site et à leur appareil, sur une réponse réelle", () => {
    const jours = normaliserJour("2026-09-29", REPONSE_29_SEPTEMBRE);
    const salon = jours.find((j) => j.siteTag === SALON)!;
    expect(salon.vitaux).toHaveLength(3);
    expect(salon.vitaux).toEqual(
      expect.arrayContaining([
        { appareil: "mobile", lcp: c(19, 3, 0), inp: c(9, 0, 0), cls: c(19, 0, 0) },
        { appareil: "tablet", lcp: c(2, 0, 0), inp: c(1, 0, 0), cls: c(2, 0, 0) },
        { appareil: "desktop", lcp: c(4, 0, 0), inp: c(0, 0, 0), cls: c(2, 0, 0) },
      ]),
    );
    expect(salon.visites).toBe(20);
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.vitaux).toEqual([]);
  });

  it("garde les vitaux d'un site sans aucun chargement de page ce jour-là, à 0 visite", () => {
    const rev = normaliserJour("2026-09-29", REPONSE_29_SEPTEMBRE).find((j) => j.siteTag === REV);
    expect(rev).toEqual({
      siteTag: REV,
      jour: "2026-09-29",
      visites: 0,
      pagesVues: 0,
      echantillon: 1,
      pages: [],
      provenances: [],
      appareils: [],
      vitaux: [{ appareil: "mobile", lcp: c(1, 0, 0), inp: c(0, 0, 0), cls: c(1, 0, 0) }],
    });
  });

  it("range un deviceType inconnu dans « autre » et cumule les groupes du même appareil", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.vitaux.push(
      groupeVitaux(SALON, "smarttv", { lcp: [1, 0, 0] }),
      groupeVitaux(SALON, "", { lcp: [0, 1, 0], cls: [2, 0, 0] }),
    );
    expect(normaliserJour("2026-09-29", r)[0].vitaux).toEqual([
      { appareil: "autre", lcp: c(1, 1, 0), inp: c(0, 0, 0), cls: c(2, 0, 0) },
    ]);
  });

  it("écarte un groupe sans aucune mesure de LCP, INP ou CLS", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.vitaux.push(groupeVitaux(SALON, "mobile", {}));
    expect(normaliserJour("2026-09-29", r)[0].vitaux).toEqual([]);
  });

  it("n'invente aucun site pour un groupe de vitaux vide", () => {
    const r = vide();
    r.vitaux.push(groupeVitaux(SALON, "mobile", {}));
    expect(normaliserJour("2026-09-29", r)).toEqual([]);
  });

  it("marque le jour estimé dès que le trafic ou les vitaux le sont", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1), groupe(COOLBEANS, 3, 3, {}, 10));
    r.vitaux.push(
      groupeVitaux(SALON, "mobile", { lcp: [1, 0, 0] }, 10),
      groupeVitaux(COOLBEANS, "mobile", { lcp: [1, 0, 0] }, 1),
    );
    const jours = normaliserJour("2026-09-29", r);
    expect(jours.find((j) => j.siteTag === SALON)?.echantillon).toBe(10);
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.echantillon).toBe(10);
  });
});
```

7. Dans le `describe("sourceCloudflare")`, ajouter :

```ts
  it("demande les vitaux dans la même requête que le trafic", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [REPONSE_29_SEPTEMBRE] } }, errors: null });
    const jours = await sourceCloudflare({ token: "jeton", compte: "c9736", fetch })("2026-09-29");
    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).query).toBe(REQUETE_JOUR);
    expect(REQUETE_JOUR).toContain("vitaux: rumWebVitalsEventsAdaptiveGroups");
    expect(jours.find((j) => j.siteTag === SALON)?.vitaux).toHaveLength(3);
  });
```

- [ ] **Step 4 : vérifier l'échec**

Run: `npx vitest run src/lib/analytics/cloudflare.test.ts`
Expected: FAIL. Les nouveaux tests échouent (`vitaux` absent du résultat, `REQUETE_JOUR` sans l'alias), le test réel du 26 septembre aussi (`vitaux: []` attendu).

- [ ] **Step 5 : réécrire `src/lib/analytics/cloudflare.ts`**

Contenu complet du fichier :

```ts
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
```

- [ ] **Step 6 : vérifier que tout passe**

Run: `npx vitest run src/lib/analytics`
Expected: PASS, 57 tests (50 existants + 7 nouveaux).

- [ ] **Step 7 : commit**

```bash
git add src/lib/analytics/types.ts src/lib/analytics/cloudflare.ts src/lib/analytics/cloudflare.test.ts src/lib/analytics/store.test.ts src/lib/analytics/collecte.test.ts src/lib/analytics/tableau.test.ts
git commit -m "feat(portail): la collecte lit les Core Web Vitals avec le trafic (COO-302)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : migration 0012 et stockage D1

**Files:**
- Create: `migrations/0012_analytics_vitaux.sql`
- Modify: `src/lib/analytics/store.ts` (`ecrireJour`, nouvelle `lireVitaux`)
- Modify: `src/lib/analytics/d1-sqlite.testutil.ts` (migrations par défaut)
- Test: `src/lib/analytics/store.test.ts`, `src/lib/analytics/collecte.test.ts`

**Interfaces:**
- Consumes (tâche 1) : `VitauxAppareil`, `Appareil`, `JourAnalytics.vitaux`.
- Produces : `lireVitaux(db: D1Analytics, siteTag: string, du: string, au: string): Promise<VitauxAppareil[]>`, triée par `appareil` (ordre alphabétique : autre, desktop, mobile, tablet). Table `analytics_vitaux`.

- [ ] **Step 1 : vérifier que 0012 est libre**

Run: `ls migrations/ | grep '^0012' ; git log --all --oneline -- 'migrations/0012*' | head`
Expected: aucune sortie. Si un 0012 existe, s'arrêter et le signaler.

- [ ] **Step 2 : écrire la migration**

Créer `migrations/0012_analytics_vitaux.sql` :

```sql
-- Core Web Vitals des sites clients (COO-302, spec
-- 2026-09-30-portail-core-web-vitals-design.md §3.4).
--
-- Même source et même collecte que 0011 : le cron relit chaque nuit J-7 à J-1
-- et réécrit chaque jour d'un bloc. On garde des compteurs, pas des
-- percentiles : les compteurs s'additionnent d'un jour à l'autre, ce qui donne
-- la note de Google sur n'importe quelle période.

CREATE TABLE analytics_vitaux (
  site_tag     TEXT NOT NULL,             -- identifiant du site chez Cloudflare
  jour         TEXT NOT NULL,             -- AAAA-MM-JJ, UTC
  -- Plafond de lignes : 4 appareils au plus, donc 4 lignes au plus par site et par jour.
  appareil     TEXT NOT NULL CHECK (appareil IN ('mobile', 'desktop', 'tablet', 'autre')),
  lcp_bon      INTEGER NOT NULL,
  lcp_moyen    INTEGER NOT NULL,          -- « needs improvement » chez Cloudflare
  lcp_mauvais  INTEGER NOT NULL,
  inp_bon      INTEGER NOT NULL,
  inp_moyen    INTEGER NOT NULL,
  inp_mauvais  INTEGER NOT NULL,
  cls_bon      INTEGER NOT NULL,
  cls_moyen    INTEGER NOT NULL,
  cls_mauvais  INTEGER NOT NULL,
  PRIMARY KEY (site_tag, jour, appareil)
);

-- `jour` est en deuxième position de la clé primaire : sans cet index, la
-- suppression par jour de la réécriture nocturne parcourt toute la table, et
-- D1 Free compte chaque ligne lue.
CREATE INDEX analytics_vitaux_jour ON analytics_vitaux (jour);
```

- [ ] **Step 3 : rejouer 0012 dans les tests**

Dans `src/lib/analytics/d1-sqlite.testutil.ts`, la signature devient :

```ts
export function d1Sqlite(migrations: string[] = ["0011_analytics.sql", "0012_analytics_vitaux.sql"]): {
```

- [ ] **Step 4 : écrire les tests du stockage**

Dans `src/lib/analytics/store.test.ts`, ajouter `lireVitaux` à l'import depuis `./store`, puis après `const COLLECTE = ...` :

```ts
const c = (bon: number, moyen: number, mauvais: number) => ({ bon, moyen, mauvais });
const VITAUX_MOBILE = { appareil: "mobile" as const, lcp: c(8, 1, 1), inp: c(3, 0, 0), cls: c(9, 0, 1) };
const VITAUX_ORDINATEUR = { appareil: "desktop" as const, lcp: c(2, 0, 0), inp: c(0, 0, 0), cls: c(2, 0, 0) };
```

Et dans le `describe("store analytics (D1)")` :

```ts
  it("indexe jour sur analytics_vitaux", () => {
    const index = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'analytics_vitaux_jour'")
      .all();
    expect(index).toHaveLength(1);
  });

  it("écrit les vitaux d'un jour et les relit par appareil", async () => {
    await ecrireJour(
      db,
      "2026-09-28",
      [mesure("2026-09-28", { vitaux: [VITAUX_MOBILE, VITAUX_ORDINATEUR] })],
      COLLECTE,
    );
    expect(await lireVitaux(db, SITE, "2026-09-01", "2026-09-30")).toEqual([
      VITAUX_ORDINATEUR,
      VITAUX_MOBILE,
    ]);
  });

  it("somme les vitaux sur la fenêtre, pour le seul site demandé", async () => {
    await ecrireJour(
      db,
      "2026-09-27",
      [
        mesure("2026-09-27", { vitaux: [VITAUX_MOBILE] }),
        mesure("2026-09-27", { siteTag: AUTRE, vitaux: [VITAUX_MOBILE] }),
      ],
      COLLECTE,
    );
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28", { vitaux: [VITAUX_MOBILE] })], COLLECTE);
    // Hors fenêtre : ne compte pas.
    await ecrireJour(db, "2026-09-29", [mesure("2026-09-29", { vitaux: [VITAUX_MOBILE] })], COLLECTE);
    expect(await lireVitaux(db, SITE, "2026-09-27", "2026-09-28")).toEqual([
      { appareil: "mobile", lcp: c(16, 2, 2), inp: c(6, 0, 0), cls: c(18, 0, 2) },
    ]);
  });

  it("réécrire un jour efface ses anciens vitaux", async () => {
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28", { vitaux: [VITAUX_MOBILE] })], COLLECTE);
    await ecrireJour(db, "2026-09-28", [mesure("2026-09-28")], "2026-09-30T04:05:00.000Z");
    expect(await lireVitaux(db, SITE, "2026-09-28", "2026-09-28")).toEqual([]);
  });

  it("refuse un appareil hors liste, sans rien écrire du jour", async () => {
    const intrus = { ...VITAUX_MOBILE, appareil: "smarttv" as never };
    await expect(
      ecrireJour(db, "2026-09-28", [mesure("2026-09-28", { vitaux: [intrus] })], COLLECTE),
    ).rejects.toThrow(/CHECK/);
    // Le batch est une transaction : ni le trafic ni la collecte du jour ne sont écrits.
    expect(await lireCollectes(db, "2026-09-28", "2026-09-28")).toEqual([]);
    expect(await lireJours(db, SITE, "2026-09-28", "2026-09-28")).toEqual([]);
  });
```

Dans `src/lib/analytics/collecte.test.ts`, ajouter `lireVitaux` à l'import depuis `./store`, puis dans le `describe("collecterAnalytics")` :

```ts
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
```

- [ ] **Step 5 : vérifier l'échec**

Run: `npx vitest run src/lib/analytics`
Expected: FAIL. `lireVitaux` n'est pas exportée par `./store`.

- [ ] **Step 6 : implémenter le stockage**

Dans `src/lib/analytics/store.ts` :

1. L'en-tête cite aussi la seconde spec : `// Stockage D1 des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3.3,` puis `// Core Web Vitals, spec 2026-09-30-portail-core-web-vitals-design.md §3.4).` à la place de la première ligne.
2. L'import devient `import type { Appareil, Dimension, JourAnalytics, VitauxAppareil } from "./types";`
3. Dans `ecrireJour`, la liste initiale gagne une troisième suppression :

```ts
  const instructions: D1Statement[] = [
    db.prepare("DELETE FROM analytics_jours WHERE jour = ?").bind(jour),
    db.prepare("DELETE FROM analytics_repartitions WHERE jour = ?").bind(jour),
    db.prepare("DELETE FROM analytics_vitaux WHERE jour = ?").bind(jour),
  ];
```

4. Dans la boucle `for (const site of sites)`, après la boucle `for (const [dimension, cle] of DIMENSIONS)` :

```ts
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
```

5. Après `lireRepartitions`, ajouter :

```ts
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
```

- [ ] **Step 7 : vérifier que tout passe**

Run: `npx vitest run src/lib/analytics`
Expected: PASS, 64 tests.

- [ ] **Step 8 : appliquer 0012 sur la base locale du worktree**

Run: `npx wrangler d1 migrations apply coolbeans-portal --local`
Expected: `0012_analytics_vitaux.sql` appliquée (et 0011 si elle manquait en local). Jamais `--remote`.

- [ ] **Step 9 : commit**

```bash
git add migrations/0012_analytics_vitaux.sql src/lib/analytics/store.ts src/lib/analytics/d1-sqlite.testutil.ts src/lib/analytics/store.test.ts src/lib/analytics/collecte.test.ts
git commit -m "feat(portail): table analytics_vitaux, écrite avec le jour (COO-302)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : notation des Core Web Vitals

**Files:**
- Create: `src/lib/analytics/vitaux.ts`
- Test: `src/lib/analytics/vitaux.test.ts`

**Interfaces:**
- Consumes (tâche 1) : `METRIQUES`, `Appareil`, `Compteurs`, `Metrique`, `VitauxAppareil`.
- Produces :
  - `const MESURES_MIN = 20`
  - `type Note = "bon" | "moyen" | "mauvais"`
  - `interface Evaluation { note: Note | null; mesures: number; partBonne: number }`
  - `interface VitesseMetrique { global: Evaluation; mobile: Evaluation; ordinateur: Evaluation }`
  - `type Vitesse = Record<Metrique, VitesseMetrique>`
  - `noter(c: Compteurs): Evaluation`
  - `construireVitesse(lignes: VitauxAppareil[]): Vitesse | null`

- [ ] **Step 1 : écrire les tests**

Créer `src/lib/analytics/vitaux.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { construireVitesse, MESURES_MIN, noter } from "./vitaux";
import type { Appareil, VitauxAppareil } from "./types";

type Triplet = [bon: number, moyen: number, mauvais: number];

const c = (bon: number, moyen: number, mauvais: number) => ({ bon, moyen, mauvais });
const ligne = (
  appareil: Appareil,
  lcp: Triplet,
  inp: Triplet = [0, 0, 0],
  cls: Triplet = [0, 0, 0],
): VitauxAppareil => ({ appareil, lcp: c(...lcp), inp: c(...inp), cls: c(...cls) });

describe("noter", () => {
  it("ne note pas sous 20 mesures, mais les compte", () => {
    expect(MESURES_MIN).toBe(20);
    expect(noter(c(19, 0, 0))).toEqual({ note: null, mesures: 19, partBonne: 1 });
  });

  it("note dès 20 mesures", () => {
    expect(noter(c(20, 0, 0))).toEqual({ note: "bon", mesures: 20, partBonne: 1 });
  });

  it("15 bonnes sur 20 font exactement 75 % : « bon »", () => {
    expect(noter(c(15, 0, 5)).note).toBe("bon");
  });

  it("14 bonnes sur 20 ne suffisent pas", () => {
    expect(noter(c(14, 6, 0)).note).toBe("moyen");
  });

  it("« moyen » quand bonnes et moyennes font au moins 75 %, « mauvais » sinon", () => {
    expect(noter(c(10, 5, 5)).note).toBe("moyen");
    expect(noter(c(10, 4, 6)).note).toBe("mauvais");
  });

  it("ne dépend d'aucun arrondi flottant", () => {
    // 75 % de 28 font 21 : 21 bonnes donnent « bon », 20 non.
    expect(noter(c(21, 7, 0)).note).toBe("bon");
    expect(noter(c(20, 8, 0)).note).toBe("moyen");
  });

  it("rend la part des mesures bonnes, et 0 sans mesure", () => {
    expect(noter(c(30, 6, 4)).partBonne).toBe(0.75);
    expect(noter(c(0, 0, 0))).toEqual({ note: null, mesures: 0, partBonne: 0 });
  });
});

describe("construireVitesse", () => {
  it("rend null sans aucune mesure", () => {
    expect(construireVitesse([])).toBeNull();
    expect(construireVitesse([ligne("mobile", [0, 0, 0])])).toBeNull();
  });

  it("note le global sur tous les appareils, mobile et ordinateur séparément", () => {
    const v = construireVitesse([
      ligne("mobile", [15, 5, 0]),
      ligne("desktop", [20, 0, 0]),
      ligne("tablet", [3, 0, 0]),
      ligne("autre", [2, 0, 0]),
    ])!;
    expect(v.lcp.global).toEqual({ note: "bon", mesures: 45, partBonne: 40 / 45 });
    expect(v.lcp.mobile).toEqual({ note: "bon", mesures: 20, partBonne: 0.75 });
    expect(v.lcp.ordinateur).toEqual({ note: "bon", mesures: 20, partBonne: 1 });
  });

  it("compte tablette et « autre » dans le global seulement", () => {
    const v = construireVitesse([ligne("tablet", [12, 0, 0]), ligne("autre", [10, 0, 0])])!;
    expect(v.lcp.global.mesures).toBe(22);
    expect(v.lcp.mobile).toEqual({ note: null, mesures: 0, partBonne: 0 });
    expect(v.lcp.ordinateur).toEqual({ note: null, mesures: 0, partBonne: 0 });
  });

  it("note chaque métrique avec ses propres compteurs", () => {
    const v = construireVitesse([ligne("mobile", [20, 0, 0], [2, 0, 0], [0, 0, 20])])!;
    expect(v.lcp.global.note).toBe("bon");
    expect(v.inp.global).toEqual({ note: null, mesures: 2, partBonne: 1 });
    expect(v.cls.global.note).toBe("mauvais");
  });

  it("rend une vitesse dès qu'une seule métrique a une mesure", () => {
    const v = construireVitesse([ligne("mobile", [0, 0, 0], [1, 0, 0])]);
    expect(v?.inp.global.mesures).toBe(1);
    expect(v?.lcp.global.mesures).toBe(0);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run src/lib/analytics/vitaux.test.ts`
Expected: FAIL, module `./vitaux` introuvable.

- [ ] **Step 3 : implémenter**

Créer `src/lib/analytics/vitaux.ts` :

```ts
// Note des Core Web Vitals (spec 2026-09-30-portail-core-web-vitals-design.md §4).
//
// Fonctions pures. Les compteurs s'additionnent sur toute période, les
// percentiles non : la note se calcule donc à partir des compteurs. « Au moins
// 75 % de mesures bonnes » équivaut à « p75 sous le seuil bon », c'est la
// règle de Google.

import {
  METRIQUES,
  type Appareil,
  type Compteurs,
  type Metrique,
  type VitauxAppareil,
} from "./types";

/** Sous ce nombre de mesures sur la période, aucune note n'est donnée. */
export const MESURES_MIN = 20;

export type Note = "bon" | "moyen" | "mauvais";

export interface Evaluation {
  /** null sous MESURES_MIN mesures. */
  note: Note | null;
  mesures: number;
  /** Part des mesures bonnes, entre 0 et 1 (0 sans mesure). */
  partBonne: number;
}

export interface VitesseMetrique {
  global: Evaluation;
  mobile: Evaluation;
  ordinateur: Evaluation;
}

export type Vitesse = Record<Metrique, VitesseMetrique>;

export function noter(c: Compteurs): Evaluation {
  const mesures = c.bon + c.moyen + c.mauvais;
  const partBonne = mesures === 0 ? 0 : c.bon / mesures;
  if (mesures < MESURES_MIN) return { note: null, mesures, partBonne };
  // En entiers : 15 sur 20 font exactement 75 %, sans arrondi flottant.
  const note: Note =
    c.bon * 4 >= mesures * 3 ? "bon" : (c.bon + c.moyen) * 4 >= mesures * 3 ? "moyen" : "mauvais";
  return { note, mesures, partBonne };
}

function sommer(lignes: VitauxAppareil[], m: Metrique): Compteurs {
  return lignes.reduce(
    (total, l) => ({
      bon: total.bon + l[m].bon,
      moyen: total.moyen + l[m].moyen,
      mauvais: total.mauvais + l[m].mauvais,
    }),
    { bon: 0, moyen: 0, mauvais: 0 },
  );
}

/**
 * Le global somme tous les appareils. Mobile et ordinateur se notent à part,
 * comme chez Google. Tablette et « autre » ne comptent que dans le global.
 */
export function construireVitesse(lignes: VitauxAppareil[]): Vitesse | null {
  const de = (appareil: Appareil) => lignes.filter((l) => l.appareil === appareil);
  const vitesse = {} as Vitesse;
  let mesures = 0;
  for (const m of METRIQUES) {
    const global = noter(sommer(lignes, m));
    mesures += global.mesures;
    vitesse[m] = {
      global,
      mobile: noter(sommer(de("mobile"), m)),
      ordinateur: noter(sommer(de("desktop"), m)),
    };
  }
  return mesures === 0 ? null : vitesse;
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `npx vitest run src/lib/analytics`
Expected: PASS, 76 tests.

- [ ] **Step 5 : commit**

```bash
git add src/lib/analytics/vitaux.ts src/lib/analytics/vitaux.test.ts
git commit -m "feat(portail): note des Core Web Vitals à partir des compteurs (COO-302)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : le tableau lit et note les vitaux

**Files:**
- Modify: `src/lib/analytics/tableau.ts`
- Test: `src/lib/analytics/tableau.test.ts`

**Interfaces:**
- Consumes : `lireVitaux` (tâche 2), `construireVitesse`, `Vitesse` (tâche 3), `VitauxAppareil` (tâche 1).
- Produces : `Tableau.vitesse: Vitesse | null` ; `construireTableau` prend `vitaux: VitauxAppareil[]` en plus.

- [ ] **Step 1 : écrire les tests**

Dans `src/lib/analytics/tableau.test.ts` :

1. Dans le `describe("construireTableau")`, `base` devient `const base = { periode: "30j" as const, jours, repartitions, collectes, vitaux: [] };`.
2. Les deux appels à `construireTableau` qui n'utilisent pas `base` (« une semaine de 7 jours collectés... » et « ne divise jamais par zéro ») gagnent `vitaux: [],`.
3. Ajouter dans ce `describe` :

```ts
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
```

4. Dans le `describe("chargerTableau")` :

```ts
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
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run src/lib/analytics/tableau.test.ts`
Expected: FAIL. `vitesse` est `undefined` dans le tableau, et le test « sans la table » rend `ok: true`.

- [ ] **Step 3 : implémenter**

Dans `src/lib/analytics/tableau.ts` :

1. L'import depuis `./store` gagne `lireVitaux`. Ajouter :

```ts
import { construireVitesse, type Vitesse } from "./vitaux";
```

et l'import de types devient `import type { Dimension, SiteAnalytics, VitauxAppareil } from "./types";`.

2. `interface Tableau` gagne, après `estime` :

```ts
  /** Core Web Vitals notés sur la période, null sans aucune mesure. */
  vitesse: Vitesse | null;
```

3. `construireTableau` prend `vitaux: VitauxAppareil[];` dans son objet `o` (après `collectes`), et son `return` gagne `vitesse: construireVitesse(o.vitaux),`.

4. Dans `chargerTableau`, la lecture devient :

```ts
    const [etat, collectes, jours, repartitions, vitaux] = await Promise.all([
      etatCollecte(db),
      lireCollectes(db, du, au),
      lireJours(db, o.siteTag, du, au),
      lireRepartitions(db, o.siteTag, du, au),
      lireVitaux(db, o.siteTag, du, au),
    ]);
```

et l'appel devient `construireTableau({ periode: o.periode, jours, repartitions, collectes, vitaux })`.

- [ ] **Step 4 : vérifier que tout passe**

Run: `npx vitest run src/lib/analytics`
Expected: PASS, 79 tests.

- [ ] **Step 5 : commit**

```bash
git add src/lib/analytics/tableau.ts src/lib/analytics/tableau.test.ts
git commit -m "feat(portail): le tableau Analytics porte la note des Core Web Vitals (COO-302)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : section « Vitesse du site » dans la page

**Files:**
- Create: `src/components/portail/VitesseSite.astro`
- Modify: `src/pages/espace/analytics.astro`

**Interfaces:**
- Consumes : `Tableau.vitesse` (tâche 4), `MESURES_MIN`, `Evaluation`, `Note`, `Vitesse` (tâche 3), `Metrique` (tâche 1), `Badge` (`src/components/ui/Badge.astro`, props `variant`, `subtle`, `size`).
- Produces : composant `<VitesseSite vitesse={Vitesse | null} />`.

- [ ] **Step 1 : relire le design system**

Lire `src/pages/design-system.astro` (sections Badge et cartes) et `src/components/portail/ClassementAnalytics.astro`. Rappel : `.label` seul pour un titre de section, tokens de `global.css` (`text-mute`, `border-line`, `bg-surface`, `rounded-card`, espacements `*x`).

- [ ] **Step 2 : créer le composant**

Créer `src/components/portail/VitesseSite.astro` :

```astro
---
// Core Web Vitals de la page Analytics (spec 2026-09-30-portail-core-web-vitals-design.md §5).
//
// Trois cartes, une par métrique notée par Google. La note vient des
// compteurs de la période (src/lib/analytics/vitaux.ts), jamais d'un
// percentile. Sous MESURES_MIN mesures, la carte le dit au lieu de noter.
import Badge from "../ui/Badge.astro";
import { MESURES_MIN, type Evaluation, type Note, type Vitesse } from "../../lib/analytics/vitaux";
import type { Metrique } from "../../lib/analytics/types";

interface Props {
  /** null : aucune mesure sur la période. */
  vitesse: Vitesse | null;
}

const { vitesse } = Astro.props;

const CARTES: Array<{ metrique: Metrique; titre: string; sigle: string; description: string; aide: string }> = [
  {
    metrique: "lcp",
    titre: "Affichage",
    sigle: "LCP",
    description: "Temps pour afficher le contenu principal.",
    aide: "Bon sous 2,5 s, mauvais au-delà de 4 s.",
  },
  {
    metrique: "inp",
    titre: "Réactivité",
    sigle: "INP",
    description: "Délai de réaction à un clic ou une touche.",
    aide: "Bon sous 200 ms, mauvais au-delà de 500 ms.",
  },
  {
    metrique: "cls",
    titre: "Stabilité",
    sigle: "CLS",
    description: "Mouvements de la page pendant le chargement.",
    aide: "Bon sous 0,1, mauvais au-delà de 0,25.",
  },
];

// Le libellé porte le sens, la couleur ne fait que le doubler.
const NOTES: Record<Note, { libelle: string; variante: "green" | "amber" | "red" }> = {
  bon: { libelle: "Bon", variante: "green" },
  moyen: { libelle: "À améliorer", variante: "amber" },
  mauvais: { libelle: "Mauvais", variante: "red" },
};

const nombre = new Intl.NumberFormat("fr-FR");
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const mesures = (n: number) => `${nombre.format(n)} mesure${n > 1 ? "s" : ""}`;
const resume = (e: Evaluation) =>
  e.note
    ? `${pourcent.format(e.partBonne)} de mesures bonnes sur ${nombre.format(e.mesures)}`
    : `${mesures(e.mesures)} sur les ${MESURES_MIN} nécessaires`;
/** Ligne Mobile ou Ordinateur : la note et son nombre de mesures, ou le manque. */
const detail = (e: Evaluation) =>
  e.note
    ? `${NOTES[e.note].libelle} · ${mesures(e.mesures)}`
    : `pas assez de mesures (${nombre.format(e.mesures)})`;
---

<section class="mt-6x">
  <h2 class="label">Vitesse du site</h2>
  <p class="mt-1 text-sm text-mute">Mesurée chez vos visiteurs, selon les critères de Google.</p>
  {!vitesse && <p class="mt-4x text-sm text-mute">Aucune mesure de vitesse sur la période.</p>}
  {
    vitesse && (
      <div class="mt-4x grid gap-6x md:grid-cols-3">
        {CARTES.map((carte) => {
          const { global, mobile, ordinateur } = vitesse[carte.metrique];
          return (
            <div class="rounded-card border border-line bg-surface p-6x">
              <div class="flex items-baseline justify-between gap-3x">
                <h3 class="label">{carte.titre}</h3>
                <span class="text-xs text-mute">{carte.sigle}</span>
              </div>
              <p class="mt-1 text-sm text-mute">{carte.description}</p>
              <p class="mt-4x">
                {global.note ? (
                  <Badge size="sm" subtle variant={NOTES[global.note].variante}>
                    {NOTES[global.note].libelle}
                  </Badge>
                ) : (
                  <Badge size="sm" subtle variant="gray">
                    Pas assez de mesures
                  </Badge>
                )}
              </p>
              <p class="mt-2x text-sm tabular-nums">{resume(global)}</p>
              <dl class="mt-4x grid gap-1 text-sm">
                <div class="flex justify-between gap-3x">
                  <dt class="text-mute">Mobile</dt>
                  <dd class="tabular-nums">{detail(mobile)}</dd>
                </div>
                <div class="flex justify-between gap-3x">
                  <dt class="text-mute">Ordinateur</dt>
                  <dd class="tabular-nums">{detail(ordinateur)}</dd>
                </div>
              </dl>
              <p class="mt-4x text-xs text-mute">{carte.aide}</p>
            </div>
          );
        })}
      </div>
    )
  }
</section>
```

- [ ] **Step 3 : brancher la section dans la page**

Dans `src/pages/espace/analytics.astro` :

1. L'en-tête cite la seconde spec : ligne 2, `// Analytics (COO-16, spec 2026-09-29-portail-analytics-design.md §5, Core Web Vitals,` puis `// COO-302, spec 2026-09-30-portail-core-web-vitals-design.md §5).`
2. Import, après `ClassementAnalytics` : `import VitesseSite from "../../components/portail/VitesseSite.astro";`
3. Entre la `div` des trois `ClassementAnalytics` et la ligne `{tableau.estime && ...}` :

```astro
        <VitesseSite vitesse={tableau.vitesse} />
```

- [ ] **Step 4 : vérifier la compilation**

Run: `npx astro build 2>&1 | tail -15`
Expected: build terminé sans erreur. Puis `npx vitest run src/lib/analytics` : PASS, 79 tests.

Si le hook de relecture bloque sur le `.astro`, corriger ce qu'il signale dans le texte du gabarit.

- [ ] **Step 5 : commit**

```bash
git add src/components/portail/VitesseSite.astro src/pages/espace/analytics.astro
git commit -m "feat(portail): section Vitesse du site dans la page Analytics (COO-302)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : documentation

**Files:**
- Modify: `src/content/docs/coolbeans/04-portail.mdx`
- Modify: `docs/superpowers/specs/2026-09-29-portail-analytics-design.md`

**Interfaces:**
- Consumes : tout ce qui précède, pour décrire l'existant.
- Produces : rien pour le code.

- [ ] **Step 1 : section Analytics du doc portail**

Dans `src/content/docs/coolbeans/04-portail.mdx`, juste après le paragraphe qui commence par `**Les statistiques de fréquentation.**`, ajouter une ligne vide puis :

```mdx
**La vitesse du site.** Sous les listes, la page note les trois Core Web Vitals mesurés chez les visiteurs, sur la période choisie : Affichage (LCP), Réactivité (INP), Stabilité (CLS), tous appareils confondus puis sur mobile et sur ordinateur. Les mesures viennent du même compte Cloudflare, dans la même requête nocturne que le trafic (jeu `rumWebVitalsEventsAdaptiveGroups`). D1 garde, par site, jour et appareil, le nombre de mesures bonnes, à améliorer et mauvaises : ces compteurs s'additionnent sur n'importe quelle période, les percentiles non. La note suit la règle de Google : « Bon » si au moins 75 % des mesures sont bonnes, « À améliorer » si les bonnes et les moyennes réunies atteignent 75 %, « Mauvais » sinon. Sous 20 mesures sur la période, la carte n'affiche pas de note (`src/lib/analytics/vitaux.ts`).
```

Dans le tableau qui contient la ligne `| Tables \`analytics_jours\`, ...`, ajouter juste après elle :

```mdx
| Table `analytics_vitaux` | Migration `migrations/0012_analytics_vitaux.sql`, lecture et écriture dans `src/lib/analytics/store.ts` |
```

- [ ] **Step 2 : spec de COO-16**

Dans `docs/superpowers/specs/2026-09-29-portail-analytics-design.md`, §1, la puce `- les pays, les Core Web Vitals, la comparaison avec la période précédente ;` devient deux puces :

```md
- les pays, la comparaison avec la période précédente ;
- les Core Web Vitals, livrés ensuite par COO-302 (`2026-09-30-portail-core-web-vitals-design.md`) ;
```

- [ ] **Step 3 : relecture**

Le hook de relecture s'exécute à l'écriture. Espaces insécables : U+00A0 avant `:` et `%`, dans les guillemets « », U+202F avant `;`. Corriger tout ce qu'il signale.

- [ ] **Step 4 : commit**

```bash
git add src/content/docs/coolbeans/04-portail.mdx docs/superpowers/specs/2026-09-29-portail-analytics-design.md
git commit -m "docs(portail): les Core Web Vitals dans la doc du portail (COO-302)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7 : recette locale

**Files:**
- Aucun fichier du repo, sauf correctif. Les captures vont dans le scratchpad de la session : `/private/tmp/claude-501/-Users-ludovicbourgoin-dev-coolbeans/ead817fd-57e9-4d8f-875d-14951e8dc736/scratchpad/recette/`.

**Interfaces:**
- Consumes : la page complète (tâches 1 à 6), la base D1 locale migrée (tâche 2, step 8).
- Produces : captures en clair, en sombre et à 390 px de large, et la liste de ce qui ne va pas.

- [ ] **Step 1 : préparer la base locale**

Dans le worktree :

```bash
npx wrangler d1 execute coolbeans-portal --local --command "UPDATE user SET portalRole='admin' WHERE email='ludo@coolbeans.cc'"
node scripts/definir-motdepasse.mjs ludo@coolbeans.cc
```

Mot de passe jetable, jamais celui de prod. Le script vise la base locale par défaut.

Puis semer un jour (J-1 par rapport à la date du jour, UTC) pour le site Coolbeans (`2ad7fb260e2a498a900a5d97d41b6853`), avec une note de chaque sorte :

- LCP : mobile 18/3/1, desktop 20/0/0 (global « Bon », mobile « Bon », ordinateur « Bon ») ;
- INP : mobile 6/1/0 (global « Pas assez de mesures ») ;
- CLS : mobile 10/2/10, desktop 12/6/2 (global « Mauvais », mobile « Mauvais », ordinateur « À améliorer »).

```bash
J=$(date -u -v-1d +%F)
npx wrangler d1 execute coolbeans-portal --local --command "
INSERT OR REPLACE INTO analytics_collectes (jour, collecte_le) VALUES ('$J', '$(date -u +%FT%TZ)');
INSERT OR REPLACE INTO analytics_jours (site_tag, jour, visites, pages_vues, echantillon) VALUES ('2ad7fb260e2a498a900a5d97d41b6853', '$J', 12, 30, 1);
INSERT OR REPLACE INTO analytics_vitaux VALUES ('2ad7fb260e2a498a900a5d97d41b6853', '$J', 'mobile', 18, 3, 1, 6, 1, 0, 10, 2, 10);
INSERT OR REPLACE INTO analytics_vitaux VALUES ('2ad7fb260e2a498a900a5d97d41b6853', '$J', 'desktop', 20, 0, 0, 0, 0, 0, 12, 6, 2);"
```

- [ ] **Step 2 : lancer le serveur et capturer**

```bash
npm run dev -- --port 4337
npm i playwright --no-save
```

`astro dev` tourne en démon (`npx astro dev status`, `npx astro dev stop`). Script Playwright posé dans le worktree (hors `git add`), `chromium.launch({ channel: "chrome" })` : se connecter sur `http://localhost:4337` avec le compte admin (l'API Better Auth exige l'en-tête `Origin`, le navigateur l'envoie), poser le cookie `portal_workspace=coolbeans`, ouvrir `http://localhost:4337/espace/analytics`, faire défiler jusqu'à « Vitesse du site ».

Captures à produire dans le dossier `recette/` : pleine page en clair (1280 px), en sombre (`colorScheme: "dark"`), et à 390 px de large.

Contrôles :

- trois cartes, dans l'ordre Affichage, Réactivité, Stabilité ;
- pastilles lisibles en clair et en sombre ;
- « 90 % de mesures bonnes sur 42 » pour LCP ; « 7 mesures sur les 20 nécessaires » pour INP ;
- lignes Mobile et Ordinateur conformes au semis ci-dessus ;
- aucune ligne qui déborde à 390 px ;
- avec `?periode=6m`, la section affiche les mêmes chiffres.

Puis supprimer les lignes de vitaux semées (`DELETE FROM analytics_vitaux WHERE site_tag = '2ad7fb260e2a498a900a5d97d41b6853'`) et vérifier que la section affiche « Aucune mesure de vitesse sur la période. »

- [ ] **Step 3 : rendre compte**

Lister les chemins des captures et chaque écart constaté. Ne rien corriger sans le signaler : un correctif du composant se commite à part (`fix(portail): ...`), avec le même `git add` sélectif.

- [ ] **Step 4 : arrêter le serveur**

Laisser le serveur tourner si la relecture visuelle n'est pas finie. Sinon `npx astro dev stop`.

---

## Hors plan : mise en service

Rien de ce qui suit ne se fait sans ordre explicite de Ludo (spec §8).

1. Depuis le worktree `/Users/ludovicbourgoin/dev/coolbeans-core-web-vitals`, seul endroit où `0012_analytics_vitaux.sql` existe avant le merge : `npx wrangler d1 migrations list coolbeans-portal --remote` doit montrer 0012 seule en attente, puis `npx wrangler d1 migrations apply coolbeans-portal --remote`. Lancée depuis le clone principal, la commande répond « No migrations to apply » et passe pour un succès.
2. Même chose pour staging, avec `--env staging` : `npx wrangler d1 migrations list coolbeans-portal-staging --remote --env staging`, puis `apply`. Le nom `coolbeans-portal-staging` n'existe que sous `env.staging`.
3. Sans la table, la page Analytics passe en « indisponible » pour tous les clients dès le déploiement du code, pas seulement à la collecte de 04:05.
4. Merger `feat/core-web-vitals` dans `staging`, pousser, vérifier le build.
5. Le lendemain de la mise en ligne, vérifier que `analytics_vitaux` contient des lignes pour les 7 derniers jours.
6. Après le merge, appliquer 0012 en `--local` dans le clone principal : sinon sa page Analytics locale est « indisponible », et chaque nouveau worktree recopie cette base.
