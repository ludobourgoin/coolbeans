# Documents du workspace client : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page `Documents` dans le workspace de chaque client, qui rassemble fichiers R2, pages du repo et liens externes, chaque ligne visible seulement quand Ludo l'a décidé.

**Architecture:** D1 devient le registre de tout ce qui se montre : une ligne par document, trois natures de source, aucune duplication de contenu. Les modules purs (`familles`, `lignes`, `sync`, `service`) portent les décisions et se testent sans Cloudflare ; le store porte les requêtes, et c'est dans le SQL que vit le filtre de visibilité. La page et les routes API ne font qu'assembler.

**Tech Stack:** Cloudflare Workers, D1, R2, Astro 5 en SSR, île Preact, vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-documents-workspace-design.md`

## Global Constraints

- **Le filtre de visibilité vit dans la requête SQL, jamais dans le rendu.** Une ligne masquée ne doit pas atteindre le navigateur d'un client, même cachée en CSS.
- **Tout document naît masqué.** `visible INTEGER NOT NULL DEFAULT 0`, et aucun chemin d'écriture ne pose autre chose que `0`.
- **La vue client ne déclenche aucune écriture.** L'enregistrement des pages du repo n'a lieu que sur le rendu de la vue admin.
- Pas de liens R2 signés. Le contrôle est celui de `/api/messagerie/fichier/[id]` : session vérifiée, appartenance au client courant vérifiée, allowlist de MIME pour l'inline, `application/octet-stream` pour tout le reste.
- Aucune requête vers un serveur tiers au rendu : les pictos sont des SVG inline, jamais des favicons distantes.
- Aucun identifiant ni secret dans ce module.
- Nommage en français, au patron de `src/lib/portail/messagerie/`.
- Le français des commentaires et des messages de commit passe le hook `relire-francais.mjs` : pas de tiret cadratin ni demi-cadratin.
- Avant toute écriture de style, relire `/design-system` : les classes existent déjà, ne pas en inventer.
- Commits : `git add` sur les chemins exacts, jamais `git add -A` (sessions parallèles sur ce repo). Chaque message de commit se termine par `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Aucune notification, aucun email. COO-90 est annulée, pas reportée (spec §9).

## Décisions prises en écrivant ce plan

Elles complètent la spec là où elle ne tranche pas. Chacune est contestable, et le point où la contester est indiqué.

1. **Une famille `fichier` de repli.** La spec §6 liste sept familles sans dire ce que devient un MIME inconnu. `familleDocument()` doit être totale : un `.docx` déposé retombe sur une famille neutre plutôt que sur une famille fausse. Task 2.
2. **Les pictos sont des `.tsx`, pas des `.astro`.** La spec veut une île Preact pour la bascule optimiste et des SVG inline dans `src/components/portail/pictos/` : une île Preact ne peut pas rendre un composant Astro. Les deux contraintes se concilient en écrivant les pictos en Preact. Task 3.
3. **Les versions de devis ne produisent pas de ligne.** Un devis porteur de `versionDe` n'a pas d'URL propre (schéma de la collection `devis`) : l'enregistrer créerait une ligne qui mène à la page d'une autre. Seule la V1 du groupe entre au registre. Task 4.
4. **Collections `devis` et `cadrage` seulement**, comme le dit la spec §4. Les collections `livrable` et `temoignage` sont du même genre et resteront dehors en V1. À rouvrir quand un client aura un livrable à retrouver.
5. **Plafond de dépôt à 25 Mo**, contre 10 Mo pour une pièce jointe de messagerie. Un brand book PDF dépasse couramment 10 Mo. Task 8.
6. **Les deux tests qui comptent portent sur la requête, pas sur la route.** La spec §11 demande un test de la route fichier. Ce dépôt n'a pas de harnais capable de rendre une route Astro avec un binding D1 et une session : les tests portent donc sur `documentPourAcces`, qui est l'endroit exact où se décide le 404, et la route est vérifiée à la main lors de la recette. Le jour où un harnais d'intégration existe, le test de route s'ajoute sans rien déplacer.
7. **Task 10 sort du périmètre de la spec §8.** Elle rattache au registre les 38 objets déjà présents dans le bucket de production, que le dépôt par la vue admin ne couvre pas. Sans elle, la fonctionnalité est livrée vide et il faudrait redéposer 38 fichiers à la main.

## Prérequis d'exécution

Ce lot touche du code partagé : il part en worktree, jamais dans le clone principal.

```sh
cd ~/dev/coolbeans
git worktree add ../coolbeans-documents -b feat/documents-workspace staging
cp .env ../coolbeans-documents/.env
cp .dev.vars ../coolbeans-documents/.dev.vars
cp -R .wrangler/state ../coolbeans-documents/.wrangler/state
cd ../coolbeans-documents
npm install
```

Les trois copies, pas seulement `.env`. Sans `.dev.vars`, `/espace` répond 500 ; sans `.wrangler/state`, la base D1 locale est vide et aucun compte n'existe, donc la connexion échoue comme si le mot de passe était faux.

Vérifier `pwd` et `git branch --show-current` avant le premier edit, et à chaque reprise de session.

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `migrations/0008_documents.sql` | Table `documents`, ses deux index. |
| `src/lib/portail/documents/store.ts` | Accès D1. Une fonction, une requête. Porte le filtre de visibilité. |
| `src/lib/portail/documents/familles.ts` | Famille de picto depuis le MIME ou l'hôte. Pur. |
| `src/lib/portail/documents/lignes.ts` | Projection d'une ligne D1 vers ce que l'île affiche. Pur. |
| `src/lib/portail/documents/sync.ts` | Enregistrement des pages du repo, détection des orphelines. |
| `src/lib/portail/documents/service.ts` | Type MIME et disposition servis par la route fichier. Pur. |
| `src/components/portail/pictos/PictoDocument.tsx` | SVG inline, un par famille. |
| `src/components/portail/ListeDocuments.tsx` | Île Preact : la liste, la pastille, la bascule optimiste. |
| `src/components/portail/DeposerDocument.astro` | Formulaire admin : dépôt de fichier, ajout de lien. |
| `src/pages/espace/projets/documents.astro` | La souche devient la page. |
| `src/pages/api/documents/fichier/[id].ts` | Service des fichiers R2. |
| `src/pages/api/documents/visibilite.ts` | Bascule de visibilité. |
| `src/pages/api/documents/nouveau.ts` | Dépôt d'un fichier, ajout d'un lien. |
| `src/lib/portail/nav.ts` | Retrait du drapeau `wip`. |
| `scripts/rattacher-documents-r2.mjs` | Hors spec : rattache les objets R2 déjà déposés. |

---

### Task 1 : Registre D1 et store

**Files:**
- Create: `migrations/0008_documents.sql`
- Create: `src/lib/portail/documents/store.ts`
- Test: `src/lib/portail/documents/store.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `DocumentRow`, `SourceDocument`, `documentsDuClient(db, client, { inclureMasques })`, `documentPourAcces(db, id, client, { inclureMasques })`, `creerDocument(db, doc) → boolean`, `definirVisibilite(db, id, client, visible) → boolean`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/portail/documents/store.test.ts` :

```ts
import { expect, test } from "vitest";
import {
  creerDocument,
  definirVisibilite,
  documentPourAcces,
  documentsDuClient,
  type DocumentRow,
} from "./store";

/** Faux D1 : rejoue des résultats fixés et capture sql + bindings. */
function fakeDb(results: unknown[] = [], changes = 1) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          calls.push({ sql, binds });
          return {
            all: async () => ({ results }),
            first: async () => results[0] ?? null,
            run: async () => ({ meta: { changes } }),
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

const doc: DocumentRow = {
  id: "d1",
  client: "fylgo",
  titre: "Facture 024617",
  source: "fichier",
  r2_key: "documents/fylgo/abc.pdf",
  url: null,
  mime: "application/pdf",
  taille: 128047,
  date_doc: "2026-09-02",
  visible: 0,
  cree_le: "2026-09-22T09:00:00.000Z",
  cle_source: null,
};

test("documentsDuClient masque les lignes invisibles quand inclureMasques est faux", async () => {
  const { db, calls } = fakeDb([]);
  await documentsDuClient(db, "fylgo", { inclureMasques: false });
  expect(calls[0].sql).toMatch(/WHERE client = \?/);
  expect(calls[0].sql).toMatch(/AND visible = 1/);
  expect(calls[0].sql).toMatch(/ORDER BY date_doc DESC/);
  expect(calls[0].binds).toEqual(["fylgo"]);
});

test("documentsDuClient rend tout quand inclureMasques est vrai", async () => {
  const { db, calls } = fakeDb([]);
  await documentsDuClient(db, "fylgo", { inclureMasques: true });
  expect(calls[0].sql).not.toMatch(/visible/);
});

test("documentPourAcces filtre sur le client ET sur la visibilité", async () => {
  const { db, calls } = fakeDb([]);
  await documentPourAcces(db, "d1", "fylgo", { inclureMasques: false });
  expect(calls[0].sql).toMatch(/WHERE id = \? AND client = \?/);
  expect(calls[0].sql).toMatch(/AND visible = 1/);
  expect(calls[0].binds).toEqual(["d1", "fylgo"]);
});

test("documentPourAcces laisse passer une ligne masquée pour l'admin", async () => {
  const { db, calls } = fakeDb([]);
  await documentPourAcces(db, "d1", "fylgo", { inclureMasques: true });
  expect(calls[0].sql).toMatch(/WHERE id = \? AND client = \?/);
  expect(calls[0].sql).not.toMatch(/visible/);
});

test("creerDocument ignore un doublon de clé source et le dit", async () => {
  const { db, calls } = fakeDb([], 0);
  const insere = await creerDocument(db, { ...doc, cle_source: "devis/fylgo/site-1234" });
  expect(calls[0].sql).toMatch(/INSERT OR IGNORE INTO documents/);
  expect(insere).toBe(false);
});

test("definirVisibilite exige l'appartenance au client", async () => {
  const { db, calls } = fakeDb([], 1);
  const fait = await definirVisibilite(db, "d1", "fylgo", true);
  expect(calls[0].sql).toMatch(/UPDATE documents SET visible = \? WHERE id = \? AND client = \?/);
  expect(calls[0].binds).toEqual([1, "d1", "fylgo"]);
  expect(fait).toBe(true);
});

test("definirVisibilite renvoie faux quand la ligne n'appartient pas au client", async () => {
  const { db } = fakeDb([], 0);
  expect(await definirVisibilite(db, "d1", "oide", false)).toBe(false);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/documents/store.test.ts`
