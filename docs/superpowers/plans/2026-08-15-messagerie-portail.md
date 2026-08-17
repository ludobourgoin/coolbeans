# Messagerie du portail client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le formulaire support à sens unique par une messagerie de tickets bidirectionnelle (board + fil de conversation + pièces jointes), adossée aux issues Linear, avec publication des réponses `>>` par webhook + cron et notifications Resend.

**Architecture:** Linear est la surface de travail de Ludo ; D1 est le registre des tickets et le journal publié (append-only), seul lu par le portail ; R2 stocke les pièces jointes clients (bucket privé, servi via route authentifiée). Le webhook Linear alimente une file `pending_publications` en D1 ; le cron `*/5` existant (aujourd'hui no-op) publie les commentaires `>>` après délai de grâce (re-fetch du contenu final) et envoie les emails Resend.

**Tech Stack:** Astro 7 SSR (`prerender = false`) sur Cloudflare Workers (@astrojs/cloudflare 14), Clerk (@clerk/astro 4), D1, R2, KV (quota existant), Resend 6, Vitest, Tailwind 4 sur tokens `global.css`.

**Spec:** `docs/superpowers/specs/2026-08-15-messagerie-portail-design.md`

## Global Constraints

- Toute copie visible est en français ; vocabulaire client : « demande » / « message », jamais « issue ».
- Dates au format `YYYY-MM-DD` ; timestamps stockés en ISO-8601 UTC (`new Date().toISOString()`).
- CSS : utilitaires Tailwind branchés sur les tokens de `global.css` ; ne JAMAIS utiliser la classe `card` (piège de spécificité `.doc-root .card`, cf. `SupportForm.astro`).
- Git : `git add` **sélectif** uniquement (jamais `-A`), un commit par tâche minimum, messages `type(portail): …` en français.
- Aucune publication en production : on travaille sur `staging`, `git push` déploie staging automatiquement. Les commandes `wrangler` distantes ci-dessous visent staging sauf mention explicite ; les commandes prod sont notées « à exécuter par Ludo ».
- Secrets : jamais en clair dans le repo. `wrangler secret put` + `.dev.vars` local + déclaration dans `src/worker-env.d.ts` (pattern existant).
- Suppressions de fichiers prévues et validées par ce plan (validation du plan = accord explicite) : `src/components/portail/SupportForm.astro`, `src/pages/api/support.ts`. Aucune autre suppression sans redemander.
- Style de commentaires : français, expliquer le « pourquoi », même densité que l'existant.
- Tests Vitest colocalisés (`*.test.ts`) ; les fonctions testables prennent leurs dépendances en argument (pattern `*In` de `clients.ts` — `astro:content` et les bindings CF sont indisponibles sous Vitest).
- `npm test` (vitest run) doit passer à la fin de chaque tâche.
- Constante partagée : l'UUID Linear de Ludo est `a0b540c7-877f-484b-84cf-b768b457ef36` (vérifié sur AMU-36 `createdById`).

---

### Task 1: Infra — D1, R2, bindings et types

**Files:**
- Create: `migrations/0001_messagerie.sql`
- Modify: `wrangler.jsonc`
- Modify: `src/worker-env.d.ts`
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: rien.
- Produces: bindings `env.PORTAL_DB` (D1Database) et `env.PORTAL_FILES` (R2Bucket) typés via `wrangler types` ; secret optionnel `env.LINEAR_WEBHOOK_SECRET` ; tables `tickets`, `messages`, `attachments`, `pending_publications`.

- [ ] **Step 1: Créer les bases et le bucket (staging + prod)**

```bash
npx wrangler d1 create coolbeans-portal
npx wrangler d1 create coolbeans-portal-staging
npx wrangler r2 bucket create coolbeans-portal-fichiers
npx wrangler r2 bucket create coolbeans-portal-fichiers-staging
```

Noter les deux `database_id` retournés par `d1 create` — ils vont dans wrangler.jsonc à l'étape 3.

- [ ] **Step 2: Écrire la migration**

`migrations/0001_messagerie.sql` :

```sql
-- Messagerie du portail (spec 2026-08-15-messagerie-portail-design.md §4).
-- D1 = registre des tickets + journal publié APPEND-ONLY : messages ne
-- contient que du contenu publié, jamais de brouillon. La file d'attente du
-- délai de grâce vit dans pending_publications, purgée après publication.

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,                -- slug du registre src/content/clients/
  linear_issue_uuid TEXT,              -- UUID interne Linear (jamais AMU-36) ; NULL si création Linear en échec, ré-appairable
  linear_issue_url TEXT,
  author_clerk_id TEXT NOT NULL,
  author_prenom TEXT NOT NULL,         -- copié à la création : le board n'appelle pas Clerk
  author_email TEXT NOT NULL,          -- destinataire des notifications du fil
  created_via TEXT NOT NULL DEFAULT 'portail' CHECK (created_via IN ('portail', 'admin')),
  objet TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);
CREATE INDEX idx_tickets_client ON tickets(client, last_message_at DESC);
CREATE UNIQUE INDEX idx_tickets_issue ON tickets(linear_issue_uuid);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  direction TEXT NOT NULL CHECK (direction IN ('client', 'coolbeans')),
  body TEXT NOT NULL,                  -- markdown, figé à la publication
  linear_comment_id TEXT UNIQUE,       -- idempotence webhook ; NULL pour les messages client
  email_status TEXT NOT NULL DEFAULT 'none' CHECK (email_status IN ('none', 'sent', 'failed')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_ticket ON messages(ticket_id, created_at);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL
);
CREATE INDEX idx_attachments_message ON attachments(message_id);

-- File du délai de grâce : une ligne par commentaire ">>" détecté par le
-- webhook, consommée par le cron une fois publish_after dépassé.
CREATE TABLE pending_publications (
  linear_comment_id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  publish_after TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_pending_due ON pending_publications(publish_after);
```

- [ ] **Step 3: Déclarer les bindings dans `wrangler.jsonc`**

À la racine (à côté de `kv_namespaces`) — commentaire compris, même style que le fichier :

```jsonc
// Messagerie du portail : D1 (tickets + journal publié) et R2 (pièces
// jointes clients, bucket PRIVÉ — servi via /api/messagerie/fichier/[id]).
// Comme kv_namespaces, ces clés ne sont PAS héritées par les environnements
// nommés : duplication obligatoire dans env.staging.
"d1_databases": [
  { "binding": "PORTAL_DB", "database_name": "coolbeans-portal", "database_id": "<ID_PROD_ÉTAPE_1>" }
],
"r2_buckets": [
  { "binding": "PORTAL_FILES", "bucket_name": "coolbeans-portal-fichiers" }
],
```

Et dans `env.staging` (après le bloc `kv_namespaces` existant) :

```jsonc
"d1_databases": [
  { "binding": "PORTAL_DB", "database_name": "coolbeans-portal-staging", "database_id": "<ID_STAGING_ÉTAPE_1>" }
],
"r2_buckets": [
  { "binding": "PORTAL_FILES", "bucket_name": "coolbeans-portal-fichiers-staging" }
],
```

- [ ] **Step 4: Déclarer le futur secret webhook**

Dans `src/worker-env.d.ts`, ajouter à `PortalSecrets` (même style de doc que `LINEAR_API_KEY`) :

```ts
  /**
   * Secret de signature du webhook Linear (Settings → API → Webhooks) :
   * vérification HMAC-SHA256 dans /api/linear-webhook. `wrangler secret put
   * LINEAR_WEBHOOK_SECRET` sur chaque environnement, `.dev.vars` en local.
   */
  LINEAR_WEBHOOK_SECRET?: string;
```

Ajouter `LINEAR_WEBHOOK_SECRET=` à `.dev.vars.example`.

- [ ] **Step 5: Appliquer la migration et régénérer les types**

```bash
npx wrangler d1 migrations apply coolbeans-portal-staging --remote --env staging
npx wrangler d1 migrations apply coolbeans-portal --local
npx wrangler types
```

Expected: migration OK, `worker-configuration.d.ts` régénéré contient `PORTAL_DB: D1Database` et `PORTAL_FILES: R2Bucket`. (La migration **prod** `--remote` sans `--env` : à exécuter par Ludo au moment du go prod.)

- [ ] **Step 6: Vérifier la compilation et commit**

```bash
npm run build && npm test
git add migrations/0001_messagerie.sql wrangler.jsonc src/worker-env.d.ts .dev.vars.example worker-configuration.d.ts
git commit -m "feat(portail): infra messagerie — D1, R2, secret webhook (bindings + migration)"
```

---

### Task 2: Registre client — `linearSupportProjectId` + projets Support Linear

**Files:**
- Modify: `src/content.config.ts` (collection `clients`)
- Modify: `src/lib/portail/clients.ts`
- Modify: `src/lib/portail/clients.test.ts`
- Modify: `src/content/clients/amusoire.yaml`, `src/content/clients/coolbeans.yaml`

**Interfaces:**
- Consumes: schéma clients existant (`linearTeamId`).
- Produces: `PortalClient.linearSupportProjectId?: string` ; `MODULE_REQUIREMENTS.support = ["linearTeamId", "linearSupportProjectId"]`.

- [ ] **Step 1: Créer les projets « Support » dans Linear (prérequis manuel scriptable)**

Un projet evergreen par team cliente, sans target date. Via l'API (la skill `linear` interdit à juste titre la création de projets, on passe par curl ; `$LINEAR_API_KEY` depuis `.dev.vars`) :

```bash
# Team Amusoire : 4a7e6081-5498-418a-a12c-b155ce10bc33
# Team Coolbeans : 64bf4683-6650-4250-96bc-0e7cb7df7ea2
curl -s https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"mutation($input: ProjectCreateInput!){ projectCreate(input:$input){ project { id name } } }","variables":{"input":{"name":"Support","teamIds":["4a7e6081-5498-418a-a12c-b155ce10bc33"]}}}'
# répéter avec l'autre teamId ; noter les deux project.id
```

- [ ] **Step 2: Test d'abord — exigence de mapping**

Dans `src/lib/portail/clients.test.ts`, ajouter :

```ts
test("le module support exige la team ET le projet Support Linear", () => {
  expect(MODULE_REQUIREMENTS.support).toEqual(["linearTeamId", "linearSupportProjectId"]);
});
```

Run: `npm test` → FAIL (le tableau ne contient que `linearTeamId`).

- [ ] **Step 3: Implémenter**

`src/content.config.ts`, schéma `clients`, sous `linearTeamId` :

```ts
    // UUID du projet « Support » (evergreen) de la team du client : la
    // messagerie y crée ses tickets. Absent = module Messagerie en empty state.
    linearSupportProjectId: z.string().optional(),
```

`src/lib/portail/clients.ts` : ajouter `linearSupportProjectId?: string;` à `PortalClient` (docstring même style), `"linearSupportProjectId"` à `ClientMappingKey`, et `support: ["linearTeamId", "linearSupportProjectId"]` dans `MODULE_REQUIREMENTS`. Vérifier l'endroit où les fiches YAML sont converties en `PortalClient` (même fichier ou `context.ts`) et propager le champ.

Dans les deux YAML, ajouter la ligne `linearSupportProjectId: <id de l'étape 1>`.

- [ ] **Step 4: Vérifier et commit**

```bash
npm test && npm run build
git add src/content.config.ts src/lib/portail/clients.ts src/lib/portail/clients.test.ts src/content/clients/amusoire.yaml src/content/clients/coolbeans.yaml
git commit -m "feat(portail): registre client — projet Support Linear par team"
```

---

### Task 3: Lib pure — statuts, urgence, marqueur `>>`

**Files:**
- Create: `src/lib/portail/messagerie/regles.ts`
- Test: `src/lib/portail/messagerie/regles.test.ts`

**Interfaces:**
- Consumes: rien (fonctions pures).
- Produces:
  - `type StatutTicket = "en_attente" | "en_cours" | "traite" | "inconnu"`
  - `STATUT_LABEL: Record<StatutTicket, string>` (« En attente », « En cours », « Traité », « — »)
  - `statutFromStateType(t: string | undefined): StatutTicket`
  - `prioriteFromUrgence(u: string | null | undefined): number` (1-4)
  - `URGENCES: Array<{ value: string; label: string }>` (options du `<select>`)
  - `corpsPublie(body: string): string | null` (retire `>>`, null si non publiable)
  - `retireImagesLinear(md: string): { texte: string; imagesRetirees: number }`

- [ ] **Step 1: Écrire les tests**

`src/lib/portail/messagerie/regles.test.ts` :

```ts
import { describe, expect, test } from "vitest";
import {
  corpsPublie,
  prioriteFromUrgence,
  retireImagesLinear,
  statutFromStateType,
} from "./regles";

describe("statutFromStateType", () => {
  test.each([
    ["triage", "en_attente"],
    ["backlog", "en_attente"],
    ["unstarted", "en_attente"],
    ["started", "en_cours"],
    ["completed", "traite"],
    ["canceled", "traite"],
  ])("%s → %s", (type, statut) => {
    expect(statutFromStateType(type)).toBe(statut);
  });
  test("type inconnu ou absent → inconnu (issue supprimée non réparée)", () => {
    expect(statutFromStateType(undefined)).toBe("inconnu");
    expect(statutFromStateType("n_importe_quoi")).toBe("inconnu");
  });
});

describe("prioriteFromUrgence", () => {
  test.each([
    ["bloquant", 1],
    ["urgent", 2],
    ["normal", 3],
    ["pas-presse", 4],
  ])("%s → %i", (urgence, prio) => {
    expect(prioriteFromUrgence(urgence)).toBe(prio);
  });
  test("sans choix → Medium (spec §5)", () => {
    expect(prioriteFromUrgence(null)).toBe(3);
    expect(prioriteFromUrgence("")).toBe(3);
  });
});

describe("corpsPublie", () => {
  test("retire le marqueur et l'espace qui suit", () => {
    expect(corpsPublie(">> C'est en ligne !")).toBe("C'est en ligne !");
    expect(corpsPublie(">>Sans espace")).toBe("Sans espace");
  });
  test("commentaire interne → null", () => {
    expect(corpsPublie("Note interne")).toBeNull();
    expect(corpsPublie(" >> marqueur pas en tête")).toBeNull();
  });
  test("marqueur seul (>> retiré à l'édition pendant le délai) → null", () => {
    expect(corpsPublie(">>")).toBeNull();
    expect(corpsPublie(">>   ")).toBeNull();
  });
});

describe("retireImagesLinear", () => {
  test("retire les images du CDN privé Linear et les compte", () => {
    const md = "Voilà :\n\n![capture](https://uploads.linear.app/abc/def.png)\n\nDis-moi.";
    const { texte, imagesRetirees } = retireImagesLinear(md);
    expect(imagesRetirees).toBe(1);
    expect(texte).not.toContain("uploads.linear.app");
    expect(texte).toContain("Dis-moi.");
  });
  test("texte sans image inchangé", () => {
    const { texte, imagesRetirees } = retireImagesLinear("Rien à voir ici.");
    expect(imagesRetirees).toBe(0);
    expect(texte).toBe("Rien à voir ici.");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test` → FAIL (« Cannot find module './regles' »).

- [ ] **Step 3: Implémenter `regles.ts`**

```ts
// Règles pures de la messagerie (spec 2026-08-15-messagerie-portail-design.md).
// Aucune dépendance : tout est testable sous Vitest sans bindings CF.

/** Statuts affichés au client — mapping par statusType Linear, JAMAIS par
 *  nom d'état (les noms sont propres à chaque team, le type est stable). */
export type StatutTicket = "en_attente" | "en_cours" | "traite" | "inconnu";

export const STATUT_LABEL: Record<StatutTicket, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  traite: "Traité",
  inconnu: "—", // issue introuvable (supprimée, non ré-appairée) : pas d'erreur anxiogène
};

export function statutFromStateType(t: string | undefined): StatutTicket {
  if (t === "triage" || t === "backlog" || t === "unstarted") return "en_attente";
  if (t === "started") return "en_cours";
  if (t === "completed" || t === "canceled") return "traite";
  return "inconnu";
}

/** Options du champ urgence du formulaire, dans l'ordre d'affichage. */
export const URGENCES = [
  { value: "pas-presse", label: "Pas pressé" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "bloquant", label: "Bloquant" },
] as const;

/** Urgence portail → priorité Linear (échelle globale 1-4). Sans choix : Medium. */
export function prioriteFromUrgence(u: string | null | undefined): number {
  switch (u) {
    case "bloquant":
      return 1;
    case "urgent":
      return 2;
    case "pas-presse":
      return 4;
    default:
      return 3;
  }
}

/** Marqueur de publication : un commentaire Linear qui commence par ">>". */
const MARQUEUR = ">>";

/**
 * Corps publiable d'un commentaire, ou null s'il ne doit pas partir : pas de
 * marqueur en tête (note interne), ou plus de contenu (le ">>" a été retiré à
 * l'édition pendant le délai de grâce = annulation).
 */
export function corpsPublie(body: string): string | null {
  if (!body.startsWith(MARQUEUR)) return null;
  const corps = body.slice(MARQUEUR.length).trim();
  return corps || null;
}

/**
 * Retire les images du CDN privé Linear (uploads.linear.app, authentifié :
 * les URLs seraient mortes chez le client — spec §7). Retourne le compte pour
 * alerter Ludo à la publication.
 */
export function retireImagesLinear(md: string): { texte: string; imagesRetirees: number } {
  let imagesRetirees = 0;
  const texte = md
    .replace(/!\[[^\]]*\]\([^)]*uploads\.linear\.app[^)]*\)/g, () => {
      imagesRetirees += 1;
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { texte, imagesRetirees };
}
```

- [ ] **Step 4: Vérifier et commit**

```bash
npm test
git add src/lib/portail/messagerie/regles.ts src/lib/portail/messagerie/regles.test.ts
git commit -m "feat(portail): règles pures de la messagerie (statuts, urgence, marqueur >>)"
```

---

### Task 4: Lib Linear — projet, assignation, priorité, commentaires, statuts

**Files:**
- Modify: `src/lib/portail/linear.ts`

**Interfaces:**
- Consumes: `graphql()` privé existant, `createSupportTicket` existant.
- Produces (tous exportés de `src/lib/portail/linear.ts`) :
  - `LUDO_LINEAR_USER_ID: string`
  - `createSupportTicket(options)` étendu : options gagnent `projectId?: string; assigneeId?: string; priority?: number`, retour gagne `issueId: string` (UUID)
  - `createComment(options: { apiKey: string; issueId: string; body: string }): Promise<{ id: string }>`
  - `fetchComment(apiKey: string, commentId: string): Promise<{ body: string; issueId: string } | null>` (null = supprimé → annulation)
  - `fetchIssueStateTypes(apiKey: string, uuids: string[]): Promise<Map<string, string>>` (UUID → `state.type`, archivées incluses ; UUID absent de la Map = introuvable)

- [ ] **Step 1: Étendre `createSupportTicket`**

Dans l'interface d'options, ajouter :

```ts
  /** Projet « Support » de la team (spec messagerie §5). */
  projectId?: string;
  /** Auto-assignation (Ludo) — spec messagerie §5. */
  assigneeId?: string;
  /** Priorité Linear 1-4 issue du champ urgence. */
  priority?: number;
```

Dans le retour GraphQL, demander aussi `id` (`issue { id identifier url }`), l'exposer comme `issueId`, et compléter l'input :

```ts
    {
      input: {
        teamId,
        title,
        description,
        ...(stateId ? { stateId } : {}),
        ...(options.projectId ? { projectId: options.projectId } : {}),
        ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
        ...(options.priority ? { priority: options.priority } : {}),
      },
    },
```

Mettre à jour `SupportTicket` : `{ issueId: string; identifier: string; url: string }`.

- [ ] **Step 2: Ajouter les nouvelles fonctions**

À la suite du fichier, même style :

```ts
/** UUID Linear de Ludo (workspace coolbeans-hq) — auto-assignation des tickets. */
export const LUDO_LINEAR_USER_ID = "a0b540c7-877f-484b-84cf-b768b457ef36";

/** Réponse d'un client depuis le portail → commentaire sur l'issue. */
export async function createComment(options: {
  apiKey: string;
  issueId: string;
  body: string;
}): Promise<{ id: string }> {
  const data = await graphql<{
    commentCreate: { success: boolean; comment: { id: string } | null };
  }>(
    options.apiKey,
    `mutation CreateComment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success comment { id } }
    }`,
    { input: { issueId: options.issueId, body: options.body } },
  );
  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error("Linear : commentCreate a échoué sans erreur GraphQL.");
  }
  return data.commentCreate.comment;
}

/**
 * Contenu ACTUEL d'un commentaire — appelé par le cron à la fin du délai de
 * grâce : c'est ce re-fetch qui fait qu'une édition corrige l'envoi et
 * qu'une suppression l'annule (spec §7). null = commentaire disparu.
 */
export async function fetchComment(
  apiKey: string,
  commentId: string,
): Promise<{ body: string; issueId: string } | null> {
  try {
    const data = await graphql<{ comment: { body: string; issue: { id: string } } | null }>(
      apiKey,
      `query Comment($id: String!) { comment(id: $id) { body issue { id } } }`,
      { id: commentId },
    );
    if (!data.comment) return null;
    return { body: data.comment.body, issueId: data.comment.issue.id };
  } catch {
    // L'API Linear répond par une erreur "entity not found" plutôt que par
    // null quand le commentaire est supprimé : même signification pour nous.
    return null;
  }
}

/**
 * statusType des issues du board, archivées comprises (une issue auto-archivée
 * reste « Traité », spec §9). Un UUID absent de la Map = issue introuvable
 * (supprimée) → statut « — » côté client.
 */
export async function fetchIssueStateTypes(
  apiKey: string,
  uuids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (uuids.length === 0) return map;
  const data = await graphql<{
    issues: { nodes: Array<{ id: string; state: { type: string } }> };
  }>(
    apiKey,
    `query IssueStates($ids: [ID!]!) {
      issues(filter: { id: { in: $ids } }, includeArchived: true) {
        nodes { id state { type } }
      }
    }`,
    { ids: uuids },
  );
  for (const node of data.issues.nodes) map.set(node.id, node.state.type);
  return map;
}
```

