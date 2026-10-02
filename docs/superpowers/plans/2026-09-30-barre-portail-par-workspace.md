# Barre par workspace et page projet : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la barre du portail change selon le workspace (Admin seulement dans Coolbeans, pas d'Aide dans Coolbeans, une section Projets alimentée par Linear), et chaque projet devient une page unique : en-tête Linear, étapes en onglets, versions en sous-onglets.

**Architecture :** Linear est lu côté serveur, au plus une fois toutes les 10 minutes par sous-team, dans le cache du Worker. Un modèle pur (`projets-portail.ts`) croise ces projets avec les documents du cycle et la règle de lecture. La page `/espace/projets/[projet].astro` rend tous les documents lisibles d'un projet dans une seule page, en réutilisant les composants de page du sous-projet 1, rendus cloisonnables par un préfixe d'id et un script limité à leur étape.

**Tech Stack :** Astro 7 (SSR sur Cloudflare Workers), TypeScript, Tailwind 4, Vitest, API GraphQL Linear.

**Spec :** `docs/superpowers/specs/2026-09-30-barre-portail-par-workspace-design.md`. Complète `docs/superpowers/specs/2026-09-30-documents-prives-workspace-design.md`.

## Global Constraints

- Worktree `~/dev/coolbeans-documents-portail`, branche `feat/documents-portail`. Vérifier `pwd` et `git branch --show-current` avant le premier edit.
- Jamais `git stash`, jamais `git add -A` ni `git add .` : commiter chemin par chemin.
- Aucun merge, aucun push, aucune migration D1, aucun `wrangler deploy`.
- Tests : `npx vitest run`. Build : `npm run build` (le build vérifie la nomenclature et échoue sur une incohérence). `astro check` ne tourne pas dans ce repo : le build est la vérification.
- Le hook `~/.claude/hooks/relire-francais.mjs` relit tout fichier `.md`, `.mdx`, `.yaml`, `.astro`, `.html`, `.txt` écrit, commentaires compris : espace insécable U+00A0 avant « : » et à l'intérieur des guillemets « », espace fine U+202F avant «  ; ? ! », aucun tiret cadratin ni demi-cadratin. Quand il bloque, il donne la ligne : corriger et continuer.
- Linear : le résumé d'un projet est le champ GraphQL `description`. Le champ `content` porte le brief interne et les liens du CRM : il ne se demande jamais.
- Sous `.doc-root`, `doc.css` bat Tailwind sur ces classes : `card`, `cards`, `sub`, `brand`, `topnav`, `spacer`, `tgl`. Ne pas les employer dans un nouveau composant.
- Couleurs : les tokens de `src/styles/global.css` (`text-ink`, `text-mute`, `bg-surface`, `bg-surface-raise`, `border-line`), jamais une couleur en dur.
- Un refus répond 404 par `Astro.rewrite("/404")`, comme la route du sous-projet 1.
- Les pages publiques des documents (`/devis/…`, `/cadrage/…`, `/livrable/…`, `/temoignage/…` sur coolbeans.cc) restent identiques au pixel. Les scripts de capture sont dans `.superpowers/recette-documents/` du worktree, le serveur de dev tourne sur le port 4337.
- Le workspace Coolbeans se reconnaît à son slug `coolbeans` (`WORKSPACE_COOLBEANS`).

## Review Focus

1. **Deux documents à sous-onglets sur la même page projet** (CAFA : une proposition et un livrable, chacun avec des versions). Un clic sur une version d'une étape ne touche pas l'autre étape, et la page n'a aucun id en double. Contrôlé par la tâche 10, étape 4.
2. **Linear lent ou en panne.** La page s'affiche en un peu plus de 2 secondes au pire, avec les projets tirés des documents. Tâche 2 (délai), tâche 3 (repli).
3. **Un client face à un brouillon.** Aucun octet du brouillon dans le HTML servi, et l'onglet de l'étape est grisé. Tâche 3 (onglet grisé), tâche 10 (HTML).
4. **Adresse périmée, inconnue, ou d'un autre workspace.** Un nom changé redirige, un identifiant inconnu répond 404, un projet d'un autre workspace de la portée fait basculer, hors portée répond 404. Tâche 3 (`slugIdDe`), tâche 10 (HTTP).
5. **`?etape=` ou `?version=` qui désigne une étape grisée ou une version inconnue.** L'onglet par défaut s'ouvre, sans erreur. Tâche 3 (`ongletOuvert`), tâche 6 (`versionActive`).

---

### Task 1: La nomenclature relie chaque projet à son projet Linear

**Files:**
- Modify: `src/lib/documents/nomenclature.ts`
- Modify: `src/lib/documents/charger.ts`
- Test: `src/lib/documents/nomenclature.test.ts`

**Interfaces:**
- Produces : `EntreeProjet { client: CleClient; linear: string }`, `PROJETS: Readonly<Record<string, EntreeProjet>>`, `FORME_LINEAR`, `linearDuProjet(projet): string | undefined`, `projetDuLinear(slugId): string | undefined`, `verifierLiensLinear(projets?): string[]`, `workspaceDuLinear(workspaces, slugId)`. `clientDuProjet` et `workspaceDuProjet` gardent leur signature.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `src/lib/documents/nomenclature.test.ts`, compléter l'import :

```ts
import {
  CLIENTS,
  FORME_PROJET,
  HORS_NOMENCLATURE,
  PROJETS,
  clientDuProjet,
  linearDuProjet,
  projetDuLinear,
  verifierCles,
  verifierLiensLinear,
  workspaceDuLinear,
  workspaceDuProjet,
} from "./nomenclature";
```

Remplacer les deux tests qui lisent `Object.values(PROJETS)` comme des clés client :

```ts
test("chaque projet appartient à un client de la table", () => {
  for (const { client } of Object.values(PROJETS)) expect(Object.keys(CLIENTS)).toContain(client);
});

test("aucun client de la table n'est sans projet", () => {
  const servis = new Set(Object.values(PROJETS).map((p) => p.client));
  for (const cle of Object.keys(CLIENTS)) expect(servis.has(cle as never)).toBe(true);
});
```

Ajouter en fin de fichier :

```ts
test("chaque projet de la table est relié à un projet Linear distinct", () => {
  expect(verifierLiensLinear()).toEqual([]);
});

test("un identifiant Linear mal formé arrête le build", () => {
  expect(verifierLiensLinear({ "a-001": { client: "caf", linear: "E6C1" } })).toEqual([
    "projet a-001 : identifiant Linear « E6C1 » mal formé",
  ]);
});

test("un identifiant Linear partagé par deux projets arrête le build", () => {
  expect(
    verifierLiensLinear({
      "a-001": { client: "caf", linear: "e6c1e495a56f" },
      "b-002": { client: "caf", linear: "e6c1e495a56f" },
    }),
  ).toEqual(["identifiant Linear « e6c1e495a56f » porté par deux projets (a-001, b-002)"]);
});

test("un projet se retrouve par son identifiant Linear, et l'inverse", () => {
  expect(linearDuProjet("salon-533")).toBe("e6c1e495a56f");
  expect(projetDuLinear("e6c1e495a56f")).toBe("salon-533");
  expect(projetDuLinear("000000000000")).toBeUndefined();
  expect(linearDuProjet("toString")).toBeUndefined();
});

test("le workspace d'un projet Linear se trouve par la table", () => {
  const ws = [{ slug: "revolutions-douces", cle: "rev" }, { slug: "coolbeans" }];
  expect(workspaceDuLinear(ws, "e6c1e495a56f")?.slug).toBe("revolutions-douces");
  // Le site de l'association n'a aucun document : il n'est pas dans la table.
  expect(workspaceDuLinear(ws, "9a42140d4288")).toBeUndefined();
});
```

- [ ] **Step 2 : lancer les tests, ils échouent**

Run : `npx vitest run src/lib/documents/nomenclature.test.ts`
Expected : FAIL, `linearDuProjet` et consorts ne sont pas exportés.

- [ ] **Step 3 : implémenter**

Dans `src/lib/documents/nomenclature.ts`, ajouter au commentaire de tête, après le paragraphe « Projet : … » :

```ts
 * Chaque projet porte l'identifiant court de son projet Linear (`slugId`, les
 * douze caractères qui terminent son adresse Linear), relevé le 2026-09-30 :
 * c'est lui qui range un document sous son projet dans le portail (spec
 * 2026-09-30, barre par workspace, §4.3).
```

Remplacer la déclaration de `PROJETS` et `clientDuProjet` par :

```ts
/** Un projet de la table : son client, et l'identifiant court de son projet Linear. */
export interface EntreeProjet {
  client: CleClient;
  /** `slugId` du projet Linear : les douze caractères qui terminent son adresse. */
  linear: string;
}

/** Segment du projet, référence comprise, vers son client et son projet Linear. */
export const PROJETS: Readonly<Record<string, EntreeProjet>> = {
  "refonte-432": { client: "amu", linear: "9a553e01b917" },
  "site-web-879": { client: "caf", linear: "2361b9acfd1a" },
  "boutique-shopify-390": { client: "fyl", linear: "42d0fb9d1281" },
  "site-vitrine-471": { client: "lit", linear: "e181c8e92c1f" },
  "precommande-livre-412": { client: "mal", linear: "7218ca9539af" },
  "site-vitrine-618": { client: "mal", linear: "691bb92bf3db" },
  "refonte-207": { client: "mat", linear: "27aa43992fe6" },
  "formulaire-brochures-831": { client: "mih", linear: "603b24fea5d1" },
  "plaquette-agen-723": { client: "mih", linear: "c8ce3f2521bd" },
  "boutique-624": { client: "oid", linear: "728faac06981" },
  "salon-533": { client: "rev", linear: "e6c1e495a56f" },
  "refonte-740": { client: "set", linear: "5d401d0da735" },
  "osmose-281": { client: "set", linear: "d796ba98b140" },
  "reservation-513": { client: "set", linear: "ccd25271ada6" },
  "serial-generations-618": { client: "uni", linear: "fff0a01f2a8c" },
  "plateforme-327": { client: "unl", linear: "03dc21021720" },
  "page-vitrine-561": { client: "vic", linear: "52f28a6e9424" },
};
```

Garder `HORS_NOMENCLATURE` et `FORME_PROJET` tels quels. Remplacer `clientDuProjet` et ajouter après lui :

```ts
/** Le `slugId` d'un projet Linear : douze caractères hexadécimaux. */
export const FORME_LINEAR = /^[0-9a-f]{12}$/;

export function clientDuProjet(projet: string): CleClient | undefined {
  return Object.hasOwn(PROJETS, projet) ? PROJETS[projet].client : undefined;
}

export function linearDuProjet(projet: string): string | undefined {
  return Object.hasOwn(PROJETS, projet) ? PROJETS[projet].linear : undefined;
}

/** Le projet de la table relié à ce projet Linear. */
export function projetDuLinear(slugId: string): string | undefined {
  return Object.keys(PROJETS).find((p) => PROJETS[p].linear === slugId);
}

/** Les liens vers Linear mal formés ou partagés. Une liste vide veut dire cohérent. */
export function verifierLiensLinear(projets: Readonly<Record<string, EntreeProjet>> = PROJETS): string[] {
  const erreurs: string[] = [];
  const vus = new Map<string, string>();
  for (const [projet, { linear }] of Object.entries(projets)) {
    if (!FORME_LINEAR.test(linear)) {
      erreurs.push(`projet ${projet} : identifiant Linear « ${linear} » mal formé`);
      continue;
    }
    const deja = vus.get(linear);
    if (deja) erreurs.push(`identifiant Linear « ${linear} » porté par deux projets (${deja}, ${projet})`);
    else vus.set(linear, projet);
  }
  return erreurs;
}
```

En fin de fichier, après `workspaceDuProjet` :

```ts
/** Le workspace relié à un projet Linear par la table, s'il y en a un. */
export function workspaceDuLinear<W extends { cle?: string }>(
  workspaces: readonly W[],
  slugId: string,
): W | undefined {
  const projet = projetDuLinear(slugId);
  return projet ? workspaceDuProjet(workspaces, projet) : undefined;
}
```

Dans `src/lib/documents/charger.ts`, importer `verifierLiensLinear` avec `verifierCles` et ajouter ses erreurs :

```ts
import { verifierCles, verifierLiensLinear } from "./nomenclature";
```

```ts
  const erreurs = [...verifierNomenclature(documents), ...verifierCles(clients), ...verifierLiensLinear()];
```

- [ ] **Step 4 : lancer les tests**

Run : `npx vitest run`
Expected : PASS, toute la suite.

- [ ] **Step 5 : commit**

```bash
git add src/lib/documents/nomenclature.ts src/lib/documents/nomenclature.test.ts src/lib/documents/charger.ts
git commit -m "feat(portail): chaque projet de la nomenclature porte son projet Linear"
```

---

### Task 2: Lire les projets Linear d'une sous-team

**Files:**
- Modify: `src/lib/portail/linear-graphql.ts`
- Create: `src/lib/portail/projets-linear.ts`
- Test: `src/lib/portail/projets-linear.test.ts`

