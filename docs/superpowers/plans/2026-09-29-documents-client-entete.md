# Lots 2 et 3 : la nomenclature, l'en-tête partagé et la frise des documents client

> **Pour les agents :** SOUS-SKILL REQUISE : `superpowers:subagent-driven-development` (recommandée) ou `superpowers:executing-plans`, tâche par tâche. Les étapes se suivent en cases à cocher (`- [ ]`).

**But :** chaque document client porte son projet et son étape, et les quatre gabarits partagent un en-tête dont rien ne bouge quand on change d'onglet.

**Architecture :** la logique vit dans des modules purs de `src/lib/documents/`, testés sous Vitest : la table de nomenclature, la vérification de cohérence, le calcul de la frise, les libellés d'onglet, la liste des sections. Un chargeur unique (`charger.ts`) lit les quatre collections, arrête le build si la nomenclature est incohérente, et fournit aux routes de quoi calculer la frise. L'affichage passe par trois composants neufs dans `src/components/documents/` : l'en-tête (zone stable), le volet (zone d'onglet) et la nav des sections. Même remède qu'au lot 1 : `astro:content` est indisponible sous Vitest, donc aucune règle ne reste dans une route.

**Stack :** Astro 7, collections de contenu Zod, Tailwind 4 sur les tokens de `global.css`, Vitest, adaptateur Cloudflare.

**Spec :** `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md`, amendée le 2026-09-29 pour l'étape Audit. Issues : COO-234 (lot 2) et COO-235 (lot 3), menées sur une seule branche par arbitrage du 2026-09-29.

**Worktree :** `~/dev/coolbeans-documents-entete`, branche `feat/documents-entete`, montée depuis `origin/staging`. `.env`, `.dev.vars` et `.wrangler/state` sont copiés. Toutes les commandes partent de cette racine. Serveur de développement sur le port 4336.

## Contraintes globales

- **Rien ne change d'URL dans ce lot**, sauf deux pages de cadrage qui deviennent des onglets de leur racine : `/cadrage/cafa/achat-domaine-4520` et `/cadrage/serial-generations/stack-technique-4417`. Elles redirigent vers leur racine. Les nouvelles adresses sont le lot 4 (COO-236).
- **Aucun slug de fichier ne bouge.** Les lignes D1 `devis_reponses.slug` et `documents.cle_source` portent ces slugs.
- **La table de nomenclature fait autorité** (`src/lib/documents/nomenclature.ts`). Le dossier d'un fichier n'arbitre rien : `osmose` et `serial-generations` ne sont pas des clients.
- **Le nom Linear ne porte pas la jointure.** `projet` relie les documents, `linear.projet` n'est que le titre affiché.
- **Une étape, un document par projet.** Deux documents d'un même projet à la même étape font échouer le build. Deux chapitres d'une même étape partagent une page, en onglets (`versionDe` et `onglet`).
- **L'audit est l'étape 0**, teinte `teal`, affichée seulement si le projet a un document d'audit, quel que soit son statut. Cadrage reste l'étape 1 partout. La collection `audit` arrive avec COO-295 : ce lot prépare la frise, il ne crée pas la collection.
- **Styles :** utilitaires Tailwind sur les tokens de `global.css`. Aucun bloc `<style>` dans un composant neuf, la section F de `scripts/verify-design-system.js` les refuse. Toujours `text-[13px]/[1.4]`, jamais `text-[13px]` seul : les utilitaires `text-*` écrasent la hauteur de ligne héritée.
- **Français :** le hook `relire-francais.mjs` relit `.md`, `.yaml`, `.astro` et `.html`. Dans un `.astro`, un commentaire `{/* */}` du gabarit est de la prose : espace insécable avant « : » et à l'intérieur des guillemets. Le frontmatter, `<script>` et `<style>` sont exclus. Aucun tiret cadratin ni demi-cadratin, nulle part. Si le hook signale une ligne de code, ne pas la « corriger » : le signaler.
- **Aucune publication en production.** La branche se montre en local, puis se fusionne dans `staging` après validation de Ludo.

## Points de vigilance

Ce que la spec implique sans qu'aucun test unitaire ne l'exerce. Chaque ligne a sa vérification dans la tâche 9.

1. **Le formulaire suit l'onglet.** Sur une proposition à deux versions, cliquer V1 puis valider doit envoyer une réponse étiquetée V1. Le script d'onglets unifié ne doit pas perdre ce comportement.
2. **Un lien de la nav des sections mène à la section du volet affiché.** Les volets d'un livrable à deux versions portent les mêmes ancres ; le navigateur irait sinon à celle du volet masqué, et rien ne bougerait.
3. **Le PDF d'une proposition n'imprime ni le filet, ni la frise, ni les onglets, ni la nav.** `DevisEntetePrint` les remplace sur papier.
4. **Répondre au premier chapitre d'un cadrage ne masque pas le formulaire du second.** Aujourd'hui la règle CSS masque tous les `[data-cadrage-formulaire]` de la page.
5. **Un document hors nomenclature s'affiche sans frise**, avec son propre titre en h1, et le build passe.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/documents/etapes.ts` | créé, les six étapes, leur numéro, leur teinte, l'étape habituelle de chaque collection |
| `src/lib/documents/nomenclature.ts` | créé, la table client et projet, les documents hors nomenclature |
| `src/lib/documents/projet.ts` | créé, le type `DocumentProjet` et la vérification de cohérence |
| `src/lib/documents/frise.ts` | créé, le calcul des pastilles d'un document |
| `src/lib/documents/entete.ts` | créé, libellés d'onglet, ligne de date, titre de l'en-tête, regroupement des versions |
| `src/lib/documents/sections.ts` | créé, la liste des sections de chaque gabarit pour la nav |
| `src/lib/documents/charger.ts` | créé, lecture des quatre collections et arrêt du build si incohérence |
| `src/lib/documents/affichage.ts` | modifié, le sélecteur du formulaire à masquer |
| `src/content.config.ts` | modifié, le fragment d'identité commun, `version` et `versionDe` sur `cadrage` |
| `src/content/{cadrage,devis,livrable,temoignage}/**` | modifiés, `projet`, `etape`, `onglet`, `linear.projet` |
| `src/components/documents/DocumentEntete.astro` | créé, barre, filet, zone stable, onglets et leur script |
| `src/components/documents/DocumentFrise.astro` | créé, les pastilles |
| `src/components/documents/DocumentVolet.astro` | créé, la zone d'onglet |
| `src/components/documents/DocumentSections.astro` | créé, la nav des sections et son script |
| `src/components/devis/DevisCorps.astro` | modifié, perd sa nav et son scrollspy |
| `src/components/devis/DocumentTopbar.astro` | modifié, commentaire d'en-tête seulement |
| `src/components/devis/DocumentReponses.astro` | modifié, masque le seul formulaire du document clos |
| `src/components/devis/DevisReponse.astro`, `src/components/livrable/LivrableReponse.astro` | modifiés, `data-suit-onglet` sur le formulaire |
| `src/components/cadrage/CadrageFormulaire.astro` | modifié, plusieurs instances possibles sur une page |
| `src/pages/{cadrage,devis,livrable,temoignage}/[...slug].astro` | modifiés, passent sur l'en-tête partagé |
| `scripts/verify-design-system.js` | modifié, section G étendue aux pastilles |

Le dossier `src/components/documents/` est neuf. `DocumentTopbar` reste dans `devis/`, où il vit déjà, pour ne pas toucher aux imports des autres pages.

---

### Tâche 1 : les étapes et la table de nomenclature

**Fichiers :**
- Créer : `src/lib/documents/etapes.ts`, `src/lib/documents/etapes.test.ts`
- Créer : `src/lib/documents/nomenclature.ts`, `src/lib/documents/nomenclature.test.ts`

**Interfaces :**
- Consomme : rien.
- Produit : `ETAPES`, `type Etape`, `type Teinte`, `interface DefinitionEtape { etape; numero; libelle; teinte }`, `DEFINITIONS`, `type CollectionDocument = "cadrage" | "devis" | "livrable" | "temoignage"`, `ETAPE_HABITUELLE`, `definitionEtape(etape): DefinitionEtape`. Puis `CLIENTS`, `type CleClient`, `PROJETS: Readonly<Record<string, CleClient>>`, `HORS_NOMENCLATURE: readonly string[]` (clés `collection/id`), `FORME_PROJET: RegExp`, `clientDuProjet(projet): CleClient | undefined`.

- [ ] **Étape 1 : installer les dépendances et vérifier le point de départ**

```bash
npm ci
npm test
```

Attendu : tous les tests passent. S'ils ne passent pas avant toute modification, s'arrêter et le signaler.

- [ ] **Étape 2 : écrire les tests des étapes**

Créer `src/lib/documents/etapes.test.ts` :

```ts
import { expect, test } from "vitest";
import { DEFINITIONS, ETAPES, ETAPE_HABITUELLE, definitionEtape } from "./etapes";

test("la frise suit l'ordre des étapes, l'audit en tête", () => {
  expect(DEFINITIONS.map((d) => d.etape)).toEqual([...ETAPES]);
  expect(DEFINITIONS.map((d) => d.numero)).toEqual([0, 1, 2, 3, 4, 5]);
});

test("cadrage reste l'étape 1, l'audit prend le zéro", () => {
  // Arbitrage du 2026-09-29 : le zéro place l'audit avant le cycle sans
  // renuméroter les projets qui n'en ont pas.
  expect(definitionEtape("cadrage").numero).toBe(1);
  expect(definitionEtape("audit").numero).toBe(0);
});

test("chaque étape a sa teinte, et aucune n'est prise deux fois", () => {
  const teintes = DEFINITIONS.map((d) => d.teinte);
  expect(new Set(teintes).size).toBe(teintes.length);
  expect(definitionEtape("audit").teinte).toBe("teal");
});

test("chaque collection a une étape habituelle", () => {
  expect(ETAPE_HABITUELLE).toEqual({
    cadrage: "cadrage",
    devis: "proposition",
    livrable: "livraison",
    temoignage: "suivi",
  });
});
```

- [ ] **Étape 3 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/etapes.test.ts`
Attendu : FAIL, module `./etapes` introuvable.

- [ ] **Étape 4 : écrire `etapes.ts`**

```ts
/* Les étapes d'un projet client, dans l'ordre de la frise (spec 2026-09-22 §2).
 *
 * L'étape est un champ, pas une déduction du gabarit (§3) : les documents de
 * domaine CAFA sont des cadrages servis en production. La collection ne donne
 * que la valeur par défaut.
 *
 * L'audit porte le numéro 0 et ne s'affiche que si le projet en a un
 * (arbitrage du 2026-09-29). Cadrage reste l'étape 1 partout.
 */

export const ETAPES = ["audit", "cadrage", "proposition", "production", "livraison", "suivi"] as const;
export type Etape = (typeof ETAPES)[number];

export type Teinte = "teal" | "amber" | "blue" | "gray" | "green" | "purple";

export interface DefinitionEtape {
  etape: Etape;
  numero: number;
  libelle: string;
  teinte: Teinte;
}

export const DEFINITIONS: readonly DefinitionEtape[] = [
  { etape: "audit", numero: 0, libelle: "Audit", teinte: "teal" },
  { etape: "cadrage", numero: 1, libelle: "Cadrage", teinte: "amber" },
  { etape: "proposition", numero: 2, libelle: "Proposition", teinte: "blue" },
  { etape: "production", numero: 3, libelle: "Production", teinte: "gray" },
  { etape: "livraison", numero: 4, libelle: "Livraison", teinte: "green" },
  { etape: "suivi", numero: 5, libelle: "Suivi", teinte: "purple" },
];

export type CollectionDocument = "cadrage" | "devis" | "livrable" | "temoignage";

/** L'étape d'un document qui ne la déclare pas. */
export const ETAPE_HABITUELLE: Record<CollectionDocument, Etape> = {
  cadrage: "cadrage",
  devis: "proposition",
  livrable: "livraison",
  temoignage: "suivi",
};

export function definitionEtape(etape: Etape): DefinitionEtape {
  const d = DEFINITIONS.find((x) => x.etape === etape);
  if (!d) throw new Error(`étape inconnue : ${etape}`);
  return d;
}
```

- [ ] **Étape 5 : vérifier que le test passe**

Run : `npx vitest run src/lib/documents/etapes.test.ts`
Attendu : PASS, 4 tests.

- [ ] **Étape 6 : écrire les tests de la nomenclature**

Créer `src/lib/documents/nomenclature.test.ts` :

```ts
import { expect, test } from "vitest";
import { CLIENTS, FORME_PROJET, HORS_NOMENCLATURE, PROJETS, clientDuProjet } from "./nomenclature";

test("chaque projet a la forme nom-court-123", () => {
  for (const projet of Object.keys(PROJETS)) expect(projet).toMatch(FORME_PROJET);
});

test("chaque projet appartient à un client de la table", () => {
  for (const cle of Object.values(PROJETS)) expect(Object.keys(CLIENTS)).toContain(cle);
});

test("chaque clé client fait trois lettres minuscules, comme la clé de team Linear", () => {
  for (const cle of Object.keys(CLIENTS)) expect(cle).toMatch(/^[a-z]{3}$/);
});

test("aucun client de la table n'est sans projet", () => {
  const servis = new Set(Object.values(PROJETS));
  for (const cle of Object.keys(CLIENTS)) expect(servis.has(cle as never)).toBe(true);
});

test("le client d'un projet se lit dans la table, jamais dans un nom de dossier", () => {
  expect(clientDuProjet("site-web-879")).toBe("caf");
  expect(clientDuProjet("osmose-281")).toBe("set");
  expect(clientDuProjet("serial-generations-618")).toBe("uni");
});

test("un projet inconnu n'a pas de client, même s'il porte un nom de propriété d'objet", () => {
  expect(clientDuProjet("inconnu-000")).toBeUndefined();
  expect(clientDuProjet("toString")).toBeUndefined();
  expect(clientDuProjet("__proto__")).toBeUndefined();
});