- [ ] **Step 3: Réparer l'appelant existant**

`src/pages/api/support.ts` consomme `createSupportTicket` : le retour a maintenant `issueId` en plus — aucun changement requis (champs additifs), vérifier que `npm run build` passe. (Ce fichier disparaît en Task 6.)

- [ ] **Step 4: Vérifier et commit**

```bash
npm test && npm run build
git add src/lib/portail/linear.ts
git commit -m "feat(portail): lib Linear — projet/assignee/priorité, commentaires, statuts batch"
```

---

### Task 5: Store D1 de la messagerie

**Files:**
- Create: `src/lib/portail/messagerie/store.ts`
- Test: `src/lib/portail/messagerie/store.test.ts`

**Interfaces:**
- Consumes: binding `D1Database` (passé en argument, jamais importé — pattern `chiffrage/store.ts`).
- Produces (toutes les fonctions prennent `db: D1Database` en premier argument) :
  - Types `TicketRow`, `MessageRow`, `AttachmentRow` (miroirs snake_case des tables)
  - `creerTicket(db, t: TicketRow): Promise<void>`
  - `ticketsDuClient(db, client: string): Promise<TicketRow[]>` (tri `last_message_at DESC`)
  - `ticketParId(db, id: string): Promise<TicketRow | null>`
  - `ticketParIssueUuid(db, uuid: string): Promise<TicketRow | null>`
  - `majIssue(db, ticketId: string, issueUuid: string, issueUrl: string): Promise<void>`
  - `ajouterMessage(db, m: MessageRow): Promise<boolean>` (false si `linear_comment_id` déjà présent — idempotence)
  - `messagesDuTicket(db, ticketId: string): Promise<MessageRow[]>`
  - `majEmailStatus(db, messageId: string, status: "sent" | "failed"): Promise<void>`
  - `ajouterPieceJointe(db, a: AttachmentRow): Promise<void>`
  - `piecesJointesDuTicket(db, ticketId: string): Promise<AttachmentRow[]>`
  - `pieceJointeParId(db, id: string): Promise<AttachmentRow | null>`
  - `enfilerPublication(db, p: { linear_comment_id: string; ticket_id: string; publish_after: string; created_at: string }): Promise<void>` (INSERT OR IGNORE)
  - `publicationsDues(db, maintenant: string): Promise<Array<{ linear_comment_id: string; ticket_id: string }>>`
  - `supprimerPublication(db, linearCommentId: string): Promise<void>`

