# Migration Clerk → Better Auth, phase A — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Clerk par Better Auth auto-hébergé dans le Worker, avec organisations, teams et trois types de compte, sans changer une seule URL du portail.

**Architecture:** Better Auth tourne dans le Worker existant, sur les bases D1 déjà en place (`coolbeans-portal`, `coolbeans-portal-staging`), via `withCloudflare({ d1Native })` — aucun ORM. L'instance d'authentification est **construite par requête** : sur Workers, les bindings n'existent qu'au moment de la requête. Le plugin `organization` avec `teams` porte le multi-tenant : organisation = revendeur, team = workspace client. Le type de compte vit sur l'utilisateur, la portée sur ses appartenances.

**Tech Stack:** Astro 7 (SSR, adapter `@astrojs/cloudflare` 14), Cloudflare Workers + D1 + KV + R2, Better Auth + `better-auth-cloudflare`, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-better-auth-migration-design.md`

## Global Constraints

- **Aucune inscription publique.** Les comptes naissent d'une invitation. Aucun formulaire de création de compte, aucune route qui en tienne lieu.
- **Français partout.** Aucun texte d'erreur, de bouton ou de mail en anglais. Le mapping des `$ERROR_CODES` de Better Auth est un livrable, pas un détail.
- **`d1Native`, aucun ORM.** Le repo n'en utilise nulle part ; en ajouter un pour l'auth serait une dépendance de plus à maintenir.
- **Pas de KV en secondary storage.** Le TTL minimum de 60 s de KV est un piège documenté, pour un gain nul à cette échelle.
- **Une instance par environnement**, sur les D1 déjà séparés. Plus de dualité dev/live à la Clerk.
- **Le cockpit Devis reste `adminOnly` strict**, sans exception de revendeur.
- **Jamais d'expéditeur de mail inventé.** Reprendre celui de `src/pages/api/devis-reponse.ts`.
- **Le type de compte s'appelle `portalRole`, pas `role`.** Le plugin `organization` définit déjà un `role` sur ses membres : réutiliser le nom produirait une collision silencieuse entre le type de compte et le rôle d'appartenance.
- **Trois valeurs de `portalRole` :** `admin`, `revendeur`, `client`. Liste blanche à la lecture ; toute valeur inconnue retombe sur `client`.
- **Messages de commit sans accents**, comme le reste de l'historique du repo.
- **Jamais `git add -A`** : du travail en cours d'autres sessions traîne dans l'arbre. Toujours nommer les fichiers.
- **Aucun `git push` vers `main`** dans ce plan. La publication en production se fait sur ordre explicite de Ludo, jamais à l'initiative de l'exécutant.
- Tests : `npm test` (Vitest, `vitest run`). Les tests unitaires portent sur les fonctions pures ; le câblage Better Auth se vérifie à la main, en staging.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/auth/server.ts` | Fabrique l'instance Better Auth pour une requête donnée. Seul endroit qui connaît `betterAuth()`. |
| `src/lib/auth/erreurs.ts` | Mapping `$ERROR_CODES` → français. Pur, testé. |
| `src/lib/auth/session.ts` | Lecture de la session Better Auth vers `PortalMetadata`. |
| `src/lib/portail/metadata.ts` | Schéma applicatif du compte. Existe déjà, réécrit. Pur, testé. |
| `src/lib/portail/current-workspace.ts` | Résolution du workspace courant. Existe déjà, adapté. Pur, testé. |
| `src/lib/portail/appartenances.ts` | Portée d'un compte : quelles teams il peut voir. Pur, testé. |
| `src/pages/api/auth/[...all].ts` | Monte le handler Better Auth. |
| `src/pages/connexion.astro` | Les deux chemins de connexion, à parité. |
| `src/components/portail/MenuCompte.astro` | Remplace `<UserButton />`. |
| `src/pages/espace/utilisateurs.astro` | Membres, invitations, rôles, révocation. |
| `src/emails/auth.ts` | Gabarits invitation, lien magique, réinitialisation. |
| `migrations/0004_better_auth.sql` | Tables Better Auth. |
| `migrations/0005_user_ids.sql` | Renommage `*_clerk_id` → `*_user_id` et remap. |

---

## Task 1 : Socle Better Auth

**Files:**
- Create: `src/lib/auth/server.ts`
- Create: `src/pages/api/auth/[...all].ts`
- Create: `migrations/0004_better_auth.sql`
- Modify: `package.json`
- Modify: `wrangler.jsonc` (commentaire `nodejs_compat`)

**Interfaces:**
- Produces: `createAuth(env: Env, baseURL: string)` → instance Better Auth. Tout le reste du plan passe par elle et ne construit jamais `betterAuth()` en direct.

- [x] **Step 1 : Installer les dépendances**

```bash
npm install better-auth better-auth-cloudflare
```

- [x] **Step 2 : Écrire la fabrique d'instance**

Créer `src/lib/auth/server.ts`. Le type `Env` est celui des bindings Cloudflare : le prendre là où le repo le prend déjà (`locals.runtime.env` est typé par `@astrojs/cloudflare`). Ne le redéclarer qu'une seule fois, jamais deux. Le point important : `createAuth` prend `env` en argument et n'est jamais appelée au niveau module. Sur Workers, les bindings n'existent qu'au moment de la requête ; une instance construite à l'import lèverait au premier appel.

```ts
// Fabrique de l'instance Better Auth. Construite PAR REQUETE : sur Workers,
// les bindings (D1) n'existent pas au niveau module.
//
// `portalRole` porte le type de compte. Ne PAS le nommer `role` : le plugin
// organization definit deja un `role` sur ses membres, et la collision serait
// silencieuse — le type de compte et le role d'appartenance ne veulent pas
// dire la meme chose.
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { magicLink, organization } from "better-auth/plugins";

export function createAuth(env: Env, baseURL: string) {
  return betterAuth({
    baseURL,
    ...withCloudflare(
      { d1Native: env.PORTAL_DB },
      {
        emailAndPassword: { enabled: true },
        // Aucune inscription publique : les comptes naissent d'une invitation.
        // La contrainte est reaffirmee ici en plus de l'absence de formulaire.
        user: {
          additionalFields: {
            portalRole: { type: "string", defaultValue: "client", input: false },
          },
        },
        plugins: [
          magicLink({
            sendMagicLink: async () => {
              throw new Error("gabarit branche en Task 6");
            },
          }),
          organization({ teams: { enabled: true } }),
        ],
      },
    ),
  });
}
```

- [x] **Step 3 : Générer le schéma SQL**

**Ne pas utiliser `@better-auth/cli`.** Sa dernière version publiée est 1.4.21,
marquée « no longer supported », soit antérieure à la bibliothèque du repo
(1.7.2) : un schéma généré par un CLI plus vieux que la lib qui le lit est un
piège. `better-auth` 1.7.2 n'embarque aucun binaire.

