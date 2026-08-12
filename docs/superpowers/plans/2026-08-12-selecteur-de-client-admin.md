# Sélecteur de client pour l'admin — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'admin un sélecteur lui permettant d'afficher le portail tel que chaque client le voit, en introduisant un objet « client » que le code ne possède pas encore.

**Architecture:** Un registre de clients en collection de contenu (`src/content/clients/*.yaml`) devient la source de vérité des mappings ; le `publicMetadata` Clerk se réduit à `{ role, client }`. Une résolution serveur détermine le client courant — son propre client pour un client, le client sélectionné pour un admin — et un cookie de préférence, posé par une Astro Action gardée, mémorise le choix. La colonne de gauche devient permanente sur tout le portail et porte le sélecteur.

**Tech Stack:** Astro 7 (content collections, Astro Actions), Clerk (`@clerk/astro` v4), Cloudflare Workers, Tailwind v4 sur les tokens de `global.css`, Vitest.

**Spec :** [docs/superpowers/specs/2026-08-12-selecteur-de-client-admin-design.md](../specs/2026-08-12-selecteur-de-client-admin-design.md)

## Global Constraints

- **Branche `staging`.** Aucun push vers `main` sans ordre explicite de Ludo.
- **Commits atomiques**, un par tâche minimum, message en français.
- **Design system :** utilitaires Tailwind branchés sur les tokens de `global.css`. Les blocs `<style>` sont interdits hors exceptions (`scripts/verify-design-system.js` §F) — `npm run verify` ne doit pas gagner de nouvel échec. L'échec existant sur `src/pages/projets/[slug].astro` est antérieur et reste toléré.
- **Ne jamais réutiliser un nom de classe de `doc.css`** (`card`, `cards`, `sub`, `brand`, `topnav`, `spacer`, `tgl`) sur un composant du portail : `.doc-root .card` vaut (0,2,0) et bat les utilitaires (0,1,0).
- **Tout nouveau composant est ajouté à la Bibliothèque de `design-system.astro`** dans le commit qui le crée (definition of done).
- **La hauteur de la topbar reste 56 px** (`h-14`) : `doc.css` cale dessus les colonnes collantes (`top: 56px`, `calc(100vh - 56px)`).
- **Aucun secret dans le repo.**
- **Après toute modification de `wrangler.jsonc` :** relancer `npm run build` avant de se fier à un `wrangler deploy --dry-run`, l'adapter aplatissant la config au build.
- Vérification finale de chaque tâche : `npx vitest run`, `npm run build`, `npm run verify`.

---

## Structure des fichiers

**Créés**
- `src/content/clients/coolbeans.yaml`, `src/content/clients/amusoire.yaml` — le registre.
- `src/lib/portail/clients.ts` — accès au registre, exigences par module, clés manquantes.
- `src/lib/portail/clients.test.ts`
- `src/lib/portail/current-client.ts` — résolution pure du client courant.
- `src/lib/portail/current-client.test.ts`
- `src/components/portail/ClientSwitcher.astro` — le `<select>` et son formulaire.
- `src/components/portail/PortalSidebar.astro` — la colonne gauche partagée.

**Modifiés**
- `src/content.config.ts` — déclaration de la collection `clients`.
- `src/lib/portail/metadata.ts` + `.test.ts` — `publicMetadata` réduit à `{ role, client }`.
- `src/lib/portail/context.ts` — expose le client courant, mémoïsé par requête.
- `src/lib/portail/nav.ts` + `.test.ts` — la nav dérive du client courant.
- `src/actions/index.ts` — l'action `portail.choisirClient`.
- `src/components/portail/PortalNav.astro` — logo, salutation, champ de recherche.
- `src/components/portail/EmptyState.astro` — le type des clés manquantes change.
- `src/layouts/EspaceLayout.astro`, `src/layouts/DocLayout.astro` — colonne gauche.
- `src/styles/doc.css` — gabarit à deux colonnes de l'espace.
- `src/pages/docs/[project]/[...slug].astro` — contrôle d'accès.
- `src/pages/espace/*.astro` — lecture du client courant.
- `src/pages/design-system.astro` — Bibliothèque.
- `docs/superpowers/specs/2026-08-11-portail-publicmetadata.md` — mise à jour du schéma.

---

## Task 1 : Le registre de clients

**Files:**
- Create: `src/content/clients/coolbeans.yaml`, `src/content/clients/amusoire.yaml`
- Create: `src/lib/portail/clients.ts`
- Create: `src/lib/portail/clients.test.ts`
- Modify: `src/content.config.ts`

**Interfaces:**
- Consomme : rien.
- Produit :
  - `interface PortalClient { slug: string; nom: string; doc?: string; asana_team_gid?: string; uptimerobot_monitor_ids: string[] }`
  - `DEFAULT_CLIENT: "coolbeans"`
  - `listClients(): Promise<PortalClient[]>` — Coolbeans en tête, puis alphabétique sur `nom`.
  - `getClient(slug: string | null | undefined): Promise<PortalClient | null>`
  - `findClientByDoc(docSlug: string): Promise<PortalClient | null>`
  - `type PortalModule = "projets" | "site" | "doc" | "support"`
  - `type ClientMappingKey = "doc" | "asana_team_gid" | "uptimerobot_monitor_ids"`
  - `missingKeysFor(module: PortalModule, client: PortalClient | null): ClientMappingKey[]`

- [ ] **Step 1: Écrire les deux fichiers du registre**

`src/content/clients/coolbeans.yaml` :

```yaml
# Coolbeans est un client comme les autres : Ludo est le client zéro.
# Les mappings sont optionnels ; absents, les modules affichent un empty state.
nom: Coolbeans
```

`src/content/clients/amusoire.yaml` :

```yaml
nom: Amusoire
doc: amusoire
asana_team_gid: "1217116359107690"
```

- [ ] **Step 2: Déclarer la collection**

Dans `src/content.config.ts`, ajouter avant `export const collections` :

```ts
/* Un fichier YAML par client dans src/content/clients/ ; le nom du fichier est
   le slug du client. Source de vérité des mappings d'un client : sa doc, sa
   team Asana, ses monitors. Le publicMetadata Clerk ne porte plus qu'un
   pointeur `client` vers ce registre — voir
   docs/superpowers/specs/2026-08-12-selecteur-de-client-admin-design.md */
const clients = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/clients" }),
  schema: z.object({
    nom: z.string(),
    doc: z.string().optional(),
    asana_team_gid: z.string().optional(),
    uptimerobot_monitor_ids: z.array(z.string()).default([]),
  }),
});
```

Puis changer la dernière ligne en :

```ts
export const collections = { devis, projets, docs, clients };
```

- [ ] **Step 3: Écrire les tests qui échouent**

Créer `src/lib/portail/clients.test.ts`. Les tests portent sur les fonctions pures ; la lecture de la collection est injectée pour ne pas dépendre d'`astro:content` sous Vitest.

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT,
  findClientByDocIn,
  getClientIn,
  missingKeysFor,
  sortClients,
  type PortalClient,
} from "./clients";

const coolbeans: PortalClient = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [] };
const amusoire: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  asana_team_gid: "1217116359107690",
  uptimerobot_monitor_ids: [],
};
const zebre: PortalClient = { slug: "zebre", nom: "Zèbre", uptimerobot_monitor_ids: [] };
const tous = [zebre, amusoire, coolbeans];

describe("sortClients", () => {
  it("place Coolbeans en tête, puis trie par nom", () => {
    expect(sortClients(tous).map((c) => c.slug)).toEqual(["coolbeans", "amusoire", "zebre"]);
  });

  it("ne plante pas si Coolbeans est absent", () => {
    expect(sortClients([zebre, amusoire]).map((c) => c.slug)).toEqual(["amusoire", "zebre"]);
  });
});

describe("getClientIn", () => {
  it("retrouve un client par son slug", () => {
    expect(getClientIn(tous, "amusoire")).toEqual(amusoire);
  });

  it("renvoie null sur un slug inconnu, vide ou absent", () => {
    for (const s of ["inconnu", "", null, undefined]) {
      expect(getClientIn(tous, s)).toBeNull();
    }
  });
});

describe("findClientByDocIn", () => {
  it("retrouve le client propriétaire d'une doc", () => {
    expect(findClientByDocIn(tous, "amusoire")).toEqual(amusoire);
  });

  // _template n'appartient à aucun client : aucune bascule de contexte.
  it("renvoie null pour une doc que personne ne revendique", () => {
    expect(findClientByDocIn(tous, "_template")).toBeNull();
  });
});

