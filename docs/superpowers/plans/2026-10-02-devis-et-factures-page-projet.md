# Devis et factures dans la page projet : plan d'implémentation

> **Remplacé le 2026-10-03** par la version simplifiée décrite en tête de la spec. Ce plan reste comme trace de ce qui a été livré puis retiré.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** afficher dans la page projet du portail les devis, factures et avoirs Tiime du client, avec leur statut et leur PDF, à partir d'un registre D1 alimenté par un import manuel.

**Architecture :** une table D1 `pieces` porte le registre, les PDF vivent dans R2 sous `pieces/<client ou organisation>/<id>.pdf` (déjà déposés en staging et en prod). Un planificateur pur (`src/lib/pieces/plan-import.ts`) décide quoi écrire à partir du manifeste JSON. Un script `.mts` l'exécute contre la base locale, staging ou prod via Wrangler. La page projet lit les pièces par client et par projet de la nomenclature. Une page admin sous `/espace/admin/finances/` rattache les pièces et note les règlements.

**Tech Stack :** Astro 6 (SSR Cloudflare Workers), D1, R2, Vitest, `node:sqlite` pour rejouer les migrations, Node 22 (`--experimental-strip-types`), Wrangler 4.

**Spec :** `docs/superpowers/specs/2026-10-02-devis-et-factures-page-projet-design.md` (validée par Ludo le 2026-10-02). Manifeste du premier import : `scripts/pieces/tiime-2026-10-02.json`.

## Global Constraints

- Travailler dans le worktree `/Users/ludovicbourgoin/dev/coolbeans-pieces`, branche `feat/pieces`. Vérifier `pwd` et `git branch --show-current` avant le premier edit de chaque tâche.
- Jamais `git add -A` : ajouter les chemins un par un.
- Avant de lancer le serveur de dev : copier `.env`, `.dev.vars` et `.wrangler/state` depuis `/Users/ludovicbourgoin/dev/coolbeans`, puis `npm ci` (voir `CLAUDE.md` du repo).
- Migration : `migrations/0014_pieces.sql`. Vérifier avant l'écriture que `0014` est libre sur `origin/staging` (`git ls-tree origin/staging migrations/`). Pris, prendre le numéro suivant et le reporter partout dans ce plan.
- Le portail n'affiche que les pièces Tiime. Les pièces Shine restent dans le Google Sheet `finance`.
- Une pièce adressée à un revendeur (`organisation` renseignée, `client` vide) ne s'affiche chez aucun client et sa route client répond 404. Seul l'admin la voit.
- Une pièce sans `projet` ne s'affiche chez aucun client. La facture 24615 (doublon de la facture Shine 20250146) arrive sans projet dans le manifeste et doit le rester.
- Un réimport ne repasse jamais une facture `reglee` ou `annulee` en `a_regler`, et ne touche jamais au `projet` d'une ligne existante.
- Libellés client : « Devis n° 4330 », « Facture d'acompte n° 24617 », « Facture intermédiaire n° … », « Facture de solde n° 24624 », « Avoir n° … ». Le numéro s'affiche comme sur le PDF, sans zéros de tête, avec une espace insécable après « n° ».
- Statuts client : « Réglée le 12/04/2026 », « Réglée » sans date connue, « À régler, échéance le 30/09/2026 », « Annulée ». Rien pour un devis ni pour un avoir.
- Montants au format `Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })` : `3 528,00 €` avec U+202F comme séparateur de milliers et U+00A0 avant `€`.
- Toute donnée financière côté admin vit sous `/espace/admin/finances/` (règle écrite dans `src/lib/portail/pages-admin.test.ts`). Les routes d'API admin vivent sous `/api/admin/finances/`.
- `refonte-432` garde la clé client `amu` dans `src/lib/documents/nomenclature.ts` : il porte le témoignage d'Amusoire, et son sort attend Ludo.
- Production : la migration D1 de prod, l'import en prod et le merge vers `main` ne partent que sur ordre explicite de Ludo. Le classifieur d'auto mode les refuse sans cet ordre.
- Textes en français relus : sujet, verbe, complément, pas de tiret cadratin, pas de tournure d'annonce.

## Review Focus

- **Accès direct à un PDF d'un autre client** (`/api/pieces/facture-024624` depuis le workspace Oïde) : 404, comme une pièce inconnue. Test dans la tâche 6.
- **Pièce adressée à Trigger** : jamais dans une page projet, 404 sur la route client même pour l'admin, lisible seulement par la route admin. Tests dans les tâches 2 et 6.
- **Réimport après un clic admin** (« Réglée » posé à la main, projet rattaché à la main) : rien n'est défait. Tests dans la tâche 1.
- **Avoir et montants négatifs** : `-6 433,33 €` s'affiche sans casser la mise en forme, et la contrainte SQL accepte un HT négatif. Tests dans les tâches 2 et 3.
- **Base D1 muette ou table absente** (migration oubliée sur un environnement) : la page projet s'affiche sans le bloc au lieu de répondre 500. Test manuel dans la tâche 7.

---

### Task 1 : le type `Piece` et le planificateur d'import

**Files :**
- Create : `src/lib/pieces/piece.ts`
- Create : `src/lib/pieces/plan-import.ts`
- Test : `src/lib/pieces/plan-import.test.ts`

**Interfaces :**
- Consumes : rien.
- Produces :
  - `piece.ts` : `type TypePiece = "devis" | "facture" | "avoir"`, `type CategoriePiece = "acompte" | "intermediaire" | "solde"`, `type StatutPiece = "a_regler" | "reglee" | "annulee"`, `interface Piece` (colonnes de la table, montants en centimes).
  - `plan-import.ts` : `interface PieceManifeste`, `interface Fiche { slug; genre: "client" | "organisation"; raisonsSociales: string[] }`, `interface EntreeImport`, `interface PlanImport { nouvelles: Piece[]; modifiees: { piece: Piece; champs: (keyof Piece)[] }[]; inchangees: string[]; ecartees: { id: string; motif: string }[]; pdfs: Record<string, string> }`, `normaliserRaison(texte: string): string`, `cleR2(id: string, dossier: string): string`, `pdfDeLaPiece(type, numero, pdfs): string | undefined`, `statutFinal(existant, importe): StatutPiece | null`, `planifierImport(e: EntreeImport): PlanImport`, `sqlEcriture(pieces: readonly Piece[]): string`.

`plan-import.ts` n'a aucun import à l'exécution : le script de la tâche 5 l'importe sous `node --experimental-strip-types`, qui ne résout pas les imports sans extension. Les imports de type disparaissent à l'exécution, ils sont permis.

- [ ] **Step 1 : écrire le type**

```ts
// src/lib/pieces/piece.ts
/* Une pièce comptable Tiime telle que la table `pieces` la porte (spec
   2026-10-02-devis-et-factures-page-projet-design.md §1). Types seuls : le
   script d'import les importe aussi, et Node retire les imports de type. */
export type TypePiece = "devis" | "facture" | "avoir";
export type CategoriePiece = "acompte" | "intermediaire" | "solde";
export type StatutPiece = "a_regler" | "reglee" | "annulee";

export interface Piece {
  /** Type et numéro : `facture-024624`. */
  id: string;
  type: TypePiece;
  /** Numéro Tiime en texte, zéros compris : `024624`. */
  numero: string;
  categorie: CategoriePiece | null;
  emise_le: string;
  echeance: string | null;
  /** Centimes. Négatifs pour un avoir. */
  ht: number;
  tva: number;
  ttc: number;
  statut: StatutPiece | null;
  reglee_le: string | null;
  /** Slug de fiche client. Vide pour une pièce adressée à un revendeur. */
  client: string | null;
  /** Slug de fiche revendeur. Vide pour une pièce adressée à un client. */
  organisation: string | null;
  /** Slug de la table PROJETS. Vide tant que la pièce n'est pas rattachée. */
  projet: string | null;
  raison_sociale: string;
  r2_key: string;
}
```

- [ ] **Step 2 : écrire les tests du planificateur**

