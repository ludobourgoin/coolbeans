# Cockpit Devis — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le module chiffrage manuel par un cockpit de suivi des devis, avec un modèle de calcul piloté par le projet Linear, des tooltips sur le rendu devis, la persistance D1 des réponses client, et les mises à jour de la skill `devis`.

**Architecture:** Le projet Linear (issues estimées + bloc Chiffrage en description) est la source de vérité ; la skill dérive le YAML ; le repo garde un modèle de calcul pur et testé (`calc.ts` réécrit), un parseur du bloc Chiffrage, un cockpit lecture seule `/espace/devis`, et l'API réponse écrit en D1 avant de notifier.

**Tech Stack:** Astro 6 + Cloudflare Workers (KV `PORTAL_KV`, D1 `PORTAL_DB`), zod (content collections), vitest, Tailwind sur tokens `global.css`.

**Spec:** `docs/superpowers/specs/2026-08-17-cockpit-devis-design.md`

## Global Constraints

- Branche `staging` uniquement ; jamais de push `main` (prod = ordre explicite de Ludo).
- `git add` sélectif par fichier — jamais `-A` (wip d'autres sessions dans l'arbre).
- Tests : `npx vitest run <fichier>` ; suite complète `npm test` avant chaque commit.
- Convention CSS : utilitaires Tailwind branchés sur les tokens de `global.css` ; pas de `<style>` sauf irréductible.
- Garde admin : reprendre à l'identique la garde des pages `/espace/chiffrages` existantes (frontmatter) et des actions (vérification serveur) — ne jamais l'affaiblir.
- Les chiffres sensibles (TJM, coefficients, affinité) restent dans les Réglages KV — jamais dans la skill publiée ni dans le YAML.
- Champs YAML `envoi`/`linear` : internes, jamais rendus sur la page publique.
- 1 pt Linear = 1 h ; 7 h = 1 jour facturé.

---

### Task 1: Modèle de calcul réécrit (types, défauts, calc)

**Files:**
- Modify: `src/lib/chiffrage/types.ts` (réécriture complète)
- Modify: `src/lib/chiffrage/defaults.ts` (réécriture complète)
- Modify: `src/lib/chiffrage/calc.ts` (réécriture complète)
- Modify: `src/lib/chiffrage/calc.test.ts` (réécriture complète)
- Delete: `src/lib/chiffrage/defaults.test.ts` (testait le catalogue par niveaux)

**Interfaces:**
- Produces: `Reglages`, `ModificateursProjet`, `Reduction`, `Affinite`, `Segment` (types.ts) ; `REGLAGES_DEFAUT` (defaults.ts) ; `calculerDevis(heures: number, mods: ModificateursProjet, r: Reglages): CalcDevis` (calc.ts).

- [ ] **Step 1: Réécrire `types.ts`**

```ts
/* Types métier du chiffrage. Zéro dépendance Astro/DOM : partagés entre
   le cockpit, les Actions serveur, la skill devis (via script) et les tests. */

export type Affinite = "neutre" | "envie" | "pasenvie";

export interface Segment {
  label: string;
  desc: string;
  gestionProjet: boolean;
  note: string;
}

export interface Reglages {
  tjm: number;
  heuresJour: number; // 7 : heures effectives d'un jour facturé
  marcheBas: number;
  marcheHaut: number;
  joursSemaine: number;
  semainesMarge: number;
  chargesPct: number;
  gestionPct: number; // +15 % sur la totalité du projet (jamais hebdo)
  urgencePct: number; // +20 %, affiché au devis en valeur absolue
  affinite: { baisse: number; hausse: number };
  segments: Record<string, Segment>;
  devisTexts: {
    stackTechnique: string;
    conditionsReglement: string;
    ceQueCaComprend: string; // une ligne par item
    horsPerimetre: string; // une ligne par item
    urgenceTooltip: string;
  };
}

export interface Reduction {
  nom: string; // « Remise exceptionnelle », « Tarif association »…
  montant?: number; // € — prioritaire sur pct si les deux sont donnés
  pct?: number;
}

export interface ModificateursProjet {
  segment: string; // clé dans reglages.segments
  affinite: Affinite;
  gestionProjet: boolean;
  urgence: boolean;
  margePct: 0 | 10 | 20 | 30;
  reduction: Reduction | null;
  prixRetenu: number | null; // arrondi commercial final décidé par Ludo
}
```

- [ ] **Step 2: Réécrire `defaults.ts`**

Valeurs reprises de l'ancien `CATALOGUE_DEFAUT` (tjm 600, marché 450/650,
3 j/semaine, 1 semaine de marge, charges 26 %, affinité 20/20, urgence 20,
segments et devisTexts conservés tels quels), corrigées : `gestionPct: 15`
(l'ancien `coefHebdo` était une erreur — la gestion de projet est +15 % du
total, pas hebdomadaire).

