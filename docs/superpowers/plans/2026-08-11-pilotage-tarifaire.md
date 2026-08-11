# Pilotage tarifaire & devis publiés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Outil interne de chiffrage sous `/espace/chiffrages` (Clerk admin) qui publie des devis versionnés, figés en KV, rendus publiquement sur `/devis/[client]/[projet]-[id]` par le composant `DevisCorps` existant.

**Architecture:** Logique métier dans des modules TS purs (`src/lib/chiffrage/`) testés par Vitest ; mutations par Astro Actions gardées admin ; éditeur en îlot Preact ; stockage Cloudflare KV (`PORTAL_KV`) ; page publique SSR qui rend un snapshot immuable au format de la collection `devis`.

**Tech Stack:** Astro 7 (`@astrojs/cloudflare`), `@clerk/astro` v4, Tailwind 4 sur tokens, Preact (`@astrojs/preact`, à ajouter), Astro Actions + Zod, Cloudflare KV, Vitest (à ajouter).

**Spec :** `docs/superpowers/specs/2026-08-11-pilotage-tarifaire-design.md` — la lire avant de commencer.

## Global Constraints

- **Aucun déploiement en production.** `main` poussé = prod (Workers Builds). Travailler sur une branche `chiffrage` (créée depuis `main` via superpowers:using-git-worktrees) ; ne jamais pousser `main` ; le passage sur `staging` puis la prod se font uniquement sur ordre explicite de Ludo.
- Toute l'UI en français ; tous les montants **HT** ; rappel « Tous les montants sont HT » en tête de l'éditeur.
- Style : classes du design system (`.field`, `.btn`, `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.card`, `.label`, `font-mono tabular-nums`, tokens `text-mute`, `border-line`, `bg-surface-subtle`, `text-success`, `text-error`…). **Interdit de reprendre le CSS du prototype** (`--ink`, `--surface` maison…).
- Devis client : jamais de prix par ligne, jamais de jours/heures, un seul total HT ; une section vide n'apparaît pas.
- Pages sous `/espace/*` : `export const prerender = false` obligatoire (sinon le middleware Clerk est contourné) + vérification `publicMetadata.role === "admin"` ; chaque Action vérifie l'admin côté serveur.
- Messages de commit en français, préfixes `feat(chiffrage):`, `test(chiffrage):`, `chore:`… + `Co-Authored-By: Claude <noreply@anthropic.com>` (adapter au modèle exécutant).
- Node ≥ 22.12 ; lancer les commandes depuis la racine du repo.

## File Structure

```
src/lib/chiffrage/
  types.ts        # types métier (Chiffrage, Catalogue, …) — zéro import Astro
  defaults.ts     # CATALOGUE_DEFAUT + nouveauChiffrage()
  format.ts       # fmtEUR, fmtJ
  calc.ts         # calculer() — moteur de calcul pur
  toDevis.ts      # toDevis() — conversion en snapshot DevisData
  store.ts        # accès KV (PORTAL_KV) : catalogue, chiffrages, devis publiés
  schemas.ts      # schémas Zod des Actions (importe astro:schema)
src/actions/index.ts                 # Astro Actions (chiffrages, catalogue)
src/components/chiffrage/
  ChiffrageEditor.tsx                # îlot racine de l'éditeur
  Configurateur.tsx                  # sections pages / dev / setup / libres
  BlocCalcul.tsx                     # détail du calcul + totaux + TJM vendu
  ModeLibre.tsx                      # chiffrage au temps passé
  DevisPreview.tsx                   # aperçu devis client en direct
  CatalogueEditor.tsx                # îlot de la page réglages
src/components/devis/DevisReponse.astro   # formulaire de réponse extrait de [slug].astro
src/pages/espace/chiffrages/
  index.astro      # liste + stats + suppression
  nouveau.astro    # éditeur (création)
  [id].astro       # éditeur (édition)
  reglages.astro   # catalogue et réglages
src/pages/devis/[client]/[projetId].astro  # page publique SSR versionnée
```

Tests colocalisés : `src/lib/chiffrage/*.test.ts`.

---

### Task 1: Binding KV `PORTAL_KV`

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `astro.config.mjs:46`

**Interfaces:**
- Produces: binding `PORTAL_KV` accessible via `import { env } from "cloudflare:workers"` en dev (platformProxy/miniflare) et en prod/staging.

- [ ] **Step 1: Créer les namespaces KV**

```bash
npx wrangler kv namespace create PORTAL_KV
npx wrangler kv namespace create PORTAL_KV --env staging
```

Noter les deux `id` affichés (prod puis staging).

- [ ] **Step 2: Déclarer le binding dans `wrangler.jsonc`**

Ajouter au niveau racine (après `"routes"`) et dans `env.staging`, en remplaçant `ID_PROD`/`ID_STAGING` par les ids de l'étape 1 :

```jsonc
  "kv_namespaces": [{ "binding": "PORTAL_KV", "id": "ID_PROD" }],
  "env": {
    "staging": {
      "workers_dev": false,
      "routes": [{ "pattern": "staging.coolbeans.cc", "custom_domain": true }],
      "kv_namespaces": [{ "binding": "PORTAL_KV", "id": "ID_STAGING" }]
    }
  }
```

- [ ] **Step 3: S'assurer que le proxy de plateforme est actif en dev**

Dans `astro.config.mjs`, remplacer `adapter: cloudflare(),` par :

```js
  // platformProxy expose les bindings du wrangler.jsonc (PORTAL_KV…) dans
  // `astro dev` via miniflare, avec un stockage local simulé.
  adapter: cloudflare({ platformProxy: { enabled: true } }),
```

- [ ] **Step 4: Vérifier le binding côté Cloudflare**

```bash
npx wrangler kv key put smoke ok --binding PORTAL_KV --remote
npx wrangler kv key get smoke --binding PORTAL_KV --remote
npx wrangler kv key delete smoke --binding PORTAL_KV --remote
```

Expected: `get` affiche `ok`, aucune erreur.

- [ ] **Step 5: Vérifier que le build passe toujours**

Run: `npm run build`
Expected: build OK, aucune régression.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc astro.config.mjs
git commit -m "chore(kv): crée le namespace PORTAL_KV et le binding prod/staging"
```

---

### Task 2: Vitest + types métier + catalogue par défaut + formatage

**Files:**
- Modify: `package.json`
- Create: `src/lib/chiffrage/types.ts`
- Create: `src/lib/chiffrage/defaults.ts`
- Create: `src/lib/chiffrage/format.ts`
- Test: `src/lib/chiffrage/defaults.test.ts`

**Interfaces:**
- Produces: tous les types métier (voir code) ; `CATALOGUE_DEFAUT: Catalogue` ; `nouveauChiffrage(cat: Catalogue): Chiffrage` ; `fmtEUR(n: number): string` ; `fmtJ(n: number): string`.

- [ ] **Step 1: Installer Vitest et ajouter le script**

```bash
npm install -D vitest
```

Dans `package.json`, ajouter aux `scripts` : `"test": "vitest run"`.

- [ ] **Step 2: Écrire les types métier**

Créer `src/lib/chiffrage/types.ts` (aucun import Astro — ces modules tournent sous Vitest) :

```ts
/* Types métier du pilotage tarifaire. Zéro dépendance Astro/DOM :
   partagés entre l'éditeur Preact, les Actions serveur et les tests. */

export type Niveau = "simple" | "standard" | "complexe";
export type Pack = "pack1" | "pack2" | "pack3" | "pack4";
export type Affinite = "neutre" | "envie" | "pasenvie";

export interface Settings {
  tjm: number;
  demi: number;
  marcheBas: number;
  marcheHaut: number;
  joursSemaine: number;
  semainesMarge: number;
  chargesPct: number;
}

export interface Catalog {
  design: { simple: number; standard: number; complexe: number; portee: { ux: number; ui: number } };
  integration: Record<Niveau, number>;
  dev: Record<Pack, number>;
  setup: Record<"cms" | "multilingue" | "hebergement" | "domaine", { jours: number; clientLabel: string }>;
  gestion: {
    coefHebdo: number;
    forfaitCMS: number;
    forfaitMultilingue: number;
    forfaitHebergement: number;
    forfaitDomaine: number;
    urgencePct: number;
  };
  affinite: { baisse: number; hausse: number };
  devisTexts: {
    stackTechnique: string;
    conditionsReglement: string;
    ceQueCaComprend: string; // une ligne par item
    horsPerimetre: string; // une ligne par item
  };
}

export interface Segment {
  label: string;
  desc: string;
  gestionProjet: boolean;
  note: string;
}

export interface Catalogue {
  settings: Settings;
  catalog: Catalog;
  segments: Record<string, Segment>;
}

export interface PageLigne { label: string; niveau: Niveau; ux: boolean; ui: boolean; integ: boolean }
export interface DevLigne { label: string; level: Pack }
export interface AutreLigne { label: string; jours: number }
export interface Poste { label: string; jours: number }

export interface Chiffrage {
  id: string | null; // null tant que jamais sauvegardé
  date: string; // YYYY-MM-DD
  nom: string;
  clientSlug: string;
  projetSlug: string;
  mode: "configurateur" | "libre";
  segment: string; // clé dans catalogue.segments
  objectif: string;
  pages: PageLigne[];
  devLines: DevLigne[];
  autres: AutreLigne[];
  setupCms: boolean;
  setupMultilingue: boolean;
  setupHebergement: boolean;
  setupDomaine: boolean;
  affinite: Affinite;
  gestionProjet: boolean;
  urgence: boolean;
  margePct: 0 | 10 | 20 | 30;
  reductionNom: string;
  reductionMontant: number;
  prixRetenu: number | null;
  /* mode libre uniquement */
  postes: Poste[];
  strategique: boolean;
  raison: string;
  /* publication */
  publishedKey: string | null;
  publishedVersions: number;
}
```

- [ ] **Step 3: Écrire le test des valeurs par défaut (il doit échouer)**

Créer `src/lib/chiffrage/defaults.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";

describe("CATALOGUE_DEFAUT", () => {
  it("porte les valeurs du brief", () => {
    expect(CATALOGUE_DEFAUT.settings.tjm).toBe(600);
    expect(CATALOGUE_DEFAUT.catalog.design.complexe).toBe(2);
    expect(CATALOGUE_DEFAUT.catalog.design.portee).toEqual({ ux: 40, ui: 70 });
    expect(CATALOGUE_DEFAUT.catalog.setup.multilingue.jours).toBe(2);
    expect(CATALOGUE_DEFAUT.catalog.gestion.urgencePct).toBe(20);
    expect(Object.keys(CATALOGUE_DEFAUT.segments)).toEqual([
      "agence", "designer", "pme", "tpe", "association",
    ]);
    // plus aucun multiplicateur de prix par cible
    expect(JSON.stringify(CATALOGUE_DEFAUT.segments)).not.toContain("multiplier");
  });
});

describe("nouveauChiffrage", () => {
  it("part du segment tpe avec sa gestion de projet par défaut", () => {
    const c = nouveauChiffrage(CATALOGUE_DEFAUT);
    expect(c.id).toBeNull();
    expect(c.segment).toBe("tpe");
    expect(c.gestionProjet).toBe(CATALOGUE_DEFAUT.segments.tpe.gestionProjet);
    expect(c.mode).toBe("configurateur");
    expect(c.publishedVersions).toBe(0);
  });
});
```

Run: `npm test`
Expected: FAIL (`Cannot find module './defaults'`).

- [ ] **Step 4: Implémenter `defaults.ts` et `format.ts`**

Créer `src/lib/chiffrage/defaults.ts` — reprendre **exactement** les valeurs et textes du prototype (`DEFAULT_CATALOG` / `DEFAULT_SEGMENTS`, repris dans la spec §5) :

```ts
import type { Catalogue, Chiffrage } from "./types";

export const CATALOGUE_DEFAUT: Catalogue = {
  settings: { tjm: 600, demi: 300, marcheBas: 450, marcheHaut: 650, joursSemaine: 3, semainesMarge: 1, chargesPct: 26 },
  catalog: {
    design: { simple: 0.5, standard: 1, complexe: 2, portee: { ux: 40, ui: 70 } },
    integration: { simple: 0.5, standard: 1, complexe: 1.5 },
    dev: { pack1: 0.5, pack2: 1, pack3: 1.5, pack4: 2 },
    setup: {
      cms: { jours: 0.5, clientLabel: "Gestion autonome de vos contenus (blog, équipe, actualités...)" },
      multilingue: { jours: 2, clientLabel: "Site disponible en plusieurs langues" },
      hebergement: { jours: 0.25, clientLabel: "Hébergement rapide et sécurisé, prêt à l'emploi" },
      domaine: { jours: 0.25, clientLabel: "Nom de domaine et DNS configurés" },
    },
    gestion: { coefHebdo: 0.15, forfaitCMS: 0.5, forfaitMultilingue: 1, forfaitHebergement: 0, forfaitDomaine: 0.25, urgencePct: 20 },
    affinite: { baisse: 20, hausse: 20 },
    devisTexts: {
      stackTechnique:
        "On part sur Astro (développement) + Sanity (CMS) + Cloudflare (hébergement). Pages ultra-légères, site rapide. Coût d'usage nul : hébergement Cloudflare gratuit, aucun abonnement mensuel. Autonomie : vous gérez textes, images et contenus vous-même via Sanity, sans toucher au code. Vous restez libre : le code est dans un dépôt qui vous appartient, le contenu Sanity est exportable, n'importe quel développeur peut reprendre le site.",
      conditionsReglement:
        "30 % à la validation du devis, qui lance la prestation. Solde à la livraison du site fonctionnel.",
      ceQueCaComprend:
        "Responsive (desktop, tablette, mobile)\nConfiguration SEO et bonnes pratiques\nOptimisation de la vitesse\nTests QA sur les 3 navigateurs principaux\nCertificat SSL\nPages légales et page de contact\nDoc de passation pour la prise en main du site\nSupport 30 jours après mise en ligne",
      horsPerimetre:
        "La rédaction des textes et la fourniture des visuels ne sont pas incluses.\nLa conception d'une charte graphique poussée n'est pas incluse (modernisation du design existant).",
    },
  },
  segments: {
    agence: { label: "Agence de com digitale", desc: "Pour leurs clients", gestionProjet: false, note: "L'agence porte sa propre marge et sa gestion de projet." },
    designer: { label: "Designer UX/UI, DA", desc: "Collab : ils designent, tu intègres", gestionProjet: false, note: "Le design n'est pas de ton ressort ici : ne coche que intégration et dev sur mesure. Le designer gère la relation client." },
    pme: { label: "PME, scale-up", desc: "Budgets plus importants", gestionProjet: true, note: "Plus d'enjeux, plus d'allers-retours, plus de coordination : gestion de projet activée par défaut." },
    tpe: { label: "TPE, solopreneur", desc: "Simple et rapide", gestionProjet: false, note: "Cycle court, décision rapide, pas de surcouche de gestion de projet par défaut." },
    association: { label: "Association", desc: "Tarifs ESS", gestionProjet: false, note: "Vérifie le budget réel avant d'appliquer une réduction : utilise le champ « Réduction exceptionnelle » plutôt qu'un abattement automatique." },
  },
};