```ts
// src/lib/pieces/plan-import.test.ts
import { describe, expect, it } from "vitest";
import type { Piece } from "./piece";
import {
  normaliserRaison,
  pdfDeLaPiece,
  planifierImport,
  sqlEcriture,
  statutFinal,
  type EntreeImport,
  type PieceManifeste,
} from "./plan-import";

const solde: PieceManifeste = {
  id: "facture-024624",
  type: "facture",
  numero: "024624",
  categorie: "solde",
  emise_le: "2026-08-24",
  echeance: "2026-08-24",
  ht: 294000,
  tva: 58800,
  ttc: 352800,
  statut: "a_regler",
  raison_sociale: "ABEAM DRINKS",
  client: "fylgo",
  projet: "boutique-shopify-390",
};

const entree = (over: Partial<EntreeImport> = {}): EntreeImport => ({
  manifeste: [solde],
  fiches: [
    { slug: "fylgo", genre: "client", raisonsSociales: ["ABEAM DRINKS"] },
    { slug: "trigger", genre: "organisation", raisonsSociales: ["TRIGGER"] },
  ],
  pdfs: ["Facture_024624_Coolbeans_Ludovic_Bourgoin_ABEAM_DRINKS.pdf"],
  existantes: [],
  projetsConnus: ["boutique-shopify-390", "refonte-432"],
  ...over,
});

const enBase = (over: Partial<Piece> = {}): Piece => ({
  id: "facture-024624",
  type: "facture",
  numero: "024624",
  categorie: "solde",
  emise_le: "2026-08-24",
  echeance: "2026-08-24",
  ht: 294000,
  tva: 58800,
  ttc: 352800,
  statut: "a_regler",
  reglee_le: null,
  client: "fylgo",
  organisation: null,
  projet: "boutique-shopify-390",
  raison_sociale: "ABEAM DRINKS",
  r2_key: "pieces/fylgo/facture-024624.pdf",
  ...over,
});

describe("planifierImport", () => {
  it("crée une pièce nouvelle avec sa clé R2 et le projet du manifeste", () => {
    const plan = planifierImport(entree());
    expect(plan.nouvelles).toHaveLength(1);
    expect(plan.nouvelles[0]).toMatchObject({
      r2_key: "pieces/fylgo/facture-024624.pdf",
      projet: "boutique-shopify-390",
      statut: "a_regler",
      reglee_le: null,
    });
    expect(plan.pdfs["facture-024624"]).toBe("Facture_024624_Coolbeans_Ludovic_Bourgoin_ABEAM_DRINKS.pdf");
  });

  it("range sous l'organisation une pièce adressée à un revendeur", () => {
    const plan = planifierImport(
      entree({
        manifeste: [{ ...solde, client: undefined, organisation: "trigger", raison_sociale: "TRIGGER", projet: "refonte-432" }],
      }),
    );
    expect(plan.nouvelles[0]).toMatchObject({ client: null, organisation: "trigger", r2_key: "pieces/trigger/facture-024624.pdf" });
  });

  it("ignore la casse et les espaces en trop de la raison sociale", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, raison_sociale: "  abeam   drinks " }] }));
    expect(plan.ecartees).toEqual([]);
  });

  it("écarte une raison sociale absente de la fiche", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, raison_sociale: "AUTRE SAS" }] }));
    expect(plan.ecartees).toEqual([{ id: "facture-024624", motif: "« AUTRE SAS » absente des raisonsSociales de fylgo" }]);
  });

  it("écarte une fiche introuvable", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, client: "inconnu" }] }));
    expect(plan.ecartees[0].motif).toBe("fiche clients/inconnu introuvable");
  });

  it("écarte une pièce sans PDF", () => {
    const plan = planifierImport(entree({ pdfs: [] }));
    expect(plan.ecartees[0].motif).toBe("aucun PDF pour facture 024624");
  });

  it("écarte un projet absent de la table PROJETS", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, projet: "projet-999" }] }));
    expect(plan.ecartees[0].motif).toBe("projet « projet-999 » absent de la table PROJETS");
  });

  it("écarte des montants incohérents", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, ttc: 352801 }] }));
    expect(plan.ecartees[0].motif).toBe("HT + TVA ne fait pas le TTC");
  });

  it("écarte un identifiant qui ne suit pas type-numéro", () => {
    const plan = planifierImport(entree({ manifeste: [{ ...solde, id: "facture-24624" }] }));
    expect(plan.ecartees[0].motif).toBe("identifiant « facture-24624 » différent de « facture-024624 »");
  });

  it("annonce une pièce inchangée et n'en renvoie pas le PDF", () => {
    const plan = planifierImport(entree({ existantes: [enBase()] }));
    expect(plan.inchangees).toEqual(["facture-024624"]);
    expect(plan.modifiees).toEqual([]);
    expect(plan.pdfs).toEqual({});
  });

  it("ne repasse jamais une facture réglée en à régler, et garde la date posée dans l'admin", () => {
    const plan = planifierImport(entree({ existantes: [enBase({ statut: "reglee", reglee_le: "2026-09-30" })] }));
    expect(plan.inchangees).toEqual(["facture-024624"]);
  });

  it("garde le projet rattaché dans l'admin", () => {
    const plan = planifierImport(
      entree({ manifeste: [{ ...solde, projet: "refonte-432" }], existantes: [enBase({ projet: "boutique-shopify-390" })] }),
    );
    expect(plan.inchangees).toEqual(["facture-024624"]);
  });

  it("passe une facture à régler en réglée avec la date du manifeste", () => {
    const plan = planifierImport(
      entree({ manifeste: [{ ...solde, statut: "reglee", reglee_le: "2026-10-05" }], existantes: [enBase()] }),
    );
    expect(plan.modifiees).toEqual([
      { piece: expect.objectContaining({ statut: "reglee", reglee_le: "2026-10-05" }), champs: ["statut", "reglee_le"] },
    ]);
  });
});

describe("règles unitaires", () => {
  it("statutFinal ne descend jamais vers a_regler", () => {
    expect(statutFinal("reglee", "a_regler")).toBe("reglee");
    expect(statutFinal("annulee", "a_regler")).toBe("annulee");
    expect(statutFinal("a_regler", "reglee")).toBe("reglee");
    expect(statutFinal(null, "a_regler")).toBe("a_regler");
    expect(statutFinal(null, null)).toBeNull();
  });

  it("normaliserRaison met en capitales et resserre les espaces", () => {
    expect(normaliserRaison(" 3bnbw  -  Oïde ")).toBe("3BNBW - OÏDE");
  });

  it("pdfDeLaPiece trouve le PDF par type et numéro", () => {
    const pdfs = ["Devis_004330_Coolbeans_X.pdf", "Facture_024617_Coolbeans_X.pdf"];
    expect(pdfDeLaPiece("devis", "004330", pdfs)).toBe("Devis_004330_Coolbeans_X.pdf");
    expect(pdfDeLaPiece("facture", "004330", pdfs)).toBeUndefined();
  });

  it("sqlEcriture double les apostrophes et laisse le projet en place à la mise à jour", () => {
    const sql = sqlEcriture([enBase({ raison_sociale: "L'ATELIER" })]);
    expect(sql).toContain("'L''ATELIER'");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(sql).not.toMatch(/projet = excluded\.projet/);
  });
});
```

- [ ] **Step 3 : lancer les tests, constater l'échec**

Run : `npx vitest run src/lib/pieces/plan-import.test.ts`
Expected : FAIL, `Cannot find module './plan-import'`.

- [ ] **Step 4 : écrire le planificateur**

```ts
// src/lib/pieces/plan-import.ts
/* Le cœur de l'import des pièces Tiime (spec 2026-10-02, §2) : à partir du
   manifeste, des fiches, des PDF et des lignes déjà en base, décide quoi
   écrire. Aucun import à l'exécution : scripts/importer-pieces.mts l'importe
   sous `node --experimental-strip-types`, qui ne résout pas les imports sans
   extension. Les imports de type, eux, disparaissent. */
import type { CategoriePiece, Piece, StatutPiece, TypePiece } from "./piece";

export interface PieceManifeste {
  id: string;
  type: TypePiece;
  numero: string;
  categorie?: CategoriePiece | null;
  emise_le: string;
  echeance?: string | null;
  ht: number;
  tva: number;
  ttc: number;
  statut?: StatutPiece | null;
  reglee_le?: string | null;
  client?: string;
  organisation?: string;
  projet?: string | null;
  /** Identifiant court Linear, pour mémoire. L'import ne s'en sert pas. */
  linear?: string | null;
  raison_sociale: string;
  note?: string;
}

export interface Fiche {
  slug: string;
  genre: "client" | "organisation";
  raisonsSociales: string[];
}

export interface EntreeImport {
  manifeste: PieceManifeste[];
  fiches: Fiche[];
  /** Noms des fichiers du dossier de PDF. */
  pdfs: string[];
  existantes: Piece[];
  /** Slugs de la table PROJETS. */
  projetsConnus: readonly string[];
}

export interface PlanImport {
  nouvelles: Piece[];
  modifiees: { piece: Piece; champs: (keyof Piece)[] }[];
  inchangees: string[];
  ecartees: { id: string; motif: string }[];
  /** Nom du fichier PDF de chaque pièce à écrire, par id. */
  pdfs: Record<string, string>;
}

/** Les colonnes que l'import écrit et compare. `projet` n'y est pas : il ne
    se pose qu'à la création. */
const CHAMPS_SUIVIS: (keyof Piece)[] = [
  "type",
  "numero",
  "categorie",
  "emise_le",
  "echeance",
  "ht",
  "tva",
  "ttc",
  "statut",
  "reglee_le",
  "client",
  "organisation",
  "raison_sociale",
  "r2_key",
];

export const normaliserRaison = (texte: string): string =>
  texte.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");

export const cleR2 = (id: string, dossier: string): string => `pieces/${dossier}/${id}.pdf`;

const PREFIXE_PDF: Record<TypePiece, string> = { devis: "Devis", facture: "Facture", avoir: "Avoir" };

export function pdfDeLaPiece(type: TypePiece, numero: string, pdfs: readonly string[]): string | undefined {
  const motif = new RegExp(`^${PREFIXE_PDF[type]}_${numero}_.*\\.pdf$`, "i");
  return pdfs.find((nom) => motif.test(nom));
}

/** Un réimport ne repasse jamais en « à régler » une facture réglée ou
    annulée (spec §1.4). Dans tous les autres cas, l'export Tiime fait foi. */
export function statutFinal(existant: StatutPiece | null, importe: StatutPiece | null): StatutPiece | null {
  if (importe === "a_regler" && existant !== null && existant !== "a_regler") return existant;
  return importe;
}

function motifDEcart(p: PieceManifeste, e: EntreeImport): string | null {
  if (p.id !== `${p.type}-${p.numero}`) return `identifiant « ${p.id} » différent de « ${p.type}-${p.numero} »`;
  if (Boolean(p.client) === Boolean(p.organisation)) return "il faut un client ou une organisation, pas les deux";
  if (![p.ht, p.tva, p.ttc].every(Number.isInteger)) return "montants en centimes entiers attendus";
  if (p.ht + p.tva !== p.ttc) return "HT + TVA ne fait pas le TTC";
  const genre = p.client ? "client" : "organisation";
  const slug = (p.client ?? p.organisation) as string;
  const fiche = e.fiches.find((f) => f.genre === genre && f.slug === slug);
  if (!fiche) return `fiche ${genre === "client" ? "clients" : "organisations"}/${slug} introuvable`;
  if (!fiche.raisonsSociales.map(normaliserRaison).includes(normaliserRaison(p.raison_sociale))) {
    return `« ${p.raison_sociale.trim()} » absente des raisonsSociales de ${slug}`;
  }
  if (p.projet && !e.projetsConnus.includes(p.projet)) return `projet « ${p.projet} » absent de la table PROJETS`;
  if (!pdfDeLaPiece(p.type, p.numero, e.pdfs)) return `aucun PDF pour ${p.type} ${p.numero}`;
  return null;
}

export function planifierImport(e: EntreeImport): PlanImport {
  const plan: PlanImport = { nouvelles: [], modifiees: [], inchangees: [], ecartees: [], pdfs: {} };
  const parId = new Map(e.existantes.map((x) => [x.id, x]));
  for (const p of [...e.manifeste].sort((a, b) => a.id.localeCompare(b.id))) {
    const motif = motifDEcart(p, e);
    if (motif) {
      plan.ecartees.push({ id: p.id, motif });
      continue;
    }
    const existante = parId.get(p.id);
    const statut = statutFinal(existante?.statut ?? null, p.statut ?? null);
    const dossier = (p.client ?? p.organisation) as string;
    const finale: Piece = {
      id: p.id,
      type: p.type,
      numero: p.numero,
      categorie: p.categorie ?? null,
      emise_le: p.emise_le,
      echeance: p.echeance ?? null,
      ht: p.ht,
      tva: p.tva,
      ttc: p.ttc,
      statut,
      // La date posée dans l'admin gagne sur celle du manifeste.
      reglee_le: statut === "reglee" ? (existante?.reglee_le ?? p.reglee_le ?? null) : null,
      client: p.client ?? null,
      organisation: p.organisation ?? null,
      // L'import pose le projet à la création et n'y touche plus (spec §2).
      projet: existante ? existante.projet : (p.projet ?? null),
      raison_sociale: p.raison_sociale.trim(),
      r2_key: cleR2(p.id, dossier),
    };
    if (!existante) {
      plan.nouvelles.push(finale);
      plan.pdfs[p.id] = pdfDeLaPiece(p.type, p.numero, e.pdfs) as string;
      continue;
    }
    const champs = CHAMPS_SUIVIS.filter((c) => finale[c] !== existante[c]);
    if (champs.length === 0) {
      plan.inchangees.push(p.id);
    } else {
      plan.modifiees.push({ piece: finale, champs });
      plan.pdfs[p.id] = pdfDeLaPiece(p.type, p.numero, e.pdfs) as string;
    }
  }
  return plan;
}

const litteral = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error(`Nombre non entier : ${v}`);
    return String(v);
  }
  return `'${String(v).replace(/'/g, "''")}'`;
};

