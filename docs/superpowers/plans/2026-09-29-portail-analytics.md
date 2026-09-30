# Analytics du portail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la page `/espace/analytics` montre à chaque client les visites de son site, collectées chaque nuit depuis Cloudflare Web Analytics dans D1.

**Architecture:** un adaptateur Cloudflare interroge l'API GraphQL un jour à la fois (seule façon d'avoir des chiffres exacts), une collecte appelée par le cron existant relit J-1 à J-7 et les écrit dans trois tables D1, et la page ne lit que D1. Le registre des clients (`src/content/clients/*.yaml`) porte la liste des sites de chaque client.

**Tech Stack:** Astro 6 SSR sur Cloudflare Workers (`@astrojs/cloudflare`), D1, TypeScript, Tailwind v4 sur les tokens de `src/styles/global.css`, Vitest 4 avec `node:sqlite` pour les tests D1.

**Spec:** `docs/superpowers/specs/2026-09-29-portail-analytics-design.md`

## Global Constraints

- Worktree `/Users/ludovicbourgoin/dev/coolbeans-analytics`, branche `feat/analytics`. Avant le premier edit de chaque tâche : `pwd`, `git branch --show-current`, `git status`.
- Commit strictement les chemins de la tâche, jamais `git add -A` ni `git add .`.
- Chaque message de commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Code et commentaires en français, dans le style des fichiers voisins (identifiants français, commentaires qui disent pourquoi).
- Aucun tiret cadratin ni demi-cadratin, nulle part, code compris.
- Un hook relit chaque `.md`, `.mdx`, `.astro`, `.yaml` écrit. En prose : U+00A0 avant « : », U+202F avant « ; ! ? », U+00A0 à l'intérieur des guillemets français et entre un nombre et « % ». Dans un template `.astro`, écrire `&nbsp;:`.
- Dans un template `.astro`, jamais de ternaire entre deux blocs JSX (parenthèse fermante, espace, deux-points) : le hook le prend pour de la prose. Utiliser deux blocs `{cond && (...)}` ou calculer dans le frontmatter.
- Plan Workers Free : 50 appels (fetch et requêtes D1) par exécution. La collecte en consomme 14 au plus.
- **Invariant de la collecte : aucun jour antérieur à J-7 n'est jamais écrit.**
- Jours en UTC, format `AAAA-MM-JJ`.
- Aucune publication : pas de `wrangler deploy`, pas de migration `--remote`, pas de push. Le contrôleur s'en charge sur ordre de Ludo.
- Tests : `npx vitest run <chemin>`. Suite complète : `npm test`.

## Review Focus

- Un `?site=` qui désigne le site d'un autre client, ou un siteTag à la place d'un host : la page reste sur la liste du client courant (test dans la tâche 4, `choisirSite`).
- D1 en panne ou table absente au moment de l'affichage : la page montre un état vide, jamais une 500 (test dans la tâche 4, `chargerTableau` sans migration).
- Collecte le 1er mars ou le 1er janvier : J-1 à J-7 franchissent correctement mois et année (tests dans la tâche 3, `joursACollecter`).
- Un jour recollecté dont une page n'a plus de visite : l'ancienne ligne disparaît (test dans la tâche 2, `ecrireJour`).
- `?periode=` absent ou fantaisiste : la page retombe sur 30 jours (test dans la tâche 4, `lirePeriode`).

---

### Task 1: Types communs et adaptateur Cloudflare

**Files:**
- Create: `src/lib/analytics/types.ts`
- Create: `src/lib/analytics/cloudflare.ts`
- Test: `src/lib/analytics/cloudflare.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `types.ts` : `type Dimension = "page" | "provenance" | "appareil"`, `interface Ligne { valeur: string; visites: number; pagesVues: number }`, `interface JourAnalytics { siteTag; jour; visites; pagesVues; echantillon; pages: Ligne[]; provenances: Ligne[]; appareils: Ligne[] }`, `type SourceAnalytics = (jour: string) => Promise<JourAnalytics[]>`, `interface SiteAnalytics { host: string; siteTag: string }`.
  - `cloudflare.ts` : `GRAPHQL_URL`, `REQUETE_JOUR`, `interface ReponseJour`, `normaliserJour(jour: string, reponse: ReponseJour): JourAnalytics[]`, `sourceCloudflare(o: { token: string; compte: string; fetch?: typeof fetch }): SourceAnalytics`.

- [ ] **Step 1: Écrire les types**

`src/lib/analytics/types.ts` :

```ts
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
```

- [ ] **Step 2: Écrire le test qui échoue**

`src/lib/analytics/cloudflare.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { GRAPHQL_URL, normaliserJour, sourceCloudflare, type ReponseJour } from "./cloudflare";

const SALON = "7b1613c4d8524beaae503934203801a4";
const COOLBEANS = "2ad7fb260e2a498a900a5d97d41b6853";
const REV = "4b3f282e3f8a4d90ac63fbeb41577e72";
const SECM = "7257179f83b6445d93703f1d1f305a4a";

// Réponse réelle de l'API pour le 2026-09-26, enregistrée le 2026-09-29.
const REPONSE_26_SEPTEMBRE: ReponseJour = {
  totaux: [
    { avg: { sampleInterval: 1 }, count: 1, dimensions: { siteTag: SECM }, sum: { visits: 1 } },
    { avg: { sampleInterval: 1 }, count: 4, dimensions: { siteTag: SALON }, sum: { visits: 4 } },
    { avg: { sampleInterval: 1 }, count: 3, dimensions: { siteTag: REV }, sum: { visits: 3 } },
    { avg: { sampleInterval: 1 }, count: 1, dimensions: { siteTag: COOLBEANS }, sum: { visits: 1 } },
  ],
  pages: [
    { count: 4, dimensions: { requestPath: "/", siteTag: SALON }, sum: { visits: 4 } },
    { count: 3, dimensions: { requestPath: "/", siteTag: REV }, sum: { visits: 3 } },
    { count: 1, dimensions: { requestPath: "/", siteTag: SECM }, sum: { visits: 1 } },
    { count: 1, dimensions: { requestPath: "/", siteTag: COOLBEANS }, sum: { visits: 1 } },
  ],
  provenances: [
    { count: 4, dimensions: { refererHost: "", siteTag: SALON }, sum: { visits: 4 } },
    { count: 3, dimensions: { refererHost: "", siteTag: REV }, sum: { visits: 3 } },
    { count: 1, dimensions: { refererHost: "www.ifacnet.com", siteTag: COOLBEANS }, sum: { visits: 1 } },
    { count: 1, dimensions: { refererHost: "", siteTag: SECM }, sum: { visits: 1 } },
  ],
  appareils: [
    { count: 3, dimensions: { deviceType: "desktop", siteTag: REV }, sum: { visits: 3 } },
    { count: 1, dimensions: { deviceType: "desktop", siteTag: COOLBEANS }, sum: { visits: 1 } },
    { count: 4, dimensions: { deviceType: "desktop", siteTag: SALON }, sum: { visits: 4 } },
    { count: 1, dimensions: { deviceType: "desktop", siteTag: SECM }, sum: { visits: 1 } },
  ],
};

const vide = (): ReponseJour => ({ totaux: [], pages: [], provenances: [], appareils: [] });

function groupe(
  siteTag: string,
  count: number,
  visits: number,
  dims: Record<string, string> = {},
  sampleInterval?: number,
) {
  return {
    count,
    sum: { visits },
    ...(sampleInterval === undefined ? {} : { avg: { sampleInterval } }),
    dimensions: { siteTag, ...dims },
  };
}