```ts
import type { ModificateursProjet, Reglages } from "./types";

export const REGLAGES_DEFAUT: Reglages = {
  tjm: 600,
  heuresJour: 7,
  marcheBas: 450,
  marcheHaut: 650,
  joursSemaine: 3,
  semainesMarge: 1,
  chargesPct: 26,
  gestionPct: 15,
  urgencePct: 20,
  affinite: { baisse: 20, hausse: 20 },
  segments: { /* copier tel quel le bloc segments de l'ancien defaults.ts */ },
  devisTexts: {
    /* copier stackTechnique (en remplaçant le titre implicite : la section
       s'appellera « Stack technique recommandée »), conditionsReglement,
       ceQueCaComprend, horsPerimetre depuis l'ancien defaults.ts, et ajouter : */
    urgenceTooltip:
      "Je vous fais passer en priorité pour répondre à votre deadline (+20 %).",
  },
};

export const MODIFICATEURS_DEFAUT: ModificateursProjet = {
  segment: "tpe",
  affinite: "neutre",
  gestionProjet: false,
  urgence: false,
  margePct: 0,
  reduction: null,
  prixRetenu: null,
};
```

- [ ] **Step 3: Écrire les tests de `calculerDevis` (échec attendu)**

Réécrire `calc.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { calculerDevis } from "./calc";
import { MODIFICATEURS_DEFAUT, REGLAGES_DEFAUT } from "./defaults";

const r = REGLAGES_DEFAUT; // tjm 600, heuresJour 7
const base = (over = {}) => ({ ...MODIFICATEURS_DEFAUT, ...over });

describe("calculerDevis", () => {
  it("plancher = heures/7 × tjm", () => {
    const c = calculerDevis(35, base(), r); // 5 jours
    expect(c.jours).toBe(5);
    expect(c.plancher).toBe(3000);
    expect(c.totalSuggere).toBe(3000);
  });
  it("affinité envie −20 %, pasenvie +20 %", () => {
    expect(calculerDevis(35, base({ affinite: "envie" }), r).totalSuggere).toBe(2400);
    expect(calculerDevis(35, base({ affinite: "pasenvie" }), r).totalSuggere).toBe(3600);
  });
  it("gestion de projet : +15 % du total, pas hebdo", () => {
    const c = calculerDevis(35, base({ gestionProjet: true }), r);
    expect(c.gestionMontant).toBe(450); // 3000 × 15 %
    expect(c.totalSuggere).toBe(3450);
  });
  it("urgence : +20 % exposé en valeur absolue", () => {
    const c = calculerDevis(35, base({ urgence: true }), r);
    expect(c.urgenceMontant).toBe(600);
    expect(c.totalSuggere).toBe(3600);
  });
  it("ordre : affinité → gestion → urgence → marge → réduction", () => {
    const c = calculerDevis(
      35,
      base({ affinite: "envie", gestionProjet: true, urgence: true, margePct: 10,
        reduction: { nom: "Tarif association", pct: 20 } }),
      r,
    );
    // 3000 → 2400 → +360 gestion → +552 urgence → 3312 → +331.2 marge
    // → 3643.2 → −728.64 réduction → 2914.56
    expect(c.totalSuggere).toBeCloseTo(2914.56, 2);
  });
  it("réduction en € prioritaire sur le %", () => {
    const c = calculerDevis(35, base({ reduction: { nom: "Geste", montant: 500, pct: 99 } }), r);
    expect(c.reductionMontant).toBe(500);
  });
  it("prixRetenu écrase le total suggéré", () => {
    expect(calculerDevis(35, base({ prixRetenu: 2800 }), r).prix).toBe(2800);
  });
  it("semaines de planning : jours/joursSemaine arrondi au demi + marge", () => {
    expect(calculerDevis(35, base(), r).semaines).toBe(3); // ceil(5/3×2)/2=2 +1
  });
});
```

- [ ] **Step 4: Run — vérifier l'échec** : `npx vitest run src/lib/chiffrage/calc.test.ts` → FAIL (signature inexistante).

- [ ] **Step 5: Réécrire `calc.ts`**

```ts
import type { ModificateursProjet, Reglages } from "./types";

export interface CalcDevis {
  heures: number;
  jours: number;
  plancher: number; // jours × tjm — plancher interne, jamais le prix
  ajusteAffinite: number;
  gestionMontant: number;
  urgenceMontant: number; // exposé : affiché au devis en valeur absolue
  margeMontant: number;
  sousTotalAvantReduction: number;
  reductionMontant: number;
  totalSuggere: number;
  prix: number; // prixRetenu ?? totalSuggere
  tva: number;
  ttc: number;
  net: number;
  tjmEffectif: number | null;
  semaines: number;
}

export function calculerDevis(
  heures: number,
  mods: ModificateursProjet,
  r: Reglages,
): CalcDevis {
  const jours = heures / r.heuresJour;
  const plancher = jours * r.tjm;

  const ajusteAffinite =
    mods.affinite === "envie" ? plancher * (1 - r.affinite.baisse / 100)
    : mods.affinite === "pasenvie" ? plancher * (1 + r.affinite.hausse / 100)
    : plancher;

  const gestionMontant = mods.gestionProjet ? ajusteAffinite * (r.gestionPct / 100) : 0;
  const avantUrgence = ajusteAffinite + gestionMontant;
  const urgenceMontant = mods.urgence ? avantUrgence * (r.urgencePct / 100) : 0;
  const avantMarge = avantUrgence + urgenceMontant;
  const margeMontant = avantMarge * (mods.margePct / 100);
  const sousTotalAvantReduction = avantMarge + margeMontant;

  const reductionMontant = !mods.reduction
    ? 0
    : (mods.reduction.montant ??
      sousTotalAvantReduction * ((mods.reduction.pct ?? 0) / 100));
  const totalSuggere = Math.max(0, sousTotalAvantReduction - reductionMontant);

  const prix = mods.prixRetenu ?? totalSuggere;
  const semaines =
    jours > 0 ? Math.ceil((jours / r.joursSemaine) * 2) / 2 + r.semainesMarge : 0;

  return {
    heures, jours, plancher, ajusteAffinite, gestionMontant, urgenceMontant,
    margeMontant, sousTotalAvantReduction, reductionMontant, totalSuggere,
    prix, tva: prix * 0.2, ttc: prix * 1.2, net: prix * (1 - r.chargesPct / 100),
    tjmEffectif: jours > 0 ? prix / jours : null, semaines,
  };
}
```