**Interfaces:**
- Consumes : `graphql<T>(apiKey, query, variables, signal?)`.
- Produces : `TypeStatut`, `StatutLinear { nom; type }`, `ProjetLinear { slugId; segment; nom; resume; statut; debut; fin; misAJour }`, `normaliserProjets(noeuds)`, `trierProjets(projets)`, `lireProjetsLinear(apiKey, teamId, signal?)`, `libelleStatut(s)`, `estValide(s)`, `CacheProjets`, `EntreeCache`, `DUREE_SUCCES = 600`, `DUREE_ECHEC = 60`, `DELAI_MS = 2000`, `projetsDeLaTeam(teamId, { apiKey, cache, lire? }): Promise<ProjetLinear[] | null>`, `cacheWorker(): CacheProjets`.

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `src/lib/portail/projets-linear.test.ts` :

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DUREE_ECHEC,
  DUREE_SUCCES,
  estValide,
  libelleStatut,
  normaliserProjets,
  projetsDeLaTeam,
  trierProjets,
  type CacheProjets,
  type EntreeCache,
  type ProjetLinear,
  type TypeStatut,
} from "./projets-linear";

const noeud = (o: Record<string, unknown> = {}) => ({
  slugId: "e6c1e495a56f",
  url: "https://linear.app/coolbeans-hq/project/site-du-salon-edition-2026-e6c1e495a56f",
  name: "Site du salon, édition 2026",
  description: "  Le site du salon.  ",
  startDate: "2026-08-28",
  targetDate: "2026-10-02",
  updatedAt: "2026-09-30T10:00:00.000Z",
  status: { name: "In Progress", type: "started" },
  ...o,
});

const projet = (slugId: string, type: TypeStatut, misAJour: string): ProjetLinear => ({
  slugId,
  segment: slugId,
  nom: slugId,
  resume: "",
  statut: { nom: type, type },
  debut: null,
  fin: null,
  misAJour,
});

function cacheMemoire() {
  const entrees = new Map<string, { entree: EntreeCache; secondes: number }>();
  const cache: CacheProjets = {
    lire: async (cle) => entrees.get(cle)?.entree,
    ecrire: async (cle, entree, secondes) => {
      entrees.set(cle, { entree, secondes });
    },
  };
  return { cache, entrees };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("normaliserProjets", () => {
  it("garde le résumé, le segment d'adresse, le statut et les dates", () => {
    expect(normaliserProjets([noeud()])).toEqual([
      {
        slugId: "e6c1e495a56f",
        segment: "site-du-salon-edition-2026-e6c1e495a56f",
        nom: "Site du salon, édition 2026",
        resume: "Le site du salon.",
        statut: { nom: "In Progress", type: "started" },
        debut: "2026-08-28",
        fin: "2026-10-02",
        misAJour: "2026-09-30T10:00:00.000Z",
      },
    ]);
  });

  it("écarte les projets annulés", () => {
    expect(normaliserProjets([noeud({ status: { name: "Canceled", type: "canceled" } })])).toEqual([]);
  });
});

describe("trierProjets", () => {
  it("en cours, puis à venir, puis terminés, le plus récent en tête de chaque groupe", () => {
    const tries = trierProjets([
      projet("termine", "completed", "2026-09-30"),
      projet("propose", "backlog", "2026-09-01"),
      projet("planifie", "planned", "2026-09-20"),
      projet("pause", "paused", "2026-08-01"),
      projet("encours", "started", "2026-09-10"),
    ]);
    expect(tries.map((p) => p.slugId)).toEqual(["encours", "pause", "planifie", "propose", "termine"]);
  });
});

describe("libellés du statut", () => {
  it("traduit les statuts du workspace Linear", () => {
    expect(libelleStatut({ nom: "Proposal", type: "backlog" })).toBe("Proposition");
    expect(libelleStatut({ nom: "Backlog", type: "backlog" })).toBe("À venir");
    expect(libelleStatut({ nom: "Planned", type: "planned" })).toBe("Planifié");
    expect(libelleStatut({ nom: "In Progress", type: "started" })).toBe("En cours");
    expect(libelleStatut({ nom: "Paused", type: "paused" })).toBe("En pause");
    expect(libelleStatut({ nom: "Completed", type: "completed" })).toBe("Terminé");
  });

  it("traduit un statut inconnu d'après son type", () => {
    expect(libelleStatut({ nom: "Recette", type: "started" })).toBe("En cours");
  });

  it("ne tient pour validé qu'un projet sorti de Proposal et de Backlog", () => {
    expect(estValide({ nom: "Proposal", type: "backlog" })).toBe(false);
    expect(estValide({ nom: "Backlog", type: "backlog" })).toBe(false);
    expect(estValide({ nom: "Planned", type: "planned" })).toBe(true);
    expect(estValide({ nom: "In Progress", type: "started" })).toBe(true);
    expect(estValide({ nom: "Completed", type: "completed" })).toBe(true);
  });
});

describe("projetsDeLaTeam", () => {
  it("lit Linear une fois, puis sert le cache pendant 10 minutes", async () => {
    const { cache, entrees } = cacheMemoire();
    const lire = vi.fn(async () => [projet("a", "started", "2026-09-30")]);
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toHaveLength(1);
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toHaveLength(1);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(entrees.get("linear-projets:team")?.secondes).toBe(DUREE_SUCCES);
  });

  it("rend null sur un échec, et garde l'échec 60 secondes", async () => {
    const { cache, entrees } = cacheMemoire();
    const lire = vi.fn(async (): Promise<ProjetLinear[]> => {
      throw new Error("Linear 500");
    });
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toBeNull();
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toBeNull();
    expect(lire).toHaveBeenCalledTimes(1);
    expect(entrees.get("linear-projets:team")?.secondes).toBe(DUREE_ECHEC);
  });

  it("rend null sans clé, sans appeler Linear", async () => {
    const { cache } = cacheMemoire();
    const lire = vi.fn();
    expect(await projetsDeLaTeam("team", { apiKey: undefined, cache, lire })).toBeNull();
    expect(lire).not.toHaveBeenCalled();
  });

  it("abandonne un appel qui dépasse 2 secondes, même si Linear ne rend jamais la main", async () => {
    vi.useFakeTimers();
    const { cache } = cacheMemoire();
    const lire = vi.fn(() => new Promise<ProjetLinear[]>(() => {}));
    const promesse = projetsDeLaTeam("team", { apiKey: "k", cache, lire });
    await vi.advanceTimersByTimeAsync(2001);
    expect(await promesse).toBeNull();
  });

  it("un cache en panne ne casse rien", async () => {
    const cache: CacheProjets = {
      lire: async () => {
        throw new Error("cache");
      },
      ecrire: async () => {
        throw new Error("cache");
      },
    };
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire: async () => [] })).toEqual([]);
  });
});
```

- [ ] **Step 2 : lancer les tests, ils échouent**

Run : `npx vitest run src/lib/portail/projets-linear.test.ts`
Expected : FAIL, le module `./projets-linear` n'existe pas.

- [ ] **Step 3 : laisser `graphql` accepter un signal d'abandon**

Dans `src/lib/portail/linear-graphql.ts`, remplacer la signature et l'appel `fetch` :

```ts
export async function graphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: apiKey },
    body: JSON.stringify({ query, variables }),
    signal,
  });
```

Le reste de la fonction ne change pas.

- [ ] **Step 4 : créer `src/lib/portail/projets-linear.ts`**

```ts
/* Les projets Linear d'une sous-team, pour le portail (spec 2026-09-30, barre
 * par workspace, §4). Chaque workspace naît avec sa sous-team ; la barre et la
 * page d'un projet affichent ses projets.
 *
 * Lecture en liste blanche. Le résumé d'un projet est le champ GraphQL
 * `description`. Le texte long, `content`, porte le brief interne et les liens
 * du CRM : il ne se demande jamais.
 *
 * Linear est lu au plus une fois toutes les 10 minutes par sous-team, dans le
 * cache du Worker. Le KV est écarté : son quota gratuit de 1 000 écritures par
 * jour tomberait dès sept workspaces consultés en continu.
 */
import { graphql } from "./linear-graphql";

export type TypeStatut = "backlog" | "planned" | "started" | "paused" | "completed" | "canceled";

export interface StatutLinear {
  nom: string;
  type: TypeStatut;
}

export interface ProjetLinear {
  /** Les douze caractères qui terminent l'adresse Linear du projet. */
  slugId: string;
  /** Le dernier segment de l'adresse Linear : le nom en minuscules, puis le slugId. */
  segment: string;
  nom: string;
  /** Le résumé, écrit pour le client. Vide : rien à afficher. */
  resume: string;
  statut: StatutLinear;
  /** AAAA-MM-JJ */
  debut: string | null;
  fin: string | null;
  /** ISO 8601 */
  misAJour: string;
}

interface NoeudProjet {
  slugId: string;
  url: string;
  name: string;
  description: string;
  startDate: string | null;
  targetDate: string | null;
  updatedAt: string;
  status: { name: string; type: string };
}

export const REQUETE_PROJETS = `query ProjetsDeLaTeam($id: String!) {
  team(id: $id) {
    projects(first: 100) {
      nodes { slugId url name description startDate targetDate updatedAt status { name type } }
    }
  }
}`;

/** Les noeuds de l'API, sans les projets annulés, sous la forme du portail. */
export function normaliserProjets(noeuds: NoeudProjet[]): ProjetLinear[] {
  return noeuds
    .filter((n) => n.status.type !== "canceled")
    .map((n) => ({
      slugId: n.slugId,
      segment: n.url.split("/").pop() || n.slugId,
      nom: n.name,
      resume: n.description.trim(),
      statut: { nom: n.status.name, type: n.status.type as TypeStatut },
      debut: n.startDate,
      fin: n.targetDate,
      misAJour: n.updatedAt,
    }));
}

const GROUPE: Record<TypeStatut, number> = {
  started: 0,
  paused: 0,
  planned: 1,
  backlog: 1,
  completed: 2,
  canceled: 3,
};

/** En cours, puis à venir, puis terminés. Le plus récemment modifié en tête de chaque groupe. */
export function trierProjets(projets: ProjetLinear[]): ProjetLinear[] {
  return [...projets].sort(
    (a, b) => (GROUPE[a.statut.type] ?? 3) - (GROUPE[b.statut.type] ?? 3) || b.misAJour.localeCompare(a.misAJour),
  );
}

export async function lireProjetsLinear(apiKey: string, teamId: string, signal?: AbortSignal): Promise<ProjetLinear[]> {
  const data = await graphql<{ team: { projects: { nodes: NoeudProjet[] } } | null }>(
    apiKey,
    REQUETE_PROJETS,
    { id: teamId },
    signal,
  );
  if (!data.team) throw new Error(`Linear : team ${teamId} introuvable`);
  return trierProjets(normaliserProjets(data.team.projects.nodes));
}

/* ---- Ce que lit le client ------------------------------------------------ */

const LIBELLE_PAR_NOM: Record<string, string> = {
  Proposal: "Proposition",
  Backlog: "À venir",
  Planned: "Planifié",
  "In Progress": "En cours",
  Paused: "En pause",
  Completed: "Terminé",
};

const LIBELLE_PAR_TYPE: Record<TypeStatut, string> = {
  backlog: "À venir",
  planned: "Planifié",
  started: "En cours",
  paused: "En pause",
  completed: "Terminé",
  canceled: "Annulé",
};

export function libelleStatut(s: StatutLinear): string {
  return LIBELLE_PAR_NOM[s.nom] ?? LIBELLE_PAR_TYPE[s.type] ?? s.nom;
}

/** Un projet validé a quitté Proposal et Backlog : ses dates s'affichent. */
export function estValide(s: StatutLinear): boolean {
  return s.type === "planned" || s.type === "started" || s.type === "paused" || s.type === "completed";
}

/* ---- Cache --------------------------------------------------------------- */

export type EntreeCache = { ok: true; projets: ProjetLinear[] } | { ok: false };

export interface CacheProjets {
  lire(cle: string): Promise<EntreeCache | undefined>;
  ecrire(cle: string, entree: EntreeCache, secondes: number): Promise<void>;
}

export const DUREE_SUCCES = 600;
export const DUREE_ECHEC = 60;
export const DELAI_MS = 2000;

/**
 * Les projets de la sous-team. `null` : Linear n'a pas répondu, l'appelant se
 * replie sur les documents. Ne lève jamais : une page ne casse pas à cause de
 * Linear. L'échec se garde 60 secondes, pour qu'une panne ne ralentisse pas
 * chaque page.
 */