export const nouveauChiffrage = (cat: Catalogue): Chiffrage => ({
  id: null,
  date: new Date().toISOString().slice(0, 10),
  nom: "",
  clientSlug: "",
  projetSlug: "",
  mode: "configurateur",
  segment: "tpe",
  objectif: "",
  pages: [],
  devLines: [],
  autres: [],
  setupCms: false,
  setupMultilingue: false,
  setupHebergement: false,
  setupDomaine: false,
  affinite: "neutre",
  gestionProjet: cat.segments.tpe?.gestionProjet ?? false,
  urgence: false,
  margePct: 0,
  reductionNom: "",
  reductionMontant: 0,
  prixRetenu: null,
  postes: [],
  strategique: false,
  raison: "",
  publishedKey: null,
  publishedVersions: 0,
});
```

Créer `src/lib/chiffrage/format.ts` :

```ts
/* Formats d'affichage fr-FR partagés éditeur/pages. */
export const fmtEUR = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
export const fmtJ = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/chiffrage/
git commit -m "feat(chiffrage): types métier, catalogue par défaut et Vitest"
```

---

### Task 3: Moteur de calcul `calc.ts` (TDD)

**Files:**
- Create: `src/lib/chiffrage/calc.ts`
- Test: `src/lib/chiffrage/calc.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `defaults.ts` (Task 2).
- Produces: `joursPage(p: PageLigne, cat: Catalogue): number` ; `calculer(c: Chiffrage, cat: Catalogue): CalcResult` avec :

```ts
export interface GestionDetail {
  hebdo: number; cms: number; multilingue: number; hebergement: number; domaine: number;
  jours: number; montant: number;
}
export interface CalcResult {
  joursPages: number[];            // aligné sur c.pages
  joursDev: number[];              // aligné sur c.devLines
  totalJoursProduction: number;
  sousTotal: number;
  ajusteAffinite: number;
  semainesBase: number;
  semainesTotal: number;
  gestion: GestionDetail;
  sousTotalAvantUrgence: number;
  majorationUrgence: number;
  sousTotalAvantMarge: number;
  margeMontant: number;
  sousTotalAvantReduction: number;
  totalSuggere: number;
  prix: number;                    // prixRetenu ?? totalSuggere
  tva: number; ttc: number; net: number;
  tjmVendu: number | null;         // (prix − marge) / jours, null si 0 jour
  tjmEffectif: number | null;      // prix / jours, null si 0 jour (badge historique + mode libre)
}
```

- [ ] **Step 1: Écrire les tests des formules (ils doivent échouer)**

Créer `src/lib/chiffrage/calc.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";
import { calculer, joursPage } from "./calc";
import type { Chiffrage } from "./types";

const cat = CATALOGUE_DEFAUT; // tjm 600, joursSemaine 3, semainesMarge 1

const base = (patch: Partial<Chiffrage>): Chiffrage => ({ ...nouveauChiffrage(cat), ...patch });

describe("joursPage — portée UX/UI et intégration", () => {
  it("UX + UI + intégration sur une page complexe = 2 + 1,5", () => {
    expect(joursPage({ label: "Accueil", niveau: "complexe", ux: true, ui: true, integ: true }, cat)).toBe(3.5);
  });
  it("UX seul sur une page standard = 1 × 40 %", () => {
    expect(joursPage({ label: "", niveau: "standard", ux: true, ui: false, integ: false }, cat)).toBeCloseTo(0.4);
  });
  it("UI seul sur une page standard = 1 × 70 %", () => {
    expect(joursPage({ label: "", niveau: "standard", ux: false, ui: true, integ: false }, cat)).toBeCloseTo(0.7);
  });
  it("intégration seule = jours d'intégration du niveau", () => {
    expect(joursPage({ label: "", niveau: "simple", ux: false, ui: false, integ: true }, cat)).toBe(0.5);
  });
  it("rien de coché = 0", () => {
    expect(joursPage({ label: "", niveau: "complexe", ux: false, ui: false, integ: false }, cat)).toBe(0);
  });
});

describe("calculer — chaîne complète du configurateur", () => {
  // 1 page complexe complète (3,5 j) + 1 dev pack2 (1 j) + setup CMS (0,5 j) + 1 ligne libre (1 j) = 6 j
  const c = base({
    pages: [{ label: "Accueil", niveau: "complexe", ux: true, ui: true, integ: true }],
    devLines: [{ label: "Scénario Make", level: "pack2" }],
    autres: [{ label: "Migration", jours: 1 }],
    setupCms: true,
    gestionProjet: true,
  });
  const r = calculer(c, cat);

  it("totalise la production", () => {
    expect(r.totalJoursProduction).toBe(6);
    expect(r.sousTotal).toBe(3600);
  });
  it("estime le délai avec arrondi supérieur au 0,5", () => {
    // 6 j / 3 j/sem = 2 → semainesBase 2, +1 de marge = 3
    expect(r.semainesBase).toBe(2);
    expect(r.semainesTotal).toBe(3);
  });
  it("détaille la gestion de projet (hebdo + forfait CMS)", () => {
    expect(r.gestion.hebdo).toBeCloseTo(3 * 0.15);
    expect(r.gestion.cms).toBe(0.5);
    expect(r.gestion.jours).toBeCloseTo(0.95);
    expect(r.gestion.montant).toBeCloseTo(570);
  });
  it("suit l'ordre affinité → gestion → urgence → marge → réduction", () => {
    expect(r.sousTotalAvantUrgence).toBeCloseTo(3600 + 570);
    expect(r.majorationUrgence).toBe(0);
    expect(r.margeMontant).toBe(0);
    expect(r.totalSuggere).toBeCloseTo(4170);
  });
  it("dérive TVA, TTC, net et TJM depuis le prix (suggéré par défaut)", () => {
    expect(r.prix).toBeCloseTo(4170);
    expect(r.tva).toBeCloseTo(834);
    expect(r.ttc).toBeCloseTo(5004);
    expect(r.net).toBeCloseTo(4170 * 0.74);
    expect(r.tjmVendu).toBeCloseTo(4170 / 6);
  });
});

describe("calculer — modificateurs", () => {
  const lignes = { pages: [{ label: "P", niveau: "standard" as const, ux: true, ui: true, integ: true }] }; // 2 j

  it("affinité « envie » applique la remise avant gestion", () => {
    const r = calculer(base({ ...lignes, affinite: "envie", gestionProjet: false }), cat);
    expect(r.ajusteAffinite).toBeCloseTo(1200 * 0.8);
  });
  it("urgence majore production + gestion", () => {
    const r = calculer(base({ ...lignes, gestionProjet: true, urgence: true }), cat);
    // 2 j → semainesTotal 2 ; gestion = 2 × 0,15 × 600 = 180
    expect(r.majorationUrgence).toBeCloseTo((1200 + 180) * 0.2);
  });
  it("la marge s'applique après urgence, la réduction en dernier avec plancher 0", () => {
    const r = calculer(base({ ...lignes, gestionProjet: false, margePct: 10, reductionMontant: 5000 }), cat);
    expect(r.margeMontant).toBeCloseTo(120);
    expect(r.totalSuggere).toBe(0);
  });
  it("le TJM vendu exclut la marge Coolbeans", () => {
    const r = calculer(base({ ...lignes, gestionProjet: false, margePct: 20, prixRetenu: 1440 }), cat);
    // marge = 1200 × 0,2 = 240 ; (1440 − 240) / 2 = 600
    expect(r.tjmVendu).toBeCloseTo(600);
  });
  it("un chiffrage vide ne divise pas par zéro", () => {
    const r = calculer(base({}), cat);
    expect(r.totalJoursProduction).toBe(0);
    expect(r.semainesTotal).toBe(0);
    expect(r.tjmVendu).toBeNull();
  });
});

describe("calculer — mode libre", () => {
  it("somme les postes et calcule le TJM effectif depuis le prix retenu", () => {
    const r = calculer(
      base({ mode: "libre", postes: [{ label: "Wireframes", jours: 1 }, { label: "Intégration", jours: 8 }], prixRetenu: 3250 }),
      cat,
    );
    expect(r.totalJoursProduction).toBe(9);
    expect(r.tjmEffectif).toBeCloseTo(3250 / 9);
    // en libre : pas de gestion/affinité/marge appliquées
    expect(r.gestion.montant).toBe(0);
    expect(r.totalSuggere).toBe(9 * 600);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test`
Expected: FAIL (`Cannot find module './calc'`).

- [ ] **Step 3: Implémenter `calc.ts`**

```ts
import type { Catalogue, Chiffrage, PageLigne } from "./types";

export interface GestionDetail {
  hebdo: number; cms: number; multilingue: number; hebergement: number; domaine: number;
  jours: number; montant: number;
}

export interface CalcResult {
  joursPages: number[];
  joursDev: number[];
  totalJoursProduction: number;
  sousTotal: number;
  ajusteAffinite: number;
  semainesBase: number;
  semainesTotal: number;
  gestion: GestionDetail;
  sousTotalAvantUrgence: number;
  majorationUrgence: number;
  sousTotalAvantMarge: number;
  margeMontant: number;
  sousTotalAvantReduction: number;
  totalSuggere: number;
  prix: number;
  tva: number; ttc: number; net: number;
  tjmVendu: number | null;
  tjmEffectif: number | null;
}

export const joursPage = (p: PageLigne, cat: Catalogue): number => {
  const base = cat.catalog.design[p.niveau];
  const design =
    p.ux && p.ui ? base
    : p.ux ? (base * cat.catalog.design.portee.ux) / 100
    : p.ui ? (base * cat.catalog.design.portee.ui) / 100
    : 0;
  const integ = p.integ ? cat.catalog.integration[p.niveau] : 0;
  return design + integ;
};

export function calculer(c: Chiffrage, cat: Catalogue): CalcResult {
  const { settings, catalog } = cat;
  const libre = c.mode === "libre";

  const joursPages = c.pages.map((p) => joursPage(p, cat));
  const joursDev = c.devLines.map((l) => catalog.dev[l.level]);
  const joursSetup =
    (c.setupCms ? catalog.setup.cms.jours : 0) +
    (c.setupMultilingue ? catalog.setup.multilingue.jours : 0) +
    (c.setupHebergement ? catalog.setup.hebergement.jours : 0) +
    (c.setupDomaine ? catalog.setup.domaine.jours : 0);

  const totalJoursProduction = libre
    ? c.postes.reduce((s, p) => s + (p.jours || 0), 0)
    : joursPages.reduce((s, j) => s + j, 0) +
      joursDev.reduce((s, j) => s + j, 0) +
      joursSetup +
      c.autres.reduce((s, l) => s + (l.jours || 0), 0);

  const sousTotal = totalJoursProduction * settings.tjm;

  /* Le mode libre s'arrête au prix au TJM cible : pas d'affinité, de gestion,
     d'urgence, de marge ni de réduction (remplacés par « remise assumée »). */
  const ajusteAffinite = libre
    ? sousTotal
    : c.affinite === "envie" ? sousTotal * (1 - catalog.affinite.baisse / 100)
    : c.affinite === "pasenvie" ? sousTotal * (1 + catalog.affinite.hausse / 100)
    : sousTotal;

  const semainesBase =
    totalJoursProduction > 0 ? Math.ceil((totalJoursProduction / settings.joursSemaine) * 2) / 2 : 0;
  const semainesTotal = totalJoursProduction > 0 ? semainesBase + settings.semainesMarge : 0;

  const g = catalog.gestion;
  const hebdo = libre ? 0 : semainesTotal * g.coefHebdo;
  const gCms = !libre && c.setupCms ? g.forfaitCMS : 0;
  const gMulti = !libre && c.setupMultilingue ? g.forfaitMultilingue : 0;
  const gHeberg = !libre && c.setupHebergement ? g.forfaitHebergement : 0;
  const gDomaine = !libre && c.setupDomaine ? g.forfaitDomaine : 0;
  const gestionJours = hebdo + gCms + gMulti + gHeberg + gDomaine;
  const gestionActive = !libre && c.gestionProjet;
  const gestion: GestionDetail = {
    hebdo, cms: gCms, multilingue: gMulti, hebergement: gHeberg, domaine: gDomaine,
    jours: gestionActive ? gestionJours : 0,
    montant: gestionActive ? gestionJours * settings.tjm : 0,
  };

  const sousTotalAvantUrgence = ajusteAffinite + gestion.montant;
  const majorationUrgence =
    !libre && c.urgence ? sousTotalAvantUrgence * (g.urgencePct / 100) : 0;
  const sousTotalAvantMarge = sousTotalAvantUrgence + majorationUrgence;
  const margeMontant = libre ? 0 : sousTotalAvantMarge * (c.margePct / 100);
  const sousTotalAvantReduction = sousTotalAvantMarge + margeMontant;
  const totalSuggere = Math.max(0, sousTotalAvantReduction - (libre ? 0 : c.reductionMontant || 0));

  const prix = c.prixRetenu ?? totalSuggere;
  const tva = prix * 0.2;
  const ttc = prix * 1.2;
  const net = prix * (1 - settings.chargesPct / 100);
  const tjmVendu = totalJoursProduction > 0 ? (prix - margeMontant) / totalJoursProduction : null;
  const tjmEffectif = totalJoursProduction > 0 ? prix / totalJoursProduction : null;

  return {
    joursPages, joursDev, totalJoursProduction, sousTotal, ajusteAffinite,
    semainesBase, semainesTotal, gestion,
    sousTotalAvantUrgence, majorationUrgence, sousTotalAvantMarge,
    margeMontant, sousTotalAvantReduction, totalSuggere,
    prix, tva, ttc, net, tjmVendu, tjmEffectif,
  };
}
```