describe("normaliserJour", () => {
  it("rend un JourAnalytics par site, sur une réponse réelle", () => {
    const jours = normaliserJour("2026-09-26", REPONSE_26_SEPTEMBRE);
    expect(jours).toHaveLength(4);
    expect(jours.find((j) => j.siteTag === SALON)).toEqual({
      siteTag: SALON,
      jour: "2026-09-26",
      visites: 4,
      pagesVues: 4,
      echantillon: 1,
      pages: [{ valeur: "/", visites: 4, pagesVues: 4 }],
      provenances: [{ valeur: "", visites: 4, pagesVues: 4 }],
      appareils: [{ valeur: "desktop", visites: 4, pagesVues: 4 }],
    });
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.provenances).toEqual([
      { valeur: "www.ifacnet.com", visites: 1, pagesVues: 1 },
    ]);
  });

  it("écarte la navigation interne, que Cloudflare compte à 0 visite", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 5, 2, {}, 1));
    r.provenances.push(
      groupe(SALON, 3, 0, { refererHost: "construire-habiter-autrement.org" }),
      groupe(SALON, 2, 2, { refererHost: "" }),
    );
    expect(normaliserJour("2026-09-26", r)[0].provenances).toEqual([
      { valeur: "", visites: 2, pagesVues: 2 },
    ]);
  });

  it("range un appareil vide dans « autre » et fusionne les doublons", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.appareils.push(
      groupe(SALON, 1, 1, { deviceType: "" }),
      groupe(SALON, 2, 2, { deviceType: "autre" }),
    );
    expect(normaliserJour("2026-09-26", r)[0].appareils).toEqual([
      { valeur: "autre", visites: 3, pagesVues: 3 },
    ]);
  });

  it("range un chemin vide sous « / »", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 1, 1, {}, 1));
    r.pages.push(groupe(SALON, 1, 1, { requestPath: "" }));
    expect(normaliserJour("2026-09-26", r)[0].pages).toEqual([
      { valeur: "/", visites: 1, pagesVues: 1 },
    ]);
  });

  it("arrondit l'échantillonnage au-dessus : 1 exact, 10 estimé", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 10, 10, {}, 10), groupe(COOLBEANS, 3, 3, {}, 1.5), groupe(REV, 1, 1));
    const jours = normaliserJour("2026-09-26", r);
    expect(jours.find((j) => j.siteTag === SALON)?.echantillon).toBe(10);
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.echantillon).toBe(2);
    expect(jours.find((j) => j.siteTag === REV)?.echantillon).toBe(1);
  });

  it("ignore une répartition dont le site n'a pas de total", () => {
    const r = vide();
    r.pages.push(groupe(SALON, 1, 1, { requestPath: "/" }));
    expect(normaliserJour("2026-09-26", r)).toEqual([]);
  });
});

describe("sourceCloudflare", () => {
  const repondre = (corps: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(corps), { status }));

  it("interroge l'API GraphQL pour un jour, avec le jeton", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [REPONSE_26_SEPTEMBRE] } }, errors: null });
    const jours = await sourceCloudflare({ token: "jeton", compte: "c9736", fetch })("2026-09-26");
    expect(jours).toHaveLength(4);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GRAPHQL_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jeton");
    expect(JSON.parse(init.body as string).variables).toEqual({ compte: "c9736", jour: "2026-09-26" });
  });

  it("lève sur une erreur GraphQL, avec le message de l'API", async () => {
    const fetch = repondre({ data: null, errors: [{ message: "not authorized for that account" }] });
    await expect(sourceCloudflare({ token: "x", compte: "y", fetch })("2026-09-26")).rejects.toThrow(
      "not authorized for that account",
    );
  });

  it("lève sur une réponse HTTP en erreur", async () => {
    const fetch = repondre({}, 500);
    await expect(sourceCloudflare({ token: "x", compte: "y", fetch })("2026-09-26")).rejects.toThrow(
      "HTTP 500",
    );
  });

  it("lève si le compte manque dans la réponse", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [] } } });
    await expect(sourceCloudflare({ token: "x", compte: "y", fetch })("2026-09-26")).rejects.toThrow(
      "compte introuvable",
    );
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/analytics/cloudflare.test.ts`
Expected: FAIL, module `./cloudflare` introuvable.

- [ ] **Step 4: Écrire l'adaptateur**

`src/lib/analytics/cloudflare.ts` :

```ts
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
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/analytics/cloudflare.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/types.ts src/lib/analytics/cloudflare.ts src/lib/analytics/cloudflare.test.ts
git commit -m "feat(portail): adaptateur Cloudflare Web Analytics, un jour exact à la fois (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration D1 et stockage

**Files:**
- Create: `migrations/0011_analytics.sql`
- Create: `src/lib/analytics/store.ts`
- Create: `src/lib/analytics/d1-sqlite.testutil.ts`
- Test: `src/lib/analytics/store.test.ts`

**Interfaces:**
- Consumes: `JourAnalytics`, `Dimension` de `./types` (tâche 1).
- Produces:
  - `interface D1Statement { bind(...valeurs: unknown[]): D1Statement; run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }> }`
  - `interface D1Analytics { prepare(sql: string): D1Statement; batch(instructions: D1Statement[]): Promise<unknown> }`
  - `interface LigneJour { jour: string; visites: number; pagesVues: number; echantillon: number }`
  - `interface LigneRepartition { dimension: Dimension; valeur: string; visites: number; pagesVues: number }`
  - `ecrireJour(db, jour: string, sites: JourAnalytics[], collecteLe: string): Promise<void>`
  - `lireJours(db, siteTag: string, du: string, au: string): Promise<LigneJour[]>`
  - `lireRepartitions(db, siteTag: string, du: string, au: string): Promise<LigneRepartition[]>` (sommées par `dimension, valeur` sur la période)
  - `lireCollectes(db, du: string, au: string): Promise<string[]>` (jours triés croissants)
  - `etatCollecte(db): Promise<{ premierJour: string | null; derniereCollecte: string | null }>`
  - `d1Sqlite(migrations?: string[]): { db: D1Analytics; sqlite: DatabaseSync }` (aide de test, migrations par défaut `["0011_analytics.sql"]`)

- [ ] **Step 1: Écrire la migration**

`migrations/0011_analytics.sql` :

```sql
-- Mesures d'audience des sites clients (COO-16, spec
-- 2026-09-29-portail-analytics-design.md §3.3).
--
-- Cloudflare Web Analytics ne rend des chiffres exacts que pour un jour isolé
-- des sept derniers jours. Le cron les relit chaque nuit et les stocke ici :
-- cette base devient l'historique exact, que Cloudflare ne garde pas.
--
-- Un jour s'écrit d'un bloc (efface puis réécrit) : une page qui n'a plus de
-- visite ce jour-là disparaît aussi de la base.

CREATE TABLE analytics_jours (
  site_tag    TEXT NOT NULL,              -- identifiant du site chez Cloudflare
  jour        TEXT NOT NULL,              -- AAAA-MM-JJ, UTC
  visites     INTEGER NOT NULL,
  pages_vues  INTEGER NOT NULL,
  echantillon INTEGER NOT NULL DEFAULT 1, -- 1 = exact, 10 = une mesure sur dix
  PRIMARY KEY (site_tag, jour)
);

CREATE TABLE analytics_repartitions (
  site_tag   TEXT NOT NULL,
  jour       TEXT NOT NULL,
  dimension  TEXT NOT NULL CHECK (dimension IN ('page', 'provenance', 'appareil')),
  valeur     TEXT NOT NULL,               -- chemin, host d'origine ('' = accès direct), type d'appareil
  visites    INTEGER NOT NULL,
  pages_vues INTEGER NOT NULL,
  PRIMARY KEY (site_tag, jour, dimension, valeur)
);

-- Jours effectivement collectés, tous sites confondus. Distingue un jour sans
-- trafic (collecté, aucune ligne) d'un jour jamais collecté (absent). C'est
-- aussi la preuve que le cron tourne : ses journaux ne sont pas consultables.
CREATE TABLE analytics_collectes (
  jour        TEXT PRIMARY KEY,
  collecte_le TEXT NOT NULL               -- ISO 8601
);
```