describe("missingKeysFor", () => {
  it("ne réclame rien quand le mapping du module est posé", () => {
    expect(missingKeysFor("projets", amusoire)).toEqual([]);
    expect(missingKeysFor("doc", amusoire)).toEqual([]);
  });

  it("nomme la clé attendue par chaque module", () => {
    expect(missingKeysFor("projets", coolbeans)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("support", coolbeans)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("site", coolbeans)).toEqual(["uptimerobot_monitor_ids"]);
    expect(missingKeysFor("doc", coolbeans)).toEqual(["doc"]);
  });

  // Un utilisateur sans client du tout : tout manque, rien ne plante.
  it("réclame tout quand il n'y a pas de client", () => {
    expect(missingKeysFor("projets", null)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("site", null)).toEqual(["uptimerobot_monitor_ids"]);
  });

  it("traite un tableau de monitors vide comme une clé manquante", () => {
    expect(missingKeysFor("site", amusoire)).toEqual(["uptimerobot_monitor_ids"]);
  });
});

describe("DEFAULT_CLIENT", () => {
  it("vaut coolbeans", () => {
    expect(DEFAULT_CLIENT).toBe("coolbeans");
  });
});
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/clients.test.ts`
Expected: FAIL — `Failed to resolve import "./clients"`.

- [ ] **Step 5: Écrire `src/lib/portail/clients.ts`**

```ts
// Registre des clients du portail (spec 2026-08-12).
//
// Un client est l'unité à laquelle se rattachent une doc, une team Asana et des
// monitors. Avant ce registre, ces trois mappings vivaient sur chaque
// utilisateur Clerk : deux contacts d'un même client pouvaient diverger, et
// rien ne permettait d'énumérer les clients — donc pas de sélecteur possible.
//
// Les fonctions `*In` prennent la liste en argument : c'est ce qui les rend
// testables sans `astro:content`, indisponible sous Vitest.

import { getCollection } from "astro:content";

export interface PortalClient {
  /** Nom du fichier YAML, sans extension. */
  slug: string;
  nom: string;
  /** Slug dans la collection `docs`. Absent = ce client n'a pas de doc. */
  doc?: string;
  asana_team_gid?: string;
  uptimerobot_monitor_ids: string[];
}

/** Client affiché par défaut à l'admin, et tête de liste du sélecteur. */
export const DEFAULT_CLIENT = "coolbeans";

/** Modules dont l'affichage dépend d'un mapping du client. */
export type PortalModule = "projets" | "site" | "doc" | "support";

/** Clés de mapping d'un client, telles que nommées dans le YAML. */
export type ClientMappingKey = "doc" | "asana_team_gid" | "uptimerobot_monitor_ids";

/**
 * Mapping sans lequel un module ne peut rien afficher.
 * Ressources n'y figure pas : son contenu est commun à tous les clients.
 */
export const MODULE_REQUIREMENTS: Record<PortalModule, readonly ClientMappingKey[]> = {
  projets: ["asana_team_gid"],
  support: ["asana_team_gid"],
  site: ["uptimerobot_monitor_ids"],
  doc: ["doc"],
};

/** Coolbeans en tête — c'est le défaut — puis les autres par nom. */
export function sortClients(clients: PortalClient[]): PortalClient[] {
  return [...clients].sort((a, b) => {
    if (a.slug === DEFAULT_CLIENT) return -1;
    if (b.slug === DEFAULT_CLIENT) return 1;
    return a.nom.localeCompare(b.nom, "fr");
  });
}

export function getClientIn(
  clients: PortalClient[],
  slug: string | null | undefined,
): PortalClient | null {
  if (!slug) return null;
  return clients.find((c) => c.slug === slug) ?? null;
}

export function findClientByDocIn(clients: PortalClient[], docSlug: string): PortalClient | null {
  return clients.find((c) => c.doc === docSlug) ?? null;
}

function hasMapping(client: PortalClient, key: ClientMappingKey): boolean {
  switch (key) {
    case "doc":
      return Boolean(client.doc);
    case "asana_team_gid":
      return Boolean(client.asana_team_gid);
    case "uptimerobot_monitor_ids":
      return client.uptimerobot_monitor_ids.length > 0;
  }
}

/**
 * Clés manquantes pour ce module. Tableau vide = le module peut s'afficher.
 * Sans client du tout, tout est réputé manquant plutôt que de lever.
 */
export function missingKeysFor(
  module: PortalModule,
  client: PortalClient | null,
): ClientMappingKey[] {
  const required = MODULE_REQUIREMENTS[module];
  if (!client) return [...required];
  return required.filter((key) => !hasMapping(client, key));
}

/* ---- Accès à la collection ------------------------------------------- */

export async function listClients(): Promise<PortalClient[]> {
  const entries = await getCollection("clients");
  return sortClients(entries.map((e) => ({ slug: e.id, ...e.data })));
}

export async function getClient(slug: string | null | undefined): Promise<PortalClient | null> {
  return getClientIn(await listClients(), slug);
}

export async function findClientByDoc(docSlug: string): Promise<PortalClient | null> {
  return findClientByDocIn(await listClients(), docSlug);
}
```

- [ ] **Step 6: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/clients.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 7: Vérifier que le build accepte la collection**

Run: `npm run build`
Expected: `[build] Complete!`, sans erreur de schéma sur `clients`.

- [ ] **Step 8: Commit**

```bash
git add src/content/clients src/content.config.ts src/lib/portail/clients.ts src/lib/portail/clients.test.ts
git commit -m "feat(portail): registre de clients en collection de contenu

Introduit l'objet « client » qui manquait : un client n'était jusqu'ici
qu'un assemblage de trois clés éparses posées sur chaque utilisateur
Clerk, ce qui interdisait de les énumérer donc d'en proposer un
sélecteur. Le registre porte désormais doc, team Asana et monitors, une
seule fois par client au lieu d'une fois par contact.

Les fonctions de sélection prennent la liste en argument pour rester
testables sans astro:content, indisponible sous Vitest."
```

---

## Task 2 : Le `publicMetadata` se réduit à `{ role, client }`

**Files:**
- Modify: `src/lib/portail/metadata.ts`
- Modify: `src/lib/portail/metadata.test.ts`

**Interfaces:**
- Consomme : rien de Task 1 (volontairement découplé — le metadata ne connaît pas le registre).
- Produit :
  - `interface PortalMetadata { role: PortalRole; client: string | null }`
  - `readPortalMetadata(raw: unknown): PortalMetadata`
  - `isAdmin(meta: PortalMetadata): boolean`

Les exports `PortalMetadataKey`, `MODULE_REQUIREMENTS` et `missingKeysFor` **quittent ce fichier** : ils décrivent le client, et vivent désormais dans `clients.ts` (Task 1).

- [ ] **Step 1: Réécrire les tests**

Remplacer intégralement `src/lib/portail/metadata.test.ts` par :

```ts
import { describe, expect, it } from "vitest";
import { isAdmin, readPortalMetadata } from "./metadata";

describe("readPortalMetadata", () => {
  it("lit le schéma canonique", () => {
    expect(readPortalMetadata({ role: "admin", client: "coolbeans" })).toEqual({
      role: "admin",
      client: "coolbeans",
    });
  });

  it("ne lève pas sur un metadata absent ou vide", () => {
    for (const raw of [undefined, null, {}]) {
      expect(readPortalMetadata(raw)).toEqual({ role: "client", client: null });
    }
  });

  it("retombe sur client pour tout rôle non reconnu", () => {
    expect(readPortalMetadata({ role: "Admin" }).role).toBe("client");
    expect(readPortalMetadata({ role: "superadmin" }).role).toBe("client");
    expect(readPortalMetadata({ role: 42 }).role).toBe("client");
  });

  it("rogne les espaces et écarte les valeurs vides", () => {
    expect(readPortalMetadata({ client: "  amusoire  " }).client).toBe("amusoire");
    expect(readPortalMetadata({ client: "   " }).client).toBeNull();
    expect(readPortalMetadata({ client: 42 }).client).toBeNull();
  });

  // Retombée TEMPORAIRE : entre le déploiement et la mise à jour des comptes
  // dans le dashboard Clerk, un utilisateur n'a pas encore de clé `client`.
  // Sans ça, son portail casse pendant la fenêtre. À retirer ensuite.
  describe("retombée temporaire sur projects[0]", () => {
    it("adopte le premier slug de projects quand client est absent", () => {
      expect(readPortalMetadata({ projects: ["amusoire"] }).client).toBe("amusoire");
    });

    it("tolère un scalaire au lieu d'un tableau", () => {
      expect(readPortalMetadata({ projects: "amusoire" }).client).toBe("amusoire");
    });

    it("ne prend pas le pas sur un client explicite", () => {
      expect(readPortalMetadata({ client: "coolbeans", projects: ["amusoire"] }).client).toBe(
        "coolbeans",
      );
    });

    it("reste null si projects est vide", () => {
      expect(readPortalMetadata({ projects: [] }).client).toBeNull();
    });
  });
});