- [ ] **Step 6: Run** : `npx vitest run src/lib/chiffrage/calc.test.ts` → PASS. Supprimer `defaults.test.ts` (`git rm`).
- [ ] **Step 7: Commit** : `git add src/lib/chiffrage/types.ts src/lib/chiffrage/defaults.ts src/lib/chiffrage/calc.ts src/lib/chiffrage/calc.test.ts && git rm src/lib/chiffrage/defaults.test.ts && git commit -m "feat(chiffrage): modèle de calcul piloté par les estimates Linear"`

> La suite compile encore grâce aux anciens exports uniquement là où ils sont
> importés par du code voué à la suppression (Task 8) — vérifier que
> `npm test` ne casse que sur `toDevis.test.ts`/`store.test.ts`, traités en
> Tasks 3 et 8. Ne PAS pousser tant que Task 8 n'est pas passée.

### Task 2: Parseur du bloc Chiffrage

**Files:**
- Create: `src/lib/chiffrage/blocChiffrage.ts`
- Test: `src/lib/chiffrage/blocChiffrage.test.ts`

**Interfaces:**
- Consumes: `ModificateursProjet`, `MODIFICATEURS_DEFAUT` (Task 1).
- Produces: `parseBlocChiffrage(description: string): BlocChiffrage` où `BlocChiffrage = { contact: { nom: string; email: string | null; copies: string[] }; mods: ModificateursProjet; prixCible: string | null; echeancier: string | null; validite: string | null; notes: string | null; present: boolean }`.

- [ ] **Step 1: Tests (échec attendu)**

```ts
import { describe, expect, it } from "vitest";
import { parseBlocChiffrage } from "./blocChiffrage";

const BLOC = `Description du projet…