- [ ] **Step 2: Écrire l'aide de test SQLite**

`src/lib/analytics/d1-sqlite.testutil.ts` (le suffixe `.testutil.ts` le tient hors de la collecte de Vitest, qui ne ramasse que `*.test.ts`) :

```ts
/* Rejoue les migrations telles qu'elles partiront en production, contre
 * SQLite, derrière une façade qui imite l'API D1 utilisée par le module
 * analytics. Même raison que src/lib/documents/reponses.sqlite.test.ts :
 * comparer des chaînes SQL ne dit pas qu'elles s'exécutent. */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { D1Analytics, D1Statement } from "./store";

interface Instruction extends D1Statement {
  executer(): void;
}

export function d1Sqlite(migrations: string[] = ["0011_analytics.sql"]): {
  db: D1Analytics;
  sqlite: DatabaseSync;
} {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of migrations) {
    sqlite.exec(
      readFileSync(fileURLToPath(new URL(`../../../migrations/${m}`, import.meta.url)), "utf8"),
    );
  }

  const instruction = (sql: string, valeurs: unknown[]): Instruction => ({
    bind: (...v: unknown[]) => instruction(sql, v),
    run: async () => sqlite.prepare(sql).run(...(valeurs as never[])),
    // Copie en objets ordinaires : node:sqlite rend des objets sans prototype.
    all: async <T>() => ({
      results: sqlite.prepare(sql).all(...(valeurs as never[])).map((r) => ({ ...r })) as T[],
    }),
    executer: () => {
      sqlite.prepare(sql).run(...(valeurs as never[]));
    },
  });

  const db: D1Analytics = {
    prepare: (sql) => instruction(sql, []),
    // D1 exécute un batch dans une transaction : on fait de même.
    batch: async (instructions) => {
      sqlite.exec("BEGIN");
      try {
        for (const i of instructions) (i as Instruction).executer();
        sqlite.exec("COMMIT");
      } catch (erreur) {
        sqlite.exec("ROLLBACK");
        throw erreur;
      }
      return [];
    },
  };
  return { db, sqlite };
}
```

- [ ] **Step 3: Écrire le test qui échoue**

`src/lib/analytics/store.test.ts` :

```ts
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
```

- [ ] **Step 4: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/analytics/store.test.ts`
Expected: FAIL, module `./store` introuvable.

- [ ] **Step 5: Écrire le stockage**

`src/lib/analytics/store.ts` :

```ts
// Stockage D1 des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3.3).
//
// Un jour s'écrit d'un bloc, dans un seul `batch` : on efface tout ce qu'on
// savait de ce jour, puis on réécrit. Une page qui n'a plus de visite ce
// jour-là disparaît donc aussi, ce qu'un INSERT OR REPLACE ne ferait pas. Et
// un seul batch par jour tient la collecte loin du plafond de 50 requêtes par
// exécution du plan Workers Free.

import type { Dimension, JourAnalytics } from "./types";

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
```

- [ ] **Step 6: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/analytics/store.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Appliquer la migration à la base locale**

Run: `npx wrangler d1 migrations apply coolbeans-portal --local`
Expected: `0011_analytics.sql` appliquée, sans erreur. Base locale seulement : jamais `--remote`.

- [ ] **Step 8: Commit**

```bash
git add migrations/0011_analytics.sql src/lib/analytics/store.ts src/lib/analytics/d1-sqlite.testutil.ts src/lib/analytics/store.test.ts
git commit -m "feat(portail): tables D1 des mesures d'audience et leur stockage (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Collecte quotidienne et branchement du cron

**Files:**
- Create: `src/lib/analytics/collecte.ts`
- Test: `src/lib/analytics/collecte.test.ts`
- Modify: `src/worker.ts` (imports en tête, handler `scheduled`)
- Modify: `wrangler.jsonc` (commentaire du cron, `vars` de prod et de `env.staging`)
- Modify: `src/worker-env.d.ts` (interface `PortalSecrets`)
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: `SourceAnalytics`, `JourAnalytics` (tâche 1), `sourceCloudflare` (tâche 1), `D1Analytics`, `ecrireJour` (tâche 2), `d1Sqlite`, `lireJours`, `lireCollectes` (tâche 2, tests).
- Produces:
  - `JOURS_EXACTS = 7`
  - `estHeureDeCollecte(date: Date): boolean`
  - `joursACollecter(maintenant: Date): string[]` (J-1 à J-7, du plus récent au plus ancien)
  - `interface ResultatCollecte { collectes: string[]; echecs: Array<{ jour: string; message: string }> }`
  - `collecterAnalytics(o: { db: D1Analytics; source: SourceAnalytics; maintenant: Date }): Promise<ResultatCollecte>`

- [ ] **Step 1: Écrire le test qui échoue**

`src/lib/analytics/collecte.test.ts` :

```ts
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
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/analytics/collecte.test.ts`
Expected: FAIL, module `./collecte` introuvable.

- [ ] **Step 3: Écrire la collecte**

`src/lib/analytics/collecte.ts` :

```ts
// Collecte quotidienne des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3.2).
//
// Chaque nuit, relit J-1 à J-7 un jour à la fois et les réécrit dans D1.
// Relire la semaine entière rattrape les mesures arrivées en retard et une
// panne de moins de sept jours. Au-delà, Cloudflare n'a plus que des chiffres
// estimés, qui écraseraient nos chiffres exacts : on n'y touche jamais.

import { ecrireJour, type D1Analytics } from "./store";
import type { SourceAnalytics } from "./types";

/** Jours que Cloudflare garde exacts, donc relus à chaque passage. */
export const JOURS_EXACTS = 7;

/**
 * La collecte prend le second passage du cron de 04:00 UTC (04:05 à 04:09).
 * Le premier passage de chaque heure appartient à la synchronisation
 * Livraisons (src/worker.ts) : les séparer tient chacune loin du plafond de
 * 50 appels par exécution.
 */
export function estHeureDeCollecte(date: Date): boolean {
  const minutes = date.getUTCMinutes();
  return date.getUTCHours() === 4 && minutes >= 5 && minutes < 10;
}

/** J-1 à J-7 (UTC) par rapport à `maintenant`, du plus récent au plus ancien. */
export function joursACollecter(maintenant: Date): string[] {
  const jours: string[] = [];
  for (let i = 1; i <= JOURS_EXACTS; i++) {
    const jour = new Date(
      Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - i),
    );
    jours.push(jour.toISOString().slice(0, 10));
  }
  return jours;
}

export interface ResultatCollecte {
  collectes: string[];
  echecs: Array<{ jour: string; message: string }>;
}

export async function collecterAnalytics(o: {
  db: D1Analytics;
  source: SourceAnalytics;
  maintenant: Date;
}): Promise<ResultatCollecte> {
  const resultat: ResultatCollecte = { collectes: [], echecs: [] };
  const collecteLe = o.maintenant.toISOString();
  // Un jour après l'autre : un échec reste confiné à son jour, et on ne
  // sollicite jamais plus d'une connexion D1 à la fois.
  for (const jour of joursACollecter(o.maintenant)) {
    try {
      const sites = (await o.source(jour)).filter((s) => s.jour === jour);
      await ecrireJour(o.db, jour, sites, collecteLe);
      resultat.collectes.push(jour);
    } catch (erreur) {
      resultat.echecs.push({
        jour,
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
  }
  return resultat;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/analytics/collecte.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Brancher la collecte dans le cron**

Dans `src/worker.ts`, ajouter aux imports, après `import { synchroniserLivraisons } from "./lib/livraisons/sync";` :

```ts
import { collecterAnalytics, estHeureDeCollecte } from "./lib/analytics/collecte";
import { sourceCloudflare } from "./lib/analytics/cloudflare";
import type { D1Analytics } from "./lib/analytics/store";
```

Dans le handler `scheduled`, insérer ce bloc juste après la ligne `const scheduledAt = new Date(controller.scheduledTime).toISOString();` et **avant** le garde-fou `if (!env.LINEAR_API_KEY || !env.RESEND_API_KEY || !env.PORTAL_DB)`, qui fait un `return` :

```ts
    // Analytics (COO-16) : collecte quotidienne des mesures Cloudflare Web
    // Analytics, au second passage de 04:00 UTC. Placée avant le garde-fou de
    // la messagerie, qui sort du handler : elle ne dépend ni de Linear ni de
    // Resend. Sans jeton, la tâche se saute, ce qui laisse staging et prod
    // indépendants.
    if (estHeureDeCollecte(new Date(controller.scheduledTime))) {
      if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID || !env.PORTAL_DB) {
        console.log(JSON.stringify({ event: "analytics_collecte", status: "skipped_missing_secrets", scheduled_at: scheduledAt }));
      } else {
        ctx.waitUntil(
          collecterAnalytics({
            db: env.PORTAL_DB as unknown as D1Analytics,
            source: sourceCloudflare({ token: env.CF_ANALYTICS_TOKEN, compte: env.CF_ACCOUNT_ID }),
            maintenant: new Date(controller.scheduledTime),
          })
            .then((r) =>
              console.log(JSON.stringify({ event: "analytics_collecte", status: r.echecs.length > 0 ? "partial" : "ok", ...r, scheduled_at: scheduledAt })),
            )
            .catch((err) =>
              console.log(JSON.stringify({ event: "analytics_collecte", status: "error", message: String(err), scheduled_at: scheduledAt })),
            ),
        );
      }
    }