test("les documents hors nomenclature se désignent par collection et id", () => {
  for (const cle of HORS_NOMENCLATURE) expect(cle).toMatch(/^(cadrage|devis|livrable|temoignage)\//);
});
```

- [ ] **Étape 7 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/nomenclature.test.ts`
Attendu : FAIL, module `./nomenclature` introuvable.

- [ ] **Étape 8 : écrire `nomenclature.ts`**

```ts
/* La table de nomenclature client et projet (spec 2026-09-22 §6 et §11, COO-234).
 *
 * Elle fait autorité. Le champ `projet` d'un document doit y figurer, et c'est
 * elle qui dit à quel client il appartient : le dossier du fichier n'arbitre
 * rien, `osmose` et `serial-generations` ne sont pas des clients.
 *
 * Clé client : la clé de la team Linear, en minuscules. Vérifiée le 2026-09-29.
 * Projet : un nom court suivi de trois chiffres. Les trois chiffres reprennent
 * le début de la référence à quatre chiffres de la première proposition du
 * projet, à défaut de son premier document (`reservation-513` vient du cadrage
 * 5138). Une référence par projet, pas par document.
 */

export const CLIENTS = {
  amu: "Amusoire",
  caf: "CAFA",
  fyl: "Fylgo",
  lit: "Little Box",
  mal: "Aurélie Malbec",
  mat: "Mathilde Chevalier",
  mih: "Miharu",
  oid: "Oïde",
  rev: "Revolutions Douces",
  set: "Setencorpsmieux",
  uni: "Université de Montpellier",
  unl: "UnlockBreath",
  vic: "Vice Versa",
} as const;

export type CleClient = keyof typeof CLIENTS;

/** Segment d'URL du projet, référence comprise, vers la clé de son client. */
export const PROJETS: Readonly<Record<string, CleClient>> = {
  "refonte-432": "amu",
  "site-web-879": "caf",
  "boutique-shopify-390": "fyl",
  "site-vitrine-471": "lit",
  "precommande-livre-412": "mal",
  "site-vitrine-618": "mal",
  "refonte-207": "mat",
  "formulaire-brochures-831": "mih",
  "plaquette-agen-723": "mih",
  "boutique-624": "oid",
  "salon-533": "rev",
  "refonte-740": "set",
  "osmose-281": "set",
  "reservation-513": "set",
  "serial-generations-618": "uni",
  "plateforme-327": "unl",
  "page-vitrine-561": "vic",
};

/** Documents sans projet, par choix. Désignés par `collection/id`. */
export const HORS_NOMENCLATURE: readonly string[] = [
  // Pas une cliente (arbitrage du 2026-09-22).
  "cadrage/veronique-berthet/manuscrit-bb-4812",
  "livrable/veronique-berthet/manuscrit-bb-4812",
  // Proposition du projet Linear annulé « Refonte du site En Haut ».
  // L'affaire est rouverte le 2026-09-29 sur un nouveau projet, qui aura sa
  // propre proposition et sa propre référence.
  "devis/en-haut",
];

export const FORME_PROJET = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/;

export function clientDuProjet(projet: string): CleClient | undefined {
  return Object.hasOwn(PROJETS, projet) ? PROJETS[projet] : undefined;
}
```

- [ ] **Étape 9 : vérifier que les tests passent**

Run : `npx vitest run src/lib/documents/`
Attendu : PASS, tous les fichiers du dossier.

- [ ] **Étape 10 : commit**

```bash
git add src/lib/documents/etapes.ts src/lib/documents/etapes.test.ts src/lib/documents/nomenclature.ts src/lib/documents/nomenclature.test.ts
git commit -m "Les étapes d'un projet et la table de nomenclature client"
```

---

### Tâche 2 : la vérification de la nomenclature

**Fichiers :**
- Créer : `src/lib/documents/projet.ts`, `src/lib/documents/projet.test.ts`

**Interfaces :**
- Consomme : `CollectionDocument`, `Etape` (tâche 1), `HORS_NOMENCLATURE`, `clientDuProjet` (tâche 1), `StatutDocument` (`src/lib/documents/statut.ts`, lot 1).
- Produit : `interface DocumentProjet { collection; id; statut; etape; projet?; titreProjet?; versionDe? }`, `cle(d): string` (`collection/id`), `verifierNomenclature(documents, horsNomenclature?): string[]`. Une liste vide veut dire cohérent.

- [ ] **Étape 1 : écrire les tests**

Créer `src/lib/documents/projet.test.ts` :

```ts
import { expect, test } from "vitest";
import { verifierNomenclature, type DocumentProjet } from "./projet";

/** Un document réduit à ce que la vérification lit. */
const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  ...p,
});

const cafa = [
  doc({ collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", versionDe: "cafa/site-web-8791" }),
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  doc({ collection: "cadrage", id: "cafa/achat-domaine-4520", etape: "cadrage", versionDe: "cafa/nom-de-domaine-9042" }),
];

test("un projet cohérent ne produit aucune erreur", () => {
  expect(verifierNomenclature(cafa, [])).toEqual([]);
});

test("une version hérite du projet de sa racine et n'a pas à le porter", () => {
  // achat-domaine n'a ni projet ni étape à elle : son étape par défaut
  // (cadrage) ne compte pas, seule la racine en a une.
  expect(verifierNomenclature(cafa, [])).toEqual([]);
});

test("une racine sans projet est une erreur, sauf si elle est hors nomenclature", () => {
  const seule = [doc({ collection: "devis", id: "en-haut" })];
  expect(verifierNomenclature(seule, [])).toEqual(["devis/en-haut : aucun projet, et absent de HORS_NOMENCLATURE"]);
  expect(verifierNomenclature(seule, ["devis/en-haut"])).toEqual([]);
});

test("un projet absent de la table est une erreur", () => {
  const faux = [doc({ collection: "devis", id: "x/y-1234", projet: "inconnu-123", titreProjet: "Y" })];
  expect(verifierNomenclature(faux, [])).toEqual(["devis/x/y-1234 : projet « inconnu-123 » absent de la table de nomenclature"]);
});

test("deux documents d'un projet à la même étape font échouer le build", () => {
  const doublon = [
    ...cafa,
    doc({ collection: "cadrage", id: "cafa/autre-1111", etape: "production", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  ];
  expect(verifierNomenclature(doublon, [])).toEqual([
    "projet site-web-879 : 2 documents à l'étape production (cadrage/cafa/nom-de-domaine-9042, cadrage/cafa/autre-1111)",
  ]);
});

test("les documents d'un projet affichent tous le même nom Linear", () => {
  const diverge = [...cafa.slice(0, 2), { ...cafa[2], titreProjet: "Site web du CAFA" }];
  expect(verifierNomenclature(diverge, [])).toEqual([
    "projet site-web-879 : linear.projet diverge (« Site web CAFA », « Site web du CAFA »)",
  ]);
});

test("une racine rattachée à un projet doit porter son nom Linear", () => {
  const sansTitre = [doc({ collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" })];
  expect(verifierNomenclature(sansTitre, [])).toEqual(["devis/cafa/site-web-8791 : linear.projet manquant"]);
});

test("une version qui désigne une racine absente est une erreur", () => {
  const orpheline = [doc({ collection: "devis", id: "cafa/site-web-v3-9999", versionDe: "cafa/disparu-0000" })];
  expect(verifierNomenclature(orpheline, [])).toEqual([
    "devis/cafa/site-web-v3-9999 : versionDe « cafa/disparu-0000 » ne désigne aucune racine de devis",
  ]);
});

test("le statut ne compte pas : une trame occupe son étape comme un document publié", () => {
  const trame = [
    ...cafa,
    doc({ collection: "temoignage", id: "cafa/site-web-0001", etape: "suivi", statut: "trame", projet: "site-web-879", titreProjet: "Site web CAFA" }),
  ];
  expect(verifierNomenclature(trame, [])).toEqual([]);
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/projet.test.ts`
Attendu : FAIL, module `./projet` introuvable.

- [ ] **Étape 3 : écrire `projet.ts`**

```ts
/* Ce que la frise et la vérification lisent d'un document, toutes
 * collections confondues, et la vérification de cohérence qui arrête le
 * build (spec 2026-09-22 §4 : « vérifiable au build »).
 *
 * Une racine porte le projet et l'étape. Une version (`versionDe`) en hérite :
 * son propre `etape`, posé par défaut par le schéma, ne compte pas.
 */
import type { CollectionDocument, Etape } from "./etapes";
import { HORS_NOMENCLATURE, clientDuProjet } from "./nomenclature";
import type { StatutDocument } from "./statut";

export interface DocumentProjet {
  collection: CollectionDocument;
  id: string;
  statut: StatutDocument;
  etape: Etape;
  projet?: string;
  /** `linear.projet`, le titre affiché en h1. */
  titreProjet?: string;
  versionDe?: string;
}

export const cle = (d: Pick<DocumentProjet, "collection" | "id">) => `${d.collection}/${d.id}`;

/** Les incohérences de la nomenclature. Une liste vide veut dire cohérent. */
export function verifierNomenclature(
  documents: DocumentProjet[],
  horsNomenclature: readonly string[] = HORS_NOMENCLATURE,
): string[] {
  const erreurs: string[] = [];
  const racines = documents.filter((d) => !d.versionDe);

  for (const v of documents.filter((d) => d.versionDe)) {
    const racine = racines.find((r) => r.collection === v.collection && r.id === v.versionDe);
    if (!racine) erreurs.push(`${cle(v)} : versionDe « ${v.versionDe} » ne désigne aucune racine de ${v.collection}`);
  }

  const parProjet = new Map<string, DocumentProjet[]>();
  for (const r of racines) {
    if (!r.projet) {
      if (!horsNomenclature.includes(cle(r))) erreurs.push(`${cle(r)} : aucun projet, et absent de HORS_NOMENCLATURE`);
      continue;
    }
    if (!clientDuProjet(r.projet)) erreurs.push(`${cle(r)} : projet « ${r.projet} » absent de la table de nomenclature`);
    if (!r.titreProjet) erreurs.push(`${cle(r)} : linear.projet manquant`);
    parProjet.set(r.projet, [...(parProjet.get(r.projet) ?? []), r]);
  }

  for (const [projet, docs] of parProjet) {
    const parEtape = new Map<Etape, string[]>();
    for (const d of docs) parEtape.set(d.etape, [...(parEtape.get(d.etape) ?? []), cle(d)]);
    for (const [etape, cles] of parEtape) {
      if (cles.length > 1) erreurs.push(`projet ${projet} : ${cles.length} documents à l'étape ${etape} (${cles.join(", ")})`);
    }
    const titres = [...new Set(docs.map((d) => d.titreProjet).filter((t): t is string => !!t))];
    if (titres.length > 1) {
      erreurs.push(`projet ${projet} : linear.projet diverge (${titres.map((t) => `« ${t} »`).join(", ")})`);
    }
  }

  return erreurs;
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

Run : `npx vitest run src/lib/documents/projet.test.ts`
Attendu : PASS, 9 tests. Si le test « deux documents à la même étape » échoue sur l'ordre des clés, c'est l'ordre d'insertion qui compte : `cafa` d'abord, le doublon ensuite.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/documents/projet.ts src/lib/documents/projet.test.ts
git commit -m "La nomenclature des documents client se vérifie au build"
```

---

### Tâche 3 : le schéma, les 36 documents et le chargeur

Le cœur de COO-234. Le chargeur branché d'abord fait échouer le build sur chaque racine sans projet : c'est le test rouge. Les données le font passer au vert.

**Fichiers :**
- Modifier : `src/content.config.ts`
- Créer : `src/lib/documents/charger.ts`
- Modifier : les quatre routes `src/pages/{cadrage,devis,livrable,temoignage}/[...slug].astro` (une ligne chacune)
- Modifier : les fichiers de contenu listés à l'étape 5

**Interfaces :**
- Consomme : `ETAPES`, `Etape`, `CollectionDocument` (tâche 1), `FORME_PROJET` (tâche 1), `verifierNomenclature`, `DocumentProjet` (tâche 2).
- Produit : sur chaque entrée des quatre collections, `data.statut`, `data.projet?`, `data.etape` (toujours défini, défaut de la collection), `data.onglet?`. Sur `cadrage`, en plus : `data.version` (défaut 1) et `data.versionDe?`. Et `chargerDocuments(): Promise<DocumentProjet[]>`, qui lève une erreur listant les incohérences.

- [ ] **Étape 1 : le fragment d'identité dans le schéma**

Dans `src/content.config.ts`, ajouter après les imports existants :

```ts
import { ETAPES, type Etape } from "./lib/documents/etapes";
import { FORME_PROJET } from "./lib/documents/nomenclature";

/* L'identité d'un document client, commune aux quatre collections (spec
   2026-09-22 §3, §4, §7 et §10).

   `statut`  les trois états. `trame` : coquille créée avec le projet, jamais
             servie. `brouillon` : texte en cours. `publie` : servi en
             production, listé dans le portail. Les deux premiers se
             comportent pareil côté client. Défaut `publie` : les documents
             d'avant ce champ n'en portent pas, et tout autre défaut les
             retirerait tous de la production.
   `projet`  la jointure entre les documents d'un même projet, valant le
             segment d'URL du projet (« site-web-879 »). Doit figurer dans
             lib/documents/nomenclature.ts, vérifié au build par
             lib/documents/charger.ts. Porté par les racines : une version
             hérite de sa racine.
   `etape`   le moment du projet, pas le gabarit. Défaut : l'étape habituelle
             de la collection.
   `onglet`  libellé de l'onglet quand deux documents partagent une page sans
             être deux versions l'un de l'autre. Absent, l'onglet affiche
             « V2 · 22 sept. 2026 ». */
const identiteDocument = (etape: Etape) => ({
  statut: z.enum(["trame", "brouillon", "publie"]).default("publie"),
  projet: z.string().regex(FORME_PROJET).optional(),
  etape: z.enum(ETAPES).default(etape),
  onglet: z.string().optional(),
});
```

Puis, dans chacune des quatre collections, remplacer le bloc de commentaire `/* Les trois états d'un document (spec 2026-09-22 §10) : ... */` ET la ligne `statut: z.enum(["trame", "brouillon", "publie"]).default("publie"),` qui le suit par une seule ligne :

| Collection | Ligne de remplacement |
|---|---|
| `devis` | `...identiteDocument("proposition"),` |
| `livrable` | `...identiteDocument("livraison"),` |
| `cadrage` | `...identiteDocument("cadrage"),` |
| `temoignage` | `...identiteDocument("suivi"),` |

Dans `cadrage` seulement, ajouter juste après `...identiteDocument("cadrage"),` :

```ts
    /* Deux documents de cadrage peuvent partager une page, en onglets : les
       deux documents de domaine CAFA, choisir le nom puis l'acheter (spec §7).
       Même mécanique que les versions du devis : `versionDe` porte l'id de la
       racine, qui garde seule une URL, `version` ordonne les onglets. */
    version: z.number().int().min(1).default(1),
    versionDe: z.string().optional(),
```

- [ ] **Étape 2 : vérifier que le build passe encore**

```bash
npm run build
```

Attendu : succès. Aucun fichier de contenu n'a encore bougé, les défauts couvrent tout.

- [ ] **Étape 3 : écrire le chargeur et le brancher (le test rouge)**

Créer `src/lib/documents/charger.ts` :

```ts
/* Charge les documents des quatre collections sous la forme que lisent la
   frise et la vérification, et arrête le build si la nomenclature est
   incohérente. Non testé sous Vitest, où `astro:content` est indisponible :
   toute la logique vit dans projet.ts et frise.ts. COO-295 ajoutera ici la
   collection `audit`. */
import { getCollection } from "astro:content";
import type { CollectionDocument } from "./etapes";
import { verifierNomenclature, type DocumentProjet } from "./projet";

const COLLECTIONS: CollectionDocument[] = ["cadrage", "devis", "livrable", "temoignage"];