Expected: FAIL, « Failed to resolve import "./store" ».

- [ ] **Step 3 : Écrire la migration**

`migrations/0008_documents.sql` :

```sql
-- Documents du workspace client (spec 2026-09-08-documents-workspace-design.md §3).
-- D1 est le registre des TROIS natures de documents : fichier déposé dans R2,
-- page du repo (cadrage, proposition), lien externe. Le contenu n'est jamais
-- dupliqué ici : ce que cette table stocke, c'est la décision de montrer.

CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  client       TEXT NOT NULL,           -- slug du registre src/content/clients/
  titre        TEXT NOT NULL,           -- nom affiché
  source       TEXT NOT NULL CHECK (source IN ('fichier', 'page', 'lien')),
  r2_key       TEXT,                    -- source 'fichier' uniquement
  url          TEXT,                    -- sources 'page' et 'lien'
  mime         TEXT,                    -- source 'fichier' uniquement
  taille       INTEGER,                 -- octets, source 'fichier'
  date_doc     TEXT NOT NULL,           -- AAAA-MM-JJ, date affichée et clé de tri
  visible      INTEGER NOT NULL DEFAULT 0,
  cree_le      TEXT NOT NULL,
  cle_source   TEXT                     -- identité stable d'une page du repo
);

CREATE INDEX documents_client_date ON documents (client, date_doc DESC);

-- Garantit qu'une page du repo ne produit jamais deux lignes, même si
-- l'enregistrement automatique tourne cent fois.
CREATE UNIQUE INDEX documents_cle_source ON documents (client, cle_source)
  WHERE cle_source IS NOT NULL;
```

- [ ] **Step 4 : Écrire le store**

`src/lib/portail/documents/store.ts` :

```ts
// Accès D1 des documents du workspace (spec 2026-09-08 §3). Une fonction =
// une requête, binding passé en argument : testable sans Cloudflare, au
// patron de src/lib/portail/messagerie/store.ts.
//
// LA règle de ce fichier : le filtre de visibilité est dans le SQL. Le mettre
// au rendu laisserait une ligne masquée partir dans le HTML d'un client, où
// un affichage des sources suffirait à la lire.

export type SourceDocument = "fichier" | "page" | "lien";

export interface DocumentRow {
  id: string;
  client: string;
  titre: string;
  source: SourceDocument;
  r2_key: string | null;
  url: string | null;
  mime: string | null;
  taille: number | null;
  /** AAAA-MM-JJ. */
  date_doc: string;
  /** 0 = masqué, l'état de naissance de toute ligne. */
  visible: number;
  cree_le: string;
  cle_source: string | null;
}

/** `inclureMasques` n'est vrai que pour le rôle admin. */
export async function documentsDuClient(
  db: D1Database,
  client: string,
  { inclureMasques }: { inclureMasques: boolean },
): Promise<DocumentRow[]> {
  const filtre = inclureMasques ? "" : " AND visible = 1";
  const { results } = await db
    .prepare(
      `SELECT * FROM documents WHERE client = ?${filtre} ORDER BY date_doc DESC, cree_le DESC`,
    )
    .bind(client)
    .all<DocumentRow>();
  return results ?? [];
}

/**
 * Le document, s'il appartient bien au client courant et si le demandeur a le
 * droit de le voir. Renvoie `null` dans tous les autres cas : c'est ce `null`
 * que la route fichier traduit en 404, sans distinguer « pas à vous » de
 * « masqué » : les deux réponses doivent se ressembler.
 */
export async function documentPourAcces(
  db: D1Database,
  id: string,
  client: string,
  { inclureMasques }: { inclureMasques: boolean },
): Promise<DocumentRow | null> {
  const filtre = inclureMasques ? "" : " AND visible = 1";
  return await db
    .prepare(`SELECT * FROM documents WHERE id = ? AND client = ?${filtre}`)
    .bind(id, client)
    .first<DocumentRow>();
}

/** `false` quand la clé source existait déjà : l'enregistrement est idempotent. */
export async function creerDocument(db: D1Database, doc: DocumentRow): Promise<boolean> {
  const { meta } = await db
    .prepare(
      `INSERT OR IGNORE INTO documents
         (id, client, titre, source, r2_key, url, mime, taille, date_doc, visible, cree_le, cle_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      doc.id,
      doc.client,
      doc.titre,
      doc.source,
      doc.r2_key,
      doc.url,
      doc.mime,
      doc.taille,
      doc.date_doc,
      doc.visible,
      doc.cree_le,
      doc.cle_source,
    )
    .run();
  return meta.changes > 0;
}

/**
 * Le `client` dans le WHERE est la garde, pas un confort : sans lui, un id
 * forgé bascule la visibilité d'un document d'un autre client.
 */
export async function definirVisibilite(
  db: D1Database,
  id: string,
  client: string,
  visible: boolean,
): Promise<boolean> {
  const { meta } = await db
    .prepare(`UPDATE documents SET visible = ? WHERE id = ? AND client = ?`)
    .bind(visible ? 1 : 0, id, client)
    .run();
  return meta.changes > 0;
}
```

- [ ] **Step 5 : Lancer les tests**

Run: `npx vitest run src/lib/portail/documents/store.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6 : Appliquer la migration en local**

Run: `npx wrangler d1 execute coolbeans-portal --local --file=migrations/0008_documents.sql`
Expected: `🚣 Executed 3 commands`.

Vérifier : `npx wrangler d1 execute coolbeans-portal --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='documents'"` renvoie une ligne.

- [ ] **Step 7 : Commit**

```bash
git add migrations/0008_documents.sql src/lib/portail/documents/store.ts src/lib/portail/documents/store.test.ts
git commit -m "$(cat <<'EOF'
feat(documents): le registre D1 et son accès

Une ligne par document, quelle que soit sa nature. Le filtre de visibilité
vit dans le SQL : une ligne masquée ne part jamais dans le HTML d'un client.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 : Famille de picto

**Files:**
- Create: `src/lib/portail/documents/familles.ts`
- Test: `src/lib/portail/documents/familles.test.ts`

**Interfaces:**
- Consumes: `SourceDocument` de Task 1.
- Produces: `FamilleDocument` (`"pdf" | "image" | "archive" | "google-docs" | "granola" | "page" | "lien" | "fichier"`), `familleDocument({ source, mime, url })`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/portail/documents/familles.test.ts` :

```ts
import { expect, test } from "vitest";
import { familleDocument } from "./familles";

test("une page du repo est toujours de la famille page", () => {
  expect(familleDocument({ source: "page", url: "/devis/fylgo/site-1234" })).toBe("page");
});

test("le MIME décide de la famille d'un fichier", () => {
  expect(familleDocument({ source: "fichier", mime: "application/pdf" })).toBe("pdf");
  expect(familleDocument({ source: "fichier", mime: "image/png" })).toBe("image");
  expect(familleDocument({ source: "fichier", mime: "image/svg+xml" })).toBe("image");
  expect(familleDocument({ source: "fichier", mime: "application/zip" })).toBe("archive");
  expect(familleDocument({ source: "fichier", mime: "application/x-zip-compressed" })).toBe("archive");
});

test("un MIME inconnu retombe sur la famille neutre, jamais sur une fausse", () => {
  expect(familleDocument({ source: "fichier", mime: "application/vnd.oasis.opendocument.text" })).toBe("fichier");
  expect(familleDocument({ source: "fichier", mime: null })).toBe("fichier");
});

test("l'hôte décide de la famille d'un lien", () => {
  expect(familleDocument({ source: "lien", url: "https://docs.google.com/document/d/abc/edit" })).toBe("google-docs");
  expect(familleDocument({ source: "lien", url: "https://notes.granola.ai/d/abc" })).toBe("granola");
  expect(familleDocument({ source: "lien", url: "https://granola.so/notes/abc" })).toBe("granola");
  expect(familleDocument({ source: "lien", url: "https://exemple.fr/note" })).toBe("lien");
});

test("un sous-domaine ne se fait pas passer pour l'hôte attendu", () => {
  expect(familleDocument({ source: "lien", url: "https://docs.google.com.exemple.fr/piege" })).toBe("lien");
});

test("une URL illisible ne lève pas", () => {
  expect(familleDocument({ source: "lien", url: "pas une url" })).toBe("lien");
  expect(familleDocument({ source: "lien", url: null })).toBe("lien");
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/documents/familles.test.ts`
Expected: FAIL, « Failed to resolve import "./familles" ».