export async function projetsDeLaTeam(
  teamId: string,
  options: { apiKey?: string; cache: CacheProjets; lire?: typeof lireProjetsLinear },
): Promise<ProjetLinear[] | null> {
  const { apiKey, cache, lire = lireProjetsLinear } = options;
  if (!apiKey) return null;
  const cle = `linear-projets:${teamId}`;
  const connu = await cache.lire(cle).catch(() => undefined);
  if (connu) return connu.ok ? connu.projets : null;

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);
  // La course garantit l'abandon même si l'appel ignore le signal.
  const delai = new Promise<never>((_, rejeter) => {
    controleur.signal.addEventListener("abort", () => rejeter(new Error("Linear : délai dépassé")));
  });
  try {
    const projets = await Promise.race([lire(apiKey, teamId, controleur.signal), delai]);
    await cache.ecrire(cle, { ok: true, projets }, DUREE_SUCCES).catch(() => {});
    return projets;
  } catch {
    await cache.ecrire(cle, { ok: false }, DUREE_ECHEC).catch(() => {});
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

const ORIGINE_CACHE = "https://cache.coolbeans.internal/";

/** Le cache du Worker. Absent (Vitest, Node) : un cache qui ne garde rien. */
export function cacheWorker(): CacheProjets {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return { lire: async () => undefined, ecrire: async () => {} };
  const adresse = (cle: string) => ORIGINE_CACHE + encodeURIComponent(cle);
  return {
    async lire(cle) {
      const reponse = await cache.match(adresse(cle));
      return reponse ? ((await reponse.json()) as EntreeCache) : undefined;
    },
    async ecrire(cle, entree, secondes) {
      await cache.put(
        adresse(cle),
        new Response(JSON.stringify(entree), {
          headers: { "content-type": "application/json", "cache-control": `max-age=${secondes}` },
        }),
      );
    },
  };
}
```

- [ ] **Step 5 : lancer les tests**

Run : `npx vitest run`
Expected : PASS, toute la suite.

- [ ] **Step 6 : commit**

```bash
git add src/lib/portail/linear-graphql.ts src/lib/portail/projets-linear.ts src/lib/portail/projets-linear.test.ts
git commit -m "feat(portail): lecture des projets Linear d'une sous-team, en cache 10 minutes"
```

---

### Task 3: Le modèle des projets et des onglets d'une page projet

**Files:**
- Modify: `src/lib/documents/projets-portail.ts` (ajouts ; `sectionsProjets` reste jusqu'à la tâche 7)
- Test: `src/lib/documents/projets-portail.test.ts` (ajouts)

**Interfaces:**
- Consumes : `ProjetLinear`, `StatutLinear`, `trierProjets` (tâche 2) ; `clientDuProjet`, `linearDuProjet`, `projetDuLinear` (tâche 1) ; `versionsDuPortail`, `Bandeau`, `Lecture` (`src/lib/documents/acces.ts`) ; `DEFINITIONS`, `Etape`, `Teinte` (`src/lib/documents/etapes.ts`) ; `DocumentProjet` (`src/lib/documents/projet.ts`).
- Produces : `ProjetPortail { slugId; segment; titre; resume; statut; debut; fin; nomenclature }`, `projetsDuWorkspace(linear, documents, cle, lisible): ProjetPortail[]`, `cheminProjet(p): string`, `slugIdDe(segment): string | null`, `OngletEtape { etape; libelle; teinte; racine; ids; bandeaux; recent }`, `ongletsDuProjet(documents, nomenclature, lire): OngletEtape[]`, `ongletOuvert(onglets, demande): Etape | null`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter en fin de `src/lib/documents/projets-portail.test.ts` (compléter les imports existants si un nom y figure déjà) :

```ts
import {
  cheminProjet,
  ongletOuvert,
  ongletsDuProjet,
  projetsDuWorkspace,
  slugIdDe,
} from "./projets-portail";
import type { ProjetLinear } from "../portail/projets-linear";
import type { Lecture } from "./acces";
import type { DocumentProjet } from "./projet";

const docSalon = (o: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id" | "etape">): DocumentProjet => ({
  statut: "publie",
  projet: "salon-533",
  titreProjet: "Site du salon, édition 2026",
  date: new Date("2026-09-01"),
  ...o,
});

const lisibleSiPublie = (d: DocumentProjet): Lecture =>
  d.statut === "publie" ? { lisible: true, bandeau: null } : { lisible: false };

const salon = (o: Partial<ProjetLinear> = {}): ProjetLinear => ({
  slugId: "e6c1e495a56f",
  segment: "site-du-salon-edition-2026-e6c1e495a56f",
  nom: "Site du salon, édition 2026",
  resume: "Le site du salon.",
  statut: { nom: "In Progress", type: "started" },
  debut: "2026-08-28",
  fin: "2026-10-02",
  misAJour: "2026-09-30T10:00:00Z",
  ...o,
});

const association = salon({
  slugId: "9a42140d4288",
  segment: "site-de-lassociation-revolutions-douces-9a42140d4288",
  nom: "Site de l'association Rev'Olutions Douces",
  resume: "",
  misAJour: "2026-09-29T10:00:00Z",
});

describe("projetsDuWorkspace", () => {
  it("Linear donne la liste, les titres, le résumé et l'ordre", () => {
    const projets = projetsDuWorkspace([association, salon()], [], "rev", () => true);
    expect(projets).toEqual([
      {
        slugId: "e6c1e495a56f",
        segment: "site-du-salon-edition-2026-e6c1e495a56f",
        titre: "Site du salon, édition 2026",
        resume: "Le site du salon.",
        statut: { nom: "In Progress", type: "started" },
        debut: "2026-08-28",
        fin: "2026-10-02",
        nomenclature: "salon-533",
      },
      {
        slugId: "9a42140d4288",
        segment: "site-de-lassociation-revolutions-douces-9a42140d4288",
        titre: "Site de l'association Rev'Olutions Douces",
        resume: null,
        statut: { nom: "In Progress", type: "started" },
        debut: "2026-08-28",
        fin: "2026-10-02",
        nomenclature: null,
      },
    ]);
  });

  it("Linear muet : les projets de la table qui ont un document lisible", () => {
    const documents = [docSalon({ collection: "devis", id: "revolutions-douces/salon-2026-5336", etape: "proposition" })];
    expect(projetsDuWorkspace(null, documents, "rev", (d) => d.statut === "publie")).toEqual([
      {
        slugId: "e6c1e495a56f",
        segment: "e6c1e495a56f",
        titre: "Site du salon, édition 2026",
        resume: null,
        statut: null,
        debut: null,
        fin: null,
        nomenclature: "salon-533",
      },
    ]);
  });

  it("Linear muet et document illisible : aucun projet", () => {
    const documents = [docSalon({ collection: "devis", id: "x", etape: "proposition", statut: "brouillon" })];
    expect(projetsDuWorkspace(null, documents, "rev", (d) => d.statut === "publie")).toEqual([]);
  });

  it("Linear muet et workspace sans clé : aucun projet", () => {
    const documents = [docSalon({ collection: "devis", id: "x", etape: "proposition" })];
    expect(projetsDuWorkspace(null, documents, undefined, () => true)).toEqual([]);
  });

  it("le chemin d'un projet suit son segment", () => {
    expect(cheminProjet({ segment: "site-du-salon-edition-2026-e6c1e495a56f" })).toBe(
      "/projets/site-du-salon-edition-2026-e6c1e495a56f",
    );
  });
});

describe("slugIdDe", () => {
  it("lit l'identifiant court qui termine le segment", () => {
    expect(slugIdDe("site-du-salon-edition-2026-e6c1e495a56f")).toBe("e6c1e495a56f");
    expect(slugIdDe("e6c1e495a56f")).toBe("e6c1e495a56f");
    expect(slugIdDe("ancien-nom-e6c1e495a56f")).toBe("e6c1e495a56f");
  });

  it("refuse un segment sans identifiant court", () => {
    expect(slugIdDe("salon-533")).toBeNull();
    expect(slugIdDe("site-e6c1e495a56")).toBeNull();
    expect(slugIdDe("site-E6C1E495A56F")).toBeNull();
    expect(slugIdDe("")).toBeNull();
  });
});

describe("ongletsDuProjet", () => {
  const proposition = docSalon({ collection: "devis", id: "revolutions-douces/salon-2026-5336", etape: "proposition" });

  it("une étape sans document est grisée ; l'audit n'apparaît qu'avec un audit", () => {
    const onglets = ongletsDuProjet([proposition], "salon-533", lisibleSiPublie);
    expect(onglets.map((o) => o.etape)).toEqual(["cadrage", "proposition", "production", "livraison", "suivi"]);
    expect(onglets.map((o) => o.libelle)).toEqual([
      "1 · Cadrage",
      "2 · Proposition",
      "3 · Production",
      "4 · Livraison",
      "5 · Suivi",
    ]);
    expect(onglets.filter((o) => o.racine).map((o) => o.etape)).toEqual(["proposition"]);
    expect(onglets.find((o) => o.etape === "proposition")!.ids).toEqual(["revolutions-douces/salon-2026-5336"]);
  });

  it("un brouillon compte comme absent pour le client", () => {
    const cadrage = docSalon({ collection: "cadrage", id: "revolutions-douces/brief-5330", etape: "cadrage", statut: "brouillon" });
    const onglet = ongletsDuProjet([cadrage], "salon-533", lisibleSiPublie).find((o) => o.etape === "cadrage")!;
    expect(onglet.racine).toBeNull();
    expect(onglet.ids).toEqual([]);
  });

  it("l'admin lit le brouillon sous son bandeau", () => {
    const cadrage = docSalon({ collection: "cadrage", id: "revolutions-douces/brief-5330", etape: "cadrage", statut: "brouillon" });
    const admin = (d: DocumentProjet): Lecture =>
      d.statut === "publie" ? { lisible: true, bandeau: null } : { lisible: true, bandeau: "brouillon" };
    const onglet = ongletsDuProjet([cadrage], "salon-533", admin).find((o) => o.etape === "cadrage")!;
    expect(onglet.racine?.id).toBe("revolutions-douces/brief-5330");
    expect(onglet.bandeaux).toEqual({ "revolutions-douces/brief-5330": "brouillon" });
  });

  it("l'audit prend l'onglet 0 quand le projet en a un", () => {
    const audit = docSalon({ collection: "cadrage", id: "revolutions-douces/audit-5331", etape: "audit" });
    const onglets = ongletsDuProjet([audit, proposition], "salon-533", lisibleSiPublie);
    expect(onglets[0]).toMatchObject({ etape: "audit", libelle: "0 · Audit" });
  });

  it("un projet sans document de la table a toutes ses étapes grisées", () => {
    const onglets = ongletsDuProjet([proposition], null, lisibleSiPublie);
    expect(onglets).toHaveLength(5);
    expect(onglets.every((o) => o.racine === null)).toBe(true);
  });
});

describe("ongletOuvert", () => {
  const documents = [
    docSalon({ collection: "devis", id: "p", etape: "proposition", date: new Date("2026-09-01") }),
    docSalon({ collection: "livrable", id: "l", etape: "livraison", date: new Date("2026-09-20") }),
  ];
  const onglets = ongletsDuProjet(documents, "salon-533", lisibleSiPublie);

  it("ouvre l'étape que l'adresse demande", () => {
    expect(ongletOuvert(onglets, "proposition")).toBe("proposition");
  });

  it("ouvre le document le plus récent sans demande, ou si la demande est grisée ou inconnue", () => {
    expect(ongletOuvert(onglets, null)).toBe("livraison");
    expect(ongletOuvert(onglets, "cadrage")).toBe("livraison");
    expect(ongletOuvert(onglets, "zzz")).toBe("livraison");
  });

  it("n'ouvre rien quand tout est grisé", () => {
    expect(ongletOuvert(ongletsDuProjet([], "salon-533", lisibleSiPublie), null)).toBeNull();
  });
});
```

Vérifier en tête du fichier que `describe`, `it` et `expect` sont importés de `vitest` ; les ajouter à l'import existant s'il manque un nom.

- [ ] **Step 2 : lancer les tests, ils échouent**

Run : `npx vitest run src/lib/documents/projets-portail.test.ts`
Expected : FAIL, `projetsDuWorkspace` et consorts ne sont pas exportés.

- [ ] **Step 3 : implémenter**

Dans `src/lib/documents/projets-portail.ts`, remplacer les imports par :

```ts
import { cheminPortail, versionsDuPortail, type Bandeau, type Lecture } from "./acces";
import { DEFINITIONS, definitionEtape, type Etape, type Teinte } from "./etapes";
import { clientDuProjet, linearDuProjet, projetDuLinear } from "./nomenclature";
import type { DocumentProjet } from "./projet";
import { trierProjets, type ProjetLinear, type StatutLinear } from "../portail/projets-linear";
```

Laisser `EntreeProjet`, `SectionProjet` et `sectionsProjets` en place (la tâche 7 les retire). Ajouter en fin de fichier :

```ts
/* ---- Projets Linear (spec 2026-09-30, barre par workspace, §4 et §5) ------ */

/** Un projet tel que la barre et sa page l'affichent. */
export interface ProjetPortail {
  slugId: string;
  /** Segment d'adresse : `/projets/<segment>`. */
  segment: string;
  titre: string;
  resume: string | null;
  /** `null` quand Linear n'a pas répondu. */
  statut: StatutLinear | null;
  debut: string | null;
  fin: string | null;
  /** Le projet de la nomenclature, qui porte les documents. `null` : aucun document. */
  nomenclature: string | null;
}

/**
 * Les projets d'un workspace. `linear` : les projets de sa sous-team, ou `null`
 * quand Linear n'a pas répondu. Dans ce cas, repli sur les projets de la table
 * qui ont un document lisible, sans résumé, statut ni dates (spec §4.4).
 */
export function projetsDuWorkspace(
  linear: ProjetLinear[] | null,
  documents: DocumentProjet[],
  cle: string | undefined,
  lisible: (d: DocumentProjet) => boolean,
): ProjetPortail[] {
  if (linear) {
    return trierProjets(linear).map((p) => ({
      slugId: p.slugId,
      segment: p.segment,
      titre: p.nom,
      resume: p.resume || null,
      statut: p.statut,
      debut: p.debut,
      fin: p.fin,
      nomenclature: projetDuLinear(p.slugId) ?? null,
    }));
  }
  if (!cle) return [];
  const parProjet = new Map<string, DocumentProjet[]>();
  for (const d of documents) {
    if (d.versionDe || !d.projet || clientDuProjet(d.projet) !== cle || !lisible(d)) continue;
    parProjet.set(d.projet, [...(parProjet.get(d.projet) ?? []), d]);
  }
  const plusRecent = (docs: DocumentProjet[]) => Math.max(...docs.map((d) => d.date?.getTime() ?? 0));
  return [...parProjet.entries()]
    .sort(([, a], [, b]) => plusRecent(b) - plusRecent(a))
    .map(([projet, docs]) => {
      // La table garantit l'identifiant : le build échoue sans lui.
      const slugId = linearDuProjet(projet) as string;
      return {
        slugId,
        segment: slugId,
        titre: docs[0].titreProjet ?? projet,
        resume: null,
        statut: null,
        debut: null,
        fin: null,
        nomenclature: projet,
      };
    });
}