La génération passe par `getMigrations()`, qui vit **dans** better-auth et ne
peut donc pas diverger d'elle. Le script `scripts/generer-schema-auth.mts`
construit la config sur une SQLite temporaire vide — D1 est du SQLite, le
dialecte est identique, et sur une base vide tout ressort en « à créer ».

```bash
node --experimental-strip-types scripts/generer-schema-auth.mts
```

Trois pièges rencontrés, déjà réglés dans le script :
- Extension `.mts` obligatoire : Node ne traite pas les `.ts` comme des modules
  ES, même avec `"type": "module"` dans `package.json`.
- `getMigrations` s'importe depuis `better-auth/db/migration`, pas
  `better-auth/db`.
- `withCloudflare` active géolocalisation et détection d'IP par défaut et exige
  alors un contexte `cf`. Les deux sont coupées : un portail client privé n'a
  aucun usage de ces données.

La configuration fonctionnelle vit dans `src/lib/auth/options.ts`, lue à la
fois par `createAuth` et par le script. **C'est ce qui empêche la base et le
code de diverger** : le SQL est dérivé de cette configuration, une copie
divergerait dès la première modification.

Résultat : 9 tables — `user`, `session`, `account`, `verification`,
`organization`, `team`, `teamMember`, `member`, `invitation`.

Deux constats du schéma généré, qui valent pour toute la suite :
- `session` porte `activeOrganizationId` et `activeTeamId`. Ce sont des
  **identifiants, pas des slugs** : la Task 4 doit les résoudre vers les slugs
  du registre, et nulle part ailleurs.
- `team` n'a pas de colonne `slug` en standard, seulement `name`. Un `slug`
  unique lui a été ajouté via `schema.team.additionalFields` : détourner `name`,
  qui est un libellé d'affichage, ferait dépendre l'appariement avec le
  registre d'un texte que quelqu'un renommera un jour.

- [x] **Step 4 : Appliquer la migration en local puis en staging**

