# Portail client · module Projets et sync Asana (S1) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher dans `/espace/projets` l'avancement réel des projets Asana du client courant, alimenté par un sync Worker en lecture seule qui écrit un snapshot JSON par team dans Workers KV.

**Architecture:** Toute la logique métier (normalisation des colonnes, filtres de visibilité, statuts, construction et hachage du snapshot) vit dans des modules **purs** sous `src/lib/portail/asana/`, testés sous Vitest sans réseau ni runtime Cloudflare. Au-dessus, une couche d'accès (client HTTP Asana avec pagination et backoff 429, couche KV à écriture conditionnelle) reçoit ses dépendances par injection. `syncTeam(gid)` est l'unité de base ; `syncTeams(gids)` boucle dessus. Un unique point d'entrée applicatif, la route `POST /api/admin/sync`, lit le registre des clients et déclenche le sync ; le handler `scheduled` du Worker se contente de l'appeler en interne. La page `/espace/projets` ne fait que lire KV et rendre — aucun appel Asana au runtime des requêtes.

**Tech Stack:** Astro 7 (SSR, content collections, Astro Actions), `@clerk/astro` v4, Cloudflare Workers + Workers KV (`PORTAL_KV`), API Asana v1.0 (PAT Bearer), Tailwind v4 sur les tokens de `global.css`, Vitest.

**Specs, par ordre d'autorité :**

1. [corrections-spec-portail-client.md](../specs/corrections-spec-portail-client.md) — fait foi ; §6 et §7 (2026-08-12) priment sur le reste du document.
2. [brief-portail-client-asana.md](../specs/brief-portail-client-asana.md) — spec d'origine, à lire à travers le filtre du fichier ci-dessus.
3. [2026-08-12-portail-sync-par-team.md](../specs/2026-08-12-portail-sync-par-team.md) — arbitrages du sync.
4. [2026-08-12-selecteur-de-client-admin-design.md](../specs/2026-08-12-selecteur-de-client-admin-design.md) — modèle client : les teams Asana se lisent dans `src/content/clients/`.

---

## Global Constraints

- **Branche `staging`.** Aucun push vers `main`, aucun déploiement en production sans ordre explicite de Ludo.
- **Commits atomiques**, un par tâche minimum, message en français.
- **Lecture seule.** S1 n'écrit jamais vers Asana. La première écriture (module Support, corrections §7) est un sprint distinct.
- **Design system :** utilitaires Tailwind branchés sur les tokens de `global.css`. Les blocs `<style>` sont interdits hors exceptions (`scripts/verify-design-system.js` §F).
- **Aucun nom de classe personnalisé sur les nouveaux composants du portail.** `EspaceLayout` enveloppe ses pages dans `.doc-root` et importe `doc.css` : tout sélecteur `.doc-root .X` (0,2,0) y bat les utilitaires Tailwind (0,1,0). La liste des noms pris par `doc.css` est longue et courte à la fois (`card`, `cards`, `pill`, `tgl`, `brand`, `topnav`, `spacer`, `row`, `empty`, `todo`, `lab`, `arrow`, `flow`, `node`, `t`, `v`, `k`, `d`, `h`, `rt`, `rp`, `ttl`, `adm`…). La règle de ce sprint est donc absolue : **100 % utilitaires, zéro classe maison**. Seules exceptions autorisées, parce que `doc.css` les prévoit explicitement pour les pages de l'espace : le `<h1>` nu et `class="sub"` sur le paragraphe de sous-titre (`.doc-root .espace-main h1`, `.doc-root .espace-main .sub`), déjà employés par les pages-souches de S0.
- **`npm run verify` ne doit gagner aucun nouvel échec.** Deux échecs sont connus et **antérieurs à ce sprint** ; ils ne sont pas des régressions et ne doivent pas être « réparés » ici :
  - `npm run verify` → `ÉCHEC blocs <style> limités aux exceptions → src/pages/projets/[slug].astro` (1 échec sur 91).
  - `npx --yes -p typescript@5 tsc --noEmit` → `src/worker.ts(60,9): error TS2322` (`Request<CfProperties>` vs `Request<IncomingRequestCfProperties>`).
- **`typescript` n'est pas une devDependency.** Le typecheck ne tourne que via `npx --yes -p typescript@5 tsc --noEmit`. `npm run build` ne type-check pas.
- **Tout nouveau composant rejoint la Bibliothèque de `src/pages/design-system.astro`** dans le commit qui le crée (definition of done).
- **Aucun secret dans le repo.** `ASANA_PAT` et `ADMIN_SYNC_SECRET` sont posés par `wrangler secret put` ; en local via `.dev.vars` (déjà décrit dans `.dev.vars.example`, ignoré par git).
- **`cloudflare:workers` n'est pas résolvable sous Vitest.** Tout module qui l'importe doit être testé avec `vi.mock("cloudflare:workers", () => ({ env: {} }))` et recevoir son binding en argument — c'est le motif déjà en place dans `src/lib/chiffrage/store.ts` / `store.test.ts`, à reproduire tel quel.
- **`astro:content` n'est pas résolvable sous Vitest non plus.** Les fonctions pures prennent leurs données en argument (motif des fonctions `*In` de `src/lib/portail/clients.ts`).
- Vérification finale de chaque tâche : `npx vitest run`, `npm run build`, `npm run verify`, `npx --yes -p typescript@5 tsc --noEmit`.
- **Toutes les pages du portail sont derrière Clerk.** Rien de ce qui touche à l'UI n'est vérifiable sans session : les étapes de vérification visuelle sont explicitement marquées « manuelle, session requise » et ne doivent pas être rapportées comme faites si elles ne l'ont pas été.

### Valeurs exactes, à recopier telles quelles

| Élément | Valeur |
| --- | --- |
| Workspace Asana | `1201457508335146` (déjà dans `vars.ASANA_WORKSPACE_GID`) |
| Team **Coolbeans** | `1217361878516615` |
| Team **Amusoire** | `1217146868378708` (déjà dans `src/content/clients/amusoire.yaml`) |
| Projets de la team Coolbeans | `Site web Coolbeans` `1217361878516618` · `myCoolbeans` `1217409019426531` · **`🛟 Support Coolbeans` `1217414522363591`** |
| Projets de la team Amusoire | `📱 LP + UK` `1217157542559261` · `🎭 Refonte site` `1217157895571576` |
| Sections canoniques, dans l'ordre | `📥 Inbox` · `🧱 Backlog` · `🚀 Sprint` · `🚧 En cours` · `☝️ Pour validation` · `✅ Terminé` |
| Les mêmes chez Amusoire, **autres emojis** | `📥 Inbox` · `🍫 Backlog` · `🚀 Sprint` · `🚧 En cours` · `🤙 Pour validation` · `✅ Terminé` |

**Les emojis varient réellement d'une team à l'autre** — `🍫` contre `🧱` pour Backlog, `🤙` contre `☝️` pour Pour validation. Ce n'est pas une hypothèse de spec : c'est l'état du workspace au 2026-08-12. Le matching insensible aux emojis (§6) est donc structurellement nécessaire, pas une précaution. Les deux jeux figurent dans les tests de la tâche 1.
| Binding KV | `PORTAL_KV` (prod `f720076d…`, staging `684d2093…`) |
| Cron | `*/5 * * * *`, déjà posé en S0 |
| Clés KV | `team:{team_gid}` (exposée au client) · `meta:last_sync` (**jamais** exposée) |

---

## État réel des boards Asana au 2026-08-12 — à lire avant de commencer

Le workspace a été inspecté pendant l'écriture de ce plan. Trois constats changent ce qu'il faut construire, et un quatrième change ce qu'il faut attendre du résultat.

### 1. Le projet Support existe déjà, et S1 doit l'exclure

`🛟 Support Coolbeans` (`1217414522363591`) est dans la team Coolbeans **aujourd'hui**. Sans exclusion, le module Projets l'afficherait dès le premier sync, avec un badge de statut qui n'a aucun sens sur un board de support — exactement ce que corrections §7 interdit (« exclu de la liste des projets du portail et de la règle de statut projet de §1 »).

L'exclusion entre donc dans le périmètre S1. Elle se fait par **GID explicite dans le registre** (`asana_support_project_gid`), pas par correspondance de nom :

- le nom réel est `🛟 Support Coolbeans`, pas `Support` — un test d'égalité échouerait, et un test de préfixe après normalisation masquerait silencieusement un projet client qu'on nommerait un jour « Support Amusoire » ;
- le sprint Support aura de toute façon besoin de ce GID pour écrire ses tickets dans le bon projet. Le poser ici n'anticipe rien, ça déplace une donnée là où elle devait vivre.

Filet de sécurité, sans changement de comportement : si un projet dont le nom normalisé commence par `support` n'est pas dans la liste d'exclusion, le sync loggue un warning. C'est ce qui rattrapera le mapping oublié au moment où un nouveau client aura son board Support.

Note au passage, pour le sprint Support : `🛟 Support Coolbeans` est en `default_view: "list"`. Corrections §7 exige `board`. Le modèle est donc encore à corriger — hors périmètre ici, mais confirmé.

### 2. La convention `---` des notes entre en collision avec un usage existant

Les notes de `🎭 Refonte site` (Amusoire) contiennent un `---`, mais il n'y sépare pas du public et du privé : il précède une note de bas de page. **Tout ce qui est au-dessus** — cinq blocs de liens Google Docs, Google Drive, un widget de préproduction — serait donc exposé au client tel quel par la règle de corrections §4 option A.

Ce n'est pas une fuite grave (le cahier des charges appartient au client, les Drive sont protégés par permissions), mais ce n'est pas non plus « une description courte affichée au client » : ce serait un bloc d'URLs dans la carte.

Ce que fait ce plan, sans contredire §4 : **plafonner aussi à 300 caractères la portion située avant le séparateur.** Exposer strictement moins que la règle ne contredit pas une règle de confidentialité. La tâche 3 l'implémente et le teste.

Ce que ce plan ne peut pas faire à ta place : **relire les `notes` de chaque projet d'une team synchronisée avant la mise en ligne.** Le `---` n'a jamais voulu dire « ce qui suit est privé » dans tes boards existants ; il faut soit réécrire ces notes, soit trancher pour l'option B de §4 (ne pas exposer `notes` du tout). **C'est une décision à prendre, pas une tâche à exécuter** — le plan implémente l'option A telle qu'arbitrée.

### 3. Sans toilettage des boards, le module s'affiche vide

C'est le constat le plus important, et il ne relève pas du code.

Le filtre de visibilité du §6 — **assigné ET deadline obligatoires** — écarte aujourd'hui la totalité des tâches inspectées :

| Projet | Tâches | Avec assigné | Avec deadline | Visibles au portail |
| --- | --- | --- | --- | --- |
| `myCoolbeans` | 10 | **0** | **0** | **0** |
| `Site web Coolbeans` | 1 | à vérifier | à vérifier | probablement 0 |
| `🎭 Refonte site` (Amusoire) | 31, toutes cochées | à vérifier | à vérifier | à vérifier |
| `📱 LP + UK` (Amusoire) | 13, toutes cochées | à vérifier | à vérifier | à vérifier |

Les dix tâches de `myCoolbeans` ont `assignee: null` **et** `due_on: null`. Le module se déploierait donc correct et vide : deux cartes de projet, chacune affichant « Aucune tâche planifiée pour le moment », et un badge « En cours » (règle §1 : `restantes` vide → `in_progress`, jamais « Prêt à démarrer »).

Ce n'est pas un défaut à corriger dans le code — c'est le comportement voulu, et il est correct. C'est une **précondition d'exploitation** : assigner et dater les tâches qu'on veut voir remonter. Elle vaut la peine d'être connue avant le déploiement plutôt qu'après.

Deuxième effet, sur les deux projets d'Amusoire : leurs 44 tâches sont toutes cochées et les projets ne sont pas marqués terminés dans Asana. Ils s'afficheront donc « En cours » et non « Terminé » — c'est exactement le critère d'acceptation 9, qu'on pourra vérifier sur des données réelles sans rien fabriquer.

---

## Comportement du sync quand le nombre de clients croît

Le plan doit répondre à cette question explicitement — c'est la contrainte dimensionnante du sprint.

**Coût d'un balayage complet**, T teams et P projets par team :

| Ressource | Formule | Détail |
| --- | --- | --- |
| Requêtes Asana | `T × (1 + P)` | 1 `GET /teams/{gid}/projects` + 1 `GET /tasks?project=` par projet |
| Subrequests Cloudflare | `T × (P + 3) + 1` | les requêtes Asana + 1 `getWithMetadata` + au plus 1 `put` par team, + 1 `put` de `meta:last_sync` |

À P = 3 projets par client :

| Clients (T) | Requêtes Asana / passage | Subrequests / invocation |
| --- | --- | --- |
| **2** (registre actuel — chiffres exacts, voir ci-dessous) | **6** | **11** |
| **17** (toutes les teams clientes existantes) | 68 | 103 |
| **37** | 148 | 223 |
| 50 | 200 | 301 |

Le détail de la ligne « 2 clients », sur les projets réels : Coolbeans a 3 projets dont un exclu (Support), soit `1 + 2 = 3` requêtes ; Amusoire en a 2, soit `1 + 2 = 3`. Total **6 requêtes Asana**. Côté subrequests : 6 + 2 `getWithMetadata` + 2 `put` au premier passage + 1 `put` de `meta:last_sync` = **11**. Exclure le projet Support **avant** d'aller chercher ses tâches économise une requête par team concernée — raison de plus de filtrer dans `syncTeam` et non dans le builder de snapshot.

**Les plafonds, dans l'ordre où ils mordent :**

1. **API Asana, 150 requêtes/minute (plan gratuit).** C'est le premier mur, atteint vers **37 clients**. C'est un débit *dans le temps* : un passage qui émet 68 requêtes en trois secondes puis ne fait plus rien pendant cinq minutes reste à 68 sur toute fenêtre de 60 secondes. Un 429 consomme quand même du quota — d'où le backoff obligatoire de la tâche 4.
2. **Subrequests par invocation Cloudflare.** 10 000 sur le plan payant : il faudrait ~1 660 clients pour l'atteindre. Sur le plan **gratuit**, le plafond est 50 et il tombe vers **7-8 clients**.
3. **Wall clock d'un Cron Trigger : 15 minutes.** En séquentiel à ~250 ms par requête, 37 clients coûtent ~37 s. Aucune marge en jeu.

**Seuil de découpage : 30 clients dans le registre.** En deçà, balayage complet à chaque passage, tel qu'implémenté ici. Au-delà (marge prise sous les 37), passer à une **tranche tournante** sans toucher au cron : garder `*/5`, trier les team GIDs, et ne traiter à chaque passage que ceux dont le rang satisfait `rang % 3 === Math.floor(minute / 5) % 3`. La fraîcheur client passe de 5 à 15 minutes, le plafond de 37 à ~112 clients. `syncTeams(gids)` prenant déjà une liste en argument, le découpage se réduit à filtrer cette liste au point d'appel — aucune refonte.

**Le compteur qui dit quand y aller** est `asana_requests` dans `meta:last_sync` (tâche 6). Il n'existe que pour ça : quand il approche 120 par passage, le découpage est dû.

**Ne rien implémenter de la tranche tournante en S1.** À 2 clients dans le registre, ce serait de la complexité permanente pour un mur situé dix-huit fois plus loin.

### Deux nuances honnêtes sur les specs

- **Corrections §3 dit que `getWithMetadata()` évite « la lecture de la valeur complète ». C'est faux au sens strict :** `getWithMetadata` rapatrie la valeur *et* la métadonnée, et coûte le même unique subrequest qu'un `get`. L'économie réelle est ailleurs — on ne `JSON.parse` pas un snapshot inchangé, et surtout on n'écrit pas. La décision d'écriture conditionnelle reste entièrement justifiée (elle fait de « Dernière mise à jour » la date du dernier *changement*), seule sa justification technique est à corriger. Une vraie lecture métadonnée-seule existerait via `list({ prefix: "team:" })`, qui ramènerait les T hachages en **un** subrequest au lieu de T. Gain réel mais nul à cette échelle, et il casserait la symétrie « syncTeam(gid) est l'unité de base ». **Non implémenté, documenté ici pour le jour où le compteur le justifiera.**
- **`vars.ASANA_WORKSPACE_GID` n'est utilisé par aucun code de ce sprint.** Le sync attaque `/teams/{gid}/projects`, pas d'endpoint scopé workspace. La variable est conservée telle quelle : elle est publique, sans coût, et le module Support (corrections §7) en aura besoin pour `POST /tasks`. Ne pas la retirer, ne pas inventer un usage.

---

## Structure des fichiers

**Créés**