describe("isAdmin", () => {
  it("distingue admin et client", () => {
    expect(isAdmin(readPortalMetadata({ role: "admin" }))).toBe(true);
    expect(isAdmin(readPortalMetadata({ role: "client" }))).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/metadata.test.ts`
Expected: FAIL — la propriété `client` n'existe pas sur le résultat.

- [ ] **Step 3: Réécrire `src/lib/portail/metadata.ts`**

Remplacer intégralement le contenu par :

```ts
// Schéma canonique du publicMetadata Clerk.
//
// Depuis la spec 2026-08-12, il ne porte plus que deux clés : le rôle et un
// pointeur vers le registre des clients. Les mappings (doc, team Asana,
// monitors) ont migré sur le client — voir src/lib/portail/clients.ts. Un
// mapping vit donc une fois par client, plus une fois par contact, ce qui
// règle le garde-fou 03 au lieu de l'aggraver.
//
//   { "role": "client", "client": "amusoire" }
//
// La lecture reste tolérante : la saisie se fait à la main dans un éditeur
// JSON sans validation, et une forme inattendue doit mener à un empty state,
// jamais à une 500 (critère d'acceptation 7).

/** Rôle applicatif. Tout ce qui n'est pas exactement "admin" est un client. */
export type PortalRole = "client" | "admin";

export interface PortalMetadata {
  role: PortalRole;
  /** Slug dans le registre des clients. `null` si le mapping n'est pas posé. */
  client: string | null;
}

function asSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * TEMPORAIRE — à retirer une fois tous les comptes migrés.
 *
 * Entre le déploiement de cette spec et la mise à jour manuelle des comptes
 * dans le dashboard Clerk, un utilisateur n'a pas encore de clé `client`. On
 * lit alors l'ancien `projects[0]`, sans quoi son portail casse pendant la
 * fenêtre. Voir la section Migration de la spec.
 */
function legacyClient(meta: Record<string, unknown>): string | null {
  const raw = meta.projects;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return asSlug(first);
}

export function readPortalMetadata(raw: unknown): PortalMetadata {
  const meta = (raw ?? {}) as Record<string, unknown>;
  return {
    role: meta.role === "admin" ? "admin" : "client",
    client: asSlug(meta.client) ?? legacyClient(meta),
  };
}

export function isAdmin(meta: PortalMetadata): boolean {
  return meta.role === "admin";
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/metadata.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Vérifier que rien d'autre n'importe les exports supprimés**

Run: `grep -rn "missingKeysFor\|MODULE_REQUIREMENTS\|PortalMetadataKey" src/ --include=*.astro --include=*.ts`
Expected: des occurrences dans `src/pages/espace/*.astro` et `src/components/portail/EmptyState.astro`. Elles seront corrigées en Task 6 et Task 9 — **le build est cassé jusque-là, c'est attendu.** Ne pas commiter avant l'étape suivante.

- [ ] **Step 6: Commit (tests seuls verts, build encore cassé)**

```bash
git add src/lib/portail/metadata.ts src/lib/portail/metadata.test.ts
git commit -m "feat(portail): publicMetadata réduit à role + client

Les trois clés de mapping quittent l'utilisateur pour le registre des
clients : elles décrivent le client, pas la personne. Deux contacts d'un
même client ne peuvent plus diverger.

Une retombée temporaire sur projects[0] couvre la fenêtre entre ce
déploiement et la mise à jour manuelle des comptes dans Clerk, sans
laquelle le portail du client casserait dans l'intervalle.

Les consommateurs de missingKeysFor sont corrigés dans les tâches
suivantes ; le build est volontairement cassé entre les deux."
```

---

## Task 3 : Résolution du client courant

**Files:**
- Create: `src/lib/portail/current-client.ts`
- Create: `src/lib/portail/current-client.test.ts`

**Interfaces:**
- Consomme : `PortalClient`, `getClientIn`, `sortClients`, `DEFAULT_CLIENT` (Task 1) ; `PortalMetadata` (Task 2).
- Produit :
  - `CLIENT_COOKIE = "portal_client"`
  - `resolveCurrentClient(clients: PortalClient[], meta: PortalMetadata, cookieValue: string | null): PortalClient | null`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/portail/current-client.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import type { PortalClient } from "./clients";
import { readPortalMetadata } from "./metadata";
import { CLIENT_COOKIE, resolveCurrentClient } from "./current-client";

const coolbeans: PortalClient = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [] };
const amusoire: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
};
const tous = [coolbeans, amusoire];

const admin = readPortalMetadata({ role: "admin", client: "coolbeans" });
const client = readPortalMetadata({ role: "client", client: "amusoire" });

describe("resolveCurrentClient · non-admin", () => {
  // LE test de sécurité : le cookie est une préférence, jamais une autorisation.
  it("ignore le cookie, même valide et pointant un autre client", () => {
    expect(resolveCurrentClient(tous, client, "coolbeans")?.slug).toBe("amusoire");
  });

  it("renvoie son client, cookie absent", () => {
    expect(resolveCurrentClient(tous, client, null)?.slug).toBe("amusoire");
  });

  it("renvoie null si son client n'existe pas au registre", () => {
    const orphelin = readPortalMetadata({ role: "client", client: "disparu" });
    expect(resolveCurrentClient(tous, orphelin, null)).toBeNull();
  });

  it("renvoie null s'il n'a aucun client", () => {
    expect(resolveCurrentClient(tous, readPortalMetadata({}), null)).toBeNull();
  });
});

describe("resolveCurrentClient · admin", () => {
  it("suit le cookie quand il désigne un client connu", () => {
    expect(resolveCurrentClient(tous, admin, "amusoire")?.slug).toBe("amusoire");
  });

  it("retombe sur son propre client quand le cookie est absent", () => {
    expect(resolveCurrentClient(tous, admin, null)?.slug).toBe("coolbeans");
  });

  it("retombe sur le défaut quand le cookie désigne un client inconnu", () => {
    expect(resolveCurrentClient(tous, admin, "disparu")?.slug).toBe("coolbeans");
  });

  it("retombe sur le défaut quand il n'a pas de client à lui", () => {
    const sansClient = readPortalMetadata({ role: "admin" });
    expect(resolveCurrentClient(tous, sansClient, null)?.slug).toBe("coolbeans");
  });

  // Le portail reste debout si coolbeans.yaml est renommé ou supprimé.
  it("prend le premier client trié quand le défaut n'existe pas", () => {
    const sansDefaut = [amusoire];
    const sansClient = readPortalMetadata({ role: "admin" });
    expect(resolveCurrentClient(sansDefaut, sansClient, null)?.slug).toBe("amusoire");
  });

  it("renvoie null quand le registre est vide", () => {
    expect(resolveCurrentClient([], admin, null)).toBeNull();
  });
});

describe("CLIENT_COOKIE", () => {
  it("porte un nom stable", () => {
    expect(CLIENT_COOKIE).toBe("portal_client");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/current-client.test.ts`
Expected: FAIL — `Failed to resolve import "./current-client"`.

- [ ] **Step 3: Écrire `src/lib/portail/current-client.ts`**

```ts
// Résolution du client courant (spec 2026-08-12, §3).
//
// Fonction pure : elle reçoit le registre, le metadata et la valeur du cookie,
// et n'accède ni à Astro ni au réseau. C'est ce qui rend la règle de sécurité
// testable directement.
//
// LA règle : pour un non-admin, le cookie est IGNORÉ. Pas masqué, pas filtré —
// ignoré. Un cookie forgé chez un client ne produit donc rien. L'Action qui le
// pose revérifie le rôle de son côté : deux barrières indépendantes.

import { DEFAULT_CLIENT, getClientIn, sortClients, type PortalClient } from "./clients";
import { type PortalMetadata } from "./metadata";

/** Cookie de préférence d'affichage. Jamais une autorisation. */
export const CLIENT_COOKIE = "portal_client";

export function resolveCurrentClient(
  clients: PortalClient[],
  meta: PortalMetadata,
  cookieValue: string | null,
): PortalClient | null {
  // Un client ne voit que le sien, quoi qu'il envoie.
  if (meta.role !== "admin") return getClientIn(clients, meta.client);

  // Admin : cookie → son propre client → défaut → premier du registre.
  return (
    getClientIn(clients, cookieValue) ??
    getClientIn(clients, meta.client) ??
    getClientIn(clients, DEFAULT_CLIENT) ??
    sortClients(clients)[0] ??
    null
  );
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/current-client.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portail/current-client.ts src/lib/portail/current-client.test.ts
git commit -m "feat(portail): résolution du client courant

Fonction pure, donc la règle de sécurité se teste directement : pour un
non-admin le cookie est ignoré, pas masqué. Un cookie forgé chez un
client ne produit rien, indépendamment de l'Action qui le pose.

Chaîne de retombées côté admin : cookie, puis son propre client, puis le
défaut, puis le premier du registre — le portail reste debout même si
coolbeans.yaml venait à disparaître."
```

---

## Task 4 : Le contexte expose le client courant

**Files:**
- Modify: `src/lib/portail/context.ts`

**Interfaces:**
- Consomme : `listClients` (Task 1), `resolveCurrentClient`, `CLIENT_COOKIE` (Task 3).
- Produit :
  - `interface PortalContext { user: User | null; meta: PortalMetadata; client: PortalClient | null }`
  - `type PortalRequestContext = Pick<APIContext, "locals" | "cookies">`
  - `getPortalContext(context: PortalRequestContext): Promise<PortalContext>` — **la signature change** : elle prend `Astro` entier et non plus `Astro.locals`, la résolution ayant besoin des cookies.
  - `getPortalMeta(context: PortalRequestContext): Promise<PortalMetadata>`
  - `getCurrentClient(context: PortalRequestContext): Promise<PortalClient | null>`

- [ ] **Step 1: Réécrire `src/lib/portail/context.ts`**

```ts
// Contexte du portail, mémoïsé pour la durée d'une requête.
//
// `Astro.locals.currentUser()` de @clerk/astro n'est pas mémoïsé : chaque appel
// refait un `users.getUser()` bloquant vers la Backend API Clerk. Le layout et
// la page en ont tous deux besoin — sans mémoïsation, deux allers-retours
// réseau par rendu. On y adjoint la résolution du client courant, qui lit la
// collection et le cookie, pour n'avoir qu'un seul point d'entrée.
//
// Prend l'APIContext complet et non `locals` seul : la résolution a besoin des
// cookies.

import type { User } from "@clerk/backend";
import type { APIContext } from "astro";
import { listClients, type PortalClient } from "./clients";

/* On ne demande que ce dont la résolution a besoin. `Astro` dans une page est
   un AstroGlobal, pas un APIContext : exiger le type complet ne compilerait
   pas. Ce Pick accepte les deux, ainsi que le contexte d'une Action. */
export type PortalRequestContext = Pick<APIContext, "locals" | "cookies">;
import { CLIENT_COOKIE, resolveCurrentClient } from "./current-client";
import { readPortalMetadata, type PortalMetadata } from "./metadata";

const CACHE_KEY = "__portalContext";

export interface PortalContext {
  /** `null` si personne n'est connecté. */
  user: User | null;
  meta: PortalMetadata;
  /** Client dont les données doivent s'afficher. `null` si aucun n'est résolu. */
  client: PortalClient | null;
}

type WithCache = APIContext["locals"] & { [CACHE_KEY]?: Promise<PortalContext> };

/**
 * L'utilisateur, son metadata et le client courant, résolus une seule fois par
 * requête. Ne lève jamais : sans session, renvoie le metadata par défaut et un
 * client nul, ce qui mène aux empty states plutôt qu'à une 500.
 */
export function getPortalContext(context: PortalRequestContext): Promise<PortalContext> {
  const cache = context.locals as WithCache;
  // On mémoïse la promesse, pas sa valeur : deux appels concurrents dans le
  // même rendu partagent le même aller-retour réseau.
  cache[CACHE_KEY] ??= (async () => {
    const user = (await context.locals.currentUser()) ?? null;
    const meta = readPortalMetadata(user?.publicMetadata);
    const clients = await listClients();
    const cookie = context.cookies.get(CLIENT_COOKIE)?.value ?? null;
    return { user, meta, client: resolveCurrentClient(clients, meta, cookie) };
  })();
  return cache[CACHE_KEY];
}

export async function getPortalMeta(context: PortalRequestContext): Promise<PortalMetadata> {
  return (await getPortalContext(context)).meta;
}

export async function getCurrentClient(context: PortalRequestContext): Promise<PortalClient | null> {
  return (await getPortalContext(context)).client;
}
```

- [ ] **Step 2: Vérifier que le typage tient**

Run: `npx --yes -p typescript@5 tsc --noEmit -p tsconfig.json 2>&1 | grep 'error TS'`
Expected: des erreurs sur les appelants de `getPortalMeta(Astro.locals)` (signature changée) et sur `missingKeysFor`. **Attendu** — corrigé en Tasks 6 et 9. Seule erreur tolérée en fin de plan : `src/worker.ts(60,9)`, antérieure.

- [ ] **Step 3: Commit**

```bash
git add src/lib/portail/context.ts
git commit -m "feat(portail): le contexte résout et mémoïse le client courant

getPortalContext prend désormais l'APIContext complet et non locals
seul : la résolution du client a besoin des cookies. Elle reste
mémoïsée par requête, la mémoïsation existant pour éviter le double
appel Clerk du layout et de la page.

Les appelants sont mis à jour dans les tâches suivantes."
```

---

## Task 5 : L'Action de changement de client

**Files:**
- Modify: `src/actions/index.ts`

**Interfaces:**
- Consomme : `getClient` (Task 1), `CLIENT_COOKIE` (Task 3), `requireAdmin` (existant dans le fichier).
- Produit : `actions.portail.choisirClient` — action `accept: "form"`, entrée `{ client: string; retour: string }`.

- [ ] **Step 1: Ajouter les imports**

En tête de `src/actions/index.ts`, après les imports existants :

```ts
import { getClient } from "../lib/portail/clients";
import { CLIENT_COOKIE } from "../lib/portail/current-client";
```

- [ ] **Step 2: Ajouter le groupe d'actions**

Dans l'objet `export const server = { ... }`, ajouter une entrée `portail` à côté de `chiffrages` :

```ts
  portail: {
    /* Bascule l'admin d'un espace client à un autre. Le cookie posé ici est
       une préférence d'affichage : la résolution côté serveur l'ignore pour
       un non-admin, et cette action refuse de le poser. Deux barrières
       indépendantes plutôt qu'une. */
    choisirClient: defineAction({
      accept: "form",
      input: z.object({
        client: z.string().regex(SLUG_STRICT, "Slug invalide."),
        // Chemin de retour, forcément interne : une URL absolue permettrait
        // une redirection ouverte.
        retour: z.string().startsWith("/").default("/"),
      }),
      handler: async ({ client, retour }, context) => {
        await requireAdmin(context);

        const cible = await getClient(client);
        if (!cible) {
          throw new ActionError({ code: "NOT_FOUND", message: "Client inconnu." });
        }

        context.cookies.set(CLIENT_COOKIE, cible.slug, {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });

        return { client: cible.slug, retour };
      },
    }),
  },
```

- [ ] **Step 3: Exporter `requireAdmin` et le couvrir par un test**

La spec exige de tester le refus pour un non-admin. Le handler d'une Action n'est
pas appelable directement, mais sa garde l'est. Rendre `requireAdmin` exportable :

```ts
export async function requireAdmin(context: ActionAPIContext): Promise<void> {
```

Créer `src/actions/require-admin.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import type { ActionAPIContext } from "astro:actions";
import { requireAdmin } from "./index";

const contexte = (publicMetadata: unknown, connecte = true) =>
  ({
    locals: { currentUser: async () => (connecte ? { publicMetadata } : null) },
  }) as unknown as ActionAPIContext;

describe("requireAdmin", () => {
  it("laisse passer un admin", async () => {
    await expect(requireAdmin(contexte({ role: "admin" }))).resolves.toBeUndefined();
  });

  it("refuse un client", async () => {
    await expect(requireAdmin(contexte({ role: "client" }))).rejects.toThrow(/administrateur/i);
  });

  it("refuse un metadata vide ou un rôle mal casé", async () => {
    await expect(requireAdmin(contexte({}))).rejects.toThrow();
    await expect(requireAdmin(contexte({ role: "Admin" }))).rejects.toThrow();
  });

  it("refuse une session absente", async () => {
    await expect(requireAdmin(contexte({ role: "admin" }, false))).rejects.toThrow();
  });
});
```

Run: `npx vitest run src/actions/require-admin.test.ts`
Expected: PASS — 4 tests. Si l'import d'`astro:actions` échoue sous Vitest, extraire
`requireAdmin` dans `src/lib/portail/require-admin.ts` sans dépendance à
`astro:actions` (prendre `locals` en paramètre, lever une `Error` que l'action
convertit en `ActionError`) et adapter le test en conséquence.

- [ ] **Step 4: Vérifier que le build passe sur ce fichier**

Run: `npm run build 2>&1 | grep -i "actions/index"`
Expected: aucune sortie — pas d'erreur imputable à ce fichier. (Le build peut encore échouer ailleurs, cf. Tasks 6 et 9.)

- [ ] **Step 5: Commit**

```bash
git add src/actions/index.ts src/actions/require-admin.test.ts
git commit -m "feat(portail): action de changement de client, gardée admin

requireAdmin est revérifié côté serveur et le slug validé contre le
registre : une requête forgée ne pose rien. Le chemin de retour est
contraint à commencer par une barre, une URL absolue ouvrant sinon une
redirection ouverte.

Le cookie est HttpOnly, Secure, SameSite=Lax, un an."
```

---

## Task 6 : La nav et les empty states dérivent du client courant

**Files:**
- Modify: `src/lib/portail/nav.ts`
- Modify: `src/lib/portail/nav.test.ts`
- Modify: `src/components/portail/EmptyState.astro`

**Interfaces:**
- Consomme : `PortalClient`, `ClientMappingKey` (Task 1) ; `PortalMetadata` (Task 2).
- Produit : `buildPortalNav(hostname: string, meta: PortalMetadata, client: PortalClient | null): PortalNavItem[]` — **la signature gagne un troisième argument**. `isPortalHost`, `portalHref` et `isActive` sont inchangés.

- [ ] **Step 1: Adapter les tests**

Dans `src/lib/portail/nav.test.ts`, remplacer l'en-tête et les appels. Le haut du fichier devient :

```ts
import { describe, expect, it } from "vitest";
import type { PortalClient } from "./clients";
import { readPortalMetadata } from "./metadata";
import { buildPortalNav, isActive, isPortalHost, portalHref } from "./nav";

const avecDoc: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
};
const sansDoc: PortalClient = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [] };

const client = readPortalMetadata({ role: "client", client: "amusoire" });
const admin = readPortalMetadata({ role: "admin", client: "coolbeans" });
```

Puis, dans les blocs `describe("buildPortalNav")` et `describe("isActive")`, remplacer chaque appel :

- `buildPortalNav("my.coolbeans.cc", client)` → `buildPortalNav("my.coolbeans.cc", client, avecDoc)`
- `buildPortalNav("my.coolbeans.cc", admin)` → `buildPortalNav("my.coolbeans.cc", admin, avecDoc)`
- `buildPortalNav("my.coolbeans.cc", sansDoc)` → `buildPortalNav("my.coolbeans.cc", client, sansDoc)`
- `buildPortalNav("localhost", client)` → `buildPortalNav("localhost", client, avecDoc)`
- dans `isActive`, `const nav = buildPortalNav("my.coolbeans.cc", client)` → `..., client, avecDoc)`

Enfin, ajouter ce bloc en fin de fichier — c'est la régression que la spec corrige :

```ts
describe("buildPortalNav · l'entrée Doc suit le client courant", () => {
  // Le défaut relevé le 2026-08-12 : la nav dérivait de publicMetadata.projects
  // alors que l'accès à la doc se décide sur le client. Un admin basculé sur
  // Amusoire doit voir la doc d'Amusoire, quel que soit son propre client.
  it("pointe la doc du client courant, pas celle de l'utilisateur", () => {
    const doc = buildPortalNav("my.coolbeans.cc", admin, avecDoc).find((i) => i.label === "Doc");
    expect(doc?.href).toBe("/docs/amusoire");
  });

  it("bascule sur la page d'explication quand le client courant n'a pas de doc", () => {
    const nav = buildPortalNav("my.coolbeans.cc", admin, sansDoc);
    expect(nav.find((i) => i.label === "Doc")?.href).toBe("/doc");
  });

  it("bascule aussi quand il n'y a aucun client courant", () => {
    const nav = buildPortalNav("my.coolbeans.cc", client, null);
    expect(nav.find((i) => i.label === "Doc")?.href).toBe("/doc");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/nav.test.ts`
Expected: FAIL — `buildPortalNav` n'accepte que deux arguments.

- [ ] **Step 3: Adapter `src/lib/portail/nav.ts`**

Remplacer l'import de `PortalMetadata` par :

```ts
import type { PortalClient } from "./clients";
import type { PortalMetadata } from "./metadata";
```

Remplacer le bloc de commentaire et la signature de `buildPortalNav` par :

```ts
/**
 * Les cinq entrées du wireframe, plus les entrées admin-only qui s'y ajoutent
 * (l'espace admin est le même portail, avec du contenu en plus — pas une autre
 * interface).
 *
 * L'entrée Doc suit le CLIENT COURANT et non l'utilisateur : un admin basculé
 * sur Amusoire doit voir la doc d'Amusoire. Quand le client courant n'a pas de
 * doc — ou qu'il n'y a pas de client courant — l'entrée mène à une page de
 * l'espace qui l'explique, plutôt qu'à un lien mort (/docs n'est pas une
 * route) ou à une entrée qui disparaît de la nav.
 */
export function buildPortalNav(
  hostname: string,
  meta: PortalMetadata,
  client: PortalClient | null,
): PortalNavItem[] {
  const at = (path: string) => portalHref(path, hostname);
  const docSlug = client?.doc;

  const items: PortalNavItem[] = [
    { label: "Projets", href: at("/projets"), activePrefix: "/espace/projets" },
    { label: "Mon site", href: at("/site"), activePrefix: "/espace/site" },
    {
      label: "Doc",
      href: docSlug ? `/docs/${docSlug}` : at("/doc"),
      activePrefix: docSlug ? "/docs" : "/espace/doc",
    },
    { label: "Ressources", href: at("/ressources"), activePrefix: "/espace/ressources" },
    { label: "Support", href: at("/support"), activePrefix: "/espace/support" },
  ];

  if (meta.role === "admin") {
    items.push({
      label: "Chiffrages",
      href: at("/chiffrages"),
      activePrefix: "/espace/chiffrages",
    });
  }

  return items;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/nav.test.ts`
Expected: PASS — 17 tests.

- [ ] **Step 5: Adapter le type des clés dans `EmptyState.astro`**

Dans `src/components/portail/EmptyState.astro`, remplacer la ligne d'import :

```ts
import type { PortalMetadataKey } from "../../lib/portail/metadata";
```

par :

```ts
import type { ClientMappingKey } from "../../lib/portail/clients";
```

et la propriété correspondante :

```ts
  /** Clés absentes du registre client, via missingKeysFor(). */
  missingKeys?: ClientMappingKey[];
```

Adapter aussi le texte du diagnostic, qui parlait du `publicMetadata` de l'utilisateur alors que les clés décrivent maintenant le client. Remplacer le contenu du `<span class="mt-1 block">` par :

```astro
        <span class="mt-1 block">
          {missingKeys.map((key, i) => (
            <>
              {i > 0 && ", "}
              <code class="font-mono">{key}</code>
            </>
          ))}
          {missingKeys.length > 1 ? " sont absentes" : " est absente"} de la fiche de ce
          client. À poser dans <code class="font-mono">src/content/clients/</code>.
        </span>
```

- [ ] **Step 6: Lancer toute la suite**

Run: `npx vitest run`
Expected: PASS. Le build reste cassé (pages de l'espace), corrigé en Task 9.

- [ ] **Step 7: Commit**

```bash
git add src/lib/portail/nav.ts src/lib/portail/nav.test.ts src/components/portail/EmptyState.astro
git commit -m "feat(portail): la nav et les empty states suivent le client courant

Corrige le défaut relevé après le déploiement de S0 : la nav dérivait de
publicMetadata.projects tandis que la route doc accordait tout aux
admins, si bien qu'un admin sans projects lisait « aucune documentation »
tout en pouvant ouvrir /docs/amusoire. L'entrée Doc suit désormais le
client courant.

Le diagnostic admin renvoie vers la fiche du client plutôt que vers le
publicMetadata de l'utilisateur, les clés ayant changé de porteur."
```

---

## Task 7 : Contrôle d'accès de la doc et bascule par l'URL

**Files:**
- Modify: `src/pages/docs/[project]/[...slug].astro:20-27`

**Interfaces:**
- Consomme : `getPortalContext` (Task 4), `findClientByDoc` (Task 1), `CLIENT_COOKIE` (Task 3).
- Produit : rien pour les tâches suivantes.

- [ ] **Step 1: Remplacer le bloc de contrôle d'accès**

Dans `src/pages/docs/[project]/[...slug].astro`, remplacer :

```ts
// Droit par projet : publicMetadata.projects = ["amusoire", …] sur l'utilisateur
// (dashboard Clerk). role = "admin" voit tout (y compris /docs/_template).
const user = await Astro.locals.currentUser();
const meta = (user?.publicMetadata ?? {}) as { projects?: string[]; role?: string };
const allowed = meta.role === "admin" || (meta.projects ?? []).includes(project ?? "");
if (!allowed) return Astro.redirect("/espace");
```

par :

```ts
// Droit d'accès : on voit la doc de son client courant. Pour un admin, le
// client courant est celui qu'il a choisi — ou celui que l'URL impose, voir
// juste en dessous — donc l'accès reste total sans clause d'exception.
//
// _template n'appartient à aucun client : il reste réservé aux admins par un
// test de rôle explicite.
import { findClientByDoc } from "../../../lib/portail/clients";
import { CLIENT_COOKIE } from "../../../lib/portail/current-client";
import { getPortalContext } from "../../../lib/portail/context";

const { meta, client } = await getPortalContext(Astro);
const isAdminUser = meta.role === "admin";

// L'URL gagne sur le sélecteur : un admin qui ouvre /docs/amusoire alors que
// son contexte est Coolbeans voit la page ET bascule dessus. Sans ça, le
// sélecteur afficherait un client pendant que l'écran en montre un autre.
// Une requête GET pose donc un cookie : ce n'est pas pur, mais il s'agit d'une
// préférence d'affichage, sans effet sur les données.
let effectif = client;
if (isAdminUser && project && client?.doc !== project) {
  const proprietaire = await findClientByDoc(project);
  if (proprietaire) {
    Astro.cookies.set(CLIENT_COOKIE, proprietaire.slug, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    effectif = proprietaire;
  }
}

const allowed = project === "_template" ? isAdminUser : effectif?.doc === project;
if (!allowed) return Astro.redirect("/espace");
```

Placer les trois `import` en haut du frontmatter, avec les autres imports, et non au milieu du bloc.

- [ ] **Step 2: Mettre à jour l'appel à `DocLayout`**

Plus bas dans le même fichier, `DocLayout` reçoit déjà ses props. Aucune modification n'est nécessaire ici : le layout résout le contexte lui-même (Task 8).

- [ ] **Step 3: Vérifier le build**

Run: `npm run build 2>&1 | grep -iE "\berror\b|docs/\[project\]"`
Expected: aucune erreur imputable à ce fichier.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/docs/[project]/[...slug].astro"
git commit -m "feat(portail): l'accès à la doc suit le client courant

La clause « admin voit tout » disparaît au profit d'une règle unique :
on voit la doc de son client courant. Pour un admin, ouvrir /docs/X
bascule le contexte sur le client propriétaire de X — l'URL gagne, ce
qui interdit l'état où le sélecteur affiche un client pendant que
l'écran en montre un autre.

_template n'appartenant à aucun client, il garde son test de rôle."
```

---

## Task 8 : Colonne gauche partagée, sélecteur et topbar

**Files:**
- Create: `src/components/portail/ClientSwitcher.astro`
- Create: `src/components/portail/PortalSidebar.astro`
- Modify: `src/components/portail/PortalNav.astro`
- Modify: `src/layouts/EspaceLayout.astro`
- Modify: `src/layouts/DocLayout.astro`
- Modify: `src/styles/doc.css`

**Interfaces:**
- Consomme : `getPortalContext` (Task 4), `listClients` (Task 1), `actions.portail.choisirClient` (Task 5), `buildPortalNav` (Task 6).
- Produit : `<PortalSidebar clients meta current />` et `<ClientSwitcher clients current compact />`.

- [ ] **Step 1: Écrire `ClientSwitcher.astro`**

```astro
---
// Sélecteur de client, réservé aux admins (spec 2026-08-12, §7).
//
// Formulaire natif vers l'Action : sans JavaScript, le bouton « Afficher »
// prend le relais. Le script le masque et soumet au changement.
//
// Rien ici n'autorise quoi que ce soit : l'Action revérifie le rôle et le
// slug côté serveur, et la résolution ignore le cookie pour un non-admin.
import { actions } from "astro:actions";
import type { PortalClient } from "../../lib/portail/clients";

interface Props {
  clients: PortalClient[];
  current: PortalClient | null;
  /** Variante resserrée pour la topbar mobile. */
  compact?: boolean;
}

const { clients, current, compact = false } = Astro.props;
const retour = Astro.url.pathname;
---

<form
  method="POST"
  action={actions.portail.choisirClient}
  class:list={["flex items-center gap-2", compact ? "w-auto" : "w-full"]}
  data-client-switcher
>
  <input type="hidden" name="retour" value={retour} />
  <label class="sr-only" for="portal-client">Espace client affiché</label>
  <select
    id="portal-client"
    name="client"
    class:list={[
      "h-9 rounded-control border border-line bg-surface px-2 text-sm text-ink",
      compact ? "max-w-40" : "w-full",
    ]}
  >
    {
      clients.map((c) => (
        <option value={c.slug} selected={c.slug === current?.slug}>
          {c.nom}
        </option>
      ))
    }
  </select>
  <button
    type="submit"
    class="h-9 flex-none cursor-pointer rounded-control border border-line bg-surface px-2.5 text-sm text-ink"
    data-switcher-submit
  >
    Afficher
  </button>
</form>

<script>
  // Sans JS, le bouton reste : le formulaire fonctionne quand même.
  document.querySelectorAll<HTMLFormElement>("[data-client-switcher]").forEach((form) => {
    form.querySelector<HTMLButtonElement>("[data-switcher-submit]")?.remove();
    form
      .querySelector<HTMLSelectElement>("select")
      ?.addEventListener("change", () => form.submit());
  });
</script>
```

- [ ] **Step 2: Écrire `PortalSidebar.astro`**

```astro
---
// Colonne gauche du portail, partagée par EspaceLayout et DocLayout
// (spec 2026-08-12, §6). Un seul composant pour que les deux gabarits ne
// divergent pas.
//
// Elle ne se rend que si elle a quelque chose à porter : pour un client sur
// /projets aujourd'hui — ni sélecteur, ni nav contextuelle — elle disparaît
// au lieu d'afficher 264 px de vide. Le slot accueille la nav contextuelle
// des modules à mesure qu'ils arrivent.
import ClientSwitcher from "./ClientSwitcher.astro";
import type { PortalClient } from "../../lib/portail/clients";

interface Props {
  clients: PortalClient[];
  current: PortalClient | null;
  isAdmin: boolean;
}

const { clients, current, isAdmin } = Astro.props;
const hasSlot = Astro.slots.has("default");
const visible = isAdmin || hasSlot;
---

{
  visible && (
    <aside class="portal-left">
      {isAdmin && (
        <div class="mb-6x">
          <ClientSwitcher clients={clients} current={current} />
        </div>
      )}
      <slot />
    </aside>
  )
}
```

- [ ] **Step 3: Ajouter les styles de gabarit dans `doc.css`**

À la fin de `src/styles/doc.css`, ajouter :

```css
/* ---- Gabarit du portail : colonne gauche partagée -------------------------
   La colonne reprend la géométrie de .doc-left (264 px, collante sous la
   topbar de 56 px) pour que l'espace et la doc s'alignent au pixel. */
.doc-root .portal-left {
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  overflow: auto;
  border-right: 1px solid var(--line);
  padding: 28px 20px 60px;
}
.doc-root .espace-shell {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  align-items: start;
  max-width: 1400px;
  margin: 0 auto;
}
/* Sans colonne (client sans nav contextuelle), le contenu reprend sa largeur. */
.doc-root .espace-shell.solo {
  grid-template-columns: minmax(0, 1fr);
}
.doc-root .espace-shell .espace-main {
  padding: 56px 40px 110px;
}

@media (max-width: 900px) {
  .doc-root .portal-left {
    display: none;
  }
  .doc-root .espace-shell,
  .doc-root .doc-shell {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 4: Adapter `EspaceLayout.astro`**

Remplacer intégralement le contenu par :

```astro
---
// Espace client Coolbeans : topbar commune (PortalNav) et colonne gauche
// partagée (PortalSidebar) au-dessus des pages protégées. La doc a son propre
// layout, avec la même topbar et la même colonne.
import BaseLayout from "./BaseLayout.astro";
import PortalNav from "../components/portail/PortalNav.astro";
import PortalSidebar from "../components/portail/PortalSidebar.astro";
import { listClients } from "../lib/portail/clients";
import { getPortalContext } from "../lib/portail/context";
import "../styles/doc.css";

interface Props {
  title: string;
}
const { title } = Astro.props;

const { meta, client } = await getPortalContext(Astro);
const admin = meta.role === "admin";
// Le registre n'est lu que pour l'admin : lui seul voit le sélecteur.
const clients = admin ? await listClients() : [];
---

<BaseLayout title={`${title} · Coolbeans`} description="Espace client Coolbeans" noindex>
  <div class="doc-root">
    <PortalNav meta={meta} client={client} clients={clients} />
    {/* `solo` doit refléter la visibilité décidée par PortalSidebar
        (isAdmin || slot). EspaceLayout ne passe pas de slot : les deux
        conditions coïncident. À revoir le jour où une page en passera un. */}
    <div class:list={["espace-shell", !admin && "solo"]}>
      <PortalSidebar clients={clients} current={client} isAdmin={admin} />
      <main class="espace-main">
        <slot />
      </main>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 5: Adapter `DocLayout.astro`**

Remplacer les imports du contexte par :

```ts
import PortalSidebar from "../components/portail/PortalSidebar.astro";
import { listClients } from "../lib/portail/clients";
import { getPortalContext } from "../lib/portail/context";
```

Remplacer la résolution du metadata par :

```ts
// La doc fait partie du portail : même topbar, même colonne.
const { meta: portalMeta, client: portalClient } = await getPortalContext(Astro);
const portalClients = portalMeta.role === "admin" ? await listClients() : [];
```

Remplacer `<PortalNav meta={portalMeta} />` par :

```astro
    <PortalNav meta={portalMeta} client={portalClient} clients={portalClients} />
```

Remplacer le bloc `<aside class="doc-left">…</aside>` par :

```astro
      <PortalSidebar
        clients={portalClients}
        current={portalClient}
        isAdmin={portalMeta.role === "admin"}
      >
        <SidebarNav items={nav} />
      </PortalSidebar>
```

Le champ de recherche disparaît d'ici : il remonte dans la topbar (étape suivante). Supprimer le bloc :

```astro
        <div class="doc-search">
          <input id="doc-q" type="search" placeholder="Rechercher… (⌘K)" autocomplete="off" />
          <div id="doc-qres" hidden></div>
        </div>
```

Enfin, supprimer de `doc.css` le bloc `.doc-root .doc-left { … }`, devenu mort : `.portal-left` porte la même géométrie et prend sa place dans la grille.

- [ ] **Step 6: Adapter `PortalNav.astro`**

Trois changements. D'abord les props et le contexte, en tête :

```ts
import { UserButton } from "@clerk/astro/components";
import { buildPortalNav, isActive, portalHref } from "../../lib/portail/nav";
import ClientSwitcher from "./ClientSwitcher.astro";
import type { PortalClient } from "../../lib/portail/clients";
import type { PortalMetadata } from "../../lib/portail/metadata";

interface Props {
  meta: PortalMetadata;
  client: PortalClient | null;
  clients: PortalClient[];
  /** Le menu compte exige une session Clerk : la Bibliothèque passe false. */
  withAccount?: boolean;
  /** Prénom affiché dans la salutation. */
  prenom?: string;
}

const { meta, client, clients, withAccount = true, prenom = "" } = Astro.props;
const { hostname, pathname } = Astro.url;
const items = buildPortalNav(hostname, meta, client);
const home = portalHref("/", hostname);
const admin = meta.role === "admin";
```

Ensuite, le logo devient `myCoolbeans` en un mot, avec la pastille de la maquette :

```astro
  <a
    href={home}
    class="flex flex-none items-center gap-2 font-display text-base font-bold tracking-[-0.02em] text-ink no-underline"
  >
    <span class="block size-4 rounded-[3px] bg-ink" aria-hidden="true"></span>
    myCoolbeans
  </a>
```

Enfin, remplacer le bloc de l'emplacement ⌘K (le `<span>` non interactif) par le vrai champ, plus le sélecteur mobile et la salutation :

```astro
  {/*
    La recherche remonte du panneau de doc vers la topbar (maquette du
    2026-08-12). Le champ est rendu partout ; DocLayout l'active quand un
    index de doc est présent, il reste inerte ailleurs.
  */}
  <div class="relative hidden flex-none lg:block">
    <input
      id="doc-q"
      type="search"
      autocomplete="off"
      placeholder="Rechercher dans la doc ⌘K"
      class="h-9 w-64 rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-mute"
    />
    <div id="doc-qres" hidden></div>
  </div>

  {/* Sous 900 px la colonne gauche se replie : le sélecteur la suit ici. */}
  {
    admin && (
      <span class="flex-none lg:hidden">
        <ClientSwitcher clients={clients} current={client} compact />
      </span>
    )
  }

  <button
    class="flex-none cursor-pointer rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
    data-portal-theme
    type="button"
    aria-label="Basculer le thème"
  >
    ☀︎ / ☾
  </button>

  {
    withAccount && (
      <span class="flex flex-none items-center gap-2">
        {prenom && <span class="hidden text-sm text-mute md:inline">Hello, {prenom}</span>}
        <UserButton />
      </span>
    )
  }
```

- [ ] **Step 7: Passer le prénom depuis les layouts**

Dans `EspaceLayout.astro` et `DocLayout.astro`, récupérer `user` du contexte et le transmettre :

```ts
const { user, meta, client } = await getPortalContext(Astro);
```

puis sur la balise : `prenom={user?.firstName ?? ""}`.

- [ ] **Step 8: Vérifier que la recherche de la doc fonctionne toujours**

Le script de `DocLayout` cible `#doc-q` et `#doc-qres`, qui vivent désormais dans la topbar. Le `document.getElementById` les trouve indifféremment : aucun changement de script n'est requis. Vérifier que le sélecteur `.doc-search` du gestionnaire de clic externe existe encore ; s'il a disparu avec le bloc supprimé, remplacer dans `DocLayout.astro` :

```ts
      document.addEventListener("click", (e) => {
        if (!(e.target as HTMLElement).closest(".doc-search")) qRes.hidden = true;
      });
```

par :

```ts
      document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (t !== qIn && !t.closest("#doc-qres")) qRes.hidden = true;
      });
```

- [ ] **Step 9: Build et vérification du design system**

Run: `npm run build && npm run verify 2>&1 | tail -3`
Expected: build complet ; `verify` ne montre que l'échec antérieur sur `src/pages/projets/[slug].astro`.

- [ ] **Step 10: Commit**

```bash
git add src/components/portail src/layouts src/styles/doc.css
git commit -m "feat(portail): colonne gauche partagée, sélecteur de client et topbar

La colonne gauche devient permanente sur tout le portail et porte le
sélecteur — ce qui amende la décision « la colonne gauche appartient à
la doc » du doc master, sur arbitrage de Ludo. Un seul composant sert
les deux gabarits pour qu'ils ne divergent pas, et la colonne ne se rend
que si elle a quelque chose à porter, plutôt que d'afficher 264 px de
vide chez un client.

La recherche remonte dans la topbar et remplace l'emplacement ⌘K posé en
S0.7 ; le champ est rendu partout et DocLayout l'active là où un index
existe. Logo myCoolbeans et salutation selon la maquette.

Sous 900 px la colonne se replie et le sélecteur passe dans la topbar,
sans quoi il disparaîtrait avec elle."
```

---

## Task 9 : Pages de l'espace, Bibliothèque et documentation

**Files:**
- Modify: `src/pages/espace/index.astro`, `projets.astro`, `site.astro`, `support.astro`, `doc.astro`
- Modify: `src/pages/design-system.astro`
- Modify: `docs/superpowers/specs/2026-08-11-portail-publicmetadata.md`

**Interfaces:**
- Consomme : tout ce qui précède.
- Produit : rien.

- [ ] **Step 1: Adapter les quatre pages-souches**

Pour `projets.astro` (module `projets`), `site.astro` (`site`) et `support.astro` (`support`), remplacer le frontmatter à partir des imports par :

```ts
import EspaceLayout from "../../layouts/EspaceLayout.astro";
import EmptyState from "../../components/portail/EmptyState.astro";
import { missingKeysFor } from "../../lib/portail/clients";
import { getPortalContext } from "../../lib/portail/context";

const { meta, client } = await getPortalContext(Astro);
const missingKeys = missingKeysFor("projets", client);

Astro.response.headers.set("Cache-Control", "no-store");
```

en remplaçant `"projets"` par le module de la page. Sur la balise `EmptyState`, remplacer `isAdmin={isAdmin(meta)}` par `isAdmin={meta.role === "admin"}`.

`ressources.astro` ne lit aucun mapping : **aucune modification**.

- [ ] **Step 2: Adapter `doc.astro`**

```ts
import EspaceLayout from "../../layouts/EspaceLayout.astro";
import EmptyState from "../../components/portail/EmptyState.astro";
import { missingKeysFor } from "../../lib/portail/clients";
import { getPortalContext } from "../../lib/portail/context";

const { meta, client } = await getPortalContext(Astro);

// Posé avant la redirection : celle-ci dépend de l'utilisateur et ne doit pas
// être mise en cache par un intermédiaire.
Astro.response.headers.set("Cache-Control", "no-store");

// Le cas normal : le client courant a une doc, on y emmène.
if (client?.doc) {
  return Astro.redirect(`/docs/${client.doc}`, 302);
}
```

et sur la balise :

```astro
  <EmptyState
    title="Aucune documentation associée à cet espace"
    missingKeys={missingKeysFor("doc", client)}
    isAdmin={meta.role === "admin"}
  >
```

- [ ] **Step 3: Adapter `index.astro`**

Remplacer le frontmatter à partir des imports par :

```ts
import EspaceLayout from "../../layouts/EspaceLayout.astro";
import { getPortalContext } from "../../lib/portail/context";
import { portalHref } from "../../lib/portail/nav";

const { user, meta, client } = await getPortalContext(Astro);
const admin = meta.role === "admin";
const prenom = user?.firstName ?? "";
const at = (path: string) => portalHref(path, Astro.url.hostname);

Astro.response.headers.set("Cache-Control", "no-store");
```

Puis, dans le corps, remplacer le bloc `meta.projects.map(...)` par une carte unique conditionnée au client courant :

```astro
    {
      client?.doc && (
        <a class="card" href={`/docs/${client.doc}`}>
          <div class="k">Doc</div>
          <div class="t">{client.nom} — passation & référence</div>
          <div class="d">Le document de vérité du projet : édition, leads, features, support.</div>
        </a>
      )
    }
```

Supprimer la fonction `label` devenue inutile, et remplacer `admin` là où `isAdmin` était appelé.

- [ ] **Step 4: Ajouter le sélecteur à la Bibliothèque**

Dans `src/pages/design-system.astro`, ajouter l'import :

```ts
import ClientSwitcher from "../components/portail/ClientSwitcher.astro";
```

et, après le bloc de la topbar, dans la section « Portail client » :

```astro
      <p class="label mb-3x mt-10x">Sélecteur de client · admin uniquement</p>
      <div class="card max-w-80">
        <ClientSwitcher
          clients={[
            { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [] },
            { slug: "amusoire", nom: "Amusoire", doc: "amusoire", uptimerobot_monitor_ids: [] },
          ]}
          current={{ slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [] }}
        />
      </div>
      <p class="mt-3x max-w-[62ch] text-sm text-mute">
        Rendu pour les seuls admins. Le bouton « Afficher » disparaît quand le script prend la
        main ; sans JavaScript il reste et le formulaire fonctionne quand même.
      </p>
```

Adapter aussi l'appel existant à `PortalNav`, qui gagne deux props :

```astro
        <PortalNav meta={NAV_DEMO_META} client={null} clients={[]} withAccount={false} />
```

et `NAV_DEMO_META` devient :

```ts
const NAV_DEMO_META = readPortalMetadata({ role: "client", client: "amusoire" });
```

- [ ] **Step 5: Mettre à jour la doc du schéma S0.6**

En tête de `docs/superpowers/specs/2026-08-11-portail-publicmetadata.md`, insérer après le premier paragraphe :

```markdown
> **Amendé le 2026-08-12.** Les trois clés de mapping (`projects`, `asana_team_gid`,
> `uptimerobot_monitor_ids`) ont quitté l'utilisateur pour le registre des clients
> (`src/content/clients/*.yaml`). Le `publicMetadata` ne porte plus que `{ role, client }`.
> Ce document reste la référence sur la tolérance de lecture et sur les empty states ; le schéma
> lui-même est décrit dans
> [2026-08-12-selecteur-de-client-admin-design.md](2026-08-12-selecteur-de-client-admin-design.md).
```

- [ ] **Step 6: Répercuter la disparition de S1.1 sur la spec du sync**

Dans `docs/superpowers/specs/2026-08-12-portail-sync-par-team.md`, remplacer la ligne
du tableau « Ce que ça change dans les tâches S1 » concernant S1.1 par :

```markdown
| **S1.1** ~~Connecteur teams via Clerk~~ | **Supprimée** le 2026-08-12 : les teams se lisent dans le registre des clients (`src/content/clients/*.yaml`), plus dans l'API Clerk. Fait tomber aussi le point « pagination des utilisateurs Clerk » du §5 des corrections. Voir [le design du sélecteur de client](2026-08-12-selecteur-de-client-admin-design.md). |
```

Et dans la section « Où est le mur », remplacer la formule du coût par :

```markdown
Un balayage coûte `T × (1 + P)` requêtes Asana — une pour la liste des projets de la team, une par
projet pour ses tâches. L'appel Clerk de listage des utilisateurs a disparu avec S1.1. À 3 projets
par client :
```

- [ ] **Step 7: Vérification complète**

Run: `npx vitest run && npm run build && CLOUDFLARE_ENV=staging npm run build && npm run verify 2>&1 | tail -3`
Expected: tests verts, les deux builds complets, `verify` avec le seul échec antérieur.

Run: `npx --yes -p typescript@5 tsc --noEmit -p tsconfig.json 2>&1 | grep 'error TS'`
Expected: uniquement `src/worker.ts(60,9)`, antérieure au plan.

- [ ] **Step 8: Commit**

```bash
git add src/pages docs/superpowers/specs/
git commit -m "feat(portail): les pages de l'espace lisent le client courant

Les modules réclament leurs mappings au client et non plus à
l'utilisateur, l'accueil affiche la doc du client courant, et le
sélecteur rejoint la Bibliothèque (definition of done).

La spec du schéma canonique de S0.6 porte désormais l'amendement en
tête, pour qu'on ne la lise pas comme encore en vigueur."
```

---

## Vérification manuelle après déploiement

Ces contrôles ne sont pas automatisables : toutes les pages du portail sont derrière Clerk, et `vitest` n'est pas outillé pour rendre des composants `.astro`.

1. Connecté en admin sur `my.coolbeans.cc`, le sélecteur apparaît en haut de la colonne gauche et affiche **Coolbeans**.
2. Basculer sur **Amusoire** : la page se recharge, le sélecteur affiche Amusoire, l'entrée Doc de la nav mène à `/docs/amusoire`.
3. Recharger, puis rouvrir l'onglet le lendemain : le choix a tenu.
4. Ouvrir `/docs/amusoire` à la main depuis le contexte Coolbeans : la page s'affiche et le sélecteur bascule sur Amusoire.
5. Ouvrir `/docs/_template` : accessible, et le sélecteur **n'a pas bougé**.
6. La doc d'Amusoire s'affiche correctement — colonnes alignées, recherche ⌘K fonctionnelle depuis la topbar.
7. Connecté avec un compte client (ou après avoir retiré `role: "admin"` sur un compte de test) : **aucun sélecteur**, et poser un cookie `portal_client=coolbeans` à la main dans le navigateur ne change rien à l'affichage.
8. En dessous de 900 px : la colonne se replie, le sélecteur est dans la topbar.

## Après le déploiement — actions de Ludo

1. Dashboard Clerk → Users → son compte → Metadata → Public : `{ "role": "admin", "client": "coolbeans" }`.
2. Même chose pour le contact Amusoire : `{ "role": "client", "client": "amusoire" }`.
3. Une fois les deux comptes à jour, ouvrir un ticket pour retirer `legacyClient()` de `src/lib/portail/metadata.ts` et les quatre tests qui la couvrent.