```bash
npx wrangler d1 execute coolbeans-portal-staging --remote --file=migrations/0004_better_auth.sql
npx wrangler d1 execute coolbeans-portal-staging --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Attendu : les tables `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `team` (noms exacts selon ce qu'a émis la CLI) s'ajoutent à `tickets` et `messages`.

- [x] **Step 5 : Monter le handler**

Créer `src/pages/api/auth/[...all].ts` :

```ts
// Handler Better Auth. `prerender = false` est obligatoire : une route
// prerendue ne verrait jamais la requete.
//
// baseURL vient de l'origine REELLE de la requete, pas d'une constante : le
// portail est servi sur my.coolbeans.cc via la reecriture d'hote de
// src/worker.ts, et une baseURL figee casserait les cookies en deploye sans
// que rien ne se voie en local.
export const prerender = false;

import type { APIRoute } from "astro";
import { createAuth } from "../../../lib/auth/server";

const handler: APIRoute = ({ request, locals }) => {
  const auth = createAuth(locals.runtime.env, new URL(request.url).origin);
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
```

- [x] **Step 6 : Vérifier que le handler répond**

```bash
npm run build
```

Attendu : build sans erreur. Puis, une fois déployé en staging (Task 11), `GET https://my-staging.coolbeans.cc/api/auth/ok` doit répondre autre chose qu'un 404.

- [x] **Step 7 : Commit**

```bash
git add package.json package-lock.json src/lib/auth/server.ts src/pages/api/auth/ migrations/0004_better_auth.sql
git commit -m "feat(auth): socle Better Auth sur D1, instance par requete

L'instance est construite par requete : sur Workers les bindings n'existent
pas au niveau module. Le type de compte se nomme portalRole pour ne pas
entrer en collision avec le role de membre du plugin organization."
```

---

## Task 2 : Schéma applicatif du compte

Réécrit `metadata.ts`, qui cesse de lire un `publicMetadata` Clerk pour décrire un compte du portail. Fonction pure, entièrement testable — c'est la tâche où la logique de sécurité se fixe.

**Files:**
- Modify: `src/lib/portail/metadata.ts`
- Modify: `src/lib/portail/metadata.test.ts`

**Interfaces:**
- Produces: `type PortalRole = "admin" | "revendeur" | "client"`, `interface PortalMetadata { role: PortalRole; organisation: string | null; workspace: string | null }`, `readPortalMetadata(raw: unknown): PortalMetadata`, `isAdmin(meta)`, `isRevendeur(meta)`.

- [x] **Step 1 : Écrire les tests qui échouent**

Remplacer intégralement `src/lib/portail/metadata.test.ts`. Les cas de la retombée `projects[0]` disparaissent avec `legacyClient`.

```ts
import { describe, expect, it } from "vitest";
import { isAdmin, isRevendeur, readPortalMetadata } from "./metadata";

const VIDE = { role: "client", organisation: null, workspace: null };

describe("readPortalMetadata", () => {
  it("ne lève pas sur une entrée absente ou vide", () => {
    for (const raw of [undefined, null, {}]) {
      expect(readPortalMetadata(raw)).toEqual(VIDE);
    }
  });

  it("accepte les trois types de compte", () => {
    expect(readPortalMetadata({ portalRole: "admin" }).role).toBe("admin");
    expect(readPortalMetadata({ portalRole: "revendeur" }).role).toBe("revendeur");
    expect(readPortalMetadata({ portalRole: "client" }).role).toBe("client");
  });

  // LA regle de securite : liste blanche, pas exclusion. Une valeur inconnue
  // ne doit jamais ouvrir plus que le minimum.
  it("retombe sur client pour toute valeur hors liste blanche", () => {
    for (const v of ["Admin", "ADMIN", "superadmin", "agence", "", 42, null, {}]) {
      expect(readPortalMetadata({ portalRole: v }).role).toBe("client");
    }
  });

  it("lit l'organisation et le workspace", () => {
    const m = readPortalMetadata({ portalRole: "client", organisation: "trigger", workspace: "amusoire" });
    expect(m.organisation).toBe("trigger");
    expect(m.workspace).toBe("amusoire");
  });

  it("rend organisation et workspace nuls quand absents, vides ou mal typés", () => {
    expect(readPortalMetadata({ organisation: "  ", workspace: 42 })).toEqual(VIDE);
  });

  it("rogne les espaces autour des slugs", () => {
    expect(readPortalMetadata({ organisation: " trigger " }).organisation).toBe("trigger");
  });
});

describe("isAdmin / isRevendeur", () => {
  it("distingue les trois types", () => {
    expect(isAdmin({ ...VIDE, role: "admin" })).toBe(true);
    expect(isAdmin({ ...VIDE, role: "revendeur" })).toBe(false);
    expect(isRevendeur({ ...VIDE, role: "revendeur" })).toBe(true);
    expect(isRevendeur({ ...VIDE, role: "admin" })).toBe(false);
  });
});
```

- [x] **Step 2 : Lancer les tests pour les voir échouer**

Run: `npm test -- src/lib/portail/metadata.test.ts`
Expected: FAIL — `isRevendeur` n'existe pas, la forme de `PortalMetadata` ne correspond pas.

- [x] **Step 3 : Réécrire `metadata.ts`**

```ts
// Schema applicatif d'un compte du portail (spec 2026-08-19 §3.1, §5.3).
//
// Le type de compte vit sur l'utilisateur Better Auth (`portalRole`), sa
// portee sur ses appartenances organisation/team.
//
// La lecture reste tolerante : une forme inattendue mene a un empty state,
// jamais a une 500.

/** Type de compte. Liste blanche : l'inconnu retombe sur `client`. */
export type PortalRole = "admin" | "revendeur" | "client";

const ROLES: readonly PortalRole[] = ["admin", "revendeur", "client"];

export interface PortalMetadata {
  role: PortalRole;
  /** Slug du revendeur (registre des organisations). */
  organisation: string | null;
  /** Slug du workspace client (registre des clients). */
  workspace: string | null;
}

function asSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * LA regle de securite de ce fichier : liste blanche.
 *
 * L'ancienne regle disait « tout ce qui n'est pas exactement admin est un
 * client ». Avec un troisieme type, elle ne casse rien mais ne reconnait
 * jamais `revendeur` — silencieusement. Une liste blanche echoue du bon cote.
 */
function asRole(value: unknown): PortalRole {
  return ROLES.includes(value as PortalRole) ? (value as PortalRole) : "client";
}

export function readPortalMetadata(raw: unknown): PortalMetadata {
  const meta = (raw ?? {}) as Record<string, unknown>;
  return {
    role: asRole(meta.portalRole),
    organisation: asSlug(meta.organisation),
    workspace: asSlug(meta.workspace),
  };
}

export function isAdmin(meta: PortalMetadata): boolean {
  return meta.role === "admin";
}

export function isRevendeur(meta: PortalMetadata): boolean {
  return meta.role === "revendeur";
}
```

- [x] **Step 4 : Lancer les tests**

Run: `npm test -- src/lib/portail/metadata.test.ts`
Expected: PASS. `legacyClient` a disparu — COO-47 est absorbée.

- [x] **Step 5 : Commit**

```bash
git add src/lib/portail/metadata.ts src/lib/portail/metadata.test.ts
git commit -m "feat(auth): trois types de compte, lus en liste blanche

La regle « tout ce qui n'est pas admin est un client » ne reconnaissait
jamais revendeur. Liste blanche explicite : l'inconnu retombe sur client.
legacyClient disparait, COO-47 est absorbee."
```

---

## Task 3 : Portée d'un compte

Quelles teams un compte peut voir. C'est la garde du multi-tenant, isolée dans une fonction pure pour être testable sans base ni réseau — le même parti pris que `current-workspace.ts`.

**Files:**
- Create: `src/lib/portail/appartenances.ts`
- Create: `src/lib/portail/appartenances.test.ts`
- Modify: `src/lib/portail/current-workspace.ts`
- Modify: `src/lib/portail/current-workspace.test.ts` (s'il existe ; sinon le créer)
- Modify: `src/content.config.ts` (champ `organisation` sur les clients)

**Interfaces:**
- Consumes: `PortalMetadata` (Task 2), `PortalWorkspace` (existant).
- Produces: `workspacesVisibles(clients: PortalWorkspace[], meta: PortalMetadata): PortalWorkspace[]`.

- [x] **Step 1 : Ajouter `organisation` au registre des clients**

Dans `src/content.config.ts`, collection `clients`, ajouter au schéma Zod :

```ts
    // Slug du revendeur auquel ce client se rattache (spec 2026-08-19 §3.1).
    // `coolbeans` pour un client direct. Obligatoire : sans lui, un workspace
    // n'appartient a personne et devient invisible de tout le monde.
    organisation: z.string(),
```

Puis renseigner le champ dans les trois fiches existantes :

```bash
for f in src/content/clients/amusoire.yaml src/content/clients/coolbeans.yaml src/content/clients/spinoza.yaml; do
  grep -q "^organisation:" "$f" || printf 'organisation: coolbeans\n' >> "$f"
done
```

Puis corriger Amusoire à la main : `organisation: trigger` (Amusoire est un client de l'agence Trigger).

Ajouter le champ à l'interface `PortalWorkspace` de `src/lib/portail/workspaces.ts` :

```ts
  /** Slug du revendeur. `coolbeans` pour un client direct. */
  organisation: string;
```

- [x] **Step 2 : Écrire les tests qui échouent**

Créer `src/lib/portail/appartenances.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { workspacesVisibles } from "./appartenances";
import type { PortalWorkspace } from "./workspaces";
import type { PortalMetadata } from "./metadata";

const w = (slug: string, organisation: string): PortalWorkspace =>
  ({ slug, nom: slug, organisation, uptimerobot_monitor_ids: [], archive: false }) as PortalWorkspace;

const REGISTRE = [
  w("amusoire", "trigger"),
  w("trigger", "trigger"),
  w("fylgo", "coolbeans"),
  w("coolbeans", "coolbeans"),
];

const meta = (o: Partial<PortalMetadata>): PortalMetadata =>
  ({ role: "client", organisation: null, workspace: null, ...o });

describe("workspacesVisibles", () => {
  it("un admin voit tout le registre", () => {
    expect(workspacesVisibles(REGISTRE, meta({ role: "admin" }))).toHaveLength(4);
  });

  it("un revendeur voit toutes les teams de son organisation, et elles seules", () => {
    const vus = workspacesVisibles(REGISTRE, meta({ role: "revendeur", organisation: "trigger" }));
    expect(vus.map((x) => x.slug).sort()).toEqual(["amusoire", "trigger"]);
  });

  // C'est la raison d'etre des deux niveaux : un client ajoute a Trigger
  // apres l'invitation de Baptiste doit apparaitre sans nouvelle invitation.
  it("un revendeur voit une team ajoutée après coup", () => {
    const avec = [...REGISTRE, w("nouveau", "trigger")];
    expect(workspacesVisibles(avec, meta({ role: "revendeur", organisation: "trigger" }))).toHaveLength(3);
  });

  it("un client ne voit que sa team", () => {
    const vus = workspacesVisibles(REGISTRE, meta({ role: "client", organisation: "trigger", workspace: "amusoire" }));
    expect(vus.map((x) => x.slug)).toEqual(["amusoire"]);
  });

  it("un client ne voit pas la team voisine de sa propre organisation", () => {
    const vus = workspacesVisibles(REGISTRE, meta({ role: "client", organisation: "trigger", workspace: "amusoire" }));
    expect(vus.map((x) => x.slug)).not.toContain("trigger");
  });

  it("un revendeur sans organisation ne voit rien", () => {
    expect(workspacesVisibles(REGISTRE, meta({ role: "revendeur" }))).toEqual([]);
  });

  it("un client dont le workspace ne correspond pas à son organisation ne voit rien", () => {
    const vus = workspacesVisibles(REGISTRE, meta({ role: "client", organisation: "coolbeans", workspace: "amusoire" }));
    expect(vus).toEqual([]);
  });
});
```

- [x] **Step 3 : Lancer les tests pour les voir échouer**

Run: `npm test -- src/lib/portail/appartenances.test.ts`
Expected: FAIL — le module n'existe pas.

- [x] **Step 4 : Écrire `appartenances.ts`**

```ts
// Portee d'un compte : quelles teams il peut voir (spec 2026-08-19 §3.1).
//
// Fonction pure, comme resolveCurrentWorkspace : elle recoit le registre et le
// compte, et n'accede ni a Astro ni au reseau. C'est ce qui rend la garde du
// multi-tenant testable directement.
//
// Le dernier cas compte : un `client` dont le workspace n'appartient pas a son
// organisation ne voit RIEN. Ce n'est pas de la paranoia — c'est ce qui evite
// qu'une appartenance incoherente ouvre une team au hasard.

import { isAdmin, type PortalMetadata } from "./metadata";
import type { PortalWorkspace } from "./workspaces";

export function workspacesVisibles(
  clients: PortalWorkspace[],
  meta: PortalMetadata,
): PortalWorkspace[] {
  if (isAdmin(meta)) return clients;
  if (!meta.organisation) return [];

  const deLOrganisation = clients.filter((c) => c.organisation === meta.organisation);
  if (meta.role === "revendeur") return deLOrganisation;

  return deLOrganisation.filter((c) => c.slug === meta.workspace);
}
```

- [x] **Step 5 : Lancer les tests**

Run: `npm test -- src/lib/portail/appartenances.test.ts`
Expected: PASS.

- [x] **Step 6 : Brancher `resolveCurrentWorkspace` sur la portée**

Dans `src/lib/portail/current-workspace.ts`, la règle actuelle est binaire (« un non-admin ne voit que le sien »). Elle devient : le cookie est une préférence, filtrée par la portée réelle.

```ts
export function resolveCurrentWorkspace(
  clients: PortalWorkspace[],
  meta: PortalMetadata,
  cookieValue: string | null,
): PortalWorkspace | null {
  // Le cookie n'est jamais une autorisation : on ne cherche que DANS la
  // portee du compte. Un cookie force ne peut donc rien ouvrir, quel que
  // soit le type de compte — la regle vaut maintenant aussi pour un
  // revendeur, qui a plusieurs workspaces legitimes.
  const visibles = workspacesVisibles(clients, meta);
  return (
    getWorkspaceIn(visibles, cookieValue) ??
    getWorkspaceIn(visibles, meta.workspace) ??
    getWorkspaceIn(visibles, DEFAULT_WORKSPACE) ??
    sortWorkspaces(visibles)[0] ??
    null
  );
}
```

- [x] **Step 7 : Lancer toute la suite**

Run: `npm test`
Expected: PASS. Si `current-workspace.test.ts` existe, ses cas « un client ne voit que le sien » doivent continuer de passer — ils décrivent toujours le bon comportement.

- [x] **Step 8 : Commit**

```bash
git add src/lib/portail/appartenances.ts src/lib/portail/appartenances.test.ts src/lib/portail/current-workspace.ts src/lib/portail/workspaces.ts src/content.config.ts src/content/clients/
git commit -m "feat(portail): la portee d'un compte vient de ses appartenances

Un revendeur voit toutes les teams de son organisation, y compris celles
ajoutees apres son invitation. Le cookie de selection ne cherche plus que
dans la portee reelle : il ne peut rien ouvrir."
```

---

## Task 4 : Middleware et contexte de requête

Le point de bascule : Clerk sort du chemin de requête. À la fin de cette tâche, une session Better Auth posée à la main ouvre `/espace`.

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/lib/portail/context.ts`
- Create: `src/lib/auth/session.ts`

**Interfaces:**
- Consumes: `createAuth` (Task 1), `readPortalMetadata` (Task 2), `resolveCurrentWorkspace` (Task 3).
- Produces: `lireSession(context)` → `{ user, meta }`. `PortalContext` garde sa forme (`user`, `meta`, `client`) pour que les 22 fichiers appelants ne bougent pas.

- [x] **Step 1 : Écrire la lecture de session**

Créer `src/lib/auth/session.ts` :

```ts
// Lecture de la session Better Auth, memoisee pour la duree d'une requete.
//
// Remplace `locals.currentUser()` de @clerk/astro, qui refaisait un appel
// reseau bloquant a chaque invocation. Ici la session vient de D1, mais la
// memoisation reste : le layout et la page la demandent tous les deux.

import type { APIContext } from "astro";
import { createAuth } from "./server";
import { readPortalMetadata, type PortalMetadata } from "../portail/metadata";

export interface SessionPortail {
  user: { id: string; email: string; name: string | null } | null;
  meta: PortalMetadata;
}

const CACHE_KEY = "__portalSession";

export function lireSession(
  context: Pick<APIContext, "locals" | "request">,
): Promise<SessionPortail> {
  const cache = context.locals as Record<string, unknown>;
  cache[CACHE_KEY] ??= (async () => {
    const auth = createAuth(context.locals.runtime.env, new URL(context.request.url).origin);
    const session = await auth.api.getSession({ headers: context.request.headers });
    if (!session?.user) return { user: null, meta: readPortalMetadata(null) };
    return {
      user: { id: session.user.id, email: session.user.email, name: session.user.name ?? null },
      // Le type de compte et les appartenances voyagent dans la session ;
      // readPortalMetadata reste tolerant a une forme inattendue.
      meta: readPortalMetadata({
        portalRole: (session.user as Record<string, unknown>).portalRole,
        organisation: session.session?.activeOrganizationId ?? null,
        workspace: session.session?.activeTeamId ?? null,
      }),
    };
  })();
  return cache[CACHE_KEY] as Promise<SessionPortail>;
}
```

**Vigilance :** `activeOrganizationId` et `activeTeamId` sont des identifiants Better Auth, pas des slugs. Vérifier au premier essai en staging ce que la session porte réellement ; si ce sont des UUID, ajouter la résolution UUID → slug ici, dans cette fonction, et nulle part ailleurs.

- [x] **Step 2 : Réécrire le middleware**

`clerkMiddleware` disparaît. **L'interception de `portail.choisirWorkspace` ne bouge pas** : elle est indépendante de l'authentification, et le commentaire qui l'accompagne décrit un piège coûteux à redécouvrir. La copier telle quelle.

```ts
import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";
import { lireSession } from "./lib/auth/session";

// L'espace client et toute la doc exigent une session. Le controle par
// workspace se fait dans les routes, via la portee du compte.
const PROTECTED = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (PROTECTED.some((re) => re.test(pathname))) {
    const { user } = await lireSession(context);
    if (!user) {
      const signIn = new URL("/connexion", context.request.url);
      signIn.searchParams.set("redirect_url", context.request.url);
      return context.redirect(signIn.href);
    }
  }

  /* Post/Redirect/Get pour portail.choisirWorkspace — INCHANGE.
     Recopier ici le bloc existant de src/middleware.ts, commentaire compris.
     Il ne depend pas de l'authentification et son commentaire decrit un
     piege qu'on ne veut pas redecouvrir. */

  return next();
});
```

- [x] **Step 3 : Brancher `context.ts` sur la session**

Dans `src/lib/portail/context.ts`, remplacer `getUser` (qui appelle `locals.currentUser()`) par `lireSession`. La forme de `PortalContext` ne change pas — seul le type de `user` passe de `User` de `@clerk/backend` à celui de `SessionPortail`. Retirer l'import `import type { User } from "@clerk/backend"`.

- [x] **Step 4 : Vérifier la compilation**

Run: `npm run build`
Expected: le build échoue sur les fichiers qui utilisent encore Clerk (`connexion.astro`, `PortalNav.astro`). C'est attendu : ils sont traités en Tasks 5 et 7. Vérifier qu'aucune erreur ne vient de `middleware.ts`, `context.ts` ni `session.ts`.

- [x] **Step 5 : Commit**

```bash
git add src/middleware.ts src/lib/portail/context.ts src/lib/auth/session.ts
git commit -m "feat(auth): le middleware lit la session Better Auth

clerkMiddleware sort du chemin de requete. L'interception de
portail.choisirWorkspace est recopiee telle quelle : elle ne depend pas de
l'authentification."
```

---

## État au 2026-08-27, tâches 1 à 4 livrées

Ce qui marche : le middleware, la lecture de session, la portée des comptes,
les tables en staging. `npm test` est vert (192 tests), `npm run build` aussi.

**Ce qui est cassé à l'exécution, et c'est voulu** — le build ne le voit pas,
parce que Clerk est encore installé et que ses composants s'importent toujours :

| Fichier | Ce qui casse | Réparé par |
|---|---|---|
| `src/pages/connexion.astro` | `<SignIn />` sans `clerkMiddleware` | Task 5 |
| `src/components/portail/PortalNav.astro` | `<UserButton />` sans `clerkMiddleware` | Task 7 |
| `src/pages/api/messagerie/nouveau.ts` | `clerkClient(context).users.getUser(pourClerkId)` | Task 10 |
| `src/pages/api/linear-webhook.ts` | `clerkClient` | Task 10 |

Les deux derniers résolvaient un identifiant Clerk vers un utilisateur. Ils
doivent lire la table `user` de Better Auth — c'est le même mouvement que le
renommage des colonnes, d'où leur rattachement à la Task 10 plutôt qu'à une
tâche à part.

### Vérifié en déployé le 2026-08-27

Sur `my-staging.coolbeans.cc`, une session parallèle ayant poussé `staging` :

| Sonde | Résultat |
|---|---|
| `GET /api/auth/ok` | `200 {"ok":true}` — handler et binding D1 vivants |
| `GET /` | `302` vers `/connexion?redirect_url=…` — le nouveau middleware tranche |
| `POST /api/auth/sign-up/email` | `400 EMAIL_PASSWORD_SIGN_UP_DISABLED` |
| `POST /api/auth/sign-in/magic-link` | `500`, vide — c'est le `throw` de `sendMagicLink`, branché en Task 6 |
| `SELECT COUNT(*) FROM user` | **0** — aucune sonde n'a créé de compte |

Les deux verrous d'inscription tiennent donc en conditions réelles, pas
seulement dans la configuration. Le `500` du lien magique doit disparaître à
la Task 6 : si un `500` persiste après le branchement du gabarit, c'est un vrai
défaut, pas ce reliquat.

**Attention aux appels directs à l'API :** Better Auth refuse les requêtes sans
en-tête `Origin` (`403 MISSING_OR_NULL_ORIGIN`). Toute sonde en ligne de
commande doit le poser, sinon on croit tester une garde alors qu'on teste le
contrôle d'origine.

**Écart au plan, assumé :** `src/lib/portail/require-admin.ts` a été rendue
pure (elle reçoit le compte au lieu de lire la session). La tâche 4 ne le
prévoyait pas, mais la garde appelait `locals.currentUser()`, qui disparaît
avec `clerkMiddleware` : la laisser en l'état aurait cassé toutes les Actions
admin. Y injecter la lecture de session l'aurait rendue intestable sous
Vitest, c'est-à-dire aurait annulé la raison de son extraction.

---

## Task 5 : `/connexion`, deux chemins à parité

**Files:**
- Modify: `src/pages/connexion.astro`
- Create: `src/lib/auth/erreurs.ts`
- Create: `src/lib/auth/erreurs.test.ts`
- Create: `src/pages/reinitialisation.astro`

**Interfaces:**
- Produces: `messageErreur(code: string | null | undefined): string`.

- [ ] **Step 1 : Écrire les tests du mapping d'erreurs**

```ts
import { describe, expect, it } from "vitest";
import { messageErreur } from "./erreurs";

describe("messageErreur", () => {
  it("traduit les codes connus en français", () => {
    expect(messageErreur("INVALID_EMAIL_OR_PASSWORD")).toBe(
      "Adresse e-mail ou mot de passe incorrect.",
    );
    expect(messageErreur("INVALID_TOKEN")).toContain("lien");
  });

  it("rend un message générique en français pour un code inconnu", () => {
    const m = messageErreur("UNE_CHOSE_QUE_PERSONNE_N_A_PREVUE");
    expect(m).toMatch(/^[A-ZÀÉÈ]/);
    expect(m).not.toMatch(/[a-z]_[A-Z]/); // jamais le code brut
  });

  it("rend un message générique sur une entrée vide", () => {
    for (const v of [null, undefined, ""]) expect(messageErreur(v)).toBeTruthy();
  });
});
```

- [ ] **Step 2 : Lancer pour voir échouer**

Run: `npm test -- src/lib/auth/erreurs.test.ts`
Expected: FAIL — le module n'existe pas.

- [ ] **Step 3 : Écrire le mapping**

```ts
// Traduction des $ERROR_CODES de Better Auth (spec 2026-08-19 §7).
//
// C'est le seul texte de la chaine d'authentification qui ne serait pas
// maitrise sans ce travail. C'etait le reproche fait a Clerk : ne pas le
// reproduire.
//
// Un code inconnu ne sort JAMAIS tel quel : il devient un message generique.
// Un identifiant technique affiche a un client est un bug d'interface.

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Adresse e-mail ou mot de passe incorrect.",
  USER_NOT_FOUND: "Aucun compte n'existe pour cette adresse.",
  INVALID_TOKEN: "Ce lien n'est plus valable. Demandez-en un nouveau.",
  EXPIRED_TOKEN: "Ce lien a expiré. Demandez-en un nouveau.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit faire au moins 8 caractères.",
  EMAIL_NOT_VERIFIED: "Cette adresse n'est pas encore confirmée.",
  FAILED_TO_CREATE_SESSION: "La connexion n'a pas abouti. Réessayez dans un instant.",
};