const COLONNES: (keyof Piece)[] = ["id", ...CHAMPS_SUIVIS, "projet"];

/** Insère ou met à jour. À la mise à jour, `projet` garde sa valeur en base :
    un rattachement fait dans l'admin entre le plan et l'écriture survit. */
export function sqlEcriture(pieces: readonly Piece[]): string {
  const maj = CHAMPS_SUIVIS.map((c) => `${c} = excluded.${c}`).join(", ");
  return pieces
    .map(
      (p) =>
        `INSERT INTO pieces (${COLONNES.join(", ")}) VALUES (${COLONNES.map((c) => litteral(p[c])).join(", ")})` +
        ` ON CONFLICT (id) DO UPDATE SET ${maj}, importee_le = datetime('now');`,
    )
    .join("\n");
}
```

- [ ] **Step 5 : lancer les tests, constater le succès**

Run : `npx vitest run src/lib/pieces/plan-import.test.ts`
Expected : PASS, 17 tests.

- [ ] **Step 6 : commit**

```bash
git add src/lib/pieces/piece.ts src/lib/pieces/plan-import.ts src/lib/pieces/plan-import.test.ts
git commit -m "feat(pieces): type Piece et planificateur d'import des pièces Tiime"
```

---

### Task 2 : la table `pieces` et ses lectures

**Files :**
- Create : `migrations/0014_pieces.sql`
- Create : `src/lib/pieces/store.ts`
- Test : `src/lib/pieces/store.sqlite.test.ts`

**Interfaces :**
- Consumes : `Piece` (tâche 1), `planifierImport`, `sqlEcriture` (tâche 1), `D1Like` (`src/lib/devis/reponses.ts`, type seul).
- Produces : `piecesDuProjet(d1, client: string, projet: string): Promise<Piece[]>`, `pieceParId(d1, id: string): Promise<Piece | null>`, `toutesLesPieces(d1): Promise<Piece[]>`, `rattacher(d1, id: string, projet: string | null): Promise<void>`, `marquerReglee(d1, id: string, date: string): Promise<void>`, `annulerReglement(d1, id: string): Promise<void>`.

- [ ] **Step 1 : vérifier que 0014 est libre**

Run : `git fetch -q origin && git ls-tree --name-only origin/staging migrations/ | tail -3`
Expected : la dernière migration est `migrations/0013_retire_documents.sql`. Sinon, prendre le numéro suivant ici et dans le reste du plan.

- [ ] **Step 2 : écrire la migration**

```sql
-- migrations/0014_pieces.sql
-- Registre des pièces comptables Tiime (devis, factures, avoirs) affichées
-- dans la page projet du portail (spec 2026-10-02-devis-et-factures-page-projet-design.md).
--
-- Tiime n'a pas d'API : les lignes arrivent par scripts/importer-pieces.mts,
-- depuis un manifeste rédigé à partir de l'export. Les PDF sont dans R2, sous
-- r2_key. L'admin rattache une pièce à un projet et note les règlements.

CREATE TABLE pieces (
  id             TEXT PRIMARY KEY,               -- 'facture-024624'
  type           TEXT NOT NULL CHECK (type IN ('devis', 'facture', 'avoir')),
  numero         TEXT NOT NULL,                  -- '024624', zéros compris
  categorie      TEXT CHECK (categorie IS NULL OR categorie IN ('acompte', 'intermediaire', 'solde')),
  emise_le       TEXT NOT NULL,                  -- YYYY-MM-DD
  echeance       TEXT,
  ht             INTEGER NOT NULL,               -- centimes, négatifs pour un avoir
  tva            INTEGER NOT NULL,
  ttc            INTEGER NOT NULL,
  statut         TEXT CHECK (statut IS NULL OR statut IN ('a_regler', 'reglee', 'annulee')),
  reglee_le      TEXT,
  client         TEXT,                           -- fiche client
  organisation   TEXT,                           -- fiche revendeur
  projet         TEXT,                           -- slug de la table PROJETS
  raison_sociale TEXT NOT NULL,
  r2_key         TEXT NOT NULL,
  importee_le    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((client IS NULL) <> (organisation IS NULL))
);

CREATE INDEX idx_pieces_client_projet ON pieces (client, projet);
```

- [ ] **Step 3 : écrire le test qui rejoue la migration et le vrai manifeste**

```ts
// src/lib/pieces/store.sqlite.test.ts
/* Rejoue la migration contre SQLite, à travers la même façade D1 que
   src/lib/documents/reponses.sqlite.test.ts, et y écrit le vrai manifeste du
   2026-10-02 par le SQL du planificateur : le SQL généré doit s'exécuter. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "../devis/reponses";
import { planifierImport, sqlEcriture, type Fiche, type PieceManifeste } from "./plan-import";
import { annulerReglement, marquerReglee, pieceParId, piecesDuProjet, rattacher, toutesLesPieces } from "./store";

const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8");
const manifeste = JSON.parse(lire("../../../scripts/pieces/tiime-2026-10-02.json")).pieces as PieceManifeste[];

function dbSqlite() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(lire("../../../migrations/0014_pieces.sql"));
  const requete = (sql: string, binds: unknown[] = []) => {
    const stmt = sqlite.prepare(sql);
    return {
      run: async () => stmt.run(...(binds as never[])),
      all: async <T>() => ({ results: stmt.all(...(binds as never[])) as T[] }),
    };
  };
  const d1: D1Like = {
    prepare: (sql: string) => ({ bind: (...binds: unknown[]) => requete(sql, binds), all: <T>() => requete(sql).all<T>() }),
  };
  return { d1, sqlite };
}

// Fiches et PDF tirés du manifeste lui-même : ce test vérifie le SQL et les
// lectures, pas la correspondance avec les fiches YAML (tâche 4).
const fiches: Fiche[] = [...new Map(manifeste.map((p) => [`${p.client ?? p.organisation}`, p])).values()].map((p) => ({
  slug: (p.client ?? p.organisation) as string,
  genre: p.client ? "client" : "organisation",
  raisonsSociales: [p.raison_sociale],
}));
const pdfs = manifeste.map((p) => `${p.type === "devis" ? "Devis" : "Facture"}_${p.numero}_Coolbeans.pdf`);
const projetsConnus = manifeste.flatMap((p) => (p.projet ? [p.projet] : []));

describe("table pieces (D1)", () => {
  let d1: D1Like;
  let sqlite: DatabaseSync;
  beforeEach(() => {
    ({ d1, sqlite } = dbSqlite());
    const plan = planifierImport({ manifeste, fiches, pdfs, existantes: [], projetsConnus });
    expect(plan.ecartees).toEqual([]);
    sqlite.exec(sqlEcriture(plan.nouvelles));
  });

  it("reçoit les 23 pièces du premier import", async () => {
    expect(await toutesLesPieces(d1)).toHaveLength(23);
  });

  it("lit les pièces d'un projet, de la plus ancienne à la plus récente", async () => {
    const ids = (await piecesDuProjet(d1, "fylgo", "boutique-shopify-390")).map((p) => p.id);
    expect(ids).toEqual(["devis-004330", "facture-024617", "facture-024624"]);
  });

  it("ne sert jamais une pièce adressée à un revendeur dans un projet client", async () => {
    expect(await piecesDuProjet(d1, "amusoire", "refonte-432")).toEqual([]);
    expect((await pieceParId(d1, "facture-024622"))?.organisation).toBe("trigger");
  });

  it("laisse le doublon 24615 hors de tout projet", async () => {
    expect((await pieceParId(d1, "facture-024615"))?.projet).toBeNull();
  });

  it("refuse une ligne sans client ni organisation", () => {
    expect(() =>
      sqlite.exec(
        "INSERT INTO pieces (id, type, numero, emise_le, ht, tva, ttc, raison_sociale, r2_key) VALUES ('devis-1', 'devis', '1', '2026-01-01', 1, 0, 1, 'X', 'k')",
      ),
    ).toThrow();
  });

  it("accepte un avoir aux montants négatifs", () => {
    expect(() =>
      sqlite.exec(
        "INSERT INTO pieces (id, type, numero, emise_le, ht, tva, ttc, client, raison_sociale, r2_key) VALUES ('avoir-000001', 'avoir', '000001', '2026-01-01', -100, -20, -120, 'fylgo', 'ABEAM DRINKS', 'k')",
      ),
    ).not.toThrow();
  });

  it("rattache, marque réglée puis annule le règlement", async () => {
    await rattacher(d1, "facture-024615", "accueil-mega-menu-246");
    await marquerReglee(d1, "facture-024624", "2026-10-05");
    let p = await pieceParId(d1, "facture-024624");
    expect(p).toMatchObject({ statut: "reglee", reglee_le: "2026-10-05" });
    await annulerReglement(d1, "facture-024624");
    p = await pieceParId(d1, "facture-024624");
    expect(p).toMatchObject({ statut: "a_regler", reglee_le: null });
    expect((await pieceParId(d1, "facture-024615"))?.projet).toBe("accueil-mega-menu-246");
  });

  it("ne marque jamais un devis comme réglé", async () => {
    await marquerReglee(d1, "devis-004330", "2026-10-05");
    expect((await pieceParId(d1, "devis-004330"))?.statut).toBeNull();
  });
});
```

- [ ] **Step 4 : lancer le test, constater l'échec**

Run : `npx vitest run src/lib/pieces/store.sqlite.test.ts`
Expected : FAIL, `Cannot find module './store'`.

- [ ] **Step 5 : écrire le module de lecture et d'écriture**

```ts
// src/lib/pieces/store.ts
/* Lectures et écritures de la table `pieces` (migration 0014). Le type D1Like
   permet de rejouer ces requêtes contre SQLite dans les tests. */
import type { D1Like } from "../devis/reponses";
import type { Piece } from "./piece";

const COLONNES =
  "id, type, numero, categorie, emise_le, echeance, ht, tva, ttc, statut, reglee_le, client, organisation, projet, raison_sociale, r2_key";

/** Les pièces d'un projet client, de la plus ancienne à la plus récente.
    Une pièce de revendeur n'a pas de client : elle n'en sort jamais. */
export async function piecesDuProjet(d1: D1Like, client: string, projet: string): Promise<Piece[]> {
  const { results } = await d1
    .prepare(`SELECT ${COLONNES} FROM pieces WHERE client = ? AND projet = ? ORDER BY emise_le, id`)
    .bind(client, projet)
    .all<Piece>();
  return results;
}