| Fichier | Responsabilité |
| --- | --- |
| `src/lib/portail/asana/types.ts` | Types partagés : formes brutes Asana et formes du snapshot. Aucune logique. |
| `src/lib/portail/asana/sections.ts` + `.test.ts` | Normalisation d'un nom de section (emojis, casse, accents), table de mapping §6, marqueur d'exclusion « . ». Pur. |
| `src/lib/portail/asana/rules.ts` + `.test.ts` | Visibilité d'une tâche, statut d'une tâche, statut d'un projet (§1), tris. Pur. |
| `src/lib/portail/asana/snapshot.ts` + `.test.ts` | Description publique (§4 option A), assemblage du snapshot, sérialisation stable, hachage SHA-256. Pur. |
| `src/lib/portail/asana/asana-client.ts` + `.test.ts` | Accès HTTP Asana : Bearer, pagination `next_page.offset`, retry avec backoff sur 429, compteur de requêtes. `fetch` injecté. |
| `src/lib/portail/asana/kv.ts` + `.test.ts` | Clés KV, écriture conditionnelle au hash, lecture d'un snapshot, écriture du rapport de sync. Binding injecté. |
| `src/lib/portail/asana/sync.ts` + `.test.ts` | `syncTeam(gid, deps)` et `syncTeams(gids, deps)`. Orchestration, try/catch par team, comptage. |
| `src/lib/portail/asana/admin-auth.ts` + `.test.ts` | Comparaison à temps constant du secret de la route admin. Pur. |
| `src/lib/portail/asana/format.ts` + `.test.ts` | Formats d'affichage français : date `due_on`, horodatage `synced_at` en heure de Paris, libellés de colonnes et de statuts. Pur. |
| `src/pages/api/admin/sync.ts` | `POST /api/admin/sync` — le seul point d'entrée du sync. Lit le registre, appelle `syncTeams`. |
| `src/components/portail/projets/ProjetCard.astro` | Carte d'un projet : nom, description, deadline, badge de statut, quatre colonnes. |
| `src/components/portail/projets/TacheLigne.astro` | Une ligne de tâche : état visuel, nom, deadline. |

**Modifiés**

| Fichier | Changement |
| --- | --- |
| `src/content/clients/coolbeans.yaml` | Ajout de `asana_team_gid: "1217361878516615"` — absent aujourd'hui, donc Coolbeans n'est synchronisable par rien — et de `asana_support_project_gid: "1217414522363591"`. |
| `src/content.config.ts` | Champ `asana_support_project_gid` optionnel sur la collection `clients`. |
| `src/lib/portail/clients.ts` | Le même champ sur `PortalClient`. **Ne pas toucher à `MODULE_REQUIREMENTS`** : le module Support n'est pas de ce sprint, et lui donner une nouvelle exigence changerait son empty state sans que rien ne le consomme. |
| `src/worker.ts` | Le handler `scheduled` déclenche réellement le sync ; commentaires remis à jour (ils parlent encore d'un cron horaire et du plan gratuit). |
| `src/pages/espace/projets.astro` | Remplacement de la page-souche par le rendu du snapshot. |
| `src/pages/design-system.astro` | Bibliothèque : `ProjetCard` et `TacheLigne`. |
| `src/actions/index.ts` | *(tâche 9, optionnelle)* action `portail.synchroniser`. |
| `src/components/portail/PortalSidebar.astro` | *(tâche 9, optionnelle)* rien — le bouton vit dans la page, pas dans la colonne. |

---

## Task 1 : Normalisation des colonnes et marqueur d'exclusion

**Files:**
- Create: `src/lib/portail/asana/types.ts`
- Create: `src/lib/portail/asana/sections.ts`
- Test: `src/lib/portail/asana/sections.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit :
  - `type TaskStatus = "todo" | "in_progress" | "to_validate" | "done"`
  - `type ProjectStatus = "ready" | "in_progress" | "done"`
  - `interface AsanaProject { gid: string; name: string; notes?: string | null; due_on?: string | null; completed?: boolean; archived?: boolean }`
  - `interface AsanaMembership { project?: { gid?: string } | null; section?: { name?: string } | null }`
  - `interface AsanaTask { gid: string; name: string; due_on?: string | null; completed?: boolean; assignee?: { gid: string } | null; memberships?: AsanaMembership[] }`
  - `interface TaskSnapshot { gid: string; name: string; due_on: string; status: TaskStatus }`
  - `interface ProjectSnapshot { gid: string; name: string; description: string; due_on: string | null; status: ProjectStatus; tasks: TaskSnapshot[] }`
  - `interface TeamSnapshotBody { schema_version: 1; team_gid: string; projects: ProjectSnapshot[] }`
  - `interface TeamSnapshot extends TeamSnapshotBody { synced_at: string }`
  - `interface SyncReport { … }` (forme exacte dans le code ci-dessous)
  - `type LogFn = (entry: Record<string, unknown>) => void`
  - `normalizeSectionName(raw: string): string`
  - `type SectionMapping = { kind: "status"; status: TaskStatus } | { kind: "excluded" } | { kind: "unknown" }`
  - `mapSection(rawName: string): SectionMapping`
  - `isHiddenName(raw: string): boolean`
  - `COLUMN_ORDER: readonly TaskStatus[]`

- [ ] **Step 1: Écrire les types partagés**

Créer `src/lib/portail/asana/types.ts` :

```ts
// Formes échangées par le sync du module Projets.
//
// Deux familles à ne pas confondre :
// - `Asana*` : ce que renvoie l'API, donc tout est optionnel. Les opt_fields
//   demandés peuvent manquer d'une réponse à l'autre, et une forme inattendue
//   ne doit jamais faire planter le sync (brief §5, « Robustesse »).
// - `*Snapshot` : ce qu'on écrit dans KV, donc tout est garanti. `due_on` d'une
//   tâche y est une string non nulle : le filtre de visibilité du §6 écarte
//   déjà les tâches sans deadline.

export type TaskStatus = "todo" | "in_progress" | "to_validate" | "done";
export type ProjectStatus = "ready" | "in_progress" | "done";

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string | null;
  due_on?: string | null;
  completed?: boolean;
  archived?: boolean;
}

export interface AsanaMembership {
  project?: { gid?: string } | null;
  section?: { name?: string } | null;
}

export interface AsanaTask {
  gid: string;
  name: string;
  due_on?: string | null;
  completed?: boolean;
  assignee?: { gid: string } | null;
  memberships?: AsanaMembership[];
}

export interface TaskSnapshot {
  gid: string;
  name: string;
  due_on: string;
  status: TaskStatus;
}

export interface ProjectSnapshot {
  gid: string;
  name: string;
  /** Portion publique de `notes` (corrections §4, option A). `""` si rien d'exposable. */
  description: string;
  due_on: string | null;
  status: ProjectStatus;
  tasks: TaskSnapshot[];
}

/**
 * Le snapshot SANS `synced_at` : c'est cette forme-là qui est hachée
 * (corrections §3, étape 1). Y inclure l'horodatage rendrait tout hash
 * différent à chaque passage, ce qui annulerait l'écriture conditionnelle.
 */
export interface TeamSnapshotBody {
  schema_version: 1;
  team_gid: string;
  projects: ProjectSnapshot[];
}

/** Ce qui est réellement écrit sous `team:{gid}`. */
export interface TeamSnapshot extends TeamSnapshotBody {
  synced_at: string;
}

/** Écrit sous `meta:last_sync`. JAMAIS exposé au client (corrections §3). */
export interface SyncReport {
  at: string;
  teams: number;
  teams_ok: number;
  teams_failed: number;
  projects: number;
  tasks: number;
  snapshots_written: number;
  /** Le compteur qui dit quand découper en tranches : cf. le plan, seuil 120. */
  asana_requests: number;
  subrequests: number;
  duration_ms: number;
  errors: { team_gid: string; message: string }[];
}

/** Journalisation structurée. `console.log` suffit (brief §5). */
export type LogFn = (entry: Record<string, unknown>) => void;
```

- [ ] **Step 2: Écrire le test de normalisation (il doit échouer)**

Créer `src/lib/portail/asana/sections.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { COLUMN_ORDER, isHiddenName, mapSection, normalizeSectionName } from "./sections";

describe("normalizeSectionName", () => {
  it("retire les emojis, la casse et les accents", () => {
    expect(normalizeSectionName("🚧 En cours")).toBe("en cours");
    expect(normalizeSectionName("✅ Terminé")).toBe("termine");
    expect(normalizeSectionName("🧱 Backlog")).toBe("backlog");
    expect(normalizeSectionName("📥 Inbox")).toBe("inbox");
    expect(normalizeSectionName("🚀 Sprint")).toBe("sprint");
  });

  // ☝️ = U+261D suivi du sélecteur de variation U+FE0F. Sans traitement du
  // sélecteur, il resterait un caractère invisible dans la chaîne normalisée
  // et le matching échouerait sur la seule colonne qui appelle une action.
  it("gère le sélecteur de variation de ☝️", () => {
    expect(normalizeSectionName("☝️ Pour validation")).toBe("pour validation");
  });

  it("écrase les espaces multiples, insécables et de bord", () => {
    expect(normalizeSectionName("  À  faire  ")).toBe("a faire");
  });

  // Le piège : \p{Emoji} matche les CHIFFRES et # et *. Une normalisation
  // écrite avec \p{Emoji} au lieu de \p{Extended_Pictographic} transformerait
  // « Sprint 2 » en « sprint » — silencieusement.
  it("ne mange pas les chiffres", () => {
    expect(normalizeSectionName("🚀 Sprint 2")).toBe("sprint 2");
  });

  it("renvoie une chaîne vide sur une entrée vide", () => {
    expect(normalizeSectionName("")).toBe("");
    expect(normalizeSectionName("   ")).toBe("");
  });
});

describe("mapSection", () => {
  it("exclut Inbox du snapshot", () => {
    expect(mapSection("📥 Inbox")).toEqual({ kind: "excluded" });
  });

  it("fusionne Backlog, Sprint, Next Sprint et À faire sous todo", () => {
    for (const nom of ["🧱 Backlog", "🚀 Sprint", "Next Sprint", "À faire"]) {
      expect(mapSection(nom)).toEqual({ kind: "status", status: "todo" });
    }
  });

  it("mappe les trois autres colonnes", () => {
    expect(mapSection("🚧 En cours")).toEqual({ kind: "status", status: "in_progress" });
    expect(mapSection("☝️ Pour validation")).toEqual({ kind: "status", status: "to_validate" });
    expect(mapSection("À valider")).toEqual({ kind: "status", status: "to_validate" });
    expect(mapSection("✅ Terminé")).toEqual({ kind: "status", status: "done" });
  });

  // Emojis relevés sur la team Amusoire au 2026-08-12. Ce ne sont PAS ceux de
  // la team Coolbeans : 🍫 contre 🧱, 🤙 contre ☝️. C'est ce qui rend le
  // matching insensible aux emojis structurellement nécessaire — un board par
  // client, des emojis choisis à la main, aucune convention à espérer.
  it("mappe les mêmes colonnes avec les emojis d'une autre team", () => {
    expect(mapSection("🍫 Backlog")).toEqual({ kind: "status", status: "todo" });
    expect(mapSection("🤙 Pour validation")).toEqual({ kind: "status", status: "to_validate" });
  });

  it("signale une section inconnue sans trancher", () => {
    expect(mapSection("🤷 Peut-être un jour")).toEqual({ kind: "unknown" });
  });
});

describe("isHiddenName", () => {
  it("exclut un nom commençant par un point", () => {
    expect(isHiddenName(".chore interne")).toBe(true);
  });

  // Critère d'acceptation 17 : « y compris avec espaces avant le point ».
  it("exclut malgré des espaces de tête, insécables compris", () => {
    expect(isHiddenName("   .chore")).toBe(true);
    expect(isHiddenName(" .chore")).toBe(true);
  });

  it("n'exclut pas un point ailleurs qu'en tête", () => {
    expect(isHiddenName("Refonte v2.0")).toBe(false);
    expect(isHiddenName("Livraison finale.")).toBe(false);
  });
});

describe("COLUMN_ORDER", () => {
  it("suit l'ordre d'affichage client", () => {
    expect([...COLUMN_ORDER]).toEqual(["todo", "in_progress", "to_validate", "done"]);
  });
});
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/sections.test.ts`
Expected: FAIL — `Failed to resolve import "./sections"`.

- [ ] **Step 4: Écrire la normalisation**

Créer `src/lib/portail/asana/sections.ts` :

```ts
// Colonnes canoniques du board Asana et matching tolérant (corrections §6).
//
// Six colonnes relevées sur le projet pilote « Site web Coolbeans »
// (GID 1217361878516618) : 📥 Inbox · 🧱 Backlog · 🚀 Sprint · 🚧 En cours ·
// ☝️ Pour validation · ✅ Terminé.
//
// Le matching ignore les emojis, la casse, les accents et les espaces. Backlog
// et Sprint fusionnent sous « À faire » : ce sont des colonnes de travail
// internes, mais leurs tâches sont publiques — la mécanique agile est masquée,
// pas les tâches.

import type { TaskStatus } from "./types";

/**
 * Ce qu'on retire : les pictogrammes (\p{Extended_Pictographic}), le sélecteur
 * de variation U+FE0F, le joineur de largeur nulle U+200D et les modificateurs
 * de teinte.
 *
 * PIÈGE : ne pas utiliser \p{Emoji}. Cette propriété couvre les chiffres 0-9,
 * # et * — « Sprint 2 » deviendrait « sprint », sans le moindre signal.
 */
const PICTOGRAMMES = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;
const DIACRITIQUES = /\p{Diacritic}/gu;

export function normalizeSectionName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(PICTOGRAMMES, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Table de correspondance du §6. Clés déjà normalisées. */
const TABLE: Record<string, TaskStatus> = {
  backlog: "todo",
  "next sprint": "todo",
  sprint: "todo",
  "a faire": "todo",
  "en cours": "in_progress",
  "pour validation": "to_validate",
  "a valider": "to_validate",
  termine: "done",
};

const EXCLUES = new Set(["inbox"]);

export type SectionMapping =
  | { kind: "status"; status: TaskStatus }
  | { kind: "excluded" }
  | { kind: "unknown" };

/**
 * Trois issues, jamais une exception : une section inattendue est une anomalie
 * à logger, pas une raison de faire tomber le sync d'une team entière.
 * L'appelant décide quoi faire de `unknown` (règle du brief : in_progress + warning).
 */
export function mapSection(rawName: string): SectionMapping {
  const nom = normalizeSectionName(rawName);
  if (EXCLUES.has(nom)) return { kind: "excluded" };
  const status = TABLE[nom];
  return status ? { kind: "status", status } : { kind: "unknown" };
}

/**
 * Marqueur d'exclusion du §6 : un nom qui commence par « . » ne rentre pas
 * dans le snapshot, tâche comme projet. Remplace le préfixe 🔒 du brief et
 * toute sa normalisation Unicode.
 *
 * `trim()` suffit pour le critère 17 : la définition ECMAScript de l'espace
 * blanc inclut l'espace insécable U+00A0 et les espaces typographiques.
 */
export function isHiddenName(raw: string): boolean {
  return raw.trim().startsWith(".");
}

/** Ordre d'affichage des colonnes côté client (brief §6). */
export const COLUMN_ORDER = ["todo", "in_progress", "to_validate", "done"] as const satisfies readonly TaskStatus[];
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/sections.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Vérifier que rien n'a régressé**

Run: `npx vitest run && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: Vitest vert ; `verify` à 1 échec (`src/pages/projets/[slug].astro`) ; `tsc` à 1 erreur (`src/worker.ts(60,9)`). Aucun autre.

- [ ] **Step 7: Commit**

```bash
git add src/lib/portail/asana/types.ts src/lib/portail/asana/sections.ts src/lib/portail/asana/sections.test.ts
git commit -m "feat(portail): normalisation des colonnes Asana et marqueur d'exclusion"
```

---

## Task 2 : Règles de visibilité, de statut et de tri

**Files:**
- Create: `src/lib/portail/asana/rules.ts`
- Test: `src/lib/portail/asana/rules.test.ts`

**Interfaces:**
- Consomme : `AsanaProject`, `AsanaTask`, `TaskSnapshot`, `ProjectSnapshot`, `TaskStatus`, `ProjectStatus`, `LogFn` (`./types`) ; `mapSection`, `isHiddenName`, `COLUMN_ORDER` (`./sections`).
- Produit :
  - `sectionNameFor(task: AsanaTask, projectGid: string): string | null`
  - `toTaskSnapshot(task: AsanaTask, projectGid: string, log: LogFn): TaskSnapshot | null`
  - `isVisibleProject(project: AsanaProject): boolean`
  - `projectStatus(project: AsanaProject, tasks: TaskSnapshot[]): ProjectStatus`
  - `sortTasks(tasks: TaskSnapshot[]): TaskSnapshot[]`
  - `sortProjects(projects: ProjectSnapshot[]): ProjectSnapshot[]`

- [ ] **Step 1: Écrire le test (il doit échouer)**

Créer `src/lib/portail/asana/rules.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import {
  isVisibleProject,
  projectStatus,
  sectionNameFor,
  sortProjects,
  sortTasks,
  toTaskSnapshot,
} from "./rules";
import type { AsanaProject, AsanaTask, ProjectSnapshot, TaskSnapshot } from "./types";

const PROJET = "111";
const AUTRE = "999";

const tache = (over: Partial<AsanaTask> = {}): AsanaTask => ({
  gid: "t1",
  name: "Maquette de la home",
  due_on: "2026-08-20",
  completed: false,
  assignee: { gid: "u1" },
  memberships: [{ project: { gid: PROJET }, section: { name: "🚧 En cours" } }],
  ...over,
});

const snap = (over: Partial<TaskSnapshot> = {}): TaskSnapshot => ({
  gid: "t",
  name: "T",
  due_on: "2026-08-20",
  status: "todo",
  ...over,
});

const projet = (over: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  gid: "p",
  name: "P",
  description: "",
  due_on: null,
  status: "in_progress",
  tasks: [],
  ...over,
});