const GENERIQUE = "Quelque chose n'a pas fonctionné. Réessayez, ou écrivez-moi si ça persiste.";

export function messageErreur(code: string | null | undefined): string {
  if (!code) return GENERIQUE;
  return MESSAGES[code] ?? GENERIQUE;
}
```

**Note pour l'exécutant :** compléter `MESSAGES` avec les codes réellement exposés par la version installée — `import { APIError } from "better-auth/api"` et la doc du plugin `magicLink`. La liste ci-dessus est un point de départ, pas un inventaire.

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -- src/lib/auth/erreurs.test.ts`
Expected: PASS.

- [ ] **Step 5 : Écrire la page de connexion**

Remplacer `src/pages/connexion.astro`. **La contrainte de parité est le livrable** : deux colonnes de même poids visuel, même hiérarchie typographique. Ni « ou sinon », ni « plus d'options ». Relire `/design-system` avant de coder : les labels de champ sont `.label field-label`.

Structure attendue :

```
┌─────────────────────────┬─────────────────────────┐
│ E-mail et mot de passe  │ Recevoir un lien        │
│                         │                         │
│ [ e-mail            ]   │ [ e-mail            ]   │
│ [ mot de passe      ]   │                         │
│                         │ Recevez un mail avec un │
│ [ Se connecter      ]   │ lien pour vous connecter│
│ Mot de passe oublié     │ directement.            │
│                         │ [ Recevoir le lien  ]   │
└─────────────────────────┴─────────────────────────┘
```