## Chiffrage
- Contact : Suzanne Salerno <salerno@ms-associes.com> (copie : anja@booxdesign.com)
- Segment : association
- Affinité : envie
- Gestion de projet : non
- Urgence : oui
- Marge : 10
- Réduction : Tarif association · 20%
- Prix cible / budget lead : ~2000 € (annoncé à l'oral)
- Échéancier : 30/40/30
- Validité : 30 jours
- Notes : bilingue en option
`;

describe("parseBlocChiffrage", () => {
  it("parse un bloc complet", () => {
    const b = parseBlocChiffrage(BLOC);
    expect(b.present).toBe(true);
    expect(b.contact).toEqual({
      nom: "Suzanne Salerno",
      email: "salerno@ms-associes.com",
      copies: ["anja@booxdesign.com"],
    });
    expect(b.mods.segment).toBe("association");
    expect(b.mods.affinite).toBe("envie");
    expect(b.mods.gestionProjet).toBe(false);
    expect(b.mods.urgence).toBe(true);
    expect(b.mods.margePct).toBe(10);
    expect(b.mods.reduction).toEqual({ nom: "Tarif association", pct: 20 });
    expect(b.prixCible).toBe("~2000 € (annoncé à l'oral)");
  });
  it("réduction en euros", () => {
    const b = parseBlocChiffrage("## Chiffrage\n- Réduction : Geste commercial · 150 €");
    expect(b.mods.reduction).toEqual({ nom: "Geste commercial", montant: 150 });
  });
  it("bloc absent → present false et défauts", () => {
    const b = parseBlocChiffrage("Un projet sans bloc.");
    expect(b.present).toBe(false);
    expect(b.mods.affinite).toBe("neutre");
    expect(b.contact.email).toBeNull();
  });
  it("champs vides tolérés", () => {
    const b = parseBlocChiffrage("## Chiffrage\n- Segment :\n- Marge : ");
    expect(b.present).toBe(true);
    expect(b.mods.segment).toBe("tpe");
    expect(b.mods.margePct).toBe(0);
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter**

```ts
import { MODIFICATEURS_DEFAUT } from "./defaults";
import type { ModificateursProjet, Reduction } from "./types";

export interface BlocChiffrage {
  contact: { nom: string; email: string | null; copies: string[] };
  mods: ModificateursProjet;
  prixCible: string | null;
  echeancier: string | null;
  validite: string | null;
  notes: string | null;
  present: boolean;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const oui = (v: string) => /^oui/i.test(v.trim());

function parseReduction(v: string): Reduction | null {
  const [nom, valeur] = v.split("·").map((s) => s.trim());
  if (!nom) return null;
  if (!valeur) return { nom };
  const n = parseFloat(valeur.replace(",", "."));
  if (Number.isNaN(n)) return { nom };
  return valeur.includes("%") ? { nom, pct: n } : { nom, montant: n };
}

export function parseBlocChiffrage(description: string): BlocChiffrage {
  const vide: BlocChiffrage = {
    contact: { nom: "", email: null, copies: [] },
    mods: structuredClone(MODIFICATEURS_DEFAUT),
    prixCible: null, echeancier: null, validite: null, notes: null,
    present: false,
  };
  const m = description.match(/^## Chiffrage\s*$([\s\S]*?)(?=^## |\Z)/m);
  if (!m) return vide;

  const b = { ...vide, present: true, mods: structuredClone(MODIFICATEURS_DEFAUT) };
  for (const ligne of m[1].split("\n")) {
    const kv = ligne.match(/^- ([^:]+):(.*)$/);
    if (!kv) continue;
    const cle = kv[1].trim().toLowerCase();
    const v = kv[2].trim();
    if (!v) continue;
    if (cle.startsWith("contact")) {
      const emails = v.match(EMAIL) ?? [];
      b.contact = {
        nom: v.split(/[<(]/)[0].trim(),
        email: emails[0] ?? null,
        copies: emails.slice(1),
      };
    } else if (cle.startsWith("segment")) b.mods.segment = v.toLowerCase();
    else if (cle.startsWith("affinit")) {
      const a = v.toLowerCase();
      if (a === "envie" || a === "pasenvie" || a === "neutre") b.mods.affinite = a;
    } else if (cle.startsWith("gestion")) b.mods.gestionProjet = oui(v);
    else if (cle.startsWith("urgence")) b.mods.urgence = oui(v);
    else if (cle.startsWith("marge")) {
      const n = parseInt(v, 10);
      if ([0, 10, 20, 30].includes(n)) b.mods.margePct = n as 0 | 10 | 20 | 30;
    } else if (cle.startsWith("réduction") || cle.startsWith("reduction"))
      b.mods.reduction = parseReduction(v);
    else if (cle.startsWith("prix cible")) b.prixCible = v;
    else if (cle.startsWith("échéancier") || cle.startsWith("echeancier")) b.echeancier = v;
    else if (cle.startsWith("validité") || cle.startsWith("validite")) b.validite = v;
    else if (cle.startsWith("notes")) b.notes = v;
  }
  return b;
}
```

- [ ] **Step 4: Run** → PASS. (Note : `\Z` n'existe pas en JS — utiliser `(?=^## |$(?![\s\S]))` ; le test le révélera.)
- [ ] **Step 5: Commit** : `git add src/lib/chiffrage/blocChiffrage.ts src/lib/chiffrage/blocChiffrage.test.ts && git commit -m "feat(chiffrage): parseur du bloc Chiffrage des projets Linear"`

### Task 3: Store réduit aux Réglages

**Files:**
- Modify: `src/lib/chiffrage/store.ts` (réécriture)
- Modify: `src/lib/chiffrage/store.test.ts` (réécriture)

**Interfaces:**
- Consumes: `Reglages`, `REGLAGES_DEFAUT` (Task 1) ; interface `KVLike` conservée telle quelle (avec son mock mémoire de test).
- Produces: `getReglages(ns?: KVLike): Promise<Reglages>`, `saveReglages(r: Reglages, ns?: KVLike): Promise<void>`, clé KV `pilotage:reglages`.

- [ ] **Step 1: Réécrire les tests** — `getReglages` rend `REGLAGES_DEFAUT` si la clé est vide ; rend la valeur sauvée après `saveReglages` ; **rétro-compatibilité** : si `pilotage:reglages` est vide mais `pilotage:catalog` existe (ancien format), reprendre `settings.tjm`, `settings.marcheBas/Haut`, `settings.joursSemaine`, `settings.semainesMarge`, `settings.chargesPct`, `catalog.affinite`, `catalog.gestion.urgencePct`, `segments`, `catalog.devisTexts` et compléter avec les défauts (`gestionPct: 15`, `heuresJour: 7`, `urgenceTooltip`). Reprendre le mock KV mémoire du fichier actuel.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Réécrire `store.ts`** : conserver `KVLike` et `kv()` tels quels ; supprimer `DevisPublie`, `cleChiffrage`, `cleDevis` et toutes les fonctions chiffrage/publication ; implémenter `getReglages`/`saveReglages` + la migration lecture seule décrite au Step 1 (l'ancienne clé n'est jamais réécrite ni supprimée ici).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** : `git add src/lib/chiffrage/store.ts src/lib/chiffrage/store.test.ts && git commit -m "feat(chiffrage): store réduit aux Réglages, migration douce depuis pilotage:catalog"`

### Task 4: Schéma YAML étendu + normalisation tooltip

**Files:**
- Modify: `src/content.config.ts:13-74` (collection `devis`)
- Modify: `src/lib/devis.ts`
- Test: `src/lib/devis.test.ts` (création)

**Interfaces:**
- Produces: champs YAML `envoi { date, destinataire }`, `linear { projet?, affaire? }` (internes) ; `liste` accepte `string | { texte, tooltip }` ; `budget.lignes[].tooltip?`, `notes[].tooltip?` ; helper `listeItem(item): { texte: string; tooltip?: string }` (lib/devis.ts).

- [ ] **Step 1: Test du normaliseur (échec attendu)** — `src/lib/devis.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { listeItem } from "./devis";

describe("listeItem", () => {
  it("normalise une chaîne", () => {
    expect(listeItem("Responsive")).toEqual({ texte: "Responsive" });
  });
  it("laisse passer l'objet avec tooltip", () => {
    expect(listeItem({ texte: "Urgence", tooltip: "+20 %" })).toEqual({
      texte: "Urgence", tooltip: "+20 %",
    });
  });
});
```

- [ ] **Step 2: Run** → FAIL. Implémenter dans `lib/devis.ts` :

```ts
export type ListeItem = { texte: string; tooltip?: string };
export const listeItem = (item: string | ListeItem): ListeItem =>
  typeof item === "string" ? { texte: item } : item;
```

- [ ] **Step 3: Étendre le schéma** dans `content.config.ts` :

```ts
liste: z
  .array(z.union([z.string(), z.object({ texte: z.string(), tooltip: z.string() })]))
  .optional(),
// budget.lignes :
lignes: z.array(
  z.object({ label: z.string(), prix: z.number().optional(), tooltip: z.string().optional() }),
),
// notes :
notes: z.array(
  z.object({
    texte: z.string(),
    tooltip: z.string().optional(),
    tone: z.enum(["neutral", "info", "success", "warning", "error"]).default("info"),
  }),
).default([]),
// à la racine du schéma devis, après `contact` — champs INTERNES, jamais rendus :
envoi: z.object({ date: z.coerce.date(), destinataire: z.string() }).optional(),
linear: z.object({ projet: z.string().optional(), affaire: z.string().optional() }).optional(),
```

- [ ] **Step 4: Vérifier** : `npx vitest run src/lib/devis.test.ts` → PASS, puis `npx astro check` (le YAML `en-haut.yaml` existant doit passer sans modification — rétrocompatibilité des unions/optionnels).
- [ ] **Step 5: Commit** : `git add src/content.config.ts src/lib/devis.ts src/lib/devis.test.ts && git commit -m "feat(devis): schéma envoi/linear + tooltips, normaliseur de liste"`

### Task 5: Tooltip UI + rendu DevisCorps

**Files:**
- Create: `src/components/ui/Tooltip.astro`
- Modify: `src/components/devis/DevisCorps.astro:72-81` (liste), `:111-124` (lignes budget), `:233-248` (notes)

**Interfaces:**
- Consumes: `listeItem` (Task 4).
- Produces: `<Tooltip texte="…">` — marqueur ⓘ accessible (focusable, `aria-label`), bulle au survol/focus.

- [ ] **Step 1: Créer `Tooltip.astro`**

```astro
---
/* Marqueur ⓘ + bulle au survol/focus. Sert à alléger le devis : l'explication
   sort du fil principal sans disparaître. Texte brut uniquement. */
interface Props { texte: string }
const { texte } = Astro.props;
---
<span class="group relative inline-block align-baseline">
  <button
    type="button"
    aria-label={`Détail : ${texte}`}
    class="ml-1 inline-flex size-4 items-center justify-center rounded-full border border-line font-mono text-[10px] text-mute transition-colors duration-150 hover:border-ink hover:text-ink focus-visible:border-ink focus-visible:text-ink"
  >i</button>
  <span
    role="tooltip"
    class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[38ch] -translate-x-1/2 rounded-card border border-line bg-surface px-3 py-2 text-[13px] leading-snug text-ink opacity-0 shadow-sm transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
  >{texte}</span>
</span>
```

- [ ] **Step 2: Brancher dans `DevisCorps.astro`** — importer `Tooltip` et `listeItem` ; dans la liste :

```astro
{section.liste.map((brut) => {
  const item = listeItem(brut);
  return (
    <li class="flex items-start gap-3.5">
      <span class="mt-[0.55em] block size-1.5 flex-none bg-ink" aria-hidden="true" />
      <span class="max-w-[58ch]">
        <Fragment set:html={riche(item.texte)} />
        {item.tooltip && <Tooltip texte={item.tooltip} />}
      </span>
    </li>
  );
})}
```

Même motif sur les lignes de budget (`ligne.tooltip` après le `label`) et les
notes (`note.tooltip` en fin de bandeau, à l'intérieur du `<Banner>`).

- [ ] **Step 3: Vérifier** : `npx astro check` puis `npm run build` → OK. Contrôle visuel : ajouter temporairement un `tooltip` dans `en-haut.yaml`, `npm run dev`, vérifier survol/focus desktop + tap mobile (le focus du bouton ouvre la bulle), puis retirer la modification temporaire.
- [ ] **Step 4: Commit** : `git add src/components/ui/Tooltip.astro src/components/devis/DevisCorps.astro && git commit -m "feat(devis): tooltips sur listes, lignes de budget et notes"`

### Task 6: D1 — réponses persistées

**Files:**
- Create: `migrations/0002_devis_reponses.sql`
- Create: `src/lib/devis/reponses.ts`
- Test: `src/lib/devis/reponses.test.ts`
- Modify: `src/pages/api/devis-reponse.ts:106` (insérer l'écriture D1 avant l'envoi Resend)

**Interfaces:**
- Produces: table `devis_reponses` ; `enregistrerReponse(r: NouvelleReponse, d1?: D1Like): Promise<void>` ; `listerReponses(d1?: D1Like): Promise<ReponseDevis[]>` (dernière réponse par slug en premier) ; types `NouvelleReponse { slug, decision: "validation" | "question", message: string | null, prenom, nom, email }`, `ReponseDevis = NouvelleReponse & { id: number; createdAt: string }`.

- [ ] **Step 1: Migration**

```sql
-- 0002_devis_reponses.sql — réponses aux devis publics, lues par le cockpit
CREATE TABLE devis_reponses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('validation', 'question')),
  message TEXT,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_devis_reponses_slug ON devis_reponses (slug, created_at DESC);
```

- [ ] **Step 2: Tests (échec attendu)** — mock D1 mémoire minimal (même esprit que le mock KV de `store.test.ts`) : `enregistrerReponse` insère ; `listerReponses` rend les colonnes camelCase triées par `created_at` décroissant.
- [ ] **Step 3: Implémenter `reponses.ts`** — typage structurel `D1Like` (comme `KVLike`) : `prepare(sql).bind(...).run()` / `.all()`. `db()` lit `env.PORTAL_DB`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Brancher l'API** — dans `devis-reponse.ts`, juste avant le bloc `try` Resend :

```ts
// D1 d'abord : le cockpit lit cette table. Un échec D1 ne bloque jamais la
// notification — le mail reste la garantie de délivrance.
try {
  await enregistrerReponse({
    slug, decision: reponse, message: champ(message) ?? null,
    prenom: prenomClient, nom: nomClient, email: emailClient,
  });
} catch (err) {
  console.error("devis-reponse: écriture D1 échouée", err);
}
```

- [ ] **Step 6: Vérifier** : `npm test` vert, `npm run build` OK. Appliquer la migration en staging : `npx wrangler d1 migrations apply coolbeans-portal-staging --remote`. (Prod : à la mise en prod du chantier, sur ordre.)
- [ ] **Step 7: Commit** : `git add migrations/0002_devis_reponses.sql src/lib/devis/reponses.ts src/lib/devis/reponses.test.ts src/pages/api/devis-reponse.ts && git commit -m "feat(devis): réponses client persistées en D1 avant notification"`

### Task 7: Statut dérivé

**Files:**
- Create: `src/lib/devis/statut.ts`
- Test: `src/lib/devis/statut.test.ts`

**Interfaces:**
- Consumes: `ReponseDevis` (Task 6).
- Produces: `type StatutDevis = "publie" | "envoye" | "repondu"` ; `statutDevis(envoi: { date: Date } | undefined, reponse: ReponseDevis | undefined): StatutDevis` ; `STATUT_LABEL: Record<StatutDevis, string>` (`Publié`, `Envoyé`, `Répondu`).

- [ ] **Step 1: Tests (échec attendu)** — sans envoi ni réponse → `publie` ; envoi seul → `envoye` ; réponse (même sans envoi noté) → `repondu`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** (fonction à 3 branches, réponse prioritaire). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** : `git add src/lib/devis/statut.ts src/lib/devis/statut.test.ts && git commit -m "feat(devis): statut dérivé publié/envoyé/répondu"`

### Task 8: Cockpit /espace/devis, Réglages, redirection, nav, suppressions

**Files:**
- Create: `src/pages/espace/devis/index.astro`, `src/pages/espace/devis/reglages.astro`
- Create: `src/components/chiffrage/ReglagesEditor.tsx` (adapté de `CatalogueEditor.tsx`)
- Modify: `src/pages/espace/chiffrages/index.astro` (redirection), `src/lib/portail/nav.ts:174`, `src/actions/index.ts` (bloc `chiffrages`)
- Delete: `src/pages/espace/chiffrages/nouveau.astro`, `src/pages/espace/chiffrages/[id].astro`, `src/pages/espace/chiffrages/reglages.astro`, `src/pages/devis/[client]/[projetId].astro`, `src/components/chiffrage/{Configurateur,ModeLibre,BlocCalcul,ChiffrageEditor,DevisPreview,CatalogueEditor}.tsx`, `src/lib/chiffrage/toDevis.ts`, `src/lib/chiffrage/toDevis.test.ts`, `src/lib/chiffrage/format.ts` si plus importé
- Test: `src/lib/portail/nav.test.ts` (mise à jour du label attendu si le test le fige)

**Interfaces:**
- Consumes: `getCollection("devis")`, `listerReponses` (Task 6), `statutDevis`/`STATUT_LABEL` (Task 7), `getReglages`/`saveReglages` (Task 3), `totaux`/`eur`/`dateLongue` (lib/devis.ts).

- [ ] **Step 1: Pré-vol KV — devis publiés en circulation ?**

```bash
npx wrangler kv key list --binding PORTAL_KV --remote --prefix "devis:"
```

Si des clés existent : STOP, demander à Ludo si l'un de ces devis a été
envoyé à un client. Oui → conserver `src/pages/devis/[client]/[projetId].astro`
en lecture seule (retirer uniquement toute écriture) et documenter ; non →
suppression complète comme prévu. Les clés `chiffrage:*` se listent de même
et se purgent (`wrangler kv key delete`) une fois la page supprimée.

- [ ] **Step 2: Page cockpit `index.astro`** — reprendre **verbatim** la garde admin du frontmatter de l'actuelle `chiffrages/index.astro` (lignes d'auth/redirect en tête), puis :

```astro
---
/* garde admin copiée de l'ancienne page — inchangée */
import EspaceLayout from "../../../layouts/EspaceLayout.astro";
import { getCollection } from "astro:content";
import { listerReponses } from "../../../lib/devis/reponses";
import { statutDevis, STATUT_LABEL } from "../../../lib/devis/statut";
import { dateLongue, eur, totaux } from "../../../lib/devis";

const devis = (await getCollection("devis")).sort(
  (a, b) => b.data.date.getTime() - a.data.date.getTime(),
);
const reponses = await listerReponses();
const derniereReponse = (slug: string) => reponses.find((r) => r.slug === slug);

const lignes = devis.map((d) => {
  const budget = d.data.sections.find((s) => s.budget)?.budget;
  const reponse = derniereReponse(d.id);
  return {
    slug: d.id,
    titre: d.data.titre,
    objet: d.data.objet,
    date: dateLongue(d.data.date),
    total: budget ? eur.format(totaux(budget).totalFinal) : "—",
    statut: statutDevis(d.data.envoi, reponse),
    reponse,
    urlPublique: `/devis/${d.id}`,
    linear: d.data.linear,
  };
});
---
```

Rendu : tableau sobre (une ligne par devis : titre, objet, date, total,
badge `STATUT_LABEL[statut]`, liens « Devis ↗ » / « Projet Linear ↗ » /
« Affaire CRM ↗ » si présents) + volet réponse (décision, message, contact,
date) sous la ligne quand `reponse` existe. Utilitaires Tailwind sur tokens,
pas de `<style>`. Aucun bouton de création ni d'édition.

- [ ] **Step 3: Page `reglages.astro` + `ReglagesEditor.tsx`** — adapter `CatalogueEditor.tsx` : mêmes patterns (état local, action de sauvegarde), champs limités à `Reglages` (tjm, heuresJour, marché, joursSemaine, semainesMarge, chargesPct, gestionPct, urgencePct, affinité, textes devis, segments). Garde admin identique à l'ancienne `reglages.astro`.
- [ ] **Step 4: Actions** — dans `src/actions/index.ts`, remplacer le bloc `chiffrages` par une seule action `saveReglages` : même garde admin serveur que l'existante (la reprendre verbatim), input validé par un `reglagesSchema` zod ajouté à `src/lib/chiffrage/schemas.ts` (réécrire ce fichier : supprimer `chiffrageSchema`/`catalogueSchema`, créer `reglagesSchema` calqué sur `Reglages`), corps = `saveReglages(input)` (Task 3).
- [ ] **Step 5: Redirection + nav** — `chiffrages/index.astro` réduit à :

```astro
---
export const prerender = false;
return Astro.redirect("/espace/devis", 301);
---
```

`nav.ts:174` : `{ label: "Devis", path: "/devis", flag: "live" }`. Adapter
`nav.test.ts` si le label y est figé.

- [ ] **Step 6: Suppressions** — `git rm` des fichiers listés en tête de tâche (selon verdict du Step 1 pour la route `[client]/[projetId]`). Vérifier qu'aucun import ne subsiste : `grep -rn "toDevis\|Configurateur\|ModeLibre\|BlocCalcul\|ChiffrageEditor\|DevisPreview\|CatalogueEditor" src/`.
- [ ] **Step 7: Vérifier** : `npm test` vert (plus aucun test orphelin), `npx astro check`, `npm run build`, puis `npm run dev` : `/espace/devis` liste `en-haut` avec statut « Publié », `/espace/chiffrages` redirige, Réglages sauvegardent.
- [ ] **Step 8: Commit** : `git add -u src/ && git add src/pages/espace/devis src/components/chiffrage/ReglagesEditor.tsx && git commit -m "feat(espace): cockpit Devis, réglages, suppression du chiffrage manuel"` (le `-u` couvre les suppressions déjà indexées par `git rm` — pas de `-A`).

### Task 9: Docs portail (page Vente + référence technique)

**Files:**
- Modify: `src/content/docs/coolbeans/02-vente.mdx` (réécriture)
- Modify: `src/content/docs/coolbeans/05-chiffrages-et-devis.mdx` (réécriture)

- [ ] **Step 1: `02-vente.mdx` — le workflow Devis de bout en bout.** Structure imposée (h2, conventions du système de doc : `status: "final"`, `updated` du jour) :
  1. **Le pipeline en une image** — lead CRM (carte = affaire, sous-issues = actions) → projet Proposal team client → devis → envoi → réponse.
  2. **Le projet Proposal** — template de projet Linear, issues minimales et sobres estimées par Ludo (1 pt = 1 h), label `Option`, bloc Chiffrage en description (reproduire le gabarit clé:valeur de la spec §3) ; rappel : ce bloc ne s'affiche jamais devant un lead.
  3. **Passe 1 — avant le brief** — skill `devis` en mode dégradé : fourchette + guide de brief client-safe ; poser la fourchette au brief, cordialement conditionner la suite au budget.
  4. **Le brief** — Granola enregistre, le guide sert de fil, rien ne se saisit dans Linear ; trame générique de brief incluse dans la page (questions universelles : objectif business, cible, contenu disponible, existant à migrer, échéance et pourquoi, budget envisagé, décideurs, tiers impliqués).
  5. **Passe 2 — après le brief** — challenge charge ET valeur (plancher interne temps × TJM, prix par la valeur, budget du lead = périmètre ; options V1 cochables vs pistes V2 site), write-back du bloc, génération YAML, validation, envoi Resend, suivi cockpit `/espace/devis`.
- [ ] **Step 2: `05-chiffrages-et-devis.mdx` — référence technique.** Title « Devis : outillage ». Contenu : cockpit (statuts dérivés, sources), Réglages (chaque champ du type `Reglages` expliqué, dont gestionPct 15 % total et urgence affichée en €), schéma YAML (champs publics, champs internes `envoi`/`linear`, tooltips), D1 `devis_reponses`, API réponse (D1 puis mail), pages devis hors sitemap. Retirer tout ce qui décrit le chiffrage manuel supprimé.
- [ ] **Step 3: Vérifier** : `npm run build`, relecture des deux pages en dev.
- [ ] **Step 4: Commit** : `git add src/content/docs/coolbeans/02-vente.mdx src/content/docs/coolbeans/05-chiffrages-et-devis.mdx && git commit -m "docs(coolbeans): workflow Devis en page Vente + référence technique"`

### Task 10: Skill devis + template Linear + synchronisation

**Files:**
- Modify: `~/dev/coolbeans-claude-skills/skills/devis/SKILL.md`
- Modify: `~/dev/coolbeans-claude-skills/skills/devis/references/checklist.md`
- Modify: `~/dev/coolbeans-claude-skills/skills/devis/references/composition.md`

(Repo `coolbeans-claude-skills`, branche `main` — les symlinks `~/.claude/skills/devis` suivent. Aucune valeur chiffrée sensible dans ces fichiers.)

- [ ] **Step 1: `SKILL.md`** — Flux réécrit :
  - Phase 1 : ajouter « lire le bloc Chiffrage de la description du projet et les Réglages (`/espace/devis/reglages`) ».
  - Phase 3 renommée « Challenge + write-back » : (a) questions manquantes en une salve ; (b) **challenge charge et valeur** — pour chaque issue : l'estimate est-il réaliste, et le prix dérivé est-il aligné sur la valeur client (impact, différenciation, prix de marché, demande explicite) ? Signaler sous-facturation (« 15 min de travail, 3× la valeur ») comme sur-facturation, et le total vs budget/fourchette ; la skill argumente, Ludo tranche ; (c) écrire le bloc Chiffrage à jour dans la description du projet Linear (`save_project`). La composition ne lit plus que : issues estimées + bloc Chiffrage + Réglages.
  - Nouveau mode « Passe 1 (pré-brief) » : peu de sources, livrables = fourchette (assumée comme fourchette, via `marcheBas`/`marcheHaut` des Réglages) + guide de brief client-safe (questions spécifiques au lead, jamais affinité/marge/coefficients/plancher).
  - Phase 6 : destinataire = bloc Chiffrage ; après envoi, écrire `envoi: { date, destinataire }` dans le YAML et proposer le commit+push annoncé.
- [ ] **Step 2: `checklist.md`** — chaque item gagne sa colonne source « bloc Chiffrage » en premier recours quand pertinent (contact, remise, marge, urgence, échéancier, validité, prix cible) ; Gmail/CR deviennent le recours pour *remplir* le bloc, plus pour répondre à chaque devis.
- [ ] **Step 3: `composition.md`** — corriger la section Budget : **un montant total unique, lignes de périmètre sans prix ; seules les options affichent leur prix, l'urgence s'affiche en valeur absolue avec tooltip** (champ `tooltip` du schéma) ; section Stack intitulée « Stack technique recommandée » ; notes : arbitrage budget explicite (options V1 cochables, pistes V2 site sans prix ferme) ; calcul : `calculerDevis` de `src/lib/chiffrage/calc.ts` exécutable via `npx tsx` pour ne pas calculer de tête ; ajouter le gabarit du **template de projet Linear** (bloc Chiffrage vide, à créer une fois à la main dans Linear — fournir le texte exact du gabarit de la spec §3).
- [ ] **Step 4: Synchroniser** : commit + push `coolbeans-claude-skills` (message `feat(devis): chiffrage piloté par le bloc Linear, challenge par la valeur, passes 1/2`), puis `cd ~/dev/dotfiles && ./backup.sh` + commit + push.
- [ ] **Step 5: Geste manuel à demander à Ludo** : créer le template de projet « Proposal » dans Linear avec le bloc Chiffrage vide (contenu fourni au Step 3), et vérifier `/espace/devis/reglages` en staging (valeurs migrées).

---

## Self-review

- Spec §2 (deux passes, fourchette, guide brief) → Task 10 ; §3 (bloc, template) → Tasks 2, 10 ; §4 (calcul corrigé, valeur) → Tasks 1, 10 ; §5 (présentation, tooltips, stack recommandée) → Tasks 4, 5, 10 ; §6 (cockpit, D1, statuts, Réglages, YAML) → Tasks 3, 4, 6, 7, 8 ; §7 (suppressions, KV) → Task 8 ; §8 (skill) → Task 10 ; §9 (tests) → Tasks 1, 2, 3, 4, 6, 7 ; §10 (Linear P10) → hors plan, création d'issues via skill linear au lancement ; §11 (docs) → Task 9.
- Types cohérents : `Reglages`/`ModificateursProjet` (T1) consommés par T2/T3/T8 ; `ReponseDevis` (T6) par T7/T8 ; `listeItem` (T4) par T5.
- Pas de push avant la fin de Task 8 (l'arbre ne build pas entre T1 et T8) — commits locaux fréquents, push staging après le vert complet de T8.