describe("sectionNameFor", () => {
  // Critère 13 : une tâche multi-homée n'expose que sa section du projet client.
  it("retient la membership du projet courant", () => {
    const t = tache({
      memberships: [
        { project: { gid: AUTRE }, section: { name: "🔥 Urgent interne" } },
        { project: { gid: PROJET }, section: { name: "☝️ Pour validation" } },
      ],
    });
    expect(sectionNameFor(t, PROJET)).toBe("☝️ Pour validation");
  });

  it("renvoie null quand aucune membership ne correspond", () => {
    expect(sectionNameFor(tache({ memberships: [] }), PROJET)).toBeNull();
    expect(sectionNameFor(tache({ memberships: undefined }), PROJET)).toBeNull();
  });
});

describe("toTaskSnapshot", () => {
  const log = () => {};

  it("convertit une tâche visible", () => {
    expect(toTaskSnapshot(tache(), PROJET, log)).toEqual({
      gid: "t1",
      name: "Maquette de la home",
      due_on: "2026-08-20",
      status: "in_progress",
    });
  });

  // Critère 3 : cocher sans déplacer de colonne suffit.
  it("donne done à une tâche cochée, quelle que soit sa colonne", () => {
    const t = tache({ completed: true });
    expect(toTaskSnapshot(t, PROJET, log)?.status).toBe("done");
  });

  // Critère 16.
  it("écarte une tâche sans assigné ou sans deadline", () => {
    expect(toTaskSnapshot(tache({ assignee: null }), PROJET, log)).toBeNull();
    expect(toTaskSnapshot(tache({ due_on: null }), PROJET, log)).toBeNull();
    expect(toTaskSnapshot(tache({ due_on: "" }), PROJET, log)).toBeNull();
  });

  // Critère 15 : même assignée et datée, une tâche d'Inbox n'existe pas.
  it("écarte une tâche de la colonne Inbox", () => {
    const t = tache({ memberships: [{ project: { gid: PROJET }, section: { name: "📥 Inbox" } }] });
    expect(toTaskSnapshot(t, PROJET, log)).toBeNull();
  });

  // Critère 17.
  it("écarte une tâche dont le nom commence par un point", () => {
    expect(toTaskSnapshot(tache({ name: " .relancer l'hébergeur" }), PROJET, log)).toBeNull();
  });

  it("écarte une tâche sans membership sur le projet courant, avec un warning", () => {
    const log = vi.fn();
    expect(toTaskSnapshot(tache({ memberships: [] }), PROJET, log)).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it("retombe sur in_progress et loggue pour une section inconnue", () => {
    const log = vi.fn();
    const t = tache({ memberships: [{ project: { gid: PROJET }, section: { name: "🤷 Divers" } }] });
    expect(toTaskSnapshot(t, PROJET, log)?.status).toBe("in_progress");
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("isVisibleProject", () => {
  const p = (over: Partial<AsanaProject> = {}): AsanaProject => ({ gid: "p", name: "Site web", ...over });

  it("accepte un projet ordinaire", () => {
    expect(isVisibleProject(p())).toBe(true);
  });

  // Corrections §5 : un projet archivé disparaît du portail au sync suivant.
  it("écarte un projet archivé", () => {
    expect(isVisibleProject(p({ archived: true }))).toBe(false);
  });

  it("écarte un projet dont le nom commence par un point", () => {
    expect(isVisibleProject(p({ name: ".interne" }))).toBe(false);
  });
});

describe("projectStatus", () => {
  const p = (over: Partial<AsanaProject> = {}): AsanaProject => ({ gid: "p", name: "Site web", ...over });

  it("done si le projet est marqué terminé dans Asana", () => {
    expect(projectStatus(p({ completed: true }), [snap({ status: "todo" })])).toBe("done");
  });

  // Critère 9 : le bug de vacuité de la règle d'origine.
  it("in_progress quand tout est fait mais le projet non clôturé", () => {
    expect(projectStatus(p(), [snap({ status: "done" }), snap({ status: "done" })])).toBe("in_progress");
  });

  // Critère 10.
  it("in_progress sur un projet sans aucune tâche", () => {
    expect(projectStatus(p(), [])).toBe("in_progress");
  });

  it("ready quand toutes les tâches restantes sont en todo", () => {
    expect(projectStatus(p(), [snap({ status: "todo" }), snap({ status: "done" })])).toBe("ready");
  });

  it("in_progress dès qu'une tâche restante a bougé", () => {
    expect(projectStatus(p(), [snap({ status: "todo" }), snap({ status: "to_validate" })])).toBe("in_progress");
  });
});

describe("sortTasks", () => {
  // Critère 18 : Backlog et Sprint fusionnés, dans l'ordre du board.
  it("groupe par colonne et préserve l'ordre du board dans chaque groupe", () => {
    const entree = [
      snap({ gid: "a", status: "done" }),
      snap({ gid: "b", status: "todo" }),
      snap({ gid: "c", status: "to_validate" }),
      snap({ gid: "d", status: "todo" }),
      snap({ gid: "e", status: "in_progress" }),
    ];
    expect(sortTasks(entree).map((t) => t.gid)).toEqual(["b", "d", "e", "c", "a"]);
  });
});

describe("sortProjects", () => {
  it("place les non terminés d'abord, par deadline croissante, null en dernier", () => {
    const entree = [
      projet({ gid: "fini", status: "done", due_on: "2026-01-01" }),
      projet({ gid: "sans-date", due_on: null }),
      projet({ gid: "tard", due_on: "2026-12-01" }),
      projet({ gid: "tot", due_on: "2026-09-01" }),
    ];
    expect(sortProjects(entree).map((p) => p.gid)).toEqual(["tot", "tard", "sans-date", "fini"]);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/rules.test.ts`
Expected: FAIL — `Failed to resolve import "./rules"`.

- [ ] **Step 3: Écrire les règles**

Créer `src/lib/portail/asana/rules.ts` :

```ts
// Règles métier du module Projets. Tout est pur : aucune dépendance au réseau,
// à KV ou à Astro. C'est ce qui rend les critères d'acceptation 3, 9, 10, 13,
// 15, 16, 17 et 18 testables directement.

import { COLUMN_ORDER, isHiddenName, mapSection } from "./sections";
import type {
  AsanaProject,
  AsanaTask,
  LogFn,
  ProjectSnapshot,
  ProjectStatus,
  TaskSnapshot,
} from "./types";

/**
 * Nom de la section de la tâche DANS LE PROJET COURANT.
 *
 * Une tâche peut être multi-homée : présente à la fois dans le board client et
 * dans un board interne. Prendre `memberships[0]` exposerait au client le nom
 * d'une colonne interne. On retient donc la membership dont le projet
 * correspond, ce qui règle d'un coup le filtrage réclamé par corrections §2.
 */
export function sectionNameFor(task: AsanaTask, projectGid: string): string | null {
  const m = (task.memberships ?? []).find((m) => m.project?.gid === projectGid);
  return m?.section?.name ?? null;
}

/**
 * Convertit une tâche Asana en entrée de snapshot, ou `null` si elle ne doit
 * pas être exposée. Quatre motifs d'exclusion, dans cet ordre :
 *
 * 1. nom préfixé « . » (§6) — chore interne qui a besoin d'un assigné et d'une
 *    deadline dans Asana sans être montrée au client ;
 * 2. pas d'assigné ou pas de deadline (§6) — les items de backlog non dégrossis
 *    ne remontent jamais ;
 * 3. aucune membership sur le projet courant — anomalie, loggée ;
 * 4. colonne Inbox (§6) — du brouillon, jamais montré.
 *
 * `completed === true` l'emporte sur la colonne (brief §5) : cocher une tâche
 * sans la déplacer suffit à l'afficher « Terminé » (critère 3).
 */
export function toTaskSnapshot(
  task: AsanaTask,
  projectGid: string,
  log: LogFn,
): TaskSnapshot | null {
  if (isHiddenName(task.name)) return null;
  if (!task.assignee?.gid) return null;
  if (!task.due_on) return null;

  const sectionName = sectionNameFor(task, projectGid);
  if (sectionName === null) {
    log({ event: "portal_sync_warning", reason: "task_without_membership", task: task.gid, project: projectGid });
    return null;
  }

  const mapping = mapSection(sectionName);
  if (mapping.kind === "excluded") return null;

  if (mapping.kind === "unknown") {
    log({ event: "portal_sync_warning", reason: "unknown_section", section: sectionName, project: projectGid });
  }

  // Section inconnue → in_progress par défaut, jamais une erreur (brief §5).
  const fromSection = mapping.kind === "status" ? mapping.status : "in_progress";

  return {
    gid: task.gid,
    name: task.name.trim(),
    due_on: task.due_on,
    status: task.completed === true ? "done" : fromSection,
  };
}

/** Un projet archivé ou préfixé « . » ne rentre pas dans le snapshot. */
export function isVisibleProject(project: AsanaProject): boolean {
  return project.archived !== true && !isHiddenName(project.name);
}

/**
 * Statut d'un projet (corrections §1, qui corrige un bug de vacuité du brief).
 *
 * La règle d'origine — « si toutes les tâches non cochées sont en todo → ready »
 * — est vraie par vacuité quand il n'y a aucune tâche non cochée. Elle affichait
 * « Prêt à démarrer » sur un projet entièrement fait, et sur un projet vide.
 * D'où la clause explicite : `restantes` vide → in_progress. On n'annonce jamais
 * « Prêt à démarrer » sur un projet dont on ne peut rien déduire.
 */
export function projectStatus(project: AsanaProject, tasks: TaskSnapshot[]): ProjectStatus {
  if (project.completed === true) return "done";
  const restantes = tasks.filter((t) => t.status !== "done");
  if (restantes.length === 0) return "in_progress";
  return restantes.every((t) => t.status === "todo") ? "ready" : "in_progress";
}

/**
 * Groupe par colonne dans l'ordre d'affichage, en préservant l'ordre du board
 * à l'intérieur de chaque groupe.
 *
 * On groupe par STATUT et non par section : une tâche cochée dans « En cours »
 * a le statut done, elle doit donc apparaître sous « Terminé ». Un tri par
 * comparateur sur l'index de colonne fonctionnerait aussi (Array.sort est
 * stable depuis ES2019), mais le partitionnement dit l'intention sans dépendre
 * de cette garantie.
 */
export function sortTasks(tasks: TaskSnapshot[]): TaskSnapshot[] {
  return COLUMN_ORDER.flatMap((status) => tasks.filter((t) => t.status === status));
}

/**
 * Non terminés d'abord, par `due_on` croissant avec les sans-date en dernier ;
 * les terminés ensuite, selon la même règle (brief §6). Les dates Asana sont
 * en `YYYY-MM-DD` : l'ordre lexicographique est l'ordre chronologique, pas
 * besoin de construire des Date.
 */
export function sortProjects(projects: ProjectSnapshot[]): ProjectSnapshot[] {
  const rang = (p: ProjectSnapshot) => (p.status === "done" ? 1 : 0);
  return [...projects].sort((a, b) => {
    if (rang(a) !== rang(b)) return rang(a) - rang(b);
    if (a.due_on === b.due_on) return 0;
    if (a.due_on === null) return 1;
    if (b.due_on === null) return -1;
    return a.due_on < b.due_on ? -1 : 1;
  });
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/rules.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Vérifier la non-régression**

Run: `npx vitest run && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: seuls les deux échecs connus.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portail/asana/rules.ts src/lib/portail/asana/rules.test.ts
git commit -m "feat(portail): règles de visibilité, de statut et de tri du module Projets"
```

---

## Task 3 : Description publique, assemblage et hachage du snapshot

**Files:**
- Create: `src/lib/portail/asana/snapshot.ts`
- Test: `src/lib/portail/asana/snapshot.test.ts`

**Interfaces:**
- Consomme : les types de `./types` ; `isVisibleProject`, `projectStatus`, `sortProjects`, `sortTasks`, `toTaskSnapshot` (`./rules`).
- Produit :
  - `publicDescription(notes: string | null | undefined): string`
  - `interface ProjectInput { project: AsanaProject; tasks: AsanaTask[] }`
  - `buildTeamSnapshot(teamGid: string, inputs: ProjectInput[], log: LogFn): TeamSnapshotBody`
  - `stableStringify(value: unknown): string`
  - `hashSnapshot(body: TeamSnapshotBody): Promise<string>` — SHA-256 hexadécimal, 64 caractères.

- [ ] **Step 1: Écrire le test (il doit échouer)**

Créer `src/lib/portail/asana/snapshot.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildTeamSnapshot, hashSnapshot, publicDescription, stableStringify } from "./snapshot";
import type { AsanaProject, AsanaTask, TeamSnapshotBody } from "./types";

const log = () => {};

const tache = (over: Partial<AsanaTask> = {}): AsanaTask => ({
  gid: "t1",
  name: "Tâche",
  due_on: "2026-08-20",
  completed: false,
  assignee: { gid: "u1" },
  memberships: [{ project: { gid: "p1" }, section: { name: "🧱 Backlog" } }],
  ...over,
});

const projet = (over: Partial<AsanaProject> = {}): AsanaProject => ({
  gid: "p1",
  name: "Site web Coolbeans",
  notes: "",
  due_on: "2026-09-30",
  completed: false,
  archived: false,
  ...over,
});

describe("publicDescription", () => {
  it("n'expose que ce qui précède le premier séparateur ---", () => {
    const notes = "Refonte du site vitrine.\n\n---\nstaging : https://staging.example\nPAT : xxx";
    expect(publicDescription(notes)).toBe("Refonte du site vitrine.");
  });

  it("renvoie une chaîne vide si le séparateur est en tête", () => {
    expect(publicDescription("---\nnotes internes")).toBe("");
  });

  // Cas réel : les notes de « 🎭 Refonte site » (Amusoire) au 2026-08-12. Le
  // `---` y précède une note de bas de page, pas une frontière public/privé —
  // toute la pile de liens internes est donc AVANT lui. D'où le plafond de 300
  // caractères appliqué aussi à cette branche : exposer strictement moins que
  // la règle de corrections §4 ne la contredit pas.
  it("plafonne aussi la portion qui précède le séparateur", () => {
    const notes = [
      "Leur cahier des charges :",
      "https://docs.google.com/document/d/11h_FusxhmsITyl620BX071jDzZcKD8A1JzPyWOfck2Q/edit?tab=t.0#heading=h.th2qsktzbmjs",
      "",
      "Notre Drive :",
      "https://drive.google.com/drive/u/1/folders/1MRCQQoGzl4GNFgHXqYP9-IiPrQlFd61I",
      "",
      "Checklist Webflow Finsweet Starter :",
      "https://docs.google.com/document/d/1bfgcLjpivvfwcXr1KB7hFW6Il8UnKwAwDIZ9I9FCcSo/edit?tab=t.0",
      "---",
      "Tâche d'origine (👨‍💼 projects) : https://app.asana.com/…",
    ].join("\n");

    const out = publicDescription(notes);
    expect(out).toHaveLength(301);
    expect(out.endsWith("…")).toBe(true);
    // La note de bas de page ne franchit jamais la frontière.
    expect(out).not.toContain("Tâche d'origine");
  });

  // Sans séparateur, on n'expose que la première ligne non vide : le reste
  // d'un champ de travail interne n'a aucune raison d'atterrir chez le client.
  it("sans séparateur, ne garde que la première ligne non vide", () => {
    expect(publicDescription("\n\nRefonte du site.\nRDV hebdo le mardi.")).toBe("Refonte du site.");
  });

  it("tronque à 300 caractères et signale la coupe", () => {
    const out = publicDescription("a".repeat(400));
    expect(out).toHaveLength(301);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 300)).toBe("a".repeat(300));
  });

  it("ne tronque pas une ligne d'exactement 300 caractères", () => {
    expect(publicDescription("b".repeat(300))).toBe("b".repeat(300));
  });

  it("tolère l'absence de notes", () => {
    expect(publicDescription(null)).toBe("");
    expect(publicDescription(undefined)).toBe("");
    expect(publicDescription("   ")).toBe("");
  });
});

describe("buildTeamSnapshot", () => {
  it("assemble un snapshot versionné, sans synced_at", () => {
    const body = buildTeamSnapshot("T1", [{ project: projet(), tasks: [tache()] }], log);
    expect(body).toEqual({
      schema_version: 1,
      team_gid: "T1",
      projects: [
        {
          gid: "p1",
          name: "Site web Coolbeans",
          description: "",
          due_on: "2026-09-30",
          status: "ready",
          tasks: [{ gid: "t1", name: "Tâche", due_on: "2026-08-20", status: "todo" }],
        },
      ],
    });
    expect(body).not.toHaveProperty("synced_at");
  });

  it("écarte les projets archivés et les projets préfixés d'un point", () => {
    const body = buildTeamSnapshot(
      "T1",
      [
        { project: projet({ gid: "a", archived: true }), tasks: [] },
        { project: projet({ gid: "b", name: ".interne" }), tasks: [] },
        { project: projet({ gid: "c" }), tasks: [] },
      ],
      log,
    );
    expect(body.projects.map((p) => p.gid)).toEqual(["c"]);
  });

  it("normalise due_on absent en null", () => {
    const body = buildTeamSnapshot("T1", [{ project: projet({ due_on: undefined }), tasks: [] }], log);
    expect(body.projects[0].due_on).toBeNull();
  });
});

describe("stableStringify", () => {
  it("produit la même chaîne quel que soit l'ordre des clés", () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
  });

  it("préserve l'ordre des tableaux", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("hashSnapshot", () => {
  const body = (over: Partial<TeamSnapshotBody> = {}): TeamSnapshotBody => ({
    schema_version: 1,
    team_gid: "T1",
    projects: [],
    ...over,
  });

  it("renvoie un SHA-256 hexadécimal de 64 caractères", async () => {
    expect(await hashSnapshot(body())).toMatch(/^[0-9a-f]{64}$/);
  });

  // Critère 11 : deux passages sans changement ne doivent produire aucune écriture.
  it("est stable d'un appel à l'autre pour un contenu identique", async () => {
    expect(await hashSnapshot(body())).toBe(await hashSnapshot(body()));
  });

  it("change dès que le contenu change", async () => {
    const a = await hashSnapshot(body());
    const b = await hashSnapshot(body({ team_gid: "T2" }));
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/snapshot.test.ts`
Expected: FAIL — `Failed to resolve import "./snapshot"`.

- [ ] **Step 3: Écrire le module**

Créer `src/lib/portail/asana/snapshot.ts` :

```ts
// Assemblage du snapshot d'une team, et son empreinte.
//
// Le snapshot est un MIROIR, pas un outil : il ne contient que ce que le
// client doit voir. Le brief §5 interdit explicitement d'y faire entrer les
// assignees, les commentaires, les custom fields et les memberships d'autres
// projets — `assignee` sert de filtre de visibilité et s'arrête là.

import { isVisibleProject, projectStatus, sortProjects, sortTasks, toTaskSnapshot } from "./rules";
import type {
  AsanaProject,
  AsanaTask,
  LogFn,
  ProjectSnapshot,
  TeamSnapshotBody,
} from "./types";

const LIMITE_DESCRIPTION = 300;

/**
 * Corrections §4, option A (le défaut).
 *
 * La description d'un projet Asana est un champ de TRAVAIL : notes de chantier,
 * identifiants de staging, commentaires sur le client. L'exposer brut est une
 * fuite par inadvertance, pas un risque théorique. Deux régimes :
 *
 * - avec un séparateur (une ligne valant exactement `---`) : seule la portion
 *   qui le précède est publique, tout ce qui suit est interne et n'entre jamais
 *   dans le snapshot ;
 * - sans séparateur : seule la première ligne non vide.
 *
 * ÉCART ASSUMÉ À §4 : le plafond de 300 caractères s'applique aux DEUX
 * branches, alors que la spec ne le prévoit que pour la seconde. Motif constaté
 * sur les données réelles : dans les boards existants, `---` sert de simple
 * séparateur visuel avant une note de bas de page, et non de frontière
 * public/privé — la portion « publique » de « 🎭 Refonte site » est ainsi une
 * pile de liens Google Docs et Drive internes. Exposer strictement moins que la
 * règle ne contredit pas une règle de confidentialité.
 *
 * La valeur n'est jamais injectée en HTML brut côté rendu : Astro échappe les
 * expressions `{}` par défaut, et aucun `set:html` ne doit apparaître.
 */
export function publicDescription(notes: string | null | undefined): string {
  if (!notes) return "";
  const lignes = notes.split(/\r?\n/);
  const iSep = lignes.findIndex((l) => l.trim() === "---");

  const publique =
    iSep !== -1
      ? lignes.slice(0, iSep).join("\n").trim()
      : (lignes.map((l) => l.trim()).find((l) => l !== "") ?? "");

  return publique.length > LIMITE_DESCRIPTION
    ? `${publique.slice(0, LIMITE_DESCRIPTION)}…`
    : publique;
}

export interface ProjectInput {
  project: AsanaProject;
  /** Toutes les tâches du projet, dans l'ordre du board. Ne pas re-trier. */
  tasks: AsanaTask[];
}

/**
 * Construit le corps du snapshot — SANS `synced_at`. C'est cette forme-là qui
 * est hachée (corrections §3) ; l'horodatage est ajouté au moment de l'écriture
 * KV, et seulement quand il y a vraiment eu changement.
 */
export function buildTeamSnapshot(
  teamGid: string,
  inputs: ProjectInput[],
  log: LogFn,
): TeamSnapshotBody {
  const projects: ProjectSnapshot[] = [];

  for (const { project, tasks } of inputs) {
    if (!isVisibleProject(project)) continue;

    const visibles = tasks
      .map((t) => toTaskSnapshot(t, project.gid, log))
      .filter((t): t is NonNullable<typeof t> => t !== null);

    projects.push({
      gid: project.gid,
      name: project.name.trim(),
      description: publicDescription(project.notes),
      due_on: project.due_on ?? null,
      status: projectStatus(project, visibles),
      tasks: sortTasks(visibles),
    });
  }

  return { schema_version: 1, team_gid: teamGid, projects: sortProjects(projects) };
}

/**
 * JSON à ordre de clés déterministe. Le builder ci-dessus produit déjà toujours
 * le même ordre, mais un simple réordonnancement de champ dans le code ferait
 * alors bouger tous les hachages d'un coup. Trier ici rend l'empreinte
 * dépendante du seul contenu — huit lignes contre une classe de faux positifs.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 hexadécimal. `crypto.subtle` est disponible dans les Workers et sous Node ≥ 19. */
export async function hashSnapshot(body: TeamSnapshotBody): Promise<string> {
  const octets = new TextEncoder().encode(stableStringify(body));
  const digest = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/snapshot.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Vérifier la non-régression**

Run: `npx vitest run && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: seuls les deux échecs connus.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portail/asana/snapshot.ts src/lib/portail/asana/snapshot.test.ts
git commit -m "feat(portail): construction et hachage du snapshot d'une team"
```

---

## Task 4 : Client HTTP Asana — pagination et backoff 429

**Files:**
- Create: `src/lib/portail/asana/asana-client.ts`
- Test: `src/lib/portail/asana/asana-client.test.ts`

**Interfaces:**
- Consomme : `AsanaProject`, `AsanaTask` (`./types`).
- Produit :
  - `interface AsanaClientOptions { token: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxRetries?: number; maxPages?: number }`
  - `interface AsanaClient { listProjects(teamGid: string): Promise<AsanaProject[]>; listTasks(projectGid: string): Promise<AsanaTask[]>; readonly stats: { requests: number } }`
  - `createAsanaClient(options: AsanaClientOptions): AsanaClient`
  - `PROJECT_FIELDS: string`, `TASK_FIELDS: string`

- [ ] **Step 1: Écrire le test (il doit échouer)**

Créer `src/lib/portail/asana/asana-client.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { createAsanaClient } from "./asana-client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const client = (fetchImpl: typeof fetch, over = {}) =>
  createAsanaClient({ token: "PAT", fetchImpl, sleep: async () => {}, ...over });

describe("createAsanaClient", () => {
  it("envoie le PAT en Bearer et jamais en query", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [] })) as unknown as typeof fetch;
    await client(fetchImpl).listProjects("T1");

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("PAT");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer PAT" });
  });

  it("demande les opt_fields de corrections §2 et §6 en une seule requête par projet", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [] })) as unknown as typeof fetch;
    await client(fetchImpl).listTasks("p1");

    const url = new URL(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.pathname).toBe("/api/1.0/tasks");
    expect(url.searchParams.get("project")).toBe("p1");
    expect(url.searchParams.get("limit")).toBe("100");
    const champs = (url.searchParams.get("opt_fields") ?? "").split(",");
    for (const c of [
      "name", "due_on", "completed", "assignee",
      "memberships.project.gid", "memberships.section.name",
    ]) {
      expect(champs).toContain(c);
    }
  });

  // Critère 12 : un projet de plus de 100 tâches est intégralement synchronisé.
  it("suit la pagination next_page.offset", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const offset = new URL(String(input)).searchParams.get("offset");
      return offset === null
        ? json({ data: [{ gid: "1", name: "a" }], next_page: { offset: "SUITE" } })
        : json({ data: [{ gid: "2", name: "b" }], next_page: null });
    }) as unknown as typeof fetch;

    const taches = await client(fetchImpl).listTasks("p1");
    expect(taches.map((t) => t.gid)).toEqual(["1", "2"]);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("s'arrête au plafond de pages plutôt que de boucler à l'infini", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ data: [{ gid: "x", name: "x" }], next_page: { offset: "TOUJOURS" } }),
    ) as unknown as typeof fetch;

    await expect(client(fetchImpl, { maxPages: 3 }).listTasks("p1")).rejects.toThrow(/pagination/i);
  });

  // Un 429 consomme du quota : retenter sans respecter Retry-After creuse le trou.
  it("retente après un 429 en respectant Retry-After", async () => {
    const sleep = vi.fn(async () => {});
    let appel = 0;
    const fetchImpl = vi.fn(async () => {
      appel += 1;
      return appel === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "7" } })
        : json({ data: [{ gid: "1", name: "a" }] });
    }) as unknown as typeof fetch;

    const c = createAsanaClient({ token: "PAT", fetchImpl, sleep });
    expect(await c.listProjects("T1")).toHaveLength(1);
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("retombe sur un backoff exponentiel sans Retry-After exploitable", async () => {
    const sleep = vi.fn(async () => {});
    let appel = 0;
    const fetchImpl = vi.fn(async () => {
      appel += 1;
      return appel <= 2 ? new Response("", { status: 429 }) : json({ data: [] });
    }) as unknown as typeof fetch;

    await createAsanaClient({ token: "PAT", fetchImpl, sleep }).listProjects("T1");
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
  });

  it("abandonne après maxRetries et remonte l'erreur", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    await expect(client(fetchImpl, { maxRetries: 2 }).listProjects("T1")).rejects.toThrow(/429/);
  });

  it("remonte une erreur explicite sur 4xx non 429", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(client(fetchImpl).listProjects("T404")).rejects.toThrow(/404/);
  });

  it("compte toutes les requêtes émises, retentatives comprises", async () => {
    let appel = 0;
    const fetchImpl = vi.fn(async () => {
      appel += 1;
      return appel === 1 ? new Response("", { status: 429 }) : json({ data: [] });
    }) as unknown as typeof fetch;

    const c = createAsanaClient({ token: "PAT", fetchImpl, sleep: async () => {} });
    await c.listProjects("T1");
    expect(c.stats.requests).toBe(2);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/asana-client.test.ts`
Expected: FAIL — `Failed to resolve import "./asana-client"`.

- [ ] **Step 3: Écrire le client**

Créer `src/lib/portail/asana/asana-client.ts` :

```ts
// Accès HTTP à l'API Asana. `fetch` et `sleep` sont injectés : c'est ce qui
// rend la pagination et le backoff testables sans réseau.
//
// Une seule requête par projet (corrections §2), pas une par section : le brief
// d'origine en faisait cinq, soit plusieurs centaines par passage à vingt
// clients, pour un résultat identique. Le filtrage des tâches multi-homées se
// fait ensuite en mémoire sur `memberships`.

import type { AsanaProject, AsanaTask } from "./types";

const BASE = "https://app.asana.com/api/1.0";

export const PROJECT_FIELDS = "name,notes,due_on,completed,archived";

/**
 * `assignee` sert de FILTRE (§6 : assigné + deadline obligatoires) et n'entre
 * jamais dans le snapshot — le brief §5 interdit d'y exposer les assignees.
 */
export const TASK_FIELDS =
  "name,due_on,completed,assignee,memberships.project.gid,memberships.section.name";

export interface AsanaClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Retentatives sur 429. Défaut 3. */
  maxRetries?: number;
  /** Garde-fou anti-boucle sur la pagination. Défaut 20, soit 2 000 éléments. */
  maxPages?: number;
}

export interface AsanaClient {
  listProjects(teamGid: string): Promise<AsanaProject[]>;
  listTasks(projectGid: string): Promise<AsanaTask[]>;
  /** Requêtes réellement émises, retentatives comprises. Alimente meta:last_sync. */
  readonly stats: { requests: number };
}

interface Page<T> {
  data?: T[];
  next_page?: { offset?: string } | null;
}

const attenteParDefaut = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createAsanaClient(options: AsanaClientOptions): AsanaClient {
  const {
    token,
    fetchImpl = fetch,
    sleep = attenteParDefaut,
    maxRetries = 3,
    maxPages = 20,
  } = options;

  const stats = { requests: 0 };

  async function requete(url: string): Promise<Response> {
    for (let essai = 0; ; essai++) {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      stats.requests += 1;

      if (res.status !== 429) return res;
      if (essai >= maxRetries) return res;

      // Un 429 consomme du quota : retenter sans respecter Retry-After
      // aggrave la situation au lieu de la résoudre. Sans en-tête exploitable,
      // backoff exponentiel — jamais de retentative immédiate.
      const entete = Number(res.headers.get("Retry-After"));
      const ms = Number.isFinite(entete) && entete > 0 ? entete * 1000 : 2 ** essai * 1000;
      await sleep(ms);
    }
  }

  async function getAll<T>(chemin: string, params: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let offset: string | undefined;
    let page = 0;

    do {
      if (page >= maxPages) {
        throw new Error(`Asana : pagination anormalement longue sur ${chemin} (${maxPages} pages)`);
      }
      const url = new URL(BASE + chemin);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      url.searchParams.set("limit", "100");
      if (offset) url.searchParams.set("offset", offset);

      const res = await requete(url.toString());
      if (!res.ok) {
        // Le corps peut contenir des détails, mais aussi être vide ou du HTML :
        // on ne met que le statut dans le message, jamais le token ni l'URL
        // complète (elle est sans secret, mais autant garder les logs sobres).
        throw new Error(`Asana ${res.status} sur ${chemin}`);
      }

      const body = (await res.json()) as Page<T>;
      out.push(...(body.data ?? []));
      offset = body.next_page?.offset;
      page += 1;
    } while (offset);

    return out;
  }

  return {
    stats,
    listProjects: (teamGid) =>
      getAll<AsanaProject>(`/teams/${teamGid}/projects`, { opt_fields: PROJECT_FIELDS }),
    listTasks: (projectGid) =>
      getAll<AsanaTask>("/tasks", { project: projectGid, opt_fields: TASK_FIELDS }),
  };
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/asana-client.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Vérifier la non-régression**

Run: `npx vitest run && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: seuls les deux échecs connus.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portail/asana/asana-client.ts src/lib/portail/asana/asana-client.test.ts
git commit -m "feat(portail): client Asana avec pagination et backoff sur 429"
```

---

## Task 5 : Couche KV — écriture conditionnelle au hash

**Files:**
- Create: `src/lib/portail/asana/kv.ts`
- Test: `src/lib/portail/asana/kv.test.ts`

**Interfaces:**
- Consomme : `TeamSnapshot`, `TeamSnapshotBody`, `SyncReport` (`./types`) ; `hashSnapshot` (`./snapshot`).
- Produit :
  - `interface SnapshotMetadata { hash: string; synced_at: string }`
  - `interface PortalKV { get(key: string): Promise<string | null>; getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>; put(key: string, value: string, options?: { metadata?: unknown }): Promise<void> }`
  - `teamKey(gid: string): string`
  - `LAST_SYNC_KEY: "meta:last_sync"`
  - `writeSnapshotIfChanged(kv: PortalKV, body: TeamSnapshotBody, now: string): Promise<{ written: boolean; hash: string }>`
  - `readTeamSnapshot(kv: PortalKV, gid: string): Promise<TeamSnapshot | null>`
  - `writeSyncReport(kv: PortalKV, report: SyncReport): Promise<void>`
  - `portalKv(): PortalKV` — le binding réel, via `cloudflare:workers`.

- [ ] **Step 1: Écrire le test (il doit échouer)**

Créer `src/lib/portail/asana/kv.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Même stub que src/lib/chiffrage/store.test.ts : `cloudflare:workers` est un
// module virtuel du runtime, non résolvable sous Vitest. Jamais utilisé ici,
// puisque le binding est passé explicitement.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  LAST_SYNC_KEY,
  readTeamSnapshot,
  teamKey,
  writeSnapshotIfChanged,
  writeSyncReport,
  type PortalKV,
} from "./kv";
import type { SyncReport, TeamSnapshotBody } from "./types";

interface Entree {
  value: string;
  metadata: unknown;
}

const memoire = () => {
  const data = new Map<string, Entree>();
  const puts: string[] = [];
  const kv: PortalKV = {
    get: async (k) => data.get(k)?.value ?? null,
    getWithMetadata: async <M>(k: string) => {
      const e = data.get(k);
      return { value: e?.value ?? null, metadata: (e?.metadata ?? null) as M | null };
    },
    put: async (k, v, o) => {
      puts.push(k);
      data.set(k, { value: v, metadata: o?.metadata ?? null });
    },
  };
  return { kv, data, puts };
};

const body = (over: Partial<TeamSnapshotBody> = {}): TeamSnapshotBody => ({
  schema_version: 1,
  team_gid: "T1",
  projects: [],
  ...over,
});

let m: ReturnType<typeof memoire>;
beforeEach(() => {
  m = memoire();
});

describe("teamKey", () => {
  it("préfixe par team:", () => {
    expect(teamKey("T1")).toBe("team:T1");
  });
});

describe("writeSnapshotIfChanged", () => {
  it("écrit le snapshot horodaté au premier passage", async () => {
    const r = await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    expect(r.written).toBe(true);
    expect(JSON.parse(m.data.get("team:T1")!.value)).toEqual({
      schema_version: 1,
      team_gid: "T1",
      projects: [],
      synced_at: "2026-08-12T10:00:00.000Z",
    });
    expect(m.data.get("team:T1")!.metadata).toEqual({
      hash: r.hash,
      synced_at: "2026-08-12T10:00:00.000Z",
    });
  });

  // Critère 11 : deux exécutions sans changement, aucune écriture sur team:{gid}.
  it("n'écrit rien quand le contenu n'a pas changé", async () => {
    await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    const r = await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:05:00.000Z");

    expect(r.written).toBe(false);
    expect(m.puts).toEqual(["team:T1"]);
    // Et surtout : synced_at n'a pas bougé. C'est la raison d'être de la règle —
    // « Dernière mise à jour » doit dater du dernier CHANGEMENT, pas de la
    // dernière vérification. À 5 minutes, un horodatage qui bougerait douze
    // fois par heure sans que rien n'ait changé serait un mensonge visible.
    expect(JSON.parse(m.data.get("team:T1")!.value).synced_at).toBe("2026-08-12T10:00:00.000Z");
  });

  it("réécrit dès que le contenu change", async () => {
    await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    const r = await writeSnapshotIfChanged(
      m.kv,
      body({ projects: [{ gid: "p", name: "P", description: "", due_on: null, status: "in_progress", tasks: [] }] }),
      "2026-08-12T10:05:00.000Z",
    );

    expect(r.written).toBe(true);
    expect(JSON.parse(m.data.get("team:T1")!.value).synced_at).toBe("2026-08-12T10:05:00.000Z");
  });

  it("réécrit si la métadonnée de hash est absente ou malformée", async () => {
    await m.kv.put("team:T1", "{}", { metadata: { autre: 1 } });
    expect((await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z")).written).toBe(true);
  });
});

describe("readTeamSnapshot", () => {
  it("relit ce qui a été écrit", async () => {
    await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    expect((await readTeamSnapshot(m.kv, "T1"))?.synced_at).toBe("2026-08-12T10:00:00.000Z");
  });

  it("renvoie null quand la clé n'existe pas", async () => {
    expect(await readTeamSnapshot(m.kv, "INCONNUE")).toBeNull();
  });

  // Une valeur illisible ne doit pas rendre une 500 : le portail affiche
  // l'empty state « synchronisation en cours ».
  it("renvoie null sur un JSON corrompu au lieu de lever", async () => {
    await m.kv.put("team:T1", "{ pas du json");
    expect(await readTeamSnapshot(m.kv, "T1")).toBeNull();
  });
});

describe("writeSyncReport", () => {
  it("écrit sous meta:last_sync à chaque passage", async () => {
    const rapport: SyncReport = {
      at: "2026-08-12T10:00:00.000Z",
      teams: 2, teams_ok: 2, teams_failed: 0,
      projects: 3, tasks: 12, snapshots_written: 1,
      asana_requests: 8, subrequests: 13, duration_ms: 900, errors: [],
    };
    await writeSyncReport(m.kv, rapport);
    expect(JSON.parse(m.data.get(LAST_SYNC_KEY)!.value)).toEqual(rapport);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/kv.test.ts`
Expected: FAIL — `Failed to resolve import "./kv"`.

- [ ] **Step 3: Écrire la couche KV**

Créer `src/lib/portail/asana/kv.ts` :

```ts
// Accès KV du module Projets.
//
// Le binding est TOUJOURS passé en argument : c'est ce qui permet de le
// remplacer par une Map en test, et de partager le même code entre le handler
// scheduled (qui reçoit `env`) et les pages Astro. `portalKv()` n'est qu'une
// commodité pour les appelants qui n'ont pas d'`env` sous la main.

import { env } from "cloudflare:workers";
import { hashSnapshot } from "./snapshot";
import type { SyncReport, TeamSnapshot, TeamSnapshotBody } from "./types";

/** Typage structurel du binding : pas de dépendance à @cloudflare/workers-types. */
export interface PortalKV {
  get(key: string): Promise<string | null>;
  getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>;
  put(key: string, value: string, options?: { metadata?: unknown }): Promise<void>;
}

export const portalKv = (): PortalKV => (env as unknown as { PORTAL_KV: PortalKV }).PORTAL_KV;

export const teamKey = (gid: string) => `team:${gid}`;

/** Résumé technique du sync. JAMAIS exposé au client (corrections §3). */
export const LAST_SYNC_KEY = "meta:last_sync";

export interface SnapshotMetadata {
  hash: string;
  synced_at: string;
}

/**
 * Écriture conditionnelle au hash du contenu (corrections §3).
 *
 * Ce n'est plus une question de quota depuis le passage au plan payant (1 M
 * d'écritures par mois incluses) : c'est ce qui fait de « Dernière mise à jour »
 * la date du dernier CHANGEMENT et non de la dernière vérification. Le hash
 * porte sur le corps SANS `synced_at`, sans quoi il différerait à chaque passage.
 *
 * Nuance sur la lecture : `getWithMetadata` rapatrie aussi la valeur et coûte
 * le même unique subrequest qu'un `get`. L'économie réelle est de ne pas
 * `JSON.parse` un snapshot inchangé, et surtout de ne pas écrire.
 */
export async function writeSnapshotIfChanged(
  kv: PortalKV,
  body: TeamSnapshotBody,
  now: string,
): Promise<{ written: boolean; hash: string }> {
  const hash = await hashSnapshot(body);
  const { metadata } = await kv.getWithMetadata<SnapshotMetadata>(teamKey(body.team_gid));

  if (metadata?.hash === hash) return { written: false, hash };

  const snapshot: TeamSnapshot = { ...body, synced_at: now };
  await kv.put(teamKey(body.team_gid), JSON.stringify(snapshot), {
    metadata: { hash, synced_at: now } satisfies SnapshotMetadata,
  });
  return { written: true, hash };
}

/**
 * Ne lève jamais : une clé absente ou une valeur illisible donne `null`, ce qui
 * mène à l'empty state « synchronisation en cours » plutôt qu'à une 500.
 */
export async function readTeamSnapshot(kv: PortalKV, gid: string): Promise<TeamSnapshot | null> {
  const raw = await kv.get(teamKey(gid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeamSnapshot;
  } catch {
    return null;
  }
}

/** Écrit à chaque passage : 288 écritures/jour, indépendantes du nombre de clients. */
export async function writeSyncReport(kv: PortalKV, report: SyncReport): Promise<void> {
  await kv.put(LAST_SYNC_KEY, JSON.stringify(report));
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/kv.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Vérifier la non-régression**

Run: `npx vitest run && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: seuls les deux échecs connus.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portail/asana/kv.ts src/lib/portail/asana/kv.test.ts
git commit -m "feat(portail): écritures KV conditionnelles au hash du snapshot"
```

---

## Task 6 : `syncTeam(gid)` et `syncTeams(gids)`

**Files:**
- Create: `src/lib/portail/asana/sync.ts`
- Test: `src/lib/portail/asana/sync.test.ts`

**Interfaces:**
- Consomme : `createAsanaClient` (`./asana-client`), `buildTeamSnapshot` (`./snapshot`), `writeSnapshotIfChanged`, `writeSyncReport`, `PortalKV` (`./kv`), types (`./types`).
- Produit :
  - `interface SyncDeps { kv: PortalKV; token: string; now?: () => Date; log?: LogFn; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }`
  - `interface TeamSyncResult { team_gid: string; ok: boolean; written: boolean; projects: number; tasks: number; asana_requests: number; subrequests: number; error?: string }`
  - `interface SyncTarget { team_gid: string; exclude_project_gids?: string[] }`
  - `syncTeam(teamGid: string, deps: SyncDeps, excludeProjectGids?: string[]): Promise<TeamSyncResult>` — le troisième paramètre est optionnel : `syncTeam(gid, deps)` reste l'unité de base telle qu'arbitrée.
  - `syncTeams(targets: SyncTarget[], deps: SyncDeps): Promise<SyncReport>`

- [ ] **Step 1: Écrire le test (il doit échouer)**

Créer `src/lib/portail/asana/sync.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import { LAST_SYNC_KEY, teamKey, type PortalKV } from "./kv";
import { syncTeam, syncTeams, type SyncDeps } from "./sync";

const memoire = () => {
  const data = new Map<string, { value: string; metadata: unknown }>();
  const puts: string[] = [];
  const kv: PortalKV = {
    get: async (k) => data.get(k)?.value ?? null,
    getWithMetadata: async <M>(k: string) => {
      const e = data.get(k);
      return { value: e?.value ?? null, metadata: (e?.metadata ?? null) as M | null };
    },
    put: async (k, v, o) => {
      puts.push(k);
      data.set(k, { value: v, metadata: o?.metadata ?? null });
    },
  };
  return { kv, data, puts };
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

/** Faux Asana : une team, un projet, une tâche visible. */
const asanaOk = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/projects")) {
      return json({
        data: [{ gid: "p1", name: "Site web", notes: "Refonte.\n---\nsecret", due_on: "2026-09-30", completed: false, archived: false }],
      });
    }
    return json({
      data: [
        {
          gid: "t1",
          name: "Maquette",
          due_on: "2026-08-20",
          completed: false,
          assignee: { gid: "u1" },
          memberships: [{ project: { gid: "p1" }, section: { name: "🧱 Backlog" } }],
        },
      ],
    });
  }) as unknown as typeof fetch;