/** Le chemin d'un projet sous /espace. Toujours passer le résultat à portalHref. */
export const cheminProjet = (p: Pick<ProjetPortail, "segment">) => `/projets/${p.segment}`;

/** Le slugId Linear qui termine un segment d'adresse, ou `null`. */
export function slugIdDe(segment: string): string | null {
  const m = /(?:^|-)([0-9a-f]{12})$/.exec(segment);
  return m ? m[1] : null;
}

/** Un onglet d'étape de la page projet. */
export interface OngletEtape {
  etape: Etape;
  /** « 2 · Proposition » */
  libelle: string;
  teinte: Teinte;
  /** La racine de l'étape. `null` : l'onglet est grisé. */
  racine: DocumentProjet | null;
  /** Les versions que le compte lit, racine comprise. */
  ids: string[];
  bandeaux: Record<string, Bandeau>;
  /** Date du document lisible le plus récent de l'étape, en ms. 0 sans document. */
  recent: number;
}

/**
 * Les onglets d'un projet, dans l'ordre de la frise. Une étape sans document
 * lisible par le compte garde son onglet, grisé : un brouillon que le client
 * ne lit pas compte comme absent. L'audit n'a d'onglet que s'il existe.
 */
export function ongletsDuProjet(
  documents: DocumentProjet[],
  nomenclature: string | null,
  lire: (d: DocumentProjet) => Lecture,
): OngletEtape[] {
  const onglets: OngletEtape[] = [];
  for (const def of DEFINITIONS) {
    const candidate = nomenclature
      ? documents.find((d) => !d.versionDe && d.projet === nomenclature && d.etape === def.etape)
      : undefined;
    const lues = candidate ? versionsDuPortail(documents, candidate, lire) : { ids: [], bandeaux: {} };
    const racine = candidate && lues.ids.length > 0 ? candidate : null;
    if (def.etape === "audit" && !racine) continue;
    const dates = documents
      .filter((d) => racine && d.collection === racine.collection && lues.ids.includes(d.id))
      .map((d) => d.date?.getTime() ?? 0);
    onglets.push({
      etape: def.etape,
      libelle: `${def.numero} · ${def.libelle}`,
      teinte: def.teinte,
      racine,
      ids: racine ? lues.ids : [],
      bandeaux: racine ? lues.bandeaux : {},
      recent: Math.max(0, ...dates),
    });
  }
  return onglets;
}

/**
 * L'étape ouverte à l'arrivée : celle que l'adresse demande si elle a un
 * document, sinon celle du document le plus récent. À égalité, la plus
 * avancée. `null` quand toutes sont grisées.
 */
export function ongletOuvert(onglets: OngletEtape[], demande: string | null): Etape | null {
  const disponibles = onglets.filter((o) => o.racine);
  const voulu = disponibles.find((o) => o.etape === demande);
  if (voulu) return voulu.etape;
  if (disponibles.length === 0) return null;
  return disponibles.reduce((a, b) => (b.recent >= a.recent ? b : a)).etape;
}
```

`definitionEtape` et `cheminPortail` restent importés pour `sectionsProjets`, que la tâche 7 retire.

- [ ] **Step 4 : lancer les tests**

Run : `npx vitest run`
Expected : PASS, toute la suite.

- [ ] **Step 5 : commit**

```bash
git add src/lib/documents/projets-portail.ts src/lib/documents/projets-portail.test.ts
git commit -m "feat(portail): modèle des projets Linear et des onglets d'étape"
```

---

### Task 4: Changer de workspace depuis une page, et les projets de la requête

**Files:**
- Modify: `src/lib/portail/workspaces.ts` (constante `WORKSPACE_COOLBEANS`)
- Modify: `src/lib/portail/context.ts` (`poserWorkspaceCourant`, `basculerSurCoolbeans`)
- Create: `src/lib/portail/projets-courants.ts`
- Modify: `src/pages/docs/[client]/[...slug].astro` (emploie `poserWorkspaceCourant`)
- Modify: `src/pages/espace/admin/index.astro`, `src/pages/espace/admin/relances.astro`, `src/pages/espace/clients.astro`, `src/pages/espace/utilisateurs.astro`, `src/pages/espace/devis/index.astro`, `src/pages/espace/devis/reglages.astro`

**Interfaces:**
- Consumes : `projetsDeLaTeam`, `cacheWorker` (tâche 2) ; `projetsDuWorkspace`, `ProjetPortail` (tâche 3) ; `lecture` (`acces.ts`) ; `workspacesVisibles` (`appartenances.ts`).
- Produces : `WORKSPACE_COOLBEANS = "coolbeans"` ; `poserWorkspaceCourant(context, workspace): void` ; `basculerSurCoolbeans(context): Promise<void>` ; `lecteurDe(context, workspace): Promise<(d: DocumentProjet) => Lecture>` ; `projetsDe(context, workspace): Promise<ProjetPortail[]>`, mémoïsé par requête et par workspace.

Ce code dépend d'Astro et de `cloudflare:workers` : il n'est pas testable sous Vitest. La vérification est le build, puis la recette de la tâche 10.

- [ ] **Step 1 : la constante du workspace Coolbeans**

Dans `src/lib/portail/workspaces.ts`, sous `DEFAULT_WORKSPACE` :

```ts
/**
 * Le workspace de Coolbeans : la section Admin n'apparaît que là, l'Aide
 * jamais (spec 2026-09-30, barre par workspace, §3). Même valeur que
 * DEFAULT_WORKSPACE, autre sens : l'un est un repli, l'autre une identité.
 */
export const WORKSPACE_COOLBEANS = "coolbeans";
```

- [ ] **Step 2 : poser le workspace courant depuis une page**

Dans `src/lib/portail/context.ts`, ajouter `WORKSPACE_COOLBEANS` à l'import de `./workspaces`, puis en fin de fichier :

```ts
/**
 * L'adresse impose un workspace : cookie posé pour les requêtes suivantes,
 * contexte réécrit pour celle-ci, afin que la barre et la page parlent du même
 * workspace. Préférence d'affichage, sans effet sur les droits.
 */