Points non négociables :
- La mention du chemin B est **obligatoire** : une action dont on ne devine pas l'effet ne se tente pas.
- **Aucun lien « créer un compte ».** Un visiteur sans compte doit comprendre qu'il lui faut une invitation, pas chercher un bouton absent. Une ligne sous les deux colonnes : « Pas encore de compte ? L'accès se fait sur invitation. »
- L'écran « lien envoyé » est un état de la même page, pas une redirection.
- `redirect_url` est relu depuis l'URL et repassé à Better Auth.

- [ ] **Step 6 : Écrire la page de réinitialisation**

`src/pages/reinitialisation.astro` : saisie de la nouvelle adresse (demande), puis définition du mot de passe depuis le lien reçu. Erreurs via `messageErreur`.

- [ ] **Step 7 : Vérifier le build**

Run: `npm run build`
Expected: `connexion.astro` ne référence plus `@clerk/astro/components`.

- [ ] **Step 8 : Commit**

```bash
git add src/pages/connexion.astro src/pages/reinitialisation.astro src/lib/auth/erreurs.ts src/lib/auth/erreurs.test.ts
git commit -m "feat(auth): page de connexion a deux chemins, en francais

Mot de passe et lien magique presentes a parite : aucun des deux n'est le
repli de l'autre. Un code d'erreur inconnu ne sort jamais tel quel."
```