- [ ] **Step 3 : Écrire le module**

`src/lib/portail/documents/familles.ts` :

```ts
// Choix du picto (spec 2026-09-08 §6). Fonction pure, appelée au rendu : la
// famille n'est pas stockée en base, sinon elle serait figée le jour où cette
// fonction apprend un nouveau service.

import type { SourceDocument } from "./store";

export type FamilleDocument =
  | "pdf"
  | "image"
  | "archive"
  | "google-docs"
  | "granola"
  | "page"
  | "lien"
  | "fichier";

const ARCHIVES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-7z-compressed",
]);

/** Hôte exact ou sous-domaine, jamais une comparaison par `includes`. */
function hoteEst(hote: string, attendu: string): boolean {
  return hote === attendu || hote.endsWith(`.${attendu}`);
}

/**
 * Totale par construction : la spec liste sept familles, mais un MIME
 * inattendu doit se rendre, pas casser la page. Il retombe sur `fichier`,
 * qui ne prétend rien.
 */
export function familleDocument(doc: {
  source: SourceDocument;
  mime?: string | null;
  url?: string | null;
}): FamilleDocument {
  if (doc.source === "page") return "page";

  if (doc.source === "fichier") {
    const mime = (doc.mime ?? "").toLowerCase();
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("image/")) return "image";
    if (ARCHIVES.has(mime)) return "archive";
    return "fichier";
  }

  let hote: string;
  try {
    hote = new URL(doc.url ?? "").hostname.toLowerCase();
  } catch {
    return "lien";
  }
  if (hoteEst(hote, "docs.google.com")) return "google-docs";
  if (hoteEst(hote, "granola.ai") || hoteEst(hote, "granola.so")) return "granola";
  return "lien";
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npx vitest run src/lib/portail/documents/familles.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/portail/documents/familles.ts src/lib/portail/documents/familles.test.ts
git commit -m "feat(documents): la famille de picto se calcule, elle ne se stocke pas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : Pictos inline

**Files:**
- Create: `src/components/portail/pictos/PictoDocument.tsx`

**Interfaces:**
- Consumes: `FamilleDocument` de Task 2.
- Produces: `<PictoDocument famille={f} />`, composant Preact, 20 × 20, sans aucune requête réseau.

- [ ] **Step 1 : Écrire le composant**

`src/components/portail/pictos/PictoDocument.tsx` :

```tsx
// Pictos des documents (spec §6). SVG inline, jamais de favicon distante :
// une favicon signalerait à Google et à Granola quel client consulte quel
// document, et casserait la ligne le jour où le service change d'URL.
//
// Preact et non Astro parce que la liste est une île : un composant Astro ne
// se rend pas dans une île.

import type { FamilleDocument } from "../../../lib/portail/documents/familles";

const CADRE = { width: 20, height: 20, viewBox: "0 0 20 20", "aria-hidden": "true" } as const;