export function poserWorkspaceCourant(context: PortalRequestContext, workspace: PortalWorkspace): void {
  context.cookies.set(WORKSPACE_COOKIE, workspace.slug, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  overrideCurrentWorkspace(context, workspace);
}

/**
 * Une page de la section Admin s'affiche dans le workspace Coolbeans, jamais
 * ailleurs : ouverte depuis Amusoire, elle y bascule (spec barre §3.1). Sans
 * ça, le cockpit des devis s'afficherait sous la barre d'Amusoire, sans
 * section Admin.
 */
export async function basculerSurCoolbeans(context: PortalRequestContext): Promise<void> {
  const { client } = await getPortalContext(context);
  if (client?.slug === WORKSPACE_COOLBEANS) return;
  const coolbeans = (await listWorkspaces()).find((w) => w.slug === WORKSPACE_COOLBEANS);
  if (coolbeans) poserWorkspaceCourant(context, coolbeans);
}
```

`context.cookies.set` accepte ces options : `PortalRequestContext` porte `cookies` de l'APIContext.

- [ ] **Step 3 : la doc emploie le même geste**

Dans `src/pages/docs/[client]/[...slug].astro`, remplacer le bloc qui pose le cookie puis appelle `overrideCurrentWorkspace(Astro, proprietaire)` par :

```ts
    poserWorkspaceCourant(Astro, proprietaire);
```

Remplacer l'import `getPortalContext, overrideCurrentWorkspace` par `getPortalContext, poserWorkspaceCourant`, et retirer l'import de `WORKSPACE_COOKIE` s'il ne sert plus dans le fichier.

- [ ] **Step 4 : les pages admin basculent sur Coolbeans**

Dans chacune de ces six pages, ajouter `basculerSurCoolbeans` à l'import de `lib/portail/context` (ou créer l'import s'il n'y en a pas, avec le bon nombre de `../`) et appeler, juste après la garde admin quand la page en a une, sinon juste après la ligne `Astro.response.headers.set("Cache-Control", "no-store")` :

```ts
await basculerSurCoolbeans(Astro);
```

- `src/pages/espace/admin/index.astro` (garde dans le middleware : appel après `Cache-Control`)
- `src/pages/espace/admin/relances.astro` (idem)
- `src/pages/espace/clients.astro` (après `if (!isAdmin(meta)) return Astro.redirect("/espace");`)
- `src/pages/espace/utilisateurs.astro` (idem)
- `src/pages/espace/devis/index.astro` (idem)
- `src/pages/espace/devis/reglages.astro` (idem)

`chiffrages/index.astro` et `chiffrages/reglages.astro` redirigent vers `/devis` : ne pas les toucher.

- [ ] **Step 5 : créer `src/lib/portail/projets-courants.ts`**

```ts
/* Les projets d'un workspace pour la requête en cours (spec 2026-09-30, barre
 * par workspace, §4). La barre (PortalLayout) et la page projet les demandent
 * toutes deux : la promesse est mémoïsée par requête et par workspace, comme
 * getPortalContext.
 */
import { env } from "cloudflare:workers";
import { chargerDocuments } from "../documents/charger";
import { lecture, type Lecture } from "../documents/acces";
import type { DocumentProjet } from "../documents/projet";
import { projetsDuWorkspace, type ProjetPortail } from "../documents/projets-portail";
import { workspacesVisibles } from "./appartenances";
import { getPortalContext, type PortalRequestContext } from "./context";
import { cacheWorker, projetsDeLaTeam } from "./projets-linear";
import { listWorkspaces, type PortalWorkspace } from "./workspaces";

const CLE = "__projetsParWorkspace";

/** La règle de lecture du compte connecté, pour les documents d'un workspace. */
export async function lecteurDe(
  context: PortalRequestContext,
  workspace: PortalWorkspace,
): Promise<(d: DocumentProjet) => Lecture> {
  const { meta } = await getPortalContext(context);
  const compte = { role: meta.role, portee: workspacesVisibles(await listWorkspaces(), meta).map((w) => w.slug) };
  return (d) => lecture(d, compte, workspace);
}

export function projetsDe(context: PortalRequestContext, workspace: PortalWorkspace): Promise<ProjetPortail[]> {
  const locals = context.locals as Record<string, unknown>;
  locals[CLE] ??= new Map<string, Promise<ProjetPortail[]>>();
  const memo = locals[CLE] as Map<string, Promise<ProjetPortail[]>>;
  let projets = memo.get(workspace.slug);
  if (!projets) {
    projets = (async () => {
      // Une fiche sans sous-team n'affiche aucun projet (spec §4.1).
      if (!workspace.linearTeamId) return [];
      const [linear, documents, lire] = await Promise.all([
        projetsDeLaTeam(workspace.linearTeamId, { apiKey: env.LINEAR_API_KEY, cache: cacheWorker() }),
        chargerDocuments(),
        lecteurDe(context, workspace),
      ]);
      return projetsDuWorkspace(linear, documents, workspace.cle, (d) => lire(d).lisible);
    })();
    memo.set(workspace.slug, projets);
  }
  return projets;
}
```

- [ ] **Step 6 : build**

Run : `npm run build`
Expected : `Complete!`, code de sortie 0.

- [ ] **Step 7 : lancer les tests**

Run : `npx vitest run`
Expected : PASS.

- [ ] **Step 8 : commit**

```bash
git add src/lib/portail/workspaces.ts src/lib/portail/context.ts src/lib/portail/projets-courants.ts "src/pages/docs/[client]/[...slug].astro" src/pages/espace/admin/index.astro src/pages/espace/admin/relances.astro src/pages/espace/clients.astro src/pages/espace/utilisateurs.astro src/pages/espace/devis/index.astro src/pages/espace/devis/reglages.astro
git commit -m "feat(portail): les pages admin basculent sur Coolbeans, projets mémoïsés par requête"
```

---

### Task 5: La barre par workspace, et Mode d'emploi

**Files:**
- Modify: `src/lib/portail/nav.ts`
- Modify: `src/layouts/PortalLayout.astro`
- Modify: `src/pages/espace/doc.astro`
- Modify: `src/layouts/DocLayout.astro`
- Test: `src/lib/portail/nav.test.ts` (réécrit)

**Interfaces:**
- Consumes : `WORKSPACE_COOLBEANS` (tâche 4) ; `projetsDe` (tâche 4) ; `cheminProjet` (tâche 3).
- Produces : `EntreeProjetBarre { titre: string; chemin: string }` ; `buildSidebar(hostname, meta, client, docPages, projets: EntreeProjetBarre[] = [])`.

- [ ] **Step 1 : réécrire les tests de la barre**

Remplacer tout le contenu de `src/lib/portail/nav.test.ts` par :

```ts
import { describe, expect, it } from "vitest";
import type { PortalWorkspace } from "./workspaces";
import { readPortalMetadata } from "./metadata";
import {
  buildSidebar,
  isActive,
  isPortalHost,
  portalHref,
  type DocPageLink,
  type EntreeProjetBarre,
} from "./nav";

const amusoire: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const sansDoc: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const coolbeans: PortalWorkspace = {
  slug: "coolbeans",
  nom: "Coolbeans",
  uptimerobot_monitor_ids: [],
  archive: false,
};

const client = readPortalMetadata({ portalRole: "client", workspace: "amusoire" });
const admin = readPortalMetadata({ portalRole: "admin", workspace: "coolbeans" });

const docPages: DocPageLink[] = [
  { title: "Vue d'ensemble", href: "/docs/amusoire/vue-densemble" },
  { title: "Édition", href: "/docs/amusoire/edition" },
];

const projets: EntreeProjetBarre[] = [
  {
    titre: "Refonte Webflow et intégration technique",
    chemin: "/projets/refonte-webflow-et-integration-technique-9a553e01b917",
  },
  { titre: "Site anglais et Music Quiz", chemin: "/projets/site-anglais-et-music-quiz-8ca6ad11bb6f" },
];

const flat = (sections: ReturnType<typeof buildSidebar>) =>
  sections.flatMap((s) => s.pages.map((p) => ({ section: s.key, ...p })));
const cles = (sections: ReturnType<typeof buildSidebar>) => sections.map((s) => s.key);

describe("isPortalHost", () => {
  it("reconnaît les deux hôtes portail", () => {
    expect(isPortalHost("my.coolbeans.cc")).toBe(true);
    expect(isPortalHost("my-staging.coolbeans.cc")).toBe(true);
  });

  it("écarte les hôtes du site principal et le dev local", () => {
    for (const h of ["coolbeans.cc", "www.coolbeans.cc", "staging.coolbeans.cc", "localhost"]) {
      expect(isPortalHost(h)).toBe(false);
    }
  });
});

describe("portalHref", () => {
  it("retire le préfixe /espace sur l'hôte portail", () => {
    expect(portalHref("/projets", "my.coolbeans.cc")).toBe("/projets");
    expect(portalHref("/projets", "my-staging.coolbeans.cc")).toBe("/projets");
  });

  // Sans ça, le portail est incliquable en `astro dev` : /projets y est
  // la page vitrine des réalisations, pas le module du portail.
  it("garde le préfixe partout ailleurs", () => {
    expect(portalHref("/projets", "localhost")).toBe("/espace/projets");
    expect(portalHref("/projets", "staging.coolbeans.cc")).toBe("/espace/projets");
  });

  it("rend une racine correcte dans les deux cas", () => {
    expect(portalHref("/", "my.coolbeans.cc")).toBe("/");
    expect(portalHref("", "my.coolbeans.cc")).toBe("/");
    expect(portalHref("/", "localhost")).toBe("/espace");
  });
});

describe("buildSidebar · workspace client", () => {
  const sections = buildSidebar("my.coolbeans.cc", client, amusoire, docPages, projets);

  it("range Bienvenue, Projets, Mode d'emploi, Aide", () => {
    // Mon site n'a aucune page prête côté client : la section disparaît.
    expect(cles(sections)).toEqual(["bienvenue", "projets", "doc", "aide"]);
  });

  it("ne montre que les pages live et configurées", () => {
    expect(flat(sections).map((p) => p.label)).toEqual([
      "Introduction",
      "Refonte Webflow et intégration technique",
      "Site anglais et Music Quiz",
      "Vue d'ensemble",
      "Édition",
      "Ressources",
      "Disponibilités",
    ]);
  });

  it("ne marque jamais une page wip côté client", () => {
    expect(flat(sections).every((p) => !p.wip)).toBe(true);
  });

  it("masque le bloc Admin", () => {
    expect(sections.find((s) => s.key === "admin")).toBeUndefined();
  });

  it("masque le mode d'emploi d'un workspace sans doc", () => {
    expect(buildSidebar("my.coolbeans.cc", client, sansDoc, []).find((s) => s.key === "doc")).toBeUndefined();
  });

  it("n'a pas de section Projets sans projet", () => {
    expect(cles(buildSidebar("my.coolbeans.cc", client, amusoire, docPages))).toEqual(["bienvenue", "doc", "aide"]);
  });
});

describe("buildSidebar · admin dans un workspace client", () => {
  const sections = buildSidebar("my.coolbeans.cc", admin, amusoire, docPages, projets);
  const pages = flat(sections);

  it("n'affiche pas Admin hors du workspace Coolbeans", () => {
    expect(cles(sections)).toEqual(["bienvenue", "projets", "site", "doc", "aide"]);
  });

  it("badge wip les pages non lancées, pas les autres", () => {
    const wip = pages.filter((p) => p.wip).map((p) => p.label);
    expect(wip).toContain("Monitoring");
    expect(wip).toContain("Liens utiles");
    expect(wip).not.toContain("Introduction");
    expect(wip).not.toContain("Ressources");
  });

  it("badge wip une page dont le mapping client manque", () => {
    const monitoring = pages.find((p) => p.label === "Monitoring");
    expect(monitoring?.wip).toBe(true);
    expect(monitoring?.dot).toBe(true);
  });

  it("ouvre la section Aide par les demandes", () => {
    const aide = sections.find((s) => s.key === "aide")!.pages;
    expect(aide[0]).toMatchObject({ label: "Demandes", href: "/demandes" });
    expect(sections.find((s) => s.key === "bienvenue")!.pages.map((p) => p.label)).not.toContain("Demandes");
  });
});

describe("buildSidebar · workspace Coolbeans", () => {
  const sections = buildSidebar("my.coolbeans.cc", admin, coolbeans, [], projets);

  it("range Bienvenue, Projets, Mon site, Mode d'emploi, Admin, sans Aide", () => {
    expect(cles(sections)).toEqual(["bienvenue", "projets", "site", "doc", "admin"]);
  });

  it("porte les outils admin", () => {
    expect(sections.find((s) => s.key === "admin")!.pages.map((p) => p.label)).toEqual([
      "Accueil admin",
      "Mes clients",
      "Utilisateurs",
      "Devis",
    ]);
  });

  it("pointe le mode d'emploi absent vers la page d'explication, en wip", () => {
    const doc = sections.find((s) => s.key === "doc")!;
    expect(doc.label).toBe("Mode d'emploi");
    expect(doc.pages).toEqual([{ label: "Mode d'emploi", href: "/doc", activePrefix: "/espace/doc", wip: true }]);
  });

  it("un compte non admin n'y voit ni Admin ni Aide", () => {
    const lecteur = readPortalMetadata({ portalRole: "client", workspace: "coolbeans" });
    expect(cles(buildSidebar("my.coolbeans.cc", lecteur, coolbeans, [], projets))).toEqual(["bienvenue", "projets"]);
  });
});

describe("buildSidebar · Projets", () => {
  it("une entrée par projet, libellée du nom Linear", () => {
    const section = buildSidebar("my.coolbeans.cc", client, amusoire, docPages, projets).find(
      (s) => s.key === "projets",
    )!;
    expect(section).toMatchObject({ label: "Projets", icon: "folder" });
    expect(section.pages[0]).toEqual({
      label: "Refonte Webflow et intégration technique",
      href: "/projets/refonte-webflow-et-integration-technique-9a553e01b917",
      activePrefix: "/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917",
      wip: false,
    });
  });

  it("hors du portail, l'entrée garde le préfixe /espace", () => {
    const section = buildSidebar("localhost", client, amusoire, docPages, projets).find((s) => s.key === "projets")!;
    expect(section.pages[0].href).toBe("/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917");
  });

  it("sans projet, la barre ne change pas", () => {
    expect(buildSidebar("my.coolbeans.cc", client, amusoire, docPages)).toEqual(
      buildSidebar("my.coolbeans.cc", client, amusoire, docPages, []),
    );
  });
});

describe("buildSidebar · Mode d'emploi", () => {
  it("nomme Mode d'emploi la section des pages de doc", () => {
    const doc = buildSidebar("my.coolbeans.cc", client, amusoire, docPages).find((s) => s.key === "doc")!;
    expect(doc.label).toBe("Mode d'emploi");
    expect(doc.pages.map((p) => p.label)).toEqual(["Vue d'ensemble", "Édition"]);
  });
});

describe("buildSidebar · Analytics", () => {
  const mesure: PortalWorkspace = {
    ...amusoire,
    analytics: [{ host: "amusoire.fr", siteTag: "0123456789abcdef0123456789abcdef" }],
  };

  it("montre Analytics au client dont le site est raccordé", () => {
    const analytics = flat(buildSidebar("my.coolbeans.cc", client, mesure, docPages)).find(
      (p) => p.label === "Analytics",
    );
    expect(analytics?.section).toBe("site");
    expect(analytics?.wip).toBe(false);
  });

  it("la cache au client sans site raccordé", () => {
    expect(flat(buildSidebar("my.coolbeans.cc", client, amusoire, docPages)).find((p) => p.label === "Analytics")).toBeUndefined();
  });

  it("la montre en wip à l'admin quand le site manque", () => {
    expect(flat(buildSidebar("my.coolbeans.cc", admin, amusoire, docPages)).find((p) => p.label === "Analytics")?.wip).toBe(true);
  });
});

describe("buildSidebar · liens et préfixe d'hôte", () => {
  it("préfixe tous les liens hors doc en dehors de l'hôte portail", () => {
    const pages = flat(buildSidebar("localhost", client, amusoire, docPages, projets));
    expect(pages.map((p) => p.href)).toEqual([
      "/espace",
      "/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917",
      "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f",
      "/docs/amusoire/vue-densemble",
      "/docs/amusoire/edition",
      "/espace/ressources",
      "/espace/disponibilites",
    ]);
  });

  it("rend des liens courts sur l'hôte portail", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, amusoire, docPages));
    expect(pages.find((p) => p.label === "Introduction")?.href).toBe("/");
    expect(pages.find((p) => p.label === "Ressources")?.href).toBe("/ressources");
  });
});

describe("isActive", () => {
  const pages = flat(buildSidebar("my.coolbeans.cc", admin, amusoire, docPages, projets));
  const page = (label: string) => pages.find((p) => p.label === label)!;

  it("s'allume sur la page d'un projet", () => {
    expect(isActive(page("Site anglais et Music Quiz"), "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f")).toBe(true);
  });

  it("ne s'allume pas sur une autre entrée", () => {
    expect(
      isActive(page("Site anglais et Music Quiz"), "/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917"),
    ).toBe(false);
    expect(isActive(page("Monitoring"), "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f")).toBe(false);
  });

  // Le piège du préfixe nu : /espace/site ne doit pas allumer une entrée /espace/s.
  it("ne s'allume pas sur un préfixe partiel de segment", () => {
    expect(isActive({ label: "x", href: "/s", activePrefix: "/espace/s" }, "/espace/site")).toBe(false);
  });

  it("n'allume Introduction que sur la racine", () => {
    const intro = page("Introduction");
    expect(isActive(intro, "/espace")).toBe(true);
    expect(isActive(intro, "/espace/")).toBe(true);
    expect(isActive(intro, "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f")).toBe(false);
  });

  // Chaque page de doc ne s'allume que sur elle-même : toutes partagent le
  // préfixe /docs/<client>, un préfixe commun les allumerait toutes.
  it("n'allume qu'une seule page de doc à la fois", () => {
    expect(isActive(page("Édition"), "/docs/amusoire/edition")).toBe(true);
    expect(isActive(page("Vue d'ensemble"), "/docs/amusoire/edition")).toBe(false);
  });
});
```

- [ ] **Step 2 : lancer les tests, ils échouent**

Run : `npx vitest run src/lib/portail/nav.test.ts`
Expected : FAIL (`EntreeProjetBarre` absent, Admin présente dans Amusoire, libellé « Documentation »).

- [ ] **Step 3 : modifier `src/lib/portail/nav.ts`**

1. Importer la constante : `import { missingKeysFor, moduleCoupe, WORKSPACE_COOLBEANS, type PortalWorkspace } from "./workspaces";` et supprimer l'import de `SectionProjet`.
2. Dans `SectionDef`, sous `adminOnly?: boolean;`, ajouter :

```ts
  /** Absente du workspace Coolbeans (spec 2026-09-30, barre par workspace, §3). */
  horsCoolbeans?: boolean;
```

3. Dans `SECTIONS`, supprimer toute la section `key: "projets"` (Actifs, Terminés, Documents) et le commentaire « La section Documentation est construite à part… » qui la précède, puis poser `horsCoolbeans: true` sur la section `aide`.
4. Sous `DocPageLink`, ajouter :

```ts
/** Un projet de la section Projets, résolu par le layout (projets-courants.ts). */
export interface EntreeProjetBarre {
  titre: string;
  /** Chemin sous /espace. */
  chemin: string;
}
```

5. Remplacer `buildSidebar` et `buildDocSection` par :

```ts
/**
 * La sidebar complète pour un utilisateur donné (spec 2026-09-30, barre par
 * workspace, §3).
 *
 * `docPages` : pages de doc du CLIENT COURANT, résolues par le layout. Client
 * sans doc : la section pointe pour l'admin vers la page d'explication
 * /espace/doc, et disparaît pour un client.
 *
 * `projets` : les projets de la sous-team du workspace courant, dans l'ordre
 * de Linear. Une entrée par projet, dans la section Projets.
 *
 * Admin n'apparaît que dans le workspace Coolbeans, l'Aide jamais.
 */