let m: ReturnType<typeof memoire>;
let deps: SyncDeps;

beforeEach(() => {
  m = memoire();
  deps = {
    kv: m.kv,
    token: "PAT",
    now: () => new Date("2026-08-12T10:00:00.000Z"),
    log: () => {},
    sleep: async () => {},
    fetchImpl: asanaOk(),
  };
});

describe("syncTeam", () => {
  it("écrit le snapshot de la team et rend son compte", async () => {
    const r = await syncTeam("T1", deps);

    expect(r).toMatchObject({ team_gid: "T1", ok: true, written: true, projects: 1, tasks: 1 });
    const snap = JSON.parse(m.data.get(teamKey("T1"))!.value);
    expect(snap.projects[0].name).toBe("Site web");
    // La portion privée des notes ne doit jamais franchir la frontière.
    expect(snap.projects[0].description).toBe("Refonte.");
    expect(JSON.stringify(snap)).not.toContain("secret");
  });

  // Le coût annoncé dans la spec : P + 4 subrequests, constant quel que soit
  // le nombre de clients. 1 projets + 1 tâches + 1 getWithMetadata + 1 put.
  it("consomme 2 requêtes Asana et 4 subrequests pour un projet", async () => {
    const r = await syncTeam("T1", deps);
    expect(r.asana_requests).toBe(2);
    expect(r.subrequests).toBe(4);
  });

  it("ne réécrit rien au second passage sans changement", async () => {
    await syncTeam("T1", deps);
    const r = await syncTeam("T1", { ...deps, now: () => new Date("2026-08-12T10:05:00.000Z") });

    expect(r.written).toBe(false);
    expect(m.puts.filter((k) => k === teamKey("T1"))).toHaveLength(1);
    expect(r.subrequests).toBe(3); // le put n'a pas eu lieu
  });

  // Critère 8 : le portail continue d'afficher le dernier snapshot.
  it("conserve l'ancien snapshot quand Asana tombe", async () => {
    await syncTeam("T1", deps);
    const avant = m.data.get(teamKey("T1"))!.value;

    const r = await syncTeam("T1", {
      ...deps,
      fetchImpl: (async () => new Response("", { status: 500 })) as unknown as typeof fetch,
    });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/500/);
    expect(m.data.get(teamKey("T1"))!.value).toBe(avant);
  });

  // Le board Support a sa propre section d'interface (corrections §7) : il ne
  // doit pas apparaître dans la liste des projets, ni recevoir un badge de
  // statut. Exclu AVANT la requête de tâches — une requête Asana économisée.
  it("exclut un projet listé et ne va pas chercher ses tâches", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/projects")) {
        return json({
          data: [
            { gid: "p1", name: "Site web", notes: "", due_on: null, completed: false, archived: false },
            { gid: "sup", name: "🛟 Support Coolbeans", notes: "", due_on: null, completed: false, archived: false },
          ],
        });
      }
      return json({ data: [] });
    }) as unknown as typeof fetch;

    const r = await syncTeam("T1", { ...deps, fetchImpl }, ["sup"]);

    expect(r.projects).toBe(1);
    expect(r.asana_requests).toBe(2); // 1 liste de projets + 1 seule liste de tâches
    const demandes = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([u]) => new URL(String(u)).searchParams.get("project"))
      .filter(Boolean);
    expect(demandes).toEqual(["p1"]);
  });

  // Filet de sécurité : un mapping oublié doit se voir dans les logs, pas se
  // découvrir sur le portail d'un client.
  it("loggue un warning sur un projet qui ressemble à un board Support non exclu", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/projects")
        ? json({ data: [{ gid: "sup", name: "🛟 Support Amusoire", notes: "", due_on: null, completed: false, archived: false }] })
        : json({ data: [] });
    }) as unknown as typeof fetch;

    const r = await syncTeam("T1", { ...deps, fetchImpl, log });

    expect(r.projects).toBe(1); // on ne devine pas : on signale, sans rien masquer
    expect(log.mock.calls.flat()).toContainEqual(
      expect.objectContaining({ reason: "support_project_not_excluded" }),
    );
  });

  it("loggue l'échec sans laisser fuiter le token", async () => {
    const log = vi.fn();
    await syncTeam("T1", {
      ...deps,
      log,
      fetchImpl: (async () => new Response("", { status: 401 })) as unknown as typeof fetch,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("PAT");
  });
});