export async function pieceParId(d1: D1Like, id: string): Promise<Piece | null> {
  const { results } = await d1.prepare(`SELECT ${COLONNES} FROM pieces WHERE id = ?`).bind(id).all<Piece>();
  return results[0] ?? null;
}

export async function toutesLesPieces(d1: D1Like): Promise<Piece[]> {
  const { results } = await d1.prepare(`SELECT ${COLONNES} FROM pieces ORDER BY emise_le DESC, id DESC`).all<Piece>();
  return results;
}

export async function rattacher(d1: D1Like, id: string, projet: string | null): Promise<void> {
  await d1.prepare("UPDATE pieces SET projet = ? WHERE id = ?").bind(projet, id).run();
}

/** Seule une facture se règle. */
export async function marquerReglee(d1: D1Like, id: string, date: string): Promise<void> {
  await d1
    .prepare("UPDATE pieces SET statut = 'reglee', reglee_le = ? WHERE id = ? AND type = 'facture'")
    .bind(date, id)
    .run();
}

export async function annulerReglement(d1: D1Like, id: string): Promise<void> {
  await d1
    .prepare("UPDATE pieces SET statut = 'a_regler', reglee_le = NULL WHERE id = ? AND statut = 'reglee'")
    .bind(id)
    .run();
}
```

- [ ] **Step 6 : lancer le test, constater le succès**

Run : `npx vitest run src/lib/pieces/store.sqlite.test.ts`
Expected : PASS, 8 tests.

- [ ] **Step 7 : commit**

```bash
git add migrations/0014_pieces.sql src/lib/pieces/store.ts src/lib/pieces/store.sqlite.test.ts
git commit -m "feat(pieces): table D1 pieces et ses lectures"
```

---

### Task 3 : l'affichage d'une pièce

**Files :**
- Create : `src/lib/pieces/affichage.ts`
- Test : `src/lib/pieces/affichage.test.ts`

**Interfaces :**
- Consumes : `Piece` (tâche 1).
- Produces : `libellePiece(p: Pick<Piece, "type" | "categorie" | "numero">): string`, `statutPiece(p: Pick<Piece, "type" | "statut" | "reglee_le" | "echeance">): string | null`, `montantEuros(centimes: number): string`, `dateFr(iso: string): string`, `nomDuPdf(p): string`.

- [ ] **Step 1 : écrire les tests**

```ts
// src/lib/pieces/affichage.test.ts
import { describe, expect, it } from "vitest";
import { dateFr, libellePiece, montantEuros, nomDuPdf, statutPiece } from "./affichage";

const NB = " ";

describe("libellePiece", () => {
  it("nomme chaque type, numéro sans zéros de tête", () => {
    expect(libellePiece({ type: "devis", categorie: null, numero: "004330" })).toBe(`Devis n°${NB}4330`);
    expect(libellePiece({ type: "facture", categorie: "acompte", numero: "024617" })).toBe(`Facture d'acompte n°${NB}24617`);
    expect(libellePiece({ type: "facture", categorie: "intermediaire", numero: "024630" })).toBe(
      `Facture intermédiaire n°${NB}24630`,
    );
    expect(libellePiece({ type: "facture", categorie: "solde", numero: "024624" })).toBe(`Facture de solde n°${NB}24624`);
    expect(libellePiece({ type: "facture", categorie: null, numero: "024625" })).toBe(`Facture n°${NB}24625`);
    expect(libellePiece({ type: "avoir", categorie: null, numero: "000012" })).toBe(`Avoir n°${NB}12`);
  });
});

describe("statutPiece", () => {
  const facture = { type: "facture" as const, reglee_le: null, echeance: null };
  it("dit le règlement, avec ou sans date", () => {
    expect(statutPiece({ ...facture, statut: "reglee", reglee_le: "2026-04-12" })).toBe("Réglée le 12/04/2026");
    expect(statutPiece({ ...facture, statut: "reglee" })).toBe("Réglée");
  });
  it("dit l'échéance d'une facture à régler", () => {
    expect(statutPiece({ ...facture, statut: "a_regler", echeance: "2026-09-30" })).toBe("À régler, échéance le 30/09/2026");
    expect(statutPiece({ ...facture, statut: "a_regler" })).toBe("À régler");
  });
  it("dit l'annulation", () => {
    expect(statutPiece({ ...facture, statut: "annulee" })).toBe("Annulée");
  });
  it("ne dit rien pour un devis ni pour un avoir", () => {
    expect(statutPiece({ type: "devis", statut: null, reglee_le: null, echeance: null })).toBeNull();
    expect(statutPiece({ type: "avoir", statut: "reglee", reglee_le: null, echeance: null })).toBeNull();
  });
});

describe("montantEuros", () => {
  it("met une espace fine entre les milliers et une insécable avant l'euro", () => {
    expect(montantEuros(352800)).toBe("3 528,00 €");
    expect(montantEuros(90000)).toBe("900,00 €");
  });
  it("affiche un avoir négatif", () => {
    expect(montantEuros(-643333)).toBe("-6 433,33 €");
  });
});

describe("dateFr et nomDuPdf", () => {
  it("écrit la date en jj/mm/aaaa", () => {
    expect(dateFr("2026-08-24")).toBe("24/08/2026");
  });
  it("nomme le PDF téléchargé d'après le libellé", () => {
    expect(nomDuPdf({ type: "facture", categorie: "solde", numero: "024624" })).toBe("Facture de solde 24624.pdf");
  });
});
```

- [ ] **Step 2 : lancer les tests, constater l'échec**

Run : `npx vitest run src/lib/pieces/affichage.test.ts`
Expected : FAIL, `Cannot find module './affichage'`.

- [ ] **Step 3 : écrire le module**

```ts
// src/lib/pieces/affichage.ts
/* Ce que le client lit d'une pièce (spec 2026-10-02, §4) : libellé, statut,
   montant, date. Le numéro s'affiche comme sur le PDF, sans zéros de tête. */
import type { Piece } from "./piece";

const NB = " ";

const SUFFIXE: Record<string, string> = {
  acompte: " d'acompte",
  intermediaire: " intermédiaire",
  solde: " de solde",
};

const numeroImprime = (numero: string) => numero.replace(/^0+(?=\d)/, "");

export function libellePiece(p: Pick<Piece, "type" | "categorie" | "numero">): string {
  const numero = numeroImprime(p.numero);
  if (p.type === "devis") return `Devis n°${NB}${numero}`;
  if (p.type === "avoir") return `Avoir n°${NB}${numero}`;
  return `Facture${SUFFIXE[p.categorie ?? ""] ?? ""} n°${NB}${numero}`;
}

export function dateFr(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
}