- [ ] **Step 1: Écrire le test du contrat SQL**

D1 n'existe pas sous Vitest : on teste avec un **faux D1 minimal** qui enregistre les requêtes préparées et leurs bindings — le contrat testé est « la bonne requête, les bons paramètres, le bon mapping de retour ». `src/lib/portail/messagerie/store.test.ts` :

```ts
import { describe, expect, test } from "vitest";
import { ajouterMessage, publicationsDues, ticketsDuClient } from "./store";

/** Faux D1 : rejoue des résultats fixés et capture sql + bindings. */
function fakeDb(results: unknown[] = []) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          calls.push({ sql, binds });
          return {
            all: async () => ({ results }),
            first: async () => results[0] ?? null,
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

test("ticketsDuClient filtre par client et trie par dernier message", async () => {
  const { db, calls } = fakeDb([]);
  await ticketsDuClient(db, "amusoire");
  expect(calls[0].sql).toMatch(/WHERE client = \?/);
  expect(calls[0].sql).toMatch(/ORDER BY last_message_at DESC/);
  expect(calls[0].binds).toEqual(["amusoire"]);
});

test("ajouterMessage est idempotent sur linear_comment_id", async () => {
  const { db, calls } = fakeDb();
  await ajouterMessage(db, {
    id: "m1",
    ticket_id: "t1",
    direction: "coolbeans",
    body: "Bonjour",
    linear_comment_id: "c1",
    email_status: "none",
    created_at: "2026-08-15T10:00:00.000Z",
  });
  expect(calls[0].sql).toMatch(/INSERT OR IGNORE INTO messages/);
});

test("publicationsDues compare publish_after au temps fourni", async () => {
  const { db, calls } = fakeDb([]);
  await publicationsDues(db, "2026-08-15T10:00:00.000Z");
  expect(calls[0].sql).toMatch(/publish_after <= \?/);
  expect(calls[0].binds).toEqual(["2026-08-15T10:00:00.000Z"]);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test` → FAIL (« Cannot find module './store' »).

- [ ] **Step 3: Implémenter `store.ts`**

Accès D1 le plus plat possible : une fonction = une requête préparée, pas d'ORM, types miroirs des colonnes. Squelette complet :

```ts
// Accès D1 de la messagerie. Une fonction = une requête. Le binding est passé
// en argument (pattern *In de clients.ts) : testable sans Cloudflare.

export interface TicketRow {
  id: string;
  client: string;
  linear_issue_uuid: string | null;
  linear_issue_url: string | null;
  author_clerk_id: string;
  author_prenom: string;
  author_email: string;
  created_via: "portail" | "admin";
  objet: string;
  created_at: string;
  last_message_at: string;
}

export interface MessageRow {
  id: string;
  ticket_id: string;
  direction: "client" | "coolbeans";
  body: string;
  linear_comment_id: string | null;
  email_status: "none" | "sent" | "failed";
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  r2_key: string;
  filename: string;
  size: number;
  mime: string;
}

export async function creerTicket(db: D1Database, t: TicketRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tickets (id, client, linear_issue_uuid, linear_issue_url, author_clerk_id,
         author_prenom, author_email, created_via, objet, created_at, last_message_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      t.id, t.client, t.linear_issue_uuid, t.linear_issue_url, t.author_clerk_id,
      t.author_prenom, t.author_email, t.created_via, t.objet, t.created_at, t.last_message_at,
    )
    .run();
}

export async function ticketsDuClient(db: D1Database, client: string): Promise<TicketRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tickets WHERE client = ? ORDER BY last_message_at DESC`)
    .bind(client)
    .all<TicketRow>();
  return results;
}

export async function ticketParId(db: D1Database, id: string): Promise<TicketRow | null> {
  return db.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first<TicketRow>();
}

export async function ticketParIssueUuid(db: D1Database, uuid: string): Promise<TicketRow | null> {
  return db
    .prepare(`SELECT * FROM tickets WHERE linear_issue_uuid = ?`)
    .bind(uuid)
    .first<TicketRow>();
}

export async function majIssue(
  db: D1Database, ticketId: string, issueUuid: string, issueUrl: string,
): Promise<void> {
  await db
    .prepare(`UPDATE tickets SET linear_issue_uuid = ?, linear_issue_url = ? WHERE id = ?`)
    .bind(issueUuid, issueUrl, ticketId)
    .run();
}

/** false = commentaire déjà publié (webhook rejoué) : ne rien renvoyer deux fois. */
export async function ajouterMessage(db: D1Database, m: MessageRow): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO messages (id, ticket_id, direction, body, linear_comment_id, email_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(m.id, m.ticket_id, m.direction, m.body, m.linear_comment_id, m.email_status, m.created_at)
    .run();
  const insere = res.meta.changes > 0;
  if (insere) {
    await db
      .prepare(`UPDATE tickets SET last_message_at = ? WHERE id = ?`)
      .bind(m.created_at, m.ticket_id)
      .run();
  }
  return insere;
}