describe("syncTeams", () => {
  it("agrège le rapport et l'écrit sous meta:last_sync", async () => {
    const rapport = await syncTeams([{ team_gid: "T1" }, { team_gid: "T2" }], deps);

    expect(rapport).toMatchObject({
      teams: 2, teams_ok: 2, teams_failed: 0,
      projects: 2, tasks: 2, snapshots_written: 2, asana_requests: 4,
      errors: [],
    });
    expect(JSON.parse(m.data.get(LAST_SYNC_KEY)!.value).teams).toBe(2);
  });

  // Brief §5 : une team en erreur ne bloque pas les autres.
  it("isole l'échec d'une team", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/teams/BOOM/")) return new Response("", { status: 404 });
      return (asanaOk() as unknown as (i: RequestInfo | URL) => Promise<Response>)(input);
    }) as unknown as typeof fetch;

    const rapport = await syncTeams([{ team_gid: "BOOM" }, { team_gid: "T2" }], { ...deps, fetchImpl });

    expect(rapport).toMatchObject({ teams: 2, teams_ok: 1, teams_failed: 1 });
    expect(rapport.errors).toEqual([{ team_gid: "BOOM", message: expect.stringContaining("404") }]);
    expect(m.data.has(teamKey("T2"))).toBe(true);
  });

  it("écrit le rapport même quand toutes les teams échouent", async () => {
    const rapport = await syncTeams([{ team_gid: "T1" }], {
      ...deps,
      fetchImpl: (async () => new Response("", { status: 503 })) as unknown as typeof fetch,
    });
    expect(rapport.teams_failed).toBe(1);
    expect(m.data.has(LAST_SYNC_KEY)).toBe(true);
  });

  it("propage les exclusions de chaque cible", async () => {
    const rapport = await syncTeams(
      [{ team_gid: "T1", exclude_project_gids: ["p1"] }, { team_gid: "T2" }],
      deps,
    );
    // Le faux Asana ne sert qu'un projet, p1 : exclu chez T1, gardé chez T2.
    expect(rapport.projects).toBe(1);
  });

  it("ne fait rien et rend un rapport vide sur une liste vide", async () => {
    const rapport = await syncTeams([], deps);
    expect(rapport).toMatchObject({ teams: 0, teams_ok: 0, projects: 0, asana_requests: 0 });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/sync.test.ts`
Expected: FAIL — `Failed to resolve import "./sync"`.

- [ ] **Step 3: Écrire l'orchestration**

Créer `src/lib/portail/asana/sync.ts` :

```ts
// Orchestration du sync.
//
// `syncTeam(gid)` est l'unité de base (spec 2026-08-12) : le cron l'appelle en
// boucle, la route admin peut l'appeler une fois. C'est une contrainte de
// DÉCOUPAGE, pas de travail supplémentaire — mais elle doit être posée dès S1,
// sinon elle impose une refonte le jour où le volume l'exige.
//
// Coût d'une team : P + 4 subrequests (1 liste de projets + P listes de tâches
// + 1 getWithMetadata + au plus 1 put). Constant, quel que soit le nombre de
// clients. Le seuil de découpage en tranches et le raisonnement complet sont
// dans docs/superpowers/plans/2026-08-12-portail-projets-sync-asana.md.
//
// Les projets d'une team sont traités SÉQUENTIELLEMENT. Cloudflare plafonne à
// six connexions sortantes simultanées : paralléliser n'achèterait rien de
// significatif ici (~37 s pour 37 clients) et rendrait le débit vers Asana
// beaucoup moins prévisible, alors que c'est justement lui qui est contraint.

import { createAsanaClient } from "./asana-client";
import { writeSnapshotIfChanged, writeSyncReport, type PortalKV } from "./kv";
import { normalizeSectionName } from "./sections";
import { buildTeamSnapshot, type ProjectInput } from "./snapshot";
import type { LogFn, SyncReport } from "./types";

export interface SyncDeps {
  kv: PortalKV;
  /** ASANA_PAT. Ne doit jamais atterrir dans un log ni dans une réponse HTTP. */
  token: string;
  now?: () => Date;
  log?: LogFn;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface SyncTarget {
  team_gid: string;
  /**
   * Projets à ne pas synchroniser. En pratique : le board Support de la team,
   * qui alimente une section distincte de l'interface et n'a pas à recevoir un
   * badge « Prêt à démarrer / En cours / Terminé » (corrections §7).
   */
  exclude_project_gids?: string[];
}

export interface TeamSyncResult {
  team_gid: string;
  ok: boolean;
  written: boolean;
  projects: number;
  tasks: number;
  asana_requests: number;
  subrequests: number;
  error?: string;
}

const echec = (teamGid: string, requetes: number, message: string): TeamSyncResult => ({
  team_gid: teamGid,
  ok: false,
  written: false,
  projects: 0,
  tasks: 0,
  asana_requests: requetes,
  subrequests: requetes,
  error: message,
});

/**
 * Synchronise UNE team. Ne lève jamais : une team en erreur (API down, 404,
 * team supprimée côté Asana) ne doit pas faire tomber les autres, et surtout
 * ne doit pas écraser le snapshot existant par du vide — c'est ce qui permet
 * au portail de continuer à afficher les dernières données connues (critère 8).
 */
export async function syncTeam(
  teamGid: string,
  deps: SyncDeps,
  excludeProjectGids: string[] = [],
): Promise<TeamSyncResult> {
  const { kv, token, now = () => new Date(), log = () => {}, fetchImpl, sleep } = deps;
  const asana = createAsanaClient({ token, fetchImpl, sleep });
  const exclus = new Set(excludeProjectGids);

  try {
    const projets = await asana.listProjects(teamGid);

    const inputs: ProjectInput[] = [];
    for (const project of projets) {
      // Le board Support est exclu ICI et non dans buildTeamSnapshot : filtrer
      // avant la requête de tâches économise une requête Asana par team.
      if (exclus.has(project.gid)) continue;

      // On ne devine pas à partir du nom — « 🛟 Support Coolbeans » ne
      // s'attrape par aucun test d'égalité, et un test de préfixe masquerait
      // un jour un vrai projet client nommé « Support X ». On signale, et le
      // mapping oublié se répare dans le registre.
      if (normalizeSectionName(project.name).startsWith("support")) {
        log({
          event: "portal_sync_warning",
          reason: "support_project_not_excluded",
          team_gid: teamGid,
          project: project.gid,
          name: project.name,
        });
      }

      inputs.push({ project, tasks: await asana.listTasks(project.gid) });
    }

    const body = buildTeamSnapshot(teamGid, inputs, log);
    const { written } = await writeSnapshotIfChanged(kv, body, now().toISOString());

    return {
      team_gid: teamGid,
      ok: true,
      written,
      projects: body.projects.length,
      tasks: body.projects.reduce((n, p) => n + p.tasks.length, 0),
      asana_requests: asana.stats.requests,
      // requêtes Asana + le getWithMetadata + le put s'il a eu lieu
      subrequests: asana.stats.requests + 1 + (written ? 1 : 0),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ event: "portal_sync_team_failed", team_gid: teamGid, message });
    return echec(teamGid, asana.stats.requests, message);
  }
}

/**
 * Balayage. La liste des cibles vient du registre des clients
 * (`src/content/clients/*.yaml`) et est résolue par l'appelant — la tâche S1.1
 * d'origine, qui listait les utilisateurs Clerk pour en déduire les teams, a
 * été supprimée le 2026-08-12 : un appel réseau, une dépendance et un mode de
 * panne en moins à chaque passage.
 *
 * Le jour où le compteur `asana_requests` approche 120, filtrer `targets` au
 * point d'appel suffit à passer en tranche tournante — rien à changer ici.
 */
export async function syncTeams(targets: SyncTarget[], deps: SyncDeps): Promise<SyncReport> {
  const now = deps.now ?? (() => new Date());
  const debut = now();
  const resultats: TeamSyncResult[] = [];

  for (const cible of targets) {
    resultats.push(await syncTeam(cible.team_gid, deps, cible.exclude_project_gids ?? []));
  }

  const somme = (f: (r: TeamSyncResult) => number) => resultats.reduce((n, r) => n + f(r), 0);
  const fin = now();

  const report: SyncReport = {
    at: fin.toISOString(),
    teams: resultats.length,
    teams_ok: resultats.filter((r) => r.ok).length,
    teams_failed: resultats.filter((r) => !r.ok).length,
    projects: somme((r) => r.projects),
    tasks: somme((r) => r.tasks),
    snapshots_written: resultats.filter((r) => r.written).length,
    asana_requests: somme((r) => r.asana_requests),
    // +1 pour l'écriture de meta:last_sync elle-même
    subrequests: somme((r) => r.subrequests) + 1,
    duration_ms: fin.getTime() - debut.getTime(),
    errors: resultats
      .filter((r) => !r.ok)
      .map((r) => ({ team_gid: r.team_gid, message: r.error ?? "erreur inconnue" })),
  };

  await writeSyncReport(deps.kv, report);
  (deps.log ?? (() => {}))({ event: "portal_sync_done", ...report });
  return report;
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/sync.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Vérifier la non-régression**

Run: `npx vitest run && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: seuls les deux échecs connus.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portail/asana/sync.ts src/lib/portail/asana/sync.test.ts
git commit -m "feat(portail): syncTeam et syncTeams, avec isolation des erreurs par team"
```

---

## Task 7 : Câblage — route admin, handler `scheduled`, registre Coolbeans

**Files:**
- Create: `src/lib/portail/asana/admin-auth.ts`
- Test: `src/lib/portail/asana/admin-auth.test.ts`
- Create: `src/pages/api/admin/sync.ts`
- Modify: `src/worker.ts:72-101` (le handler `scheduled` et ses commentaires)
- Modify: `src/content.config.ts` (champ `asana_support_project_gid`)
- Modify: `src/lib/portail/clients.ts` (le même champ sur `PortalClient`)
- Modify: `src/content/clients/coolbeans.yaml`

**Interfaces:**
- Consomme : `syncTeams` (`./sync`), `portalKv` (`./kv`), `listClients` (`../clients`).
- Produit :
  - `SYNC_SECRET_HEADER: "x-admin-sync-secret"`
  - `isAuthorizedSync(provided: string | null, expected: string | undefined): boolean`
  - Route `POST /api/admin/sync[?team_gid=…]`.

**Décision de conception à connaître avant de commencer.** Le handler `scheduled` **ne synchronise pas lui-même** : il fabrique une requête interne et appelle `handle()` directement, ce qui exécute la route Astro. Motif : la liste des teams se lit dans le registre via `astro:content`, dont la résolution depuis `src/worker.ts` — un point d'entrée custom, hors du bundle serveur d'Astro — n'est pas garantie. Passer par la route élimine cette incertitude et laisse **un seul chemin de code** pour le sync, donc un seul à tester et à déboguer. `handle()` est un appel de fonction, pas un `fetch` : il ne coûte aucun subrequest.

Contrepartie assumée : le cron exige `ADMIN_SYNC_SECRET`. Ce n'est pas une contrainte nouvelle — c'est déjà une précondition de déploiement.

- [ ] **Step 1: Écrire le test de la garde admin (il doit échouer)**

Créer `src/lib/portail/asana/admin-auth.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { isAuthorizedSync, SYNC_SECRET_HEADER } from "./admin-auth";

describe("SYNC_SECRET_HEADER", () => {
  it("est en minuscules — Headers.get est insensible à la casse, pas les objets littéraux", () => {
    expect(SYNC_SECRET_HEADER).toBe("x-admin-sync-secret");
  });
});

describe("isAuthorizedSync", () => {
  it("accepte le bon secret", () => {
    expect(isAuthorizedSync("s3cr3t", "s3cr3t")).toBe(true);
  });

  it("refuse un mauvais secret", () => {
    expect(isAuthorizedSync("autre", "s3cr3t")).toBe(false);
  });

  // Le cas qui compte : un secret non posé ne doit pas ouvrir la route.
  it("refuse quand le secret attendu est absent ou vide", () => {
    expect(isAuthorizedSync("s3cr3t", undefined)).toBe(false);
    expect(isAuthorizedSync("s3cr3t", "")).toBe(false);
    expect(isAuthorizedSync("", "")).toBe(false);
  });

  it("refuse quand l'en-tête est absent", () => {
    expect(isAuthorizedSync(null, "s3cr3t")).toBe(false);
  });

  it("refuse un préfixe correct mais tronqué", () => {
    expect(isAuthorizedSync("s3cr", "s3cr3t")).toBe(false);
    expect(isAuthorizedSync("s3cr3t-de-trop", "s3cr3t")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/admin-auth.test.ts`
Expected: FAIL — `Failed to resolve import "./admin-auth"`.

- [ ] **Step 3: Écrire la garde**

Créer `src/lib/portail/asana/admin-auth.ts` :

```ts
// Garde de POST /api/admin/sync (brief §8).
//
// Extraite dans son propre module pour être testable sans `astro:*` — même
// motif que src/lib/portail/require-admin.ts.
//
// Cette route n'est PAS derrière Clerk : src/middleware.ts ne protège que
// /espace et /docs. Le secret partagé est donc la seule barrière, et un secret
// non posé doit fermer la route, jamais l'ouvrir.

export const SYNC_SECRET_HEADER = "x-admin-sync-secret";

/**
 * Comparaison à durée constante. L'écart de timing d'un `===` sur des chaînes
 * est indétectable à travers le réseau en pratique, mais le coût de faire
 * juste est de six lignes — et c'est un secret de longue durée, pas un jeton
 * de session.
 */
export function isAuthorizedSync(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/admin-auth.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Écrire la route**

Créer `src/pages/api/admin/sync.ts` :

```ts
// POST /api/admin/sync — le seul point d'entrée du sync du module Projets.
//
// Trois appelants : le handler `scheduled` du Worker (balayage complet toutes
// les 5 minutes), un curl d'amorçage au déploiement, et l'action admin
// « Synchroniser maintenant ». La route est REQUISE et non un bonus
// (amendement du 2026-08-06) : sans elle, aucun moyen d'amorcer le premier
// snapshot ni de tester sans attendre le cron.
//
// `?team_gid=` optionnel : absent → balayage complet, présent → cette team
// seule (spec 2026-08-12, §2).
//
// La réponse ne contient JAMAIS de secret : elle ne renvoie que le rapport de
// sync, qui est le même objet que meta:last_sync — compteurs et messages
// d'erreur, sans jeton ni URL authentifiée.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAuthorizedSync, SYNC_SECRET_HEADER } from "../../../lib/portail/asana/admin-auth";
import { portalKv } from "../../../lib/portail/asana/kv";
import { syncTeams, type SyncTarget } from "../../../lib/portail/asana/sync";
import { listClients } from "../../../lib/portail/clients";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const POST: APIRoute = async ({ request, url }) => {
  const secret = (env as { ADMIN_SYNC_SECRET?: string }).ADMIN_SYNC_SECRET;
  if (!isAuthorizedSync(request.headers.get(SYNC_SECRET_HEADER), secret)) {
    // 404 plutôt que 401 : la route n'a pas à confirmer son existence à qui
    // n'a pas le secret.
    return json({ error: "Not found" }, 404);
  }

  const token = (env as { ASANA_PAT?: string }).ASANA_PAT;
  if (!token) {
    return json({ error: "ASANA_PAT absent de cet environnement." }, 503);
  }

  const demandee = url.searchParams.get("team_gid");
  const clients = await listClients();

  // Chaque cible porte sa team et le board Support à ne pas synchroniser : ce
  // dernier alimente une section distincte de l'interface (corrections §7) et
  // n'a pas à recevoir un badge de statut de projet.
  const toutes: SyncTarget[] = clients
    .filter((c) => c.asana_team_gid)
    .map((c) => ({
      team_gid: c.asana_team_gid as string,
      exclude_project_gids: c.asana_support_project_gid ? [c.asana_support_project_gid] : [],
    }));

  // Une team demandée doit exister DANS LE REGISTRE : la route ne doit pas
  // servir de proxy vers une team arbitraire du workspace.
  const cibles = demandee ? toutes.filter((t) => t.team_gid === demandee) : toutes;
  if (demandee && cibles.length === 0) {
    return json({ error: "team_gid absent du registre des clients." }, 400);
  }

  const report = await syncTeams(cibles, {
    kv: portalKv(),
    token,
    log: (entry) => console.log(JSON.stringify(entry)),
  });

  return json(report, report.teams_failed > 0 ? 207 : 200);
};
```

- [ ] **Step 6: Câbler le handler `scheduled`**

Dans `src/worker.ts`, remplacer intégralement le bloc `scheduled` (lignes 72 à 101, commentaires compris) par :

```ts
  // Sync du portail client, cron "*/5 * * * *" (cf. wrangler.jsonc).
  //
  // Le handler ne synchronise pas lui-même : il appelle la route Astro
  // /api/admin/sync via `handle()`. La liste des teams se lit dans le registre
  // des clients (src/content/clients/*.yaml) via `astro:content`, dont la
  // résolution depuis ce point d'entrée custom — hors du bundle serveur
  // d'Astro — n'est pas garantie. Passer par la route lève l'incertitude et
  // laisse un seul chemin de code pour le sync.
  //
  // `handle()` est un appel de fonction, pas un fetch : aucun subrequest.
  //
  // Un secret manquant est la panne la plus probable au premier déploiement
  // (les `wrangler secret put` sont un geste manuel). On trace sa présence,
  // jamais sa valeur — critère d'acceptation 6.
  async scheduled(controller, env, ctx) {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();
    const secret = env.ADMIN_SYNC_SECRET;

    if (!secret || !env.ASANA_PAT || !env.PORTAL_KV) {
      console.log(
        JSON.stringify({
          event: "portal_sync",
          status: "skipped_missing_bindings",
          cron: controller.cron,
          scheduled_at: scheduledAt,
          bindings: {
            portal_kv: Boolean(env.PORTAL_KV),
            asana_pat: Boolean(env.ASANA_PAT),
            admin_sync_secret: Boolean(secret),
          },
        }),
      );
      return;
    }

    // L'hôte n'a pas d'importance : /api/* est en passthrough dans le handler
    // fetch ci-dessus, et la route ne lit pas le hostname.
    const request = new Request("https://my.coolbeans.cc/api/admin/sync", {
      method: "POST",
      headers: { "x-admin-sync-secret": secret },
    });

    const res = await handle(request, env, ctx);
    console.log(
      JSON.stringify({
        event: "portal_sync",
        status: res.ok ? "done" : "failed",
        http_status: res.status,
        cron: controller.cron,
        scheduled_at: scheduledAt,
      }),
    );
  },
```

- [ ] **Step 7: Ouvrir le registre au board Support**

Deux fichiers, un champ. Dans `src/content.config.ts`, collection `clients`, après `asana_team_gid` :

```ts
    asana_team_gid: z.string().optional(),
    // Board Support de la team (corrections §7). Renseigné, ce projet est
    // exclu du module Projets : il alimente une section distincte de
    // l'interface et n'a pas à recevoir un badge de statut de projet.
    // Le sprint Support s'en servira aussi comme cible d'écriture des tickets.
    asana_support_project_gid: z.string().optional(),
```

Dans `src/lib/portail/clients.ts`, sur l'interface `PortalClient`, après `asana_team_gid` :

```ts
  asana_team_gid?: string;
  /** Board Support de la team. Exclu du module Projets — voir corrections §7. */
  asana_support_project_gid?: string;
```

**Ne pas toucher à `MODULE_REQUIREMENTS`.** L'entrée `support: ["asana_team_gid"]` reste telle quelle : le module Support n'est pas de ce sprint, et lui donner une nouvelle exigence changerait son empty state alors que rien ne la consomme encore.

- [ ] **Step 8: Donner sa team Asana et son board Support à Coolbeans**

`src/content/clients/coolbeans.yaml` n'a **pas** de `asana_team_gid` : sans lui, le client zéro n'est synchronisable par rien, et ni « Site web Coolbeans » ni « myCoolbeans » n'ont de moyen d'apparaître. Et sans le second GID, `🛟 Support Coolbeans` s'afficherait comme un projet ordinaire. Remplacer le contenu du fichier par :

```yaml
# Coolbeans est un client comme les autres : Ludo est le client zéro.
# Les mappings sont optionnels ; absents, les modules affichent un empty state.
nom: Coolbeans
# Team « Coolbeans » du workspace coolbeans.cc. Porte « Site web Coolbeans »
# (1217361878516618) et « myCoolbeans » (1217409019426531), sur lesquels les
# six colonnes canoniques de corrections §6 ont été relevées.
asana_team_gid: "1217361878516615"
# « 🛟 Support Coolbeans ». Exclu du module Projets : sans ce GID, il
# s'afficherait comme un projet ordinaire, avec un badge de statut qui n'a
# pas de sens sur un board de support.
asana_support_project_gid: "1217414522363591"
```

Amusoire n'a pas encore de board Support : son fichier reste inchangé, et son absence de `asana_support_project_gid` est un état normal.

- [ ] **Step 9: Vérifier que le build et les types tiennent**

Run: `npx vitest run && npm run build && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: Vitest vert ; build vert ; `verify` à 1 échec connu ; `tsc` à 1 erreur connue (`src/worker.ts(60,9)`). **Si `tsc` signale une seconde erreur dans le nouveau bloc `scheduled`, c'est une régression : la corriger avant de commiter.**

- [ ] **Step 10: Vérifier le refus sans secret, en local**

Démarrer le serveur de dev, puis :

```bash
curl -i -X POST http://localhost:4321/api/admin/sync
curl -i -X POST -H "x-admin-sync-secret: mauvais" http://localhost:4321/api/admin/sync
```

Expected: `HTTP/1.1 404` dans les deux cas. C'est le test le plus important de cette tâche et il ne demande **aucune** précondition côté Ludo : il vérifie qu'un secret absent ferme la route au lieu de l'ouvrir.

- [ ] **Step 11: Vérifier le sync réel en local — dépend d'un `.dev.vars` rempli**

Cette étape suppose un `.dev.vars` local contenant `ASANA_PAT` et `ADMIN_SYNC_SECRET` (cf. `.dev.vars.example`). **Sans PAT, elle est bloquée : ne pas la rapporter comme faite.**

```bash
curl -s -X POST -H "x-admin-sync-secret: $(grep ADMIN_SYNC_SECRET .dev.vars | cut -d= -f2)" \
  http://localhost:4321/api/admin/sync | python3 -m json.tool
```

Expected, sur l'état du workspace au 2026-08-12 : un `SyncReport` avec `teams: 2`, `teams_failed: 0`, **`projects: 4`** (`Site web Coolbeans`, `myCoolbeans`, `📱 LP + UK`, `🎭 Refonte site` — `🛟 Support Coolbeans` est exclu), **`asana_requests: 6`**, `errors: []`.

**`tasks` vaudra très probablement 0** — les dix tâches de `myCoolbeans` n'ont ni assigné ni deadline, et le filtre du §6 les écarte toutes. C'est le comportement voulu, pas un bug : voir « État réel des boards Asana » en tête de plan. Un `tasks: 0` avec `projects: 4` est donc un **succès**, pas un échec à déboguer.

Si `astro dev` ne charge pas `.dev.vars` ou n'expose pas `PORTAL_KV` (la réponse serait alors une 500 sur un binding indéfini), passer par le chemin wrangler, qui les fournit toujours :

```bash
npm run build
npx wrangler dev --local-upstream https://staging.coolbeans.cc
# puis le même curl sur le port annoncé par wrangler
```

Consigner dans le commit lequel des deux chemins fonctionne : la tâche 9 et le runbook s'appuieront dessus.

- [ ] **Step 12: Commit**

```bash
git add src/lib/portail/asana/admin-auth.ts src/lib/portail/asana/admin-auth.test.ts \
        src/pages/api/admin/sync.ts src/worker.ts \
        src/content.config.ts src/lib/portail/clients.ts src/content/clients/coolbeans.yaml
git commit -m "feat(portail): route admin de sync et déclenchement par le cron"
```

---

## Task 8 : La page Projets

**Files:**
- Create: `src/lib/portail/asana/format.ts`
- Test: `src/lib/portail/asana/format.test.ts`
- Create: `src/components/portail/projets/TacheLigne.astro`
- Create: `src/components/portail/projets/ProjetCard.astro`
- Modify: `src/pages/espace/projets.astro` (remplace entièrement la page-souche de S0.7)
- Modify: `src/pages/design-system.astro` — section `#biblio`

**Interfaces:**
- Consomme : `TeamSnapshot`, `ProjectSnapshot`, `TaskSnapshot`, `TaskStatus`, `ProjectStatus` (`../../lib/portail/asana/types`) ; `COLUMN_ORDER` (`../../lib/portail/asana/sections`) ; `readTeamSnapshot`, `portalKv` (`../../lib/portail/asana/kv`) ; `getPortalContext`, `missingKeysFor`, `isAdmin` (déjà utilisés par la page-souche).
- Produit :
  - `formatDueOn(iso: string): string` — `"2026-08-06"` → `"6 août 2026"`
  - `formatSyncedAt(iso: string): string` — `"2026-08-12T13:47:00Z"` → `"12 août 2026 à 15:47"`
  - `COLUMN_LABELS: Record<TaskStatus, string>`
  - `PROJECT_STATUS: Record<ProjectStatus, { label: string; variant: "gray" | "blue" | "amber" }>`

- [ ] **Step 1: Écrire le test des formats (il doit échouer)**

Créer `src/lib/portail/asana/format.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { COLUMN_LABELS, formatDueOn, formatSyncedAt, PROJECT_STATUS } from "./format";

describe("formatDueOn", () => {
  it("écrit une date Asana en français", () => {
    expect(formatDueOn("2026-08-06")).toBe("6 août 2026");
    expect(formatDueOn("2026-01-01")).toBe("1 janvier 2026");
    expect(formatDueOn("2026-12-31")).toBe("31 décembre 2026");
  });

  // due_on est une date SANS heure. La convertir en Date puis la reformater
  // ferait passer le fuseau dans l'équation pour rien : une deadline au 1er
  // janvier ne doit jamais s'afficher « 31 décembre ». D'où le découpage de
  // chaîne, insensible au fuseau par construction.
  it("ne dépend d'aucun fuseau horaire", () => {
    expect(formatDueOn("2026-01-01")).not.toContain("décembre");
  });

  it("rend la chaîne telle quelle si elle n'a pas la forme attendue", () => {
    expect(formatDueOn("bientôt")).toBe("bientôt");
    expect(formatDueOn("")).toBe("");
  });
});

describe("formatSyncedAt", () => {
  // Intl glisse selon les versions d'ICU une espace insécable ou une espace
  // fine insécable avant l'heure. On normalise, plutôt que d'écrire un test
  // qui casserait à la prochaine montée de version de Node.
  const espaces = (s: string) => s.replace(/[  ]/g, " ");

  // synced_at est un instant : il doit s'afficher en heure de Paris (brief §7).
  it("convertit un instant UTC en heure de Paris, en été", () => {
    expect(espaces(formatSyncedAt("2026-08-12T13:47:00.000Z"))).toBe("12 août 2026 à 15:47");
  });

  it("gère l'heure d'hiver", () => {
    expect(espaces(formatSyncedAt("2026-01-15T09:05:00.000Z"))).toBe("15 janvier 2026 à 10:05");
  });

  it("rend une chaîne vide sur un horodatage illisible plutôt que Invalid Date", () => {
    expect(formatSyncedAt("n'importe quoi")).toBe("");
    expect(formatSyncedAt("")).toBe("");
  });
});

describe("libellés", () => {
  // §6 : « En attente de votre validation » est le seul statut appelant une
  // action du client. Le libellé ne doit pas être raccourci.
  it("nomme les colonnes côté client", () => {
    expect(COLUMN_LABELS).toEqual({
      todo: "À faire",
      in_progress: "En cours",
      to_validate: "En attente de votre validation",
      done: "Terminé",
    });
  });

  it("nomme les statuts de projet", () => {
    expect(PROJECT_STATUS.ready.label).toBe("Prêt à démarrer");
    expect(PROJECT_STATUS.in_progress.label).toBe("En cours");
    expect(PROJECT_STATUS.done.label).toBe("Terminé");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/asana/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Écrire les formats**

Créer `src/lib/portail/asana/format.ts` :

```ts
// Mise en forme côté client. Pur, donc testable — et surtout : aucun libellé
// en dur dans les composants, pour que « En attente de votre validation » ne
// se fasse pas raccourcir au fil des retouches.

import type { ProjectStatus, TaskStatus } from "./types";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * `due_on` est une DATE, pas un instant : « 2026-08-06 ». La passer par `Date`
 * puis la reformater ferait entrer le fuseau dans l'équation pour rien, avec
 * le décalage d'un jour au bout. Découpage de chaîne, donc.
 */
export function formatDueOn(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, annee, mois, jour] = m;
  return `${Number(jour)} ${MOIS[Number(mois) - 1]} ${annee}`;
}

/**
 * `synced_at` est un INSTANT : il se convertit en heure de Paris (brief §7).
 * Intl s'en charge — les Workers embarquent l'ICU complet.
 *
 * Ce libellé désigne la date du dernier CHANGEMENT, pas de la dernière
 * vérification : c'est la conséquence assumée de l'écriture conditionnelle
 * (corrections §3), et la sémantique la plus juste pour le client.
 */
export function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  }).format(d);
  return `${date} à ${heure}`;
}