```

- [ ] **Step 6: Déclarer le secret et la variable**

Dans `src/worker-env.d.ts`, ajouter à la fin de `interface PortalSecrets`, après `GOOGLE_CALENDAR_LIVRAISONS_ID?: string;` :

```ts

  /**
   * Jeton API Cloudflare, permission « Account Analytics : Read » sur le
   * compte Coolbeans : collecte Analytics du cron (COO-16,
   * lib/analytics/collecte.ts). `wrangler secret put CF_ANALYTICS_TOKEN` sur
   * chaque environnement. Absent, la collecte se saute.
   */
  CF_ANALYTICS_TOKEN?: string;
```

Dans `wrangler.jsonc` :

1. À la fin du long commentaire qui précède `"triggers"`, avant la ligne `"triggers": { "crons": ["*/5 * * * *"] },`, ajouter :

```jsonc
  //
  // La collecte Analytics (COO-16) prend le second passage de 04:00 UTC, pour
  // ne pas partager l'exécution de la synchronisation Livraisons :
  // estHeureDeCollecte dans src/lib/analytics/collecte.ts.
```

2. Remplacer `"vars": { "PORTAL_BASE_URL": "https://my.coolbeans.cc" },` par :

```jsonc
  // CF_ACCOUNT_ID : compte Cloudflare dont la collecte Analytics lit les
  // mesures (COO-16). Un identifiant, pas un secret : le jeton, lui, est posé
  // par `wrangler secret put CF_ANALYTICS_TOKEN`.
  "vars": { "PORTAL_BASE_URL": "https://my.coolbeans.cc", "CF_ACCOUNT_ID": "c973603680fd067768f1849fc1927069" },
```

3. Dans `env.staging`, remplacer `"vars": { "PORTAL_BASE_URL": "https://my-staging.coolbeans.cc" }` par :

```jsonc
      "vars": { "PORTAL_BASE_URL": "https://my-staging.coolbeans.cc", "CF_ACCOUNT_ID": "c973603680fd067768f1849fc1927069" }
```

Dans `.dev.vars.example`, ajouter à la fin :

```
# Jeton API Cloudflare, permission « Account Analytics : Read » sur le compte
# Coolbeans : collecte Analytics du cron (COO-16). Vide en local : la collecte
# se saute.
CF_ANALYTICS_TOKEN=
```

- [ ] **Step 7: Vérifier que la suite passe et que le Worker se construit**

Run: `npm test`
Expected: PASS, aucune régression.

Run: `npm run build`
Expected: build terminé sans erreur.

- [ ] **Step 8: Commit**

```bash
git add src/lib/analytics/collecte.ts src/lib/analytics/collecte.test.ts src/worker.ts wrangler.jsonc src/worker-env.d.ts .dev.vars.example
git commit -m "feat(portail): collecte Analytics quotidienne dans le cron, J-1 à J-7 (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Agrégation pour la page

**Files:**
- Create: `src/lib/analytics/tableau.ts`
- Test: `src/lib/analytics/tableau.test.ts`

**Interfaces:**
- Consumes: `SiteAnalytics`, `Dimension` (tâche 1), `D1Analytics`, `LigneJour`, `LigneRepartition`, `lireJours`, `lireRepartitions`, `lireCollectes`, `etatCollecte`, `ecrireJour`, `d1Sqlite` (tâche 2).
- Produces:
  - `type Periode = "30j" | "6m"`, `DUREE_JOURS: Record<Periode, number>`
  - `lirePeriode(valeur: string | null): Periode`
  - `choisirSite(sites: SiteAnalytics[], host: string | null): SiteAnalytics | null`
  - `fenetre(periode: Periode, maintenant: Date): { du: string; au: string }`
  - `lundiDe(jour: string): string`
  - `interface Barre { debut: string; visites: number; pagesVues: number }`
  - `interface Classement { libelle: string; valeur: number; part: number }`
  - `interface Tableau { visites; pagesVues; barres: Barre[]; pages: Classement[]; provenances: Classement[]; appareils: Classement[]; estime: boolean }`
  - `construireTableau(o: { periode: Periode; jours: LigneJour[]; repartitions: LigneRepartition[]; collectes: string[] }): Tableau`
  - `type Chargement = { ok: true; depuis: string | null; derniereCollecte: string | null; tableau: Tableau | null } | { ok: false }`
  - `chargerTableau(db: D1Analytics, o: { siteTag: string; periode: Periode; maintenant: Date }): Promise<Chargement>`

- [ ] **Step 1: Écrire le test qui échoue**