export function buildSidebar(
  hostname: string,
  meta: PortalMetadata,
  client: PortalWorkspace | null,
  docPages: DocPageLink[],
  projets: EntreeProjetBarre[] = [],
): SidebarSection[] {
  const admin = isAdmin(meta);
  const coolbeans = client?.slug === WORKSPACE_COOLBEANS;
  const at = (path: string) => portalHref(path, hostname);

  const sections: SidebarSection[] = [];

  for (const def of SECTIONS) {
    if (def.adminOnly && !(admin && coolbeans)) continue;
    if (def.horsCoolbeans && coolbeans) continue;

    const pages: SidebarPage[] = [];
    for (const page of def.pages) {
      const configured = page.configured?.(client) ?? true;
      const ready = page.flag === "live" && configured;
      if (!admin && !ready) continue;
      pages.push({
        label: page.label,
        href: at(page.path),
        activePrefix: page.path === "/" ? "/espace" : `/espace${page.path}`,
        wip: !ready,
        ...(page.dot ? { dot: true } : {}),
      });
    }
    if (pages.length > 0) sections.push({ key: def.key, label: def.label, icon: def.icon, pages });
  }

  // Projets, juste après Bienvenue : les documents du projet en cours sont ce
  // que le client vient chercher. Chaque entrée ne s'allume que sur sa page.
  if (projets.length > 0) {
    const bienvenue = sections.findIndex((s) => s.key === "bienvenue");
    sections.splice(bienvenue + 1, 0, {
      key: "projets",
      label: "Projets",
      icon: "folder",
      pages: projets.map((p) => ({
        label: p.titre,
        href: at(p.chemin),
        activePrefix: `/espace${p.chemin}`,
        wip: false,
      })),
    });
  }

  // Mode d'emploi se place après Mon site, à défaut après Projets, à défaut
  // après Bienvenue : un index fixe se décalerait dès qu'une section manque.
  const doc = buildDocSection(admin, docPages, at);
  if (doc) {
    const ancre = ["site", "projets", "bienvenue"]
      .map((k) => sections.findIndex((s) => s.key === k))
      .find((i) => i >= 0);
    sections.splice((ancre ?? -1) + 1, 0, doc);
  }

  return sections;
}

function buildDocSection(
  admin: boolean,
  docPages: DocPageLink[],
  at: (path: string) => string,
): SidebarSection | null {
  if (docPages.length > 0) {
    return {
      key: "doc",
      label: "Mode d'emploi",
      icon: "book",
      pages: docPages.map((p) => ({
        label: p.title,
        href: p.href,
        // Chaque page de doc ne s'allume que sur elle-même : toutes partagent
        // le préfixe /docs/<client>, un préfixe commun les allumerait toutes.
        activePrefix: p.href,
        wip: false,
      })),
    };
  }
  if (!admin) return null;
  return {
    key: "doc",
    label: "Mode d'emploi",
    icon: "book",
    pages: [{ label: "Mode d'emploi", href: at("/doc"), activePrefix: "/espace/doc", wip: true }],
  };
}
```

- [ ] **Step 4 : lancer les tests de la barre**

Run : `npx vitest run src/lib/portail/nav.test.ts`
Expected : PASS.

- [ ] **Step 5 : brancher le layout**

Dans `src/layouts/PortalLayout.astro` :
- supprimer les imports de `chargerDocuments`, `lecture`, `sectionsProjets` et `workspacesVisibles` ;
- ajouter `import { cheminProjet } from "../lib/documents/projets-portail";` et `import { projetsDe } from "../lib/portail/projets-courants";` ;
- remplacer le bloc `compteLecteur` / `projets` et son commentaire par :

```ts
// Les projets de la sous-team du workspace courant (spec 2026-09-30, barre par
// workspace, §4). Mémoïsés : la page projet les demande aussi.
const projets = client ? await projetsDe(Astro, client) : [];
```

- dans l'appel à `buildSidebar`, remplacer le dernier argument `projets` par :

```ts
  projets.map((p) => ({ titre: p.titre, chemin: cheminProjet(p) })),
```

- [ ] **Step 6 : « Mode d'emploi » dans les pages**

Dans `src/pages/espace/doc.astro` :
- premier commentaire : « Cible de l'entrée « Mode d'emploi » quand l'utilisateur n'a aucun slug de doc » ;
- `<EspaceLayout title="Mode d'emploi">` et `<h1>Mode d'emploi</h1>` ;
- sous-titre : `Le mode d'emploi de votre site.` ;
- `title` de l'`EmptyState` : `Aucun mode d'emploi associé à cet espace` ;
- corps de l'`EmptyState` : `Le mode d'emploi s'ouvre à la livraison du projet. S'il devrait être là, écrivez à ludo@coolbeans.cc.`

Dans `src/layouts/DocLayout.astro` :

```astro
  title={`${title} · mode d'emploi · ${clientLabel}`}
  description={`Mode d'emploi ${clientLabel}`}
```

- [ ] **Step 7 : tests et build**

Run : `npx vitest run && npm run build`
Expected : PASS, puis `Complete!`.

- [ ] **Step 8 : commit**

```bash
git add src/lib/portail/nav.ts src/lib/portail/nav.test.ts src/layouts/PortalLayout.astro src/pages/espace/doc.astro src/layouts/DocLayout.astro
git commit -m "feat(portail): barre par workspace, section Projets depuis Linear, Mode d'emploi"
```

---

### Task 6: Les composants de document tiennent à plusieurs sur une page

**Files:**
- Modify: `src/components/documents/DocumentEntete.astro`
- Modify: `src/components/documents/DocumentVolet.astro`
- Modify: `src/components/documents/DocumentSections.astro`
- Modify: `src/components/documents/pages/PageProposition.astro`, `PageCadrage.astro`, `PageLivrable.astro`, `PageTemoignage.astro`

**Interfaces:**
- Produces : les quatre `Page*` acceptent `contexte: "public" | "portail" | "projet"`, `prefixe?: string` (défaut `""`) et `versionActive?: string` (id d'entrée). En contexte `projet`, `DocumentEntete` ne rend ni barre Coolbeans, ni filet, ni titre, ni frise : seulement les sous-onglets de version, s'il y en a plusieurs. Le script des onglets n'agit que dans l'élément `[data-etape-volet]` qui les contient, et y met à jour `?version=`.

Les pages publiques ne doivent pas bouger d'un pixel : avec `prefixe` vide et sans `versionActive`, le HTML rendu garde les mêmes classes, les mêmes id et le même texte.

- [ ] **Step 1 : capturer la référence des pages publiques**

Vérifier que le serveur de dev de ce worktree tourne sur 4337 (`lsof -iTCP:4337 -sTCP:LISTEN`), sinon le lancer en fond : `npx astro dev --port 4337`. Puis :

Run : `node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/avant-barre`
Expected : 12 captures PNG (6 pages × 2 largeurs).

- [ ] **Step 2 : `DocumentEntete.astro`**

Remplacer l'interface `Props`, la déstructuration et le balisage (tout ce qui précède `<script>`) par :

```astro
interface Props {
  etape: Etape;
  /** Le nom du projet Linear, ou le titre du document hors nomenclature. */
  titre: string;
  frise: Pastille[];
  /** Un par volet. Moins de deux : pas de barre d'onglets. */
  onglets: { libelle: string; slug: string }[];
  actif: number;
  /**
   * "portail" : pas de DocumentTopbar, la barre du portail en tient lieu.
   * "projet" : ni titre ni frise, la page projet les porte ; restent les
   * sous-onglets de version.
   */
  contexte?: "public" | "portail" | "projet";
  /** Préfixe des id : plusieurs documents partagent la page projet. Vide ailleurs. */
  prefixe?: string;
}

const { etape, titre, frise, onglets, actif, contexte = "public", prefixe = "" } = Astro.props;
const { teinte } = definitionEtape(etape);
const projet = contexte === "projet";
---

{contexte === "public" && <DocumentTopbar />}
{!projet && <div aria-hidden="true" class="h-[3px] print:hidden" style={`background:var(--ds-${teinte}-900)`}></div>}