---

## Task 6 : Mails d'authentification

**Files:**
- Create: `src/emails/auth.ts`
- Modify: `src/lib/auth/server.ts` (brancher `sendMagicLink` et les autres envois)

**Interfaces:**
- Consumes: l'expéditeur et `renderTransactionnel` déjà utilisés par `src/pages/api/devis-reponse.ts`.
- Produces: `mailLienMagique`, `mailInvitation`, `mailReinitialisation`.

- [ ] **Step 1 : Relever l'expéditeur existant**

```bash
grep -n "from:\|renderTransactionnel\|resend" src/pages/api/devis-reponse.ts
```

Reprendre l'expéditeur **tel quel**. Ne jamais en inventer un : le domaine `send.coolbeans.cc` est authentifié, un autre ne l'est pas.

- [ ] **Step 2 : Écrire les trois gabarits**

`src/emails/auth.ts`, sur le modèle des gabarits existants de `src/emails/`. Tous en français, tous avec le lien en toutes lettres sous le bouton — un client dont le client mail masque les liens doit pouvoir copier l'URL.

- [ ] **Step 3 : Brancher les envois dans `createAuth`**

Remplacer le `throw` posé en Task 1 :

```ts
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            await mailLienMagique(env, { email, url });
          },
        }),
```

Idem pour `emailAndPassword.sendResetPassword` et pour l'invitation du plugin `organization` (`sendInvitationEmail`).

- [ ] **Step 4 : Vérifier**

Run: `npm run build`
Expected: PASS. L'envoi réel se vérifie en staging, Task 12 — Resend n'est pas testable hors ligne.

- [ ] **Step 5 : Commit**

```bash
git add src/emails/auth.ts src/lib/auth/server.ts
git commit -m "feat(auth): mails d'authentification en francais via Resend

Expediteur repris de devis-reponse.ts : send.coolbeans.cc est authentifie,
un autre domaine ne l'est pas."
```

---

## Task 7 : Menu compte

**Files:**
- Create: `src/components/portail/MenuCompte.astro`
- Modify: `src/components/portail/PortalNav.astro:125-145`

- [ ] **Step 1 : Écrire le composant**

Nom, adresse, lien Messagerie, déconnexion. La contrainte que Clerk imposait — réordonner ses items natifs, COO-35 — disparaît avec lui : l'ordre est libre.

La déconnexion poste vers `/api/auth/sign-out` puis redirige vers `/connexion`.

- [ ] **Step 2 : Remplacer `<UserButton />`**

Dans `PortalNav.astro`, remplacer le bloc `withAccount && (...)` par `<MenuCompte />`. Retirer l'import de `@clerk/astro/components`.

- [ ] **Step 3 : Vérifier**

Run: `npm run build`
Expected: PASS — plus aucun import Clerk dans `src/components/`.