export async function chargerDocuments(): Promise<DocumentProjet[]> {
  const parCollection = await Promise.all(
    COLLECTIONS.map(async (collection) =>
      (await getCollection(collection)).map(
        (e): DocumentProjet => ({
          collection,
          id: e.id,
          statut: e.data.statut,
          etape: e.data.etape,
          projet: e.data.projet,
          titreProjet: e.data.linear?.projet,
          versionDe: "versionDe" in e.data ? e.data.versionDe : undefined,
        }),
      ),
    ),
  );
  const documents = parCollection.flat();
  const erreurs = verifierNomenclature(documents);
  if (erreurs.length > 0) {
    throw new Error(`Nomenclature des documents client incohérente :\n- ${erreurs.join("\n- ")}`);
  }
  return documents;
}
```

Dans chacune des quatre routes, ajouter l'import `import { chargerDocuments } from "../../lib/documents/charger";` et, en première ligne du corps de `getStaticPaths()` :

```ts
  /* Arrête le build si la nomenclature est incohérente (lib/documents/projet.ts). */
  await chargerDocuments();
```

Run : `npm run build`
Attendu : ÉCHEC, avec un message « Nomenclature des documents client incohérente » qui liste les racines sans projet. C'est le test rouge.

- [ ] **Étape 4 : vérifier la liste des erreurs**

Le message doit citer 26 racines « aucun projet » (les 29 racines actuelles moins les trois de `HORS_NOMENCLATURE`), et aucune autre erreur. À ce stade, aucun cadrage ne porte encore `versionDe`. Si une racine de `HORS_NOMENCLATURE` y figure, l'id est mal écrit dans la table : corriger la table, pas le fichier.

- [ ] **Étape 5 : poser les champs sur les documents**

Règles d'écriture :
- `projet`, `etape` et `onglet` sont des clés de premier niveau, posées juste après la ligne `date:`.
- `version` et `versionDe`, sur les deux chapitres de cadrage, se posent au même endroit.
- `linear.projet` est la clé `projet:` imbriquée sous `linear:`. Ne pas la confondre avec la clé de premier niveau. Si `linear:` n'a pas de `projet`, l'ajouter en première ligne du bloc.
- `etape` s'écrit sur toutes les racines de la table, même quand il vaut le défaut : COO-234 exige que chaque racine le porte.
- Ne rien toucher d'autre dans ces fichiers.

| Fichier (sous `src/content/`) | `projet` | `etape` | `linear.projet` | Autres champs |
|---|---|---|---|---|
| `cadrage/aurelie-malbec/precommande-livre-6284.yaml` | `precommande-livre-412` | `cadrage` | ajouter `Précommande du livre` | |
| `cadrage/cafa/nom-de-domaine-9042.yaml` | `site-web-879` | `production` | inchangé | `onglet: Choisir le nom` |
| `cadrage/cafa/achat-domaine-4520.yaml` | aucun | aucun | inchangé | `version: 2`, `versionDe: cafa/nom-de-domaine-9042`, `onglet: Acheter le nom`, voir la note 1 |
| `cadrage/serial-generations/site-web-3720.yaml` | `serial-generations-618` | `cadrage` | ajouter `Sérial Générations` | `onglet: Le site` |
| `cadrage/serial-generations/stack-technique-4417.yaml` | aucun | aucun | inchangé | `version: 2`, `versionDe: serial-generations/site-web-3720`, `onglet: WordPress ou pas` |
| `cadrage/setencorpsmieux/reservation-en-ligne-5138.yaml` | `reservation-513` | `cadrage` | `Réservation en ligne des cours` | |
| `devis/amusoire/refonte-4325.yaml` | `refonte-432` | `proposition` | inchangé | |
| `devis/aurelie-malbec/precommande-livre-4127.yaml` | `precommande-livre-412` | `proposition` | inchangé | |
| `devis/aurelie-malbec/site-vitrine-6183.yaml` | `site-vitrine-618` | `proposition` | inchangé | |
| `devis/cafa/site-web-8791.yaml` | `site-web-879` | `proposition` | inchangé | |
| `devis/danae/page-vitrine-5619.yaml` | `page-vitrine-561` | `proposition` | `Page vitrine Vice Versa` (remplace l'URL) | |
| `devis/danae/page-vitrine-v2-7203.yaml` | aucun | aucun | `Page vitrine Vice Versa` (remplace l'URL) | |
| `devis/danae/page-vitrine-v3-8452.yaml` | aucun | aucun | `Page vitrine Vice Versa` (remplace l'URL) | |
| `devis/fylgo/boutique-shopify-3907.yaml` | `boutique-shopify-390` | `proposition` | inchangé | |
| `devis/littlebox/site-vitrine-4712.yaml` | `site-vitrine-471` | `proposition` | `Site vitrine LittleBox` (remplace l'URL) | |
| `devis/mathilde-chevalier/refonte-astro-2071.yaml` | `refonte-207` | `proposition` | `Refonte du site de Mathilde Chevalier` | |
| `devis/miharu/formulaire-brochures-8314.yaml` | `formulaire-brochures-831` | `proposition` | `Formulaire avant téléchargement des brochures` (remplace l'URL) | |
| `devis/miharu/plaquette-agen-7231.yaml` | `plaquette-agen-723` | `proposition` | `Plaquette commerciale sur les LP Agen` (remplace l'URL) | |
| `devis/oide/integration-webflow-shopify-6248.yaml` | `boutique-624` | `proposition` | `Boutique Shopify du site Oïde` | |
| `devis/osmose/identite-et-site-2814.yaml` | `osmose-281` | `proposition` | inchangé | |
| `devis/revolutions-douces/salon-2026-5336.yaml` | `salon-533` | `proposition` | `Site du salon, édition 2026` (remplace l'URL) | |
| `devis/serial-generations/site-web-6184.yaml` | `serial-generations-618` | `proposition` | inchangé | |
| `devis/setencorpsmieux/site-internet-7402.yaml` | `refonte-740` | `proposition` | `Refonte du site Sète En Corps Mieux` | |
| `devis/unlockbreath/plateforme-3271.yaml` | `plateforme-327` | `proposition` | inchangé | |
| `livrable/cafa/site-web-8791.yaml` | `site-web-879` | `livraison` | inchangé | |
| `livrable/fylgo/boutique-shopify-3907.yaml` | `boutique-shopify-390` | `livraison` | inchangé | |
| `livrable/revolutions-douces/sites-relais-5336.yaml` | `salon-533` | `production` | `Site du salon, édition 2026` (remplace l'URL) | |
| `temoignage/amusoire/refonte-site-0040.yaml` | `refonte-432` | `suivi` | `Refonte Webflow et intégration technique` | |

Aucun changement sur : les versions `devis/cafa/site-web-v2-4106`, `devis/osmose/site-v2-5127`, `devis/serial-generations/site-web-v2-3862`, `devis/unlockbreath/plateforme-v2-5840`, `livrable/cafa/site-web-v2-6317`, et les trois documents hors nomenclature (`devis/en-haut`, les deux `veronique-berthet`).

Les noms Linear de la colonne `linear.projet` sont ceux du 2026-09-29, après la salve de renommage validée par Ludo. Ils existent tous dans Linear.

**Note 1.** L'en-tête de `cadrage/cafa/achat-domaine-4520.yaml` affirme que ce document n'est pas une V2 et que la collection ne porte pas `versionDe`. Remplacer ses deux dernières phrases (à partir de « Ce document n'est pas une V2 ») par :

```yaml
# Second chapitre du cadrage nom-de-domaine-9042 : il partage sa page par
# `versionDe`, sous l'onglet « Acheter le nom », sans en être une V2
# (spec 2026-09-22 §7). Son ancienne adresse redirige vers la racine.
```

- [ ] **Étape 6 : vérifier les valeurs posées contre la table**

```bash
node --input-type=module -e '
import yaml from "js-yaml"; import fs from "node:fs";
const attendu = {
  "cadrage/aurelie-malbec/precommande-livre-6284": ["precommande-livre-412","cadrage","Précommande du livre"],
  "cadrage/cafa/nom-de-domaine-9042": ["site-web-879","production","Site web CAFA"],
  "cadrage/serial-generations/site-web-3720": ["serial-generations-618","cadrage","Sérial Générations"],
  "cadrage/setencorpsmieux/reservation-en-ligne-5138": ["reservation-513","cadrage","Réservation en ligne des cours"],
  "devis/amusoire/refonte-4325": ["refonte-432","proposition","Refonte Webflow et intégration technique"],
  "devis/aurelie-malbec/precommande-livre-4127": ["precommande-livre-412","proposition","Précommande du livre"],
  "devis/aurelie-malbec/site-vitrine-6183": ["site-vitrine-618","proposition","Refonte du site aureliemalbec.com"],
  "devis/cafa/site-web-8791": ["site-web-879","proposition","Site web CAFA"],
  "devis/danae/page-vitrine-5619": ["page-vitrine-561","proposition","Page vitrine Vice Versa"],
  "devis/fylgo/boutique-shopify-3907": ["boutique-shopify-390","proposition","Boutique Shopify"],
  "devis/littlebox/site-vitrine-4712": ["site-vitrine-471","proposition","Site vitrine LittleBox"],
  "devis/mathilde-chevalier/refonte-astro-2071": ["refonte-207","proposition","Refonte du site de Mathilde Chevalier"],
  "devis/miharu/formulaire-brochures-8314": ["formulaire-brochures-831","proposition","Formulaire avant téléchargement des brochures"],
  "devis/miharu/plaquette-agen-7231": ["plaquette-agen-723","proposition","Plaquette commerciale sur les LP Agen"],
  "devis/oide/integration-webflow-shopify-6248": ["boutique-624","proposition","Boutique Shopify du site Oïde"],
  "devis/osmose/identite-et-site-2814": ["osmose-281","proposition","Osmose · identité et site"],
  "devis/revolutions-douces/salon-2026-5336": ["salon-533","proposition","Site du salon, édition 2026"],
  "devis/serial-generations/site-web-6184": ["serial-generations-618","proposition","Sérial Générations"],
  "devis/setencorpsmieux/site-internet-7402": ["refonte-740","proposition","Refonte du site Sète En Corps Mieux"],
  "devis/unlockbreath/plateforme-3271": ["plateforme-327","proposition","Plateforme UnlockBreath"],
  "livrable/cafa/site-web-8791": ["site-web-879","livraison","Site web CAFA"],
  "livrable/fylgo/boutique-shopify-3907": ["boutique-shopify-390","livraison","Boutique Shopify"],
  "livrable/revolutions-douces/sites-relais-5336": ["salon-533","production","Site du salon, édition 2026"],
  "temoignage/amusoire/refonte-site-0040": ["refonte-432","suivi","Refonte Webflow et intégration technique"],
};
let ko = 0;
for (const [f, [p, e, l]] of Object.entries(attendu)) {
  const d = yaml.load(fs.readFileSync(`src/content/${f}.yaml`, "utf8"));
  const lu = [d.projet, d.etape, d.linear?.projet];
  if (lu.join("|") !== [p, e, l].join("|")) { ko++; console.log("KO", f, lu); }
}
for (const f of ["devis/danae/page-vitrine-v2-7203", "devis/danae/page-vitrine-v3-8452"]) {
  const d = yaml.load(fs.readFileSync(`src/content/${f}.yaml`, "utf8"));
  if (d.linear?.projet !== "Page vitrine Vice Versa") { ko++; console.log("KO", f, d.linear); }
}
console.log(ko === 0 ? "OK : 26 fichiers conformes" : `${ko} écart(s)`);
'
```

Attendu : `OK : 26 fichiers conformes`.

- [ ] **Étape 7 : vérifier que le build passe (le test vert)**

```bash
npm run build
find dist -name index.html \( -path '*/cadrage/*' -o -path '*/devis/*' -o -path '*/livrable/*' -o -path '*/temoignage/*' \) | grep -v '/espace/' | wc -l
```

Attendu : build réussi, 29 pages de documents. Les deux chapitres de cadrage ont encore leur page à ce stade : la route `cadrage` ne regroupe pas encore les versions (tâche 8). Si le décompte diffère, lister les chemins et comparer aux 29 racines actuelles avant d'aller plus loin.

- [ ] **Étape 8 : tests unitaires**

Run : `npm test`
Attendu : PASS.

- [ ] **Étape 9 : commit**

```bash
git add src/content.config.ts src/lib/documents/charger.ts 'src/pages/cadrage/[...slug].astro' 'src/pages/devis/[...slug].astro' 'src/pages/livrable/[...slug].astro' 'src/pages/temoignage/[...slug].astro' src/content/cadrage src/content/devis src/content/livrable src/content/temoignage
git commit -m "Chaque document client porte son projet et son étape"
```

---

### Tâche 4 : la frise

**Fichiers :**
- Créer : `src/lib/documents/frise.ts`, `src/lib/documents/frise.test.ts`

**Interfaces :**
- Consomme : `DEFINITIONS`, `DefinitionEtape` (tâche 1), `DocumentProjet` (tâche 2).
- Produit : `interface Pastille extends DefinitionEtape { courante: boolean; href?: string }`, `urlDocument(d): string`, `frise(documents, courant, dev): Pastille[]`. Un tableau vide veut dire : pas de frise.

- [ ] **Étape 1 : écrire les tests**

Créer `src/lib/documents/frise.test.ts` :

```ts
import { expect, test } from "vitest";
import { frise } from "./frise";
import type { DocumentProjet } from "./projet";

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  ...p,
});

const cafa: DocumentProjet[] = [
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production" }),
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison" }),
  doc({ collection: "devis", id: "autre/projet-1234", projet: "plateforme-327", titreProjet: "Plateforme UnlockBreath" }),
];
const devisCafa = { collection: "devis" as const, id: "cafa/site-web-8791" };

test("cinq pastilles numérotées de 1 à 5 quand le projet n'a pas d'audit", () => {
  const p = frise(cafa, devisCafa, false);
  expect(p.map((x) => x.numero)).toEqual([1, 2, 3, 4, 5]);
  expect(p.map((x) => x.libelle)).toEqual(["Cadrage", "Proposition", "Production", "Livraison", "Suivi"]);
});

test("seule l'étape du document courant est colorée", () => {
  const p = frise(cafa, devisCafa, false);
  expect(p.filter((x) => x.courante).map((x) => x.etape)).toEqual(["proposition"]);
});

test("les pastilles mènent aux documents du projet, et à eux seuls", () => {
  const p = frise(cafa, devisCafa, false);
  expect(p.map((x) => x.href)).toEqual([
    undefined,
    "/devis/cafa/site-web-8791",
    "/cadrage/cafa/nom-de-domaine-9042",
    "/livrable/cafa/site-web-8791",
    undefined,
  ]);
});

test("une version ne crée pas de pastille, même si son étape par défaut est libre", () => {
  const avecVersion = [...cafa, doc({ collection: "cadrage", id: "cafa/achat-domaine-4520", etape: "cadrage", projet: undefined, versionDe: "cafa/nom-de-domaine-9042" })];
  expect(frise(avecVersion, devisCafa, false)[0].href).toBeUndefined();
});

test("en production, un document en trame ou en brouillon est estompé", () => {
  const brouillon = cafa.map((d) => (d.collection === "livrable" ? { ...d, statut: "brouillon" as const } : d));
  expect(frise(brouillon, devisCafa, false)[3].href).toBeUndefined();
});