`src/lib/analytics/tableau.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { d1Sqlite } from "./d1-sqlite.testutil";
import { ecrireJour, type LigneJour, type LigneRepartition } from "./store";
import {
  chargerTableau,
  choisirSite,
  construireTableau,
  fenetre,
  lirePeriode,
  lundiDe,
} from "./tableau";

const SITE = "7257179f83b6445d93703f1d1f305a4a";
const AUTRE = "2ad7fb260e2a498a900a5d97d41b6853";
const MAINTENANT = new Date("2026-09-29T10:00:00Z");

describe("lirePeriode", () => {
  it("accepte 30j et 6m, retombe sur 30j pour tout le reste", () => {
    expect(lirePeriode("6m")).toBe("6m");
    expect(lirePeriode("30j")).toBe("30j");
    expect(lirePeriode(null)).toBe("30j");
    expect(lirePeriode("12m")).toBe("30j");
    expect(lirePeriode("6M")).toBe("30j");
  });
});

describe("choisirSite", () => {
  const sites = [
    { host: "revolutionsdouces.org", siteTag: "4b3f282e3f8a4d90ac63fbeb41577e72" },
    { host: "construire-habiter-autrement.org", siteTag: "7b1613c4d8524beaae503934203801a4" },
  ];

  it("rend le site demandé s'il appartient au client", () => {
    expect(choisirSite(sites, "construire-habiter-autrement.org")).toBe(sites[1]);
  });

  it("retombe sur le premier site pour un host absent", () => {
    expect(choisirSite(sites, null)).toBe(sites[0]);
  });

  it("ne sort jamais de la liste du client", () => {
    // Le host d'un autre client, ou un siteTag glissé à la place du host.
    expect(choisirSite(sites, "setencorpsmieux.fr")).toBe(sites[0]);
    expect(choisirSite(sites, "7257179f83b6445d93703f1d1f305a4a")).toBe(sites[0]);
  });

  it("rend null pour un client sans site", () => {
    expect(choisirSite([], "coolbeans.cc")).toBeNull();
  });
});

describe("fenetre", () => {
  it("couvre 30 jours finissant la veille, en UTC", () => {
    expect(fenetre("30j", MAINTENANT)).toEqual({ du: "2026-08-30", au: "2026-09-28" });
  });

  it("couvre 182 jours pour 6 mois", () => {
    expect(fenetre("6m", MAINTENANT)).toEqual({ du: "2026-03-31", au: "2026-09-28" });
  });
});

describe("lundiDe", () => {
  it("rend le lundi (UTC) de la semaine", () => {
    expect(lundiDe("2026-09-28")).toBe("2026-09-28"); // lundi
    expect(lundiDe("2026-09-27")).toBe("2026-09-21"); // dimanche
    expect(lundiDe("2026-10-01")).toBe("2026-09-28"); // jeudi
  });
});

describe("construireTableau", () => {
  const jours: LigneJour[] = [
    { jour: "2026-09-22", visites: 2, pagesVues: 3, echantillon: 1 },
    { jour: "2026-09-24", visites: 5, pagesVues: 8, echantillon: 1 },
    { jour: "2026-09-28", visites: 1, pagesVues: 1, echantillon: 1 },
  ];
  // Le 23 est collecté sans trafic ; du 25 au 27, rien n'a été collecté.
  const collectes = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-28"];
  const repartitions: LigneRepartition[] = [
    { dimension: "page", valeur: "/", visites: 6, pagesVues: 9 },
    { dimension: "page", valeur: "/contact", visites: 2, pagesVues: 3 },
    { dimension: "provenance", valeur: "", visites: 6, pagesVues: 8 },
    { dimension: "provenance", valeur: "m.facebook.com", visites: 2, pagesVues: 4 },
    { dimension: "appareil", valeur: "mobile", visites: 6, pagesVues: 9 },
    { dimension: "appareil", valeur: "desktop", visites: 2, pagesVues: 3 },
  ];
  const base = { periode: "30j" as const, jours, repartitions, collectes };

  it("totalise la période", () => {
    const t = construireTableau(base);
    expect(t.visites).toBe(8);
    expect(t.pagesVues).toBe(12);
  });

  it("une barre par jour collecté, à 0 sans trafic, aucune pour un jour jamais collecté", () => {
    expect(construireTableau(base).barres).toEqual([
      { debut: "2026-09-22", visites: 2, pagesVues: 3 },
      { debut: "2026-09-23", visites: 0, pagesVues: 0 },
      { debut: "2026-09-24", visites: 5, pagesVues: 8 },
      { debut: "2026-09-28", visites: 1, pagesVues: 1 },
    ]);
  });

  it("regroupe par semaine, du lundi, sur 6 mois", () => {
    expect(construireTableau({ ...base, periode: "6m" }).barres).toEqual([
      { debut: "2026-09-21", visites: 7, pagesVues: 11 },
      { debut: "2026-09-28", visites: 1, pagesVues: 1 },
    ]);
  });

  it("classe les pages par pages vues, la provenance et les appareils par visites", () => {
    const t = construireTableau(base);
    expect(t.pages).toEqual([
      { libelle: "/", valeur: 9, part: 0.75 },
      { libelle: "/contact", valeur: 3, part: 0.25 },
    ]);
    expect(t.provenances).toEqual([
      { libelle: "Accès direct", valeur: 6, part: 0.75 },
      { libelle: "m.facebook.com", valeur: 2, part: 0.25 },
    ]);
    expect(t.appareils).toEqual([
      { libelle: "Mobile", valeur: 6, part: 0.75 },
      { libelle: "Ordinateur", valeur: 2, part: 0.25 },
    ]);
  });

  it("garde les 10 premières pages, les égalités par ordre alphabétique", () => {
    const beaucoup: LigneRepartition[] = Array.from({ length: 12 }, (_, i) => ({
      dimension: "page",
      valeur: `/p${String(i).padStart(2, "0")}`,
      visites: 1,
      pagesVues: 1,
    }));
    const t = construireTableau({ ...base, repartitions: beaucoup });
    expect(t.pages).toHaveLength(10);
    expect(t.pages[0].libelle).toBe("/p00");
    expect(t.pages[9].libelle).toBe("/p09");
  });

  it("signale un jour estimé par Cloudflare", () => {
    expect(construireTableau(base).estime).toBe(false);
    const estimes = [...jours, { jour: "2026-09-23", visites: 10, pagesVues: 10, echantillon: 10 }];
    expect(construireTableau({ ...base, jours: estimes }).estime).toBe(true);
  });

  it("ne divise jamais par zéro", () => {
    const t = construireTableau({ periode: "30j", jours: [], repartitions: [], collectes: ["2026-09-28"] });
    expect(t.visites).toBe(0);
    expect(t.pages).toEqual([]);
    expect(t.barres).toEqual([{ debut: "2026-09-28", visites: 0, pagesVues: 0 }]);
  });
});

describe("chargerTableau", () => {
  const mesure = (siteTag: string, jour: string) => ({
    siteTag,
    jour,
    visites: 2,
    pagesVues: 3,
    echantillon: 1,
    pages: [{ valeur: "/", visites: 2, pagesVues: 3 }],
    provenances: [],
    appareils: [],
  });

  it("rend un tableau nul tant qu'aucun jour n'est collecté", async () => {
    const { db } = d1Sqlite();
    expect(await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT })).toEqual({
      ok: true,
      depuis: null,
      derniereCollecte: null,
      tableau: null,
    });
  });

  it("lit D1 et construit le tableau du site", async () => {
    const { db } = d1Sqlite();
    await ecrireJour(db, "2026-09-28", [mesure(SITE, "2026-09-28")], "2026-09-29T04:05:00.000Z");
    const r = await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT });
    if (!r.ok) throw new Error("chargement en échec");
    expect(r.depuis).toBe("2026-09-28");
    expect(r.derniereCollecte).toBe("2026-09-29T04:05:00.000Z");
    expect(r.tableau?.visites).toBe(2);
  });

  it("ne montre jamais les chiffres d'un autre site", async () => {
    const { db } = d1Sqlite();
    await ecrireJour(db, "2026-09-28", [mesure(AUTRE, "2026-09-28")], "2026-09-29T04:05:00.000Z");
    const r = await chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT });
    if (!r.ok) throw new Error("chargement en échec");
    expect(r.tableau?.visites).toBe(0);
    expect(r.tableau?.pages).toEqual([]);
  });

  it("rend ok: false quand D1 échoue, sans lever", async () => {
    // Aucune migration : les tables n'existent pas.
    const { db } = d1Sqlite([]);
    await expect(
      chargerTableau(db, { siteTag: SITE, periode: "30j", maintenant: MAINTENANT }),
    ).resolves.toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/analytics/tableau.test.ts`
Expected: FAIL, module `./tableau` introuvable.

- [ ] **Step 3: Écrire l'agrégation**

`src/lib/analytics/tableau.ts` :