```bash
grep -rn "@clerk" src/components/ || echo "aucun import Clerk restant dans les composants"
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/portail/MenuCompte.astro src/components/portail/PortalNav.astro
git commit -m "feat(portail): menu compte maison, UserButton retire

COO-35 est annulee : la contrainte d'ordre des items venait du composant
Clerk, qui disparait."
```

---

## Task 8 : Amorçage des organisations et des teams

Le registre YAML est la source de vérité ; D1 porte les mêmes slugs. Sans cette
tâche, la Task 9 inviterait des membres dans des organisations qui n'existent
pas. **Deux tables, un seul slug : une divergence est un bug, pas un cas à
gérer** — d'où la vérification d'écart du Step 4, qui n'est pas un confort.

**Files:**
- Create: `src/content/organisations/coolbeans.yaml`
- Create: `src/content/organisations/trigger.yaml`
- Create: `src/lib/portail/organisations.ts`
- Create: `scripts/amorcer-organisations.mjs`
- Modify: `src/content.config.ts`

**Interfaces:**
- Consumes: `createAuth` (Task 1), le champ `organisation` du registre (Task 3).
- Produces: `listOrganisations()` → `{ slug, nom }[]`, lu par la page de la Task 9.

- [ ] **Step 1 : Créer la collection**

Dans `src/content.config.ts`, sur le modèle de la collection `clients` :

```ts
/* Un fichier YAML par revendeur dans src/content/organisations/. Le nom du
   fichier est le slug, et c'est le MEME slug que l'organisation en D1.
   Coolbeans y figure comme les autres : c'est ce qui fera sortir sa marque du
   code en phase B. */
const organisations = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/organisations" }),
  schema: z.object({
    nom: z.string(),
  }),
});
```

Ajouter `organisations` à l'export `collections`.

- [ ] **Step 2 : Créer les deux fiches**

```bash
mkdir -p src/content/organisations
printf 'nom: Coolbeans\n' > src/content/organisations/coolbeans.yaml
printf 'nom: Trigger\n' > src/content/organisations/trigger.yaml
```

Les champs de marque (logo, couleurs) viennent en phase B : ne pas les ajouter
maintenant, ils n'auraient aucun lecteur.

- [ ] **Step 3 : Écrire le script d'amorçage**

`scripts/amorcer-organisations.mjs`, sur le modèle des scripts existants de
`scripts/`. Il est **idempotent** : relancé, il ne crée rien en double.

Pour chaque fiche d'organisation, créer l'organisation si son slug est absent.
Pour chaque fiche de client, créer la team correspondante dans l'organisation
de son champ `organisation`, si elle est absente.

Passer par les endpoints du plugin (`POST /organization/create`,
`POST /organization/create-team`) plutôt que par des `INSERT` directs : le
plugin pose des colonnes que du SQL écrit à la main oublierait.

- [ ] **Step 4 : Faire échouer le script sur tout écart**

Le script se termine en comparant les deux côtés et **sort en code 1** s'ils
divergent :

```
registre : coolbeans, trigger
D1       : coolbeans, trigger
teams    : amusoire(trigger), trigger(trigger), coolbeans(coolbeans), spinoza(coolbeans)
```

Un slug présent d'un seul côté est une erreur, pas un avertissement.

- [ ] **Step 5 : Lancer sur staging, deux fois**

```bash
node scripts/amorcer-organisations.mjs --env staging
node scripts/amorcer-organisations.mjs --env staging
```

Expected : le second passage ne crée rien et ne signale aucun écart. Si le
second passage crée quoi que ce soit, le script n'est pas idempotent — le
corriger avant de continuer, pas après.

- [ ] **Step 6 : Commit**

```bash
git add src/content/organisations/ src/content.config.ts src/lib/portail/organisations.ts scripts/amorcer-organisations.mjs
git commit -m "feat(portail): amorcage des organisations et des teams

Le registre YAML est la source de verite, D1 porte les memes slugs. Le
script est idempotent et echoue sur tout ecart entre les deux."
```

---

## Task 9 : `/espace/utilisateurs`

La surface que la disparition du dashboard Clerk rend obligatoire. Le plugin `organization` fournit la logique ; il reste l'écran.