{
  (!projet || onglets.length > 1) && (
    <header class="container-site print:hidden">
      <div class:list={["mx-auto max-w-[880px]", projet ? "pt-6" : "pt-14 pb-7"]}>
        {!projet && <h1 class="text-[clamp(2rem,4vw,2.75rem)]/[1.08] tracking-[-0.02em]">{titre}</h1>}

        {!projet && <DocumentFrise pastilles={frise} />}

        {onglets.length > 1 && (
          <div class:list={["flex flex-wrap gap-2", !projet && "mt-7"]} role="tablist" aria-label="Versions du document">
            {onglets.map((o, i) => (
              <button
                type="button"
                role="tab"
                id={`${prefixe}onglet-${i}`}
                aria-controls={`${prefixe}volet-${i}`}
                aria-selected={i === actif ? "true" : "false"}
                data-document-onglet={i}
                data-slug={o.slug}
                class="cursor-pointer rounded-full px-[13px] py-[5px] text-[13px]/[1.4] font-semibold text-mute transition-colors duration-150 ease-in-out hover:bg-surface-raise hover:text-ink aria-selected:bg-ink aria-selected:text-surface"
              >
                {o.libelle}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
```

Garder le commentaire de tête du fichier ; y ajouter un paragraphe : « Sur la page projet (contexte "projet"), l'en-tête du projet et les onglets d'étape jouent ce rôle : ce composant ne garde que les sous-onglets de version. »

Remplacer le script par :

```astro
<script>
  /* Bascule des onglets : on change la visibilité, on ne recharge pas. L'état
     vit dans `aria-selected`, que les utilitaires lisent : aucune classe
     ajoutée en JavaScript, donc rien que Tailwind puisse purger.

     Un formulaire qui porte `data-suit-onglet` (proposition, livrable) prend
     le slug de l'onglet affiché, sans quoi une réponse à la V1 arriverait
     étiquetée V2. Un formulaire posé DANS un volet (cadrage à chapitres)
     garde le sien.

     Sur la page projet, chaque étape a ses onglets : on n'agit que dans
     l'étape du bouton, et l'adresse retient la version (?version=). */
  const onglets = document.querySelectorAll<HTMLButtonElement>("[data-document-onglet]");

  onglets.forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const etape = bouton.closest<HTMLElement>("[data-etape-volet]");
      const racine: ParentNode = etape ?? document;
      const cible = bouton.dataset.documentOnglet;
      racine.querySelectorAll<HTMLButtonElement>("[data-document-onglet]").forEach((b) => {
        b.setAttribute("aria-selected", String(b === bouton));
      });
      racine.querySelectorAll<HTMLElement>("[data-document-volet]").forEach((volet) => {
        volet.hidden = volet.dataset.documentVolet !== cible;
      });
      racine.querySelectorAll<HTMLFormElement>("form[data-suit-onglet]").forEach((form) => {
        if (bouton.dataset.slug) form.dataset.slug = bouton.dataset.slug;
      });
      if (etape && bouton.dataset.slug) {
        const url = new URL(location.href);
        url.searchParams.set("version", bouton.dataset.slug);
        history.replaceState(null, "", url);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
</script>
```

- [ ] **Step 3 : `DocumentVolet.astro`**

Ajouter à `Props` :

```ts
  /** Préfixe des id, comme DocumentEntete. Vide hors de la page projet. */
  prefixe?: string;
```

Déstructurer `prefixe = ""`, puis :

```astro
  id={onglets ? `${prefixe}volet-${index}` : undefined}
  role={onglets ? "tabpanel" : undefined}
  aria-labelledby={onglets ? `${prefixe}onglet-${index}` : undefined}
```

- [ ] **Step 4 : `DocumentSections.astro`**

Dans le script, remplacer la fonction `cible` par :

```ts
  /* La section visible qui porte cet id : les volets masqués, et sur la page
     projet les étapes masquées, portent les mêmes ancres. */
  const cible = (id: string) =>
    [...document.querySelectorAll<HTMLElement>(`section[id="${CSS.escape(id)}"]`)].find(
      (s) => s.offsetParent !== null,
    ) ?? document.getElementById(id);
```

Mettre à jour le point 1 du commentaire du script : « Un lien mène à la section visible. Les volets d'un livrable à deux versions, et les étapes d'une page projet, portent les mêmes ancres : le navigateur irait à la première, masquée, et rien ne bougerait. »

- [ ] **Step 5 : les quatre composants de page**

Dans chacun des quatre `Page*.astro`, remplacer dans `Props` la ligne `contexte: "public" | "portail";` par :

```ts
  contexte: "public" | "portail" | "projet";
  /** Préfixe des id sur la page projet. Vide ailleurs. */
  prefixe?: string;
  /** Id de la version à ouvrir, lu dans ?version=. Inconnu ou absent : la dernière. */
  versionActive?: string;
```

et ajouter `prefixe = "", versionActive` à la déstructuration d'`Astro.props`.

`PageProposition.astro` : sous `const actif = versions.length - 1;` ajouter

```ts
/* La version ouverte à l'arrivée : celle que l'adresse demande, sinon la
   dernière. `actif` reste celle qui engage, pour le formulaire. */
const demandee = versionActive ? versions.findIndex((v) => v.id === versionActive) : -1;
const ouvert = demandee >= 0 ? demandee : actif;
```

puis passer `actif={ouvert}` et `prefixe={prefixe}` à `DocumentEntete`, `actif={ouvert}` et `prefixe={prefixe}` à chaque `DocumentVolet`, et `slug={versions[ouvert].id}` à `DevisReponse`.

`PageLivrable.astro` : même ajout sous `const actif = versions.length - 1;`, mêmes props à `DocumentEntete` et `DocumentVolet`, et `slug={versions[ouvert].id}` à `LivrableReponse`.

`PageCadrage.astro` : sous `const actif = chapitres.length - 1;` ajouter

```ts
const demande = versionActive ? chapitres.findIndex((c) => c.id === versionActive) : -1;
const ouvert = demande >= 0 ? demande : actif;
```

puis `actif={ouvert}` et `prefixe={prefixe}` à `DocumentEntete` et à chaque `DocumentVolet`.

`PageTemoignage.astro` : passer `prefixe={prefixe}` à `DocumentEntete` et `DocumentVolet` ; `versionActive` est accepté sans effet (une seule version).

- [ ] **Step 6 : vérifier les pages publiques au pixel**

Run : `node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/apres-t6-barre && node .superpowers/recette-documents/comparer.mjs .superpowers/recette-documents/avant-barre .superpowers/recette-documents/apres-t6-barre`
Expected : aucun écart sur les 12 captures.

- [ ] **Step 7 : tests et build**

Run : `npx vitest run && npm run build`
Expected : PASS, puis `Complete!`.

- [ ] **Step 8 : commit**

```bash
git add src/components/documents/DocumentEntete.astro src/components/documents/DocumentVolet.astro src/components/documents/DocumentSections.astro src/components/documents/pages/PageProposition.astro src/components/documents/pages/PageCadrage.astro src/components/documents/pages/PageLivrable.astro src/components/documents/pages/PageTemoignage.astro
git commit -m "feat(documents): composants de document cloisonnables pour la page projet"
```

---

### Task 7: La page projet

**Files:**
- Create: `src/components/portail/projet/ProjetEntete.astro`
- Create: `src/components/portail/projet/OngletsEtapes.astro`
- Create: `src/pages/espace/projets/[projet].astro`
- Delete: `src/pages/espace/projets/[projet]/[etape].astro`
- Modify: `src/lib/documents/projets-portail.ts` et son test (retirer `sectionsProjets`, `SectionProjet`, `EntreeProjet`)
- Modify: `src/lib/documents/acces.ts` et son test (retirer `documentDuPortail`, `cheminPortail`)

**Interfaces:**
- Consumes : `projetsDe`, `lecteurDe` (tâche 4) ; `poserWorkspaceCourant` (tâche 4) ; `ongletsDuProjet`, `ongletOuvert`, `slugIdDe`, `ProjetPortail`, `OngletEtape` (tâche 3) ; `workspaceDuLinear` (tâche 1) ; `libelleStatut`, `estValide` (tâche 2) ; les `Page*` en contexte `projet` (tâche 6).
- Produces : la route `/espace/projets/<segment>` (`my.coolbeans.cc/projets/<segment>`), panneaux `[data-etape-volet="<étape>"]` d'id `etape-<étape>`, boutons `[data-etape-onglet]` d'id `onglet-etape-<étape>`.

- [ ] **Step 1 : `src/components/portail/projet/ProjetEntete.astro`**

```astro
---
/* L'en-tête d'une page projet (spec 2026-09-30, barre par workspace, §5.1) :
   ce qui identifie la page et ne change jamais d'un onglet à l'autre. Il
   prend toute la largeur de son conteneur.

   Le statut est traduit pour le client. Les dates ne s'affichent qu'une fois
   le projet validé, sorti de Proposal et de Backlog : avant l'acompte, une
   date serait une promesse. */
import { estValide, libelleStatut } from "../../../lib/portail/projets-linear";
import type { ProjetPortail } from "../../../lib/documents/projets-portail";

interface Props {
  projet: ProjetPortail;
}

const { projet } = Astro.props;
const dateLongue = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
const valide = projet.statut !== null && estValide(projet.statut);
const debut = valide ? projet.debut : null;
const fin = valide ? projet.fin : null;
---

<header class="w-full border-b border-line print:hidden">
  <div class="px-6 pt-10 pb-8 md:px-10">
    {
      projet.statut && (
        <span class="inline-block rounded-full bg-surface-raise px-[10px] py-[3px] text-[12px]/[1.4] font-semibold text-ink">
          {libelleStatut(projet.statut)}
        </span>
      )
    }
    <h1 class="mt-3 text-[clamp(2rem,4vw,2.75rem)]/[1.08] tracking-[-0.02em]">{projet.titre}</h1>
    {projet.resume && <p class="mt-3.5 max-w-[62ch] text-lg/normal text-mute">{projet.resume}</p>}
    {
      (debut || fin) && (
        <dl class="mt-5 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[12px]/normal tracking-[0.04em] text-mute uppercase">
          {debut && (
            <div class="flex gap-2">
              <dt>Début</dt>
              <dd>{dateLongue(debut)}</dd>
            </div>
          )}
          {fin && (
            <div class="flex gap-2">
              <dt>Fin prévue</dt>
              <dd>{dateLongue(fin)}</dd>
            </div>
          )}
        </dl>
      )
    }
  </div>
</header>
```

- [ ] **Step 2 : `src/components/portail/projet/OngletsEtapes.astro`**

```astro
---
/* La barre des étapes d'une page projet (spec 2026-09-30, barre par
   workspace, §5.2). Une étape sans document lisible garde son onglet, grisé
   et sans clic. Changer d'étape met l'adresse à jour (?etape=) sans
   recharger : un lien copié rouvre la même étape.

   Onglets soulignés, pour se distinguer des sous-onglets de version, en
   pastilles, que chaque document porte sous cette barre. */
import type { Etape } from "../../../lib/documents/etapes";
import type { OngletEtape } from "../../../lib/documents/projets-portail";

interface Props {
  onglets: OngletEtape[];
  ouvert: Etape | null;
}

const { onglets, ouvert } = Astro.props;
---

<div class="w-full border-b border-line px-6 md:px-10 print:hidden">
  <div class="flex flex-wrap gap-x-6" role="tablist" aria-label="Étapes du projet">
    {
      onglets.map((o) => (
        <button
          type="button"
          role="tab"
          id={`onglet-etape-${o.etape}`}
          aria-controls={o.racine ? `etape-${o.etape}` : undefined}
          aria-selected={o.etape === ouvert ? "true" : "false"}
          disabled={!o.racine}
          data-etape-onglet={o.etape}
          class="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent py-3.5 text-[14px]/[1.4] font-semibold text-mute transition-colors duration-150 ease-in-out hover:text-ink aria-selected:border-ink aria-selected:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:text-mute"
        >
          <span aria-hidden="true" class="size-2 rounded-full" style={`background:var(--ds-${o.teinte}-900)`}></span>
          {o.libelle}
        </button>
      ))
    }
  </div>
</div>

<script>
  const onglets = document.querySelectorAll<HTMLButtonElement>("[data-etape-onglet]:not([disabled])");

  onglets.forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const etape = bouton.dataset.etapeOnglet ?? "";
      document.querySelectorAll<HTMLButtonElement>("[data-etape-onglet]").forEach((b) => {
        b.setAttribute("aria-selected", String(b === bouton));
      });
      document.querySelectorAll<HTMLElement>("[data-etape-volet]").forEach((volet) => {
        volet.hidden = volet.dataset.etapeVolet !== etape;
      });
      const url = new URL(location.href);
      url.searchParams.set("etape", etape);
      url.searchParams.delete("version");
      history.replaceState(null, "", url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
</script>
```

- [ ] **Step 3 : la route `src/pages/espace/projets/[projet].astro`**

```astro
---
/* La page d'un projet dans le portail (spec 2026-09-30, barre par workspace,
   §5). /espace/projets/<segment>, publiée sur my.coolbeans.cc/projets/…

   Une seule page par projet : l'en-tête du projet Linear, une étape par
   onglet, les versions d'une étape en sous-onglets. Le serveur ne rend que
   les documents que le compte lit : un document refusé n'atteint jamais le
   navigateur, même caché. Tout refus répond 404, comme un projet inconnu. */
export const prerender = false;

import { getCollection } from "astro:content";
import PortalLayout from "../../../layouts/PortalLayout.astro";
import ProjetEntete from "../../../components/portail/projet/ProjetEntete.astro";
import OngletsEtapes from "../../../components/portail/projet/OngletsEtapes.astro";
import PageCadrage from "../../../components/documents/pages/PageCadrage.astro";
import PageProposition from "../../../components/documents/pages/PageProposition.astro";
import PageLivrable from "../../../components/documents/pages/PageLivrable.astro";
import PageTemoignage from "../../../components/documents/pages/PageTemoignage.astro";
import { chargerDocuments } from "../../../lib/documents/charger";
import { workspaceDuLinear } from "../../../lib/documents/nomenclature";
import { ongletOuvert, ongletsDuProjet, slugIdDe } from "../../../lib/documents/projets-portail";
import { workspacesVisibles } from "../../../lib/portail/appartenances";
import { getPortalContext, poserWorkspaceCourant } from "../../../lib/portail/context";
import { portalHref } from "../../../lib/portail/nav";
import { lecteurDe, projetsDe } from "../../../lib/portail/projets-courants";
import { listWorkspaces } from "../../../lib/portail/workspaces";

const introuvable = async () => {
  const rendu = await Astro.rewrite("/404");
  return new Response(rendu.body, { status: 404, headers: rendu.headers });
};

Astro.response.headers.set("Cache-Control", "no-store");

const segment = Astro.params.projet ?? "";
const slugId = slugIdDe(segment);
if (!slugId) return introuvable();

const { meta, client } = await getPortalContext(Astro);
const workspaces = await listWorkspaces();
const portee = workspacesVisibles(workspaces, meta);
const dansLaPortee = (slug: string) => portee.some((w) => w.slug === slug);

// Le projet se cherche dans le workspace courant, puis dans celui que la
// nomenclature désigne : un lien reçu par mail ouvre le bon workspace.
let workspace = client && dansLaPortee(client.slug) ? client : null;
let projet = workspace ? (await projetsDe(Astro, workspace)).find((p) => p.slugId === slugId) : undefined;
if (!projet) {
  const designe = workspaceDuLinear(workspaces, slugId);
  if (designe && dansLaPortee(designe.slug) && designe.slug !== workspace?.slug) {
    workspace = designe;
    projet = (await projetsDe(Astro, designe)).find((p) => p.slugId === slugId);
  }
}
if (!workspace || !projet) return introuvable();

// Le nom a changé dans Linear : l'ancienne adresse mène à la nouvelle. Pas
// quand Linear est muet : le segment de repli n'est que l'identifiant court.
if (projet.statut && segment !== projet.segment) {
  return Astro.redirect(portalHref(`/projets/${projet.segment}`, Astro.url.hostname) + Astro.url.search, 302);
}

// L'adresse gagne sur le sélecteur, comme pour la doc.
if (client?.slug !== workspace.slug) poserWorkspaceCourant(Astro, workspace);

const documents = await chargerDocuments();
const lire = await lecteurDe(Astro, workspace);
const onglets = ongletsDuProjet(documents, projet.nomenclature, lire);
const ouvert = ongletOuvert(onglets, Astro.url.searchParams.get("etape"));
const versionDemandee = Astro.url.searchParams.get("version") ?? undefined;

// Les entrées de chaque étape disponible, triées par version.
const etapes = await Promise.all(
  onglets
    .filter((o) => o.racine)
    .map(async (o) => ({
      onglet: o,
      collection: o.racine!.collection,
      entrees: (await getCollection(o.racine!.collection))
        .filter((e) => o.ids.includes(e.id))
        .sort(
          (a, b) => ((a.data as { version?: number }).version ?? 1) - ((b.data as { version?: number }).version ?? 1),
        ),
    })),
);
---

<PortalLayout
  title={`${projet.titre} · Coolbeans`}
  description="Espace client Coolbeans"
  mainClass="document-main"
  pageDocument
>
  <ProjetEntete projet={projet} />
  <OngletsEtapes onglets={onglets} ouvert={ouvert} />

  {
    etapes.map(({ onglet, collection, entrees }) => {
      const commun = {
        pastilles: [],
        contexte: "projet" as const,
        prefixe: `${onglet.etape}-`,
        bandeaux: onglet.bandeaux,
        versionActive: onglet.etape === ouvert ? versionDemandee : undefined,
      };
      return (
        <div
          data-etape-volet={onglet.etape}
          id={`etape-${onglet.etape}`}
          role="tabpanel"
          aria-labelledby={`onglet-etape-${onglet.etape}`}
          hidden={onglet.etape !== ouvert}
        >
          {collection === "devis" && <PageProposition versions={entrees as never} {...commun} />}
          {collection === "livrable" && <PageLivrable versions={entrees as never} {...commun} />}
          {collection === "cadrage" && <PageCadrage versions={entrees as never} {...commun} />}
          {collection === "temoignage" && <PageTemoignage versions={entrees as never} {...commun} />}
        </div>
      );
    })
  }
</PortalLayout>
```

- [ ] **Step 4 : supprimer la route du sous-projet 1 et ses aides**

```bash
git rm "src/pages/espace/projets/[projet]/[etape].astro"
```

Dans `src/lib/documents/projets-portail.ts` : supprimer `EntreeProjet`, `SectionProjet`, `sectionsProjets`, le commentaire de tête qui les décrit (le remplacer par : « Les projets du portail et les onglets d'une page projet (spec 2026-09-30, barre par workspace, §4 et §5). »), et retirer `cheminPortail` et `definitionEtape` des imports.

Dans `src/lib/documents/projets-portail.test.ts` : supprimer les tests qui appellent `sectionsProjets` et l'import correspondant.

Dans `src/lib/documents/acces.ts` : supprimer `documentDuPortail` et `cheminPortail`. Dans `src/lib/documents/acces.test.ts` : supprimer les tests « une adresse du portail désigne une racine, jamais une version » et « le chemin du portail se construit depuis le projet et l'étape », et leurs imports.

Puis vérifier qu'il ne reste aucun appelant :

Run : `grep -rn "sectionsProjets\|SectionProjet\|cheminPortail\|documentDuPortail" src`
Expected : aucune ligne.

- [ ] **Step 5 : tests et build**

Run : `npx vitest run && npm run build`
Expected : PASS, puis `Complete!`.

- [ ] **Step 6 : vérification rapide en local**

Le serveur de dev tourne sur 4337. Lancer `npm run comptes-locaux`, se connecter en `admin@local.test` / `recette-locale` sur `http://localhost:4337/connexion`, ouvrir `http://localhost:4337/espace/projets/2361b9acfd1a`.
Expected : la page CAFA s'ouvre (après redirection vers le segment complet si `LINEAR_API_KEY` est posée dans `.dev.vars`), en-tête « Site web CAFA », onglets Proposition, Production et Livraison actifs, les autres grisés.

- [ ] **Step 7 : commit**

```bash
git add src/components/portail/projet/ProjetEntete.astro src/components/portail/projet/OngletsEtapes.astro "src/pages/espace/projets/[projet].astro" src/lib/documents/projets-portail.ts src/lib/documents/projets-portail.test.ts src/lib/documents/acces.ts src/lib/documents/acces.test.ts
git commit -m "feat(portail): une page par projet, étapes et versions en onglets"
```

---

### Task 8: Retirer les fichiers déposés et l'ancienne section Projets

**Files:**
- Delete: `src/pages/espace/projets.astro`, `src/pages/espace/projets/termines.astro`, `src/pages/espace/projets/documents.astro`
- Delete: `src/pages/api/documents/nouveau.ts`, `src/pages/api/documents/visibilite.ts`, `src/pages/api/documents/fichier/[id].ts`
- Delete: `src/lib/portail/documents/store.ts`, `store.test.ts`, `store.sqlite.test.ts`, `acces.ts`, `acces.test.ts`
- Delete: `src/components/portail/ListeDocuments.tsx`
- Keep: `src/lib/portail/documents/familles.ts` et son test (`src/components/portail/pictos/index.tsx` importe `FamilleDocument`, et `Nav.astro` importe les pictos)
- Modify: `src/lib/portail/workspaces.ts`, `src/lib/portail/workspaces.test.ts` (module `projets`)

La table `documents` et le binding `PORTAL_FILES` ne bougent pas : la table part en second temps, sur ordre de Ludo (spec §7.2), et la messagerie et les témoignages se servent du stockage.

- [ ] **Step 1 : supprimer les fichiers**

```bash
git rm src/pages/espace/projets.astro src/pages/espace/projets/termines.astro src/pages/espace/projets/documents.astro
git rm src/pages/api/documents/nouveau.ts src/pages/api/documents/visibilite.ts "src/pages/api/documents/fichier/[id].ts"
git rm src/lib/portail/documents/store.ts src/lib/portail/documents/store.test.ts src/lib/portail/documents/store.sqlite.test.ts src/lib/portail/documents/acces.ts src/lib/portail/documents/acces.test.ts
git rm src/components/portail/ListeDocuments.tsx
```

- [ ] **Step 2 : retirer le module `projets`**

Dans `src/lib/portail/workspaces.ts`, retirer `"projets"` du type `PortalModule` et la ligne `projets: [],` de `MODULE_REQUIREMENTS`. Dans `src/lib/portail/workspaces.test.ts`, retirer la ligne `expect(missingKeysFor("projets", coolbeans)).toEqual([]);` (et le test entier s'il ne contient plus rien).

- [ ] **Step 3 : vérifier qu'il ne reste aucun appelant**

Run : `grep -rn "api/documents\|ListeDocuments\|portail/documents/store\|portail/documents/acces\|missingKeysFor(\"projets\"\|projets/termines\|projets/documents" src scripts`
Expected : seulement `src/lib/portail/routes-publiques.test.ts` (le test qui affirme que `/projets/documents` n'est pas servi tel quel, toujours vrai) et `src/content/docs/coolbeans/04-portail.mdx` (réécrit à la tâche 9). Toute autre ligne est un appelant oublié : le corriger.

- [ ] **Step 4 : tests et build**

Run : `npx vitest run && npm run build`
Expected : PASS, puis `Complete!`.

- [ ] **Step 5 : commit**

```bash
git add src/lib/portail/workspaces.ts src/lib/portail/workspaces.test.ts
git commit -m "refactor(portail): retire les fichiers déposés et l'ancienne section Projets"
```

(Les `git rm` du step 1 sont déjà indexés.)

---

### Task 9: La doc du portail

**Files:**
- Modify: `src/content/docs/coolbeans/04-portail.mdx`

- [ ] **Step 1 : lire la page et repérer ce qui a changé**

Lire `src/content/docs/coolbeans/04-portail.mdx` en entier. Repérer : la description de la barre latérale, la section « Les documents client », les mentions de la page Documents (fichiers déposés), de « Documentation » ou « La doc » comme libellé de barre, et le tableau « où vit quoi » (lignes `acces.ts`, `projets-portail.ts`, `[projet]/[etape].astro`).

- [ ] **Step 2 : réécrire**

- La barre : Bienvenue, Projets, Mon site, Mode d'emploi, Aide dans un workspace client ; Bienvenue, Projets, Mon site, Mode d'emploi, Admin dans Coolbeans. Admin n'apparaît que dans Coolbeans, l'Aide jamais, donc Demandes non plus. Une page admin ouverte depuis un autre workspace bascule sur Coolbeans.
- Projets : les projets de la sous-team Linear du workspace, annulés exclus, en cours puis à venir puis terminés. Linear est lu au plus une fois toutes les 10 minutes par sous-team ; en panne, repli sur les projets qui ont des documents.
- La page projet : `/projets/<nom-du-projet-identifiant>`. En-tête (nom, résumé Linear, statut traduit, dates une fois le projet validé), étapes en onglets (grisées sans document lisible), versions en sous-onglets, `?etape=` et `?version=` dans l'adresse. Le résumé Linear s'affiche chez le client : on l'écrit pour lui.
- La nomenclature relie chaque projet à son projet Linear par l'identifiant court ; le build échoue sur un identifiant absent ou en double.
- Mode d'emploi remplace « Documentation » et « La doc ».
- Les fichiers déposés n'existent plus ; la table `documents` part en second temps, sur ordre.
- Tableau « où vit quoi », lignes à jour :

| Quoi | Où |
|---|---|
| Règle de lecture et bandeau d'un document | `src/lib/documents/acces.ts` |
| Projets Linear d'une sous-team, cache, libellés de statut | `src/lib/portail/projets-linear.ts` |
| Projets du portail et onglets d'une page projet | `src/lib/documents/projets-portail.ts` |
| Projets de la requête, mémoïsés | `src/lib/portail/projets-courants.ts` |
| Bascule de workspace depuis une page | `poserWorkspaceCourant`, `basculerSurCoolbeans` dans `src/lib/portail/context.ts` |
| Page projet | `src/pages/espace/projets/[projet].astro`, `src/components/portail/projet/` |
| Composants de page des quatre gabarits | `src/components/documents/pages/` (contextes `public`, `portail`, `projet`) |

Supprimer la ligne de la route `[projet]/[etape].astro` et celle des « Sections de projets de la barre latérale ».

- [ ] **Step 3 : build**

Run : `npm run build`
Expected : `Complete!`.

- [ ] **Step 4 : commit**

```bash
git add src/content/docs/coolbeans/04-portail.mdx
git commit -m "docs(portail): barre par workspace, page projet, Mode d'emploi"
```

---

### Task 10: Recette

**Files:**
- Create: `.superpowers/recette-barre/recette.mjs` (ignoré par git, comme `.superpowers/recette-documents/`)

- [ ] **Step 1 : suite complète et build**

Run : `npx vitest run && npm run build`
Expected : PASS, puis `Complete!`.

- [ ] **Step 2 : base locale et serveur**

Run : `npm run comptes-locaux`
Expected : « Base locale prête. Mot de passe de tous les comptes : recette-locale ».
Vérifier que le serveur de dev tourne sur 4337, sinon le lancer en fond : `npx astro dev --port 4337`.

- [ ] **Step 3 : écrire le script de recette HTTP**

Créer `.superpowers/recette-barre/recette.mjs` :

```js
/* Recette HTTP de la barre par workspace et de la page projet, en local.
   Usage : node .superpowers/recette-barre/recette.mjs */
const BASE = "http://localhost:4337";
const MDP = "recette-locale";
const CAFA = "/espace/projets/2361b9acfd1a";
const AMUSOIRE = "/espace/projets/9a553e01b917";

async function connexion(email) {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: MDP }),
  });
  if (!r.ok) throw new Error(`connexion ${email} : ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function page(cookie, chemin, suppl = "") {
  let r = await fetch(`${BASE}${chemin}`, { headers: { cookie: `${cookie}${suppl}` }, redirect: "manual" });
  const redirection = r.status === 302 ? r.headers.get("location") : null;
  if (redirection) r = await fetch(new URL(redirection, BASE), { headers: { cookie: `${cookie}${suppl}` } });
  return { statut: r.status, html: await r.text(), redirection, cookies: r.headers.getSetCookie() };
}

const idsEnDouble = (html) => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
};

let echecs = 0;
const verifier = (nom, ok, detail = "") => {
  console.log(`${ok ? "OK" : "KO"}  ${nom}${ok ? "" : `  ${detail}`}`);
  if (!ok) echecs++;
};

const admin = await connexion("admin@local.test");
const revendeur = await connexion("revendeur@local.test");
const clientAmusoire = await connexion("client-amusoire@local.test");
const clientCafa = await connexion("client-cafa@local.test");

// Admin
let p = await page(admin, CAFA);
verifier("admin : page CAFA en 200", p.statut === 200, p.statut);
verifier("admin : aucun id en double sur la page CAFA", idsEnDouble(p.html).length === 0, idsEnDouble(p.html).join(", "));
verifier("admin : pas de section Admin dans le workspace CAFA", !p.html.includes("Accueil admin"));
p = await page(admin, "/espace/devis", "; portal_workspace=amusoire");
verifier("admin : /devis depuis Amusoire affiche la barre de Coolbeans", p.statut === 200 && p.html.includes("Accueil admin"));
verifier("admin : /devis repose le cookie sur coolbeans", p.cookies.some((c) => c.startsWith("portal_workspace=coolbeans")));
p = await page(admin, "/espace/projets/ancien-nom-2361b9acfd1a");
verifier("admin : un nom périmé mène au projet", p.statut === 200 && p.html.includes("Site web CAFA"));
p = await page(admin, "/espace/projets/000000000000");
verifier("admin : identifiant inconnu en 404", p.statut === 404, p.statut);
p = await page(admin, `${CAFA}?etape=suivi&version=inconnue`);
verifier("admin : étape grisée et version inconnue demandées, la page s'ouvre", p.statut === 200, p.statut);

// Client CAFA
p = await page(clientCafa, CAFA);
verifier("client CAFA : page CAFA en 200", p.statut === 200, p.statut);
verifier("client CAFA : aucun bandeau d'accès dans le HTML", !p.html.includes("le client ne voit pas ce document"));
verifier("client CAFA : pas de section Admin", !p.html.includes("Accueil admin"));
p = await page(clientCafa, AMUSOIRE);
verifier("client CAFA : projet Amusoire en 404", p.statut === 404, p.statut);

// Revendeur et client final
p = await page(revendeur, AMUSOIRE);
verifier("revendeur : projet Amusoire en 200", p.statut === 200, p.statut);
p = await page(revendeur, CAFA);
verifier("revendeur : projet CAFA en 404", p.statut === 404, p.statut);
p = await page(clientAmusoire, AMUSOIRE);
verifier("client Amusoire : projet en 200", p.statut === 200, p.statut);
verifier("client Amusoire : aucun bandeau d'accès dans le HTML", !p.html.includes("le client ne voit pas ce document"));

console.log(echecs === 0 ? "\nRecette : tout est vert." : `\nRecette : ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
```

- [ ] **Step 4 : lancer la recette**

Run : `node .superpowers/recette-barre/recette.mjs`
Expected : chaque ligne `OK`, puis « Recette : tout est vert. » Si la connexion échoue, lire la réponse de `/api/auth/sign-in/email` : l'origine doit correspondre à `BETTER_AUTH_URL` de `.dev.vars`.

- [ ] **Step 5 : pages publiques au pixel**

Run : `node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/apres-barre && node .superpowers/recette-documents/comparer.mjs .superpowers/recette-documents/avant-barre .superpowers/recette-documents/apres-barre`
Expected : aucun écart.

- [ ] **Step 6 : captures pour Ludo**

Avec Playwright sur le Chrome installé (comme `capture.mjs`), capturer en 1440 px, connecté en admin puis en client CAFA : `/espace/projets/2361b9acfd1a` et `/espace/devis`. Les poser dans `.superpowers/recette-barre/`. Aucun commit : c'est de la recette.

## Hors plan, avant la mise en prod

- Réécrire pour le client le résumé Linear de chaque projet des sous-teams clientes (spec §8) : Claude rédige, Ludo valide, Claude les pose dans Linear.
- Suppression de la table `documents` et des fichiers stockés (spec §7.2) : après la mise en prod, sur ordre de Ludo.