/** Feuille commune aux familles de fichiers, teintée par la famille. */
function Feuille({ couleur, label }: { couleur: string; label: string }) {
  return (
    <svg {...CADRE}>
      <path
        d="M4 2.5A1.5 1.5 0 0 1 5.5 1h6L16 5.5v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17.5z"
        fill={couleur}
      />
      <path d="M11.5 1 16 5.5h-4.5z" fill="#000" opacity="0.2" />
      <text
        x="10"
        y="14.5"
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="700"
        fill="#fff"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

export default function PictoDocument({ famille }: { famille: FamilleDocument }) {
  switch (famille) {
    case "pdf":
      return <Feuille couleur="#e5484d" label="PDF" />;
    case "archive":
      return <Feuille couleur="#f5a524" label="ZIP" />;
    case "google-docs":
      return <Feuille couleur="#2b7cff" label="DOC" />;
    case "image":
      return (
        <svg {...CADRE}>
          <rect x="2" y="3.5" width="16" height="13" rx="2" fill="#30a46c" />
          <circle cx="7" cy="8" r="1.6" fill="#fff" />
          <path d="M3.5 15.5 8 10.5l3 3 2.5-2 3 4z" fill="#fff" opacity="0.85" />
        </svg>
      );
    case "granola":
      return (
        <svg {...CADRE}>
          <circle cx="10" cy="10" r="8" fill="#1a1a1a" />
          <path d="M6.5 10.5h7M6.5 7.5h7M6.5 13.5h4" stroke="#f5d90a" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      );
    case "page":
      return (
        <svg {...CADRE}>
          <rect x="2" y="3.5" width="16" height="13" rx="2" fill="#1a1a1a" />
          <path d="M2 7.5h16" stroke="#fff" stroke-width="1.2" />
          <circle cx="4.8" cy="5.5" r="0.7" fill="#fff" />
          <circle cx="7" cy="5.5" r="0.7" fill="#fff" />
        </svg>
      );
    case "lien":
      return (
        <svg {...CADRE}>
          <path
            d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.54 3.54 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.54 3.54 0 0 0 5 5l1-1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      );
    default:
      return <Feuille couleur="#8b8b8b" label="•" />;
  }
}
```

- [ ] **Step 2 : Vérifier que le projet compile**

Run: `npx astro check 2>&1 | tail -20`
Expected: aucune erreur sur `PictoDocument.tsx`. Les avertissements préexistants du dépôt ne comptent pas, comparer au `git stash` si besoin.

- [ ] **Step 3 : Commit**

```bash
git add src/components/portail/pictos/PictoDocument.tsx
git commit -m "feat(documents): les pictos, en SVG inline

Aucune favicon distante : elle dirait à Google quel client lit quel document.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : Enregistrement des pages du repo

**Files:**
- Create: `src/lib/portail/documents/sync.ts`
- Test: `src/lib/portail/documents/sync.test.ts`

**Interfaces:**
- Consumes: `creerDocument`, `DocumentRow` de Task 1.
- Produces: `PageDuRepo` (`{ cleSource, titre, url, date }`), `pagesDuClient(entrees, client)`, `enregistrerPagesDuRepo(db, client, pages, maintenant) → number`, `clesOrphelines(lignes, clesPresentes) → string[]`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/portail/documents/sync.test.ts` :

```ts
import { expect, test } from "vitest";
import { clesOrphelines, enregistrerPagesDuRepo, pagesDuClient } from "./sync";
import type { DocumentRow } from "./store";

function fakeDb(changes = 1) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          calls.push({ sql, binds });
          return {
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ meta: { changes } }),
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

const entrees = [
  {
    collection: "devis" as const,
    id: "fylgo/site-1234",
    data: { titre: "Site Fylgo", date: new Date("2026-08-04T00:00:00Z") },
  },
  {
    collection: "devis" as const,
    id: "fylgo/site-1234-v2",
    data: { titre: "Site Fylgo V2", date: new Date("2026-08-20T00:00:00Z"), versionDe: "fylgo/site-1234" },
  },
  {
    collection: "cadrage" as const,
    id: "oide/boutique-5138",
    data: { titre: "Cadrage boutique", date: new Date("2026-09-01T00:00:00Z") },
  },
];

test("pagesDuClient ne retient que les entrées du client demandé", () => {
  expect(pagesDuClient(entrees, "oide").map((p) => p.cleSource)).toEqual(["cadrage/oide/boutique-5138"]);
});

test("une version de devis ne produit pas de ligne : elle n'a pas d'URL propre", () => {
  expect(pagesDuClient(entrees, "fylgo").map((p) => p.cleSource)).toEqual(["devis/fylgo/site-1234"]);
});

test("la clé source porte la collection, l'URL est celle de la page publique", () => {
  const [page] = pagesDuClient(entrees, "oide");
  expect(page).toEqual({
    cleSource: "cadrage/oide/boutique-5138",
    titre: "Cadrage boutique",
    url: "/cadrage/oide/boutique-5138",
    date: "2026-09-01",
  });
});

test("un client dont le slug préfixe un autre ne récupère pas ses pages", () => {
  const voisins = [
    { collection: "devis" as const, id: "oide-studio/site-9999", data: { titre: "Voisin", date: new Date("2026-09-01T00:00:00Z") } },
  ];
  expect(pagesDuClient(voisins, "oide")).toEqual([]);
});

test("enregistrerPagesDuRepo insère masqué, en INSERT OR IGNORE", async () => {
  const { db, calls } = fakeDb(1);
  const creees = await enregistrerPagesDuRepo(
    db,
    "oide",
    pagesDuClient(entrees, "oide"),
    "2026-09-22T09:00:00.000Z",
  );
  expect(creees).toBe(1);
  expect(calls[0].sql).toMatch(/INSERT OR IGNORE INTO documents/);
  // visible est l'avant-dernier binding avant cree_le et cle_source.
  expect(calls[0].binds).toContain(0);
  expect(calls[0].binds).toContain("cadrage/oide/boutique-5138");
});

test("un second passage ne crée aucune ligne", async () => {
  const { db } = fakeDb(0);
  const creees = await enregistrerPagesDuRepo(
    db,
    "oide",
    pagesDuClient(entrees, "oide"),
    "2026-09-22T09:00:00.000Z",
  );
  expect(creees).toBe(0);
});

test("une page retirée du repo garde sa ligne et se signale orpheline", () => {
  const lignes = [
    { source: "page", cle_source: "devis/oide/ancien-1111" },
    { source: "page", cle_source: "cadrage/oide/boutique-5138" },
    { source: "fichier", cle_source: null },
  ] as DocumentRow[];
  expect(clesOrphelines(lignes, new Set(["cadrage/oide/boutique-5138"]))).toEqual([
    "devis/oide/ancien-1111",
  ]);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/documents/sync.test.ts`
Expected: FAIL, « Failed to resolve import "./sync" ».

- [ ] **Step 3 : Écrire le module**

`src/lib/portail/documents/sync.ts` :

```ts
// Enregistrement des pages du repo au registre (spec 2026-09-08 §4).
//
// Déclenché par le rendu de la vue admin, jamais par la vue client : la vue
// client lit, elle n'écrit pas. Idempotent par l'index unique partiel sur
// (client, cle_source), donc ni cron ni webhook.
//
// Conséquence voulue : une proposition publiée mais pas encore envoyée existe
// au registre et reste invisible.

import { creerDocument, type DocumentRow } from "./store";

export interface PageDuRepo {
  /** `devis/fylgo/site-1234` : identité stable, indépendante du titre. */
  cleSource: string;
  titre: string;
  url: string;
  /** AAAA-MM-JJ. */
  date: string;
}

/** Ce que ce module attend d'une entrée de collection, et rien de plus. */
export interface EntreeCollection {
  collection: "devis" | "cadrage";
  id: string;
  data: { titre: string; date: Date; versionDe?: string };
}

export function pagesDuClient(entrees: EntreeCollection[], client: string): PageDuRepo[] {
  const prefixe = `${client}/`;
  return entrees
    .filter((e) => e.id.startsWith(prefixe))
    // Une version n'a pas d'URL propre : elle s'affiche sous un onglet de la
    // V1. L'enregistrer mènerait le client vers la page d'un autre document.
    .filter((e) => !e.data.versionDe)
    .map((e) => ({
      cleSource: `${e.collection}/${e.id}`,
      titre: e.data.titre,
      url: `/${e.collection}/${e.id}`,
      date: e.data.date.toISOString().slice(0, 10),
    }));
}

/** Nombre de lignes réellement créées. */
export async function enregistrerPagesDuRepo(
  db: D1Database,
  client: string,
  pages: PageDuRepo[],
  maintenant: string,
): Promise<number> {
  let creees = 0;
  for (const page of pages) {
    const ligne: DocumentRow = {
      id: crypto.randomUUID(),
      client,
      titre: page.titre,
      source: "page",
      r2_key: null,
      url: page.url,
      mime: null,
      taille: null,
      date_doc: page.date,
      visible: 0,
      cree_le: maintenant,
      cle_source: page.cleSource,
    };
    if (await creerDocument(db, ligne)) creees += 1;
  }
  return creees;
}

/**
 * Les clés des lignes `page` dont le fichier YAML n'est plus dans le repo.
 * On les signale en vue admin plutôt que de supprimer : une suppression
 * silencieuse ferait disparaître un document que le client voyait la veille.
 */
export function clesOrphelines(lignes: DocumentRow[], clesPresentes: Set<string>): string[] {
  return lignes
    .filter((l) => l.source === "page" && l.cle_source && !clesPresentes.has(l.cle_source))
    .map((l) => l.cle_source as string);
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npx vitest run src/lib/portail/documents/sync.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/portail/documents/sync.ts src/lib/portail/documents/sync.test.ts
git commit -m "feat(documents): les pages du repo entrent au registre, masquées

Deux passages ne créent qu'une ligne. Une page retirée du repo garde la
sienne : la supprimer en silence retirerait au client un document vu la veille.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : Service des fichiers

C'est la tâche qui porte le risque. Un client qui connaît un identifiant ne doit récupérer ni un document masqué, ni un document d'un autre client.

**Files:**
- Create: `src/lib/portail/documents/service.ts`
- Test: `src/lib/portail/documents/service.test.ts`
- Create: `src/pages/api/documents/fichier/[id].ts`

**Interfaces:**
- Consumes: `documentPourAcces` de Task 1.
- Produces: `entetesFichier(mime, filename) → { contentType, disposition }`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/portail/documents/service.test.ts` :

```ts
import { expect, test } from "vitest";
import { entetesFichier } from "./service";

test("un PDF s'affiche dans l'onglet", () => {
  const { contentType, disposition } = entetesFichier("application/pdf", "Facture 024617.pdf");
  expect(contentType).toBe("application/pdf");
  expect(disposition).toMatch(/^inline;/);
});

test("une image s'affiche dans l'onglet", () => {
  expect(entetesFichier("image/png", "logo.png").disposition).toMatch(/^inline;/);
});

test("un type hors allowlist part en téléchargement forcé", () => {
  const { contentType, disposition } = entetesFichier("text/html", "piege.html");
  expect(contentType).toBe("application/octet-stream");
  expect(disposition).toMatch(/^attachment;/);
});

test("un MIME absent part en téléchargement forcé", () => {
  expect(entetesFichier(null, "inconnu.bin").contentType).toBe("application/octet-stream");
});

test("le nom de fichier est encodé, accents et espaces compris", () => {
  expect(entetesFichier("application/pdf", "Devis été.pdf").disposition).toContain(
    "filename*=UTF-8''Devis%20%C3%A9t%C3%A9.pdf",
  );
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/documents/service.test.ts`
Expected: FAIL, « Failed to resolve import "./service" ».

- [ ] **Step 3 : Écrire le module**

`src/lib/portail/documents/service.ts` :

```ts
// En-têtes du service de fichiers. Repris de /api/messagerie/fichier/[id],
// extrait ici pour être testable.
//
// Le MIME vient du navigateur au moment du dépôt : le servir tel quel ouvre à
// un XSS stocké, puisque my.coolbeans.cc porte le cookie de session. Seule
// une allowlist courte s'affiche inline, tout le reste se télécharge.

export function entetesFichier(
  mime: string | null,
  filename: string,
): { contentType: string; disposition: string } {
  const sur = Boolean(mime) && (mime!.startsWith("image/") || mime === "application/pdf");
  const encode = encodeURIComponent(filename);
  return {
    contentType: sur ? (mime as string) : "application/octet-stream",
    disposition: sur
      ? `inline; filename*=UTF-8''${encode}`
      : `attachment; filename*=UTF-8''${encode}`,
  };
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npx vitest run src/lib/portail/documents/service.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5 : Écrire la route**

`src/pages/api/documents/fichier/[id].ts` :

```ts
// Téléchargement d'un document. R2 est PRIVÉ : session vérifiée, document
// rattaché au client courant, et masqué invisible pour un rôle non admin.
//
// Les trois refus renvoient le même 404, sans distinguer « inexistant » de
// « pas à vous » ni de « masqué » : une réponse différente dirait au
// demandeur qu'un document existe là où il n'a rien à voir.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../../lib/portail/context";
import { isAdmin } from "../../../../lib/portail/metadata";
import { documentPourAcces } from "../../../../lib/portail/documents/store";
import { entetesFichier } from "../../../../lib/portail/documents/service";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user || !client) return new Response("Introuvable", { status: 404 });

  const doc = await documentPourAcces(env.PORTAL_DB, context.params.id ?? "", client.slug, {
    inclureMasques: isAdmin(meta),
  });
  if (!doc || doc.source !== "fichier" || !doc.r2_key) {
    return new Response("Introuvable", { status: 404 });
  }

  const objet = await env.PORTAL_FILES.get(doc.r2_key);
  if (!objet) return new Response("Fichier absent du stockage", { status: 404 });

  const { contentType, disposition } = entetesFichier(doc.mime, doc.titre);
  return new Response(objet.body, {
    headers: {
      "content-type": contentType,
      "content-disposition": disposition,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
};
```

- [ ] **Step 6 : Vérifier la suite complète**

Run: `npm test`
Expected: PASS, aucune régression.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/portail/documents/service.ts src/lib/portail/documents/service.test.ts src/pages/api/documents/fichier/
git commit -m "feat(documents): servir un fichier, sous les mêmes gardes que la messagerie

Masqué, ou appartenant à un autre client : même 404 dans les deux cas.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : La page et sa liste

**Files:**
- Create: `src/lib/portail/documents/lignes.ts`
- Test: `src/lib/portail/documents/lignes.test.ts`
- Create: `src/components/portail/ListeDocuments.tsx`
- Modify: `src/pages/espace/projets/documents.astro` (remplace la souche entière)

**Interfaces:**
- Consumes: Tasks 1 à 4.
- Produces: `LigneDocument`, `ligneDepuisDocument(doc, { orpheline })`, `dateFr(iso)`, `<ListeDocuments lignes={…} admin={…} />`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/portail/documents/lignes.test.ts` :

```ts
import { expect, test } from "vitest";
import { dateFr, ligneDepuisDocument } from "./lignes";
import type { DocumentRow } from "./store";

const base: DocumentRow = {
  id: "d1",
  client: "fylgo",
  titre: "Facture 024617",
  source: "fichier",
  r2_key: "documents/fylgo/abc.pdf",
  url: null,
  mime: "application/pdf",
  taille: 128047,
  date_doc: "2026-09-02",
  visible: 1,
  cree_le: "2026-09-22T09:00:00.000Z",
  cle_source: null,
};

test("un fichier pointe vers la route de service, jamais vers R2", () => {
  const ligne = ligneDepuisDocument(base, { orpheline: false });
  expect(ligne.href).toBe("/api/documents/fichier/d1");
  expect(ligne.famille).toBe("pdf");
  expect(ligne.typeLabel).toBe("PDF");
  expect(ligne.visible).toBe(true);
});

test("une page pointe vers son URL publique", () => {
  const ligne = ligneDepuisDocument(
    { ...base, source: "page", r2_key: null, mime: null, url: "/devis/fylgo/site-1234" },
    { orpheline: false },
  );
  expect(ligne.href).toBe("/devis/fylgo/site-1234");
  expect(ligne.typeLabel).toBe("Page Coolbeans");
});

test("un lien Granola s'annonce comme un compte rendu", () => {
  const ligne = ligneDepuisDocument(
    { ...base, source: "lien", r2_key: null, mime: null, url: "https://notes.granola.ai/d/abc" },
    { orpheline: false },
  );
  expect(ligne.typeLabel).toBe("Compte rendu");
});

test("visible: 0 devient faux, et l'orpheline est portée telle quelle", () => {
  const ligne = ligneDepuisDocument({ ...base, visible: 0 }, { orpheline: true });
  expect(ligne.visible).toBe(false);
  expect(ligne.orpheline).toBe(true);
});

test("la date se formate sans passer par le fuseau du serveur", () => {
  expect(dateFr("2026-09-02")).toBe("2 septembre 2026");
  expect(dateFr("2026-01-31")).toBe("31 janvier 2026");
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/documents/lignes.test.ts`
Expected: FAIL, « Failed to resolve import "./lignes" ».

- [ ] **Step 3 : Écrire le module**

`src/lib/portail/documents/lignes.ts` :

```ts
// Projection d'une ligne D1 vers ce que l'île affiche. Pure, donc l'île reste
// bête : elle rend ce qu'on lui passe, elle ne décide de rien.

import { familleDocument, type FamilleDocument } from "./familles";
import type { DocumentRow } from "./store";

export interface LigneDocument {
  id: string;
  titre: string;
  href: string;
  famille: FamilleDocument;
  typeLabel: string;
  date: string;
  visible: boolean;
  orpheline: boolean;
}

const LIBELLES: Record<FamilleDocument, string> = {
  pdf: "PDF",
  image: "Image",
  archive: "Archive",
  "google-docs": "Google Docs",
  granola: "Compte rendu",
  page: "Page Coolbeans",
  lien: "Lien",
  fichier: "Fichier",
};

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/**
 * `date_doc` est une date nue, pas un instant. La passer à `Date` puis à
 * `toLocaleDateString` la décalerait d'un jour sous un fuseau négatif : on la
 * découpe.
 */
export function dateFr(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  return `${Number(jour)} ${MOIS[Number(mois) - 1]} ${annee}`;
}

export function ligneDepuisDocument(
  doc: DocumentRow,
  { orpheline }: { orpheline: boolean },
): LigneDocument {
  const famille = familleDocument({ source: doc.source, mime: doc.mime, url: doc.url });
  return {
    id: doc.id,
    titre: doc.titre,
    // Un fichier ne s'atteint que par la route de service, qui porte les
    // gardes. Exposer une URL R2 les contournerait.
    href: doc.source === "fichier" ? `/api/documents/fichier/${doc.id}` : (doc.url ?? "#"),
    famille,
    typeLabel: LIBELLES[famille],
    date: dateFr(doc.date_doc),
    visible: doc.visible === 1,
    orpheline,
  };
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npx vitest run src/lib/portail/documents/lignes.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5 : Écrire l'île, sans bascule pour l'instant**

`src/components/portail/ListeDocuments.tsx` :

```tsx
// Liste des documents (spec §6) : à plat, du plus récent au plus ancien,
// toute la ligne cliquable, ouverture en nouvel onglet.
//
// La pastille ne s'affiche que sur les lignes masquées. Si toutes les lignes
// portaient un badge, plus aucune ne se remarquerait : l'œil doit accrocher
// l'exception.

import type { LigneDocument } from "../../lib/portail/documents/lignes";
import PictoDocument from "./pictos/PictoDocument";

export default function ListeDocuments({
  lignes,
  admin,
}: {
  lignes: LigneDocument[];
  admin: boolean;
}) {
  return (
    <ul class="grid gap-2x">
      {lignes.map((l) => (
        <li key={l.id}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener"
            class={`flex items-center gap-3x rounded-card px-4 py-3 hover:bg-surface-subtle ${
              l.visible ? "" : "opacity-60"
            }`}
          >
            <PictoDocument famille={l.famille} />
            <span class="min-w-0 flex-1 truncate">{l.titre}</span>
            <span class="text-sm text-mute">{l.typeLabel}</span>
            <span class="text-sm text-mute">{l.date}</span>
            {admin && !l.visible && (
              <span class="rounded-full border border-line px-2 py-0.5 text-[11px] text-mute">
                Masqué
              </span>
            )}
            {admin && l.orpheline && (
              <span class="rounded-full border border-line px-2 py-0.5 text-[11px] text-mute">
                Retiré du repo
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
```

Les classes viennent toutes de `src/styles/global.css`, au patron de `MessagerieBoard.astro` : `text-mute`, `border-line`, `bg-surface-subtle`, `rounded-card`, et l'échelle d'espacement en `Nx` (`2x`, `3x`, `4x`, `6x`, il n'y a pas de `1x`). Aucune valeur en dur, aucun `var(--…)` écrit à la main.

- [ ] **Step 6 : Écrire la page**

`src/pages/espace/projets/documents.astro`, en remplacement complet de la souche :

```astro
---
// Documents du workspace (spec 2026-09-08-documents-workspace-design.md).
//
// Vue client : les lignes visibles, et rien d'autre ne quitte le serveur.
// Vue admin : tout, précédé de l'enregistrement des pages du repo. Cet
// enregistrement n'a lieu QUE sur ce rendu : la vue client lit, elle n'écrit
// pas.
export const prerender = false;

import { getCollection } from "astro:content";
import { env } from "cloudflare:workers";
import EspaceLayout from "../../../layouts/EspaceLayout.astro";
import EmptyState from "../../../components/portail/EmptyState.astro";
import ListeDocuments from "../../../components/portail/ListeDocuments";
import { getPortalContext } from "../../../lib/portail/context";
import { isAdmin } from "../../../lib/portail/metadata";
import { documentsDuClient } from "../../../lib/portail/documents/store";
import { ligneDepuisDocument, type LigneDocument } from "../../../lib/portail/documents/lignes";
import { clesOrphelines, enregistrerPagesDuRepo, pagesDuClient } from "../../../lib/portail/documents/sync";

const { meta, client } = await getPortalContext(Astro);
const admin = isAdmin(meta);
Astro.response.headers.set("Cache-Control", "no-store");

let lignes: LigneDocument[] = [];
if (client) {
  let orphelines = new Set<string>();
  if (admin) {
    const entrees = [
      ...(await getCollection("devis")).map((e) => ({ collection: "devis" as const, id: e.id, data: e.data })),
      ...(await getCollection("cadrage")).map((e) => ({ collection: "cadrage" as const, id: e.id, data: e.data })),
    ];
    const pages = pagesDuClient(entrees, client.slug);
    await enregistrerPagesDuRepo(env.PORTAL_DB, client.slug, pages, new Date().toISOString());
    const docs = await documentsDuClient(env.PORTAL_DB, client.slug, { inclureMasques: true });
    orphelines = new Set(clesOrphelines(docs, new Set(pages.map((p) => p.cleSource))));
    lignes = docs.map((d) =>
      ligneDepuisDocument(d, { orpheline: Boolean(d.cle_source && orphelines.has(d.cle_source)) }),
    );
  } else {
    const docs = await documentsDuClient(env.PORTAL_DB, client.slug, { inclureMasques: false });
    lignes = docs.map((d) => ligneDepuisDocument(d, { orpheline: false }));
  }
}
---

<EspaceLayout title="Documents">
  <h1>Documents</h1>
  <p class="sub">Vos devis, contrats et comptes rendus.</p>

  {
    lignes.length === 0 ? (
      <EmptyState title="Rien pour le moment">
        Vos documents arriveront ici : devis, contrats, comptes rendus, à ouvrir ou à télécharger.
      </EmptyState>
    ) : (
      <div class="mt-6x">
        <ListeDocuments client:load lignes={lignes} admin={admin} />
      </div>
    )
  }
</EspaceLayout>
```

- [ ] **Step 7 : Vérifier à la main, en local**

Run: `npm run dev`

Vérifier, connecté en admin, sur `http://localhost:4321/espace/projets/documents` :
1. les propositions et cadrages du client courant apparaissent, toutes avec la pastille `Masqué` ;
2. recharger la page ne duplique aucune ligne ;
3. basculer de workspace ne fait pas apparaître les documents du précédent.

Puis en base : `npx wrangler d1 execute coolbeans-portal --local --command="SELECT client, titre, source, visible FROM documents"`.

- [ ] **Step 8 : Commit**

```bash
git add src/lib/portail/documents/lignes.ts src/lib/portail/documents/lignes.test.ts src/components/portail/ListeDocuments.tsx src/pages/espace/projets/documents.astro
git commit -m "feat(documents): la page, en vue client et en vue admin

La pastille ne marque que les lignes masquées : un badge sur chaque ligne ne
se remarquerait plus.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7 : Bascule de visibilité

**Files:**
- Create: `src/pages/api/documents/visibilite.ts`
- Modify: `src/components/portail/ListeDocuments.tsx`

**Interfaces:**
- Consumes: `definirVisibilite` de Task 1, `LigneDocument` de Task 6.
- Produces: `POST /api/documents/visibilite` avec `{ id, visible }`, réponse `{ ok: true }` ou `{ error }`.

- [ ] **Step 1 : Écrire la route**

`src/pages/api/documents/visibilite.ts` :

```ts
// Bascule de visibilité d'un document. Réservée à l'admin, et bornée au
// client courant : le slug du client vient du contexte serveur, jamais du
// corps de la requête, sinon un id forgé suffirait à changer autre chose.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../lib/portail/context";
import { isAdmin } from "../../../lib/portail/metadata";
import { definirVisibilite } from "../../../lib/portail/documents/store";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user) return json({ error: "Session expirée : reconnectez-vous puis réessayez." }, 401);
  if (!isAdmin(meta)) return json({ error: "Réservé à l'administrateur." }, 403);
  if (!client) return json({ error: "Aucun client sélectionné." }, 400);

  const corps = (await context.request.json().catch(() => null)) as
    | { id?: string; visible?: boolean }
    | null;
  if (!corps?.id || typeof corps.visible !== "boolean") {
    return json({ error: "Requête incomplète." }, 400);
  }

  const fait = await definirVisibilite(env.PORTAL_DB, corps.id, client.slug, corps.visible);
  if (!fait) return json({ error: "Document introuvable." }, 404);
  return json({ ok: true }, 200);
};
```

- [ ] **Step 2 : Ajouter la bascule optimiste à l'île**

Dans `src/components/portail/ListeDocuments.tsx`, remplacer le composant par :

```tsx
import { useState } from "preact/hooks";
import type { LigneDocument } from "../../lib/portail/documents/lignes";
import PictoDocument from "./pictos/PictoDocument";

export default function ListeDocuments({
  lignes,
  admin,
}: {
  lignes: LigneDocument[];
  admin: boolean;
}) {
  const [etats, setEtats] = useState<Record<string, boolean>>(
    Object.fromEntries(lignes.map((l) => [l.id, l.visible])),
  );
  const [erreur, setErreur] = useState<string | null>(null);

  // Optimiste : l'état bascule tout de suite, et revient si l'appel échoue.
  // Une bascule qui attend l'aller-retour donne l'impression d'un clic perdu.
  async function basculer(id: string, versVisible: boolean) {
    setEtats((e) => ({ ...e, [id]: versVisible }));
    setErreur(null);
    try {
      const r = await fetch("/api/documents/visibilite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, visible: versVisible }),
      });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      setEtats((e) => ({ ...e, [id]: !versVisible }));
      setErreur("La bascule n'a pas été enregistrée. Réessayez.");
    }
  }

  return (
    <>
      {erreur && <p class="mb-2x text-sm text-error">{erreur}</p>}
      <ul class="grid gap-2x">
        {lignes.map((l) => {
          const visible = etats[l.id];
          return (
            <li key={l.id} class="flex items-center gap-3x rounded-card px-4 py-3 hover:bg-surface-subtle">
              <a
                href={l.href}
                target="_blank"
                rel="noopener"
                class={`flex min-w-0 flex-1 items-center gap-3x ${visible ? "" : "opacity-60"}`}
              >
                <PictoDocument famille={l.famille} />
                <span class="min-w-0 flex-1 truncate">{l.titre}</span>
                <span class="text-sm text-mute">{l.typeLabel}</span>
                <span class="text-sm text-mute">{l.date}</span>
              </a>
              {admin && !visible && (
                <span class="rounded-full border border-line px-2 py-0.5 text-[11px] text-mute">
                  Masqué
                </span>
              )}
              {admin && l.orpheline && (
                <span class="rounded-full border border-line px-2 py-0.5 text-[11px] text-mute">
                  Retiré du repo
                </span>
              )}
              {admin && (
                <button
                  type="button"
                  class="text-sm text-mute underline underline-offset-2"
                  onClick={() => basculer(l.id, !visible)}
                >
                  {visible ? "Masquer" : "Rendre visible"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
```

Le lien n'enveloppe plus toute la ligne : un bouton dans un lien n'est pas du HTML valide et le clic de bascule suivrait le lien. La zone cliquable reste tout ce qui n'est pas le bouton.

- [ ] **Step 3 : Vérifier à la main, en local**

Run: `npm run dev`

1. En admin, cliquer `Rendre visible` : la pastille disparaît immédiatement.
2. Recharger : l'état tient.
3. En base : `npx wrangler d1 execute coolbeans-portal --local --command="SELECT titre, visible FROM documents WHERE visible = 1"`.
4. Se connecter avec un compte client du même workspace : seules les lignes basculées apparaissent, et aucun bouton.
5. Dans l'onglet Réseau, couper la connexion puis cliquer : l'état revient en arrière et le message d'erreur s'affiche.

- [ ] **Step 4 : Vérifier la garde à la main**

Depuis une session cliente, dans la console du navigateur :

```js
await fetch("/api/documents/visibilite", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: "<id d'un document>", visible: true }),
}).then((r) => r.status);
```

Expected: `403`.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/api/documents/visibilite.ts src/components/portail/ListeDocuments.tsx
git commit -m "feat(documents): montrer ou masquer un document en un clic

Le slug du client vient du contexte serveur, jamais du corps de la requête.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8 : Dépôt d'un fichier, ajout d'un lien

**Files:**
- Create: `src/lib/portail/documents/depot.ts`
- Test: `src/lib/portail/documents/depot.test.ts`
- Create: `src/pages/api/documents/nouveau.ts`
- Create: `src/components/portail/DeposerDocument.astro`
- Modify: `src/pages/espace/projets/documents.astro`

**Interfaces:**
- Consumes: `creerDocument` de Task 1.
- Produces: `MAX_TAILLE`, `validerDepot(fichier)`, `cleR2Document(client, filename)`, `POST /api/documents/nouveau`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/portail/documents/depot.test.ts` :

```ts
import { expect, test } from "vitest";
import { cleR2Document, MAX_TAILLE, validerDepot } from "./depot";

test("un fichier sous le plafond passe", () => {
  expect(validerDepot({ name: "brand-book.pdf", size: 5_000_000 })).toBeNull();
});

test("un fichier au dessus du plafond est refusé, avec son nom dans le message", () => {
  const erreur = validerDepot({ name: "video.mp4", size: MAX_TAILLE + 1 });
  expect(erreur).toContain("video.mp4");
});

test("la clé R2 range par client et ne reprend jamais le nom d'origine", () => {
  const cle = cleR2Document("fylgo", "Facture (1).PDF");
  expect(cle.startsWith("documents/fylgo/")).toBe(true);
  expect(cle.endsWith(".pdf")).toBe(true);
  expect(cle).not.toContain("Facture");
});

test("un fichier sans extension reçoit une extension de repli", () => {
  expect(cleR2Document("fylgo", "sans-extension").endsWith(".bin")).toBe(true);
});

test("deux dépôts du même nom ne produisent pas la même clé", () => {
  expect(cleR2Document("fylgo", "a.pdf")).not.toBe(cleR2Document("fylgo", "a.pdf"));
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/documents/depot.test.ts`
Expected: FAIL, « Failed to resolve import "./depot" ».

- [ ] **Step 3 : Écrire le module**

`src/lib/portail/documents/depot.ts` :

```ts
// Contraintes du dépôt et nommage des clés R2, au patron de
// src/lib/portail/messagerie/fichiers.ts.
//
// Le nom d'origine ne sert JAMAIS de clé : traversée de chemin, collisions,
// caractères exotiques. Il est conservé en `titre` pour l'affichage.

/** 25 Mo : un brand book PDF dépasse couramment les 10 Mo d'une pièce jointe. */
export const MAX_TAILLE = 25 * 1024 * 1024;

export function validerDepot(fichier: { name: string; size: number }): string | null {
  if (fichier.size === 0) return `Le fichier « ${fichier.name} » est vide.`;
  if (fichier.size > MAX_TAILLE) {
    return `Chaque fichier doit faire moins de 25 Mo (« ${fichier.name} »).`;
  }
  return null;
}

export function cleR2Document(client: string, filename: string): string {
  const ext = /\.([a-zA-Z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "bin";
  return `documents/${client}/${crypto.randomUUID()}.${ext}`;
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npx vitest run src/lib/portail/documents/depot.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5 : Écrire la route**

`src/pages/api/documents/nouveau.ts` :

```ts
// Dépôt d'un fichier ou ajout d'un lien, depuis la vue admin du workspace du
// client. Une seule route pour les deux : c'est le même geste côté Ludo, et
// la seule différence est ce qui part dans R2.
//
// Ordre : validation, puis R2, puis D1. Une ligne D1 sans objet R2 donnerait
// un document qui s'affiche et ne s'ouvre pas.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../lib/portail/context";
import { isAdmin } from "../../../lib/portail/metadata";
import { creerDocument } from "../../../lib/portail/documents/store";
import { cleR2Document, validerDepot } from "../../../lib/portail/documents/depot";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user) return json({ error: "Session expirée : reconnectez-vous puis réessayez." }, 401);
  if (!isAdmin(meta)) return json({ error: "Réservé à l'administrateur." }, 403);
  if (!client) return json({ error: "Aucun client sélectionné." }, 400);

  const fd = await context.request.formData();
  const fichier = fd.get("fichier");
  const url = String(fd.get("url") ?? "").trim();
  const titreSaisi = String(fd.get("titre") ?? "").trim().slice(0, 200);
  const dateSaisie = String(fd.get("date") ?? "").trim();

  const maintenant = new Date().toISOString();
  const dateDoc = /^\d{4}-\d{2}-\d{2}$/.test(dateSaisie) ? dateSaisie : maintenant.slice(0, 10);

  if (fichier instanceof File && fichier.size > 0) {
    const erreur = validerDepot({ name: fichier.name, size: fichier.size });
    if (erreur) return json({ error: erreur }, 400);

    const cle = cleR2Document(client.slug, fichier.name);
    try {
      await env.PORTAL_FILES.put(cle, fichier.stream(), {
        httpMetadata: { contentType: fichier.type },
      });
    } catch (err) {
      console.error("documents: dépôt R2 échoué", err);
      return json({ error: "Dépôt impossible pour le moment." }, 500);
    }

    await creerDocument(env.PORTAL_DB, {
      id: crypto.randomUUID(),
      client: client.slug,
      titre: titreSaisi || fichier.name,
      source: "fichier",
      r2_key: cle,
      url: null,
      mime: fichier.type || null,
      taille: fichier.size,
      date_doc: dateDoc,
      visible: 0,
      cree_le: maintenant,
      cle_source: null,
    });
    return json({ ok: true }, 200);
  }

  if (url) {
    // Seulement http(s) : un `javascript:` déposé ici deviendrait une ligne
    // cliquable sur l'origine qui porte le cookie de session.
    let schemaSur = false;
    try {
      const protocole = new URL(url).protocol;
      schemaSur = protocole === "https:" || protocole === "http:";
    } catch {
      schemaSur = false;
    }
    if (!schemaSur) return json({ error: "Adresse invalide." }, 400);
    if (!titreSaisi) return json({ error: "Le titre est obligatoire pour un lien." }, 400);

    await creerDocument(env.PORTAL_DB, {
      id: crypto.randomUUID(),
      client: client.slug,
      titre: titreSaisi,
      source: "lien",
      r2_key: null,
      url,
      mime: null,
      taille: null,
      date_doc: dateDoc,
      visible: 0,
      cree_le: maintenant,
      cle_source: null,
    });
    return json({ ok: true }, 200);
  }

  return json({ error: "Déposez un fichier ou saisissez une adresse." }, 400);
};
```

- [ ] **Step 6 : Écrire le formulaire admin**

`src/components/portail/DeposerDocument.astro` :

```astro
---
// Dépôt admin : un fichier, ou une adresse. Rendu par la seule vue admin.
// Le document naît masqué, comme tous les autres : le dépôt n'est pas la
// décision de montrer.
---

<form
  id="deposer-document"
  class="grid gap-3x rounded-card border border-line p-6x"
  enctype="multipart/form-data"
>
  <p class="text-sm text-mute">
    Le document arrive masqué. Il faut le rendre visible pour que le client le voie.
  </p>
  <label class="label field-label" for="doc-fichier">Fichier</label>
  <input id="doc-fichier" name="fichier" type="file" />
  <label class="label field-label" for="doc-url">ou adresse</label>
  <input id="doc-url" name="url" type="url" placeholder="https://docs.google.com/..." />
  <label class="label field-label" for="doc-titre">Titre</label>
  <input id="doc-titre" name="titre" type="text" placeholder="Repris du nom du fichier si vide" />
  <label class="label field-label" for="doc-date">Date</label>
  <input id="doc-date" name="date" type="date" />
  <button type="submit">Ajouter</button>
  <p id="doc-erreur" class="text-sm text-error" hidden></p>
</form>

<script>
  const form = document.getElementById("deposer-document") as HTMLFormElement;
  const erreur = document.getElementById("doc-erreur") as HTMLParagraphElement;
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    erreur.hidden = true;
    const r = await fetch("/api/documents/nouveau", { method: "POST", body: new FormData(form) });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      erreur.textContent = data.error ?? "Ajout impossible.";
      erreur.hidden = false;
      return;
    }
    location.reload();
  });
</script>
```

Les classes de champ viennent de `/design-system` : `label field-label` est la forme en vigueur, à vérifier avant de committer.

- [ ] **Step 7 : Brancher le formulaire sur la page**

Dans `src/pages/espace/projets/documents.astro`, ajouter l'import et le rendu, sous le `<p class="sub">` :

```astro
import DeposerDocument from "../../../components/portail/DeposerDocument.astro";
```

```astro
{admin && <div class="mt-6x"><DeposerDocument /></div>}
```

- [ ] **Step 8 : Vérifier à la main, en local**

Run: `npm run dev`

1. Déposer un PDF : la ligne apparaît, masquée, avec le picto PDF.
2. Cliquer dessus : le PDF s'ouvre dans un nouvel onglet.
3. Ajouter un lien Google Docs : la ligne porte le picto Docs et ouvre le document.
4. Tenter une adresse `javascript:alert(1)` : refus avec « Adresse invalide ».
5. Vérifier la clé R2 : `npx wrangler d1 execute coolbeans-portal --local --command="SELECT r2_key FROM documents WHERE source='fichier'"` renvoie bien `documents/<client>/<uuid>.<ext>`.

- [ ] **Step 9 : Commit**

```bash
git add src/lib/portail/documents/depot.ts src/lib/portail/documents/depot.test.ts src/pages/api/documents/nouveau.ts src/components/portail/DeposerDocument.astro src/pages/espace/projets/documents.astro
git commit -m "feat(documents): déposer un fichier ou ajouter un lien depuis la vue admin

Le document naît masqué : déposer n'est pas décider de montrer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9 : Ouvrir l'entrée de nav et tenir la doc

**Files:**
- Modify: `src/lib/portail/nav.ts:155`
- Modify: `src/lib/portail/nav.test.ts`
- Modify: `src/content/docs/coolbeans/04-portail.mdx`

**Interfaces:**
- Consumes: la page de Task 6.
- Produces: rien de nouveau.

- [ ] **Step 1 : Ouvrir l'entrée**

Dans `src/lib/portail/nav.ts`, remplacer :

```ts
      { label: "Documents", path: "/projets/documents", flag: "wip" }, // COO-70
```

par :

```ts
      { label: "Documents", path: "/projets/documents", flag: "live" },
```

- [ ] **Step 2 : Lancer les tests de nav**

Run: `npx vitest run src/lib/portail/nav.test.ts`
Expected: PASS. Si un test comptait les entrées `wip` de la section Projets, mettre à jour son attendu dans le même commit.

- [ ] **Step 3 : Mettre la doc à jour**

Dans `src/content/docs/coolbeans/04-portail.mdx`, à la section qui décrit les pages du portail, insérer :

```mdx
### Documents

La page rassemble trois natures de documents : les fichiers déposés depuis la vue admin
(devis, factures, contrats, logos), les pages produites par le repo (cadrages et
propositions commerciales), et les liens externes (Google Docs, comptes rendus Granola).

Tout document arrive **masqué**. Le client ne voit que ce qui a été rendu visible, ligne
par ligne, depuis la vue admin. Un document masqué n'apparaît ni dans la page ni dans le
HTML servi, et sa route de téléchargement répond 404.

Les cadrages et les propositions du client s'enregistrent tout seuls, à chaque ouverture
de la page en vue admin. Une page retirée du repo garde sa ligne, signalée « Retiré du
repo » plutôt que supprimée en silence.
```

Ajuster le niveau de titre à celui des sections voisines du fichier.

- [ ] **Step 4 : Vérifier la suite complète et le build**

Run: `npm test && npm run build`
Expected: PASS, build sans erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/portail/nav.ts src/lib/portail/nav.test.ts src/content/docs/coolbeans/04-portail.mdx
git commit -m "feat(documents): ouvrir l'entrée Documents du portail

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10 : Rattacher les objets R2 déjà déposés

Hors spec §8, voir « Décisions prises en écrivant ce plan », point 7. Sans cette tâche, les 38 PDF déjà dans le bucket de production restent invisibles du registre.

**Files:**
- Create: `scripts/rattacher-documents-r2.mjs`
- Create: `docs/brouillons/2026-09-22-rattachement-documents.csv`

**Interfaces:**
- Consumes: la table `documents` de Task 1.
- Produces: un script idempotent, exécuté à la main.

- [ ] **Step 1 : Écrire le fichier de correspondance**

`docs/brouillons/2026-09-22-rattachement-documents.csv`, une ligne par objet R2 à rattacher :

```csv
cle_r2,client,titre,date_doc
Devis_004326_Coolbeans_BOURGOIN_LUDOVIC_DOS_ET_POSTURE.pdf,unlockbreath,Devis 004326,2026-08-20
Facture_024614_Coolbeans_BOURGOIN_LUDOVIC_DOS_ET_POSTURE.pdf,unlockbreath,Facture 024614,2026-08-20
Devis_004329_Coolbeans_BOURGOIN_LUDOVIC_3BNBW_OIDE.pdf,oide,Devis 004329,2026-08-20
Facture_024618_Coolbeans_BOURGOIN_LUDOVIC_3BNBW_OIDE.pdf,oide,Facture 024618,2026-08-20
Devis_004330_Coolbeans_BOURGOIN_LUDOVIC_ABEAM_DRINKS.pdf,fylgo,Devis 004330,2026-08-20
Facture_024617_Coolbeans_BOURGOIN_LUDOVIC_ABEAM_DRINKS.pdf,fylgo,Facture 024617,2026-08-20
Facture_024624_Coolbeans_BOURGOIN_LUDOVIC_ABEAM_DRINKS.pdf,fylgo,Facture 024624,2026-09-02
```

Les dates ci-dessus sont à corriger d'après chaque PDF : elles ne sont pas dans le nom du fichier. Les lignes TRIGGER sont volontairement absentes, voir « Ce que ce plan ne fait pas ». Les entités LITTLE BOX et CLUB AFFAIRES FRANCO-ALLEMAND se rattachent aux workspaces `littlebox` et `cafa` une fois leur fiche créée au registre. DUPONTDUPONT et MERCIYANIS restent à identifier. Les 16 PDF Shine, nommés en UUID, se rattachent après ouverture de chacun.

- [ ] **Step 2 : Écrire le script**

`scripts/rattacher-documents-r2.mjs` :

```js
#!/usr/bin/env node
// Rattache au registre des objets R2 déjà déposés à la main dans le bucket.
// Le dépôt par la vue admin ne couvre pas ce cas : ces fichiers sont là
// depuis avant la fonctionnalité.
//
// Idempotent par la clé R2 : une ligne existante n'est jamais dupliquée.
// Tout est inséré MASQUÉ, comme tout le reste du registre.
//
// Usage :
//   node scripts/rattacher-documents-r2.mjs <fichier.csv> [--remote]
// Sans --remote, la base visée est la base D1 locale.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const [, , fichierCsv, ...flags] = process.argv;
if (!fichierCsv) {
  console.error("Usage : node scripts/rattacher-documents-r2.mjs <fichier.csv> [--remote]");
  process.exit(1);
}
const remote = flags.includes("--remote");

const lignes = readFileSync(fichierCsv, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .slice(1);

const maintenant = new Date().toISOString();
const sql = [];
for (const ligne of lignes) {
  const [cleR2, client, titre, dateDoc] = ligne.split(",").map((c) => c.trim());
  if (!cleR2 || !client || !titre || !dateDoc) {
    console.error(`Ligne ignorée, colonne manquante : ${ligne}`);
    continue;
  }
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  sql.push(
    `INSERT INTO documents (id, client, titre, source, r2_key, url, mime, taille, date_doc, visible, cree_le, cle_source)
     SELECT ${q(randomUUID())}, ${q(client)}, ${q(titre)}, 'fichier', ${q(cleR2)}, NULL, 'application/pdf', NULL, ${q(dateDoc)}, 0, ${q(maintenant)}, NULL
     WHERE NOT EXISTS (SELECT 1 FROM documents WHERE r2_key = ${q(cleR2)});`,
  );
}

if (sql.length === 0) {
  console.log("Rien à rattacher.");
  process.exit(0);
}

const args = [
  "wrangler",
  "d1",
  "execute",
  remote ? "coolbeans-portal" : "coolbeans-portal",
  remote ? "--remote" : "--local",
  "--command",
  sql.join("\n"),
];
execFileSync("npx", args, { stdio: "inherit" });
console.log(`${sql.length} document(s) rattaché(s), tous masqués.`);
```

- [ ] **Step 3 : Essayer en local**

Run: `node scripts/rattacher-documents-r2.mjs docs/brouillons/2026-09-22-rattachement-documents.csv`
Expected: `7 document(s) rattaché(s), tous masqués.`

Relancer la même commande : la sortie annonce le même nombre, mais `SELECT count(*) FROM documents WHERE source='fichier'` ne bouge pas. Vérifier :

```sh
npx wrangler d1 execute coolbeans-portal --local --command="SELECT count(*) AS n FROM documents WHERE source='fichier'"
```

- [ ] **Step 4 : Commit**

```bash
git add scripts/rattacher-documents-r2.mjs docs/brouillons/2026-09-22-rattachement-documents.csv
git commit -m "feat(documents): rattacher au registre les fichiers déjà dans R2

Le dépôt par la vue admin ne couvre pas les fichiers déposés avant la
fonctionnalité. Insertion masquée, idempotente sur la clé R2.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Mise en ligne

Ces gestes ne se parallélisent pas : une seule session à la fois, quel que soit le worktree d'où elle part. Aucun ne se fait sans ordre explicite de Ludo.

1. Merge dans `staging`, après relecture de `git log staging..feat/documents-workspace`.
2. Migration de la base de staging :
   `npx wrangler d1 execute coolbeans-portal-staging --remote --file=migrations/0008_documents.sql`
3. Push de `staging`, puis attendre la fin du build Workers (environ 6 minutes) et le vérifier avant d'annoncer quoi que ce soit.
4. Recette sur `my-staging.coolbeans.cc` : les quatre points de la section suivante.
5. **Sur ordre seulement**, merge vers `main`, puis migration de la base de production :
   `npx wrangler d1 execute coolbeans-portal --remote --file=migrations/0008_documents.sql`

La migration de production se lance dès le merge vers `main`, pas après : une base sans la table `documents` sous un code qui l'interroge fait tomber `/espace` en 500.

## Recette avant mise en ligne

1. Un compte client ne voit aucune ligne masquée, ni dans la page, ni dans le HTML servi (chercher le titre d'un document masqué dans les sources de la page).
2. Un compte client reçoit 404 sur `/api/documents/fichier/<id>` pour un document masqué.
3. Un compte client reçoit 404 sur `/api/documents/fichier/<id>` pour un document d'un autre client.
4. Un compte client reçoit 403 sur `POST /api/documents/visibilite`.

Les deux premiers sont ceux qui comptent : le reste du module peut casser sans conséquence grave, ces chemins-là fuient des documents.

## Ce que ce plan ne fait pas

- **Les sept fichiers TRIGGER ne sont rattachés à aucun workspace.** Ils sont adressés au revendeur : posés dans l'espace d'Amusoire, ils montreraient au client final ce que Trigger paie, donc la marge. Le modèle revendeur demande une décision avant, pas une ligne de CSV.
- Versionnage d'un document remplacé (COO-89), dossiers, recherche, filtres par type.
- Notifications. COO-90 est à annuler dans Linear, pas à déplacer.
- Collections `livrable` et `temoignage` : hors registre en V1.