export async function messagesDuTicket(db: D1Database, ticketId: string): Promise<MessageRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at`)
    .bind(ticketId)
    .all<MessageRow>();
  return results;
}

export async function majEmailStatus(
  db: D1Database, messageId: string, status: "sent" | "failed",
): Promise<void> {
  await db.prepare(`UPDATE messages SET email_status = ? WHERE id = ?`).bind(status, messageId).run();
}

export async function ajouterPieceJointe(db: D1Database, a: AttachmentRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO attachments (id, message_id, r2_key, filename, size, mime) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(a.id, a.message_id, a.r2_key, a.filename, a.size, a.mime)
    .run();
}

export async function piecesJointesDuTicket(
  db: D1Database, ticketId: string,
): Promise<AttachmentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.* FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.ticket_id = ?`,
    )
    .bind(ticketId)
    .all<AttachmentRow>();
  return results;
}

export async function pieceJointeParId(db: D1Database, id: string): Promise<AttachmentRow | null> {
  return db.prepare(`SELECT * FROM attachments WHERE id = ?`).bind(id).first<AttachmentRow>();
}

export async function enfilerPublication(
  db: D1Database,
  p: { linear_comment_id: string; ticket_id: string; publish_after: string; created_at: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO pending_publications (linear_comment_id, ticket_id, publish_after, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(p.linear_comment_id, p.ticket_id, p.publish_after, p.created_at)
    .run();
}

export async function publicationsDues(
  db: D1Database, maintenant: string,
): Promise<Array<{ linear_comment_id: string; ticket_id: string }>> {
  const { results } = await db
    .prepare(`SELECT linear_comment_id, ticket_id FROM pending_publications WHERE publish_after <= ?`)
    .bind(maintenant)
    .all<{ linear_comment_id: string; ticket_id: string }>();
  return results;
}

export async function supprimerPublication(db: D1Database, linearCommentId: string): Promise<void> {
  await db
    .prepare(`DELETE FROM pending_publications WHERE linear_comment_id = ?`)
    .bind(linearCommentId)
    .run();
}
```

- [ ] **Step 4: Vérifier et commit**

```bash
npm test
git add src/lib/portail/messagerie/store.ts src/lib/portail/messagerie/store.test.ts
git commit -m "feat(portail): store D1 de la messagerie (tickets, journal, file de publication)"
```

---

### Task 6: API — création de ticket (remplace /api/support)

**Files:**
- Create: `src/pages/api/messagerie/nouveau.ts`
- Create: `src/lib/portail/messagerie/fichiers.ts`
- Test: `src/lib/portail/messagerie/fichiers.test.ts`
- Delete: `src/pages/api/support.ts` (validé en tête de plan)

**Interfaces:**
- Consumes: `getPortalContext` (session + client courant), `creerTicket`/`majIssue`/`ajouterMessage`/`ajouterPieceJointe` (Task 5), `createSupportTicket` étendu + `LUDO_LINEAR_USER_ID` (Task 4), `prioriteFromUrgence` (Task 3), quota KV et emails Resend repris tels quels de `/api/support`.
- Produces: `POST /api/messagerie/nouveau` (multipart/form-data : `objet` requis, `description`, `urgence`, `fichiers[]`) → `{ ok: true, ticketId }` ; helper `validerFichiers(files: File[]): string | null` (message d'erreur ou null) et `cleR2(client: string, ticketId: string, filename: string): string`.

- [ ] **Step 1: Tests du helper fichiers**

`src/lib/portail/messagerie/fichiers.test.ts` :

```ts
import { describe, expect, test } from "vitest";
import { cleR2, validerFichiers } from "./fichiers";

const fichier = (name: string, size: number) =>
  new File([new Uint8Array(size)], name, { type: "image/png" });

describe("validerFichiers", () => {
  test("accepte 0 à 3 fichiers de 10 Mo max", () => {
    expect(validerFichiers([])).toBeNull();
    expect(validerFichiers([fichier("a.png", 1024)])).toBeNull();
  });
  test("refuse plus de 3 fichiers", () => {
    const quatre = [1, 2, 3, 4].map((i) => fichier(`${i}.png`, 10));
    expect(validerFichiers(quatre)).toMatch(/3 fichiers/);
  });
  test("refuse un fichier de plus de 10 Mo", () => {
    expect(validerFichiers([fichier("gros.png", 10 * 1024 * 1024 + 1)])).toMatch(/10 Mo/);
  });
});

describe("cleR2", () => {
  test("préfixe par client et ticket, garde l'extension, neutralise le nom", () => {
    const cle = cleR2("amusoire", "t1", "Ma capture (1).PNG");
    expect(cle).toMatch(/^messagerie\/amusoire\/t1\/[0-9a-f-]{36}\.png$/);
  });
});
```

- [ ] **Step 2: Vérifier l'échec puis implémenter `fichiers.ts`**

```ts
// Contraintes des pièces jointes (spec §4) et nommage des clés R2. Le nom
// d'origine du fichier ne sert JAMAIS de clé (traversée, collisions,
// caractères exotiques) : il est conservé en métadonnée D1 pour l'affichage.

export const MAX_FICHIERS = 3;
export const MAX_TAILLE = 10 * 1024 * 1024; // 10 Mo

export function validerFichiers(files: File[]): string | null {
  if (files.length > MAX_FICHIERS) {
    return `Au maximum ${MAX_FICHIERS} fichiers par message.`;
  }
  for (const f of files) {
    if (f.size > MAX_TAILLE) return `Chaque fichier doit faire moins de 10 Mo (« ${f.name} »).`;
  }
  return null;
}

export function cleR2(client: string, ticketId: string, filename: string): string {
  const ext = /\.([a-zA-Z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "bin";
  return `messagerie/${client}/${ticketId}/${crypto.randomUUID()}.${ext}`;
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: Écrire `nouveau.ts`**

Reprendre la structure de `/api/support.ts` (mêmes gardes, mêmes messages, même quota KV `support:quota:*`, mêmes deux emails Resend — notification interne et accusé de réception), avec ces changements :

```ts
// Création d'un ticket de messagerie (spec 2026-08-15-messagerie-portail-design.md).
// Ordre des opérations, du bloquant au best-effort — D1 D'ABORD (§6 : si la
// création Linear échoue, le ticket existe côté client et sera ré-appairé) :
//   1. session + validation + mappings client (team ET projet Support) ;
//   2. quota journalier KV (repris tel quel de l'ancien /api/support) ;
//   3. ligne D1 tickets + message initial + upload R2 des pièces jointes ;
//   4. issue Linear (projet Support, assignée à Ludo, priorité) → majIssue ;
//   5. emails Resend (interne + accusé) — best-effort.
```

Corps de la logique (les gardes 1-2 sont celles de l'ancien fichier, adaptées à `request.formData()`) :

```ts
  const fd = await request.formData();
  const objet = String(fd.get("objet") ?? "").trim().slice(0, 200);
  const description = String(fd.get("description") ?? "").trim().slice(0, 5000);
  const urgence = String(fd.get("urgence") ?? "");
  const fichiers = fd.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (!objet) return json({ error: "L'objet est obligatoire." }, 400);
  const erreurFichiers = validerFichiers(fichiers);
  if (erreurFichiers) return json({ error: erreurFichiers }, 400);
  if (!client?.linearTeamId || !client?.linearSupportProjectId) {
    return json({ error: `La messagerie n'est pas encore raccordée — ${CONTACT_DIRECT}.` }, 409);
  }

  const maintenant = new Date().toISOString();
  const ticketId = crypto.randomUUID();
  await creerTicket(env.PORTAL_DB, {
    id: ticketId,
    client: client.slug,
    linear_issue_uuid: null,
    linear_issue_url: null,
    author_clerk_id: user.id,
    author_prenom: user.firstName ?? "Client",
    author_email: emailClient ?? "",
    created_via: "portail",
    objet,
    created_at: maintenant,
    last_message_at: maintenant,
  });
  const messageId = crypto.randomUUID();
  if (description) {
    await ajouterMessage(env.PORTAL_DB, {
      id: messageId, ticket_id: ticketId, direction: "client", body: description,
      linear_comment_id: null, email_status: "none", created_at: maintenant,
    });
  }
  const liens: string[] = [];
  for (const f of fichiers) {
    const cle = cleR2(client.slug, ticketId, f.name);
    await env.PORTAL_FILES.put(cle, f.stream(), { httpMetadata: { contentType: f.type } });
    const pieceId = crypto.randomUUID();
    await ajouterPieceJointe(env.PORTAL_DB, {
      id: pieceId, message_id: messageId, r2_key: cle, filename: f.name, size: f.size, mime: f.type,
    });
    liens.push(`[${f.name}](https://my.coolbeans.cc/api/messagerie/fichier/${pieceId})`);
  }
```

Puis la création Linear (best-effort désormais : un échec NE fait PAS échouer la requête, spec §9) :

```ts
  try {
    const ticket = await createSupportTicket({
      apiKey,
      teamId: client.linearTeamId,
      projectId: client.linearSupportProjectId,
      assigneeId: LUDO_LINEAR_USER_ID,
      priority: prioriteFromUrgence(urgence),
      title: objet,
      description: descriptionTicket + (liens.length ? `\n\nPièces jointes :\n${liens.join("\n")}` : ""),
    });
    await majIssue(env.PORTAL_DB, ticketId, ticket.issueId, ticket.url);
  } catch (err) {
    console.error("messagerie: création issue Linear échouée, ticket D1 orphelin à reprendre", err);
  }
```

Les emails Resend sont repris de l'ancien fichier à l'identique (mêmes templates, mêmes `from`), la réponse devient `json({ ok: true, ticketId }, 200)`. Supprimer `src/pages/api/support.ts` (`git rm`).

- [ ] **Step 4: Vérification manuelle**

```bash
npm run build && npm test
# smoke test local :
npx wrangler dev  # ou le daemon astro dev du projet
curl -s -X POST http://localhost:4321/api/messagerie/nouveau -F objet=Test -F description=Essai
# Expected sans session Clerk : la garde session répond 401/redirect — la
# création réelle se teste en navigateur sur staging (Task 12).
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/messagerie/nouveau.ts src/lib/portail/messagerie/fichiers.ts src/lib/portail/messagerie/fichiers.test.ts
git rm src/pages/api/support.ts
git commit -m "feat(portail): création de ticket messagerie (D1 d'abord, R2, Linear best-effort)"
```

---

### Task 7: API — réponse client et téléchargement de fichier

**Files:**
- Create: `src/pages/api/messagerie/reponse.ts`
- Create: `src/pages/api/messagerie/fichier/[id].ts`

**Interfaces:**
- Consumes: store (Task 5), `createComment` (Task 4), `validerFichiers`/`cleR2` (Task 6), `renderTransactionnel` + helpers.
- Produces: `POST /api/messagerie/reponse` (multipart : `ticketId`, `message`, `fichiers[]`) → `{ ok: true }` ; `GET /api/messagerie/fichier/[id]` → stream R2 authentifié.

- [ ] **Step 1: Écrire `reponse.ts`**

```ts
// Réponse d'un client sur un ticket (spec §6) : D1 (journal) PUIS commentaire
// Linear PUIS email à Ludo — les deux derniers best-effort, le portail fait foi.
// Garde d'accès : le ticket doit appartenir au client courant de la session
// (portée organisation, spec §6 — pas de garde par auteur).
```

Logique complète :

```ts
  const fd = await request.formData();
  const ticketId = String(fd.get("ticketId") ?? "");
  const message = String(fd.get("message") ?? "").trim().slice(0, 5000);
  const fichiers = fd.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (!message && fichiers.length === 0) return json({ error: "Le message est vide." }, 400);
  const erreurFichiers = validerFichiers(fichiers);
  if (erreurFichiers) return json({ error: erreurFichiers }, 400);

  const ticket = await ticketParId(env.PORTAL_DB, ticketId);
  if (!ticket || ticket.client !== client?.slug) return json({ error: "Ticket introuvable." }, 404);

  const maintenant = new Date().toISOString();
  const messageId = crypto.randomUUID();
  await ajouterMessage(env.PORTAL_DB, {
    id: messageId, ticket_id: ticketId, direction: "client", body: message,
    linear_comment_id: null, email_status: "none", created_at: maintenant,
  });
  const liens: string[] = [];
  for (const f of fichiers) { /* même boucle R2 + ajouterPieceJointe + liens que nouveau.ts */ }

  // Commentaire Linear : posté via le token de Ludo, donc Linear ne le
  // notifiera pas — c'est l'email Resend ci-dessous qui prévient (spec §7).
  if (ticket.linear_issue_uuid && env.LINEAR_API_KEY) {
    try {
      await createComment({
        apiKey: env.LINEAR_API_KEY,
        issueId: ticket.linear_issue_uuid,
        body: `**${ticket.author_prenom} (portail)** :\n\n${message}` +
          (liens.length ? `\n\nPièces jointes :\n${liens.join("\n")}` : ""),
      });
    } catch (err) {
      console.error("messagerie: commentaire Linear non posté (le journal D1 fait foi)", err);
    }
  }
```

Email à Ludo avec `renderTransactionnel` (kicker `Messagerie · ${client.nom}`, titre « Réponse de {prenom} », citation du message, CTA « Ouvrir dans Linear » vers `ticket.linear_issue_url` si présent), `from: "Support Coolbeans <support@coolbeans.cc>"`, `to: "ludo@coolbeans.cc"` — best-effort, même pattern try/catch que l'existant.

- [ ] **Step 2: Écrire `fichier/[id].ts`**

```ts
// Téléchargement d'une pièce jointe. R2 est PRIVÉ (spec §4) : session Clerk
// + le fichier doit appartenir à un ticket du client courant. L'admin passe
// par le même chemin (son client courant suit le sélecteur).
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../../lib/portail/context";
import { pieceJointeParId, ticketParId } from "../../../../lib/portail/messagerie/store";
import { messageParId } from "../../../../lib/portail/messagerie/store";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { client } = await getPortalContext(context);
  const piece = await pieceJointeParId(env.PORTAL_DB, context.params.id ?? "");
  if (!piece) return new Response("Introuvable", { status: 404 });
  const message = await messageParId(env.PORTAL_DB, piece.message_id);
  const ticket = message ? await ticketParId(env.PORTAL_DB, message.ticket_id) : null;
  if (!ticket || ticket.client !== client?.slug) return new Response("Introuvable", { status: 404 });

  const objet = await env.PORTAL_FILES.get(piece.r2_key);
  if (!objet) return new Response("Fichier absent du stockage", { status: 404 });
  return new Response(objet.body, {
    headers: {
      "content-type": piece.mime || "application/octet-stream",
      "content-disposition": `inline; filename="${piece.filename.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=3600",
    },
  });
};
```

Ajouter au store (Task 5, même fichier) la fonction manquante `messageParId(db, id): Promise<MessageRow | null>` (SELECT par PK, même forme que `ticketParId`).

NB signature `getPortalContext` : le fichier existant `/api/support.ts` montre l'appel exact côté API route — reprendre la même forme.

- [ ] **Step 3: Vérifier et commit**

```bash
npm run build && npm test
git add src/pages/api/messagerie/reponse.ts src/pages/api/messagerie/fichier/ src/lib/portail/messagerie/store.ts
git commit -m "feat(portail): réponse client (D1 + commentaire Linear) et fichiers R2 authentifiés"
```

---

### Task 8: Webhook Linear — signature et mise en file

**Files:**
- Create: `src/pages/api/linear-webhook.ts`
- Create: `src/lib/portail/messagerie/webhook.ts`
- Test: `src/lib/portail/messagerie/webhook.test.ts`

**Interfaces:**
- Consumes: `corpsPublie` (Task 3), `ticketParIssueUuid` + `enfilerPublication` (Task 5).
- Produces: `POST /api/linear-webhook` (réponses : 200 traité/ignoré, 401 signature invalide) ; lib `signatureValide(secret, rawBody, signature): Promise<boolean>` et `analyserEvenement(payload): { commentId: string; issueId: string; body: string } | null`.

- [ ] **Step 1: Écrire les tests**

`src/lib/portail/messagerie/webhook.test.ts` :

```ts
import { describe, expect, test } from "vitest";
import { analyserEvenement, signatureValide } from "./webhook";

describe("signatureValide", () => {
  test("accepte le HMAC-SHA256 hex du corps brut", async () => {
    // Vecteur calculé une fois pour toutes : HMAC-SHA256("secret", "corps")
    const attendu = "97b8ef96e2bd57d68f0d99e1e59932be9678272dcd7f31d34a566c1cf1a9ab74";
    expect(await signatureValide("secret", "corps", attendu)).toBe(true);
  });
  test("refuse une signature absente ou fausse", async () => {
    expect(await signatureValide("secret", "corps", null)).toBe(false);
    expect(await signatureValide("secret", "corps", "deadbeef")).toBe(false);
  });
});

describe("analyserEvenement", () => {
  const commentaire = (body: string) => ({
    action: "create",
    type: "Comment",
    data: { id: "c1", body, issueId: "i1" },
  });
  test("retient un commentaire créé commençant par >>", () => {
    expect(analyserEvenement(commentaire(">> Bonjour"))).toEqual({
      commentId: "c1",
      issueId: "i1",
      body: ">> Bonjour",
    });
  });
  test("ignore les notes internes, les updates et les autres types", () => {
    expect(analyserEvenement(commentaire("note interne"))).toBeNull();
    expect(analyserEvenement({ ...commentaire(">> x"), action: "update" })).toBeNull();
    expect(analyserEvenement({ action: "create", type: "Issue", data: {} })).toBeNull();
  });
});
```

Avant d'écrire le vecteur du premier test, le calculer réellement :

```bash
node -e 'const c=require("crypto");console.log(c.createHmac("sha256","secret").update("corps").digest("hex"))'
```

et remplacer la constante `attendu` par la valeur imprimée.

- [ ] **Step 2: Vérifier l'échec puis implémenter `webhook.ts`**

```ts
// Analyse et authentification des webhooks Linear (spec §7, §9).
// La signature est un HMAC-SHA256 hex du CORPS BRUT, header `linear-signature`.
// Sans vérification, n'importe qui pourrait faire publier de faux messages
// aux clients — c'est la garde non négociable de la spec.
import { corpsPublie } from "./regles";

export async function signatureValide(
  secret: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const cle = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

interface EvenementCommentaire {
  commentId: string;
  issueId: string;
  body: string;
}

/**
 * Ne retient que la création d'un commentaire publiable (marqueur >>).
 * Les updates sont ignorés à dessein : c'est le re-fetch du cron qui lit la
 * version finale, un update pendant le délai de grâce n'a rien à déclencher.
 */
export function analyserEvenement(payload: unknown): EvenementCommentaire | null {
  const p = payload as {
    action?: string;
    type?: string;
    data?: { id?: string; body?: string; issueId?: string };
  };
  if (p.action !== "create" || p.type !== "Comment") return null;
  const { id, body, issueId } = p.data ?? {};
  if (!id || !body || !issueId) return null;
  if (corpsPublie(body) === null) return null;
  return { commentId: id, issueId, body };
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: Écrire la route `linear-webhook.ts`**

```ts
// Réception des webhooks Linear (événements Comment). Enfile la publication
// avec un délai de grâce de 3 min — le cron (src/worker.ts) fera le re-fetch
// et l'envoi. Répondre 200 vite : Linear retente sinon, et l'idempotence D1
// absorbe de toute façon les doublons.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { enfilerPublication, ticketParIssueUuid } from "../../lib/portail/messagerie/store";
import { analyserEvenement, signatureValide } from "../../lib/portail/messagerie/webhook";

export const prerender = false;

const DELAI_DE_GRACE_MS = 3 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  const secret = env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("linear-webhook: LINEAR_WEBHOOK_SECRET absent de cet environnement");
    return new Response(null, { status: 503 });
  }
  const rawBody = await request.text();
  const ok = await signatureValide(secret, rawBody, request.headers.get("linear-signature"));
  if (!ok) return new Response(null, { status: 401 });

  const evenement = analyserEvenement(JSON.parse(rawBody));
  if (!evenement) return new Response(null, { status: 200 });

  const ticket = await ticketParIssueUuid(env.PORTAL_DB, evenement.issueId);
  // Commentaire >> sur une issue hors messagerie (issue de projet classique) :
  // rien à publier, ce n'est pas un ticket.
  if (!ticket) return new Response(null, { status: 200 });

  const maintenant = Date.now();
  await enfilerPublication(env.PORTAL_DB, {
    linear_comment_id: evenement.commentId,
    ticket_id: ticket.id,
    publish_after: new Date(maintenant + DELAI_DE_GRACE_MS).toISOString(),
    created_at: new Date(maintenant).toISOString(),
  });
  return new Response(null, { status: 200 });
};
```

- [ ] **Step 4: Créer le webhook côté Linear (manuel, staging d'abord)**

Linear → Settings → API → Webhooks → New webhook : URL `https://my-staging.coolbeans.cc/api/linear-webhook`, événements **Comments** uniquement, copier le signing secret. Puis :

```bash
npx wrangler secret put LINEAR_WEBHOOK_SECRET --env staging
# et LINEAR_WEBHOOK_SECRET=<secret> dans .dev.vars
```

(Webhook + secret **prod** : geste de Ludo au go prod, avec l'URL `https://my.coolbeans.cc/api/linear-webhook`.)

- [ ] **Step 5: Vérifier et commit**

```bash
npm run build && npm test
git add src/pages/api/linear-webhook.ts src/lib/portail/messagerie/webhook.ts src/lib/portail/messagerie/webhook.test.ts
git commit -m "feat(portail): webhook Linear signé — mise en file des commentaires >>"
```

---

### Task 9: Cron — publication après délai de grâce + email Resend

**Files:**
- Create: `src/lib/portail/messagerie/publier.ts`
- Create: `src/emails/messagerie-reponse.ts`
- Test: `src/lib/portail/messagerie/publier.test.ts`
- Modify: `src/worker.ts` (handler `scheduled`)

**Interfaces:**
- Consumes: `fetchComment` (Task 4), `corpsPublie`/`retireImagesLinear` (Task 3), store (Task 5), `renderTransactionnel`.
- Produces:
  - `decisionPublication(commentaire: { body: string } | null): { type: "annuler" } | { type: "publier"; corps: string; imagesRetirees: number }` (pure, testée)
  - `publierLesDues(db: D1Database, options: { apiKey: string; resendKey: string; maintenant: string }): Promise<{ publies: number; annules: number }>`
  - `renderReponseMessagerie(props: { objet: string; corps: string; prenom?: string; urlTicket: string }): EmailPret`

- [ ] **Step 1: Tester la décision (pure)**

`src/lib/portail/messagerie/publier.test.ts` :

```ts
import { describe, expect, test } from "vitest";
import { decisionPublication } from "./publier";

describe("decisionPublication", () => {
  test("commentaire supprimé pendant le délai → annuler", () => {
    expect(decisionPublication(null)).toEqual({ type: "annuler" });
  });
  test(">> retiré à l'édition pendant le délai → annuler", () => {
    expect(decisionPublication({ body: "finalement non" })).toEqual({ type: "annuler" });
  });
  test("publie le contenu ACTUEL, marqueur retiré", () => {
    expect(decisionPublication({ body: ">> Version corrigée" })).toEqual({
      type: "publier",
      corps: "Version corrigée",
      imagesRetirees: 0,
    });
  });
  test("les images Linear sont retirées et comptées", () => {
    const d = decisionPublication({
      body: ">> Voilà ![c](https://uploads.linear.app/a/b.png) dis-moi",
    });
    expect(d).toMatchObject({ type: "publier", imagesRetirees: 1 });
    if (d.type === "publier") expect(d.corps).not.toContain("uploads.linear.app");
  });
});
```

Run: `npm test` → FAIL, puis implémenter.

- [ ] **Step 2: Implémenter `publier.ts`**

```ts
// Publication des commentaires >> après délai de grâce (spec §7). Appelé par
// le cron de src/worker.ts. Le re-fetch au moment de l'envoi est LE mécanisme
// central : édition = correction, suppression ou retrait du >> = annulation.
import { Resend } from "resend";
import { fetchComment } from "../linear";
import { renderReponseMessagerie } from "../../../emails/messagerie-reponse";
import { corpsPublie, retireImagesLinear } from "./regles";
import {
  ajouterMessage, majEmailStatus, publicationsDues, supprimerPublication, ticketParId,
} from "./store";

export function decisionPublication(
  commentaire: { body: string } | null,
): { type: "annuler" } | { type: "publier"; corps: string; imagesRetirees: number } {
  if (!commentaire) return { type: "annuler" };
  const corps = corpsPublie(commentaire.body);
  if (corps === null) return { type: "annuler" };
  const { texte, imagesRetirees } = retireImagesLinear(corps);
  if (!texte) return { type: "annuler" };
  return { type: "publier", corps: texte, imagesRetirees };
}

export async function publierLesDues(
  db: D1Database,
  options: { apiKey: string; resendKey: string; maintenant: string },
): Promise<{ publies: number; annules: number }> {
  const dues = await publicationsDues(db, options.maintenant);
  let publies = 0;
  let annules = 0;
  for (const due of dues) {
    const commentaire = await fetchComment(options.apiKey, due.linear_comment_id);
    const decision = decisionPublication(commentaire);
    if (decision.type === "annuler") {
      await supprimerPublication(db, due.linear_comment_id);
      annules += 1;
      continue;
    }
    const ticket = await ticketParId(db, due.ticket_id);
    if (!ticket) {
      await supprimerPublication(db, due.linear_comment_id);
      continue;
    }
    const messageId = crypto.randomUUID();
    const insere = await ajouterMessage(db, {
      id: messageId,
      ticket_id: ticket.id,
      direction: "coolbeans",
      body: decision.corps,
      linear_comment_id: due.linear_comment_id,
      email_status: "none",
      created_at: options.maintenant,
    });
    // insere=false : webhook rejoué, le message existe déjà — ne pas renvoyer l'email.
    if (insere && ticket.author_email) {
      const resend = new Resend(options.resendKey);
      const email = renderReponseMessagerie({
        objet: ticket.objet,
        corps: decision.corps,
        prenom: ticket.author_prenom,
        urlTicket: `https://my.coolbeans.cc/messagerie/${ticket.id}`,
      });
      const { error } = await resend.emails.send({
        from: "Ludo de Coolbeans <support@coolbeans.cc>",
        to: ticket.author_email,
        replyTo: "ludo@coolbeans.cc",
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      await majEmailStatus(db, messageId, error ? "failed" : "sent");
      if (error) console.error("messagerie: email de réponse non envoyé", error);
      if (decision.imagesRetirees > 0) {
        // Alerte Ludo : une image Linear (CDN privé) a été retirée du message.
        await resend.emails.send({
          from: "Support Coolbeans <support@coolbeans.cc>",
          to: "ludo@coolbeans.cc",
          subject: `Messagerie — ${decision.imagesRetirees} image(s) retirée(s) (${ticket.objet})`,
          text: `Le message publié sur « ${ticket.objet} » contenait ${decision.imagesRetirees} image(s) uploads.linear.app, invisibles côté client. Renvoie-les en pièce jointe si nécessaire.`,
        });
      }
    }
    await supprimerPublication(db, due.linear_comment_id);
    publies += 1;
  }
  return { publies, annules };
}
```

- [ ] **Step 3: Écrire `src/emails/messagerie-reponse.ts`**

Même pattern que `support-confirmation.ts` (retourne `EmailPret`) :

```ts
/* ============================================================================
   COOLBEANS — Réponse de Ludo publiée sur un ticket de la messagerie.
   Envoyée AU CLIENT par le cron de publication (lib/portail/messagerie/publier.ts).
   Le corps est le markdown du commentaire Linear, images déjà retirées ;
   rendu volontairement en texte (esc + <br>), pas de parseur markdown : un
   lien nu reste cliquable dans tous les clients mail, c'est suffisant.
   ========================================================================== */
import { citation, esc, p, renderTransactionnel } from "./transactionnel";
import type { EmailPret } from "./support-confirmation";

export function renderReponseMessagerie(props: {
  objet: string;
  corps: string;
  prenom?: string;
  urlTicket: string;
}): EmailPret {
  const bonjour = props.prenom ? `Bonjour ${esc(props.prenom)},` : "Bonjour,";
  const html = renderTransactionnel({
    preheader: props.corps.slice(0, 120),
    kicker: "Messagerie",
    titre: `Re : ${esc(props.objet)}`,
    contenu: [
      p(bonjour),
      citation(esc(props.corps).replace(/\n/g, "<br>")),
      p("Vous pouvez r&eacute;pondre directement depuis votre espace."),
    ].join(""),
    cta: { label: "Répondre sur le portail", url: props.urlTicket },
    piedContexte: "Vous recevez cet email car un ticket vous concerne sur my.coolbeans.cc.",
  });
  return {
    subject: `Re : ${props.objet}`,
    html,
    text: `${props.prenom ? `Bonjour ${props.prenom},` : "Bonjour,"}\n\n${props.corps}\n\nRépondre : ${props.urlTicket}`,
  };
}
```

(Si `EmailPret` n'est pas exporté de `support-confirmation.ts`, l'y exporter — il l'est déjà d'après le fichier actuel.)

- [ ] **Step 4: Brancher le cron dans `src/worker.ts`**

Remplacer le corps de `scheduled` (en conservant le log JSON structuré, qui documente maintenant un vrai travail) :

```ts
  // Publication de la messagerie, cron "*/5 * * * *" : consomme la file
  // pending_publications alimentée par /api/linear-webhook (délai de grâce
  // 3 min → latence effective 3-8 min, assumée par la spec §7).
  async scheduled(controller, env, ctx) {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();
    if (!env.LINEAR_API_KEY || !env.RESEND_API_KEY || !env.PORTAL_DB) {
      console.log(JSON.stringify({ event: "messagerie_publication", status: "skipped_missing_bindings", scheduled_at: scheduledAt }));
      return;
    }
    ctx.waitUntil(
      publierLesDues(env.PORTAL_DB, {
        apiKey: env.LINEAR_API_KEY,
        resendKey: env.RESEND_API_KEY,
        maintenant: new Date().toISOString(),
      }).then((r) =>
        console.log(JSON.stringify({ event: "messagerie_publication", status: "ok", ...r, scheduled_at: scheduledAt })),
      ),
    );
  },
```

Import en tête : `import { publierLesDues } from "./lib/portail/messagerie/publier";`. NB : `RESEND_API_KEY` doit être typé dans `PortalSecrets` de `src/worker-env.d.ts` s'il ne l'est pas déjà — vérifier, ajouter au besoin (même style que `LINEAR_API_KEY`).

- [ ] **Step 5: Vérifier et commit**

```bash
npm run build && npm test
git add src/lib/portail/messagerie/publier.ts src/lib/portail/messagerie/publier.test.ts src/emails/messagerie-reponse.ts src/worker.ts src/worker-env.d.ts
git commit -m "feat(portail): cron de publication — re-fetch, annulation, email Resend"
```

---

### Task 10: UI — board Messagerie, popup Nouvelle demande, nav

**Files:**
- Create: `src/pages/espace/messagerie.astro`
- Create: `src/components/portail/MessagerieBoard.astro`
- Create: `src/components/portail/NouvelleDemande.astro`
- Modify: `src/lib/portail/nav.ts` + `src/lib/portail/nav.test.ts`
- Modify: `src/pages/espace/support.astro` (devient une redirection)
- Modify: `src/pages/design-system.astro` (retirer les démos `SupportForm`)
- Delete: `src/components/portail/SupportForm.astro` (validé en tête de plan)

**Interfaces:**
- Consumes: `ticketsDuClient` (Task 5), `fetchIssueStateTypes` (Task 4), `statutFromStateType`/`STATUT_LABEL`/`URGENCES` (Task 3), `missingKeysFor`, `getPortalContext`, `EmptyState`, tokens `global.css`.
- Produces: page interne `/espace/messagerie` (publique : `my.coolbeans.cc/messagerie`) ; composants board + popup réutilisés par la Task 11.

- [ ] **Step 1: Test nav d'abord**

Dans `src/lib/portail/nav.test.ts`, adapter les assertions existantes sur l'entrée Support et ajouter :

```ts
test("la messagerie remplace le support et vit haut dans la nav", () => {
  const sections = buildSections(/* mêmes fixtures admin/client que les tests voisins */);
  const labels = sections.flatMap((s) => s.pages.map((p) => p.label));
  expect(labels).toContain("Messagerie");
  expect(labels).not.toContain("Support");
  // Position : la page Messagerie apparaît avant Projets dans l'ordre à plat.
  expect(labels.indexOf("Messagerie")).toBeLessThan(labels.indexOf("Projets"));
});
```

(Adapter le nom exact de la fabrique de sections et des fixtures à ce que le fichier de test utilise déjà — le registre est `nav.ts`, ses tests existent.) Run → FAIL.

- [ ] **Step 2: Modifier `nav.ts`**

Dans le registre des sections : renommer l'entrée Support en `label: "Messagerie"`, `href: at("/messagerie")`, `activePrefix: "/espace/messagerie"`, et **remonter la page** juste sous l'accueil (avant la section/page Projets). La condition de visibilité par client reste `missingKeysFor("support", client)` (le module interne garde la clé `support` — la renommer ne rapporte rien et toucherait `MODULE_REQUIREMENTS`, `EmptyState` et les tests de Task 2). Run → PASS.

- [ ] **Step 3: Écrire le board et la popup**

`src/components/portail/MessagerieBoard.astro` — props `{ tickets: Array<TicketRow & { statut: StatutTicket }> }` ; table « boîte mail » en utilitaires sur tokens (`border-line`, `bg-surface`, `rounded-card`, `text-mute` — mêmes tokens que `SupportForm`, jamais la classe `card`) : colonnes Objet (lien vers `/messagerie/{id}` via `portalHref`), Auteur (`author_prenom`, + badge discret « Ouvert par Ludo » si `created_via === "admin"`), Dernier message (date `YYYY-MM-DD`), Statut (badge `STATUT_LABEL[statut]` ; `traite` en `text-mute`, `en_cours` en `text-success`). État vide : « Aucune demande pour l'instant. »

`src/components/portail/NouvelleDemande.astro` — `<dialog>` natif stylé tokens, ouvert par le CTA « Nouvelle demande » (bouton `btn` placé en haut à gauche au-dessus du board). Formulaire `enctype="multipart/form-data"` : `objet` (requis, maxlength 200), `description` (textarea, maxlength 5000, optionnelle), `urgence` (`<select>` sur `URGENCES`, option vide « — » par défaut), `fichiers` (`<input type="file" multiple accept="image/*,.pdf,.zip">`, aide « 3 fichiers max, 10 Mo chacun »). Script inline même mécanique que feu `SupportForm` (submit → `fetch("/api/messagerie/nouveau", { method: "POST", body: new FormData(form) })`, états envoi/succès/erreur dans un `role="status"`, succès → `location.reload()` pour voir le ticket apparaître dans le board).

`src/pages/espace/messagerie.astro` :

```astro
---
// Messagerie (spec 2026-08-15-messagerie-portail-design.md §6) : board des
// tickets du client + popup Nouvelle demande. Un message = un sujet — la
// phrase pédagogique est le seul texte au-dessus du board.
export const prerender = false;

import EspaceLayout from "../../layouts/EspaceLayout.astro";
import EmptyState from "../../components/portail/EmptyState.astro";
import MessagerieBoard from "../../components/portail/MessagerieBoard.astro";
import NouvelleDemande from "../../components/portail/NouvelleDemande.astro";
import { env } from "cloudflare:workers";
import { missingKeysFor } from "../../lib/portail/clients";
import { getPortalContext } from "../../lib/portail/context";
import { fetchIssueStateTypes } from "../../lib/portail/linear";
import { statutFromStateType } from "../../lib/portail/messagerie/regles";
import { ticketsDuClient } from "../../lib/portail/messagerie/store";

const { meta, client } = await getPortalContext(Astro);
const missingKeys = missingKeysFor("support", client);
Astro.response.headers.set("Cache-Control", "no-store");

let tickets: Awaited<ReturnType<typeof ticketsDuClient>> = [];
let statuts = new Map<string, string>();
if (missingKeys.length === 0 && client) {
  tickets = await ticketsDuClient(env.PORTAL_DB, client.slug);
  const uuids = tickets.map((t) => t.linear_issue_uuid).filter((u): u is string => Boolean(u));
  try {
    if (env.LINEAR_API_KEY) statuts = await fetchIssueStateTypes(env.LINEAR_API_KEY, uuids);
  } catch (err) {
    console.error("messagerie: statuts Linear indisponibles, board sans statuts", err);
  }
}
const lignes = tickets.map((t) => ({
  ...t,
  statut: statutFromStateType(t.linear_issue_uuid ? statuts.get(t.linear_issue_uuid) : undefined),
}));
---
```

Corps : titre « Messagerie », phrase « Un message = un sujet. Trois sujets ? Trois demandes séparées — on vous répondra plus vite. », CTA + `<MessagerieBoard tickets={lignes} />` + `<NouvelleDemande />`, ou `<EmptyState …>` si `missingKeys.length > 0` (mêmes props que l'usage dans feu `support.astro`). Reprendre la FAQ `Collapse` de l'ancienne page sous le board.

`src/pages/espace/support.astro` — tout remplacer par la redirection (l'URL a pu être partagée) :

```astro
---
// /support a déménagé : la Messagerie (spec 2026-08-15). 301 vers la forme
// publique correcte selon l'hôte (portalHref gère my.* vs coolbeans.cc).
export const prerender = false;
import { portalHref } from "../../lib/portail/nav";
return Astro.redirect(portalHref("/messagerie", Astro.url.hostname), 301);
---
```

`src/pages/design-system.astro` : retirer les instances `<SupportForm demo=…>` de la Bibliothèque (et l'import). Puis `git rm src/components/portail/SupportForm.astro`.

- [ ] **Step 4: Vérifier et commit**

```bash
npm run build && npm test
# Vérif visuelle sur le daemon astro dev : /espace/messagerie (board vide +
# popup), /espace/support → 301, sidebar : « Messagerie » en haut, badge wip absent.
git add src/pages/espace/messagerie.astro src/components/portail/MessagerieBoard.astro src/components/portail/NouvelleDemande.astro src/lib/portail/nav.ts src/lib/portail/nav.test.ts src/pages/espace/support.astro src/pages/design-system.astro
git rm src/components/portail/SupportForm.astro
git commit -m "feat(portail): page Messagerie — board des tickets, popup Nouvelle demande, nav (COO-XX)"
```

---

### Task 11: UI — page ticket (fil de conversation + réponse)

**Files:**
- Create: `src/pages/espace/messagerie/[id].astro`
- Create: `src/components/portail/FilMessages.astro`

**Interfaces:**
- Consumes: `ticketParId`/`messagesDuTicket`/`piecesJointesDuTicket` (Task 5), `fetchIssueStateTypes` + `statutFromStateType` (statut du ticket en tête), `POST /api/messagerie/reponse` (Task 7), `validerFichiers` côté aide de formulaire.
- Produces: page interne `/espace/messagerie/[id]` (publique : `my.coolbeans.cc/messagerie/<id>` — l'URL stable et partageable de la spec §8).

- [ ] **Step 1: Écrire la page**

`[id].astro` : garde d'accès identique à `reponse.ts` (`ticket.client !== client?.slug` → `Astro.redirect(portalHref("/messagerie", Astro.url.hostname))`), chargement `messagesDuTicket` + `piecesJointesDuTicket` (groupées par `message_id` en un `Map`), en-tête objet + badge statut + ligne discrète « Ouvert par Ludo pour {author_prenom} » si `created_via === "admin"` + date, puis `<FilMessages …>` et le formulaire de réponse (textarea + fichiers, mêmes limites et même script fetch que la popup, vers `/api/messagerie/reponse` avec `ticketId` en champ caché ; succès → `location.reload()`).

`FilMessages.astro` — props `{ messages: MessageRow[]; pieces: Map<string, AttachmentRow[]> }` : liste chronologique, chaque message une bulle plate (pas de classe `card`) alignée selon `direction` (`client` à droite fond `bg-surface`, `coolbeans` à gauche avec libellé « Ludo — Coolbeans »), corps rendu en texte avec sauts de ligne (`white-space: pre-wrap` via utilitaire — pas de parseur markdown en v1, cohérent avec l'email), pièces jointes listées sous la bulle en liens `/api/messagerie/fichier/{id}` (icône trombone, `filename`, taille lisible).

- [ ] **Step 2: Vérifier et commit**

```bash
npm run build && npm test
# Vérif visuelle : créer un ticket via la popup en local, ouvrir son fil,
# répondre, vérifier l'ordre chronologique et les liens de fichiers.
git add src/pages/espace/messagerie/ src/components/portail/FilMessages.astro
git commit -m "feat(portail): page ticket — fil de conversation et réponse client"
```

---

### Task 12: Admin — ouvrir un ticket au nom d'un client

**Files:**
- Modify: `src/pages/espace/messagerie.astro`
- Create: `src/components/portail/NouvelleDemandeAdmin.astro`
- Modify: `src/pages/api/messagerie/nouveau.ts`

**Interfaces:**
- Consumes: `isAdmin(meta)` (`src/lib/portail/metadata.ts`), `clerkClient` de `@clerk/astro/server`, endpoint `nouveau` (Task 6).
- Produces: `POST /api/messagerie/nouveau` accepte un champ additionnel `pourClerkId` (admin uniquement) → ticket `created_via: "admin"` au nom de l'utilisateur visé + email « Ludo a ouvert un ticket pour vous ».

- [ ] **Step 1: Étendre l'endpoint**

Dans `nouveau.ts`, après les gardes existantes :

```ts
  // Création au nom d'un client (spec §8) : réservée à l'admin. L'auteur
  // reste l'utilisateur du client — c'est lui qui reçoit les notifications —
  // created_via = 'admin' porte la provenance, affichée sans mimétisme.
  const pourClerkId = String(fd.get("pourClerkId") ?? "");
  let auteur = { id: user.id, prenom: user.firstName ?? "Client", email: emailClient ?? "" };
  let createdVia: "portail" | "admin" = "portail";
  if (pourClerkId && pourClerkId !== user.id) {
    if (!isAdmin(meta)) return json({ error: "Réservé à l'administrateur." }, 403);
    const cible = await clerkClient(context).users.getUser(pourClerkId);
    auteur = {
      id: cible.id,
      prenom: cible.firstName ?? "Client",
      email: cible.emailAddresses[0]?.emailAddress ?? "",
    };
    createdVia = "admin";
  }
```

(`creerTicket` reçoit alors `auteur.*` et `createdVia`.) Quand `createdVia === "admin"` et `auteur.email` non vide, remplacer l'accusé de réception standard par un email dédié composé avec `renderTransactionnel` : kicker « Messagerie », titre « Ludo a ouvert un ticket pour vous », `p()` d'explication « Suite à votre demande, votre ticket est ouvert et suivi ici : », CTA « Voir le ticket » vers `https://my.coolbeans.cc/messagerie/${ticketId}` — la boucle email → portail de la spec §8.

- [ ] **Step 2: Le formulaire admin**

`NouvelleDemandeAdmin.astro` : rendu uniquement si `isAdmin(meta)` (prop passée par la page), sous le CTA standard — un `<details>` discret « Ouvrir un ticket au nom d'un utilisateur » contenant le même formulaire que `NouvelleDemande` plus un `<select name="pourClerkId">` des utilisateurs du client courant. La page fournit les options :

```ts
// messagerie.astro, seulement si admin :
import { clerkClient } from "@clerk/astro/server";
const users = admin
  ? (await clerkClient(Astro).users.getUserList({ limit: 100 })).data
      .filter((u) => (u.publicMetadata as { client?: string }).client === client?.slug)
      .map((u) => ({ id: u.id, label: `${u.firstName ?? "?"} — ${u.emailAddresses[0]?.emailAddress ?? ""}` }))
  : [];
```

- [ ] **Step 3: Vérifier et commit**

```bash
npm run build && npm test
# Vérif : en admin sur le client Amusoire, ouvrir un ticket au nom de Noémie ;
# board : badge « Ouvert par Ludo » ; fil : ligne de provenance ; email reçu.
git add src/pages/espace/messagerie.astro src/components/portail/NouvelleDemandeAdmin.astro src/pages/api/messagerie/nouveau.ts
git commit -m "feat(portail): ouverture de ticket au nom d'un client (admin, provenance affichée)"
```

---

### Task 13: Bout en bout sur staging + tâche annexe skill linear

**Files:**
- Modify (autre working dir): `/Users/ludovicbourgoin/dev/coolbeans-claude-skills/skills/linear/references/taxonomie.md`

**Interfaces:**
- Consumes: tout ce qui précède, déployé sur staging par `git push`.
- Produces: parcours complet validé ; skill `linear` avertie des projets Support.

- [ ] **Step 1: Déployer et dérouler le parcours sur staging**

`git push` (staging se déploie seul). Puis, sur `my-staging.coolbeans.cc` (instance Clerk **dev** — vérifier les publicMetadata AVANT de suspecter le code) :

1. Créer une demande avec pièce jointe → ticket au board « En attente », issue dans le projet Support d'Amusoire, assignée, priorisée, email interne + accusé reçus.
2. Commenter l'issue `>> Bonjour, c'est noté !` → sous ~8 min : message dans le fil, email « Re : … » reçu, lien « Répondre sur le portail » fonctionnel.
3. Éditer un `>>` pendant le délai pour retirer le marqueur → rien ne part (annulation).
4. Répondre depuis le fil → commentaire sur l'issue + email à ludo@.
5. Passer l'issue en Done → board « Traité ».
6. Télécharger la pièce jointe connecté ; vérifier 404 depuis une session d'un autre client (sélecteur admin sur coolbeans).
7. Admin : ticket au nom de Noémie → badge, provenance, email « ouvert pour vous ».

- [ ] **Step 2: Avertir la skill linear**

Dans `references/taxonomie.md` du repo `coolbeans-claude-skills`, section règles de routage projet, ajouter :

```markdown
- **Projets « Support »** : un par team client, evergreen, réservés à la
  messagerie du portail my.coolbeans.cc. Ne JAMAIS les proposer au routage
  d'une issue créée par cette skill — une issue de travail ne va pas dans
  Support, et un ticket de support ne se crée pas ici (il vient du portail).
```

Commit dans ce repo-là (`git add` sélectif, message `docs(linear): exclut les projets Support du routage`).

- [ ] **Step 3: Clore**

Rapporter à Ludo l'état du parcours staging, les éventuels écarts, et la liste des gestes **prod** qui restent les siens : migration D1 prod, secrets prod (`LINEAR_WEBHOOK_SECRET`), webhook Linear prod, puis merge `staging` → `main` quand il l'ordonne. **Aucun de ces gestes ne se fait sans son ordre explicite.**

---

## Self-review (fait à l'écriture)

- **Couverture spec** : §2 nav/nommage → T10 ; §3 architecture → T1/T5/T8/T9 ; §4 modèle de données + R2 → T1/T5/T6/T7 ; §5 Linear (projet, assignation, priorité, taxonomie skill) → T2/T4/T13 ; §6 UI (board, popup, fil, portée org) → T10/T11 ; §7 publication (>> , grâce, annulation, images, notification Ludo) → T8/T9/T7 ; §8 canaux + admin au nom de → T12 ; §9 éventualités → idempotence T5/T8, best-effort T6/T9, ré-appairage = SQL manuel (hors code, assumé) ; §10 hors périmètre respecté (pas de lu/non-lu, pas de cron de réconciliation, pas d'inbound email).
- **Types** : `TicketRow`/`MessageRow`/`AttachmentRow` définis en T5 et consommés tels quels en T6-T11 ; `statutFromStateType` retourne `StatutTicket` consommé par `STATUT_LABEL` ; `createSupportTicket` retourne `issueId` consommé par `majIssue`.
- **Placeholders** : les seuls « à compléter » sont des identifiants créés à l'exécution (IDs D1 de l'étape T1, IDs projets Linear de T2) — inconnaissables à l'écriture du plan, notés `<...ÉTAPE_N>` avec la commande qui les produit.