/** §6. « En attente de votre validation » : seul statut appelant une action. */
export const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  to_validate: "En attente de votre validation",
  done: "Terminé",
};

/** Variantes du composant Badge existant — pas de nouveau composant de badge. */
export const PROJECT_STATUS: Record<
  ProjectStatus,
  { label: string; variant: "gray" | "blue" | "amber" }
> = {
  ready: { label: "Prêt à démarrer", variant: "blue" },
  in_progress: { label: "En cours", variant: "amber" },
  done: { label: "Terminé", variant: "gray" },
};
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/asana/format.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Écrire la ligne de tâche**

Créer `src/components/portail/projets/TacheLigne.astro` :

```astro
---
// Une tâche du portail, en lecture seule (brief §7 : « aucune interaction »).
//
// Le pictogramme est un <span aria-hidden> et l'état est porté par un texte
// visuellement masqué : une case à cocher désactivée annoncerait un contrôle
// là où il n'y en a pas, et un lecteur d'écran doit pouvoir dire « terminé »
// autrement que par une couleur.
//
// Aucune classe maison : EspaceLayout enveloppe la page dans .doc-root, où
// tout sélecteur `.doc-root .X` de doc.css bat les utilitaires Tailwind.
import { COLUMN_LABELS, formatDueOn } from "../../../lib/portail/asana/format";
import type { TaskSnapshot } from "../../../lib/portail/asana/types";

interface Props {
  tache: TaskSnapshot;
}
const { tache } = Astro.props;
const fait = tache.status === "done";
---

<li class="flex items-baseline justify-between gap-4x border-b border-line py-2.5 last:border-b-0">
  <span class="flex items-baseline gap-2x">
    <span aria-hidden="true" class="text-mute">{fait ? "✓" : "○"}</span>
    <span class:list={["text-sm", fait && "text-mute line-through"]}>{tache.name}</span>
    <span class="sr-only">— {COLUMN_LABELS[tache.status]}</span>
  </span>
  <span class="shrink-0 font-mono text-xs text-mute">{formatDueOn(tache.due_on)}</span>
</li>
```