export function statutPiece(p: Pick<Piece, "type" | "statut" | "reglee_le" | "echeance">): string | null {
  if (p.type !== "facture" || !p.statut) return null;
  if (p.statut === "annulee") return "Annulée";
  if (p.statut === "reglee") return p.reglee_le ? `Réglée le ${dateFr(p.reglee_le)}` : "Réglée";
  return p.echeance ? `À régler, échéance le ${dateFr(p.echeance)}` : "À régler";
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const montantEuros = (centimes: number): string => EUROS.format(centimes / 100);

/** Le nom du fichier téléchargé : « Facture de solde 24624.pdf ». */
export const nomDuPdf = (p: Pick<Piece, "type" | "categorie" | "numero">): string =>
  `${libellePiece(p).replace(`n°${NB}`, "")}.pdf`;
```

- [ ] **Step 4 : lancer les tests, constater le succès**

Run : `npx vitest run src/lib/pieces/affichage.test.ts`
Expected : PASS, 9 tests.

- [ ] **Step 5 : commit**

```bash
git add src/lib/pieces/affichage.ts src/lib/pieces/affichage.test.ts
git commit -m "feat(pieces): libellés, statuts et montants d'une pièce"
```

---

### Task 4 : les fiches, la nomenclature et la vérification des raisons sociales

**Files :**
- Create : `src/lib/pieces/raisons-sociales.ts`
- Test : `src/lib/pieces/raisons-sociales.test.ts`
- Modify : `src/content.config.ts` (collections `clients` et `organisations`)
- Modify : `src/lib/documents/charger.ts`
- Modify : `src/lib/documents/nomenclature.ts` (`CLIENTS`, `PROJETS`)
- Modify : fiches `src/content/clients/{amusoire,cafa,dupontdupont,fylgo,littlebox,merciyanis,oide,unlockbreath}.yaml`, `src/content/organisations/trigger.yaml`

**Interfaces :**
- Consumes : `normaliserRaison` (tâche 1).
- Produces : `verifierRaisonsSociales(fiches: readonly { chemin: string; raisonsSociales: readonly string[] }[]): string[]`. Champ `raisonsSociales: string[]` (défaut `[]`) sur les deux collections. Clés `dup`, `mer`, `tri` dans `CLIENTS`. Projets `gravure-432`, `accueil-mega-menu-246`, `landing-pages-246` dans `PROJETS`.

- [ ] **Step 1 : écrire le test de la vérification**

```ts
// src/lib/pieces/raisons-sociales.test.ts
import { describe, expect, it } from "vitest";
import { verifierRaisonsSociales } from "./raisons-sociales";

describe("verifierRaisonsSociales", () => {
  it("accepte des raisons sociales distinctes", () => {
    expect(
      verifierRaisonsSociales([
        { chemin: "clients/fylgo", raisonsSociales: ["ABEAM DRINKS"] },
        { chemin: "organisations/trigger", raisonsSociales: ["TRIGGER"] },
      ]),
    ).toEqual([]);
  });

  it("refuse une raison sociale portée par deux fiches, casse et espaces compris", () => {
    expect(
      verifierRaisonsSociales([
        { chemin: "clients/fylgo", raisonsSociales: ["ABEAM DRINKS"] },
        { chemin: "organisations/trigger", raisonsSociales: ["abeam  drinks"] },
      ]),
    ).toEqual(["raison sociale « ABEAM DRINKS » portée par deux fiches (clients/fylgo, organisations/trigger)"]);
  });
});
```

- [ ] **Step 2 : lancer le test, constater l'échec**

Run : `npx vitest run src/lib/pieces/raisons-sociales.test.ts`
Expected : FAIL, `Cannot find module './raisons-sociales'`.

- [ ] **Step 3 : écrire la vérification**

```ts
// src/lib/pieces/raisons-sociales.ts
/* Une raison sociale désigne une seule fiche, client ou revendeur (spec
   2026-10-02, §1.2). Appelée au build par src/lib/documents/charger.ts. */
import { normaliserRaison } from "./plan-import";

export function verifierRaisonsSociales(
  fiches: readonly { chemin: string; raisonsSociales: readonly string[] }[],
): string[] {
  const erreurs: string[] = [];
  const vues = new Map<string, string>();
  for (const f of fiches) {
    for (const r of f.raisonsSociales) {
      const cle = normaliserRaison(r);
      const deja = vues.get(cle);
      if (deja && deja !== f.chemin) erreurs.push(`raison sociale « ${cle} » portée par deux fiches (${deja}, ${f.chemin})`);
      else vues.set(cle, f.chemin);
    }
  }
  return erreurs;
}
```

- [ ] **Step 4 : lancer le test, constater le succès**

Run : `npx vitest run src/lib/pieces/raisons-sociales.test.ts`
Expected : PASS, 2 tests.

- [ ] **Step 5 : ajouter le champ aux deux collections**

Dans `src/content.config.ts`, collection `clients`, juste après `cle: z.string().regex(/^[a-z]{3}$/).optional(),` :

```ts
    /* Noms sous lesquels Tiime facture ce client (spec 2026-10-02, devis et
       factures, §1.2). L'import des pièces s'en sert pour vérifier qu'une
       pièce arrive dans la bonne fiche. Une raison sociale ne désigne qu'une
       fiche : charger.ts le vérifie au build. */
    raisonsSociales: z.array(z.string()).default([]),
```

Collection `organisations`, remplacer le schéma :

```ts
  schema: z.object({
    nom: z.string(),
    /* Noms sous lesquels Tiime facture ce revendeur (spec 2026-10-02, devis
       et factures, §1.2). */
    raisonsSociales: z.array(z.string()).default([]),
  }),
```

- [ ] **Step 6 : brancher la vérification au build**

Dans `src/lib/documents/charger.ts`, ajouter l'import :

```ts
import { verifierRaisonsSociales } from "../pieces/raisons-sociales";
```

et remplacer les deux lignes `const clients = …` et `const erreurs = …` par :

```ts
  const fichesClients = await getCollection("clients");
  const clients = fichesClients.map((e) => ({ slug: e.id, cle: e.data.cle }));
  const raisons = [
    ...fichesClients.map((e) => ({ chemin: `clients/${e.id}`, raisonsSociales: e.data.raisonsSociales })),
    ...(await getCollection("organisations")).map((e) => ({
      chemin: `organisations/${e.id}`,
      raisonsSociales: e.data.raisonsSociales,
    })),
  ];
  const erreurs = [
    ...verifierNomenclature(documents),
    ...verifierCles(clients),
    ...verifierLiensLinear(),
    ...verifierRaisonsSociales(raisons),
  ];
```

Mettre à jour le commentaire d'en-tête du fichier : « Il vérifie aussi les clés des fiches client, qui relient un workspace à ses documents, et l'unicité des raisons sociales, qui relient une pièce Tiime à sa fiche. »

- [ ] **Step 7 : compléter la nomenclature**

Dans `src/lib/documents/nomenclature.ts`, ajouter à `CLIENTS` (ordre alphabétique des clés) :

```ts
  dup: "DupontDupont",
  mer: "MerciYanis",
  tri: "Trigger",
```

et à `PROJETS` :

```ts
  "gravure-432": { client: "dup", linear: "07f5b96c0310" },
  "accueil-mega-menu-246": { client: "mer", linear: "a76c5a381d75" },
  "landing-pages-246": { client: "tri", linear: "b274199a0f82" },
```

Ajouter sous la constante `PROJETS` un commentaire d'une ligne : « Les trois derniers projets portent des pièces Tiime et aucun document (spec 2026-10-02, devis et factures, §12). » Ne pas toucher `refonte-432`.

- [ ] **Step 8 : compléter les fiches**

Ajouter une ligne `raisonsSociales` à chaque fiche, après `cle` quand elle existe, sinon après `organisation` :

| Fiche | Ligne à ajouter |
|---|---|
| `src/content/clients/amusoire.yaml` | `raisonsSociales: [AMUSOIRE]` |
| `src/content/clients/cafa.yaml` | `raisonsSociales: [CLUB AFFAIRES FRANCO-ALLEMAND TOULOUSE MIDI-PYRENEES]` |
| `src/content/clients/dupontdupont.yaml` | `raisonsSociales: [DUPONTDUPONT]` |
| `src/content/clients/fylgo.yaml` | `raisonsSociales: [ABEAM DRINKS]` |
| `src/content/clients/littlebox.yaml` | `raisonsSociales: [LITTLE BOX]` |
| `src/content/clients/merciyanis.yaml` | `raisonsSociales: [MERCIYANIS]` |
| `src/content/clients/oide.yaml` | `raisonsSociales: ["3BNBW - OÏDE"]` |
| `src/content/clients/unlockbreath.yaml` | `raisonsSociales: [DOS ET POSTURE]` |
| `src/content/organisations/trigger.yaml` | `raisonsSociales: [TRIGGER]` |

Dans `dupontdupont.yaml`, ajouter aussi, avec leurs commentaires :

```yaml
# Clé de la nomenclature des documents : la clé de la team Linear DUP.
cle: dup
# Team « DupontDupont » (DUP), créée le 2026-10-02 sous Web.
linearTeamId: 43af2a28-f9b5-457a-af0d-d730551ef568
```

et remplacer la ligne de commentaire placée juste au-dessus de `messagerie: false` (elle annonce l'absence de team Linear) par `# Messagerie coupée en attendant que Ludo l'ouvre (COO-30).`, en gardant `messagerie: false`.

Dans `merciyanis.yaml`, même chose avec :

```yaml
# Clé de la nomenclature des documents : la clé de la team Linear MER.
cle: mer
# Team « MerciYanis » (MER), créée le 2026-09-25 sous Web.
linearTeamId: d4a0264c-fbd7-42dd-b290-df35780d8db3
```

- [ ] **Step 9 : vérifier le build et les tests**

Run : `npx vitest run && npm run build`
Expected : tous les tests passent ; le build se termine sans « Nomenclature des documents client incohérente ».

- [ ] **Step 10 : commit**

```bash
git add src/lib/pieces/raisons-sociales.ts src/lib/pieces/raisons-sociales.test.ts src/content.config.ts \
  src/lib/documents/charger.ts src/lib/documents/nomenclature.ts \
  src/content/clients/amusoire.yaml src/content/clients/cafa.yaml src/content/clients/dupontdupont.yaml \
  src/content/clients/fylgo.yaml src/content/clients/littlebox.yaml src/content/clients/merciyanis.yaml \
  src/content/clients/oide.yaml src/content/clients/unlockbreath.yaml src/content/organisations/trigger.yaml
git commit -m "feat(pieces): raisons sociales des fiches, clés et projets DUP, MER, TRI"
```

---

### Task 5 : le script d'import et le premier import local

**Files :**
- Create : `scripts/importer-pieces.mts`

**Interfaces :**
- Consumes : `planifierImport`, `sqlEcriture`, types `Fiche`, `PieceManifeste` (tâche 1) ; `Piece` (tâche 1) ; `PROJETS` (`src/lib/documents/nomenclature.ts`).
- Produces : la commande `node --experimental-strip-types scripts/importer-pieces.mts <manifeste.json> --pdf <dossier> [--env local|staging|production] [--appliquer]`.

- [ ] **Step 1 : écrire le script**

```ts
// scripts/importer-pieces.mts
/* ============================================================================
   COOLBEANS : import des pièces comptables Tiime dans le portail.

   Spec : docs/superpowers/specs/2026-10-02-devis-et-factures-page-projet-design.md §2.

   Usage :
     node --experimental-strip-types scripts/importer-pieces.mts \
       scripts/pieces/tiime-2026-10-02.json --pdf ~/Downloads [--env staging] [--appliquer]

   Sans --appliquer, rien n'est écrit : le script affiche les pièces
   nouvelles, modifiées, inchangées et écartées. Avec --appliquer, il envoie
   les PDF dans R2 puis écrit les lignes dans D1.
   --env vaut local par défaut. production ne se lance que sur ordre de Ludo.
   ========================================================================== */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJETS } from "../src/lib/documents/nomenclature.ts";
import { planifierImport, sqlEcriture, type Fiche, type PieceManifeste } from "../src/lib/pieces/plan-import.ts";
import type { Piece } from "../src/lib/pieces/piece.ts";

const CIBLES = {
  local: { d1: ["coolbeans-portal", "--local"], r2: ["coolbeans-portal-fichiers", "--local"] },
  staging: {
    d1: ["coolbeans-portal-staging", "--env", "staging", "--remote"],
    r2: ["coolbeans-portal-fichiers-staging", "--remote"],
  },
  production: { d1: ["coolbeans-portal", "--remote"], r2: ["coolbeans-portal-fichiers", "--remote"] },
} as const;

function echouer(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const valeur = (nom: string) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const manifesteChemin = args[0];
const dossierPdf = valeur("--pdf");
const env = (valeur("--env") ?? "local") as keyof typeof CIBLES;
const appliquer = args.includes("--appliquer");
if (!manifesteChemin || manifesteChemin.startsWith("--")) echouer("Premier argument attendu : le manifeste JSON.");
if (!dossierPdf) echouer("--pdf <dossier> est requis.");
if (!CIBLES[env]) echouer(`--env inconnu : ${env}. Valeurs possibles : local, staging, production.`);
const cible = CIBLES[env];

const wrangler = (args: string[]) =>
  execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/* --- Fiches : seule la ligne `raisonsSociales: [A, B]` nous intéresse. --- */
function lireFiches(dossier: string, genre: Fiche["genre"]): Fiche[] {
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".yaml") && !f.startsWith("_"))
    .map((f) => {
      const ligne = readFileSync(join(dossier, f), "utf8").match(/^raisonsSociales:\s*\[(.*)\]\s*$/m);
      const raisonsSociales = ligne
        ? ligne[1].split(",").map((r) => r.trim().replace(/^["'](.*)["']$/, "$1")).filter(Boolean)
        : [];
      return { slug: f.replace(/\.yaml$/, ""), genre, raisonsSociales };
    });
}

const fiches = [
  ...lireFiches("src/content/clients", "client"),
  ...lireFiches("src/content/organisations", "organisation"),
];
const manifeste = (JSON.parse(readFileSync(manifesteChemin, "utf8")) as { pieces: PieceManifeste[] }).pieces;
const pdfs = readdirSync(dossierPdf).filter((f) => f.toLowerCase().endsWith(".pdf"));

/* --- Lignes déjà en base. --- */
let existantes: Piece[];
try {
  const sortie = wrangler(["d1", "execute", ...cible.d1, "--json", "--command", "SELECT * FROM pieces"]);
  existantes = (JSON.parse(sortie) as { results: Piece[] }[])[0].results;
} catch (err) {
  echouer(`Lecture de la table pieces impossible (${env}). Migration 0014 appliquée ?\n${String(err)}`);
}

const plan = planifierImport({ manifeste, fiches, pdfs, existantes, projetsConnus: Object.keys(PROJETS) });

console.log(`Cible : ${env}`);
console.log(`\nNouvelles (${plan.nouvelles.length})`);
for (const p of plan.nouvelles) console.log(`  + ${p.id}  ${p.client ?? p.organisation}  ${p.projet ?? "sans projet"}`);
console.log(`\nModifiées (${plan.modifiees.length})`);
for (const m of plan.modifiees) console.log(`  ~ ${m.piece.id}  ${m.champs.join(", ")}`);
console.log(`\nInchangées (${plan.inchangees.length})`);
console.log(`\nÉcartées (${plan.ecartees.length})`);
for (const x of plan.ecartees) console.log(`  ✗ ${x.id}  ${x.motif}`);

if (!appliquer) {
  console.log("\nRien n'est écrit. Relancer avec --appliquer pour envoyer les PDF et écrire en base.");
  process.exit(0);
}

const aEcrire = [...plan.nouvelles, ...plan.modifiees.map((m) => m.piece)];
if (aEcrire.length === 0) {
  console.log("\nRien à écrire.");
  process.exit(0);
}

for (const p of aEcrire) {
  const [bucket, ...drapeaux] = cible.r2;
  wrangler([
    "r2", "object", "put", `${bucket}/${p.r2_key}`,
    "--file", join(dossierPdf, plan.pdfs[p.id]),
    "--content-type", "application/pdf",
    ...drapeaux,
  ]);
  console.log(`  ↑ ${p.r2_key}`);
}

const fichier = join(mkdtempSync(join(tmpdir(), "pieces-")), "ecriture.sql");
writeFileSync(fichier, sqlEcriture(aEcrire));
wrangler(["d1", "execute", ...cible.d1, "--file", fichier]);

const total = (JSON.parse(wrangler(["d1", "execute", ...cible.d1, "--json", "--command", "SELECT COUNT(*) AS n FROM pieces"])) as {
  results: { n: number }[];
}[])[0].results[0].n;
console.log(`\n✓ ${aEcrire.length} pièce(s) écrite(s). La table en compte ${total}.`);
```

- [ ] **Step 2 : appliquer la migration en local**

Run : `npx wrangler d1 migrations apply coolbeans-portal --local`
Expected : `0014_pieces.sql` appliquée, sans erreur.

- [ ] **Step 3 : lancer l'import sans écriture**

Run : `node --experimental-strip-types scripts/importer-pieces.mts scripts/pieces/tiime-2026-10-02.json --pdf ~/Downloads`
Expected : `Nouvelles (23)`, `Écartées (0)`, puis « Rien n'est écrit ». La ligne de `facture-024615` affiche « sans projet ». Si une pièce est écartée, corriger la fiche ou le manifeste, jamais le planificateur.

- [ ] **Step 4 : importer en local**

Run : `node --experimental-strip-types scripts/importer-pieces.mts scripts/pieces/tiime-2026-10-02.json --pdf ~/Downloads --appliquer`
Expected : 23 lignes `↑ pieces/…`, puis `✓ 23 pièce(s) écrite(s). La table en compte 23.`

- [ ] **Step 5 : vérifier l'idempotence**

Run : `node --experimental-strip-types scripts/importer-pieces.mts scripts/pieces/tiime-2026-10-02.json --pdf ~/Downloads --appliquer`
Expected : `Inchangées (23)`, puis « Rien à écrire. »

- [ ] **Step 6 : commit**

```bash
git add scripts/importer-pieces.mts
git commit -m "feat(pieces): script d'import des pièces Tiime vers D1 et R2"
```

---

### Task 6 : les routes des PDF

**Files :**
- Create : `src/lib/pieces/acces.ts`
- Test : `src/lib/pieces/acces.test.ts`
- Create : `src/lib/pieces/reponse-pdf.ts`
- Create : `src/pages/api/pieces/[id].ts`
- Create : `src/pages/api/admin/finances/pieces/[id].ts`

**Interfaces :**
- Consumes : `Piece`, `pieceParId` (tâches 1 et 2), `nomDuPdf` (tâche 3), `getPortalContext` (`src/lib/portail/context.ts`), `listWorkspaces` (`src/lib/portail/workspaces.ts`), `workspacesVisibles` (`src/lib/portail/appartenances.ts`), `db` (`src/lib/devis/reponses.ts`).
- Produces : `pieceLisibleParClient(piece: Piece | null, clientCourant: string | null, portee: readonly string[]): boolean`, `reponsePdf(objet: { body: ReadableStream }, piece: Piece): Response`. Routes `GET /api/pieces/<id>` (client) et `GET /api/admin/finances/pieces/<id>` (admin, gardée par le préfixe `/api/admin`).

- [ ] **Step 1 : écrire le test de la règle d'accès**

```ts
// src/lib/pieces/acces.test.ts
import { describe, expect, it } from "vitest";
import type { Piece } from "./piece";
import { pieceLisibleParClient } from "./acces";

const piece = (over: Partial<Piece> = {}): Piece => ({
  id: "facture-024624",
  type: "facture",
  numero: "024624",
  categorie: "solde",
  emise_le: "2026-08-24",
  echeance: "2026-08-24",
  ht: 294000,
  tva: 58800,
  ttc: 352800,
  statut: "a_regler",
  reglee_le: null,
  client: "fylgo",
  organisation: null,
  projet: "boutique-shopify-390",
  raison_sociale: "ABEAM DRINKS",
  r2_key: "pieces/fylgo/facture-024624.pdf",
  ...over,
});

describe("pieceLisibleParClient", () => {
  it("ouvre la pièce rattachée du workspace courant", () => {
    expect(pieceLisibleParClient(piece(), "fylgo", ["fylgo"])).toBe(true);
  });
  it("refuse la pièce d'un autre client", () => {
    expect(pieceLisibleParClient(piece(), "oide", ["oide", "fylgo"])).toBe(false);
  });
  it("refuse un workspace hors de la portée du compte", () => {
    expect(pieceLisibleParClient(piece(), "fylgo", ["oide"])).toBe(false);
  });
  it("refuse une pièce sans projet", () => {
    expect(pieceLisibleParClient(piece({ projet: null }), "fylgo", ["fylgo"])).toBe(false);
  });
  it("refuse une pièce de revendeur", () => {
    expect(pieceLisibleParClient(piece({ client: null, organisation: "trigger" }), "trigger", ["trigger"])).toBe(false);
  });
  it("refuse une pièce inconnue ou sans workspace courant", () => {
    expect(pieceLisibleParClient(null, "fylgo", ["fylgo"])).toBe(false);
    expect(pieceLisibleParClient(piece(), null, ["fylgo"])).toBe(false);
  });
});
```

- [ ] **Step 2 : lancer le test, constater l'échec**

Run : `npx vitest run src/lib/pieces/acces.test.ts`
Expected : FAIL, `Cannot find module './acces'`.

- [ ] **Step 3 : écrire la règle et la réponse PDF**

```ts
// src/lib/pieces/acces.ts
/* Qui lit le PDF d'une pièce (spec 2026-10-02, §5) : le client courant, pour
   une pièce de son workspace rattachée à un projet. Une pièce de revendeur
   n'a pas de client : elle ne s'ouvre que par la route admin. */
import type { Piece } from "./piece";

export function pieceLisibleParClient(
  piece: Piece | null,
  clientCourant: string | null,
  portee: readonly string[],
): boolean {
  return Boolean(
    piece && clientCourant && piece.client === clientCourant && piece.projet && portee.includes(clientCourant),
  );
}
```

```ts
// src/lib/pieces/reponse-pdf.ts
/* Le PDF d'une pièce, servi tel quel : type forcé, jamais deviné par le
   navigateur, jamais en cache partagé. */
import { nomDuPdf } from "./affichage";
import type { Piece } from "./piece";

export function reponsePdf(objet: { body: ReadableStream }, piece: Piece): Response {
  return new Response(objet.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(nomDuPdf(piece))}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
```

- [ ] **Step 4 : lancer le test, constater le succès**

Run : `npx vitest run src/lib/pieces/acces.test.ts`
Expected : PASS, 6 tests.

- [ ] **Step 5 : écrire la route client**

```ts
// src/pages/api/pieces/[id].ts
/* Le PDF d'une pièce pour le client (spec 2026-10-02, §5). Tout refus répond
   404, comme une pièce inconnue : la route ne dit jamais qu'une pièce existe. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { db } from "../../../lib/devis/reponses";
import { pieceLisibleParClient } from "../../../lib/pieces/acces";
import { reponsePdf } from "../../../lib/pieces/reponse-pdf";
import { pieceParId } from "../../../lib/pieces/store";
import { workspacesVisibles } from "../../../lib/portail/appartenances";
import { getPortalContext } from "../../../lib/portail/context";
import { listWorkspaces } from "../../../lib/portail/workspaces";

export const prerender = false;

const introuvable = () => new Response("Introuvable", { status: 404 });

export const GET: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user) return introuvable();
  const piece = await pieceParId(db(), context.params.id ?? "");
  const portee = workspacesVisibles(await listWorkspaces(), meta).map((w) => w.slug);
  if (!piece || !pieceLisibleParClient(piece, client?.slug ?? null, portee)) return introuvable();
  const objet = await env.PORTAL_FILES.get(piece.r2_key);
  if (!objet) return introuvable();
  return reponsePdf(objet, piece);
};
```

- [ ] **Step 6 : écrire la route admin**

```ts
// src/pages/api/admin/finances/pieces/[id].ts
/* Le PDF de n'importe quelle pièce, pour l'admin : pièces de revendeur et
   pièces sans projet comprises. Sous /api/admin/, donc gardée par le
   middleware (src/lib/portail/garde-admin.ts) : rien à vérifier ici. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { db } from "../../../../../lib/devis/reponses";
import { reponsePdf } from "../../../../../lib/pieces/reponse-pdf";
import { pieceParId } from "../../../../../lib/pieces/store";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const piece = await pieceParId(db(), context.params.id ?? "");
  const objet = piece ? await env.PORTAL_FILES.get(piece.r2_key) : null;
  if (!piece || !objet) return new Response("Introuvable", { status: 404 });
  return reponsePdf(objet, piece);
};
```

- [ ] **Step 7 : vérifier le build**

Run : `npx vitest run && npm run build`
Expected : PASS et build sans erreur.

- [ ] **Step 8 : commit**

```bash
git add src/lib/pieces/acces.ts src/lib/pieces/acces.test.ts src/lib/pieces/reponse-pdf.ts \
  "src/pages/api/pieces/[id].ts" "src/pages/api/admin/finances/pieces/[id].ts"
git commit -m "feat(pieces): routes des PDF, côté client et côté admin"
```

---

### Task 7 : le bloc « Devis et factures » de la page projet

**Files :**
- Create : `src/components/portail/projet/PiecesProjet.astro`
- Modify : `src/pages/espace/projets/[projet].astro`

**Interfaces :**
- Consumes : `Piece` (tâche 1), `piecesDuProjet` (tâche 2), `libellePiece`, `statutPiece`, `montantEuros`, `dateFr` (tâche 3), route `GET /api/pieces/<id>` (tâche 6).
- Produces : le composant `<PiecesProjet pieces={Piece[]} />`.

- [ ] **Step 1 : écrire le composant**

```astro
---
/* Le bloc « Devis et factures » d'une page projet (spec 2026-10-02, §4) :
   entre Avancement et les onglets d'étape, à la même largeur. Une ligne par
   pièce, de la plus ancienne à la plus récente. Sans pièce, pas de bloc. */
import type { Piece } from "../../../lib/pieces/piece";
import { dateFr, libellePiece, montantEuros, statutPiece } from "../../../lib/pieces/affichage";

interface Props {
  pieces: Piece[];
}

const { pieces } = Astro.props;
const PASTILLE: Record<string, string> = {
  reglee: "bg-success/10 text-success",
  a_regler: "bg-info/10 text-info",
  annulee: "bg-surface-raise text-mute",
};
---

{
  pieces.length > 0 && (
    <section class="container-site print:hidden" aria-labelledby="pieces-titre">
      <div class="mx-auto max-w-[880px] border-b border-line pt-10 pb-8">
        <h2 id="pieces-titre" class="text-[1.25rem]/[1.3] tracking-[-0.01em]">
          Devis et factures
        </h2>
        <ul class="mt-4 divide-y divide-line">
          {pieces.map((p) => {
            const statut = statutPiece(p);
            return (
              <li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-[15px]">
                <a href={`/api/pieces/${p.id}`} target="_blank" rel="noopener" class="font-medium text-ink">
                  {libellePiece(p)}
                </a>
                <span class="flex shrink-0 flex-wrap items-baseline gap-3">
                  <span class="font-mono text-[12px] text-mute">{dateFr(p.emise_le)}</span>
                  <span class="tabular-nums">{montantEuros(p.ttc)}</span>
                  {statut && p.statut && (
                    <span class:list={["rounded-full px-2 py-0.5 text-[12px] font-semibold", PASTILLE[p.statut]]}>
                      {statut}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  )
}
```

- [ ] **Step 2 : brancher le bloc dans la page projet**

Dans `src/pages/espace/projets/[projet].astro`, ajouter aux imports :

```ts
import PiecesProjet from "../../../components/portail/projet/PiecesProjet.astro";
import { db } from "../../../lib/devis/reponses";
import type { Piece } from "../../../lib/pieces/piece";
import { piecesDuProjet } from "../../../lib/pieces/store";
```

Après la ligne `const heures = …`, ajouter :

```ts
// Les pièces comptables du projet (spec 2026-10-02, devis et factures, §4).
// Une base muette ne casse pas la page : le bloc disparaît.
let pieces: Piece[] = [];
if (projet.nomenclature) {
  try {
    pieces = await piecesDuProjet(db(), workspace.slug, projet.nomenclature);
  } catch (err) {
    console.error("Pièces du projet illisibles", err);
  }
}
```

Dans le gabarit, entre le bloc `projet.pack ? … : …` et `<OngletsEtapes …/>`, ajouter :

```astro
  <PiecesProjet pieces={pieces} />
```

Mettre à jour le commentaire d'en-tête de la page : « l'en-tête du projet Linear, l'avancement, les devis et factures, une étape par onglet ».

- [ ] **Step 3 : recette locale**

Run : `npm run dev`, se connecter en admin (`npm run comptes-locaux`, mot de passe `recette-locale`), puis ouvrir dans le navigateur :
- la page projet Fylgo « boutique Shopify » : trois lignes, « Devis n° 4330 », « Facture d'acompte n° 24617 » « Réglée le 01/04/2026 », « Facture de solde n° 24624 » « À régler, échéance le 24/08/2026 » ;
- chaque lien ouvre son PDF ;
- la page projet Amusoire « Pack d'heures, octobre 2026 » : une ligne, facture 24627 ;
- la page projet MerciYanis « Page d'accueil et méga-menu Webflow » : aucun bloc (24615 sans projet) ;
- `/api/pieces/facture-024622` (pièce Trigger) : 404.

Puis renommer temporairement la table en local (`npx wrangler d1 execute coolbeans-portal --local --command "ALTER TABLE pieces RENAME TO pieces_x"`), recharger la page Fylgo : elle s'affiche sans le bloc. Rétablir (`… --command "ALTER TABLE pieces_x RENAME TO pieces"`).

- [ ] **Step 4 : commit**

```bash
git add src/components/portail/projet/PiecesProjet.astro "src/pages/espace/projets/[projet].astro"
git commit -m "feat(pieces): bloc Devis et factures dans la page projet"
```

---

### Task 8 : la page admin des pièces

**Files :**
- Create : `src/lib/pieces/actions-admin.ts`
- Test : `src/lib/pieces/actions-admin.test.ts`
- Create : `src/pages/api/admin/finances/pieces/index.ts`
- Create : `src/pages/espace/admin/finances/pieces.astro`
- Modify : `src/pages/espace/admin/index.astro` (liste `outils`)
- Modify : `src/lib/portail/nav.ts` (section `admin`)
- Modify : `src/lib/portail/nav.test.ts` (test « porte les outils admin »)

**Interfaces :**
- Consumes : `toutesLesPieces`, `rattacher`, `marquerReglee`, `annulerReglement` (tâche 2) ; `libellePiece`, `statutPiece`, `montantEuros`, `dateFr` (tâche 3) ; `PROJETS`, `CLIENTS` (`src/lib/documents/nomenclature.ts`) ; route `GET /api/admin/finances/pieces/<id>` (tâche 6).
- Produces : `lireAction(corps: unknown, projetsConnus: readonly string[]): ActionPiece | { erreur: string }` avec `type ActionPiece = { action: "rattacher"; id: string; projet: string | null } | { action: "regler"; id: string; date: string } | { action: "annuler-reglement"; id: string }`. Route `POST /api/admin/finances/pieces`. Page `/admin/finances/pieces`.

- [ ] **Step 1 : écrire les tests de validation**

```ts
// src/lib/pieces/actions-admin.test.ts
import { describe, expect, it } from "vitest";
import { lireAction } from "./actions-admin";

const projets = ["boutique-shopify-390"];

describe("lireAction", () => {
  it("lit un rattachement, et un détachement", () => {
    expect(lireAction({ action: "rattacher", id: "facture-024624", projet: "boutique-shopify-390" }, projets)).toEqual({
      action: "rattacher",
      id: "facture-024624",
      projet: "boutique-shopify-390",
    });
    expect(lireAction({ action: "rattacher", id: "facture-024624", projet: "" }, projets)).toEqual({
      action: "rattacher",
      id: "facture-024624",
      projet: null,
    });
  });
  it("refuse un projet inconnu", () => {
    expect(lireAction({ action: "rattacher", id: "facture-024624", projet: "x-123" }, projets)).toEqual({
      erreur: "Projet inconnu : x-123.",
    });
  });
  it("lit un règlement daté et refuse une date mal formée", () => {
    expect(lireAction({ action: "regler", id: "facture-024624", date: "2026-10-05" }, projets)).toEqual({
      action: "regler",
      id: "facture-024624",
      date: "2026-10-05",
    });
    expect(lireAction({ action: "regler", id: "facture-024624", date: "05/10/2026" }, projets)).toEqual({
      erreur: "Date attendue au format AAAA-MM-JJ.",
    });
  });
  it("lit une annulation de règlement", () => {
    expect(lireAction({ action: "annuler-reglement", id: "facture-024624" }, projets)).toEqual({
      action: "annuler-reglement",
      id: "facture-024624",
    });
  });
  it("refuse une action ou un identifiant inconnus", () => {
    expect(lireAction({ action: "supprimer", id: "facture-024624" }, projets)).toEqual({ erreur: "Action inconnue." });
    expect(lireAction({ action: "regler", id: "", date: "2026-10-05" }, projets)).toEqual({
      erreur: "Identifiant de pièce manquant.",
    });
    expect(lireAction(null, projets)).toEqual({ erreur: "Corps de requête illisible." });
  });
});
```

- [ ] **Step 2 : lancer les tests, constater l'échec**

Run : `npx vitest run src/lib/pieces/actions-admin.test.ts`
Expected : FAIL, `Cannot find module './actions-admin'`.

- [ ] **Step 3 : écrire la validation**

```ts
// src/lib/pieces/actions-admin.ts
/* Les trois gestes de la page admin des pièces (spec 2026-10-02, §3), lus et
   validés avant d'atteindre la base. */
export type ActionPiece =
  | { action: "rattacher"; id: string; projet: string | null }
  | { action: "regler"; id: string; date: string }
  | { action: "annuler-reglement"; id: string };

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function lireAction(corps: unknown, projetsConnus: readonly string[]): ActionPiece | { erreur: string } {
  if (!corps || typeof corps !== "object") return { erreur: "Corps de requête illisible." };
  const c = corps as Record<string, unknown>;
  const id = texte(c.id);
  const action = texte(c.action);
  if (!["rattacher", "regler", "annuler-reglement"].includes(action)) return { erreur: "Action inconnue." };
  if (!id) return { erreur: "Identifiant de pièce manquant." };
  if (action === "rattacher") {
    const projet = texte(c.projet) || null;
    if (projet && !projetsConnus.includes(projet)) return { erreur: `Projet inconnu : ${projet}.` };
    return { action, id, projet };
  }
  if (action === "regler") {
    const date = texte(c.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Date attendue au format AAAA-MM-JJ." };
    return { action, id, date };
  }
  return { action: "annuler-reglement", id };
}
```

- [ ] **Step 4 : lancer les tests, constater le succès**

Run : `npx vitest run src/lib/pieces/actions-admin.test.ts`
Expected : PASS, 5 tests.

- [ ] **Step 5 : écrire la route d'action**

```ts
// src/pages/api/admin/finances/pieces/index.ts
/* Rattacher une pièce, la marquer réglée, annuler son règlement. Sous
   /api/admin/, donc gardée par le middleware. */
import type { APIRoute } from "astro";
import { db } from "../../../../../lib/devis/reponses";
import { PROJETS } from "../../../../../lib/documents/nomenclature";
import { lireAction } from "../../../../../lib/pieces/actions-admin";
import { annulerReglement, marquerReglee, rattacher } from "../../../../../lib/pieces/store";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    corps = null;
  }
  const a = lireAction(corps, Object.keys(PROJETS));
  if ("erreur" in a) return json({ error: a.erreur }, 400);
  if (a.action === "rattacher") await rattacher(db(), a.id, a.projet);
  if (a.action === "regler") await marquerReglee(db(), a.id, a.date);
  if (a.action === "annuler-reglement") await annulerReglement(db(), a.id);
  return json({ ok: true });
};
```

- [ ] **Step 6 : écrire la page**

```astro
---
// src/pages/espace/admin/finances/pieces.astro
// Les pièces comptables Tiime (spec 2026-10-02, §3). Sous /espace/admin/,
// donc gardée par le middleware ; sous finances/, comme toute donnée
// financière (règle de src/lib/portail/pages-admin.test.ts).
export const prerender = false;

import EspaceLayout from "../../../../layouts/EspaceLayout.astro";
import { db } from "../../../../lib/devis/reponses";
import { CLIENTS, PROJETS } from "../../../../lib/documents/nomenclature";
import { dateFr, libellePiece, montantEuros, statutPiece } from "../../../../lib/pieces/affichage";
import { toutesLesPieces } from "../../../../lib/pieces/store";
import { basculerSurCoolbeans } from "../../../../lib/portail/context";

Astro.response.headers.set("Cache-Control", "no-store");
await basculerSurCoolbeans(Astro);

const filtre = Astro.url.searchParams.get("filtre");
const toutes = await toutesLesPieces(db());
const pieces = toutes.filter((p) =>
  filtre === "sans-projet" ? !p.projet : filtre === "a-regler" ? p.statut === "a_regler" : true,
);
const projets = Object.entries(PROJETS).map(([slug, e]) => ({ slug, client: CLIENTS[e.client] }));
const aujourdHui = new Date().toISOString().slice(0, 10);
const FILTRES = [
  { valeur: null, libelle: "Toutes" },
  { valeur: "sans-projet", libelle: "Sans projet" },
  { valeur: "a-regler", libelle: "À régler" },
];
---

<EspaceLayout title="Pièces">
  <h1>Pièces</h1>
  <p class="sub">Les devis, factures et avoirs Tiime importés, et leur rattachement aux projets.</p>

  <nav class="mt-4 flex gap-3 text-[14px]" aria-label="Filtres">
    {
      FILTRES.map((f) => (
        <a
          href={f.valeur ? `?filtre=${f.valeur}` : "?"}
          class:list={["no-underline", filtre === f.valeur || (!filtre && !f.valeur) ? "font-semibold text-ink" : "text-mute"]}
        >
          {f.libelle}
        </a>
      ))
    }
  </nav>

  <p class="mt-4 text-[13px] text-mute" id="pieces-etat" aria-live="polite"></p>

  <ul class="mt-2 divide-y divide-line">
    {
      pieces.map((p) => (
        <li class="grid gap-2 py-4 sm:grid-cols-[1fr_auto]" data-piece={p.id}>
          <div>
            <a href={`/api/admin/finances/pieces/${p.id}`} target="_blank" rel="noopener" class="font-medium text-ink">
              {libellePiece(p)}
            </a>
            <p class="text-[13px] text-mute">
              {p.client ?? `${p.organisation} (revendeur)`} · {dateFr(p.emise_le)} · {montantEuros(p.ttc)}
              {statutPiece(p) && <> · {statutPiece(p)}</>}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select class="field" data-action="rattacher" aria-label={`Projet de ${libellePiece(p)}`}>
              <option value="" selected={!p.projet}>Sans projet</option>
              {projets.map((pr) => (
                <option value={pr.slug} selected={p.projet === pr.slug}>
                  {pr.client} · {pr.slug}
                </option>
              ))}
            </select>
            {p.type === "facture" && p.statut === "a_regler" && (
              <>
                <input class="field" type="date" value={aujourdHui} data-date aria-label="Date du règlement" />
                <button class="btn" type="button" data-action="regler">Réglée</button>
              </>
            )}
            {p.statut === "reglee" && (
              <button class="btn" type="button" data-action="annuler-reglement">Annuler le règlement</button>
            )}
          </div>
        </li>
      ))
    }
  </ul>
</EspaceLayout>

<script>
  const etat = document.getElementById("pieces-etat")!;
  const envoyer = async (corps: Record<string, unknown>) => {
    etat.textContent = "Enregistrement…";
    const reponse = await fetch("/api/admin/finances/pieces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (!reponse.ok) {
      const data = (await reponse.json().catch(() => ({}))) as { error?: string };
      etat.textContent = data.error ?? "Échec de l'enregistrement.";
      return;
    }
    location.reload();
  };
  for (const ligne of document.querySelectorAll<HTMLElement>("[data-piece]")) {
    const id = ligne.dataset.piece!;
    ligne.querySelector<HTMLSelectElement>("select[data-action=rattacher]")?.addEventListener("change", (e) =>
      envoyer({ action: "rattacher", id, projet: (e.target as HTMLSelectElement).value }),
    );
    ligne.querySelector("button[data-action=regler]")?.addEventListener("click", () =>
      envoyer({ action: "regler", id, date: ligne.querySelector<HTMLInputElement>("input[data-date]")!.value }),
    );
    ligne.querySelector("button[data-action=annuler-reglement]")?.addEventListener("click", () =>
      envoyer({ action: "annuler-reglement", id }),
    );
  }
</script>
```

Avant d'écrire les classes `field` et `btn`, relire `/design-system` (`src/pages/design-system.astro`) : `.label field-label` au-dessus d'un champ, `.label` seul pour un titre de section. Reprendre les classes de bouton de `relances.astro`.

- [ ] **Step 7 : ranger la page dans l'admin**

Dans `src/pages/espace/admin/index.astro`, ajouter à `outils`, après « Relances » :

```ts
  {
    titre: "Pièces",
    href: "/espace/admin/finances/pieces",
    detail: "Les devis et factures Tiime : rattachement aux projets et règlements.",
  },
```

Dans `src/lib/portail/nav.ts`, section `admin`, ajouter après « Devis » :

```ts
      { label: "Pièces", path: "/admin/finances/pieces", flag: "live" },
```

Dans `src/lib/portail/nav.test.ts`, test « porte les outils admin », ajouter `"Pièces"` à la fin du tableau attendu.

- [ ] **Step 8 : tests, build et recette**

Run : `npx vitest run && npm run build`
Expected : PASS (dont `pages-admin.test.ts`, qui vérifie que `/espace/admin/finances/pieces` tombe sous la garde) et build sans erreur.

Puis, `npm run dev`, en admin : ouvrir `/admin/finances/pieces`, filtrer « Sans projet » (24615 et 24612 apparaissent), rattacher 24615 à `accueil-mega-menu-246` puis le détacher, marquer 24624 réglée puis annuler le règlement. Relancer l'import local (tâche 5, étape 5) : `Inchangées (23)`.

- [ ] **Step 9 : commit**

```bash
git add src/lib/pieces/actions-admin.ts src/lib/pieces/actions-admin.test.ts \
  src/pages/api/admin/finances/pieces/index.ts src/pages/espace/admin/finances/pieces.astro \
  src/pages/espace/admin/index.astro src/lib/portail/nav.ts src/lib/portail/nav.test.ts
git commit -m "feat(pieces): page admin des pièces, rattachement et règlements"
```

---

### Task 9 : la doc du portail

**Files :**
- Modify : `src/content/docs/coolbeans/04-portail.mdx`

**Interfaces :**
- Consumes : tout ce qui précède.
- Produces : la doc à jour (règle « MAJ doc portail à chaque changement »).

- [ ] **Step 1 : décrire le bloc dans la page projet**

Dans le paragraphe qui décrit la page projet (« Sous l'en-tête, le bloc « Avancement » liste les issues… »), ajouter après la phrase sur l'avancement :

```mdx
Sous l'avancement, le bloc « Devis et factures » liste les pièces Tiime du
projet, avec leur date, leur montant TTC, leur statut et un lien vers le PDF.
Une pièce sans projet, ou adressée à un revendeur, n'y figure jamais.
```

- [ ] **Step 2 : ajouter la page admin à la liste des pages qui basculent sur Coolbeans**

Remplacer « (`/admin`, `/admin/relances`, » par « (`/admin`, `/admin/relances`, `/admin/finances/pieces`, ».

- [ ] **Step 3 : compléter la table de référence technique**

Ajouter après la ligne « Bloc Avancement de la page projet » :

```mdx
| Devis et factures : registre, import, bloc de la page projet, PDF | `migrations/0014_pieces.sql`, `src/lib/pieces/`, `scripts/importer-pieces.mts`, `src/components/portail/projet/PiecesProjet.astro`, `src/pages/api/pieces/[id].ts` |
| Pièces côté admin : rattachement et règlements | `src/pages/espace/admin/finances/pieces.astro`, `src/pages/api/admin/finances/pieces/` |
```

- [ ] **Step 4 : vérifier le build**

Run : `npm run build`
Expected : build sans erreur.

- [ ] **Step 5 : commit**

```bash
git add src/content/docs/coolbeans/04-portail.mdx
git commit -m "docs(portail): devis et factures dans la page projet"
```

---

### Task 10 : la mise en staging

**Files :** aucun.

Une seule session à la fois pour la migration D1 (règle du `CLAUDE.md` du repo).

- [ ] **Step 1 : vérifier la branche contre staging**

Run : `git fetch -q origin && git log --oneline origin/staging..feat/pieces && git log --oneline feat/pieces..origin/staging | head`
Expected : les commits de ce plan d'un côté. Si `origin/staging` a avancé, `git merge origin/staging` dans le worktree, relancer `npx vitest run && npm run build`.

- [ ] **Step 2 : migrer le staging**

Run : `npx wrangler d1 migrations apply coolbeans-portal-staging --env staging --remote`
Expected : `0014_pieces.sql` appliquée.

- [ ] **Step 3 : importer en staging**

Run : `node --experimental-strip-types scripts/importer-pieces.mts scripts/pieces/tiime-2026-10-02.json --pdf ~/Downloads --env staging`, lire la sortie, puis la même commande avec `--appliquer`.
Expected : `Nouvelles (23)`, `Écartées (0)`, puis `✓ 23 pièce(s) écrite(s)`. Les PDF sont déjà dans le bucket de staging : la réécriture est sans effet.

- [ ] **Step 4 : pousser sur staging**

Depuis le worktree, jamais depuis le clone principal (il reste sur `staging` et accueille d'autres sessions) :

```bash
git fetch -q origin
git merge-base --is-ancestor origin/staging feat/pieces && git push origin feat/pieces:staging
```

Expected : le push part. Si `merge-base` échoue, `origin/staging` a avancé : reprendre l'étape 1.

- [ ] **Step 5 : recette sur my-staging**

Sur `https://my-staging.coolbeans.cc`, compte de recette admin (mot de passe `staging-recette-2026`) : reprendre la recette de la tâche 7, étape 3, et celle de la tâche 8, étape 8.

- [ ] **Step 6 : s'arrêter avant la prod**

La migration prod, l'import prod (`--env production --appliquer`) et le merge vers `main` attendent l'ordre explicite de Ludo (spec §8). Annoncer que le lot est prêt, avec le lien de recette staging.