- [ ] **Step 4: Vérifier que tout passe**

Run: `npm test`
Expected: PASS (tous les tests de calc + defaults).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chiffrage/calc.ts src/lib/chiffrage/calc.test.ts
git commit -m "feat(chiffrage): moteur de calcul des formules du brief (TDD)"
```

---

### Task 4: Conversion en devis client `toDevis.ts` (TDD)

**Files:**
- Create: `src/lib/chiffrage/toDevis.ts`
- Test: `src/lib/chiffrage/toDevis.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `calc.ts` (`CalcResult`).
- Produces:

```ts
export interface SnapshotBudget { lignes: { label: string; prix?: number }[]; mention?: string; reglement?: string }
export interface SnapshotSection { titre: string; texte?: string; liste?: string[]; budget?: SnapshotBudget }
export interface DevisSnapshotData {
  titre: string; objet: string; date: string; // ISO — ravivée en Date au rendu
  sections: SnapshotSection[]; notes: never[];
}
export function toDevis(c: Chiffrage, cat: Catalogue, calc: CalcResult, publishedAt: string): DevisSnapshotData;
```

- [ ] **Step 1: Écrire les tests des règles de contenu (ils doivent échouer)**

Créer `src/lib/chiffrage/toDevis.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";
import { calculer } from "./calc";
import { toDevis } from "./toDevis";
import type { Chiffrage } from "./types";

const cat = CATALOGUE_DEFAUT;
const AT = "2026-08-11T10:00:00.000Z";
const build = (patch: Partial<Chiffrage>) => {
  const c: Chiffrage = {
    ...nouveauChiffrage(cat),
    nom: "Atelier Vasseur — refonte",
    objectif: "Un site qui reflète le savoir-faire de l'atelier.",
    clientSlug: "atelier-vasseur",
    projetSlug: "refonte-site",
    prixRetenu: 6400,
    ...patch,
  };
  return toDevis(c, cat, calculer(c, cat), AT);
};
const titres = (d: ReturnType<typeof build>) => d.sections.map((s) => s.titre);

describe("toDevis — en-tête et budget", () => {
  it("porte nom et objectif dans l'en-tête, pas en section", () => {
    const d = build({ pages: [{ label: "Accueil", niveau: "simple", ux: true, ui: true, integ: true }] });
    expect(d.titre).toBe("Atelier Vasseur — refonte");
    expect(d.objet).toBe("Un site qui reflète le savoir-faire de l'atelier.");
    expect(d.date).toBe(AT);
    expect(titres(d)).not.toContain("Objectif");
  });
  it("un seul montant : le prix retenu, mention HT, conditions de règlement", () => {
    const d = build({ pages: [{ label: "Accueil", niveau: "simple", ux: true, ui: true, integ: true }] });
    const budget = d.sections.find((s) => s.titre === "Budget")!.budget!;
    expect(budget.lignes).toEqual([{ label: "Forfait global de la prestation", prix: 6400 }]);
    expect(budget.mention).toBe("HT");
    expect(budget.reglement).toBe(cat.catalog.devisTexts.conditionsReglement);
    // aucun jour ni prix par ligne ailleurs
    expect(JSON.stringify(d.sections.filter((s) => s.titre !== "Budget"))).not.toMatch(/\d+ ?j\b/);
  });
});

describe("toDevis — sections conditionnelles, dans l'ordre", () => {
  it("mission complète : toutes les sections, ordre fixe", () => {
    const d = build({
      pages: [{ label: "Accueil", niveau: "complexe", ux: true, ui: true, integ: true }],
      devLines: [{ label: "Formulaire de devis avec upload", level: "pack2" }],
      setupCms: true,
      gestionProjet: true,
    });
    expect(titres(d)).toEqual([
      "Pages", "Fonctionnalités", "Stack technique", "Budget",
      "Ce que ça comprend", "Planning", "Hors périmètre",
    ]);
  });
  it("mission sans page : ni Pages ni Stack technique, pas de placeholder", () => {
    const d = build({ devLines: [{ label: "Connexion Webflow → HubSpot", level: "pack2" }], gestionProjet: false });
    expect(titres(d)).not.toContain("Pages");
    expect(titres(d)).not.toContain("Stack technique");
    expect(titres(d)).toContain("Fonctionnalités");
  });
  it("une page cochée à 0 jour n'apparaît pas", () => {
    const d = build({
      pages: [
        { label: "Accueil", niveau: "simple", ux: true, ui: true, integ: true },
        { label: "Fantôme", niveau: "simple", ux: false, ui: false, integ: false },
      ],
    });
    expect(d.sections.find((s) => s.titre === "Pages")!.liste).toEqual(["Accueil"]);
  });
});

describe("toDevis — ajouts automatiques", () => {
  it("« Ce que ça comprend » = base + clientLabels cochés + gestion de projet", () => {
    const d = build({ setupCms: true, setupDomaine: true, gestionProjet: true,
      pages: [{ label: "A", niveau: "simple", ux: true, ui: true, integ: true }] });
    const liste = d.sections.find((s) => s.titre === "Ce que ça comprend")!.liste!;
    expect(liste).toContain(cat.catalog.setup.cms.clientLabel);
    expect(liste).toContain(cat.catalog.setup.domaine.clientLabel);
    expect(liste).not.toContain(cat.catalog.setup.multilingue.clientLabel);
    expect(liste.at(-1)).toBe(
      "Suivi de projet : points hebdomadaires jusqu'à la livraison, comptes-rendus, planning à jour",
    );
  });
  it("hors périmètre nomme la page en portée partielle UX/UI", () => {
    const d = build({
      pages: [
        { label: "Accueil", niveau: "standard", ux: true, ui: false, integ: false },
        { label: "Contact", niveau: "standard", ux: false, ui: true, integ: false },
      ],
    });
    const hors = d.sections.find((s) => s.titre === "Hors périmètre")!.liste!;
    expect(hors).toContain("Le design UI de la page « Accueil » (fourni par un tiers)");
    expect(hors).toContain("Les wireframes de la page « Contact » (fournis par un tiers)");
  });
  it("planning : une seule ligne en semaines, virgule française", () => {
    // 1 page simple complète = 1 j → 0,5 sem + 1 de marge = 1,5
    const d = build({ pages: [{ label: "A", niveau: "simple", ux: true, ui: true, integ: true }] });
    expect(d.sections.find((s) => s.titre === "Planning")!.texte).toBe(
      "Livraison estimée à 1,5 semaines à réception de l'acompte.",
    );
  });
});

describe("toDevis — garde-fous", () => {
  it("refuse le mode libre", () => {
    const c: Chiffrage = { ...nouveauChiffrage(cat), mode: "libre", postes: [{ label: "X", jours: 1 }], prixRetenu: 600 };
    expect(() => toDevis(c, cat, calculer(c, cat), AT)).toThrow();
  });
  it("refuse un prix retenu absent", () => {
    const c: Chiffrage = { ...nouveauChiffrage(cat), prixRetenu: null,
      pages: [{ label: "A", niveau: "simple", ux: true, ui: true, integ: true }] };
    expect(() => toDevis(c, cat, calculer(c, cat), AT)).toThrow();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test`
Expected: FAIL (`Cannot find module './toDevis'`).

- [ ] **Step 3: Implémenter `toDevis.ts`**

```ts
import type { Catalogue, Chiffrage } from "./types";
import type { CalcResult } from "./calc";
import { fmtJ } from "./format";

export interface SnapshotBudget { lignes: { label: string; prix?: number }[]; mention?: string; reglement?: string }
export interface SnapshotSection { titre: string; texte?: string; liste?: string[]; budget?: SnapshotBudget }
export interface DevisSnapshotData {
  titre: string;
  objet: string;
  date: string;
  sections: SnapshotSection[];
  notes: never[];
}

const lignesDe = (bloc: string) => bloc.split("\n").map((s) => s.trim()).filter(Boolean);

/* Construit le snapshot client au format de la collection `devis` (rendu par
   DevisCorps). Règles non négociables : aucun jour, aucun prix par ligne,
   sections vides omises, langage orienté résultat client. */
export function toDevis(c: Chiffrage, cat: Catalogue, calc: CalcResult, publishedAt: string): DevisSnapshotData {
  if (c.mode !== "configurateur") throw new Error("Seul le mode configurateur est publiable.");
  if (c.prixRetenu == null) throw new Error("Prix retenu manquant.");

  const t = cat.catalog.devisTexts;
  const sections: SnapshotSection[] = [];

  const pagesLabels = c.pages
    .filter((_, i) => calc.joursPages[i] > 0)
    .map((p) => p.label.trim() || "Page sans nom");
  if (pagesLabels.length) sections.push({ titre: "Pages", liste: pagesLabels });

  const fonctions = [
    ...c.devLines.map((l) => l.label.trim() || "Développement sans nom"),
    ...c.autres.filter((l) => l.jours > 0).map((l) => l.label.trim() || "Ligne sans nom"),
  ];
  if (fonctions.length) sections.push({ titre: "Fonctionnalités", liste: fonctions });

  if (pagesLabels.length && t.stackTechnique.trim())
    sections.push({ titre: "Stack technique", texte: t.stackTechnique });

  sections.push({
    titre: "Budget",
    budget: {
      lignes: [{ label: "Forfait global de la prestation", prix: c.prixRetenu }],
      mention: "HT",
      reglement: t.conditionsReglement,
    },
  });

  const comprend = [
    ...lignesDe(t.ceQueCaComprend),
    ...(c.setupCms ? [cat.catalog.setup.cms.clientLabel] : []),
    ...(c.setupMultilingue ? [cat.catalog.setup.multilingue.clientLabel] : []),
    ...(c.setupHebergement ? [cat.catalog.setup.hebergement.clientLabel] : []),
    ...(c.setupDomaine ? [cat.catalog.setup.domaine.clientLabel] : []),
    ...(c.gestionProjet
      ? ["Suivi de projet : points hebdomadaires jusqu'à la livraison, comptes-rendus, planning à jour"]
      : []),
  ];
  if (comprend.length) sections.push({ titre: "Ce que ça comprend", liste: comprend });

  if (calc.totalJoursProduction > 0)
    sections.push({
      titre: "Planning",
      texte: `Livraison estimée à ${fmtJ(calc.semainesTotal)} semaines à réception de l'acompte.`,
    });

  const hors = [
    ...lignesDe(t.horsPerimetre),
    ...c.pages.flatMap((p, i) => {
      if (calc.joursPages[i] <= 0) return [];
      const label = p.label.trim() || "cette page";
      if (p.ux && !p.ui) return [`Le design UI de la page « ${label} » (fourni par un tiers)`];
      if (p.ui && !p.ux) return [`Les wireframes de la page « ${label} » (fournis par un tiers)`];
      return [];
    }),
  ];
  if (hors.length) sections.push({ titre: "Hors périmètre", liste: hors });

  return { titre: c.nom, objet: c.objectif, date: publishedAt, sections, notes: [] };
}
```

- [ ] **Step 4: Vérifier que tout passe**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chiffrage/toDevis.ts src/lib/chiffrage/toDevis.test.ts
git commit -m "feat(chiffrage): conversion chiffrage → snapshot devis client (TDD)"
```

---

### Task 5: Accès KV `store.ts` (TDD sur mock)

**Files:**
- Create: `src/lib/chiffrage/store.ts`
- Test: `src/lib/chiffrage/store.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `defaults.ts`, `toDevis.ts` (`DevisSnapshotData`).
- Produces:

```ts
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}
export function kv(): KVLike;                       // binding PORTAL_KV (runtime Workers)
export interface DevisPublie {
  clientSlug: string; projetSlug: string; id: string;
  versions: { n: number; publishedAt: string; data: DevisSnapshotData }[];
}
export const cleChiffrage: (id: string) => string;                                  // chiffrage:{id}
export const cleDevis: (clientSlug: string, projetSlug: string, id: string) => string; // devis:{c}:{p}-{id}
export function getCatalogue(ns?: KVLike): Promise<Catalogue>;
export function saveCatalogue(c: Catalogue, ns?: KVLike): Promise<void>;
export function getChiffrage(id: string, ns?: KVLike): Promise<Chiffrage | null>;
export function saveChiffrage(c: Chiffrage & { id: string }, ns?: KVLike): Promise<void>;
export function deleteChiffrage(id: string, ns?: KVLike): Promise<void>;
export function listChiffrages(ns?: KVLike): Promise<Chiffrage[]>;
export function genererId(ns?: KVLike, tirage?: () => number): Promise<string>;     // 4-5 chiffres, anticollision
export function getDevisPublieParCle(key: string, ns?: KVLike): Promise<DevisPublie | null>;
export function publierVersion(c: Chiffrage & { id: string }, data: DevisSnapshotData, ns?: KVLike): Promise<{ url: string; n: number }>;
```

**Important :** `import { env } from "cloudflare:workers"` doit rester **paresseux** (dans la fonction `kv()`, pas au chargement du module) est impossible en import statique — importer le module entier échoue sous Vitest. Solution : l'import statique est fait, mais **les tests passent toujours un `ns` explicite**, et Vitest doit aliaser `cloudflare:workers`. Ajouter à `package.json` un fichier `vitest.config.ts` n'est pas nécessaire : utiliser un stub via `vi.mock` (voir test ci-dessous).

- [ ] **Step 1: Écrire les tests sur un KV en mémoire (ils doivent échouer)**

Créer `src/lib/chiffrage/store.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub du module runtime Workers : jamais utilisé quand on passe `ns` explicitement.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";
import type { Chiffrage } from "./types";
import {
  cleChiffrage, cleDevis, genererId, getCatalogue, getChiffrage,
  listChiffrages, publierVersion, saveChiffrage, type KVLike,
} from "./store";

const memoire = (): KVLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    delete: async (k) => void data.delete(k),
    list: async ({ prefix }) => ({
      keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  };
};

let ns: ReturnType<typeof memoire>;
beforeEach(() => { ns = memoire(); });

const chiffrage = (id: string): Chiffrage & { id: string } => ({
  ...nouveauChiffrage(CATALOGUE_DEFAUT), id, nom: `C${id}`, clientSlug: "acme", projetSlug: "site",
});