**Files:**
- Create: `src/pages/espace/utilisateurs.astro`
- Modify: `src/lib/portail/nav.ts` (entrée dans la section Admin)
- Modify: `src/actions/index.ts` (actions d'invitation et de révocation)

**Interfaces:**
- Consumes: `createAuth` (Task 1), `isAdmin` (Task 2).

- [ ] **Step 1 : Ajouter l'entrée de nav**

Dans `src/lib/portail/nav.ts`, section `admin` (déjà `adminOnly: true`), après « Mes clients » :

```ts
      { label: "Utilisateurs", path: "/utilisateurs", flag: "live" },
```

- [ ] **Step 2 : Écrire les actions**

Dans `src/actions/index.ts`, sur le modèle de la garde admin systématique déjà en place ligne 12. Quatre actions, toutes gardées : `inviter`, `listerMembres`, `changerRole`, `revoquer`.

**Une invitation est toujours portée par une organisation**, et pour un `client` par une team. Le formulaire impose donc de choisir l'organisation ; il n'existe aucun chemin qui invite « au portail ».

- [ ] **Step 3 : Écrire la page**

Liste des membres par organisation, formulaire d'invitation (adresse, organisation, type de compte, team si `client`), bouton de révocation.

- [ ] **Step 4 : Vérifier la garde**

Run: `npm run build`, puis vérifier à la main en staging (Task 12) qu'un compte non-admin reçoit un refus, pas la page.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/espace/utilisateurs.astro src/lib/portail/nav.ts src/actions/index.ts
git commit -m "feat(portail): page de gestion des utilisateurs

Une invitation est toujours portee par une organisation : aucun chemin
n'invite « au portail »."
```

---

## Task 10 : Renommage des colonnes `*_clerk_id`

Le trou que COO-132 ne voyait pas. Ces colonnes portent des **lignes réelles en production depuis le 2026-08-17**.

**Files:**
- Create: `migrations/0005_user_ids.sql`
- Modify: `src/lib/portail/messagerie/store.ts:9,26,55,61,159,164`
- Modify: `src/components/portail/NouvelleDemandeAdmin.astro` (champ `pourClerkId`)

- [ ] **Step 1 : Relever l'identifiant Clerk de Ludo en production**

```bash
npx wrangler d1 execute coolbeans-portal --remote --command="SELECT DISTINCT author_clerk_id FROM tickets"
```

Noter la valeur. Un seul utilisateur réel, donc une seule valeur à remapper.

- [ ] **Step 2 : Écrire la migration**

```sql
-- Renommage des colonnes d'identifiant utilisateur (spec 2026-08-19 §5.2).
-- Les colonnes portaient des identifiants Clerk sur des lignes REELLES depuis
-- le 2026-08-17. Le nom cessait d'etre vrai apres la migration ; le remap
-- garde l'historique des tickets intact.
ALTER TABLE tickets RENAME COLUMN author_clerk_id TO author_user_id;
ALTER TABLE pending_publications RENAME COLUMN destinataire_clerk_id TO destinataire_user_id;

-- Remap de l'identifiant de Ludo, Clerk -> Better Auth.
-- Remplacer les deux valeurs avant execution : celle relevee au Step 1 et le
-- nouvel identifiant, lu dans la table user apres la premiere connexion.
UPDATE tickets SET author_user_id = 'NOUVEL_ID' WHERE author_user_id = 'ANCIEN_ID';
UPDATE pending_publications SET destinataire_user_id = 'NOUVEL_ID' WHERE destinataire_user_id = 'ANCIEN_ID';
```

**Vérifier le nom réel de la table du second `ALTER`** : `grep -n "destinataire_clerk_id" migrations/*.sql` donne la table exacte.

- [ ] **Step 3 : Renommer dans le code**

```bash
grep -rln "clerk_id\|ClerkId" src/ | tee /dev/stderr
```

Renommer `author_clerk_id` → `author_user_id`, `destinataire_clerk_id` → `destinataire_user_id`, `pourClerkId` → `pourUserId`.

- [ ] **Step 4 : Appliquer en staging et vérifier**

```bash
npx wrangler d1 execute coolbeans-portal-staging --remote --file=migrations/0005_user_ids.sql
npx wrangler d1 execute coolbeans-portal-staging --remote --command="SELECT id, author_user_id FROM tickets LIMIT 5"
```

- [ ] **Step 5 : Lancer les tests et le build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add migrations/0005_user_ids.sql src/lib/portail/messagerie/store.ts src/components/portail/NouvelleDemandeAdmin.astro
git commit -m "fix(messagerie): les colonnes d'identifiant cessent de mentir

author_clerk_id et destinataire_clerk_id portaient des lignes reelles en
prod depuis le 2026-08-17. Renommees et remappees : l'historique des
tickets reste intact."
```

> **À la main, hors plan :** appliquer cette migration sur `coolbeans-portal` (production) **dès le push sur `staging`**. Une autre session peut merger et publier le code sans elle, et le portail casserait. C'est un incident déjà vécu le 2026-08-19.

---

## Task 11 : Retrait de Clerk

À ne faire qu'une fois les Tasks 1 à 10 vertes. La suppression des skills `clerk-*` vient **après** la bascule vérifiée en production, jamais avant.

**Files:**
- Modify: `package.json`, `astro.config.mjs`, `wrangler.jsonc`
- Modify: les fichiers restants qui mentionnent Clerk

- [ ] **Step 1 : Recenser ce qui reste**

```bash
grep -rn -i "clerk" src/ astro.config.mjs wrangler.jsonc package.json
```

- [ ] **Step 2 : Retirer l'intégration Astro**

Dans `astro.config.mjs` : supprimer l'import `clerk`, l'import `frFR`, l'entrée `clerk({ localization: frFR })` du tableau `integrations`, et **tout le bloc `if (process.env.WORKERS_CI || process.env.CI)`** qui fixait la publishable key par environnement. Réécrire les commentaires d'en-tête qui expliquent le SSR « requis par le middleware Clerk » : la raison devient Better Auth, pas Clerk.

- [ ] **Step 3 : Retirer les dépendances**

```bash
npm uninstall @clerk/astro @clerk/localizations
```

Dans `wrangler.jsonc`, corriger le commentaire : `nodejs_compat` reste requis, mais plus « par @clerk/astro ». Vérifier ce qui l'exige réellement avant de réécrire la ligne — ne pas retirer le flag.

- [ ] **Step 4 : Vérifier**

```bash
npm test && npm run build
grep -rn -i "clerk" src/ astro.config.mjs package.json || echo "plus aucune mention de Clerk"
```

Il reste légitimement des mentions dans `docs/` et dans les commentaires historiques des migrations : ne pas les effacer, elles datent des décisions.

- [ ] **Step 5 : Retirer le secret du Worker**

À faire **après** la recette de production seulement :

```bash
npx wrangler secret delete CLERK_SECRET_KEY
npx wrangler secret delete CLERK_SECRET_KEY --env staging
```

- [ ] **Step 6 : Commit**

```bash
git add package.json package-lock.json astro.config.mjs wrangler.jsonc src/
git commit -m "chore(auth): Clerk sort du repo

Integration, dependances et cle publiable par environnement retirees. Les
mentions restantes dans docs/ datent des decisions : conservees."
```

---

## Task 12 : Recette

Les 17 scénarios de la spec §8, **par environnement**. Staging d'abord, production ensuite et sur ordre explicite de Ludo.

- [ ] **Step 1 : Poser les secrets de staging**

```bash
npx wrangler secret put BETTER_AUTH_SECRET --env staging
```

- [ ] **Step 2 : Pousser sur staging**

```bash
git push origin staging
```

Compter environ six minutes avant que le nouveau HTML soit servi.

- [ ] **Step 3 : Créer le premier compte à la main**

Aucune inscription publique : le premier admin ne peut pas naître d'un formulaire. L'insérer directement en D1, puis lui poser `portalRole = 'admin'`. C'est aussi la procédure de secours de la spec §2 — l'écrire dans la doc d'exploitation maintenant que les noms de tables sont connus.

- [ ] **Step 4 : Dérouler les 17 scénarios en staging**

Reprendre la liste de la spec §8, un par un. Les scénarios 12 à 17 sont ceux du multi-tenant : ce sont les nouveaux, et ce sont eux qui portent le risque.

- [ ] **Step 5 : Vérifier le piège des cookies**

Se connecter sur `https://my-staging.coolbeans.cc`, fermer l'onglet, revenir. Si la session ne tient pas, c'est la `baseURL` derrière la réécriture d'hôte — **ça ne se voit qu'en déployé, jamais en local.**

- [ ] **Step 6 : S'arrêter**

Ne pas pousser en production. Rendre compte à Ludo : ce qui passe, ce qui ne passe pas, ce qui reste à sa main. La publication en production est sa décision, sur ordre explicite.

---

## Après le plan

- Retirer les 22 skills `clerk-*` de `~/.claude/skills/`, **après** la bascule vérifiée en production. Relancer `cd ~/dev/dotfiles && ./backup.sh` puis commit/push dans la même session.
- Corriger la skill `better-auth-cloudflare` avec le pattern réellement validé : sa section Astro est aujourd'hui une déduction non testée.
- Amender la spec Spinoza pour démarrer directement sur Better Auth.
- Fermer COO-10, COO-35 et COO-47, absorbées par cette migration.