- [ ] **Step 6: Écrire la carte de projet**

Créer `src/components/portail/projets/ProjetCard.astro` :

```astro
---
// Un projet du portail : nom, description, deadline, badge de statut, et ses
// tâches groupées par colonne.
//
// Un projet terminé est grisé et relégué en bas de liste — le tri vient de
// sortProjects(), la carte ne fait qu'appliquer l'atténuation.
//
// La colonne « En attente de votre validation » est la seule qui appelle une
// action du client : elle est rendue saillante par son fond ambre. Les autres
// n'ont qu'un intitulé.
//
// `description` est rendue via une expression `{}` : Astro l'échappe. Ne
// JAMAIS y mettre set:html — c'est un champ de travail Asana, filtré par
// publicDescription() mais pas assaini en HTML.
import Badge from "../../ui/Badge.astro";
import TacheLigne from "./TacheLigne.astro";
import { COLUMN_ORDER } from "../../../lib/portail/asana/sections";
import { COLUMN_LABELS, formatDueOn, PROJECT_STATUS } from "../../../lib/portail/asana/format";
import type { ProjectSnapshot } from "../../../lib/portail/asana/types";

interface Props {
  projet: ProjectSnapshot;
}
const { projet } = Astro.props;
const statut = PROJECT_STATUS[projet.status];
const termine = projet.status === "done";

const colonnes = COLUMN_ORDER.map((status) => ({
  status,
  label: COLUMN_LABELS[status],
  taches: projet.tasks.filter((t) => t.status === status),
})).filter((c) => c.taches.length > 0);
---

<article
  class:list={[
    "rounded-card border border-line bg-surface p-6x",
    termine && "opacity-60",
  ]}
>
  <header class="flex flex-wrap items-start justify-between gap-3x">
    <div class="min-w-0">
      <h2 class="text-lg font-semibold tracking-[-0.02em]">{projet.name}</h2>
      {projet.description && <p class="mt-1 max-w-[62ch] text-sm text-mute">{projet.description}</p>}
    </div>
    <Badge variant={statut.variant} subtle>{statut.label}</Badge>
  </header>

  {
    projet.due_on && (
      <p class="mt-3x text-sm text-mute">
        Échéance <span class="font-mono text-ink">{formatDueOn(projet.due_on)}</span>
      </p>
    )
  }

  {
    colonnes.length === 0 ? (
      <p class="mt-6x text-sm text-mute">Aucune tâche planifiée pour le moment.</p>
    ) : (
      <div class="mt-6x grid gap-6x md:grid-cols-2">
        {colonnes.map((colonne) => (
          <section>
            <h3
              class:list={[
                "mb-2x inline-block rounded-control px-2 py-1 text-xs font-medium uppercase tracking-[0.08em]",
                colonne.status !== "to_validate" && "text-mute",
              ]}
              style={
                colonne.status === "to_validate"
                  ? "background:var(--ds-amber-200);color:var(--ds-amber-900)"
                  : undefined
              }
            >
              {colonne.label}
            </h3>
            <ul class="m-0 list-none p-0">
              {colonne.taches.map((tache) => (
                <TacheLigne tache={tache} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }
</article>
```

- [ ] **Step 7: Récrire la page Projets**

Remplacer intégralement `src/pages/espace/projets.astro` par :

```astro
---
// Module « Projets » du portail client (sprint S1).
//
// Miroir, pas outil : la page ne fait que LIRE le snapshot KV écrit par le
// cron. Aucun appel Asana au runtime des requêtes — le PAT ne doit apparaître
// dans aucune réponse réseau côté navigateur (critère 6).
//
// Quatre états, dans cet ordre de test :
//   1. pas de client courant, ou client sans asana_team_gid → EmptyState (le
//      diagnostic de la clé manquante n'est visible que de l'admin) ;
//   2. snapshot absent → « Synchronisation en cours » (premier déploiement,
//      cron pas encore passé) ;
//   3. snapshot sans projet → empty state accueillant ;
//   4. les projets.
//
// Aucun de ces états n'est une erreur : un utilisateur sans mapping obtient
// l'empty state, jamais une 500 (critère 7).
export const prerender = false;

import EspaceLayout from "../../layouts/EspaceLayout.astro";
import EmptyState from "../../components/portail/EmptyState.astro";
import ProjetCard from "../../components/portail/projets/ProjetCard.astro";
import { missingKeysFor } from "../../lib/portail/clients";
import { getPortalContext } from "../../lib/portail/context";
import { isAdmin } from "../../lib/portail/metadata";
import { portalKv, readTeamSnapshot } from "../../lib/portail/asana/kv";
import { formatSyncedAt } from "../../lib/portail/asana/format";

const { meta, client } = await getPortalContext(Astro);
const admin = isAdmin(meta);
const missingKeys = missingKeysFor("projets", client);

const snapshot =
  missingKeys.length === 0 && client?.asana_team_gid
    ? await readTeamSnapshot(portalKv(), client.asana_team_gid)
    : null;

const projets = snapshot?.projects ?? [];
const derniereMaj = snapshot ? formatSyncedAt(snapshot.synced_at) : "";

Astro.response.headers.set("Cache-Control", "no-store");
---

<EspaceLayout title="Projets">
  <h1>Projets</h1>
  <p class="sub">L'avancement de vos chantiers, tel qu'il est suivi de notre côté.</p>

  {
    missingKeys.length > 0 && (
      <EmptyState title="Aucun projet pour le moment" missingKeys={missingKeys} isAdmin={admin}>
        Dès qu'un chantier démarre, son avancement s'affiche ici : ce qui est fait, ce qui
        est en cours, et ce qui attend votre validation.
      </EmptyState>
    )
  }

  {
    missingKeys.length === 0 && snapshot === null && (
      <EmptyState title="Synchronisation en cours">
        Les données arrivent. Revenez dans quelques minutes.
      </EmptyState>
    )
  }

  {
    missingKeys.length === 0 && snapshot !== null && projets.length === 0 && (
      <EmptyState title="Aucun projet pour le moment">
        Dès qu'un chantier démarre, son avancement s'affiche ici : ce qui est fait, ce qui
        est en cours, et ce qui attend votre validation.
      </EmptyState>
    )
  }

  {
    projets.length > 0 && (
      <>
        <div class="grid gap-6x">
          {projets.map((projet) => (
            <ProjetCard projet={projet} />
          ))}
        </div>
        {derniereMaj && (
          <p class="mt-8x text-xs text-mute">Dernière mise à jour le {derniereMaj}</p>
        )}
      </>
    )
  }
</EspaceLayout>
```