```ts
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
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/analytics/tableau.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/tableau.ts src/lib/analytics/tableau.test.ts
git commit -m "feat(portail): agrégation des mesures pour la page Analytics (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Registre des clients et entrée du menu

**Files:**
- Modify: `src/content.config.ts` (schéma de la collection `clients`, après `uptimerobot_monitor_ids`)
- Modify: `src/lib/portail/workspaces.ts` (`PortalWorkspace`, `PortalModule`, `WorkspaceMappingKey`, `MODULE_REQUIREMENTS`, `hasMapping`)
- Modify: `src/lib/portail/nav.ts:145` (entrée Analytics)
- Modify: `src/content/clients/coolbeans.yaml`, `setencorpsmieux.yaml`, `spinoza.yaml`, `revolutions-douces.yaml`
- Test: `src/lib/portail/workspaces.test.ts`, `src/lib/portail/nav.test.ts`

**Interfaces:**
- Consumes: `SiteAnalytics` de `src/lib/analytics/types.ts` (tâche 1).
- Produces: `PortalWorkspace.analytics?: SiteAnalytics[]`, module `"analytics"` et clé `"analytics"` reconnus par `missingKeysFor`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/lib/portail/workspaces.test.ts`, dans le `describe("missingKeysFor", ...)`, avant le test « traite un tableau de monitors vide comme une clé manquante », ajouter :

```ts
  // Analytics (COO-16) : la liste des sites mesurés raccorde le module.
  it("réclame la liste des sites pour Analytics", () => {
    const site = { host: "coolbeans.cc", siteTag: "2ad7fb260e2a498a900a5d97d41b6853" };
    expect(missingKeysFor("analytics", coolbeans)).toEqual(["analytics"]);
    expect(missingKeysFor("analytics", { ...coolbeans, analytics: [] })).toEqual(["analytics"]);
    expect(missingKeysFor("analytics", { ...coolbeans, analytics: [site] })).toEqual([]);
    expect(missingKeysFor("analytics", null)).toEqual(["analytics"]);
  });
```

Dans `src/lib/portail/nav.test.ts`, ajouter un bloc après `describe("buildSidebar · côté admin", ...)` :

```ts
describe("buildSidebar · Analytics", () => {
  const mesure: PortalWorkspace = {
    ...avecDoc,
    analytics: [{ host: "amusoire.fr", siteTag: "0123456789abcdef0123456789abcdef" }],
  };

  it("montre Analytics au client dont le site est raccordé", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, mesure, docPages));
    const analytics = pages.find((p) => p.label === "Analytics");
    expect(analytics?.section).toBe("site");
    expect(analytics?.wip).toBe(false);
  });

  it("la cache au client sans site raccordé", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, avecDoc, docPages));
    expect(pages.find((p) => p.label === "Analytics")).toBeUndefined();
  });

  it("la montre en wip à l'admin quand le site manque", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", admin, avecDoc, docPages));
    expect(pages.find((p) => p.label === "Analytics")?.wip).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/workspaces.test.ts src/lib/portail/nav.test.ts`
Expected: FAIL, `missingKeysFor("analytics", ...)` rend `undefined` au lieu d'un tableau, et Analytics reste invisible côté client.

- [ ] **Step 3: Déclarer le module dans le registre**

Dans `src/lib/portail/workspaces.ts` :

1. En tête, après le bloc de commentaire d'ouverture, ajouter :

```ts
import type { SiteAnalytics } from "../analytics/types";
```

2. Dans `interface PortalWorkspace`, après `uptimerobot_monitor_ids: string[];` :

```ts
  /**
   * Sites mesurés par Cloudflare Web Analytics (COO-16). Optionnel comme
   * `messagerie` : le YAML porte un `.default([])`, mais les fiches construites
   * à la main (tests, design system) n'ont pas à le répéter.
   */
  analytics?: SiteAnalytics[];
```

3. Remplacer les deux types :

```ts
export type PortalModule = "projets" | "site" | "doc" | "support" | "analytics";

export type WorkspaceMappingKey = "doc" | "linearTeamId" | "uptimerobot_monitor_ids" | "analytics";
```

4. Dans `MODULE_REQUIREMENTS`, après `doc: ["doc"],` :

```ts
  analytics: ["analytics"],
```

5. Dans `hasMapping`, après le `case "uptimerobot_monitor_ids":` et son `return` :

```ts
    case "analytics":
      return (client.analytics?.length ?? 0) > 0;
```

Dans `src/content.config.ts`, dans le schéma `clients`, après la ligne `uptimerobot_monitor_ids: z.array(z.string()).default([]),` :

```ts
    /* Sites mesurés par Cloudflare Web Analytics (COO-16, spec
       2026-09-29-portail-analytics-design.md §4). `siteTag` vient de l'API
       Cloudflare (GET /accounts/<compte>/rum/site_info/list, champ
       `site_tag`). Vide = page Analytics en empty state. */
    analytics: z
      .array(z.object({ host: z.string(), siteTag: z.string().regex(/^[0-9a-f]{32}$/) }))
      .default([]),
```

Dans `src/lib/portail/nav.ts`, remplacer la ligne :

```ts
      { label: "Analytics", path: "/analytics", flag: "wip" }, // COO-16
```

par :

```ts
      {
        label: "Analytics",
        path: "/analytics",
        flag: "live", // COO-16
        configured: (c) => missingKeysFor("analytics", c).length === 0,
      },
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/workspaces.test.ts src/lib/portail/nav.test.ts`
Expected: PASS, anciens et nouveaux tests.

- [ ] **Step 5: Raccorder les quatre clients**

Ajouter à la fin de chaque fichier. Les commentaires YAML sont relus par le hook : pas de « : » précédé d'une espace ordinaire.

`src/content/clients/coolbeans.yaml` :

```yaml
# Sites mesurés par Cloudflare Web Analytics (COO-16).
analytics:
  - host: coolbeans.cc
    siteTag: 2ad7fb260e2a498a900a5d97d41b6853
```

`src/content/clients/setencorpsmieux.yaml` :

```yaml
# Sites mesurés par Cloudflare Web Analytics (COO-16).
analytics:
  - host: setencorpsmieux.fr
    siteTag: 7257179f83b6445d93703f1d1f305a4a
```

`src/content/clients/spinoza.yaml` :

```yaml
# Sites mesurés par Cloudflare Web Analytics (COO-16). Scolies est le site du
# projet Spinoza.
analytics:
  - host: scolies.fr
    siteTag: 1172e579f52c48b8b0e28135a61188ad
```

`src/content/clients/revolutions-douces.yaml` :

```yaml
# Sites mesurés par Cloudflare Web Analytics (COO-16). Le site de l'association
# d'abord, celui du salon ensuite : la page Analytics ouvre sur le premier.
analytics:
  - host: revolutionsdouces.org
    siteTag: 4b3f282e3f8a4d90ac63fbeb41577e72
  - host: construire-habiter-autrement.org
    siteTag: 7b1613c4d8524beaae503934203801a4
```

- [ ] **Step 6: Vérifier la suite et le build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: build terminé, aucune erreur de schéma sur `src/content/clients/`.

- [ ] **Step 7: Commit**

```bash
git add src/content.config.ts src/lib/portail/workspaces.ts src/lib/portail/workspaces.test.ts src/lib/portail/nav.ts src/lib/portail/nav.test.ts src/content/clients/coolbeans.yaml src/content/clients/setencorpsmieux.yaml src/content/clients/spinoza.yaml src/content/clients/revolutions-douces.yaml
git commit -m "feat(portail): module Analytics dans le registre clients et le menu (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Page Analytics

**Files:**
- Modify (réécriture complète): `src/pages/espace/analytics.astro`
- Create: `src/components/portail/BarresVisites.astro`
- Create: `src/components/portail/ClassementAnalytics.astro`

**Interfaces:**
- Consumes: `chargerTableau`, `choisirSite`, `lirePeriode`, `Periode`, `Barre`, `Classement` (tâche 4), `D1Analytics` (tâche 2), `missingKeysFor("analytics", ...)` et `client.analytics` (tâche 5).
- Produces: la page rendue. Rien d'autre n'en dépend.

- [ ] **Step 1: Relire les conventions d'interface**

Lire `src/pages/design-system.astro` (labels `.label field-label`, cartes composées en utilitaires comme `src/components/portail/EmptyState.astro`, jamais la classe `card` dans /espace) et le skill `dataviz` pour le graphique. Si un écart apparaît avec le code ci-dessous, suivre le design system et le noter dans le rapport de tâche.

- [ ] **Step 2: Écrire le graphique**

`src/components/portail/BarresVisites.astro` :

```astro
---
// Graphique des visites de la page Analytics (spec 2026-09-29-portail-analytics-design.md §5).
//
// SVG rendu côté serveur, sans JavaScript. Une barre par jour sur 30 jours,
// par semaine (du lundi) sur 6 mois. Un jour collecté sans visite garde sa
// place à hauteur nulle : le creux se voit. Les dates sont en HTML sous le
// SVG, pour garder une taille de texte lisible quelle que soit la largeur.
import type { Barre, Periode } from "../../lib/analytics/tableau";