test("en développement local, il reste cliquable pour la relecture", () => {
  const trame = cafa.map((d) => (d.collection === "livrable" ? { ...d, statut: "trame" as const } : d));
  expect(frise(trame, devisCafa, true)[3].href).toBe("/livrable/cafa/site-web-8791");
});

test("un audit ajoute la pastille 0 en tête, même en trame", () => {
  const avecAudit = [...cafa, doc({ collection: "cadrage", id: "cafa/audit-1111", etape: "audit", statut: "trame" })];
  const p = frise(avecAudit, devisCafa, false);
  expect(p.map((x) => x.numero)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(p[0]).toMatchObject({ libelle: "Audit", teinte: "teal", href: undefined });
});

test("un document hors nomenclature n'a pas de frise", () => {
  const seul = [doc({ collection: "devis", id: "en-haut", projet: undefined })];
  expect(frise(seul, { collection: "devis", id: "en-haut" }, false)).toEqual([]);
});

test("un document inconnu n'a pas de frise", () => {
  expect(frise(cafa, { collection: "devis", id: "absent" }, false)).toEqual([]);
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/frise.test.ts`
Attendu : FAIL, module `./frise` introuvable.

- [ ] **Étape 3 : écrire `frise.ts`**

```ts
/* La frise des étapes d'un document (spec 2026-09-22 §2).
 *
 * Toujours les cinq étapes du cycle, plus l'audit en tête si le projet en a
 * un. Seule l'étape du document courant est colorée : le numéro dit la
 * séquence, inutile de distinguer le passé de l'avenir. Une étape sans
 * document, ou dont le document n'est pas servi, est estompée.
 *
 * `dev` est un paramètre et non une lecture de `import.meta.env.DEV`, comme
 * dans statut.ts : c'est ce qui rend les deux branches testables.
 */
import { DEFINITIONS, type DefinitionEtape } from "./etapes";
import type { DocumentProjet } from "./projet";

export interface Pastille extends DefinitionEtape {
  courante: boolean;
  /** Absent : pas de document à cette étape, ou document non servi. */
  href?: string;
}

/** L'adresse d'un document, jusqu'au lot 4 qui la déplace sous /<client>/<projet>/<étape>. */
export const urlDocument = (d: Pick<DocumentProjet, "collection" | "id">) => `/${d.collection}/${d.id}`;

export function frise(
  documents: DocumentProjet[],
  courant: Pick<DocumentProjet, "collection" | "id">,
  dev: boolean,
): Pastille[] {
  const racine = documents.find(
    (d) => !d.versionDe && d.collection === courant.collection && d.id === courant.id,
  );
  if (!racine?.projet) return [];

  const duProjet = documents.filter((d) => !d.versionDe && d.projet === racine.projet);
  const aUnAudit = duProjet.some((d) => d.etape === "audit");

  return DEFINITIONS.filter((def) => def.etape !== "audit" || aUnAudit).map((def) => {
    const doc = duProjet.find((d) => d.etape === def.etape);
    const servi = doc !== undefined && (dev || doc.statut === "publie");
    return { ...def, courante: def.etape === racine.etape, href: servi ? urlDocument(doc) : undefined };
  });
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

Run : `npx vitest run src/lib/documents/frise.test.ts`
Attendu : PASS, 9 tests.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/documents/frise.ts src/lib/documents/frise.test.ts
git commit -m "La frise des étapes d'un document client"
```

---

### Tâche 5 : les libellés de l'en-tête et la liste des sections

**Fichiers :**
- Créer : `src/lib/documents/entete.ts`, `src/lib/documents/entete.test.ts`
- Créer : `src/lib/documents/sections.ts`, `src/lib/documents/sections.test.ts`

**Interfaces :**
- Consomme : `dateLongue`, `ancreSection` (`src/lib/devis.ts`, existants).
- Produit : `dateCourte(d: Date): string`, `interface VersionAffichee { date: Date; version: number; onglet?: string }`, `libelleOnglet(v): string`, `ligneDate(v, plusieurs: boolean, nature: string): string`, `titreEntete(d: { titre; projet?; linear? }): string`, `grouperVersions<T>(entrees: T[]): T[][]` (chaque groupe commence par sa racine, versions triées). Puis `interface SectionNav { titre: string; ancre: string }`, `sectionsDevis(d, version?)`, `sectionsCadrage(d)`, `sectionsLivrable(d)`, `sectionsTemoignage(d)`.

- [ ] **Étape 1 : écrire les tests de l'en-tête**

Créer `src/lib/documents/entete.test.ts` :

```ts
import { expect, test } from "vitest";
import { grouperVersions, libelleOnglet, ligneDate, titreEntete } from "./entete";

const le22 = new Date(2026, 8, 22);

test("un onglet de version affiche son numéro et sa date courte", () => {
  expect(libelleOnglet({ date: le22, version: 2 })).toBe("V2 · 22 sept. 2026");
});

test("un onglet nommé affiche son nom", () => {
  expect(libelleOnglet({ date: le22, version: 2, onglet: "Acheter le nom" })).toBe("Acheter le nom");
});

test("la ligne de date mentionne la version quand il y en a plusieurs", () => {
  expect(ligneDate({ date: le22, version: 2 }, true, "Proposition")).toBe("Version 2 du 22 septembre 2026");
});

test("un document seul ou un chapitre nommé perd la mention de version (spec §7)", () => {
  expect(ligneDate({ date: le22, version: 1 }, false, "Proposition")).toBe("Proposition du 22 septembre 2026");
  expect(ligneDate({ date: le22, version: 2, onglet: "Acheter le nom" }, true, "Document")).toBe(
    "Document du 22 septembre 2026",
  );
});

test("le premier du mois s'écrit « 1er »", () => {
  expect(ligneDate({ date: new Date(2026, 9, 1), version: 1 }, false, "Document")).toBe("Document du 1er octobre 2026");
});

test("le titre de l'en-tête est le nom du projet Linear", () => {
  expect(titreEntete({ titre: "CAFA-TO x Coolbeans", projet: "site-web-879", linear: { projet: "Site web CAFA" } })).toBe(
    "Site web CAFA",
  );
});

test("hors nomenclature, le titre de l'en-tête est celui du document", () => {
  expect(titreEntete({ titre: "En Haut x Coolbeans", linear: {} })).toBe("En Haut x Coolbeans");
});

test("les versions se groupent sous leur racine, dans l'ordre", () => {
  const e = (id: string, version: number, versionDe?: string) => ({ id, data: { version, versionDe } });
  const groupes = grouperVersions([e("a-v3", 3, "a"), e("b", 1), e("a", 1), e("a-v2", 2, "a")]);
  expect(groupes.map((g) => g.map((x) => x.id))).toEqual([["b"], ["a", "a-v2", "a-v3"]]);
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/entete.test.ts`
Attendu : FAIL, module `./entete` introuvable.

- [ ] **Étape 3 : écrire `entete.ts`**

```ts
/* Ce que l'en-tête et les volets d'un document affichent, calculé hors des
 * routes pour être testé. Les trois routes à versions dupliquaient le
 * regroupement et la date courte ; elles lisent désormais ce module.
 */
import { dateLongue } from "../devis";

export const dateCourte = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export interface VersionAffichee {
  date: Date;
  version: number;
  onglet?: string;
}

/** Le libellé d'un onglet : son nom s'il en a un, sinon sa version et sa date. */
export const libelleOnglet = (v: VersionAffichee) => v.onglet ?? `V${v.version} · ${dateCourte(v.date)}`;

/**
 * La ligne de date sous le titre d'un volet. La version n'est mentionnée que
 * s'il y en a plusieurs et qu'elles ne sont pas des chapitres nommés (spec §7).
 */
export function ligneDate(v: VersionAffichee, plusieurs: boolean, nature: string): string {
  const jour = dateLongue(v.date);
  return plusieurs && !v.onglet ? `Version ${v.version} du ${jour}` : `${nature} du ${jour}`;
}

/** Le h1 : le nom du projet Linear, ou le titre du document hors nomenclature. */
export function titreEntete(d: { titre: string; projet?: string; linear?: { projet?: string } }): string {
  return d.projet && d.linear?.projet ? d.linear.projet : d.titre;
}

/** Les racines et leurs versions, chaque groupe trié de la V1 à la dernière. */
export function grouperVersions<T extends { id: string; data: { version: number; versionDe?: string } }>(
  entrees: T[],
): T[][] {
  return entrees
    .filter((e) => !e.data.versionDe)
    .map((racine) =>
      [racine, ...entrees.filter((e) => e.data.versionDe === racine.id)].sort((a, b) => a.data.version - b.data.version),
    );
}
```

- [ ] **Étape 4 : vérifier que les tests passent**

Run : `npx vitest run src/lib/documents/entete.test.ts`
Attendu : PASS, 8 tests. Si `libelleOnglet` rend « 22 sept 2026 » sans point, Node tourne sans ICU complet : le signaler, ne pas adapter le test.

- [ ] **Étape 5 : écrire les tests des sections**

Créer `src/lib/documents/sections.test.ts` :

```ts
import { expect, test } from "vitest";
import { sectionsCadrage, sectionsDevis, sectionsLivrable, sectionsTemoignage } from "./sections";

test("les sections d'une proposition suivent ses sections, ancres de version comprises", () => {
  const d = { sections: [{ titre: "Le projet" }, { titre: "Budget" }] };
  expect(sectionsDevis(d)).toEqual([
    { titre: "Le projet", ancre: "le-projet" },
    { titre: "Budget", ancre: "budget" },
  ]);
  expect(sectionsDevis(d, 2).map((s) => s.ancre)).toEqual(["v2-le-projet", "v2-budget"]);
});

test("un cadrage liste son intro, puis son comparatif et son simulateur s'il en a", () => {
  const d = {
    intro: [{ titre: "Le contexte" }],
    comparatif: { titre: "Les deux voies", simulateur: { titre: "Votre budget" } },
  };
  expect(sectionsCadrage(d).map((s) => s.titre)).toEqual(["Le contexte", "Les deux voies", "Votre budget"]);
  expect(sectionsCadrage({ intro: [{ titre: "Seul" }] }).map((s) => s.titre)).toEqual(["Seul"]);
});

test("un livrable ne liste que les blocs qu'il affiche", () => {
  const d = {
    sections: [{ titre: "Ce qui change" }],
    parcours: [],
    parcoursTitre: "Le parcours",
    aVerifier: [{}],
    aVerifierTitre: "À vérifier",
    suite: [],
    suiteTitre: "La suite",
  };
  expect(sectionsLivrable(d).map((s) => s.titre)).toEqual(["Ce qui change", "À vérifier"]);
  expect(sectionsLivrable({ ...d, message: { titre: "Le message" }, parcours: [{}] }).map((s) => s.titre)).toEqual([
    "Ce qui change",
    "Le parcours",
    "Le message",
    "À vérifier",
  ]);
});

test("un témoignage liste son intro, puis la page à valider", () => {
  const d = { intro: [{ titre: "Merci" }], casClient: { titre: "Votre page" } };
  expect(sectionsTemoignage(d).map((s) => s.ancre)).toEqual(["merci", "votre-page"]);
});
```

Avant l'étape 6, ouvrir `src/lib/devis.ts` et vérifier ce que rend `ancreSection("À vérifier")`. Si le test du livrable échoue sur une ancre, c'est l'attente qu'il faut aligner sur `ancreSection`, qui fait foi puisque les composants s'en servent pour poser les `id`.

- [ ] **Étape 6 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/sections.test.ts`
Attendu : FAIL, module `./sections` introuvable.

- [ ] **Étape 7 : écrire `sections.ts`**

```ts
/* Les sections que la nav d'un document liste, dans l'ordre où la page les
 * affiche. Chaque fonction suit les conditions de rendu de son gabarit : un
 * lien vers une section absente ne mènerait nulle part. Les ancres viennent
 * d'`ancreSection`, celle que les composants posent en `id`.
 */
import { ancreSection } from "../devis";

export interface SectionNav {
  titre: string;
  ancre: string;
}

const section = (titre: string, version?: number): SectionNav => ({ titre, ancre: ancreSection(titre, version) });

/** Proposition : `version` n'est passée que s'il y a plusieurs versions, comme à DevisCorps. */
export const sectionsDevis = (d: { sections: { titre: string }[] }, version?: number): SectionNav[] =>
  d.sections.map((s) => section(s.titre, version));

export const sectionsCadrage = (d: {
  intro: { titre: string }[];
  comparatif?: { titre: string; simulateur?: { titre: string } };
}): SectionNav[] => [
  ...d.intro.map((s) => section(s.titre)),
  ...(d.comparatif ? [section(d.comparatif.titre)] : []),
  ...(d.comparatif?.simulateur ? [section(d.comparatif.simulateur.titre)] : []),
];

export const sectionsLivrable = (d: {
  sections: { titre: string }[];
  parcours: unknown[];
  parcoursTitre: string;
  message?: { titre: string };
  aVerifier: unknown[];
  aVerifierTitre: string;
  suite: unknown[];
  suiteTitre: string;
}): SectionNav[] => [
  ...d.sections.map((s) => section(s.titre)),
  ...(d.parcours.length > 0 ? [section(d.parcoursTitre)] : []),
  ...(d.message ? [section(d.message.titre)] : []),
  ...(d.aVerifier.length > 0 ? [section(d.aVerifierTitre)] : []),
  ...(d.suite.length > 0 ? [section(d.suiteTitre)] : []),
];

export const sectionsTemoignage = (d: { intro: { titre: string }[]; casClient?: { titre: string } }): SectionNav[] => [
  ...d.intro.map((s) => section(s.titre)),
  ...(d.casClient ? [section(d.casClient.titre)] : []),
];
```

Avant de valider, relire `LivrableMessage.astro`, `LivrableParcours.astro`, `LivrableSuite.astro`, `TemoignageCasClient.astro` et `CadrageSimulateur.astro` : chaque `id` posé doit correspondre à une entrée ci-dessus, avec la même condition d'affichage. Un écart se corrige ici, pas dans le composant.

- [ ] **Étape 8 : vérifier que les tests passent**

Run : `npx vitest run src/lib/documents/`
Attendu : PASS.

- [ ] **Étape 9 : commit**

```bash
git add src/lib/documents/entete.ts src/lib/documents/entete.test.ts src/lib/documents/sections.ts src/lib/documents/sections.test.ts
git commit -m "Les libellés de l'en-tête et la liste des sections d'un document"
```

---

### Tâche 6 : les composants de l'en-tête

**Fichiers :**
- Créer : `src/components/documents/DocumentFrise.astro`, `src/components/documents/DocumentEntete.astro`, `src/components/documents/DocumentVolet.astro`
- Modifier : `scripts/verify-design-system.js` (section G)
- Modifier : `src/components/devis/DocumentTopbar.astro` (commentaire seulement)

**Interfaces :**
- Consomme : `Pastille` (tâche 4), `definitionEtape`, `Etape` (tâche 1), `SectionNav` (tâche 5).
- Produit :
  - `<DocumentEntete etape titre frise onglets actif />` avec `onglets: { libelle: string; slug: string }[]`. Pose la barre Coolbeans, le filet, le h1, la frise, les onglets et le script de bascule. Un bouton d'onglet porte `data-document-onglet={i}` et `data-slug`.
  - `<DocumentVolet index actif total titre objet date sections>` avec un slot `action` et un slot par défaut. Pose `data-document-volet={index}`. La nav des sections (`DocumentSections`) arrive à la tâche 7 : d'ici là le volet ne la rend pas.
  - Un formulaire qui porte `data-suit-onglet` reçoit le `data-slug` de l'onglet cliqué.

- [ ] **Étape 1 : relire le design system**

Ouvrir `src/pages/design-system.astro` (sections couleurs et boutons) et `src/styles/global.css` (bloc `@theme inline`). Vérifier que `bg-surface-raise`, `text-mute`, `text-ink`, `bg-ink`, `text-surface`, `border-line` existent. Ne créer aucune classe.

- [ ] **Étape 2 : étendre la section G (le test rouge)**

Dans `scripts/verify-design-system.js`, section G. Sortir de l'`if (badge && geist)` les définitions de `dsRoot`, `dsDark`, `resolveDsColor`, et transformer `extractPairMap` pour qu'elle prenne sa source en paramètre :

```js
const dsRoot = geist ? declMap(extractBlock(geist, ':root {')) : {};
const dsDark = geist ? declMap(extractBlock(geist, '.dark {')) : {};
const extractPairMap = (source, name) => {
  const m = source.match(new RegExp(name + '\\s*:\\s*Record<string,\\s*string>\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};'));
  if (!m) return null;
  const map = {};
  for (const pm of m[1].matchAll(/(\w+):\s*"([^"]+)"/g)) map[pm[1]] = pm[2];
  return map;
};
// resolveDsColor : déplacer ici la fonction existante, sans la retoucher.
```

`resolveDsColor` se déplace telle quelle : son message d'erreur n'est pas du lot. Le fichier est un `.js`, que le hook ne relit pas.

Remplacer l'appel `extractPairMap(mapName)` du bloc Badge par `extractPairMap(badge, mapName)`. Puis ajouter, juste après le `else` qui clôt le bloc Badge :

```js
/* G bis · contraste des pastilles de la frise des documents client. Même
   méthode que pour Badge : les paires sont LUES dans l'objet TEINTES de
   DocumentFrise.astro, jamais supposées. Le texte -900 doit se lire sur le
   fond -100, en clair comme en sombre, y compris la teinte teal de l'audit. */
const frise = read('src/components/documents/DocumentFrise.astro');
check('DocumentFrise.astro existe', !!frise);
if (frise && geist) {
  const pairs = extractPairMap(frise, 'TEINTES');
  if (!pairs) {
    check('DocumentFrise.astro : objet TEINTES lisible', false, 'introuvable ou format inattendu');
  } else {
    for (const [teinte, decl] of Object.entries(pairs)) {
      const m = decl.match(/--fond:var\((--ds-[\w-]+)\);--encre:var\((--ds-[\w-]+)\)/);
      if (!m) {
        check('Pastille ' + teinte + ' : déclaration analysable', false, decl);
        continue;
      }
      const [, bgToken, fgToken] = m;
      for (const mode of ['light', 'dark']) {
        try {
          const r = ratio(resolveDsColor(fgToken, mode), resolveDsColor(bgToken, mode));
          check('contraste pastille ' + teinte + ', ' + mode + ' (' + r.toFixed(2) + ':1)', r >= 4.5, 'attendu ≥ 4.5, ' + fgToken + ' sur ' + bgToken);
        } catch (e) {
          check('contraste pastille ' + teinte + ', ' + mode, false, e.message);
        }
      }
    }
  }
}
```

Run : `npm run verify`
Attendu : ÉCHEC sur « DocumentFrise.astro existe ». Toutes les autres vérifications passent comme avant.

- [ ] **Étape 3 : écrire `DocumentFrise.astro`**

```astro
---
/* La frise des étapes d'un projet (spec 2026-09-22 §2). Elle navigue entre
   les documents du projet : survol teinté, page courante teintée, les autres
   grises. Une étape sans document servi est estompée et non cliquable.

   Pastilles reprises de l'image OG, à l'échelle dense : fond -100, encre
   -900, 32 px de haut, rayon plein, numéro devant le libellé. `Badge subtle`
   ne convient pas : fond -200, 24 px, trop dense. */
import type { Pastille } from "../../lib/documents/frise";

interface Props {
  pastilles: Pastille[];
}

const { pastilles } = Astro.props;

/* Paires fond et encre de chaque teinte. La section G de
   scripts/verify-design-system.js lit cet objet pour en vérifier le
   contraste : ne pas changer son format. */
const TEINTES: Record<string, string> = {
  teal: "--fond:var(--ds-teal-100);--encre:var(--ds-teal-900)",
  amber: "--fond:var(--ds-amber-100);--encre:var(--ds-amber-900)",
  blue: "--fond:var(--ds-blue-100);--encre:var(--ds-blue-900)",
  gray: "--fond:var(--ds-gray-100);--encre:var(--ds-gray-900)",
  green: "--fond:var(--ds-green-100);--encre:var(--ds-green-900)",
  purple: "--fond:var(--ds-purple-100);--encre:var(--ds-purple-900)",
};

const PASTILLE =
  "inline-flex h-8 items-center gap-[7px] rounded-full bg-surface-raise px-4 text-[14px]/none font-medium tracking-[-0.01em] whitespace-nowrap text-mute";
const NUMERO = "font-mono text-[11px]/none font-semibold opacity-[.55]";
---

{
  pastilles.length > 0 && (
    <nav aria-label="Documents du projet" class="mt-6">
      <ol class="flex flex-wrap gap-[9px]">
        {pastilles.map((p) => (
          <li>
            {p.href ? (
              <a
                href={p.href}
                aria-current={p.courante ? "page" : undefined}
                style={TEINTES[p.teinte]}
                class:list={[
                  PASTILLE,
                  "transition-colors duration-150 ease-in-out hover:bg-(--fond) hover:text-(--encre) aria-[current=page]:bg-(--fond) aria-[current=page]:text-(--encre)",
                ]}
              >
                <span class={NUMERO}>{p.numero}</span>
                {p.libelle}
              </a>
            ) : (
              <span class:list={[PASTILLE, "opacity-[.45]"]} aria-disabled="true">
                <span class={NUMERO}>{p.numero}</span>
                {p.libelle}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

Run : `npm run verify`
Attendu : PASS, avec douze lignes « contraste pastille » (six teintes, deux modes). Si une teinte échoue, le signaler à Ludo avec le ratio : ne pas changer de nuance sans son accord.

- [ ] **Étape 4 : écrire `DocumentEntete.astro`**

```astro
---
/* En-tête commun aux documents client (spec 2026-09-22 §1, COO-235).

   CE QUI EST AU-DESSUS D'UNE BARRE D'ONGLETS IDENTIFIE LA PAGE ET NE CHANGE
   JAMAIS D'UN ONGLET À L'AUTRE. CE QUI APPARTIENT À UN ONGLET VIT SOUS LA
   BARRE. La règle vaut pour tout composant à onglets du site. Elle vient du
   livrable CAFA, relevé par Ludo le 2026-09-22 : titre, objet et date
   changeaient avec l'onglet, et le lecteur croyait avoir changé de page.

   Au-dessus de la barre : le nom du projet, la frise, les onglets. Sous la
   barre, dans DocumentVolet : la nav des sections, le titre du document, son
   objet, sa date, son bouton.

   Le filet de 3 px se colle sous la barre Coolbeans, dans la teinte de
   l'étape. Il ne flotte pas en tête de page, où il se lirait comme une
   alerte : cette place est celle d'EnvBanner, rendue par BaseLayout au-dessus
   de la barre, dans le flux. Les deux ne se superposent donc jamais. */
import DocumentTopbar from "../devis/DocumentTopbar.astro";
import DocumentFrise from "./DocumentFrise.astro";
import { definitionEtape, type Etape } from "../../lib/documents/etapes";
import type { Pastille } from "../../lib/documents/frise";

interface Props {
  etape: Etape;
  /** Le nom du projet Linear, ou le titre du document hors nomenclature. */
  titre: string;
  frise: Pastille[];
  /** Un par volet. Moins de deux : pas de barre d'onglets. */
  onglets: { libelle: string; slug: string }[];
  actif: number;
}

const { etape, titre, frise, onglets, actif } = Astro.props;
const { teinte } = definitionEtape(etape);
---

<DocumentTopbar />
<div aria-hidden="true" class="h-[3px] print:hidden" style={`background:var(--ds-${teinte}-900)`}></div>

<header class="container-site print:hidden">
  <div class="mx-auto max-w-[880px] pt-14 pb-7">
    <h1 class="text-[clamp(2rem,4vw,2.75rem)]/[1.08] tracking-[-0.02em]">{titre}</h1>

    <DocumentFrise pastilles={frise} />

    {
      onglets.length > 1 && (
        <div class="mt-7 flex flex-wrap gap-2" role="tablist" aria-label="Versions du document">
          {onglets.map((o, i) => (
            <button
              type="button"
              role="tab"
              id={`onglet-${i}`}
              aria-controls={`volet-${i}`}
              aria-selected={i === actif ? "true" : "false"}
              data-document-onglet={i}
              data-slug={o.slug}
              class="cursor-pointer rounded-full px-[13px] py-[5px] text-[13px]/[1.4] font-semibold text-mute transition-colors duration-150 ease-in-out hover:bg-surface-raise hover:text-ink aria-selected:bg-ink aria-selected:text-surface"
            >
              {o.libelle}
            </button>
          ))}
        </div>
      )
    }
  </div>
</header>

<script>
  /* Bascule des onglets : on change la visibilité, on ne recharge pas. L'état
     vit dans `aria-selected`, que les utilitaires lisent : aucune classe
     ajoutée en JavaScript, donc rien que Tailwind puisse purger.

     Un formulaire qui porte `data-suit-onglet` (proposition, livrable) prend
     le slug de l'onglet affiché, sans quoi une réponse à la V1 arriverait
     étiquetée V2. Un formulaire posé DANS un volet (cadrage à chapitres)
     garde le sien. */
  const onglets = document.querySelectorAll<HTMLButtonElement>("[data-document-onglet]");

  onglets.forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const cible = bouton.dataset.documentOnglet;
      onglets.forEach((b) => b.setAttribute("aria-selected", String(b === bouton)));
      document.querySelectorAll<HTMLElement>("[data-document-volet]").forEach((volet) => {
        volet.hidden = volet.dataset.documentVolet !== cible;
      });
      document.querySelectorAll<HTMLFormElement>("form[data-suit-onglet]").forEach((form) => {
        if (bouton.dataset.slug) form.dataset.slug = bouton.dataset.slug;
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
</script>
```

- [ ] **Étape 5 : écrire `DocumentVolet.astro`**

```astro
---
/* Un volet : ce qui appartient à une version ou à un chapitre, sous la barre
   d'onglets de DocumentEntete. Titre du document, objet, date, bouton, puis
   le contenu. La nav des sections s'y ajoute à la tâche suivante. */
import type { SectionNav } from "../../lib/documents/sections";

interface Props {
  index: number;
  actif: number;
  /** Nombre de volets de la page. Un seul : pas de rôle d'onglet. */
  total: number;
  titre: string;
  objet: string;
  date: string;
  sections: SectionNav[];
}

const { index, actif, total, titre, objet, date } = Astro.props;
const onglets = total > 1;
---

<div
  data-document-volet={index}
  id={onglets ? `volet-${index}` : undefined}
  role={onglets ? "tabpanel" : undefined}
  aria-labelledby={onglets ? `onglet-${index}` : undefined}
  hidden={index !== actif}
>
  <div class="container-site">
    <div class="mx-auto max-w-[880px] pt-10">
      <h2 class="text-[1.75rem]/[1.2] tracking-[-0.01em]">{titre}</h2>
      <p class="mt-3.5 max-w-[62ch] text-lg/normal text-mute">{objet}</p>
      <p class="mt-4.5 font-mono text-[12px]/normal tracking-[0.04em] text-mute uppercase">{date}</p>
      <slot name="action" />
    </div>
  </div>
  <slot />
</div>
```

- [ ] **Étape 6 : mettre à jour le commentaire de `DocumentTopbar.astro`**

Dans son commentaire d'en-tête, remplacer le dernier paragraphe (« Fond `surface-subtle`, sans filet bas : c'est celui du hero qui suit immédiatement... ») par :

```
   Fond `surface-subtle`. Le filet de l'étape la sépare de l'en-tête du
   document, qui suit sur le fond de la page : voir DocumentEntete.
```

Remplacer aussi, dans le paragraphe « NON COLLANTE », `DevisCorps pose déjà un sommaire de sections` par `DocumentSections pose déjà un sommaire de sections`.

- [ ] **Étape 7 : vérifier**

```bash
npm run verify
npm test
npm run build
```

Attendu : les trois passent. Les composants ne sont encore utilisés par aucune page : le rendu se vérifie à la tâche 7.

- [ ] **Étape 8 : commit**

```bash
git add src/components/documents scripts/verify-design-system.js src/components/devis/DocumentTopbar.astro
git commit -m "L'en-tête partagé des documents client, sa frise et son volet"
```

---

### Tâche 7 : la proposition et le livrable sur l'en-tête partagé

Le défaut d'origine : les deux gabarits à versions.

**Fichiers :**
- Créer : `src/components/documents/DocumentSections.astro`
- Modifier : `src/components/documents/DocumentVolet.astro`
- Modifier : `src/components/devis/DevisCorps.astro`
- Modifier : `src/components/devis/DevisReponse.astro`, `src/components/livrable/LivrableReponse.astro`
- Modifier : `src/pages/devis/[...slug].astro`, `src/pages/livrable/[...slug].astro`

**Interfaces :**
- Consomme : tout ce qui précède. `chargerDocuments` (tâche 3), `frise` (tâche 4), `grouperVersions`, `libelleOnglet`, `ligneDate`, `titreEntete`, `sectionsDevis`, `sectionsLivrable` (tâche 5), `DocumentEntete`, `DocumentVolet` (tâche 6).
- Produit : `<DocumentSections sections />`, rendue par `DocumentVolet`. Les liens portent `data-section-link`, la barre `data-document-sections`.

- [ ] **Étape 1 : écrire `DocumentSections.astro`**

```astro
---
/* Nav des sections d'un document, collante, pleine largeur (spec 2026-09-22
   §5). Reprise de DevisCorps, qui la portait seul, pour les quatre gabarits.

   PIÈGE D'ALIGNEMENT, commis deux fois pendant la conception. La liste porte
   `w-max` pour déborder et déclencher le défilement latéral. Elle ne peut
   donc PAS porter `mx-auto`, qui la centrerait au lieu de l'aligner. La
   colonne de 880 px est portée par le bloc parent, la liste part de son bord
   gauche. Se vérifie par mesure, pas à l'œil.

   Rien sous deux sections : une nav d'un seul lien ne mène nulle part. */
import type { SectionNav } from "../../lib/documents/sections";

interface Props {
  sections: SectionNav[];
}

const { sections } = Astro.props;
---

{
  sections.length > 1 && (
    <div
      data-document-sections
      class="sticky top-0 z-40 border-y border-line bg-surface/95 backdrop-blur-sm print:hidden"
    >
      <nav class="container-site overflow-x-auto" aria-label="Sections du document">
        <div class="mx-auto max-w-[880px]">
          <ul class="flex w-max gap-6 py-3.5 whitespace-nowrap">
            {sections.map((s) => (
              <li>
                <a
                  href={`#${s.ancre}`}
                  data-section-link
                  aria-current="false"
                  class="rounded-control px-2 py-1 font-mono text-[12px]/normal font-semibold tracking-wide text-mute uppercase transition-colors duration-150 ease-in-out hover:bg-surface-raise hover:text-ink aria-current:bg-ink aria-current:text-surface"
                >
                  {s.titre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  )
}

<script>
  /* Deux comportements, sur toutes les barres de la page.

     1. Un lien mène à la section du volet AFFICHÉ. Les volets d'un livrable à
        deux versions portent les mêmes ancres : le navigateur irait à la
        première du document, celle du volet masqué, et rien ne bougerait.

     2. Scrollspy : le lien de la section qui passe sous la barre s'allume.
        Une section d'un volet masqué ne coupe jamais le viewport, elle ne
        s'allume donc jamais. */
  const liens = document.querySelectorAll<HTMLAnchorElement>("[data-section-link]");
  const barres = document.querySelectorAll<HTMLElement>("[data-document-sections]");

  const cible = (id: string) =>
    document.querySelector<HTMLElement>(`[data-document-volet]:not([hidden]) section[id="${CSS.escape(id)}"]`) ??
    document.getElementById(id);

  liens.forEach((lien) => {
    lien.addEventListener("click", (e) => {
      const id = lien.getAttribute("href")?.slice(1);
      const section = id ? cible(id) : null;
      if (!section) return;
      e.preventDefault();
      section.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    });
  });

  const activer = (id: string) =>
    liens.forEach((l) => l.setAttribute("aria-current", l.getAttribute("href") === `#${id}` ? "true" : "false"));

  const hauteurBarre = () => [...barres].find((b) => b.offsetParent !== null)?.offsetHeight ?? 0;

  const sections = document.querySelectorAll<HTMLElement>("section[id]");
  if (sections.length && liens.length) {
    const observateur = new IntersectionObserver(
      (entrees) => {
        const visibles = entrees.filter((e) => e.isIntersecting);
        if (!visibles.length) return;
        const haut = visibles.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        activer(haut.target.id);
      },
      { rootMargin: `-${hauteurBarre()}px 0px -70% 0px`, threshold: 0 },
    );
    sections.forEach((s) => observateur.observe(s));
  }
</script>
```

- [ ] **Étape 2 : brancher la nav dans le volet**

Dans `DocumentVolet.astro` : importer `DocumentSections from "./DocumentSections.astro"`, lire `sections` dans `Astro.props`, poser `<DocumentSections sections={sections} />` comme premier enfant du `div[data-document-volet]`, avant le `container-site`. Retirer du commentaire d'en-tête la phrase « La nav des sections s'y ajoute à la tâche suivante. » et commencer la liste par « Nav des sections, ».

- [ ] **Étape 3 : retirer la nav de `DevisCorps.astro`**

1. Supprimer le commentaire `<!-- BLOC STICKY : nav de sections... -->` et tout le `<div data-sticky-devis-nav ...>...</div>` qui le suit (lignes 46 à 70 à la lecture du 2026-09-29).
2. Dans le `<script>`, supprimer le bloc qui commence par `/* scrollspy de la nav de section` et finit par la `}` fermante du `if (sections.length && links.length) {...}`. Garder tout le reste du script (options de planning, budget composable).
3. Vérifier qu'aucune variable supprimée (`sections`, `links`, `stickyBars`, `setActive`, `stickyOffset`) n'est lue plus bas dans le script.

- [ ] **Étape 4 : les formulaires suivent l'onglet**

Ajouter l'attribut `data-suit-onglet` sur `<form id="devis-form" ...>` dans `DevisReponse.astro` et sur `<form id="livrable-form" ...>` dans `LivrableReponse.astro`. Rien d'autre.

- [ ] **Étape 5 : réécrire la route de la proposition**

Remplacer le frontmatter et le gabarit de `src/pages/devis/[...slug].astro` jusqu'à `</BaseLayout>` inclus. Le bloc `<script>` des onglets disparaît : `DocumentEntete` porte le sien. Le bloc `<style is:global>` d'impression reste, avec une seule modification à l'étape 6.

```astro
---
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import DocumentEntete from "../../components/documents/DocumentEntete.astro";
import DocumentVolet from "../../components/documents/DocumentVolet.astro";
import DevisCorps from "../../components/devis/DevisCorps.astro";
import DevisEntetePrint from "../../components/devis/DevisEntetePrint.astro";
import DevisReponse from "../../components/devis/DevisReponse.astro";
import DevisFooter from "../../components/devis/DevisFooter.astro";
import DocumentReponses from "../../components/devis/DocumentReponses.astro";
import { construitesEnProduction } from "../../lib/documents/statut";
import { chargerDocuments } from "../../lib/documents/charger";
import { frise } from "../../lib/documents/frise";
import { grouperVersions, libelleOnglet, ligneDate, titreEntete } from "../../lib/documents/entete";
import { sectionsDevis } from "../../lib/documents/sections";

/* Une proposition peut avoir plusieurs versions (révision de périmètre).
   Elles partagent l'URL de la V1, et le lien déjà envoyé au client ne bouge
   jamais. Seule la V1 génère une route ; les versions suivantes se déclarent
   par `versionDe` et n'ont pas d'URL propre, sans quoi le client pourrait
   tomber sur une révision hors de son contexte. */
export async function getStaticPaths() {
  /* Charge aussi les trois autres collections, pour la frise, et arrête le
     build si la nomenclature est incohérente. */
  const documents = await chargerDocuments();
  /* Le filtre passe AVANT le regroupement : sur une racine il fait
     disparaître la page, sur une version il fait disparaître un onglet. */
  const entries = construitesEnProduction(await getCollection("devis"), import.meta.env.DEV);
  return grouperVersions(entries).map((versions) => ({
    params: { slug: versions[0].id },
    props: {
      versions,
      pastilles: frise(documents, { collection: "devis", id: versions[0].id }, import.meta.env.DEV),
    },
  }));
}

const { versions, pastilles } = Astro.props;

/* La dernière version est celle qui engage : c'est elle qu'on ouvre. Les
   précédentes restent consultables, jamais réécrites. */
const actif = versions.length - 1;
const racine = versions[0].data;
const courante = versions[actif].data;
const plusieurs = versions.length > 1;

/* Référence du document, reprise telle quelle sur le devis Tiime qui y
   renvoie : le suffixe à quatre chiffres du slug de la V1, stable d'une
   version à l'autre puisque les suivantes n'ont pas d'URL propre. */
const reference = versions[0].id.split("-").pop();
---

<BaseLayout
  title={`Devis ${courante.titre} · Coolbeans`}
  description={`Proposition commerciale : ${courante.objet}`}
  noindex
>
  <DocumentEntete
    etape={racine.etape}
    titre={titreEntete(racine)}
    frise={pastilles}
    onglets={versions.map((v) => ({ libelle: libelleOnglet(v.data), slug: v.id }))}
    actif={actif}
  />

  {
    versions.map((v, i) => (
      <DocumentVolet
        index={i}
        actif={actif}
        total={versions.length}
        titre={v.data.titre}
        objet={v.data.objet}
        date={ligneDate(v.data, plusieurs, "Proposition")}
        sections={sectionsDevis(v.data, plusieurs ? v.data.version : undefined)}
      >
        <div class="container-site">
          <DevisEntetePrint d={v.data} reference={reference} />
          <DevisCorps
            d={v.data}
            version={plusieurs ? v.data.version : undefined}
            precedent={i > 0 ? versions[i - 1].data : undefined}
          />
        </div>
      </DocumentVolet>
    ))
  }

  <!-- Pied du tirage PDF. Masqué à l'écran, où la page porte déjà son URL
       dans la barre du navigateur ; indispensable sur un document qui
       circule détaché, en pièce jointe d'un mail. -->
  <div
    data-devis-pied
    class="container-site hidden text-center font-mono text-[9px] tracking-wide text-mute uppercase print:block"
  >
    Proposition nᵒ {reference} · Version {courante.version} · coolbeans.cc/devis/{versions[0].id}
  </div>

  <!-- Réponses déjà reçues, toutes versions confondues. Une validation de la
       version courante masque le formulaire qui suit. -->
  <DocumentReponses
    server:defer
    type="devis"
    versions={versions.map((v) => ({ slug: v.id, version: v.data.version }))}
  />

  {
    courante.formulaire && (
      <DevisReponse
        slug={versions[actif].id}
        enAttente={courante.sections.some((s) => s.budget?.enAttente)}
      />
    )
  }

  <DevisFooter />
</BaseLayout>
```

Les commentaires HTML `<!-- -->` du gabarit contiennent « : » : le hook exige l'espace insécable avant, comme dans la version actuelle du fichier. Recopier ces commentaires depuis le fichier existant plutôt que depuis ce plan.

- [ ] **Étape 6 : la feuille d'impression**

Dans le `<style is:global>` de la même route, retirer `[data-sticky-devis-nav],` de la liste des éléments masqués (`DocumentSections` porte `print:hidden`). Ne rien changer d'autre.

- [ ] **Étape 7 : réécrire la route du livrable**

Remplacer le frontmatter, le gabarit et le `<script>` de `src/pages/livrable/[...slug].astro` :

```astro
---
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import Banner from "../../components/ui/Banner.astro";
import Tooltip from "../../components/ui/Tooltip.astro";
import CadrageIntro from "../../components/cadrage/CadrageIntro.astro";
import LivrableApercu from "../../components/livrable/LivrableApercu.astro";
import LivrableVideo from "../../components/livrable/LivrableVideo.astro";
import LivrableParcours from "../../components/livrable/LivrableParcours.astro";
import LivrableMessage from "../../components/livrable/LivrableMessage.astro";
import LivrableSuite from "../../components/livrable/LivrableSuite.astro";
import LivrableReponse from "../../components/livrable/LivrableReponse.astro";
import DevisFooter from "../../components/devis/DevisFooter.astro";
import DocumentReponses from "../../components/devis/DocumentReponses.astro";
import DocumentEntete from "../../components/documents/DocumentEntete.astro";
import DocumentVolet from "../../components/documents/DocumentVolet.astro";
import { riche } from "../../lib/devis";
import { construitesEnProduction } from "../../lib/documents/statut";
import { chargerDocuments } from "../../lib/documents/charger";
import { frise } from "../../lib/documents/frise";
import { grouperVersions, libelleOnglet, ligneDate, titreEntete } from "../../lib/documents/entete";
import { sectionsLivrable } from "../../lib/documents/sections";

/* Un livrable peut avoir plusieurs versions : après des retours, la V2 se
   déclare par `versionDe` et partage l'URL de la V1, comme à la proposition.
   Le lien envoyé au client ne bouge jamais ; les versions précédentes
   restent lisibles sous des onglets. */
export async function getStaticPaths() {
  const documents = await chargerDocuments();
  /* Le filtre passe AVANT le regroupement : sur une racine il fait
     disparaître la page, sur une version il fait disparaître un onglet. */
  const entries = construitesEnProduction(await getCollection("livrable"), import.meta.env.DEV);
  return grouperVersions(entries).map((versions) => ({
    params: { slug: versions[0].id },
    props: {
      versions,
      pastilles: frise(documents, { collection: "livrable", id: versions[0].id }, import.meta.env.DEV),
    },
  }));
}

const { versions, pastilles } = Astro.props;
const actif = versions.length - 1;
const racine = versions[0].data;
const courante = versions[actif].data;
const plusieurs = versions.length > 1;
---

<BaseLayout
  title={`Livrable ${courante.titre} · Coolbeans`}
  description={`Livrable : ${courante.objet}`}
  noindex
>
  <DocumentEntete
    etape={racine.etape}
    titre={titreEntete(racine)}
    frise={pastilles}
    onglets={versions.map((v) => ({ libelle: libelleOnglet(v.data), slug: v.id }))}
    actif={actif}
  />

  {
    versions.map((v, i) => (
      <DocumentVolet
        index={i}
        actif={actif}
        total={versions.length}
        titre={v.data.titre}
        objet={v.data.objet}
        date={ligneDate(v.data, plusieurs, "Document")}
        sections={sectionsLivrable(v.data)}
      >
        <a
          slot="action"
          href={v.data.site.url}
          target="_blank"
          rel="noopener"
          class="btn btn-lg mt-6.5 inline-flex"
        >
          {v.data.site.label}
        </a>

        <div class="container-site">
          <div class="mx-auto max-w-[880px] py-16x">
            {v.data.apercu && (
              <LivrableApercu
                bureau={v.data.apercu.bureau}
                mobile={v.data.apercu.mobile}
                url={v.data.apercu.url ?? v.data.site.url}
                titre={v.data.apercu.titre}
                legende={v.data.apercu.legende}
              />
            )}

            {v.data.video && (
              <div class:list={[v.data.apercu && "border-t border-line"]}>
                <LivrableVideo
                  url={v.data.video.url}
                  embed={v.data.video.embed}
                  duree={v.data.video.duree}
                  legende={v.data.video.legende}
                />
              </div>
            )}

            <div class:list={[(v.data.apercu || v.data.video) && "border-t border-line"]}>
              <CadrageIntro sections={v.data.sections} />
            </div>

            {v.data.parcours.length > 0 && (
              <LivrableParcours
                titre={v.data.parcoursTitre}
                etapes={v.data.parcours}
                replie={v.data.parcoursReplie}
              />
            )}

            {v.data.message && (
              <LivrableMessage
                titre={v.data.message.titre}
                objet={v.data.message.objet}
                corps={v.data.message.corps}
                note={v.data.message.note}
              />
            )}

            <LivrableSuite
              aVerifier={v.data.aVerifier}
              aVerifierTitre={v.data.aVerifierTitre}
              suite={v.data.suite}
              suiteTitre={v.data.suiteTitre}
              contact={v.data.contact}
            />

            {v.data.notes.length > 0 && (
              <div class="grid grid-cols-[180px_1fr] gap-10 border-t border-line pt-10 max-[700px]:grid-cols-1 max-[700px]:gap-4">
                <p class="pt-1 font-mono text-[15px] font-extrabold tracking-wide text-ink uppercase">NB</p>
                <div class="flex max-w-[58ch] flex-col gap-3">
                  {v.data.notes.map((note) => (
                    <Banner tone={note.tone}>
                      <Fragment set:html={riche(note.texte)} />
                      {note.tooltip && <Tooltip texte={note.tooltip} />}
                    </Banner>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DocumentVolet>
    ))
  }

  <!-- Réponses déjà reçues, toutes versions confondues. Une validation de la
       version courante masque le formulaire qui suit ; des retours le laissent. -->
  <DocumentReponses
    server:defer
    type="livrable"
    versions={versions.map((v) => ({ slug: v.id, version: v.data.version }))}
    tutoiement={courante.tutoiement}
  />

  {
    courante.formulaire && (
      <LivrableReponse slug={versions[actif].id} tutoiement={courante.tutoiement} />
    )
  }

  <DevisFooter />
</BaseLayout>
```

Même remarque qu'à l'étape 5 pour les commentaires HTML : les recopier depuis le fichier existant. Supprimer l'ancien `<script>` des onglets en fin de fichier, et les imports devenus inutiles (`GridBackdrop`, `DocumentTopbar`, `dateLongue`).

- [ ] **Étape 8 : vérifier au build et en local**

```bash
npm test
npm run verify
npm run build
npm run dev -- --port 4336
```

Ouvrir `http://localhost:4336/devis/cafa/site-web-8791` et `http://localhost:4336/livrable/cafa/site-web-8791`. Vérifier à l'œil : h1 « Site web CAFA », cinq pastilles (Cadrage estompée, Proposition ou Livraison colorée, Production cliquable), deux onglets, cliquer V1 puis V2 ne change rien au-dessus des onglets. La mesure fine est la tâche 9.

- [ ] **Étape 9 : commit**

```bash
git add src/components/documents src/components/devis/DevisCorps.astro src/components/devis/DevisReponse.astro src/components/livrable/LivrableReponse.astro 'src/pages/devis/[...slug].astro' 'src/pages/livrable/[...slug].astro'
git commit -m "Changer d'onglet ne change plus l'identité d'une proposition ni d'un livrable"
```

---

### Tâche 8 : le cadrage à chapitres et le témoignage

**Fichiers :**
- Modifier : `src/lib/documents/affichage.ts`, `src/lib/documents/affichage.test.ts`
- Modifier : `src/components/devis/DocumentReponses.astro`
- Modifier : `src/components/cadrage/CadrageFormulaire.astro`
- Modifier : `src/pages/cadrage/[...slug].astro`, `src/pages/temoignage/[...slug].astro`

**Interfaces :**
- Consomme : tout ce qui précède, plus `sectionsCadrage`, `sectionsTemoignage` (tâche 5).
- Produit : `selecteurFormulaire(type, slug): string` dans `affichage.ts`. Pour `cadrage`, le sélecteur vise le seul formulaire du slug : `[data-cadrage-formulaire][data-slug="<slug>"]`. Pour les trois autres, il est inchangé.

- [ ] **Étape 1 : écrire le test du sélecteur**

Ajouter à `src/lib/documents/affichage.test.ts` (garder ses imports existants, ajouter `selecteurFormulaire` à celui de `./affichage`) :

```ts
test("un cadrage clos ne masque que son propre formulaire", () => {
  // Deux chapitres sur une page : répondre au premier ne doit pas retirer
  // le formulaire du second (documents de domaine CAFA, 2026-09-29).
  expect(selecteurFormulaire("cadrage", "cafa/nom-de-domaine-9042")).toBe(
    '[data-cadrage-formulaire][data-slug="cafa/nom-de-domaine-9042"]',
  );
});

test("les autres documents masquent leur formulaire unique, comme avant", () => {
  expect(selecteurFormulaire("devis", "x")).toBe("[data-devis-reponse]");
  expect(selecteurFormulaire("livrable", "x")).toBe("[data-livrable-reponse]");
  expect(selecteurFormulaire("temoignage", "x")).toBe("[data-temoignage-formulaire]");
});
```

Si `affichage.test.ts` n'importe pas encore `test` depuis `vitest`, l'ajouter à son import existant.

Run : `npx vitest run src/lib/documents/affichage.test.ts`
Attendu : FAIL, `selecteurFormulaire` n'est pas exporté.

- [ ] **Étape 2 : écrire `selecteurFormulaire`**

Ajouter à la fin de `src/lib/documents/affichage.ts` :

```ts
/* La section de formulaire que DocumentReponses masque quand le document est
   clos. Un cadrage peut porter plusieurs chapitres sur une page, chacun avec
   son formulaire : le sélecteur vise alors le seul formulaire du slug clos.
   Les trois autres gabarits n'ont qu'un formulaire par page. */
const FORMULAIRE = {
  devis: "[data-devis-reponse]",
  livrable: "[data-livrable-reponse]",
  temoignage: "[data-temoignage-formulaire]",
} as const;

export function selecteurFormulaire(type: "cadrage" | keyof typeof FORMULAIRE, slug: string): string {
  return type === "cadrage" ? `[data-cadrage-formulaire][data-slug="${slug}"]` : FORMULAIRE[type];
}
```

Run : `npx vitest run src/lib/documents/affichage.test.ts`
Attendu : PASS.

- [ ] **Étape 3 : l'utiliser dans `DocumentReponses.astro`**

Supprimer la constante locale `FORMULAIRE` et son commentaire. Importer `selecteurFormulaire` depuis `../../lib/documents/affichage` (l'import existant de ce module s'enrichit). Remplacer la dernière ligne par :

```astro
{clos && courant && <Fragment set:html={`<style>${selecteurFormulaire(type, courant)}{display:none!important}</style>`} />}
```

- [ ] **Étape 4 : plusieurs formulaires de cadrage sur une page**

Dans `src/components/cadrage/CadrageFormulaire.astro` :

1. Dans le frontmatter, après la lecture des props : `const cle = slug.replace(/[^a-z0-9]+/gi, "-");`
2. Sur la `<section data-cadrage-formulaire ...>`, ajouter `data-slug={slug}`.
3. Sur le `<form id="cadrage-form" ...>`, remplacer `id="cadrage-form"` par `data-cadrage-form`.
4. Chaque attribut `id="cadrage-..."` du composant devient `id={`cadrage-...-${cle}`}`, et chaque `for="cadrage-..."` qui y renvoie devient `for={`cadrage-...-${cle}`}`. Même traitement pour tout `id` construit à partir de l'identifiant d'une question : deux chapitres peuvent poser une question au même identifiant.
5. Dans le `<script>`, remplacer `const form = document.querySelector<HTMLFormElement>("#cadrage-form");` par une boucle qui enveloppe tout le reste du script :

```ts
  document.querySelectorAll<HTMLFormElement>("form[data-cadrage-form]").forEach((form) => {
    // corps actuel du script, inchangé, qui lit `form`
  });
```

Les déclarations de types (`interface Descripteur`) restent hors de la boucle. Les gardes `if (!form) return;` deviennent inutiles et peuvent rester. Toute requête `document.querySelector...` du corps doit devenir `form.querySelector...` : la vérifier une par une.

6. Grep de contrôle, attendu vide :

```bash
grep -n '"#cadrage-form"\|id="cadrage-\|for="cadrage-' src/components/cadrage/CadrageFormulaire.astro
```

- [ ] **Étape 5 : réécrire la route du cadrage**

Remplacer le frontmatter et le gabarit de `src/pages/cadrage/[...slug].astro` :

```astro
---
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import Banner from "../../components/ui/Banner.astro";
import Tooltip from "../../components/ui/Tooltip.astro";
import CadrageIntro from "../../components/cadrage/CadrageIntro.astro";
import CadrageComparatif from "../../components/cadrage/CadrageComparatif.astro";
import CadrageSimulateur from "../../components/cadrage/CadrageSimulateur.astro";
import CadrageFormulaire from "../../components/cadrage/CadrageFormulaire.astro";
import DevisFooter from "../../components/devis/DevisFooter.astro";
import DocumentReponses from "../../components/devis/DocumentReponses.astro";
import DocumentEntete from "../../components/documents/DocumentEntete.astro";
import DocumentVolet from "../../components/documents/DocumentVolet.astro";
import { riche, ancreSection } from "../../lib/devis";
import { construitesEnProduction } from "../../lib/documents/statut";
import { chargerDocuments } from "../../lib/documents/charger";
import { frise } from "../../lib/documents/frise";
import { grouperVersions, libelleOnglet, ligneDate, titreEntete } from "../../lib/documents/entete";
import { sectionsCadrage } from "../../lib/documents/sections";

/* Un cadrage par fichier YAML. Deux cadrages peuvent partager une page, en
   chapitres : le second se déclare par `versionDe` et prend un `onglet`. Ce
   ne sont pas des versions : chaque chapitre garde ses questions, son
   formulaire et ses réponses, posés dans son volet. */
export async function getStaticPaths() {
  const documents = await chargerDocuments();
  const entries = construitesEnProduction(await getCollection("cadrage"), import.meta.env.DEV);
  return grouperVersions(entries).flatMap((chapitres) => {
    const racine = chapitres[0];
    const page = {
      params: { slug: racine.id },
      props: {
        chapitres,
        pastilles: frise(documents, { collection: "cadrage", id: racine.id }, import.meta.env.DEV),
        redirection: undefined as string | undefined,
      },
    };
    /* Les chapitres suivants avaient leur propre adresse avant de rejoindre
       la page de leur racine, le 2026-09-29 (achat-domaine-4520,
       stack-technique-4417). Le lien déjà envoyé mène à la racine, dont le
       volet ouvert par défaut est le dernier : le leur. Page statique, donc
       redirection par meta refresh ; le lot 4 en fera des 301. */
    const anciennes = chapitres.slice(1).map((c) => ({
      params: { slug: c.id },
      props: { chapitres, pastilles: [], redirection: `/cadrage/${racine.id}` as string | undefined },
    }));
    return [page, ...anciennes];
  });
}

const { chapitres, pastilles, redirection } = Astro.props;
if (redirection) return Astro.redirect(redirection);

const actif = chapitres.length - 1;
const racine = chapitres[0].data;
const plusieurs = chapitres.length > 1;
const courante = chapitres[actif].data;

/* Pas de tirage PDF pour ce document, donc pas de référence imprimée : il se
   lit et se remplit dans le navigateur, il ne circule pas en pièce jointe
   comme une proposition. */
---

<BaseLayout
  title={`Cadrage ${courante.titre} · Coolbeans`}
  description={`Questionnaire de cadrage : ${courante.objet}`}
  noindex
>
  <DocumentEntete
    etape={racine.etape}
    titre={titreEntete(racine)}
    frise={pastilles}
    onglets={chapitres.map((c) => ({ libelle: libelleOnglet(c.data), slug: c.id }))}
    actif={actif}
  />

  {
    chapitres.map((c, i) => (
      <DocumentVolet
        index={i}
        actif={actif}
        total={chapitres.length}
        titre={c.data.titre}
        objet={c.data.objet}
        date={ligneDate(c.data, plusieurs, "Document")}
        sections={sectionsCadrage(c.data)}
      >
        <div class="container-site">
          <div class="mx-auto max-w-[880px] py-16x">
            <CadrageIntro sections={c.data.intro} />

            {c.data.comparatif && (
              <CadrageComparatif
                titre={c.data.comparatif.titre}
                texte={c.data.comparatif.texte}
                solutions={c.data.comparatif.solutions}
                criteres={c.data.comparatif.criteres}
                mentionCout={c.data.comparatif.mentionCout}
                ancre={ancreSection(c.data.comparatif.titre)}
              />
            )}

            {c.data.comparatif?.simulateur && (
              <CadrageSimulateur
                titre={c.data.comparatif.simulateur.titre}
                solutions={c.data.comparatif.solutions}
                prixDefaut={c.data.comparatif.simulateur.prixDefaut}
                prixMin={c.data.comparatif.simulateur.prixMin}
                prixMax={c.data.comparatif.simulateur.prixMax}
                ancre={ancreSection(c.data.comparatif.simulateur.titre)}
              />
            )}

            {c.data.notes.length > 0 && (
              <div class="grid grid-cols-[180px_1fr] gap-10 border-t border-line pt-10 max-[700px]:grid-cols-1 max-[700px]:gap-4">
                <p class="pt-1 font-mono text-[15px] font-extrabold tracking-wide text-ink uppercase">NB</p>
                <div class="flex max-w-[58ch] flex-col gap-3">
                  {c.data.notes.map((note) => (
                    <Banner tone={note.tone}>
                      <Fragment set:html={riche(note.texte)} />
                      {note.tooltip && <Tooltip texte={note.tooltip} />}
                    </Banner>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DocumentReponses
          server:defer
          type="cadrage"
          versions={[{ slug: c.id, version: 1 }]}
          tutoiement={c.data.tutoiement}
        />

        <CadrageFormulaire slug={c.id} questions={c.data.questions} contact={c.data.contact} tutoiement={c.data.tutoiement} />
      </DocumentVolet>
    ))
  }

  <DevisFooter />
</BaseLayout>
```

Recopier les commentaires existants du fichier plutôt que ceux du plan quand ils coïncident, et supprimer les imports devenus inutiles (`GridBackdrop`, `DocumentTopbar`, `dateLongue`).

`versions={[{ slug: c.id, version: 1 }]}` est volontaire : chaque chapitre est un document à part entière pour la base, qui ne doit pas afficher « V2 » sur une réponse au second chapitre.

- [ ] **Étape 6 : réécrire la route du témoignage**

Même structure, sans versions. Remplacer frontmatter et gabarit de `src/pages/temoignage/[...slug].astro` :

```astro
---
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import Banner from "../../components/ui/Banner.astro";
import Tooltip from "../../components/ui/Tooltip.astro";
import CadrageIntro from "../../components/cadrage/CadrageIntro.astro";
import TemoignageCasClient from "../../components/temoignage/TemoignageCasClient.astro";
import TemoignageFormulaire from "../../components/temoignage/TemoignageFormulaire.astro";
import DevisFooter from "../../components/devis/DevisFooter.astro";
import DocumentReponses from "../../components/devis/DocumentReponses.astro";
import DocumentEntete from "../../components/documents/DocumentEntete.astro";
import DocumentVolet from "../../components/documents/DocumentVolet.astro";
import { riche, ancreSection } from "../../lib/devis";
import { construitesEnProduction } from "../../lib/documents/statut";
import { chargerDocuments } from "../../lib/documents/charger";
import { frise } from "../../lib/documents/frise";
import { ligneDate, titreEntete } from "../../lib/documents/entete";
import { sectionsTemoignage } from "../../lib/documents/sections";

/* (garder ici le commentaire actuel de la route, inchangé) */
export async function getStaticPaths() {
  const documents = await chargerDocuments();
  const entries = construitesEnProduction(await getCollection("temoignage"), import.meta.env.DEV);
  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { entry, pastilles: frise(documents, { collection: "temoignage", id: entry.id }, import.meta.env.DEV) },
  }));
}

const { entry, pastilles } = Astro.props;
const d = entry.data;
---

<BaseLayout title={`${d.titre} · Coolbeans`} description={`Témoignage et validation : ${d.objet}`} noindex>
  <DocumentEntete etape={d.etape} titre={titreEntete(d)} frise={pastilles} onglets={[]} actif={0} />

  <DocumentVolet
    index={0}
    actif={0}
    total={1}
    titre={d.titre}
    objet={d.objet}
    date={ligneDate({ date: d.date, version: 1 }, false, "Document")}
    sections={sectionsTemoignage(d)}
  >
    <div class="container-site">
      <div class="mx-auto max-w-[880px] py-16x">
        <CadrageIntro sections={d.intro} />

        {d.casClient && (
          <TemoignageCasClient
            titre={d.casClient.titre}
            texte={d.casClient.texte}
            slug={d.casClient.slug}
            label={d.casClient.label}
            fauxTexte={d.casClient.fauxTexte}
            tutoiement={d.tutoiement}
            ancre={ancreSection(d.casClient.titre)}
          />
        )}

        {d.notes.length > 0 && (
          <div class="mt-16x grid grid-cols-[180px_1fr] gap-10 border-t border-line pt-10 max-[700px]:grid-cols-1 max-[700px]:gap-4">
            <p class="pt-1 font-mono text-[15px] font-extrabold tracking-wide text-ink uppercase">NB</p>
            <div class="flex max-w-[58ch] flex-col gap-3">
              {d.notes.map((note) => (
                <Banner tone={note.tone}>
                  <Fragment set:html={riche(note.texte)} />
                  {note.tooltip && <Tooltip texte={note.tooltip} />}
                </Banner>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </DocumentVolet>

  <DocumentReponses server:defer type="temoignage" versions={[{ slug: entry.id, version: 1 }]} tutoiement={d.tutoiement} />

  {d.formulaire && <TemoignageFormulaire slug={entry.id} questions={d.questions} tutoiement={d.tutoiement} photo={d.photo} />}

  <DevisFooter />
</BaseLayout>
```

Le commentaire `/* (garder ici...) */` est une consigne : le remplacer par le commentaire actuel de la route, et recopier le commentaire HTML qui précède `TemoignageFormulaire` dans le fichier existant.

- [ ] **Étape 7 : vérifier**

```bash
npm test
npm run verify
npm run build
find dist -name index.html \( -path '*/cadrage/*' -o -path '*/devis/*' -o -path '*/livrable/*' -o -path '*/temoignage/*' \) | grep -v '/espace/' | wc -l
grep -l 'http-equiv="refresh"' $(find dist -path '*achat-domaine-4520*' -name index.html) $(find dist -path '*stack-technique-4417*' -name index.html)
```

Attendu : tests, verify et build au vert. 29 fichiers `index.html` : 27 pages de documents et 2 pages de redirection. Le `grep` final cite les deux pages de redirection. Si Astro n'a pas produit de meta refresh, le signaler avant d'improviser une autre redirection.

- [ ] **Étape 8 : commit**

```bash
git add src/lib/documents/affichage.ts src/lib/documents/affichage.test.ts src/components/devis/DocumentReponses.astro src/components/cadrage/CadrageFormulaire.astro 'src/pages/cadrage/[...slug].astro' 'src/pages/temoignage/[...slug].astro'
git commit -m "Le cadrage à chapitres et le témoignage sur l'en-tête partagé"
```

---

### Tâche 9 : la recette mesurée

Vérifie les points de vigilance et les critères de recette que les tests unitaires n'atteignent pas. Rien n'est commité dans cette tâche, sauf les corrections qu'elle fait apparaître.

**Fichiers :**
- Créer (hors dépôt) : `<scratchpad>/recette-documents.mjs`
- Modifier : ce que la recette fait apparaître

- [ ] **Étape 1 : préparer Playwright sans télécharger de navigateur**

```bash
npm i playwright --no-save
npm run dev -- --port 4336
```

Le script utilise le Chrome installé (`channel: "chrome"`) et importe Playwright par chemin absolu, puisqu'il vit hors du worktree.

- [ ] **Étape 2 : écrire le script de recette**

```js
import { chromium } from "/Users/ludovicbourgoin/dev/coolbeans-documents-entete/node_modules/playwright/index.mjs";

const BASE = "http://localhost:4336";
const SORTIE = process.argv[2] ?? ".";
const LARGEURS = [1440, 820, 402];
let echecs = 0;
const verifier = (nom, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "KO  "} ${nom}${ok ? "" : ` : ${detail}`}`);
  if (!ok) echecs++;
};

const navigateur = await chromium.launch({ channel: "chrome" });

async function page(chemin, largeur, sombre = false) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, colorScheme: sombre ? "dark" : "light" });
  const p = await contexte.newPage();
  await p.goto(BASE + chemin, { waitUntil: "networkidle" });
  return p;
}

/* 1. Même abscisse : titre, pastilles, onglets, liens de nav, première section. */
for (const chemin of ["/devis/cafa/site-web-8791", "/livrable/cafa/site-web-8791", "/cadrage/cafa/nom-de-domaine-9042", "/temoignage/amusoire/refonte-site-0040"]) {
  for (const largeur of LARGEURS) {
    const p = await page(chemin, largeur);
    const bords = await p.evaluate(() => {
      const g = (s) => document.querySelector(s)?.getBoundingClientRect().left;
      return {
        titre: g("header h1"),
        pastille: g('nav[aria-label="Documents du projet"] li'),
        onglet: g('[role="tab"]'),
        lien: g("[data-document-volet]:not([hidden]) [data-section-link]"),
        section: g("[data-document-volet]:not([hidden]) section"),
      };
    });
    const ref = bords.titre;
    const ecarts = Object.entries(bords).filter(([, x]) => x !== undefined && Math.abs(x - ref) > 0.5);
    verifier(`${chemin} à ${largeur} px : même abscisse`, ecarts.length === 0, JSON.stringify(bords));
    await p.context().close();
  }
}

/* 2. Changer d'onglet ne change rien au-dessus de la barre ; le formulaire suit l'onglet. */
for (const [chemin, form] of [["/devis/cafa/site-web-8791", "#devis-form"], ["/livrable/cafa/site-web-8791", "#livrable-form"]]) {
  const p = await page(chemin, 1440);
  const zone = () => p.evaluate(() => document.querySelector("header h1").textContent + "|" + document.querySelector('nav[aria-label="Documents du projet"]').textContent);
  const avant = await zone();
  await p.click('[data-document-onglet="0"]');
  verifier(`${chemin} : zone stable identique après bascule`, (await zone()) === avant);
  const slug = await p.$eval('[data-document-onglet="0"]', (b) => b.dataset.slug);
  const slugForm = await p.$eval(form, (f) => f.dataset.slug).catch(() => "absent");
  verifier(`${chemin} : le formulaire suit l'onglet V1`, slugForm === slug, `${slugForm} au lieu de ${slug}`);
  await p.context().close();
}

/* 3. Un lien de nav mène à la section du volet affiché. */
{
  const p = await page("/livrable/cafa/site-web-8791", 1440);
  // Le deuxième lien : le premier mène à une section déjà sous la barre.
  const liens = await p.$$("[data-document-volet]:not([hidden]) [data-section-link]");
  const lien = liens[1] ?? liens[0];
  const href = await lien.getAttribute("href");
  await lien.click();
  await p.waitForTimeout(800);
  const haut = await p.evaluate((id) => document.querySelector(`[data-document-volet]:not([hidden]) section[id="${id}"]`)?.getBoundingClientRect().top, href.slice(1));
  verifier("livrable CAFA : le lien de nav mène au volet affiché", haut !== undefined && haut >= 0 && haut < 200, `top=${haut}`);
  await p.context().close();
}

/* 4. À l'impression, ni filet, ni en-tête, ni nav. */
{
  const p = await page("/devis/cafa/site-web-8791", 1440);
  await p.emulateMedia({ media: "print" });
  const visibles = await p.evaluate(() =>
    ["header", 'nav[aria-label="Documents du projet"]', "[data-document-sections]", '[role="tablist"]']
      .filter((s) => { const e = document.querySelector(s); return e && e.offsetParent !== null; }),
  );
  verifier("proposition imprimée : pas d'en-tête web", visibles.length === 0, visibles.join(", "));
  await p.context().close();
}

/* 5. Deux chapitres : deux formulaires, deux ids distincts. */
{
  const p = await page("/cadrage/cafa/nom-de-domaine-9042", 1440);
  const n = await p.$$eval("form[data-cadrage-form]", (f) => f.length);
  const ids = await p.$$eval("[id]", (els) => els.map((e) => e.id));
  const doublons = ids.filter((id, i) => ids.indexOf(id) !== i && id.startsWith("cadrage-"));
  verifier("cadrage CAFA : un formulaire par chapitre", n === 2, `${n} formulaire(s)`);
  verifier("cadrage CAFA : aucun id de formulaire en double", doublons.length === 0, doublons.join(", "));
  await p.context().close();
}

/* 6. Hors nomenclature : pas de frise, le titre du document en h1. */
{
  const p = await page("/devis/en-haut", 1440);
  verifier("En Haut : pas de frise", (await p.$('nav[aria-label="Documents du projet"]')) === null);
  verifier("En Haut : titre du document en h1", (await p.textContent("header h1")).includes("En Haut"));
  await p.context().close();
}

/* 7. Les anciennes adresses des chapitres mènent à leur racine. */
for (const [ancienne, racine] of [["/cadrage/cafa/achat-domaine-4520", "/cadrage/cafa/nom-de-domaine-9042"], ["/cadrage/serial-generations/stack-technique-4417", "/cadrage/serial-generations/site-web-3720"]]) {
  const p = await page(ancienne, 1440);
  await p.waitForURL((u) => u.pathname === racine, { timeout: 5000 }).catch(() => {});
  verifier(`${ancienne} redirige`, new URL(p.url()).pathname === racine, p.url());
  await p.context().close();
}

/* 8. Frise de la proposition CAFA : cinq pastilles, Cadrage estompée, Production cliquable. */
{
  const p = await page("/devis/cafa/site-web-8791", 1440);
  const items = await p.$$eval('nav[aria-label="Documents du projet"] li > *', (els) => els.map((e) => [e.tagName, e.getAttribute("href"), e.getAttribute("aria-current")]));
  verifier("frise CAFA : cinq pastilles", items.length === 5, JSON.stringify(items));
  verifier("frise CAFA : Cadrage estompée", items[0]?.[0] === "SPAN");
  verifier("frise CAFA : Proposition courante", items[1]?.[2] === "page");
  verifier("frise CAFA : Production mène au cadrage", items[2]?.[1] === "/cadrage/cafa/nom-de-domaine-9042");
  await p.context().close();
}

/* 9. EnvBanner au-dessus de la barre, filet dessous, sans chevauchement. */
{
  const p = await page("/devis/cafa/site-web-8791", 1440);
  const r = await p.evaluate(() => {
    const barre = document.querySelector("body > header, header.bg-surface-subtle")?.getBoundingClientRect();
    const filet = document.querySelector('div[aria-hidden="true"].h-\\[3px\\]')?.getBoundingClientRect();
    return { barreBas: barre?.bottom, filetHaut: filet?.top };
  });
  verifier("filet collé sous la barre", r.filetHaut !== undefined && Math.abs(r.filetHaut - r.barreBas) < 1, JSON.stringify(r));
  await p.context().close();
}

/* 10. Captures pour Ludo : clair, sombre, mobile. */
for (const [nom, largeur, sombre] of [["cafa-proposition-clair", 1440, false], ["cafa-proposition-sombre", 1440, true], ["cafa-livrable-mobile", 402, false]]) {
  const p = await page(nom.includes("livrable") ? "/livrable/cafa/site-web-8791" : "/devis/cafa/site-web-8791", largeur, sombre);
  await p.screenshot({ path: `${SORTIE}/${nom}.png`, fullPage: false });
  await p.context().close();
}

await navigateur.close();
console.log(echecs === 0 ? "\nRecette : tout passe." : `\nRecette : ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
```

- [ ] **Étape 3 : lancer la recette**

```bash
node <scratchpad>/recette-documents.mjs <scratchpad>
```

Attendu : « Recette : tout passe. » Un KO se corrige dans le composant ou la route concernés, se commite avec un message qui dit ce qui était faux, puis la recette se relance en entier.

- [ ] **Étape 4 : relecture visuelle des captures**

Ouvrir les trois captures. Vérifier : le filet a la teinte de l'étape en clair et en sombre ; la pastille courante est teintée ; en mobile, la nav des sections défile latéralement sans déborder de la page. Noter tout écart dans le compte rendu de la tâche, captures jointes.

---

### Tâche 10 : revue de confidentialité et mise à jour de la spec

**Fichiers :**
- Modifier : `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md`

- [ ] **Étape 1 : la revue, champ par champ**

Pour chacune des quatre collections, lister dans un tableau chaque champ du schéma (`src/content.config.ts`) et dire s'il est rendu à l'écran, à l'impression, ou jamais. Pour chaque champ rendu, vérifier sur les 36 fichiers qu'aucun ne porte : marge, coût interne, charge en jours, note sur le client, élément de concurrence (spec §9). Les commentaires YAML (`#`) ne sont jamais rendus : les exclure.

Consigner le résultat dans la section 9 de la spec, sous « Revue du 2026-09-29 », avec un tableau par collection. Un champ douteux ne se corrige pas : il se signale à Ludo avec le fichier et la ligne.

- [ ] **Étape 2 : mettre la spec à jour**

1. Section 1 : dans le schéma de l'en-tête, déplacer la ligne du filet sous la ligne `coolbeans [connexion]`, conformément à la section 5.
2. Section 5 : remplacer « En développement et en préproduction, `EnvBanner` occupe déjà cette place, les deux se superposeront : à traiter. » par « `EnvBanner` reste au-dessus de la barre, dans le flux : les deux ne se superposent pas. »
3. Section 11 : ajouter en tête « La table qui fait autorité est `src/lib/documents/nomenclature.ts`. » puis trois lignes : `serial-generations` porte deux chapitres de cadrage en onglets (« Le site », « WordPress ou pas ») ; la réservation en ligne de Sète En Corps Mieux est un projet à part, « Réservation en ligne des cours » ; la proposition En Haut reste hors nomenclature, l'affaire étant rouverte sur un nouveau projet.
4. Reprise de l'existant : 36 documents, dont 9 versions ou chapitres, soit 27 racines.
5. Critères de recette : cocher ceux que la tâche 9 a vérifiés.

- [ ] **Étape 3 : commit**

```bash
git add docs/superpowers/specs/2026-09-22-documents-client-entete-design.md
git commit -m "La spec porte la revue de confidentialité et l'état après les lots 2 et 3"
```

---

## Après la dernière tâche

Hors sous-agents, par le fil principal :

1. Revue de toute la branche (`superpowers:requesting-code-review`).
2. Montrer à Ludo en local : `http://localhost:4336/devis/cafa/site-web-8791` et les captures de la tâche 9.
3. Sur son accord : fusion dans `staging`, cocher les critères de COO-234 et COO-235 dans Linear, passer les deux issues en Done une fois la préproduction vérifiée.
4. Supprimer le worktree une fois la relecture finie, pas avant (le serveur local sert à la relecture).

## Ce que ce lot ne fait pas

- Les nouvelles adresses, les 301 et l'ouverture depuis le portail : lot 4, COO-236.
- La collection `audit` et sa route : COO-295. La frise l'accueille déjà.
- La création des cinq trames d'un projet neuf (spec §10) : aucun lot ne la porte encore.