describe("store", () => {
  it("les clés suivent le schéma de la spec", () => {
    expect(cleChiffrage("8432")).toBe("chiffrage:8432");
    expect(cleDevis("acme", "site", "8432")).toBe("devis:acme:site-8432");
  });

  it("le catalogue absent retombe sur les valeurs par défaut", async () => {
    expect(await getCatalogue(ns)).toEqual(CATALOGUE_DEFAUT);
  });

  it("sauvegarde puis relit un chiffrage", async () => {
    await saveChiffrage(chiffrage("8432"), ns);
    expect((await getChiffrage("8432", ns))?.nom).toBe("C8432");
  });

  it("liste par préfixe", async () => {
    await saveChiffrage(chiffrage("1111"), ns);
    await saveChiffrage(chiffrage("2222"), ns);
    await ns.put("devis:acme:site-1111", "{}"); // ne doit pas remonter
    const tous = await listChiffrages(ns);
    expect(tous.map((c) => c.id).sort()).toEqual(["1111", "2222"]);
  });

  it("genererId produit 4-5 chiffres et évite les collisions", async () => {
    await saveChiffrage(chiffrage("1000"), ns);
    const tirages = [1000, 1000, 4242]; // deux collisions puis un id libre
    const id = await genererId(ns, () => tirages.shift()!);
    expect(id).toBe("4242");
    expect(id).toMatch(/^\d{4,5}$/);
  });

  it("publierVersion crée puis empile des versions immuables", async () => {
    const c = chiffrage("8432");
    const data = { titre: "T", objet: "O", date: "2026-08-11T00:00:00.000Z", sections: [], notes: [] as never[] };
    const v1 = await publierVersion(c, data, ns);
    expect(v1).toEqual({ url: "/devis/acme/site-8432", n: 1 });
    const v2 = await publierVersion(c, { ...data, titre: "T2" }, ns);
    expect(v2.n).toBe(2);
    const doc = JSON.parse(ns.data.get("devis:acme:site-8432")!);
    expect(doc.versions).toHaveLength(2);
    expect(doc.versions[0].data.titre).toBe("T"); // la V1 n'a pas bougé
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test`
Expected: FAIL (`Cannot find module './store'`).

- [ ] **Step 3: Implémenter `store.ts`**

```ts
import { env } from "cloudflare:workers";
import type { Catalogue, Chiffrage } from "./types";
import type { DevisSnapshotData } from "./toDevis";
import { CATALOGUE_DEFAUT } from "./defaults";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

/* Typage structurel du binding : évite de dépendre de @cloudflare/workers-types
   et permet le mock en mémoire dans les tests. */
export const kv = (): KVLike => (env as unknown as { PORTAL_KV: KVLike }).PORTAL_KV;

export interface DevisPublie {
  clientSlug: string;
  projetSlug: string;
  id: string;
  versions: { n: number; publishedAt: string; data: DevisSnapshotData }[];
}

export const cleChiffrage = (id: string) => `chiffrage:${id}`;
export const cleDevis = (clientSlug: string, projetSlug: string, id: string) =>
  `devis:${clientSlug}:${projetSlug}-${id}`;

export async function getCatalogue(ns: KVLike = kv()): Promise<Catalogue> {
  const raw = await ns.get("pilotage:catalog");
  return raw ? (JSON.parse(raw) as Catalogue) : structuredClone(CATALOGUE_DEFAUT);
}

export async function saveCatalogue(c: Catalogue, ns: KVLike = kv()): Promise<void> {
  await ns.put("pilotage:catalog", JSON.stringify(c));
}

export async function getChiffrage(id: string, ns: KVLike = kv()): Promise<Chiffrage | null> {
  const raw = await ns.get(cleChiffrage(id));
  return raw ? (JSON.parse(raw) as Chiffrage) : null;
}

export async function saveChiffrage(c: Chiffrage & { id: string }, ns: KVLike = kv()): Promise<void> {
  await ns.put(cleChiffrage(c.id), JSON.stringify(c));
}

export async function deleteChiffrage(id: string, ns: KVLike = kv()): Promise<void> {
  await ns.delete(cleChiffrage(id));
}

export async function listChiffrages(ns: KVLike = kv()): Promise<Chiffrage[]> {
  const noms: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await ns.list({ prefix: "chiffrage:", cursor });
    noms.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const raws = await Promise.all(noms.map((k) => ns.get(k)));
  return raws.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as Chiffrage);
}

export async function genererId(
  ns: KVLike = kv(),
  tirage: () => number = () => Math.floor(1000 + Math.random() * 99000),
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = String(tirage());
    if (!(await ns.get(cleChiffrage(id)))) return id;
  }
  throw new Error("Impossible de générer un identifiant libre.");
}

export async function getDevisPublieParCle(key: string, ns: KVLike = kv()): Promise<DevisPublie | null> {
  const raw = await ns.get(key);
  return raw ? (JSON.parse(raw) as DevisPublie) : null;
}

export async function publierVersion(
  c: Chiffrage & { id: string },
  data: DevisSnapshotData,
  ns: KVLike = kv(),
): Promise<{ url: string; n: number }> {
  const key = cleDevis(c.clientSlug, c.projetSlug, c.id);
  const doc: DevisPublie = (await getDevisPublieParCle(key, ns)) ?? {
    clientSlug: c.clientSlug,
    projetSlug: c.projetSlug,
    id: c.id,
    versions: [],
  };
  const n = doc.versions.length + 1;
  doc.versions.push({ n, publishedAt: data.date, data });
  await ns.put(key, JSON.stringify(doc));
  return { url: `/devis/${c.clientSlug}/${c.projetSlug}-${c.id}`, n };
}
```

- [ ] **Step 4: Vérifier que tout passe**

Run: `npm test`
Expected: PASS (l'alias `vi.mock("cloudflare:workers")` neutralise l'import runtime).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chiffrage/store.ts src/lib/chiffrage/store.test.ts
git commit -m "feat(chiffrage): accès KV chiffrages, catalogue et devis publiés (TDD)"
```

---

### Task 6: Astro Actions + garde admin

**Files:**
- Create: `src/lib/chiffrage/schemas.ts`
- Create: `src/actions/index.ts`

**Interfaces:**
- Consumes: `store.ts`, `calc.ts`, `toDevis.ts`, `types.ts`.
- Produces (côté client `import { actions } from "astro:actions"`) :
  - `actions.chiffrages.sauvegarder(chiffrage: Chiffrage)` → `Chiffrage & { id: string }` (génère l'id au premier appel, fige les slugs si déjà publié)
  - `actions.chiffrages.publier({ id: string })` → `{ url: string; version: number }`
  - `actions.chiffrages.supprimer` (accept `form`, champ `id`) → `{ ok: true }`
  - `actions.catalogue.sauvegarder(catalogue: Catalogue)` → `{ ok: true }`

- [ ] **Step 1: Écrire les schémas Zod**

Créer `src/lib/chiffrage/schemas.ts` (séparé de `types.ts` car il importe `astro:schema`, indisponible sous Vitest) :

```ts
import { z } from "astro:schema";

const slug = z.string().regex(/^[a-z0-9-]*$/, "Slug : minuscules, chiffres et tirets uniquement.");

export const chiffrageSchema = z.object({
  id: z.string().nullable(),
  date: z.string(),
  nom: z.string(),
  clientSlug: slug,
  projetSlug: slug,
  mode: z.enum(["configurateur", "libre"]),
  segment: z.string(),
  objectif: z.string(),
  pages: z.array(z.object({
    label: z.string(),
    niveau: z.enum(["simple", "standard", "complexe"]),
    ux: z.boolean(), ui: z.boolean(), integ: z.boolean(),
  })),
  devLines: z.array(z.object({ label: z.string(), level: z.enum(["pack1", "pack2", "pack3", "pack4"]) })),
  autres: z.array(z.object({ label: z.string(), jours: z.number().min(0) })),
  setupCms: z.boolean(), setupMultilingue: z.boolean(),
  setupHebergement: z.boolean(), setupDomaine: z.boolean(),
  affinite: z.enum(["neutre", "envie", "pasenvie"]),
  gestionProjet: z.boolean(),
  urgence: z.boolean(),
  margePct: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30)]),
  reductionNom: z.string(),
  reductionMontant: z.number().min(0),
  prixRetenu: z.number().min(0).nullable(),
  postes: z.array(z.object({ label: z.string(), jours: z.number().min(0) })),
  strategique: z.boolean(),
  raison: z.string(),
  publishedKey: z.string().nullable(),
  publishedVersions: z.number().min(0),
});

const setupItem = z.object({ jours: z.number().min(0), clientLabel: z.string() });

export const catalogueSchema = z.object({
  settings: z.object({
    tjm: z.number().positive(), demi: z.number().min(0),
    marcheBas: z.number().min(0), marcheHaut: z.number().min(0),
    joursSemaine: z.number().positive(), semainesMarge: z.number().min(0),
    chargesPct: z.number().min(0).max(100),
  }),
  catalog: z.object({
    design: z.object({
      simple: z.number().min(0), standard: z.number().min(0), complexe: z.number().min(0),
      portee: z.object({ ux: z.number().min(0).max(100), ui: z.number().min(0).max(100) }),
    }),
    integration: z.object({ simple: z.number().min(0), standard: z.number().min(0), complexe: z.number().min(0) }),
    dev: z.object({ pack1: z.number().min(0), pack2: z.number().min(0), pack3: z.number().min(0), pack4: z.number().min(0) }),
    setup: z.object({ cms: setupItem, multilingue: setupItem, hebergement: setupItem, domaine: setupItem }),
    gestion: z.object({
      coefHebdo: z.number().min(0), forfaitCMS: z.number().min(0), forfaitMultilingue: z.number().min(0),
      forfaitHebergement: z.number().min(0), forfaitDomaine: z.number().min(0), urgencePct: z.number().min(0),
    }),
    affinite: z.object({ baisse: z.number().min(0).max(100), hausse: z.number().min(0).max(100) }),
    devisTexts: z.object({
      stackTechnique: z.string(), conditionsReglement: z.string(),
      ceQueCaComprend: z.string(), horsPerimetre: z.string(),
    }),
  }),
  segments: z.record(z.string(), z.object({
    label: z.string(), desc: z.string(), gestionProjet: z.boolean(), note: z.string(),
  })),
});
```

- [ ] **Step 2: Écrire les Actions**

Créer `src/actions/index.ts` :

```ts
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import type { ActionAPIContext } from "astro:actions";
import { calculer } from "../lib/chiffrage/calc";
import { toDevis } from "../lib/chiffrage/toDevis";
import * as store from "../lib/chiffrage/store";
import { catalogueSchema, chiffrageSchema } from "../lib/chiffrage/schemas";
import type { Chiffrage } from "../lib/chiffrage/types";

/* Garde systématique : session Clerk + rôle admin (publicMetadata), même
   contrôle que les pages /espace/chiffrages. Une requête forgée sans le rôle
   est rejetée ici, indépendamment du middleware. */
async function requireAdmin(context: ActionAPIContext): Promise<void> {
  const user = await context.locals.currentUser();
  const role = ((user?.publicMetadata ?? {}) as { role?: string }).role;
  if (!user || role !== "admin") {
    throw new ActionError({ code: "FORBIDDEN", message: "Réservé à l'administrateur." });
  }
}

const SLUG_STRICT = /^[a-z0-9-]+$/;

export const server = {
  chiffrages: {
    sauvegarder: defineAction({
      input: chiffrageSchema,
      handler: async (input, context) => {
        await requireAdmin(context);
        const c = { ...input } as Chiffrage;
        if (c.id) {
          const stored = await store.getChiffrage(c.id);
          if (!stored) throw new ActionError({ code: "NOT_FOUND", message: "Chiffrage introuvable." });
          // l'état de publication et les slugs publiés ne se réécrivent pas depuis le client
          c.publishedKey = stored.publishedKey;
          c.publishedVersions = stored.publishedVersions;
          if (stored.publishedVersions > 0) {
            c.clientSlug = stored.clientSlug;
            c.projetSlug = stored.projetSlug;
          }
        } else {
          c.id = await store.genererId();
          c.publishedKey = null;
          c.publishedVersions = 0;
        }
        await store.saveChiffrage(c as Chiffrage & { id: string });
        return c as Chiffrage & { id: string };
      },
    }),

    publier: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }, context) => {
        await requireAdmin(context);
        const c = await store.getChiffrage(id);
        if (!c) throw new ActionError({ code: "NOT_FOUND", message: "Chiffrage introuvable." });
        if (c.mode !== "configurateur")
          throw new ActionError({ code: "BAD_REQUEST", message: "Le chiffrage libre ne se publie pas." });
        const manques = [
          !c.nom.trim() && "un nom de client/projet",
          !c.objectif.trim() && "l'objectif",
          !SLUG_STRICT.test(c.clientSlug) && "un slug client valide",
          !SLUG_STRICT.test(c.projetSlug) && "un slug projet valide",
          c.prixRetenu == null && "le prix retenu",
        ].filter((m): m is string => Boolean(m));
        if (manques.length)
          throw new ActionError({ code: "BAD_REQUEST", message: `Il manque ${manques.join(", ")}.` });

        const catalogue = await store.getCatalogue();
        const calc = calculer(c, catalogue);
        if (calc.totalJoursProduction <= 0)
          throw new ActionError({ code: "BAD_REQUEST", message: "Ajoute au moins une ligne de production." });

        const data = toDevis(c, catalogue, calc, new Date().toISOString());
        const { url, n } = await store.publierVersion(c as Chiffrage & { id: string }, data);
        c.publishedKey = store.cleDevis(c.clientSlug, c.projetSlug, c.id as string);
        c.publishedVersions = n;
        await store.saveChiffrage(c as Chiffrage & { id: string });
        return { url, version: n };
      },
    }),

    supprimer: defineAction({
      accept: "form",
      input: z.object({ id: z.string() }),
      handler: async ({ id }, context) => {
        await requireAdmin(context);
        await store.deleteChiffrage(id);
        return { ok: true as const };
      },
    }),
  },

  catalogue: {
    sauvegarder: defineAction({
      input: catalogueSchema,
      handler: async (input, context) => {
        await requireAdmin(context);
        await store.saveCatalogue(input);
        return { ok: true as const };
      },
    }),
  },
};
```

NB : si `ActionAPIContext` n'est pas exporté par la version d'Astro installée, typer `context` avec `Parameters<Parameters<typeof defineAction>[0]["handler"]>[1]` ou simplement importer `APIContext` de `astro` — `context.locals.currentUser` reste fourni par `@clerk/astro`.

- [ ] **Step 3: Vérifier build + tests**

Run: `npm test && npm run build`
Expected: tests PASS ; build OK (les Actions sont compilées, la route `/_actions` est générée).

- [ ] **Step 4: Commit**

```bash
git add src/lib/chiffrage/schemas.ts src/actions/
git commit -m "feat(chiffrage): Astro Actions gardées admin (CRUD, publication, catalogue)"
```

---

### Task 7: Intégration Preact + éditeur (configurateur + bloc calcul)

**Files:**
- Modify: `astro.config.mjs`, `package.json`, `tsconfig.json` (via `astro add`)
- Create: `src/components/chiffrage/ChiffrageEditor.tsx`
- Create: `src/components/chiffrage/Configurateur.tsx`
- Create: `src/components/chiffrage/BlocCalcul.tsx`
- Create: `src/pages/espace/chiffrages/nouveau.astro`
- Create: `src/pages/espace/chiffrages/[id].astro`

**Interfaces:**
- Consumes: `calculer`, `fmtEUR`, `fmtJ`, `nouveauChiffrage`, `getCatalogue`, `getChiffrage`, `actions.chiffrages.*`.
- Produces: îlot `<ChiffrageEditor client:load initial={Chiffrage} catalogue={Catalogue} />` ; type partagé interne `SectionProps = { c: Chiffrage; patch: (p: Partial<Chiffrage>) => void; catalogue: Catalogue; calc: CalcResult }` (exporté par `ChiffrageEditor.tsx`, consommé par `Configurateur`, `BlocCalcul`, puis Task 8 par `ModeLibre` et `DevisPreview`).

- [ ] **Step 1: Ajouter Preact**

```bash
npx astro add preact
```

Accepter les modifications proposées (dépendances `@astrojs/preact` + `preact`, intégration dans `astro.config.mjs`, `jsx`/`jsxImportSource` dans `tsconfig.json`). Vérifier ensuite que `astro.config.mjs` contient `preact()` dans `integrations`.

- [ ] **Step 2: Créer l'îlot racine**

Créer `src/components/chiffrage/ChiffrageEditor.tsx` :

```tsx
import { useState } from "preact/hooks";
import { actions } from "astro:actions";
import { calculer } from "../../lib/chiffrage/calc";
import type { Catalogue, Chiffrage } from "../../lib/chiffrage/types";
import type { CalcResult } from "../../lib/chiffrage/calc";
import Configurateur from "./Configurateur";
import BlocCalcul from "./BlocCalcul";

export interface SectionProps {
  c: Chiffrage;
  patch: (p: Partial<Chiffrage>) => void;
  catalogue: Catalogue;
  calc: CalcResult;
}

export default function ChiffrageEditor({ initial, catalogue }: { initial: Chiffrage; catalogue: Catalogue }) {
  const [c, setC] = useState<Chiffrage>(initial);
  const [statut, setStatut] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [urlPubliee, setUrlPubliee] = useState<string | null>(null);
  const patch = (p: Partial<Chiffrage>) => setC((prev) => ({ ...prev, ...p }));
  const calc = calculer(c, catalogue);

  async function sauvegarder(): Promise<string | null> {
    setStatut({ texte: "Enregistrement…" });
    const { data, error } = await actions.chiffrages.sauvegarder(c);
    if (error) { setStatut({ texte: error.message, erreur: true }); return null; }
    if (!c.id) history.replaceState(null, "", `/espace/chiffrages/${data.id}`);
    setC((prev) => ({ ...prev, ...data }));
    setStatut({ texte: "Chiffrage enregistré." });
    return data.id;
  }

  async function publier() {
    const id = await sauvegarder();
    if (!id) return;
    setStatut({ texte: "Publication…" });
    const { data, error } = await actions.chiffrages.publier({ id });
    if (error) { setStatut({ texte: error.message, erreur: true }); return; }
    setC((prev) => ({ ...prev, publishedVersions: data.version }));
    setUrlPubliee(data.url);
    setStatut({ texte: `Version ${data.version} publiée.` });
  }

  return (
    <div class="grid gap-6">
      <p class="label rounded-control bg-surface-subtle px-4 py-2 justify-self-start">
        Tous les montants sont HT — TVA 20 % en supplément
      </p>

      <section class="card grid gap-4">
        <h2>Client / projet</h2>
        <input class="field" placeholder="Nom du client ou du projet" value={c.nom}
          onInput={(e) => patch({ nom: e.currentTarget.value })} />
        <div class="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <div class="grid gap-2">
            <label class="label">Slug client (URL)</label>
            <input class="field" placeholder="atelier-vasseur" value={c.clientSlug}
              disabled={c.publishedVersions > 0}
              onInput={(e) => patch({ clientSlug: e.currentTarget.value })} />
          </div>
          <div class="grid gap-2">
            <label class="label">Slug projet (URL)</label>
            <input class="field" placeholder="refonte-site" value={c.projetSlug}
              disabled={c.publishedVersions > 0}
              onInput={(e) => patch({ projetSlug: e.currentTarget.value })} />
          </div>
        </div>
        {c.publishedVersions > 0 && (
          <p class="text-[13px] text-mute">Slugs figés : ce devis est publié (V{c.publishedVersions}), son URL ne bouge plus.</p>
        )}
        <div class="flex gap-2">
          <button type="button" class={`btn btn-sm ${c.mode === "configurateur" ? "" : "btn-outline"}`}
            onClick={() => patch({ mode: "configurateur" })}>Configurateur</button>
          <button type="button" class={`btn btn-sm ${c.mode === "libre" ? "" : "btn-outline"}`}
            onClick={() => patch({ mode: "libre" })}>Chiffrage libre</button>
        </div>
      </section>

      {c.mode === "configurateur" && <Configurateur c={c} patch={patch} catalogue={catalogue} calc={calc} />}
      {/* Task 8 branche ici <ModeLibre> et <DevisPreview> */}

      <BlocCalcul c={c} patch={patch} catalogue={catalogue} calc={calc} />

      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn" onClick={sauvegarder}>Enregistrer</button>
        {c.mode === "configurateur" && (
          <button type="button" class="btn btn-outline" onClick={publier}>
            Publier{c.publishedVersions > 0 ? ` (V${c.publishedVersions + 1})` : ""}
          </button>
        )}
        {statut && (
          <p class={`text-[13px] font-medium ${statut.erreur ? "text-error" : "text-mute"}`} role="status">
            {statut.texte}
          </p>
        )}
      </div>
      {urlPubliee && (
        <p class="text-[13px]">
          Devis publié : <a class="link" href={urlPubliee} target="_blank" rel="noopener">{urlPubliee}</a>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Créer les sections du configurateur**

Créer `src/components/chiffrage/Configurateur.tsx` :

```tsx
import type { Niveau, Pack, PageLigne } from "../../lib/chiffrage/types";
import { fmtEUR, fmtJ } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

const SUGGESTIONS_DEV: { label: string; level: Pack }[] = [
  { label: "Scénario Make / n8n", level: "pack2" },
  { label: "Connexion API tierce", level: "pack2" },
  { label: "Script JS custom (simulateur, calculateur)", level: "pack3" },
  { label: "Automatisation email / CRM", level: "pack1" },
];

export default function Configurateur({ c, patch, catalogue, calc }: SectionProps) {
  const tjm = catalogue.settings.tjm;
  const majPage = (i: number, p: Partial<PageLigne>) =>
    patch({ pages: c.pages.map((l, j) => (j === i ? { ...l, ...p } : l)) });

  const setups = [
    { key: "setupCms" as const, cat: "cms" as const, label: "Setup CMS" },
    { key: "setupMultilingue" as const, cat: "multilingue" as const, label: "Setup multilingue" },
    { key: "setupHebergement" as const, cat: "hebergement" as const, label: "Setup hébergement" },
    { key: "setupDomaine" as const, cat: "domaine" as const, label: "Setup domaine et DNS" },
  ];

  return (
    <>
      <section class="card grid gap-3">
        <h2>Cible</h2>
        <div class="grid grid-cols-5 gap-2 max-[880px]:grid-cols-2">
          {Object.entries(catalogue.segments).map(([key, s]) => (
            <button type="button"
              class={`rounded-card border p-3 text-left ${c.segment === key ? "border-line-strong bg-surface-subtle" : "border-line"}`}
              onClick={() => patch({ segment: key, gestionProjet: s.gestionProjet })}>
              <span class="block text-[13px] font-bold">{s.label}</span>
              <span class="block text-[12px] text-mute">{s.desc}</span>
            </button>
          ))}
        </div>
        <p class="text-[13px] text-mute">{catalogue.segments[c.segment]?.note}</p>
      </section>

      <section class="card grid gap-3">
        <h2>Pages</h2>
        <p class="text-[13px] text-mute">
          Une ligne par page ; coche ce que tu factures (UX, UI, intégration). Laisser cette
          section vide est normal pour une mission sans pages (automatisation, optimisation
          ponctuelle…) : utilise Développement sur mesure ou Lignes libres.
        </p>
        {c.pages.map((p, i) => (
          <div class="grid grid-cols-[1fr_130px_auto_130px_32px] items-center gap-2 max-[760px]:grid-cols-1">
            <input class="field" placeholder="ex : page accueil" value={p.label}
              onInput={(e) => majPage(i, { label: e.currentTarget.value })} />
            <select class="field" value={p.niveau}
              onChange={(e) => majPage(i, { niveau: e.currentTarget.value as Niveau })}>
              <option value="simple">Simple</option>
              <option value="standard">Standard</option>
              <option value="complexe">Complexe</option>
            </select>
            <div class="flex gap-3 text-[13px]">
              <label class="flex items-center gap-1">
                <input type="checkbox" checked={p.ux} onChange={(e) => majPage(i, { ux: e.currentTarget.checked })} /> UX
              </label>
              <label class="flex items-center gap-1">
                <input type="checkbox" checked={p.ui} onChange={(e) => majPage(i, { ui: e.currentTarget.checked })} /> UI
              </label>
              <label class="flex items-center gap-1">
                <input type="checkbox" checked={p.integ} onChange={(e) => majPage(i, { integ: e.currentTarget.checked })} /> Intégration
              </label>
            </div>
            <span class="text-right font-mono text-[13px] tabular-nums">
              {fmtJ(calc.joursPages[i])} j · {fmtEUR(calc.joursPages[i] * tjm)}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
              onClick={() => patch({ pages: c.pages.filter((_, j) => j !== i) })}>–</button>
          </div>
        ))}
        <button type="button" class="btn btn-outline btn-sm justify-self-start"
          onClick={() => patch({ pages: [...c.pages, { label: "", niveau: "standard", ux: true, ui: true, integ: true }] })}>
          + ajouter une page
        </button>
      </section>

      <section class="card grid gap-3">
        <h2>Développement sur mesure</h2>
        <div class="flex flex-wrap gap-2">
          {SUGGESTIONS_DEV.map((s) => (
            <button type="button" class="btn btn-outline btn-sm"
              onClick={() => patch({ devLines: [...c.devLines, { ...s }] })}>{s.label}</button>
          ))}
        </div>
        {c.devLines.map((l, i) => (
          <div class="grid grid-cols-[1fr_190px_130px_32px] items-center gap-2 max-[720px]:grid-cols-1">
            <input class="field" placeholder="ex : formulaire complexe, API" value={l.label}
              onInput={(e) => patch({ devLines: c.devLines.map((d, j) => (j === i ? { ...d, label: e.currentTarget.value } : d)) })} />
            <select class="field" value={l.level}
              onChange={(e) => patch({ devLines: c.devLines.map((d, j) => (j === i ? { ...d, level: e.currentTarget.value as Pack } : d)) })}>
              <option value="pack1">Pack 1 (1 demi-j)</option>
              <option value="pack2">Pack 2 (2 demi-j)</option>
              <option value="pack3">Pack 3 (3 demi-j)</option>
              <option value="pack4">Pack 4 (4 demi-j)</option>
            </select>
            <span class="text-right font-mono text-[13px] tabular-nums">
              {fmtJ(calc.joursDev[i])} j · {fmtEUR(calc.joursDev[i] * tjm)}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
              onClick={() => patch({ devLines: c.devLines.filter((_, j) => j !== i) })}>–</button>
          </div>
        ))}
        <button type="button" class="btn btn-outline btn-sm justify-self-start"
          onClick={() => patch({ devLines: [...c.devLines, { label: "", level: "pack1" }] })}>
          + ajouter un développement
        </button>
      </section>

      <section class="card grid gap-3">
        <h2>Setup et autres besoins</h2>
        {setups.map(({ key, cat: k, label }) => (
          <label class="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={c[key]} onChange={(e) => patch({ [key]: e.currentTarget.checked } as never)} />
            {label}
            <span class="font-mono text-[12px] text-mute tabular-nums">
              ({fmtJ(catalogue.catalog.setup[k].jours)} j · {fmtEUR(catalogue.catalog.setup[k].jours * tjm)})
            </span>
          </label>
        ))}
        {c.setupMultilingue && (
          <p class="text-[13px] text-warning">
            Poste historiquement sous-estimé : routing i18n, champs CMS dupliqués, sélecteur de
            langue, hreflang, sitemaps localisés, traduction des chaînes d'interface. Vérifie le
            nombre de jours avant de valider.
          </p>
        )}
        <p class="label mt-2">Lignes libres</p>
        {c.autres.map((l, i) => (
          <div class="grid grid-cols-[1fr_110px_110px_32px] items-center gap-2 max-[640px]:grid-cols-1">
            <input class="field" placeholder="ex : formation client, migration de contenus" value={l.label}
              onInput={(e) => patch({ autres: c.autres.map((a, j) => (j === i ? { ...a, label: e.currentTarget.value } : a)) })} />
            <input class="field" type="number" step={0.5} min={0} placeholder="jours" value={l.jours || ""}
              onInput={(e) => patch({ autres: c.autres.map((a, j) => (j === i ? { ...a, jours: Number(e.currentTarget.value) || 0 } : a)) })} />
            <span class="text-right font-mono text-[13px] text-mute tabular-nums">{fmtEUR(l.jours * tjm)}</span>
            <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
              onClick={() => patch({ autres: c.autres.filter((_, j) => j !== i) })}>–</button>
          </div>
        ))}
        <button type="button" class="btn btn-outline btn-sm justify-self-start"
          onClick={() => patch({ autres: [...c.autres, { label: "", jours: 0 }] })}>
          + ajouter une ligne libre
        </button>
      </section>

      <section class="card grid gap-3">
        <h2>Objectif (devis client)</h2>
        <textarea class="field h-auto min-h-[80px] py-3" value={c.objectif}
          placeholder="En une ou deux phrases : ce que ce projet change pour le client, pas ce que tu vas construire techniquement."
          onInput={(e) => patch({ objectif: e.currentTarget.value })} />
      </section>
    </>
  );
}
```

- [ ] **Step 4: Créer le bloc de calcul**

Créer `src/components/chiffrage/BlocCalcul.tsx` :

```tsx
import { fmtEUR, fmtJ } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

export default function BlocCalcul({ c, patch, catalogue, calc }: SectionProps) {
  const g = catalogue.catalog.gestion;
  const libre = c.mode === "libre";
  const affiniteLabel =
    c.affinite === "envie" ? `Affinité : remise ${catalogue.catalog.affinite.baisse} %`
    : c.affinite === "pasenvie" ? `Affinité : majoration ${catalogue.catalog.affinite.hausse} %`
    : "Affinité : neutre";

  return (
    <section class="card grid gap-4 bg-surface-subtle">
      <div class="flex flex-wrap gap-6">
        <div><span class="label">Total jours production</span>
          <p class="font-mono text-[18px] font-bold tabular-nums">{fmtJ(calc.totalJoursProduction)}</p></div>
        <div><span class="label">Sous-total au TJM cible</span>
          <p class="font-mono text-[18px] font-bold tabular-nums">{fmtEUR(calc.sousTotal)}</p></div>
        <div><span class="label">Délai estimé</span>
          <p class="font-mono text-[14px] font-bold tabular-nums">
            {calc.totalJoursProduction > 0
              ? `${fmtJ(calc.semainesTotal)} semaines (${fmtJ(calc.semainesBase)} de production + ${fmtJ(catalogue.settings.semainesMarge)} de marge)`
              : "—"}
          </p></div>
      </div>

      {!libre && (
        <>
          <div class="flex flex-wrap gap-4 border-t border-line pt-4">
            <div class="grid gap-2">
              <label class="label">Affinité avec le client</label>
              <select class="field" value={c.affinite}
                onChange={(e) => patch({ affinite: e.currentTarget.value as typeof c.affinite })}>
                <option value="neutre">Neutre</option>
                <option value="envie">Très envie de bosser avec eux (remise)</option>
                <option value="pasenvie">Pas très envie (majoration)</option>
              </select>
            </div>
            <div class="grid gap-2">
              <label class="label">Marge Coolbeans</label>
              <select class="field" value={String(c.margePct)}
                onChange={(e) => patch({ margePct: Number(e.currentTarget.value) as typeof c.margePct })}>
                <option value="0">0 %</option><option value="10">10 %</option>
                <option value="20">20 %</option><option value="30">30 %</option>
              </select>
            </div>
          </div>

          <div class="border-t border-line pt-4">
            <label class="flex items-center gap-2 text-[13px] font-bold">
              <input type="checkbox" checked={c.gestionProjet}
                onChange={(e) => patch({ gestionProjet: e.currentTarget.checked })} />
              Gestion de projet
            </label>
            <p class="mt-1 text-[13px] text-mute">
              Réunions hebdos jusqu'à la livraison dans les délais du devis, appels sporadiques,
              comptes-rendus, suivi du planning.
            </p>
            {c.gestionProjet && (
              <div class="mt-2 grid gap-1 text-[12px] text-mute">
                {calc.gestion.jours === 0 ? (
                  <p>Ajoute des pages ou du développement (pour estimer un délai), ou coche un setup, pour voir le calcul.</p>
                ) : (
                  <>
                    {calc.gestion.hebdo > 0 && (
                      <p>{fmtJ(calc.semainesTotal)} semaines de suivi à {g.coefHebdo} j = {fmtJ(calc.gestion.hebdo)} j ({fmtEUR(calc.gestion.hebdo * catalogue.settings.tjm)})</p>
                    )}
                    {calc.gestion.cms > 0 && <p>Setup CMS : forfait {fmtJ(calc.gestion.cms)} j ({fmtEUR(calc.gestion.cms * catalogue.settings.tjm)})</p>}
                    {calc.gestion.multilingue > 0 && <p>Setup multilingue : forfait {fmtJ(calc.gestion.multilingue)} j ({fmtEUR(calc.gestion.multilingue * catalogue.settings.tjm)})</p>}
                    {calc.gestion.hebergement > 0 && <p>Setup hébergement : forfait {fmtJ(calc.gestion.hebergement)} j ({fmtEUR(calc.gestion.hebergement * catalogue.settings.tjm)})</p>}
                    {calc.gestion.domaine > 0 && <p>Setup domaine/DNS : forfait {fmtJ(calc.gestion.domaine)} j ({fmtEUR(calc.gestion.domaine * catalogue.settings.tjm)})</p>}
                    <p class="font-bold text-ink">Total gestion de projet : {fmtJ(calc.gestion.jours)} j = {fmtEUR(calc.gestion.montant)}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <label class="flex items-center gap-2 border-t border-line pt-4 text-[13px] font-bold">
            <input type="checkbox" checked={c.urgence} onChange={(e) => patch({ urgence: e.currentTarget.checked })} />
            Projet prioritaire / urgent (+{g.urgencePct} %)
          </label>

          <div class="flex flex-wrap gap-4 border-t border-line pt-4">
            <div class="grid min-w-[220px] flex-1 gap-2">
              <label class="label">Réduction exceptionnelle — nom</label>
              <input class="field" placeholder="ex : geste commercial, budget asso confirmé" value={c.reductionNom}
                onInput={(e) => patch({ reductionNom: e.currentTarget.value })} />
            </div>
            <div class="grid gap-2">
              <label class="label">Montant (€)</label>
              <input class="field w-[130px]" type="number" min={0} value={c.reductionMontant || ""}
                onInput={(e) => patch({ reductionMontant: Number(e.currentTarget.value) || 0 })} />
            </div>
          </div>

          <div class="grid gap-1 border-t border-line pt-4 font-mono text-[13px] tabular-nums">
            <p>Sous-total production : {fmtEUR(calc.sousTotal)}</p>
            <p>{affiniteLabel} → {fmtEUR(calc.ajusteAffinite)}</p>
            {c.gestionProjet && calc.gestion.montant > 0 && <p>Gestion de projet : + {fmtEUR(calc.gestion.montant)}</p>}
            {c.urgence && <p>Urgence (+{g.urgencePct} %) : + {fmtEUR(calc.majorationUrgence)}</p>}
            {c.margePct > 0 && <p>Marge Coolbeans (+{c.margePct} %) : + {fmtEUR(calc.margeMontant)}</p>}
            {c.reductionMontant > 0 && (
              <p>Réduction exceptionnelle{c.reductionNom ? ` (${c.reductionNom})` : ""} : − {fmtEUR(c.reductionMontant)}</p>
            )}
          </div>
        </>
      )}

      <div class="flex flex-wrap items-end gap-6 border-t border-line pt-4">
        <div><span class="label">Prix suggéré (HT)</span>
          <p class="font-mono text-[20px] font-bold tabular-nums">{fmtEUR(calc.totalSuggere)}</p></div>
        <div class="grid min-w-[160px] gap-2">
          <label class="label">Prix devis retenu (HT)</label>
          <input class="field" type="number" min={0} value={c.prixRetenu ?? ""}
            placeholder={String(Math.round(calc.totalSuggere))}
            onInput={(e) => {
              const v = e.currentTarget.value;
              patch({ prixRetenu: v === "" ? null : Number(v) });
            }} />
        </div>
        <div><span class="label">TVA (20 %)</span>
          <p class="font-mono text-[14px] tabular-nums">{fmtEUR(calc.tva)}</p></div>
        <div><span class="label">Total TTC estimé</span>
          <p class="font-mono text-[14px] tabular-nums">{fmtEUR(calc.ttc)}</p></div>
        <div><span class="label">Net après charges et IR (−{catalogue.settings.chargesPct} %)</span>
          <p class="font-mono text-[16px] font-bold tabular-nums">{fmtEUR(calc.net)}</p></div>
      </div>

      {calc.tjmVendu !== null && !libre && (
        <div class={`justify-self-start rounded-card px-4 py-2 font-mono text-[15px] font-bold tabular-nums ${
          calc.tjmVendu >= catalogue.settings.tjm ? "text-success" : "text-error"}`}>
          TJM vendu : {fmtEUR(calc.tjmVendu)} / jour —{" "}
          {calc.tjmVendu >= catalogue.settings.tjm ? "au-dessus" : "en-dessous"} de l'objectif de {fmtEUR(catalogue.settings.tjm)}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Créer les pages de l'éditeur**

Créer `src/pages/espace/chiffrages/nouveau.astro` :

```astro
---
export const prerender = false;

import EspaceLayout from "../../../layouts/EspaceLayout.astro";
import ChiffrageEditor from "../../../components/chiffrage/ChiffrageEditor";
import { getCatalogue } from "../../../lib/chiffrage/store";
import { nouveauChiffrage } from "../../../lib/chiffrage/defaults";

const user = await Astro.locals.currentUser();
const isAdmin = ((user?.publicMetadata ?? {}) as { role?: string }).role === "admin";
if (!isAdmin) return Astro.redirect("/espace");

const catalogue = await getCatalogue();
---

<EspaceLayout title="Nouveau chiffrage">
  <p class="label">Pilotage tarifaire</p>
  <h1>Nouveau chiffrage</h1>
  <p class="sub"><a class="link" href="/espace/chiffrages">← Tous les chiffrages</a></p>
  <ChiffrageEditor client:load initial={nouveauChiffrage(catalogue)} catalogue={catalogue} />
</EspaceLayout>
```

Créer `src/pages/espace/chiffrages/[id].astro` :

```astro
---
export const prerender = false;

import EspaceLayout from "../../../layouts/EspaceLayout.astro";
import ChiffrageEditor from "../../../components/chiffrage/ChiffrageEditor";
import { getCatalogue, getChiffrage } from "../../../lib/chiffrage/store";

const user = await Astro.locals.currentUser();
const isAdmin = ((user?.publicMetadata ?? {}) as { role?: string }).role === "admin";
if (!isAdmin) return Astro.redirect("/espace");

const { id } = Astro.params;
const chiffrage = id ? await getChiffrage(id) : null;
if (!chiffrage) return Astro.redirect("/espace/chiffrages");
const catalogue = await getCatalogue();
---

<EspaceLayout title={`Chiffrage — ${chiffrage.nom || chiffrage.id}`}>
  <p class="label">Pilotage tarifaire</p>
  <h1>{chiffrage.nom || `Chiffrage ${chiffrage.id}`}</h1>
  <p class="sub"><a class="link" href="/espace/chiffrages">← Tous les chiffrages</a></p>
  <ChiffrageEditor client:load initial={chiffrage} catalogue={catalogue} />
</EspaceLayout>
```

- [ ] **Step 6: Vérification manuelle**

Run: `npm run dev`, se connecter avec le compte admin, ouvrir `/espace/chiffrages/nouveau`.
Vérifier : sélection de cible (coche gestion projet + note), ajout/suppression de lignes pages avec recalcul en direct des jours/montants, chips dev, avertissement multilingue, détail de la gestion de projet, ordre des étapes dans le bloc totaux, TJM vendu vert/rouge, « Enregistrer » change l'URL vers `/espace/chiffrages/{id}`, « Publier » renvoie une URL. Vérifier aussi qu'un compte **non admin** (ou déconnecté) est redirigé.

- [ ] **Step 7: Tests + build puis commit**

Run: `npm test && npm run build`
Expected: PASS / build OK.

```bash
git add astro.config.mjs package.json package-lock.json tsconfig.json src/components/chiffrage/ src/pages/espace/chiffrages/
git commit -m "feat(chiffrage): éditeur Preact — configurateur et bloc de calcul"
```

---

### Task 8: Éditeur — aperçu devis client + mode libre

**Files:**
- Create: `src/components/chiffrage/DevisPreview.tsx`
- Create: `src/components/chiffrage/ModeLibre.tsx`
- Modify: `src/components/chiffrage/ChiffrageEditor.tsx` (brancher les deux composants)

**Interfaces:**
- Consumes: `SectionProps` (Task 7), `toDevis`, `fmtEUR`, `fmtJ`.
- Produces: `<DevisPreview />` et `<ModeLibre />` (mêmes props `SectionProps`).

- [ ] **Step 1: Créer l'aperçu devis**

Créer `src/components/chiffrage/DevisPreview.tsx` :

```tsx
import { toDevis } from "../../lib/chiffrage/toDevis";
import { fmtEUR } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

/* Aperçu fidèle au contenu (sections conditionnelles, un seul total) ; la mise
   en forme finale est celle de DevisCorps sur la page publique. */
export default function DevisPreview({ c, catalogue, calc }: SectionProps) {
  let apercu: ReturnType<typeof toDevis> | null = null;
  try {
    apercu = toDevis(
      { ...c, prixRetenu: c.prixRetenu ?? calc.totalSuggere },
      catalogue, calc, new Date().toISOString(),
    );
  } catch {
    apercu = null;
  }

  if (!apercu || (calc.totalJoursProduction <= 0 && !c.objectif.trim())) {
    return (
      <section class="card">
        <h2>Aperçu devis client</h2>
        <p class="mt-2 text-[14px] text-mute">Remplis le configurateur pour voir le devis prendre forme ici.</p>
      </section>
    );
  }

  return (
    <section class="card grid gap-4">
      <h2>Aperçu devis client</h2>
      <div>
        <p class="label">Proposition commerciale</p>
        <p class="text-[18px] font-bold">{apercu.titre || "Sans titre"}</p>
        {apercu.objet && <p class="text-[14px] text-mute">{apercu.objet}</p>}
      </div>
      {apercu.sections.map((s) => (
        <div class="grid grid-cols-[140px_1fr] gap-4 border-t border-line pt-3 max-[640px]:grid-cols-1">
          <p class="label">{s.titre}</p>
          <div class="grid gap-1 text-[14px]">
            {s.texte && <p>{s.texte}</p>}
            {s.liste && s.liste.map((item) => <p>· {item}</p>)}
            {s.budget && (
              <>
                <p class="font-mono text-[18px] font-bold tabular-nums">
                  {fmtEUR(s.budget.lignes[0]?.prix ?? 0)} HT
                </p>
                {s.budget.reglement && <p class="text-mute">{s.budget.reglement}</p>}
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Créer le mode libre**

Créer `src/components/chiffrage/ModeLibre.tsx` :

```tsx
import { fmtEUR, fmtJ } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

export default function ModeLibre({ c, patch, catalogue, calc }: SectionProps) {
  const { tjm, marcheBas, marcheHaut } = catalogue.settings;
  const effectif = calc.tjmEffectif;
  const sousCible = effectif !== null && effectif < tjm;
  const assume = c.strategique && c.raison.trim().length > 0;

  return (
    <section class="card grid gap-3">
      <h2>Chiffrage libre — au temps passé</h2>
      <p class="text-[13px] text-mute">
        Postes libres, sans catalogue. Ce mode ne produit pas de devis client publiable.
      </p>
      {c.postes.map((p, i) => (
        <div class="grid grid-cols-[1fr_110px_110px_32px] items-center gap-2 max-[640px]:grid-cols-1">
          <input class="field" placeholder="ex : wireframes, intégration, migration" value={p.label}
            onInput={(e) => patch({ postes: c.postes.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)) })} />
          <input class="field" type="number" step={0.5} min={0} placeholder="jours" value={p.jours || ""}
            onInput={(e) => patch({ postes: c.postes.map((x, j) => (j === i ? { ...x, jours: Number(e.currentTarget.value) || 0 } : x)) })} />
          <span class="text-right font-mono text-[13px] text-mute tabular-nums">{fmtEUR(p.jours * tjm)}</span>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
            onClick={() => patch({ postes: c.postes.filter((_, j) => j !== i) })}>–</button>
        </div>
      ))}
      <button type="button" class="btn btn-outline btn-sm justify-self-start"
        onClick={() => patch({ postes: [...c.postes, { label: "", jours: 0 }] })}>
        + ajouter un poste
      </button>

      {effectif !== null && (
        <div class="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span class="font-mono text-[16px] font-bold tabular-nums">{fmtEUR(effectif)} / jour effectif</span>
          <span class={`text-[12px] font-bold uppercase ${!sousCible ? "text-success" : assume ? "text-warning" : "text-error"}`}>
            {!sousCible ? "dans ta cible" : assume ? "sous ta cible — remise assumée" : "sous ta cible — non justifié"}
          </span>
          <span class="text-[12px] text-mute">
            {effectif < marcheBas ? "sous le marché" : effectif > marcheHaut ? "au-dessus du marché" : "dans la fourchette marché"}
            {" "}({fmtEUR(marcheBas)}–{fmtEUR(marcheHaut)} / j)
          </span>
        </div>
      )}

      <label class="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={c.strategique}
          onChange={(e) => patch({ strategique: e.currentTarget.checked })} />
        Remise stratégique assumée
      </label>
      {sousCible && (
        <input class="field" placeholder="Raison : ex : réseau local, envie de bosser avec eux" value={c.raison}
          onInput={(e) => patch({ raison: e.currentTarget.value })} />
      )}
    </section>
  );
}
```

- [ ] **Step 3: Brancher dans l'îlot racine**

Dans `src/components/chiffrage/ChiffrageEditor.tsx` :
- ajouter les imports `import ModeLibre from "./ModeLibre";` et `import DevisPreview from "./DevisPreview";`
- remplacer la ligne `{/* Task 8 branche ici <ModeLibre> et <DevisPreview> */}` par :

```tsx
      {c.mode === "libre" && <ModeLibre c={c} patch={patch} catalogue={catalogue} calc={calc} />}
```

- après `<BlocCalcul … />`, ajouter :

```tsx
      {c.mode === "configurateur" && <DevisPreview c={c} patch={patch} catalogue={catalogue} calc={calc} />}
```

- [ ] **Step 4: Vérification manuelle**

Run: `npm run dev`. Sur `/espace/chiffrages/nouveau` :
- l'aperçu reflète en direct : sections qui apparaissent/disparaissent (Pages/Stack absents sans page), libellés client des setups, ligne gestion de projet, planning en semaines, hors périmètre UX/UI nominatif, un seul montant ;
- bascule « Chiffrage libre » : postes, badge cible/marché, champ raison si sous la cible ; le bouton Publier disparaît ;
- aucune mention de jours ni de coefficients dans l'aperçu.

- [ ] **Step 5: Tests + build puis commit**

Run: `npm test && npm run build`
Expected: PASS / build OK.

```bash
git add src/components/chiffrage/
git commit -m "feat(chiffrage): aperçu devis client en direct et mode chiffrage libre"
```

---

### Task 9: Liste, stats, suppression + carte dans l'espace

**Files:**
- Create: `src/pages/espace/chiffrages/index.astro`
- Modify: `src/pages/espace/index.astro:31-39`

**Interfaces:**
- Consumes: `listChiffrages`, `getCatalogue`, `calculer`, `fmtEUR`, `fmtJ`, `actions.chiffrages.supprimer` (form).

- [ ] **Step 1: Créer la page liste**

Créer `src/pages/espace/chiffrages/index.astro` :

```astro
---
export const prerender = false;

import EspaceLayout from "../../../layouts/EspaceLayout.astro";
import { actions } from "astro:actions";
import { getCatalogue, listChiffrages } from "../../../lib/chiffrage/store";
import { calculer } from "../../../lib/chiffrage/calc";
import { fmtEUR, fmtJ } from "../../../lib/chiffrage/format";

const user = await Astro.locals.currentUser();
const isAdmin = ((user?.publicMetadata ?? {}) as { role?: string }).role === "admin";
if (!isAdmin) return Astro.redirect("/espace");

// PRG après suppression (évite la re-soumission au rechargement)
const suppression = Astro.getActionResult(actions.chiffrages.supprimer);
if (suppression && !suppression.error) return Astro.redirect("/espace/chiffrages");

const catalogue = await getCatalogue();
const chiffrages = await listChiffrages();

const lignes = chiffrages
  .map((c) => {
    const r = calculer(c, catalogue);
    const prix = r.prix;
    const jours = r.totalJoursProduction;
    const effectif = r.tjmEffectif;
    const reference = c.mode === "configurateur" ? r.tjmVendu : effectif;
    const sousCible = reference !== null && reference < catalogue.settings.tjm;
    const assume = c.mode === "libre" ? c.strategique : c.affinite === "envie";
    return {
      c, prix, jours, effectif,
      badge: !sousCible ? { texte: "ok", cls: "text-success" }
        : assume ? { texte: "assumé", cls: "text-warning" }
        : { texte: "sous-évalué", cls: "text-error" },
      modeLabel: c.mode === "configurateur" ? (catalogue.segments[c.segment]?.label ?? "Configurateur") : "Libre",
    };
  })
  .sort((a, b) => b.c.date.localeCompare(a.c.date));

const effectifs = lignes.map((l) => l.effectif).filter((v): v is number => v !== null && v > 0);
const tjmMoyen = effectifs.length ? effectifs.reduce((s, v) => s + v, 0) / effectifs.length : 0;
const remises = lignes.filter((l) => (l.c.mode === "libre" ? l.c.strategique : l.c.affinite === "envie")).length;
---

<EspaceLayout title="Chiffrages">
  <p class="label">Pilotage tarifaire</p>
  <h1>Chiffrages</h1>
  <p class="sub">Tous les montants sont HT. <a class="link" href="/espace/chiffrages/reglages">Réglages et catalogue</a></p>

  <div class="mt-6 flex flex-wrap gap-3">
    <a class="btn" href="/espace/chiffrages/nouveau">Nouveau chiffrage</a>
  </div>

  {lignes.length > 0 && (
    <div class="mt-6 grid grid-cols-4 gap-3 max-[720px]:grid-cols-2">
      <div class="card"><span class="label">Chiffrages</span>
        <p class="font-mono text-[20px] font-bold tabular-nums">{lignes.length}</p></div>
      <div class="card"><span class="label">TJM effectif moyen</span>
        <p class="font-mono text-[20px] font-bold tabular-nums">{fmtEUR(tjmMoyen)}</p></div>
      <div class="card"><span class="label">Au tarif plein</span>
        <p class="font-mono text-[20px] font-bold tabular-nums">{lignes.length - remises}</p></div>
      <div class="card"><span class="label">Remise accordée</span>
        <p class="font-mono text-[20px] font-bold tabular-nums">{remises}</p></div>
    </div>
  )}

  {lignes.length === 0 ? (
    <p class="sub mt-8">Aucun chiffrage enregistré pour l'instant.</p>
  ) : (
    <div class="mt-6 overflow-x-auto">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {["Date", "Client / projet", "Mode", "Jours", "Prix HT", "TJM eff.", "Statut", "Publié", ""].map((h) => (
              <th class="label border-b border-line px-2 py-2 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map(({ c, prix, jours, effectif, badge, modeLabel }) => (
            <tr>
              <td class="border-b border-line px-2 py-2 font-mono tabular-nums">{c.date}</td>
              <td class="border-b border-line px-2 py-2">
                <a class="link" href={`/espace/chiffrages/${c.id}`}>{c.nom || `Chiffrage ${c.id}`}</a>
                {c.raison && <div class="text-[12px] text-mute">{c.raison}</div>}
              </td>
              <td class="border-b border-line px-2 py-2 text-mute">{modeLabel}</td>
              <td class="border-b border-line px-2 py-2 font-mono tabular-nums">{fmtJ(jours)}</td>
              <td class="border-b border-line px-2 py-2 font-mono tabular-nums">{fmtEUR(prix)}</td>
              <td class="border-b border-line px-2 py-2 font-mono tabular-nums">{effectif === null ? "—" : fmtEUR(effectif)}</td>
              <td class={`border-b border-line px-2 py-2 text-[11px] font-bold uppercase ${badge.cls}`}>{badge.texte}</td>
              <td class="border-b border-line px-2 py-2">
                {c.publishedVersions > 0 ? (
                  <a class="link" href={`/devis/${c.clientSlug}/${c.projetSlug}-${c.id}`} target="_blank" rel="noopener">
                    V{c.publishedVersions}
                  </a>
                ) : ("—")}
              </td>
              <td class="border-b border-line px-2 py-2">
                <form method="POST" action={actions.chiffrages.supprimer}
                  onsubmit="return confirm('Supprimer ce chiffrage ? Le devis publié, lui, restera en ligne.')">
                  <input type="hidden" name="id" value={c.id} />
                  <button class="btn btn-ghost btn-sm" type="submit">supprimer</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</EspaceLayout>
```

- [ ] **Step 2: Ajouter la carte admin dans l'espace**

Dans `src/pages/espace/index.astro`, à l'intérieur du bloc `{ isAdmin && ( … ) }` existant (celui de la carte `_template`), transformer le fragment pour ajouter une deuxième carte — remplacer :

```astro
    {
      isAdmin && (
        <a class="card" href="/docs/_template">
```

par :

```astro
    {
      isAdmin && (
        <a class="card" href="/espace/chiffrages">
          <div class="k">Interne</div>
          <div class="t">Chiffrages</div>
          <div class="d">Pilotage tarifaire : configurateur, devis publiés, historique.</div>
        </a>
      )
    }
    {
      isAdmin && (
        <a class="card" href="/docs/_template">
```

(la fin du bloc `_template` existant reste inchangée).

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev`. Vérifier : carte « Chiffrages » visible sur `/espace` en admin uniquement ; liste avec stats ; lien d'édition ; lien « V{n} » vers le devis publié ; suppression avec confirmation, retour sur la liste, le devis publié reste accessible.

- [ ] **Step 4: Tests + build puis commit**

Run: `npm test && npm run build`
Expected: PASS / build OK.

```bash
git add src/pages/espace/
git commit -m "feat(chiffrage): liste des chiffrages, stats et suppression dans l'espace"
```

---

### Task 10: Page réglages (catalogue)

**Files:**
- Create: `src/components/chiffrage/CatalogueEditor.tsx`
- Create: `src/pages/espace/chiffrages/reglages.astro`

**Interfaces:**
- Consumes: `Catalogue`, `actions.catalogue.sauvegarder`.

- [ ] **Step 1: Créer l'îlot d'édition du catalogue**

Créer `src/components/chiffrage/CatalogueEditor.tsx` :

```tsx
import { useState } from "preact/hooks";
import { actions } from "astro:actions";
import type { Catalogue } from "../../lib/chiffrage/types";

/* Formulaire contrôlé sur l'objet Catalogue entier, sauvegardé d'un bloc
   (clé KV unique pilotage:catalog). */
export default function CatalogueEditor({ initial }: { initial: Catalogue }) {
  const [cat, setCat] = useState<Catalogue>(initial);
  const [statut, setStatut] = useState<{ texte: string; erreur?: boolean } | null>(null);

  /* maj immuable par chemin, ex. maj("catalog.design.simple", 0.5) */
  const maj = (chemin: string, valeur: unknown) =>
    setCat((prev) => {
      const copie = structuredClone(prev) as unknown as Record<string, unknown>;
      const parts = chemin.split(".");
      let noeud: Record<string, unknown> = copie;
      for (const p of parts.slice(0, -1)) noeud = noeud[p] as Record<string, unknown>;
      noeud[parts.at(-1)!] = valeur;
      return copie as unknown as Catalogue;
    });

  const Num = ({ chemin, label, valeur, step = 0.5 }: { chemin: string; label: string; valeur: number; step?: number }) => (
    <div class="grid gap-2">
      <label class="label">{label}</label>
      <input class="field w-[110px]" type="number" step={step} value={valeur}
        onInput={(e) => maj(chemin, Number(e.currentTarget.value) || 0)} />
    </div>
  );

  async function sauvegarder() {
    setStatut({ texte: "Enregistrement…" });
    const { error } = await actions.catalogue.sauvegarder(cat);
    setStatut(error ? { texte: error.message, erreur: true } : { texte: "Catalogue enregistré." });
  }

  const s = cat.settings;
  const k = cat.catalog;

  return (
    <div class="grid gap-6">
      <section class="card grid gap-4 bg-surface-subtle">
        <h2>Repères généraux</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="settings.tjm" label="TJM cible (€)" valeur={s.tjm} step={10} />
          <Num chemin="settings.demi" label="Demi-journée mini (€)" valeur={s.demi} step={10} />
          <Num chemin="settings.marcheBas" label="Marché bas (€/j)" valeur={s.marcheBas} step={10} />
          <Num chemin="settings.marcheHaut" label="Marché haut (€/j)" valeur={s.marcheHaut} step={10} />
          <Num chemin="settings.joursSemaine" label="Jours dispo / semaine" valeur={s.joursSemaine} />
          <Num chemin="settings.semainesMarge" label="Semaines de marge" valeur={s.semainesMarge} />
          <Num chemin="settings.chargesPct" label="Charges + IR (%)" valeur={s.chargesPct} step={1} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Pages — jours par niveau</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.design.simple" label="Design simple" valeur={k.design.simple} />
          <Num chemin="catalog.design.standard" label="Design standard" valeur={k.design.standard} />
          <Num chemin="catalog.design.complexe" label="Design complexe" valeur={k.design.complexe} />
          <Num chemin="catalog.design.portee.ux" label="UX seul (%)" valeur={k.design.portee.ux} step={5} />
          <Num chemin="catalog.design.portee.ui" label="UI seul (%)" valeur={k.design.portee.ui} step={5} />
        </div>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.integration.simple" label="Intégration simple" valeur={k.integration.simple} />
          <Num chemin="catalog.integration.standard" label="Intégration standard" valeur={k.integration.standard} />
          <Num chemin="catalog.integration.complexe" label="Intégration complexe" valeur={k.integration.complexe} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Développement sur mesure — jours par pack</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.dev.pack1" label="Pack 1 (1 demi-j)" valeur={k.dev.pack1} />
          <Num chemin="catalog.dev.pack2" label="Pack 2 (2 demi-j)" valeur={k.dev.pack2} />
          <Num chemin="catalog.dev.pack3" label="Pack 3 (3 demi-j)" valeur={k.dev.pack3} />
          <Num chemin="catalog.dev.pack4" label="Pack 4 (4 demi-j)" valeur={k.dev.pack4} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Setup — jours et langage client</h2>
        {(["cms", "multilingue", "hebergement", "domaine"] as const).map((key) => (
          <div class="flex flex-wrap items-end gap-4">
            <Num chemin={`catalog.setup.${key}.jours`} label={`${key} (jours)`} valeur={k.setup[key].jours} step={0.25} />
            <div class="grid min-w-[260px] flex-1 gap-2">
              <label class="label">Libellé client</label>
              <input class="field" value={k.setup[key].clientLabel}
                onInput={(e) => maj(`catalog.setup.${key}.clientLabel`, e.currentTarget.value)} />
            </div>
          </div>
        ))}
      </section>

      <section class="card grid gap-4">
        <h2>Gestion de projet, urgence, affinité</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.gestion.coefHebdo" label="Jours de suivi / semaine" valeur={k.gestion.coefHebdo} step={0.05} />
          <Num chemin="catalog.gestion.forfaitCMS" label="Forfait CMS (j)" valeur={k.gestion.forfaitCMS} />
          <Num chemin="catalog.gestion.forfaitMultilingue" label="Forfait multilingue (j)" valeur={k.gestion.forfaitMultilingue} />
          <Num chemin="catalog.gestion.forfaitHebergement" label="Forfait hébergement (j)" valeur={k.gestion.forfaitHebergement} step={0.25} />
          <Num chemin="catalog.gestion.forfaitDomaine" label="Forfait domaine/DNS (j)" valeur={k.gestion.forfaitDomaine} step={0.25} />
          <Num chemin="catalog.gestion.urgencePct" label="Urgence (%)" valeur={k.gestion.urgencePct} step={1} />
          <Num chemin="catalog.affinite.baisse" label="Affinité : remise (%)" valeur={k.affinite.baisse} step={5} />
          <Num chemin="catalog.affinite.hausse" label="Affinité : majoration (%)" valeur={k.affinite.hausse} step={5} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Cibles</h2>
        {Object.entries(cat.segments).map(([key, seg]) => (
          <div class="grid gap-2 border-t border-line pt-3">
            <p class="text-[13px] font-bold">{seg.label}</p>
            <label class="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={seg.gestionProjet}
                onChange={(e) => maj(`segments.${key}.gestionProjet`, e.currentTarget.checked)} />
              Gestion de projet cochée par défaut
            </label>
            <input class="field" value={seg.note} onInput={(e) => maj(`segments.${key}.note`, e.currentTarget.value)} />
          </div>
        ))}
      </section>

      <section class="card grid gap-4">
        <h2>Devis client — textes de base</h2>
        {([
          ["stackTechnique", "Stack technique"],
          ["conditionsReglement", "Conditions de règlement"],
          ["ceQueCaComprend", "Ce que ça comprend (une ligne par item)"],
          ["horsPerimetre", "Hors périmètre (une ligne par item)"],
        ] as const).map(([key, label]) => (
          <div class="grid gap-2">
            <label class="label">{label}</label>
            <textarea class="field h-auto min-h-[90px] py-3" value={k.devisTexts[key]}
              onInput={(e) => maj(`catalog.devisTexts.${key}`, e.currentTarget.value)} />
          </div>
        ))}
      </section>

      <div class="flex items-center gap-3">
        <button type="button" class="btn" onClick={sauvegarder}>Enregistrer le catalogue</button>
        {statut && (
          <p class={`text-[13px] font-medium ${statut.erreur ? "text-error" : "text-mute"}`} role="status">{statut.texte}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer la page réglages**

Créer `src/pages/espace/chiffrages/reglages.astro` :

```astro
---
export const prerender = false;

import EspaceLayout from "../../../layouts/EspaceLayout.astro";
import CatalogueEditor from "../../../components/chiffrage/CatalogueEditor";
import { getCatalogue } from "../../../lib/chiffrage/store";

const user = await Astro.locals.currentUser();
const isAdmin = ((user?.publicMetadata ?? {}) as { role?: string }).role === "admin";
if (!isAdmin) return Astro.redirect("/espace");

const catalogue = await getCatalogue();
---

<EspaceLayout title="Réglages du pilotage tarifaire">
  <p class="label">Pilotage tarifaire</p>
  <h1>Catalogue et réglages</h1>
  <p class="sub">
    Points de départ des calculs, pas des constantes. Modifier le catalogue ne change pas les
    devis déjà publiés (snapshots figés).
    <a class="link" href="/espace/chiffrages">← Tous les chiffrages</a>
  </p>
  <CatalogueEditor client:load initial={catalogue} />
</EspaceLayout>
```

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev`. Modifier le TJM cible → enregistrer → recharger : la valeur persiste ; ouvrir un chiffrage : les montants suivent le nouveau TJM ; un devis déjà publié n'a pas bougé.

- [ ] **Step 4: Tests + build puis commit**

Run: `npm test && npm run build`
Expected: PASS / build OK.

```bash
git add src/components/chiffrage/CatalogueEditor.tsx src/pages/espace/chiffrages/reglages.astro
git commit -m "feat(chiffrage): page réglages du catalogue"
```

---

### Task 11: Formulaire de réponse partagé + page publique versionnée

**Files:**
- Create: `src/components/devis/DevisReponse.astro`
- Modify: `src/pages/devis/[slug].astro:40-230`
- Create: `src/pages/devis/[client]/[projetId].astro`

**Interfaces:**
- Consumes: `getDevisPublieParCle`, `cleDevis` (via clé directe), `DevisCorps` (`d: DevisData`), `BaseLayout` (`noindex`), `GridBackdrop`.
- Produces: `<DevisReponse slug={string} />` (props : `slug` envoyé tel quel à `/api/devis-reponse`).

- [ ] **Step 1: Extraire le formulaire de réponse**

Créer `src/components/devis/DevisReponse.astro` en déplaçant **à l'identique** la section `<!-- RÉPONSE -->` (`<section class="border-t …">` complète) et le `<script>` de fin de `src/pages/devis/[slug].astro`, avec pour seule adaptation :

```astro
---
// Formulaire de réponse au devis (valider / question), partagé entre les devis
// YAML ([slug].astro) et les devis publiés depuis /espace/chiffrages.
import Choicebox from "../ui/Choicebox.astro";

interface Props {
  slug: string; // identifiant envoyé dans l'email via /api/devis-reponse
}
const { slug } = Astro.props;
---
```

…et `data-slug={entry.id}` devient `data-slug={slug}`. Le `<script>` est repris sans modification.

- [ ] **Step 2: Brancher le composant dans la page YAML existante**

Dans `src/pages/devis/[slug].astro` : supprimer la section RÉPONSE et le script, importer `DevisReponse` et rendre à la place :

```astro
<DevisReponse slug={entry.id} />
```

Vérifier sur `/devis/en-haut` (dev) que le formulaire s'affiche et se comporte comme avant (champs facturation masqués tant que « validation » n'est pas choisi).

- [ ] **Step 3: Créer la page publique des devis publiés**

Créer `src/pages/devis/[client]/[projetId].astro` :

```astro
---
// Devis publié depuis /espace/chiffrages : snapshot figé en KV, rendu par le
// même DevisCorps que les devis YAML. Une version affichée à la fois ;
// onglets V1/V2… si republication. Public par lien, jamais indexé.
export const prerender = false;

import BaseLayout from "../../../layouts/BaseLayout.astro";
import GridBackdrop from "../../../components/GridBackdrop.astro";
import DevisCorps from "../../../components/devis/DevisCorps.astro";
import DevisReponse from "../../../components/devis/DevisReponse.astro";
import { getDevisPublieParCle } from "../../../lib/chiffrage/store";
import type { DevisData } from "../../../lib/devis";

const { client, projetId } = Astro.params;
const doc = client && projetId ? await getDevisPublieParCle(`devis:${client}:${projetId}`) : null;
if (!doc || doc.versions.length === 0) return Astro.rewrite("/404");

const nb = doc.versions.length;
const vParam = Number(Astro.url.searchParams.get("v"));
const n = Number.isInteger(vParam) && vParam >= 1 && vParam <= nb ? vParam : nb;
const version = doc.versions[n - 1];

// le snapshot stocke la date en ISO ; la collection attend une Date
const d = { ...version.data, date: new Date(version.data.date) } as unknown as DevisData;
const slugReponse = `${client}/${projetId} (V${n})`;
---

<BaseLayout
  title={`Devis ${d.titre} — Coolbeans`}
  description={`Proposition commerciale : ${d.objet}`}
  noindex
>
  <header class="relative overflow-hidden bg-surface-subtle">
    <GridBackdrop />
    <div class="container-site relative pt-24x pb-16x text-center">
      <p class="label">Proposition commerciale</p>
      <h1 class="mx-auto mt-5 max-w-[18ch]">{d.titre}</h1>
      <p class="mx-auto mt-6 max-w-[46ch] text-xl leading-[1.45] font-medium">{d.objet}</p>
    </div>
  </header>

  {nb > 1 && (
    <nav class="container-site mt-8" aria-label="Versions de la proposition">
      <div class="flex flex-wrap gap-2">
        {doc.versions.map((v) => (
          <a
            href={`?v=${v.n}`}
            aria-current={v.n === n ? "page" : undefined}
            class={`btn btn-sm ${v.n === n ? "" : "btn-outline"}`}
          >
            V{v.n}
          </a>
        ))}
      </div>
      {n < nb && (
        <p class="mt-2 text-[13px] text-mute">
          Version antérieure — <a class="link" href={`?v=${nb}`}>voir la dernière proposition (V{nb})</a>.
        </p>
      )}
    </nav>
  )}

  <div class="container-site">
    <DevisCorps d={d} />
  </div>

  <DevisReponse slug={slugReponse} />
</BaseLayout>
```

- [ ] **Step 4: Vérification manuelle de bout en bout**

Run: `npm run dev`.
1. Créer un chiffrage complet (pages + dev + setup CMS + gestion), prix retenu, publier → ouvrir l'URL retournée **en navigation privée** (déconnecté) : page accessible, contenu client uniquement, meta `noindex` présente dans le source.
2. Modifier le chiffrage (ajouter une page), vérifier que la page publique n'a **pas** bougé ; republier → onglets V1/V2, V2 par défaut, V1 conservée à l'identique.
3. Envoyer une réponse depuis le formulaire → email reçu avec le slug `client/projet-id (V2)`.
4. URL inconnue `/devis/xxx/yyy-0000` → 404.
5. `/devis/en-haut` fonctionne toujours (régression formulaire extrait).

- [ ] **Step 5: Tests + build puis commit**

Run: `npm test && npm run build`
Expected: PASS / build OK.

```bash
git add src/components/devis/ src/pages/devis/
git commit -m "feat(devis): page publique des devis publiés, versions V1/V2, formulaire partagé"
```

---

### Task 12: Vérifications finales

**Files:**
- Aucun nouveau fichier (corrections éventuelles uniquement).

- [ ] **Step 1: Suite complète**

Run: `npm test && npm run build && npm run verify`
Expected: tests PASS, build OK, verify (design system) OK.

- [ ] **Step 2: Revue de sécurité manuelle**

En dev : déconnecté, `GET /espace/chiffrages` → redirection sign-in Clerk ; connecté **non-admin** → redirection `/espace` ; requête directe `POST /_actions/chiffrages.sauvegarder` sans session admin → erreur `FORBIDDEN`. Vérifier qu'aucune donnée interne (jours, coefficients, TJM) n'apparaît dans le HTML source de la page publique `/devis/...`.

- [ ] **Step 3: Relecture des invariants du brief**

Aperçu et page publique : aucun prix par ligne, aucun jour, un seul total HT, sections vides absentes, langage client (« Gestion autonome de vos contenus », jamais « Setup CMS »).

- [ ] **Step 4: Commit final éventuel puis STOP**

```bash
git status   # doit être propre, sinon committer les corrections
```

**S'arrêter ici.** Ne pas merger dans `main`, ne pas pousser. Annoncer à Ludo que la branche `chiffrage` est prête, proposer un passage sur `staging` (staging.coolbeans.cc) pour validation — et attendre son ordre explicite pour toute mise en production.