- [ ] **Step 8: Ajouter les deux composants à la Bibliothèque**

Dans `src/pages/design-system.astro` : ajouter l'import en tête du frontmatter, à côté des autres imports de composants —

```ts
import ProjetCard from "../components/portail/projets/ProjetCard.astro";
```

— puis, dans la section `#biblio`, **après** le bloc `Collapse` (fin de la grille de cartes) :

```astro
      <div class="card mt-6x">
        <p class="label mb-4x">Projet · carte du portail</p>
        <p class="mb-6x max-w-[62ch] text-sm text-mute">
          Mobilier du module Projets. Rendu ici hors de <code class="font-mono">.doc-root</code> :
          en situation réelle, <code class="font-mono">doc.css</code> s'applique par-dessus, d'où
          l'absence totale de classe maison sur ces deux composants. La ligne de tâche
          (<code class="font-mono">TacheLigne</code>) n'a pas de démo propre : elle n'existe
          qu'à l'intérieur d'une carte.
        </p>
        <div class="grid gap-6x">
          <ProjetCard
            projet={{
              gid: "1",
              name: "Site web Coolbeans",
              description: "Refonte du site vitrine et de l'espace client.",
              due_on: "2026-09-30",
              status: "in_progress",
              tasks: [
                { gid: "a", name: "Maquette de la home", due_on: "2026-08-20", status: "todo" },
                { gid: "b", name: "Intégration du portail", due_on: "2026-08-25", status: "in_progress" },
                { gid: "c", name: "Relire les textes de la page tarifs", due_on: "2026-08-18", status: "to_validate" },
                { gid: "d", name: "Poser le nom de domaine", due_on: "2026-08-04", status: "done" },
              ],
            }}
          />
          <ProjetCard
            projet={{
              gid: "2",
              name: "Automatisation des devis",
              description: "",
              due_on: null,
              status: "done",
              tasks: [{ gid: "e", name: "Recette finale", due_on: "2026-07-30", status: "done" }],
            }}
          />
        </div>
      </div>
```

- [ ] **Step 9: Vérifier build, verify, types et tests**

Run: `npx vitest run && npm run build && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: Vitest vert ; build vert ; `verify` **toujours à 1 seul échec** (`src/pages/projets/[slug].astro`) ; `tsc` à 1 erreur connue.

`verify` est le garde-fou qui compte ici : ses sections « aucune couleur brute dans class=/style= » et « toute var(--custom) référencée est définie » attraperaient un `style=` mal branché dans `ProjetCard`. Les deux `var(--ds-amber-*)` utilisées y sont déjà admises (`EmptyState.astro` emploie exactement la même paire).

- [ ] **Step 10: Vérifier le rendu — manuelle, session Clerk requise**

`/design-system` est public : les deux cartes s'y contrôlent sans session, et c'est le seul contrôle visuel réalisable sans précondition.

`/espace/projets` est derrière Clerk et **n'est pas vérifiable sans session**. À faire par Ludo, connecté, après déploiement sur staging :

1. En tant qu'admin sur Coolbeans → **deux** cartes, « Site web Coolbeans » et « myCoolbeans ». **`🛟 Support Coolbeans` ne doit pas apparaître.** C'est le point qui valide l'exclusion.
2. Sur l'état actuel des boards, les deux cartes affichent « Aucune tâche planifiée pour le moment » et un badge « En cours ». **C'est le résultat attendu**, pas un échec — cf. « État réel des boards Asana », point 3. Pour voir des tâches, assigner et dater au moins une tâche de `myCoolbeans` dans Asana, puis déclencher un sync.
3. Basculer sur Amusoire via le sélecteur → « 📱 LP + UK » et « 🎭 Refonte site », toutes deux en « En cours » alors que 100 % de leurs tâches sont cochées : c'est le critère d'acceptation 9 sur données réelles.
4. Vérifier la description de « 🎭 Refonte site » : elle ne doit contenir **ni** la note de bas de page située après le `---`, **ni** plus de 300 caractères. Si le bloc de liens Google Drive qui subsiste te paraît inadapté à un œil client, c'est la décision signalée au point 2 de l'état des boards — arbitrage à rendre, pas bug à corriger.
5. Vérifier dans l'onglet réseau qu'aucune réponse ne contient de jeton Asana (critère 6).

**Ne pas rapporter ces cinq points comme vérifiés s'ils ne l'ont pas été.**

- [ ] **Step 11: Commit**

```bash
git add src/lib/portail/asana/format.ts src/lib/portail/asana/format.test.ts \
        src/components/portail/projets/ src/pages/espace/projets.astro src/pages/design-system.astro
git commit -m "feat(portail): le module Projets affiche le snapshot Asana"
```

---

## Task 9 (optionnelle) : Bouton « Synchroniser maintenant »

**À ne faire que s'il reste du temps.** Sa justification s'est effondrée avec la cadence à 5 minutes : il ne rattrape plus une heure de retard, mais cinq minutes. Ce qu'il reste — éviter qu'un `curl` avec un secret en clair dans la commande soit le seul geste manuel possible, et servir le moment de démonstration.

**Files:**
- Modify: `src/actions/index.ts` — ajout de `portail.synchroniser`
- Modify: `src/pages/espace/projets.astro` — le bouton, admin uniquement
- Modify: `src/pages/design-system.astro` — le bouton et son état de chargement

**Interfaces:**
- Consomme : `requireAdmin` (déjà dans `src/actions/index.ts`), `getClient` (`../lib/portail/clients`), `syncTeam` (`../lib/portail/asana/sync`), `portalKv` (`../lib/portail/asana/kv`).
- Produit : action `portail.synchroniser`, entrée `{ client: string, retour: retourSchema }`, sortie `{ written: boolean; projects: number }`.

**Le point de conception :** l'action **n'appelle pas** `POST /api/admin/sync`. Elle appelle `syncTeam()` directement. Deux raisons — le rôle admin de Clerk est déjà une garde suffisante et meilleure qu'un secret partagé, et faire passer `ADMIN_SYNC_SECRET` par le navigateur ou par un `fetch` sortant serait un aller-retour et une exposition pour rien.

- [ ] **Step 1: Écrire l'action**

Dans `src/actions/index.ts`, à l'intérieur de l'objet `portail`, après `choisirClient` :

```ts
    /* Sync à la demande de la team du client affiché. Réservé à l'admin par
       requireAdmin — le rôle Clerk est une garde plus fine qu'ADMIN_SYNC_SECRET,
       et le secret n'a donc aucune raison de traverser le navigateur.
       Le sync passe par syncTeam() en direct : appeler la route HTTP coûterait
       un aller-retour réseau pour le même résultat. */
    synchroniser: defineAction({
      accept: "form",
      input: z.object({ client: z.string().regex(SLUG_STRICT, "Slug invalide."), retour: retourSchema }),
      handler: async ({ client }, context) => {
        await requireAdmin(context);

        const cible = await getClient(client);
        if (!cible?.asana_team_gid) {
          throw new ActionError({ code: "BAD_REQUEST", message: "Ce client n'a pas de team Asana." });
        }

        const { env } = await import("cloudflare:workers");
        const token = (env as { ASANA_PAT?: string }).ASANA_PAT;
        if (!token) {
          throw new ActionError({ code: "BAD_REQUEST", message: "ASANA_PAT absent de cet environnement." });
        }

        const { syncTeam } = await import("../lib/portail/asana/sync");
        const { portalKv } = await import("../lib/portail/asana/kv");
        const r = await syncTeam(cible.asana_team_gid, {
          kv: portalKv(),
          token,
          log: (entry) => console.log(JSON.stringify(entry)),
        });

        if (!r.ok) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: r.error ?? "Sync en échec." });
        return { written: r.written, projects: r.projects };
      },
    }),
```

- [ ] **Step 2: Poser le bouton dans la page**

Dans `src/pages/espace/projets.astro`, ajouter au frontmatter :

```ts
import { actions } from "astro:actions";
const resultatSync = Astro.getActionResult(actions.portail.synchroniser);
```

puis, juste après le `<p class="sub">` :

```astro
  {
    admin && client?.asana_team_gid && (
      <form method="POST" action={actions.portail.synchroniser} class="mb-6x flex items-center gap-3x">
        <input type="hidden" name="client" value={client.slug} />
        <input type="hidden" name="retour" value={Astro.url.pathname} />
        <button type="submit" class="btn btn-sm btn-outline" data-sync>Synchroniser maintenant</button>
        {resultatSync?.error && <span class="text-sm text-error">{resultatSync.error.message}</span>}
        {resultatSync?.data && (
          <span class="text-sm text-mute">
            {resultatSync.data.written ? "Mis à jour." : "Aucun changement depuis le dernier sync."}
          </span>
        )}
      </form>
    )
  }

  <script>
    // Un sync prend quelques secondes : sans retour, on double-clique.
    document.querySelector<HTMLFormElement>("form:has([data-sync])")?.addEventListener("submit", (e) => {
      const bouton = (e.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>("[data-sync]");
      if (!bouton) return;
      bouton.disabled = true;
      bouton.textContent = "Synchronisation…";
    });
  </script>
```

- [ ] **Step 3: Ajouter le bouton et son état à la Bibliothèque**

Dans la section `#biblio` de `src/pages/design-system.astro`, dans la carte « Projet · carte du portail », avant les deux `ProjetCard` :

```astro
        <div class="mb-6x flex items-center gap-3x">
          <button type="button" class="btn btn-sm btn-outline">Synchroniser maintenant</button>
          <button type="button" class="btn btn-sm btn-outline" disabled>Synchronisation…</button>
          <span class="text-sm text-mute">Aucun changement depuis le dernier sync.</span>
        </div>
```

- [ ] **Step 4: Vérifier**

Run: `npx vitest run && npm run build && npm run verify && npx --yes -p typescript@5 tsc --noEmit`
Expected: seuls les deux échecs connus.

Le bouton lui-même n'est **pas vérifiable sans session Clerk ni `ASANA_PAT`**. Sa présence sur `/design-system` l'est.

- [ ] **Step 5: Commit**

```bash
git add src/actions/index.ts src/pages/espace/projets.astro src/pages/design-system.astro
git commit -m "feat(portail): bouton de sync manuel pour l'admin"
```

---

## Préconditions : ce qui est bloqué, ce qui ne l'est pas

Aucune des préconditions côté Ludovic n'empêche d'écrire et de tester le code. Elles ne bloquent que le déploiement du sync réel.

| Précondition | Ce qu'elle bloque | Ce qu'elle ne bloque pas |
| --- | --- | --- |
| **Plan Workers Paid** | Rien dans ce plan, à l'échelle actuelle — voir la nuance ci-dessous. | Les tâches 1 à 9 dans leur intégralité, tests compris. |
| **`wrangler secret put ASANA_PAT`** (prod + staging) | Tâche 7 step 10 (sync réel en local, qui exige un `.dev.vars`), tâche 8 step 10 (vérification visuelle du rendu réel), tâche 9 en exécution. | Tâches 1 à 6 en entier ; tâche 7 steps 1 à 9 (dont le test de refus sans secret, le plus important) ; tâche 8 steps 1 à 9. |
| **`wrangler secret put ADMIN_SYNC_SECRET`** (prod + staging) | Le déclenchement du sync par le cron **et** par la route, en staging comme en prod. | Tout le reste. Le test qui compte — un secret absent ferme la route — se passe justement de secret. |
| **Les deux éditions `publicMetadata` dans Clerk** | Rien de ce sprint. Elles relèvent de la migration du sélecteur de client (spec du 2026-08-12), pas du module Projets. | Tout. |
| **Toilettage des boards Asana** (assigné + deadline sur les tâches à montrer) | Rien techniquement. Mais sans lui, le module s'affiche **vide** : cartes de projet sans aucune tâche. | Tout le code, tous les tests, et le déploiement lui-même. |
| **Relecture des `notes` de projet** avant mise en ligne | Rien techniquement. | Tout. Mais à faire avant qu'un client voie sa page : le `---` d'Amusoire n'a jamais voulu dire « ce qui suit est privé ». |

**La nuance sur le plan payant.** Avec deux clients au registre, un balayage complet coûte ~13 subrequests et ~4 requêtes Asana : il tiendrait sous les 50 subrequests du plan gratuit. Le plan payant reste une décision arbitrée et le bon geste — mais il n'est pas ce qui empêche de déployer ce sprint sur staging, et le prétendre serait faux. Il devient **strictement nécessaire à partir de 7-8 clients**, et c'est un mur qui ne prévient pas : au-delà, le sync échoue en cours d'invocation, laissant les dernières teams non synchronisées sans autre signal qu'une ligne dans `wrangler tail`.

**Ordre de déploiement recommandé, une fois les secrets posés :** staging d'abord (`git push` sur `staging` suffit, Workers Builds s'occupe du reste), amorçage du premier snapshot par un `curl` sur `POST /api/admin/sync`, vérification visuelle des quatre points de la tâche 8 step 10, **puis attendre l'ordre explicite de Ludo pour la production**.

---

## Hors périmètre de ce sprint, à signaler

- **Le module Support (corrections §7).** Première écriture vers Asana, sprint distinct. **Son exclusion du module Projets, elle, est bien dans ce sprint** — `🛟 Support Coolbeans` existe déjà, et sans exclusion il s'afficherait comme un projet ordinaire dès le premier sync. Voir « État réel des boards Asana », point 1. Restent hors périmètre : le formulaire de ticket, l'écriture `POST /tasks`, le calcul de J+1 ouvré, la section d'interface dédiée, et la correction du modèle Asana en `default_view: "board"`.
- **La tranche tournante.** Décrite plus haut, non implémentée. Seuil : 30 clients au registre.
- **La lecture des hachages par `list()` en un seul subrequest.** Décrite plus haut, non implémentée.
- **Les webhooks Asana.** Écartés dans la spec du 2026-08-12 : ils supprimeraient le polling, mais ajoutent le handshake `X-Hook-Secret`, le stockage du secret et un cycle de vie de webhook par projet — pour un problème que la tranche tournante règle en quelques lignes.
- **Les deux échecs connus de `verify` et `tsc`.** Antérieurs, hors sujet ici. Les corriger dans ce sprint mélangerait les diffs et rendrait la revue plus difficile.

---

## Récapitulatif · couverture des critères d'acceptation

| Critère | Où il est tenu |
| --- | --- |
| 1 · le cron met à jour KV sans intervention | Tâche 7, handler `scheduled` |
| 2 · un client voit ses projets, tâches, statuts et deadlines | Tâches 6 et 8 |
| 3 · tâche cochée sans changer de colonne → « Terminé » | Tâche 2, `toTaskSnapshot` |
| 4 · projet marqué terminé → carte grisée | Tâches 2 (`projectStatus`) et 8 (`ProjetCard`, `opacity-60`) |
| 5 · préfixe d'exclusion | Caduc (§6), remplacé par le critère 17 |
| 6 · le PAT n'apparaît dans aucune réponse réseau | Tâches 6 (test de log) et 8 (aucun appel Asana au runtime) ; vérification finale manuelle en step 10 |
| 7 · un user sans mapping obtient l'empty state, pas une 500 | Tâche 8, les quatre états de la page |
| 8 · Asana coupé → dernier snapshot conservé | Tâche 6, test « conserve l'ancien snapshot » |
| 9 · tout coché, projet non clôturé → « En cours » | Tâche 2, `projectStatus` |
| 10 · projet sans tâche → « En cours » | Tâche 2, `projectStatus` |
| 11 · deux passages sans changement → aucune écriture `team:{gid}` | Tâches 5 et 6 |
| 12 · projet de plus de 100 tâches intégralement synchronisé | Tâche 4, pagination |
| 13 · tâche multi-homée → seule sa section du projet client | Tâche 2, `sectionNameFor` |
| 14 · variantes du préfixe verrou | Caduc (§6) |
| 15 · tâche en Inbox jamais affichée | Tâches 1 et 2 |
| 16 · tâche sans assigné ou sans deadline jamais affichée | Tâche 2 |
| 17 · nom commençant par « . » exclu, tâche comme projet | Tâches 1 (`isHiddenName`) et 2 (`isVisibleProject`) |
| 18 · Backlog et Sprint fusionnés sous « À faire », ordre du board | Tâches 1 (table `TABLE`) et 2 (`sortTasks`) |