interface Props {
  barres: Barre[];
  periode: Periode;
}

const { barres, periode } = Astro.props;

const LARGEUR = 600;
const HAUTEUR = 140;
const max = Math.max(1, ...barres.map((b) => b.visites));
const pas = LARGEUR / Math.max(1, barres.length);
const largeurBarre = Math.max(2, pas * 0.7);
const court = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const date = (jour: string) => court.format(new Date(`${jour}T00:00:00Z`));
const unite = periode === "6m" ? "par semaine" : "par jour";
const libelle = (b: Barre) =>
  `${periode === "6m" ? "Semaine du " : ""}${date(b.debut)}, ${b.visites} visite${b.visites > 1 ? "s" : ""}`;
const hauteur = (b: Barre) => (b.visites === 0 ? 0 : Math.max(2, (b.visites / max) * (HAUTEUR - 1)));
const premiere = barres[0];
const derniere = barres.at(-1);
const resume =
  premiere && derniere
    ? `Visites ${unite}, du ${date(premiere.debut)} au ${date(derniere.debut)}, maximum ${max}`
    : `Visites ${unite}`;
---

<figure class="mt-6x rounded-card border border-line bg-surface p-6x">
  <figcaption class="flex items-baseline justify-between gap-3x">
    <span class="label field-label">Visites {unite}</span>
    <span class="text-xs text-mute tabular-nums">max. {max}</span>
  </figcaption>
  <svg
    viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
    preserveAspectRatio="none"
    class="mt-4x block h-35 w-full text-ink"
    role="img"
    aria-label={resume}
  >
    {
      barres.map((b, i) => (
        <rect
          x={i * pas + (pas - largeurBarre) / 2}
          y={HAUTEUR - 1 - hauteur(b)}
          width={largeurBarre}
          height={hauteur(b)}
          fill="currentColor"
        >
          <title>{libelle(b)}</title>
        </rect>
      ))
    }
    <line
      x1="0"
      x2={LARGEUR}
      y1={HAUTEUR - 0.5}
      y2={HAUTEUR - 0.5}
      stroke="var(--line-strong)"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  {
    premiere && derniere && (
      <div class="mt-2x flex justify-between text-xs text-mute tabular-nums">
        <span>{date(premiere.debut)}</span>
        <span>{date(derniere.debut)}</span>
      </div>
    )
  }
</figure>
```

- [ ] **Step 3: Écrire la liste classée**

`src/components/portail/ClassementAnalytics.astro` :

```astro
---
// Liste classée de la page Analytics : libellé, valeur, part de la période.
import type { Classement } from "../../lib/analytics/tableau";

interface Props {
  titre: string;
  lignes: Classement[];
  /** Phrase affichée quand la liste est vide. */
  vide: string;
}

const { titre, lignes, vide } = Astro.props;
const nombre = new Intl.NumberFormat("fr-FR");
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const largeur = (l: Classement) => `width: ${Math.round(l.part * 100)}%`;
---

<section class="rounded-card border border-line bg-surface p-6x">
  <h2 class="label field-label">{titre}</h2>
  {lignes.length === 0 && <p class="mt-4x text-sm text-mute">{vide}</p>}
  {
    lignes.length > 0 && (
      <ol class="mt-4x grid gap-3x">
        {lignes.map((l) => (
          <li>
            <div class="flex items-baseline justify-between gap-3x text-sm">
              <span class="min-w-0 truncate" title={l.libelle}>
                {l.libelle}
              </span>
              <span class="shrink-0 text-mute tabular-nums">
                {nombre.format(l.valeur)} · {pourcent.format(l.part)}
              </span>
            </div>
            <div class="mt-1 h-1 rounded-full bg-surface-raise" aria-hidden="true">
              <div class="h-1 rounded-full bg-ink" style={largeur(l)} />
            </div>
          </li>
        ))}
      </ol>
    )
  }
</section>
```

- [ ] **Step 4: Réécrire la page**

`src/pages/espace/analytics.astro`, contenu complet :

```astro
---
// Analytics (COO-16, spec 2026-09-29-portail-analytics-design.md §5).
//
// La fréquentation du site du client, lue dans D1. La page ne parle jamais à
// Cloudflare : la collecte quotidienne (src/lib/analytics/collecte.ts) s'en
// charge. Le site affiché vient TOUJOURS de la liste du client courant : le
// paramètre `site` est un host cherché dans cette liste, jamais un siteTag.
export const prerender = false;

import EspaceLayout from "../../layouts/EspaceLayout.astro";
import EmptyState from "../../components/portail/EmptyState.astro";
import BarresVisites from "../../components/portail/BarresVisites.astro";
import ClassementAnalytics from "../../components/portail/ClassementAnalytics.astro";
import { env } from "cloudflare:workers";
import { missingKeysFor } from "../../lib/portail/workspaces";
import { getPortalContext } from "../../lib/portail/context";
import { isAdmin } from "../../lib/portail/metadata";
import {
  chargerTableau,
  choisirSite,
  lirePeriode,
  type Periode,
} from "../../lib/analytics/tableau";
import type { D1Analytics } from "../../lib/analytics/store";

const { meta, client } = await getPortalContext(Astro);
const admin = isAdmin(meta);
const missingKeys = missingKeysFor("analytics", client);
const sites = client?.analytics ?? [];
const site = choisirSite(sites, Astro.url.searchParams.get("site"));
const periode = lirePeriode(Astro.url.searchParams.get("periode"));

Astro.response.headers.set("Cache-Control", "no-store");

const chargement = site
  ? await chargerTableau(env.PORTAL_DB as unknown as D1Analytics, {
      siteTag: site.siteTag,
      periode,
      maintenant: new Date(),
    })
  : null;
const tableau = chargement?.ok ? chargement.tableau : null;
const depuis = chargement?.ok ? chargement.depuis : null;
const derniereCollecte = chargement?.ok ? chargement.derniereCollecte : null;

// Un seul état affiché à la fois, décidé ici plutôt que par des ternaires
// dans le template.
type Etat = "non-raccorde" | "indisponible" | "en-attente" | "pret";
const etat: Etat = !site
  ? "non-raccorde"
  : !chargement?.ok
    ? "indisponible"
    : !tableau
      ? "en-attente"
      : "pret";

/* Liens des sélecteurs : une chaîne de requête seule, relative à l'URL
   courante. Sur my.coolbeans.cc l'adresse vue par le navigateur est
   /analytics, pas /espace/analytics : un chemin absolu coûterait une
   redirection. */
function lien(o: { site?: string; periode?: Periode }): string {
  const params = new URLSearchParams();
  const host = o.site ?? site?.host;
  if (host && sites.length > 1) params.set("site", host);
  const p = o.periode ?? periode;
  if (p !== "30j") params.set("periode", p);
  return `?${params.toString()}`;
}

const PERIODES: Array<{ valeur: Periode; libelle: string }> = [
  { valeur: "30j", libelle: "30 jours" },
  { valeur: "6m", libelle: "6 mois" },
];

const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${jour}T00:00:00Z`));
const horodatage = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

const segment =
  "rounded-[4px] px-3x py-1 text-sm text-mute transition-colors hover:text-ink aria-[current=page]:bg-surface-raise aria-[current=page]:text-ink";
const courant = (actif: boolean) => (actif ? ("page" as const) : undefined);
---

<EspaceLayout title="Analytics">
  <h1>Analytics</h1>
  <p class="sub">L'audience de votre site, sans cookies.</p>

  {
    etat === "non-raccorde" && (
      <EmptyState title="Bientôt disponible" missingKeys={missingKeys} isAdmin={admin}>
        Les statistiques de fréquentation de votre site arriveront ici&nbsp;: visites, pages vues,
        provenance, sans cookies ni bannière.
      </EmptyState>
    )
  }

  {
    etat === "indisponible" && (
      <EmptyState title="Statistiques momentanément indisponibles">
        Les chiffres de votre site n'ont pas pu être chargés. Réessayez dans quelques minutes.
      </EmptyState>
    )
  }

  {
    site && (etat === "en-attente" || etat === "pret") && (
      <div class="mt-6x flex flex-wrap items-center gap-3x">
        {sites.length > 1 && (
          <div class="inline-flex rounded-control border border-line p-1" role="group" aria-label="Site">
            {sites.map((s) => (
              <a href={lien({ site: s.host })} aria-current={courant(s.host === site.host)} class={segment}>
                {s.host}
              </a>
            ))}
          </div>
        )}
        <div class="inline-flex rounded-control border border-line p-1" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <a href={lien({ periode: p.valeur })} aria-current={courant(p.valeur === periode)} class={segment}>
              {p.libelle}
            </a>
          ))}
        </div>
      </div>
    )
  }

  {
    etat === "en-attente" && (
      <div class="mt-6x">
        <EmptyState title="Les premiers chiffres arrivent demain matin">
          La collecte tourne chaque nuit. Les visites de la veille s'afficheront ici.
        </EmptyState>
      </div>
    )
  }

  {
    etat === "pret" && tableau && (
      <Fragment>
        {depuis && <p class="mt-3x text-sm text-mute">Données depuis le {dateLongue(depuis)}</p>}
        <dl class="mt-6x grid grid-cols-2 gap-6x">
          <div class="rounded-card border border-line bg-surface p-6x">
            <dt class="label field-label">Visites</dt>
            <dd class="mt-2x text-3xl font-semibold tabular-nums">{nombre.format(tableau.visites)}</dd>
          </div>
          <div class="rounded-card border border-line bg-surface p-6x">
            <dt class="label field-label">Pages vues</dt>
            <dd class="mt-2x text-3xl font-semibold tabular-nums">{nombre.format(tableau.pagesVues)}</dd>
          </div>
        </dl>
        <BarresVisites barres={tableau.barres} periode={periode} />
        <div class="mt-6x grid gap-6x md:grid-cols-3">
          <ClassementAnalytics titre="Pages les plus vues" lignes={tableau.pages} vide="Aucune page vue sur la période." />
          <ClassementAnalytics titre="Provenance" lignes={tableau.provenances} vide="Aucune visite sur la période." />
          <ClassementAnalytics titre="Appareils" lignes={tableau.appareils} vide="Aucune visite sur la période." />
        </div>
        {tableau.estime && <p class="mt-3x text-sm text-mute">Certains jours sont estimés par Cloudflare.</p>}
      </Fragment>
    )
  }

  {
    admin && derniereCollecte && (
      <p class="mt-6x text-xs text-mute">Dernière collecte&nbsp;: {horodatage(derniereCollecte)}</p>
    )
  }
</EspaceLayout>
```

- [ ] **Step 5: Vérifier le build et la suite**

Run: `npm run build`
Expected: build terminé sans erreur.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Vérifier que la page ne casse pas en local**

Run, en arrière-plan : `npm run dev -- --port 4331`
Puis : `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4331/espace/analytics`
Expected: `302` (redirection vers la connexion), jamais `500`. Arrêter le serveur ensuite.

La recette visuelle connectée (états, clair et sombre, mobile) est faite par le contrôleur après cette tâche.

- [ ] **Step 7: Commit**

```bash
git add src/pages/espace/analytics.astro src/components/portail/BarresVisites.astro src/components/portail/ClassementAnalytics.astro
git commit -m "feat(portail): page Analytics, visites, pages, provenance et appareils (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**
- Modify: `src/content/docs/coolbeans/04-portail.mdx` (sections « Comment ça marche » et « Référence technique »)
- Modify: `docs/superpowers/specs/2026-08-17-portail-client-strategie-produit.md` (§4.1 ligne 298 environ, §9 arbitrage 2 ligne 514 environ)

**Interfaces:**
- Consumes: le comportement livré par les tâches 1 à 6.
- Produces: rien.

- [ ] **Step 1: Décrire le module dans la doc du portail**

Lire `src/content/docs/coolbeans/04-portail.mdx` en entier. Dans « ## Comment ça marche », les paragraphes s'ouvrent sur un intitulé en gras (`**Les adresses.**`, `**L'authentification.**`). Ajouter à la fin de cette section, avant `## Référence technique`, ce paragraphe (le hook imposera les insécables, les appliquer à l'écriture) :

```mdx
**Les statistiques de fréquentation.** La page Analytics montre au client les visites de son site, sans cookies. Les mesures viennent de Cloudflare Web Analytics, où tous les sites sont enregistrés dans le compte Coolbeans. Cloudflare ne rend un chiffre exact que pour un jour isolé des sept derniers jours : au-delà, ou sur une période plus longue, il n'en garde qu'une mesure sur dix. Chaque nuit, au second passage de 04:00 UTC, le cron relit donc ces sept jours un par un et les stocke dans D1 (`src/lib/analytics/collecte.ts`). La page ne lit que D1. Pour raccorder un site, ajouter une entrée `analytics` (`host` et `siteTag`) dans la fiche du client sous `src/content/clients/`. Le `siteTag` se lit dans l'API Cloudflare, `GET /accounts/<compte>/rum/site_info/list`.
```

Dans « ## Référence technique », en suivant le format des entrées déjà présentes, ajouter :
- les tables `analytics_jours`, `analytics_repartitions`, `analytics_collectes` (migration `0011_analytics.sql`) ;
- le secret `CF_ANALYTICS_TOKEN` (jeton « Account Analytics : Read ») et la variable `CF_ACCOUNT_ID` ;
- le contrôle de bon fonctionnement : la ligne « Dernière collecte » en bas de la page, visible des admins seulement.

- [ ] **Step 2: Mettre à jour la spec stratégie**

Dans `docs/superpowers/specs/2026-08-17-portail-client-strategie-produit.md`, lire les deux passages exacts avant de les modifier :

1. Au §4.1, dans le paragraphe « **Décision (2026-08-18, arbitrage 9.2)** », remplacer la phrase « Le choix de l'outil cookieless (Plausible vs Umami, COO-16) reste suspendu au volume du parc. » par :

```md
Outil cookieless : Cloudflare Web Analytics, retenu le 2026-09-16 (COO-16) et collecté chaque nuit dans D1 (spec 2026-09-29-portail-analytics-design.md). Umami reste le repli.
```

2. Au §9, dans l'arbitrage « Analytics par client », remplacer « Outil cookieless (Plausible vs Umami) toujours suspendu au volume (COO-16). » par :

```md
Outil cookieless : Cloudflare Web Analytics, retenu le 2026-09-16 (COO-16).
```

- [ ] **Step 3: Vérifier l'ensemble**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: build terminé sans erreur (la doc MDX compile).

- [ ] **Step 4: Commit**

```bash
git add src/content/docs/coolbeans/04-portail.mdx docs/superpowers/specs/2026-08-17-portail-client-strategie-produit.md
git commit -m "docs(portail): le module Analytics, de la collecte à la page (COO-16)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
