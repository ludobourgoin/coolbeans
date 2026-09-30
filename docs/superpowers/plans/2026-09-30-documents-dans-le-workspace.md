# Sous-projet 1 : les documents client dans le workspace

> **Pour les agents :** SOUS-SKILL REQUISE : `superpowers:subagent-driven-development` (recommandée) ou `superpowers:executing-plans`, tâche par tâche. Les étapes se suivent en cases à cocher (`- [ ]`).

**But :** un document client se lit dans le portail, à `my.coolbeans.cc/projets/<projet>/<étape>`, par les seuls comptes qui y ont droit, avec une section par projet dans la barre latérale et un bandeau pour l'admin sur ce que le client ne voit pas.

**Architecture :** la règle d'accès, la résolution d'une adresse du portail et les sections de la barre latérale sont des fonctions pures de `src/lib/documents/`, testées sous Vitest. Les gabarits des quatre routes publiques déménagent dans quatre composants de page, rendus par les routes publiques (inchangées pour le lecteur) et par une nouvelle route du portail rendue à la demande. Les adresses publiques restent servies : leur fermeture est le sous-projet 6.

**Stack :** Astro 7 (pages prérendues et pages à la demande), collections de contenu Zod, Better Auth (session déjà résolue par `getPortalContext`), Tailwind 4 sur les tokens, `doc.css` pour la coquille du portail, Vitest, Playwright sur le Chrome installé pour la recette.

**Spec :** `docs/superpowers/specs/2026-09-30-documents-prives-workspace-design.md`, section « Sous-projet 1 ». Elle s'appuie sur `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md` (lots 1 à 3, en production).

**Worktree :** `~/dev/coolbeans-documents-portail`, branche `feat/documents-portail`, montée depuis `origin/staging`, avec `.env`, `.dev.vars` et `.wrangler/state`. Toutes les commandes partent de cette racine. Serveur de développement sur le port 4337.

## Contraintes globales

- **Les adresses publiques ne bougent pas et s'affichent à l'identique.** Captures avant et après, zéro pixel d'écart. Leur fermeture est le sous-projet 6.
- **Aucun slug de fichier ne bouge.** Les réponses en D1 et les formulaires restent indexés par le slug du fichier.
- **L'adresse du portail** est `/projets/<projet>/<étape>` sur my.coolbeans.cc, `/espace/projets/<projet>/<étape>` en interne. Toujours construite par `portalHref`, jamais écrite à la main.
- **Refus = 404, jamais 403 ni redirection.** On ne révèle pas qu'un document existe.
- **Qui lit quoi.** Portée du compte d'abord (`workspacesVisibles`). Un client et un revendeur ne lisent que `publie`. L'admin lit tout. Dans un workspace de revendeur (organisation autre que `coolbeans`), la proposition (`devis`) ne se lit que par les comptes revendeur et l'admin.
- **Bandeaux, admin seulement.** « Brouillon · le client ne voit pas ce document » et « Réservé au revendeur · le client final ne voit pas ce document ». Le brouillon prime quand les deux s'appliquent.
- **Le piège `doc.css`.** Dans le portail, tout vit sous `.doc-root`, dont les règles à deux classes battent les utilitaires. Aucun composant de document ne porte de classe que `doc.css` style : `card`, `cards`, `sub`, `brand`, `topnav`, `spacer`, `tgl`.
- **Styles** : utilitaires Tailwind sur les tokens. Aucun bloc `<style>` neuf dans un composant ; `doc.css` reçoit les règles propres à la coquille du portail. Toujours `text-[13px]/[1.4]`, jamais un `text-[..]` sans hauteur de ligne.
- **Français** : le hook `relire-francais.mjs` relit `.md`, `.mdx`, `.yaml`, `.astro`. Prose d'un gabarit `.astro` (commentaires compris) : espace insécable avant « : » et dans « », fine insécable avant « ; ? ! ». Frontmatter, `<script>`, `<style>` et fichiers `.ts` exclus. Aucun tiret cadratin. Si le hook signale du code, ne pas le « corriger » : le signaler.
- **Aucune publication en production.** La branche se montre en local, puis se fusionne dans `staging` sur l'accord de Ludo.

## Points de vigilance

Ce que la spec implique sans qu'un test unitaire l'atteigne entièrement. Chaque ligne a un test ou une vérification dans la tâche qui possède le code.

1. **Une adresse tapée à la main.** Un client qui tape l'adresse d'un document d'un autre workspace reçoit une 404, comme pour un projet qui n'existe pas. Tâche 2 (tests de `lecture`), tâche 6 (même réponse pour les deux cas).
2. **Une V2 en brouillon sur une proposition publiée.** Le client voit la V1 seule, sans onglet fantôme, et son formulaire répond à la V1. L'admin voit les deux onglets, la V2 sous son bandeau. Tâche 2 (`versionsDuPortail`), tâche 6.
3. **Un admin ou un revendeur qui ouvre le document d'un autre workspace.** Le workspace courant bascule dessus, et la barre latérale montre ses projets. Tâche 6.
4. **Imprimer depuis le portail.** Ni barre du portail, ni barre latérale, ni bandeau sur le papier. Tâche 6 (règles `@media print`), recette finale.
5. **La proposition d'un workspace de revendeur, vue par un client final.** Étape 2 estompée dans la frise, aucune entrée dans la barre latérale, 404 par adresse. Tâche 2 (tests), tâche 3 (sections).

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/documents/nomenclature.ts` | modifié : `verifierCles`, `workspaceDuProjet` |
| `src/lib/documents/projet.ts` | modifié : `date` sur `DocumentProjet` |
| `src/lib/documents/charger.ts` | modifié : lit aussi les fiches client, pose `date` |
| `src/lib/documents/acces.ts` | créé : `lecture`, `documentDuPortail`, `cheminPortail`, `versionsDuPortail` |
| `src/lib/documents/frise.ts` | modifié : `friseAvec`, `frise` devient son cas public |
| `src/lib/documents/projets-portail.ts` | créé : `sectionsProjets` |
| `src/lib/documents/adresse.ts` | créé : `adresseDocument` |
| `src/lib/portail/nav.ts` | modifié : `buildSidebar` reçoit les sections de projet |
| `src/lib/portail/workspaces.ts` | modifié : `cle` sur `PortalWorkspace` |
| `src/content.config.ts` | modifié : `cle` dans le schéma `clients` |
| `src/content/clients/*.yaml` | modifiés : `cle` sur neuf fiches |
| `src/components/documents/pages/Page{Cadrage,Proposition,Livrable,Temoignage}.astro` | créés : le corps des quatre gabarits |
| `src/components/documents/BandeauAcces.astro` | créé : le bandeau de l'admin |
| `src/components/documents/DocumentEntete.astro`, `DocumentVolet.astro`, `DocumentSections.astro` | modifiés : contexte, bandeau de volet, décalage de la nav collante |
| sept composants portant `card` | modifiés : utilitaires à la place de `card` |
| `src/pages/{cadrage,devis,livrable,temoignage}/[...slug].astro` | modifiés : rendent leur composant de page |
| `src/pages/espace/projets/[projet]/[etape].astro` | créé : la route du portail |
| `src/layouts/PortalLayout.astro` | modifié : variante document, sections de projet |
| `src/styles/doc.css` | modifié : règles des documents dans le portail, impression |
| `scripts/verify-design-system.js` | modifié : le bloc `<style>` du devis change de fichier |
| appels d'adresse publique (dix fichiers, tâche 8) | modifiés : passent par `adresseDocument` |
| `src/content/docs/coolbeans/04-portail.mdx` | modifié : les documents dans le portail |

---

### Tâche 1 : relier les workspaces à la nomenclature

**Fichiers :**
- Modifier : `src/content.config.ts` (collection `clients`), `src/lib/portail/workspaces.ts` (interface `PortalWorkspace`)
- Modifier : `src/lib/documents/nomenclature.ts`, `src/lib/documents/nomenclature.test.ts`
- Modifier : `src/lib/documents/projet.ts`, `src/lib/documents/charger.ts`
- Modifier : neuf fiches de `src/content/clients/`

**Interfaces :**
- Consomme : `CLIENTS`, `clientDuProjet` (déjà dans `nomenclature.ts`), `verifierNomenclature`, `DocumentProjet` (`projet.ts`).
- Produit : `PortalWorkspace.cle?: string` ; `verifierCles(workspaces: readonly { slug: string; cle?: string }[]): string[]` ; `workspaceDuProjet<W extends { cle?: string }>(workspaces: readonly W[], projet: string): W | undefined` ; `DocumentProjet.date?: Date`, posé par `chargerDocuments()`.

- [ ] **Étape 1 : installer et vérifier le point de départ**

```bash
npm ci
npm test
```

Attendu : tout passe. Sinon, s'arrêter et le signaler.

- [ ] **Étape 2 : écrire les tests**

Ajouter à `src/lib/documents/nomenclature.test.ts` (ajouter `verifierCles` et `workspaceDuProjet` à l'import de `./nomenclature`) :

```ts
test("la clé d'une fiche client doit exister dans la nomenclature", () => {
  expect(verifierCles([{ slug: "cafa", cle: "caf" }])).toEqual([]);
  expect(verifierCles([{ slug: "inconnu", cle: "zzz" }])).toEqual([
    "clients/inconnu : clé « zzz » absente de la nomenclature",
  ]);
});

test("une clé ne sert qu'un workspace", () => {
  expect(verifierCles([{ slug: "cafa", cle: "caf" }, { slug: "cafa-bis", cle: "caf" }])).toEqual([
    "clé « caf » portée par deux workspaces (cafa, cafa-bis)",
  ]);
});

test("un workspace sans clé n'est pas une erreur", () => {
  expect(verifierCles([{ slug: "coolbeans" }, { slug: "spinoza" }])).toEqual([]);
});

test("le workspace d'un projet se trouve par la clé de son client", () => {
  const ws = [{ slug: "cafa", cle: "caf" }, { slug: "coolbeans" }];
  expect(workspaceDuProjet(ws, "site-web-879")?.slug).toBe("cafa");
  // unl existe dans la nomenclature, mais aucun workspace de ce jeu ne porte sa clé.
  expect(workspaceDuProjet(ws, "plateforme-327")).toBeUndefined();
  expect(workspaceDuProjet(ws, "inconnu-000")).toBeUndefined();
});
```

- [ ] **Étape 3 : vérifier que les tests échouent**

Run : `npx vitest run src/lib/documents/nomenclature.test.ts`
Attendu : FAIL, `verifierCles` et `workspaceDuProjet` ne sont pas exportés.

- [ ] **Étape 4 : écrire les deux fonctions**

Ajouter à la fin de `src/lib/documents/nomenclature.ts` :

```ts
/** Les incohérences entre les fiches client du portail et la nomenclature. */
export function verifierCles(workspaces: readonly { slug: string; cle?: string }[]): string[] {
  const erreurs: string[] = [];
  const vues = new Map<string, string>();
  for (const w of workspaces) {
    if (!w.cle) continue;
    if (!Object.hasOwn(CLIENTS, w.cle)) {
      erreurs.push(`clients/${w.slug} : clé « ${w.cle} » absente de la nomenclature`);
    }
    const deja = vues.get(w.cle);
    if (deja) erreurs.push(`clé « ${w.cle} » portée par deux workspaces (${deja}, ${w.slug})`);
    else vues.set(w.cle, w.slug);
  }
  return erreurs;
}

/** Le workspace d'un projet : celui qui porte la clé du client du projet. */
export function workspaceDuProjet<W extends { cle?: string }>(
  workspaces: readonly W[],
  projet: string,
): W | undefined {
  const cle = clientDuProjet(projet);
  return cle ? workspaces.find((w) => w.cle === cle) : undefined;
}
```

Run : `npx vitest run src/lib/documents/nomenclature.test.ts`
Attendu : PASS.

- [ ] **Étape 5 : le champ `cle` dans le schéma et le type**

Dans `src/content.config.ts`, collection `clients`, ajouter après la ligne `organisation: z.string(),` :

```ts
    /* Clé client de la nomenclature des documents (lib/documents/nomenclature.ts) :
       la clé de team Linear, en minuscules. Le projet d'un document donne la
       clé, la clé donne le workspace. Absente, le workspace n'a aucun document
       du cycle. Vérifiée au build par lib/documents/charger.ts. */
    cle: z.string().regex(/^[a-z]{3}$/).optional(),
```

Dans `src/lib/portail/workspaces.ts`, interface `PortalWorkspace`, ajouter après `organisation` :

```ts
  /** Clé client de la nomenclature des documents. Absente = aucun document du cycle. */
  cle?: string;
```

`listWorkspaces()` recopie déjà tout `e.data` : rien d'autre à changer.

- [ ] **Étape 6 : poser les clés**

Ajouter une ligne `cle: <clé>` juste après la ligne `organisation:` de chacune de ces fiches, et d'aucune autre :

| Fiche | `cle` |
|---|---|
| `src/content/clients/amusoire.yaml` | `amu` |
| `src/content/clients/cafa.yaml` | `caf` |
| `src/content/clients/fylgo.yaml` | `fyl` |
| `src/content/clients/littlebox.yaml` | `lit` |
| `src/content/clients/mathilde-chevalier.yaml` | `mat` |
| `src/content/clients/oide.yaml` | `oid` |
| `src/content/clients/revolutions-douces.yaml` | `rev` |
| `src/content/clients/setencorpsmieux.yaml` | `set` |
| `src/content/clients/unlockbreath.yaml` | `unl` |

Les clients sans workspace (`mal`, `mih`, `uni`, `vic`) en recevront un aux sous-projets 5 et 6.

- [ ] **Étape 7 : la date et la vérification des clés au build**

Dans `src/lib/documents/projet.ts`, interface `DocumentProjet`, ajouter après `versionDe?: string;` :

```ts
  /** Date du document, pour ordonner les projets dans la barre latérale du portail. */
  date?: Date;
```

Dans `src/lib/documents/charger.ts` :
1. Importer `verifierCles` depuis `./nomenclature`.
2. Dans l'objet construit pour chaque entrée, ajouter `date: e.data.date,`.
3. Remplacer la ligne `const erreurs = verifierNomenclature(documents);` par :

```ts
  const clients = (await getCollection("clients")).map((e) => ({ slug: e.id, cle: e.data.cle }));
  const erreurs = [...verifierNomenclature(documents), ...verifierCles(clients)];
```

4. Ajouter au commentaire d'en-tête : « Il vérifie aussi les clés des fiches client, qui relient un workspace à ses documents. »

- [ ] **Étape 8 : vérifier**

```bash
npm test
npm run build
```

Attendu : tout passe. Pour prouver que la vérification est branchée, poser temporairement `cle: zzz` sur `src/content/clients/spinoza.yaml`, lancer `npm run build` : il doit échouer sur « clients/spinoza : clé « zzz » absente de la nomenclature ». Retirer la ligne, relancer : vert.

- [ ] **Étape 9 : commit**

```bash
git add src/content.config.ts src/lib/portail/workspaces.ts src/lib/documents/nomenclature.ts src/lib/documents/nomenclature.test.ts src/lib/documents/projet.ts src/lib/documents/charger.ts src/content/clients/amusoire.yaml src/content/clients/cafa.yaml src/content/clients/fylgo.yaml src/content/clients/littlebox.yaml src/content/clients/mathilde-chevalier.yaml src/content/clients/oide.yaml src/content/clients/revolutions-douces.yaml src/content/clients/setencorpsmieux.yaml src/content/clients/unlockbreath.yaml
git commit -m "Chaque workspace porte la clé client de ses documents"
```

---

### Tâche 2 : qui lit quoi

**Fichiers :**
- Créer : `src/lib/documents/acces.ts`, `src/lib/documents/acces.test.ts`
- Modifier : `src/lib/documents/frise.ts`, `src/lib/documents/frise.test.ts`

**Interfaces :**
- Consomme : `DocumentProjet` (`projet.ts`), `PortalRole` (`src/lib/portail/metadata.ts`), `DEFINITIONS` via `frise.ts`.
- Produit :
  - `interface CompteLecteur { role: PortalRole; portee: readonly string[] }` (slugs de `workspacesVisibles`) ;
  - `interface WorkspaceLu { slug: string; organisation: string }` ;
  - `ORGANISATION_COOLBEANS = "coolbeans"` ;
  - `type Bandeau = "brouillon" | "revendeur"` ; `type Lecture = { lisible: false } | { lisible: true; bandeau: Bandeau | null }` ;
  - `lecture(doc: Pick<DocumentProjet, "collection" | "statut">, compte: CompteLecteur, workspace: WorkspaceLu): Lecture` ;
  - `documentDuPortail(documents: DocumentProjet[], projet: string, etape: string): DocumentProjet | undefined` ;
  - `cheminPortail(doc: Pick<DocumentProjet, "projet" | "etape">): string`, le chemin sous `/espace`, à passer par `portalHref` ;
  - `versionsDuPortail(documents: DocumentProjet[], racine: DocumentProjet, lire: (d: DocumentProjet) => Lecture): { ids: string[]; bandeaux: Record<string, Bandeau> }` ;
  - dans `frise.ts` : `friseAvec(documents, courant, lisible: (d: DocumentProjet) => boolean, url: (d: DocumentProjet) => string): Pastille[]`. `frise(documents, courant, dev)` garde sa signature et son comportement.

- [ ] **Étape 1 : écrire les tests de l'accès**

Créer `src/lib/documents/acces.test.ts` :

```ts
import { expect, test } from "vitest";
import { cheminPortail, documentDuPortail, lecture, versionsDuPortail, type CompteLecteur } from "./acces";
import type { DocumentProjet } from "./projet";

const direct = { slug: "cafa", organisation: "coolbeans" };
const revendu = { slug: "amusoire", organisation: "trigger" };

const client = (slug: string): CompteLecteur => ({ role: "client", portee: [slug] });
const revendeur: CompteLecteur = { role: "revendeur", portee: ["amusoire"] };
const admin: CompteLecteur = { role: "admin", portee: ["cafa", "amusoire", "coolbeans"] };

const proposition = { collection: "devis" as const, statut: "publie" as const };
const cadrage = { collection: "cadrage" as const, statut: "publie" as const };

test("un client lit un document publié de son workspace", () => {
  expect(lecture(proposition, client("cafa"), direct)).toEqual({ lisible: true, bandeau: null });
});

test("hors de la portée du compte, rien ne se lit, même publié", () => {
  // Une adresse tapée à la main ne doit rien ouvrir (point de vigilance 1).
  expect(lecture(proposition, client("amusoire"), direct)).toEqual({ lisible: false });
  expect(lecture(proposition, revendeur, direct)).toEqual({ lisible: false });
});

test("un brouillon ou une trame ne se lit que par l'admin, sous le bandeau", () => {
  for (const statut of ["brouillon", "trame"] as const) {
    const doc = { collection: "cadrage" as const, statut };
    expect(lecture(doc, client("cafa"), direct)).toEqual({ lisible: false });
    expect(lecture(doc, revendeur, revendu)).toEqual({ lisible: false });
    expect(lecture(doc, admin, direct)).toEqual({ lisible: true, bandeau: "brouillon" });
  }
});

test("la proposition d'un workspace de revendeur ne se lit que par le revendeur et l'admin", () => {
  expect(lecture(proposition, revendeur, revendu)).toEqual({ lisible: true, bandeau: null });
  expect(lecture(proposition, client("amusoire"), revendu)).toEqual({ lisible: false });
  expect(lecture(proposition, admin, revendu)).toEqual({ lisible: true, bandeau: "revendeur" });
});

test("le bandeau de brouillon prime sur celui du revendeur", () => {
  const brouillon = { collection: "devis" as const, statut: "brouillon" as const };
  expect(lecture(brouillon, admin, revendu)).toEqual({ lisible: true, bandeau: "brouillon" });
});

test("les autres documents d'un workspace de revendeur se lisent par ses invités", () => {
  expect(lecture(cadrage, client("amusoire"), revendu)).toEqual({ lisible: true, bandeau: null });
});

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  ...p,
});

const cafa = [
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791", statut: "brouillon" }),
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison" }),
];

test("une adresse du portail désigne une racine, jamais une version", () => {
  expect(documentDuPortail(cafa, "site-web-879", "proposition")?.id).toBe("cafa/site-web-8791");
  expect(documentDuPortail(cafa, "site-web-879", "livraison")?.collection).toBe("livrable");
  expect(documentDuPortail(cafa, "site-web-879", "suivi")).toBeUndefined();
  expect(documentDuPortail(cafa, "inconnu-000", "proposition")).toBeUndefined();
});

test("le chemin du portail se construit depuis le projet et l'étape", () => {
  expect(cheminPortail(cafa[0])).toBe("/projets/site-web-879/proposition");
  expect(() => cheminPortail({ etape: "proposition" })).toThrow();
});

test("une V2 en brouillon disparaît pour le client et porte son bandeau pour l'admin", () => {
  // Point de vigilance 2.
  const pour = (compte: CompteLecteur) => versionsDuPortail(cafa, cafa[0], (d) => lecture(d, compte, direct));
  expect(pour(client("cafa"))).toEqual({ ids: ["cafa/site-web-8791"], bandeaux: {} });
  expect(pour(admin)).toEqual({
    ids: ["cafa/site-web-8791", "cafa/site-web-v2-4106"],
    bandeaux: { "cafa/site-web-v2-4106": "brouillon" },
  });
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/acces.test.ts`
Attendu : FAIL, module `./acces` introuvable.

- [ ] **Étape 3 : écrire `acces.ts`**

```ts
/* Qui lit quel document dans le portail (spec 2026-09-30, sous-projet 1).
 *
 * Trois questions, dans cet ordre :
 * 1. le workspace du document est-il dans la portée du compte ? Sinon rien ;
 * 2. le document est-il publié ? Sinon l'admin seul, sous un bandeau ;
 * 3. est-ce la proposition d'un workspace de revendeur ? Elle est adressée au
 *    revendeur et porte le prix de Coolbeans au revendeur : les comptes du
 *    client final ne la lisent pas.
 *
 * Fonctions pures, comme workspacesVisibles : la route les appelle, les tests
 * les exercent sans session ni base.
 */
import type { PortalRole } from "../portail/metadata";
import type { DocumentProjet } from "./projet";

/** Le compte connecté, réduit à ce que la règle lit. */
export interface CompteLecteur {
  role: PortalRole;
  /** Slugs des workspaces de sa portée (workspacesVisibles). */
  portee: readonly string[];
}

/** Le workspace du document, réduit à ce que la règle lit. */
export interface WorkspaceLu {
  slug: string;
  organisation: string;
}

/** Un workspace de cette organisation est un client direct de Coolbeans. */
export const ORGANISATION_COOLBEANS = "coolbeans";

export type Bandeau = "brouillon" | "revendeur";
export type Lecture = { lisible: false } | { lisible: true; bandeau: Bandeau | null };

export function lecture(
  doc: Pick<DocumentProjet, "collection" | "statut">,
  compte: CompteLecteur,
  workspace: WorkspaceLu,
): Lecture {
  if (!compte.portee.includes(workspace.slug)) return { lisible: false };
  const admin = compte.role === "admin";
  if (doc.statut !== "publie") return admin ? { lisible: true, bandeau: "brouillon" } : { lisible: false };
  const auRevendeur = doc.collection === "devis" && workspace.organisation !== ORGANISATION_COOLBEANS;
  if (auRevendeur) {
    if (admin) return { lisible: true, bandeau: "revendeur" };
    return compte.role === "revendeur" ? { lisible: true, bandeau: null } : { lisible: false };
  }
  return { lisible: true, bandeau: null };
}

/** La racine visée par une adresse du portail. Une version n'a pas d'adresse. */
export function documentDuPortail(
  documents: DocumentProjet[],
  projet: string,
  etape: string,
): DocumentProjet | undefined {
  return documents.find((d) => !d.versionDe && d.projet === projet && d.etape === etape);
}

/** Le chemin d'un document sous /espace. Toujours passer le résultat à portalHref. */
export function cheminPortail(doc: Pick<DocumentProjet, "projet" | "etape">): string {
  if (!doc.projet) throw new Error("cheminPortail : document hors nomenclature");
  return `/projets/${doc.projet}/${doc.etape}`;
}

/**
 * Les onglets d'une page du portail : la racine et ses versions que le compte
 * lit, avec le bandeau de chacune. Une version illisible disparaît, sans
 * laisser d'onglet vide.
 */
export function versionsDuPortail(
  documents: DocumentProjet[],
  racine: DocumentProjet,
  lire: (d: DocumentProjet) => Lecture,
): { ids: string[]; bandeaux: Record<string, Bandeau> } {
  const groupe = [
    racine,
    ...documents.filter((d) => d.collection === racine.collection && d.versionDe === racine.id),
  ];
  const ids: string[] = [];
  const bandeaux: Record<string, Bandeau> = {};
  for (const d of groupe) {
    const l = lire(d);
    if (!l.lisible) continue;
    ids.push(d.id);
    if (l.bandeau) bandeaux[d.id] = l.bandeau;
  }
  return { ids, bandeaux };
}
```

Run : `npx vitest run src/lib/documents/acces.test.ts`
Attendu : PASS.

- [ ] **Étape 4 : écrire le test de `friseAvec`**

Ajouter à `src/lib/documents/frise.test.ts` (ajouter `friseAvec` à l'import de `./frise`) :

```ts
test("dans le portail, la frise suit ce que le compte lit et pointe vers le portail", () => {
  const lisible = (d: DocumentProjet) => d.collection !== "livrable";
  const url = (d: DocumentProjet) => `/projets/${d.projet}/${d.etape}`;
  const p = friseAvec(cafa, devisCafa, lisible, url);
  expect(p.map((x) => x.href)).toEqual([
    undefined,
    "/projets/site-web-879/proposition",
    "/projets/site-web-879/production",
    undefined,
    undefined,
  ]);
});
```

Run : `npx vitest run src/lib/documents/frise.test.ts`
Attendu : FAIL, `friseAvec` n'est pas exporté.

- [ ] **Étape 5 : écrire `friseAvec`**

Dans `src/lib/documents/frise.ts`, remplacer la fonction `frise` par :

```ts
/**
 * La frise, avec la règle de lecture et la fabrique d'adresse du contexte.
 * Public : `frise` ci-dessous. Portail : la route passe `lecture` et
 * `portalHref(cheminPortail(d))`.
 */
export function friseAvec(
  documents: DocumentProjet[],
  courant: Pick<DocumentProjet, "collection" | "id">,
  lisible: (d: DocumentProjet) => boolean,
  url: (d: DocumentProjet) => string,
): Pastille[] {
  const racine = documents.find(
    (d) => !d.versionDe && d.collection === courant.collection && d.id === courant.id,
  );
  if (!racine?.projet) return [];

  const duProjet = documents.filter((d) => !d.versionDe && d.projet === racine.projet);
  const aUnAudit = duProjet.some((d) => d.etape === "audit");

  return DEFINITIONS.filter((def) => def.etape !== "audit" || aUnAudit).map((def) => {
    const doc = duProjet.find((d) => d.etape === def.etape);
    const servi = doc !== undefined && lisible(doc);
    return { ...def, courante: def.etape === racine.etape, href: servi ? url(doc) : undefined };
  });
}

/** La frise des pages publiques : un document non publié n'est servi qu'en développement. */
export function frise(
  documents: DocumentProjet[],
  courant: Pick<DocumentProjet, "collection" | "id">,
  dev: boolean,
): Pastille[] {
  return friseAvec(documents, courant, (d) => dev || d.statut === "publie", urlDocument);
}
```

- [ ] **Étape 6 : vérifier**

Run : `npx vitest run src/lib/documents/` puis `npm test`
Attendu : PASS, les tests de `frise` existants inchangés.

- [ ] **Étape 7 : commit**

```bash
git add src/lib/documents/acces.ts src/lib/documents/acces.test.ts src/lib/documents/frise.ts src/lib/documents/frise.test.ts
git commit -m "La règle de lecture des documents dans le portail"
```

---

### Tâche 3 : une section par projet dans la barre latérale

**Fichiers :**
- Créer : `src/lib/documents/projets-portail.ts`, `src/lib/documents/projets-portail.test.ts`
- Modifier : `src/lib/portail/nav.ts`, `src/lib/portail/nav.test.ts`

**Interfaces :**
- Consomme : `definitionEtape` (`etapes.ts`), `clientDuProjet` (`nomenclature.ts`), `cheminPortail` (tâche 2), `DocumentProjet` avec `date` (tâche 1).
- Produit :
  - `interface EntreeProjet { label: string; chemin: string }` ; `interface SectionProjet { projet: string; titre: string; entrees: EntreeProjet[] }` ;
  - `sectionsProjets(documents: DocumentProjet[], cle: string, lisible: (d: DocumentProjet) => boolean): SectionProjet[]` ;
  - `buildSidebar(hostname, meta, client, docPages, projets: SectionProjet[] = [])` : un cinquième paramètre facultatif, sans effet quand il est vide.

- [ ] **Étape 1 : écrire les tests des sections**

Créer `src/lib/documents/projets-portail.test.ts` :

```ts
import { expect, test } from "vitest";
import { sectionsProjets } from "./projets-portail";
import type { DocumentProjet } from "./projet";

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  date: new Date(2026, 8, 1),
  ...p,
});

const documents = [
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison", date: new Date(2026, 8, 17) }),
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production", statut: "brouillon" }),
  doc({ collection: "devis", id: "unlockbreath/plateforme-3271", projet: "plateforme-327", titreProjet: "Plateforme UnlockBreath" }),
];

const publies = (d: DocumentProjet) => d.statut === "publie";

test("une section par projet du client, une entrée par document lisible, dans l'ordre de la frise", () => {
  expect(sectionsProjets(documents, "caf", publies)).toEqual([
    {
      projet: "site-web-879",
      titre: "Site web CAFA",
      entrees: [
        { label: "2 · Proposition", chemin: "/projets/site-web-879/proposition" },
        { label: "4 · Livraison", chemin: "/projets/site-web-879/livraison" },
      ],
    },
  ]);
});

test("un document que le compte ne lit pas n'a pas d'entrée", () => {
  const tout = sectionsProjets(documents, "caf", () => true);
  expect(tout[0].entrees.map((e) => e.label)).toEqual(["2 · Proposition", "3 · Production", "4 · Livraison"]);
});

test("un projet sans document lisible n'a pas de section", () => {
  expect(sectionsProjets(documents, "caf", () => false)).toEqual([]);
});

test("les projets se rangent du plus récent au plus ancien", () => {
  // Deux projets réels du client `set` dans la nomenclature.
  const set = [
    doc({ collection: "devis", id: "setencorpsmieux/site-internet-7402", projet: "refonte-740", titreProjet: "Refonte", date: new Date(2026, 6, 1) }),
    doc({ collection: "devis", id: "osmose/identite-et-site-2814", projet: "osmose-281", titreProjet: "Osmose", date: new Date(2026, 8, 3) }),
  ];
  expect(sectionsProjets(set, "set", publies).map((s) => s.projet)).toEqual(["osmose-281", "refonte-740"]);
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Run : `npx vitest run src/lib/documents/projets-portail.test.ts`
Attendu : FAIL, module introuvable.

- [ ] **Étape 3 : écrire `projets-portail.ts`**

```ts
/* Les sections de projet de la barre latérale du portail (spec 2026-09-30,
 * sous-projet 1) : une section par projet du workspace courant, une entrée par
 * document que le compte lit, libellée par son étape et dans l'ordre de la
 * frise. Le projet au document le plus récent vient en tête.
 */
import { cheminPortail } from "./acces";
import { definitionEtape } from "./etapes";
import { clientDuProjet } from "./nomenclature";
import type { DocumentProjet } from "./projet";

export interface EntreeProjet {
  label: string;
  /** Chemin sous /espace, à passer par portalHref. */
  chemin: string;
}

export interface SectionProjet {
  projet: string;
  titre: string;
  entrees: EntreeProjet[];
}

export function sectionsProjets(
  documents: DocumentProjet[],
  cle: string,
  lisible: (d: DocumentProjet) => boolean,
): SectionProjet[] {
  const parProjet = new Map<string, DocumentProjet[]>();
  for (const d of documents) {
    if (d.versionDe || !d.projet || clientDuProjet(d.projet) !== cle || !lisible(d)) continue;
    parProjet.set(d.projet, [...(parProjet.get(d.projet) ?? []), d]);
  }
  const plusRecent = (docs: DocumentProjet[]) => Math.max(...docs.map((d) => d.date?.getTime() ?? 0));
  return [...parProjet.entries()]
    .sort(([, a], [, b]) => plusRecent(b) - plusRecent(a))
    .map(([projet, docs]) => ({
      projet,
      titre: docs[0].titreProjet ?? projet,
      entrees: docs
        .map((d) => ({ d, def: definitionEtape(d.etape) }))
        .sort((a, b) => a.def.numero - b.def.numero)
        .map(({ d, def }) => ({ label: `${def.numero} · ${def.libelle}`, chemin: cheminPortail(d) })),
    }));
}
```

Run : `npx vitest run src/lib/documents/projets-portail.test.ts`
Attendu : PASS, 4 tests.

- [ ] **Étape 4 : écrire les tests de la barre latérale**

Lire le haut de `src/lib/portail/nav.test.ts` pour ses imports, puis ajouter (en complétant l'import de `./nav` et en important `PortalMetadata`, `PortalWorkspace` si besoin) :

```ts
const metaClient: PortalMetadata = { role: "client", organisation: "coolbeans", workspace: "cafa" };
const wsCafa: PortalWorkspace = {
  slug: "cafa",
  nom: "CAFA",
  organisation: "coolbeans",
  cle: "caf",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const projetsCafa = [
  {
    projet: "site-web-879",
    titre: "Site web CAFA",
    entrees: [{ label: "2 · Proposition", chemin: "/projets/site-web-879/proposition" }],
  },
];

test("une section par projet se place juste après « Projets »", () => {
  const sections = buildSidebar("my.coolbeans.cc", metaClient, wsCafa, [], projetsCafa);
  const cles = sections.map((s) => s.key);
  expect(cles.indexOf("projet-site-web-879")).toBe(cles.indexOf("projets") + 1);
  const section = sections.find((s) => s.key === "projet-site-web-879")!;
  expect(section).toMatchObject({ label: "Site web CAFA", icon: "folder" });
  expect(section.pages).toEqual([
    {
      label: "2 · Proposition",
      href: "/projets/site-web-879/proposition",
      activePrefix: "/espace/projets/site-web-879/proposition",
      wip: false,
    },
  ]);
});

test("hors du portail, l'entrée garde le préfixe /espace", () => {
  const sections = buildSidebar("localhost", metaClient, wsCafa, [], projetsCafa);
  const section = sections.find((s) => s.key === "projet-site-web-879")!;
  expect(section.pages[0].href).toBe("/espace/projets/site-web-879/proposition");
});

test("sans projet, la barre latérale ne change pas", () => {
  expect(buildSidebar("my.coolbeans.cc", metaClient, wsCafa, [])).toEqual(
    buildSidebar("my.coolbeans.cc", metaClient, wsCafa, [], []),
  );
});
```

Si la section « Projets » n'apparaît pas pour ce compte client (elle ne contient qu'une page `live`, « Documents »), vérifier qu'elle est bien présente dans `sections` avant de conclure : le premier test en dépend. Si elle est absente, l'insertion se fait après « Bienvenue » (étape 5) et le test doit viser `bienvenue`.

Run : `npx vitest run src/lib/portail/nav.test.ts`
Attendu : FAIL sur les nouveaux tests.

- [ ] **Étape 5 : brancher les sections dans `buildSidebar`**

Dans `src/lib/portail/nav.ts` :
1. Importer `import type { SectionProjet } from "../documents/projets-portail";`
2. Ajouter le paramètre `projets: SectionProjet[] = []` en cinquième position de `buildSidebar`, et compléter son commentaire : « `projets` : sections de projet du client courant (documents du cycle), calculées par le layout. »
3. Juste avant `return sections;`, ajouter :

```ts
  // Les documents du cycle, une section par projet, juste après « Projets »
  // (ou après « Bienvenue » si elle manque). Chaque entrée ne s'allume que
  // sur elle-même, comme les pages de doc.
  const deProjet: SidebarSection[] = projets.map((p) => ({
    key: `projet-${p.projet}`,
    label: p.titre,
    icon: "folder",
    pages: p.entrees.map((e) => ({
      label: e.label,
      href: at(e.chemin),
      activePrefix: `/espace${e.chemin}`,
      wip: false,
    })),
  }));
  if (deProjet.length > 0) {
    const apresProjets = sections.findIndex((s) => s.key === "projets");
    const ancre = apresProjets >= 0 ? apresProjets : sections.findIndex((s) => s.key === "bienvenue");
    sections.splice(ancre + 1, 0, ...deProjet);
  }
```

Run : `npx vitest run src/lib/portail/nav.test.ts` puis `npm test`
Attendu : PASS.

- [ ] **Étape 6 : commit**

```bash
git add src/lib/documents/projets-portail.ts src/lib/documents/projets-portail.test.ts src/lib/portail/nav.ts src/lib/portail/nav.test.ts
git commit -m "Une section par projet dans la barre latérale du portail"
```

---

### Tâche 4 : sortir `card` des composants de document

`doc.css` écrase `.card` dans le portail (`display: block`, `padding: 18px`, bordure au survol). Les sept composants passent aux utilitaires équivalents. Le rendu public doit rester identique au pixel.

**Fichiers :**
- Créer (hors dépôt, ignoré par git) : `.superpowers/recette-documents/capture.mjs`, `.superpowers/recette-documents/comparer.mjs`
- Modifier : `src/components/devis/DocumentReponses.astro`, `src/components/devis/DevisReponse.astro`, `src/components/cadrage/CadrageFormulaire.astro`, `src/components/livrable/LivrableReponse.astro`, `src/components/livrable/LivrableVideo.astro`, `src/components/livrable/LivrableMessage.astro`, `src/components/temoignage/TemoignageFormulaire.astro`
- Modifier : `src/pages/devis/[...slug].astro` (feuille d'impression)

**Interfaces :**
- Produit : les deux scripts de capture et de comparaison, réutilisés par la tâche 5. Les éléments convertis portent `data-carte`.

- [ ] **Étape 1 : les scripts de capture**

```bash
npm i playwright pixelmatch pngjs --no-save
git status --short   # package.json et package-lock.json ne doivent pas bouger
mkdir -p .superpowers/recette-documents
```

Créer `.superpowers/recette-documents/capture.mjs` :

```js
/* Capture pleine page des documents publics, en clair, grand écran et mobile.
   Usage : node .superpowers/recette-documents/capture.mjs <dossier de sortie> */
import { chromium } from "playwright";
import fs from "node:fs";

const [, , sortie] = process.argv;
const BASE = "http://localhost:4337";
const PAGES = [
  "/devis/cafa/site-web-8791",
  "/devis/unlockbreath/plateforme-3271",
  "/livrable/cafa/site-web-8791",
  "/cadrage/cafa/nom-de-domaine-9042",
  "/cadrage/setencorpsmieux/reservation-en-ligne-5138",
  "/temoignage/amusoire/refonte-site-0040",
];
const TAILLES = [["large", 1440], ["mobile", 402]];

fs.mkdirSync(sortie, { recursive: true });
const navigateur = await chromium.launch({ channel: "chrome" });
for (const [nom, largeur] of TAILLES) {
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: 900 },
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  const page = await contexte.newPage();
  for (const chemin of PAGES) {
    await page.goto(BASE + chemin, { waitUntil: "networkidle" });
    // La bande d'environnement compte les commits d'avance : elle change à
    // chaque commit de la branche, elle sort donc de la comparaison.
    await page.addStyleTag({ content: "#env-banner{display:none!important}" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${sortie}/${chemin.slice(1).replaceAll("/", "_")}-${nom}.png`, fullPage: true });
  }
  await contexte.close();
}
await navigateur.close();
```

Créer `.superpowers/recette-documents/comparer.mjs` :

```js
/* Compare deux dossiers de captures au pixel près.
   Usage : node .superpowers/recette-documents/comparer.mjs <avant> <après> */
import fs from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const [, , avant, apres] = process.argv;
let ecarts = 0;
for (const f of fs.readdirSync(avant).filter((x) => x.endsWith(".png"))) {
  const a = PNG.sync.read(fs.readFileSync(`${avant}/${f}`));
  const b = PNG.sync.read(fs.readFileSync(`${apres}/${f}`));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`KO ${f} : ${a.width}x${a.height} contre ${b.width}x${b.height}`);
    ecarts++;
    continue;
  }
  const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0 });
  console.log(`${n === 0 ? "OK" : "KO"} ${f} : ${n} pixel(s)`);
  if (n > 0) ecarts++;
}
console.log(ecarts === 0 ? "Identique." : `${ecarts} capture(s) différente(s).`);
process.exit(ecarts === 0 ? 0 : 1);
```

- [ ] **Étape 2 : capturer l'état de départ, deux fois**

Lancer `npm run dev -- --port 4337` en arrière-plan, attendre qu'il réponde, puis :

```bash
node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/avant
node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/avant-bis
node .superpowers/recette-documents/comparer.mjs .superpowers/recette-documents/avant .superpowers/recette-documents/avant-bis
```

Attendu : « Identique. » Deux captures du même code doivent l'être : sinon la mesure est bruitée (police, animation, contenu chargé en différé), et il faut la stabiliser avant d'aller plus loin. Si la cause est hors de portée, le signaler avec la liste des écarts.

- [ ] **Étape 3 : remplacer `card`**

Dans chacun des sept composants, sur l'élément qui porte la classe `card` :
1. retirer le mot `card` de la liste de classes ;
2. ajouter `rounded-card border border-line bg-surface`, et `p-6x` seulement si l'élément ne porte pas déjà un utilitaire de padding (`p-*`, `px-*`, `py-*`, `pt-*`…) : ce padding-là l'emportait déjà sur celui de `.card` ;
3. ajouter l'attribut `data-carte`.

`.card` vaut, dans `src/styles/global.css` : fond `--surface`, bordure 1 px `--line`, rayon `--radius-card`, padding `--space-6x`. Les utilitaires ci-dessus en sont la traduction exacte.

Contrôle, attendu vide :

```bash
grep -rnE 'class(:list)?=\{?[^>]*\bcard\b' src/components/devis src/components/cadrage src/components/livrable src/components/temoignage src/components/documents
```

- [ ] **Étape 4 : la feuille d'impression du devis**

Dans le `<style is:global>` de `src/pages/devis/[...slug].astro`, la règle `break-inside: avoid` liste `.card` : remplacer ce sélecteur par `[data-carte]`. Rien d'autre.

- [ ] **Étape 5 : comparer**

```bash
node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/apres-t4
node .superpowers/recette-documents/comparer.mjs .superpowers/recette-documents/avant .superpowers/recette-documents/apres-t4
npm test
npm run verify
npm run build
```

Attendu : « Identique. », tests et build verts. `npm run verify` a deux échecs connus, antérieurs à la branche (un bloc `<style>` hors liste blanche, une couleur en dur dans EnvBanner) : comparer la liste avant et après, et signaler tout échec nouveau.

- [ ] **Étape 6 : commit**

```bash
git add src/components/devis/DocumentReponses.astro src/components/devis/DevisReponse.astro src/components/cadrage/CadrageFormulaire.astro src/components/livrable/LivrableReponse.astro src/components/livrable/LivrableVideo.astro src/components/livrable/LivrableMessage.astro src/components/temoignage/TemoignageFormulaire.astro 'src/pages/devis/[...slug].astro'
git commit -m "Les composants de document ne portent plus la classe card"
```

---

### Tâche 5 : les quatre composants de page

Le corps des quatre routes publiques déménage dans des composants que le portail pourra rendre. Pour le lecteur public, rien ne change au pixel.

**Fichiers :**
- Créer : `src/components/documents/pages/PageCadrage.astro`, `PageProposition.astro`, `PageLivrable.astro`, `PageTemoignage.astro`
- Créer : `src/components/documents/BandeauAcces.astro`
- Modifier : `src/components/documents/DocumentEntete.astro`, `src/components/documents/DocumentVolet.astro`
- Modifier : les quatre routes `src/pages/{cadrage,devis,livrable,temoignage}/[...slug].astro`
- Modifier : `scripts/verify-design-system.js` (liste blanche des blocs `<style>`, section F)

**Interfaces :**
- Consomme : les scripts de la tâche 4 ; `Bandeau` (tâche 2).
- Produit :
  - `<BandeauAcces raison={Bandeau} />` ;
  - `<DocumentEntete ... contexte?: "public" | "portail" />` (défaut `public`) ; en `portail`, pas de `DocumentTopbar` ;
  - `<DocumentVolet ... bandeau?: Bandeau | null />` : un bandeau propre à un volet ;
  - chaque composant de page prend `versions` (le groupe trié, racine en tête ; `entry` seul pour le témoignage, passé comme `versions={[entry]}`), `pastilles: Pastille[]`, `contexte: "public" | "portail"`, `bandeaux?: Record<string, Bandeau>` (par id d'entrée).

- [ ] **Étape 1 : écrire `BandeauAcces.astro`**

```astro
---
/* Bandeau de l'admin : ce document, ou cet onglet, le client ne le voit pas
   (spec 2026-09-30, sous-projet 1). Seul l'admin le reçoit : la route ne le
   pose que sur un document qu'il lit et que le client ne lit pas. D'où le
   texte, qu'EnvBanner s'interdit. Masqué à l'impression. */
import type { Bandeau } from "../../lib/documents/acces";

interface Props {
  raison: Bandeau;
}

const { raison } = Astro.props;

const TEXTE: Record<Bandeau, string> = {
  brouillon: "Brouillon · le client ne voit pas ce document",
  revendeur: "Réservé au revendeur · le client final ne voit pas ce document",
};
const TEINTE: Record<Bandeau, string> = {
  brouillon: "background:var(--ds-amber-100);color:var(--ds-amber-900)",
  revendeur: "background:var(--ds-blue-100);color:var(--ds-blue-900)",
};
---

<p
  data-bandeau-acces={raison}
  role="note"
  style={TEINTE[raison]}
  class="px-4 py-2.5 text-center font-mono text-[12px]/[1.4] font-semibold tracking-[0.04em] uppercase print:hidden"
>
  {TEXTE[raison]}
</p>
```

- [ ] **Étape 2 : `DocumentEntete` et `DocumentVolet`**

`DocumentEntete.astro` : ajouter la prop `contexte?: "public" | "portail"` (défaut `"public"`, documentée en une ligne), et ne rendre `<DocumentTopbar />` que si `contexte === "public"`. Compléter le commentaire d'en-tête : « Dans le portail, la barre du portail tient lieu de barre Coolbeans : thème et compte y sont déjà. »

`DocumentVolet.astro` : ajouter la prop `bandeau?: Bandeau | null` (import de type depuis `../../lib/documents/acces`), et rendre `{bandeau && <BandeauAcces raison={bandeau} />}` comme tout premier enfant du `div[data-document-volet]`, avant `DocumentSections`.

- [ ] **Étape 3 : les quatre composants de page**

Pour chaque route, créer le composant correspondant :

| Route | Composant |
|---|---|
| `src/pages/devis/[...slug].astro` | `src/components/documents/pages/PageProposition.astro` |
| `src/pages/livrable/[...slug].astro` | `src/components/documents/pages/PageLivrable.astro` |
| `src/pages/cadrage/[...slug].astro` | `src/components/documents/pages/PageCadrage.astro` |
| `src/pages/temoignage/[...slug].astro` | `src/components/documents/pages/PageTemoignage.astro` |

Contenu de chaque composant :
1. **Frontmatter** : les imports dont le gabarit a besoin (chemins ajustés à la nouvelle profondeur, `../../../`), puis les props, puis les calculs que la route faisait après `Astro.props` (`actif`, `racine`, `courante`, `plusieurs`, `reference`…), tels quels. Pour le cadrage, la variable s'appelle `chapitres` dans la route ; le composant la reçoit sous le nom `versions` et la renomme en tête : `const chapitres = versions;`.

```ts
interface Props {
  versions: CollectionEntry<"devis">[];            // "livrable" | "cadrage" | "temoignage" selon le composant
  pastilles: Pastille[];
  contexte: "public" | "portail";
  /** Par id d'entrée : ce que le client ne voit pas. Portail et admin seulement. */
  bandeaux?: Record<string, Bandeau>;
}
const { versions, pastilles, contexte, bandeaux = {} } = Astro.props;
```

2. **Gabarit** : tout ce que la route rendait ENTRE `<BaseLayout ...>` et `</BaseLayout>`, recopié tel quel, avec trois ajouts seulement :
   - en tout premier : `{bandeaux[versions[0].id] && <BandeauAcces raison={bandeaux[versions[0].id]} />}` ;
   - sur `<DocumentEntete ...>` : `contexte={contexte}` ;
   - sur chaque `<DocumentVolet ...>` d'une version autre que la racine (`i > 0`) : `bandeau={bandeaux[v.id] ?? null}` (pour le cadrage : `c.id`).
3. **`PageProposition` seulement** : le bloc `<style is:global>` d'impression déménage de la route dans le composant, octet pour octet. Dans `scripts/verify-design-system.js`, section F, remplacer l'entrée `'src/pages/devis/[...slug].astro'` de la liste blanche par `'src/components/documents/pages/PageProposition.astro'`.

La route devient, pour la proposition (les trois autres sur le même modèle, avec leur titre et leur description actuels) :

```astro
---
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import PageProposition from "../../components/documents/pages/PageProposition.astro";
import { construitesEnProduction } from "../../lib/documents/statut";
import { chargerDocuments } from "../../lib/documents/charger";
import { frise } from "../../lib/documents/frise";
import { grouperVersions } from "../../lib/documents/entete";

/* (garder le commentaire actuel de la route) */
export async function getStaticPaths() {
  /* (corps actuel de getStaticPaths, inchangé) */
}

const { versions, pastilles } = Astro.props;
const courante = versions[versions.length - 1].data;
---

<BaseLayout
  title={`Devis ${courante.titre} · Coolbeans`}
  description={`Proposition commerciale : ${courante.objet}`}
  noindex
>
  <PageProposition versions={versions} pastilles={pastilles} contexte="public" />
</BaseLayout>
```

Les deux commentaires entre parenthèses sont des consignes : y recopier le commentaire et le corps actuels de la route, sans rien changer. Pour le cadrage, la ligne `if (redirection) return Astro.redirect(redirection);` reste dans la route, avant tout calcul. Pour le témoignage : `versions={[entry]}`.

- [ ] **Étape 4 : comparer au pixel**

Serveur de développement relancé si besoin, puis :

```bash
node .superpowers/recette-documents/capture.mjs .superpowers/recette-documents/apres-t5
node .superpowers/recette-documents/comparer.mjs .superpowers/recette-documents/avant .superpowers/recette-documents/apres-t5
npm test
npm run verify
npm run build
```

Attendu : « Identique. », tests et build verts, aucun échec nouveau de `verify`. Le décompte des pages de documents du build reste 29 fichiers `index.html` (27 pages, 2 redirections).

- [ ] **Étape 5 : commit**

```bash
git add src/components/documents 'src/pages/cadrage/[...slug].astro' 'src/pages/devis/[...slug].astro' 'src/pages/livrable/[...slug].astro' 'src/pages/temoignage/[...slug].astro' scripts/verify-design-system.js
git commit -m "Le corps des quatre gabarits devient un composant de page"
```

---

### Tâche 6 : la route du portail

**Fichiers :**
- Créer : `src/pages/espace/projets/[projet]/[etape].astro`
- Modifier : `src/layouts/PortalLayout.astro` (variante document)
- Modifier : `src/styles/doc.css`
- Modifier : `src/components/documents/DocumentSections.astro` (script du scrollspy)

**Interfaces :**
- Consomme : `workspaceDuProjet` (tâche 1), `lecture`, `documentDuPortail`, `cheminPortail`, `versionsDuPortail`, `Bandeau` (tâche 2), `friseAvec` (tâche 2), les composants de page (tâche 5), `getPortalContext`, `overrideCurrentWorkspace`, `WORKSPACE_COOKIE`, `workspacesVisibles`, `listWorkspaces`, `portalHref`.
- Produit : `PortalLayout` accepte `pageDocument?: boolean` : sans colonne d'ancres, contenu sur une colonne sans plafond. La classe du `<main>` d'un document est `document-main`.

- [ ] **Étape 1 : la variante document de `PortalLayout`**

Dans `src/layouts/PortalLayout.astro` :
1. Ajouter à `Props` : `/** Page d'un document client : pas de colonne d'ancres, le document porte sa propre nav. */ pageDocument?: boolean;` et le lire avec un défaut `false`.
2. Sur le bloc de contenu : `class:list={["doc-content", pleineLargeur && "doc-content--large", pageDocument && "doc-content--document"]}`.
3. Ne rendre `<aside class="doc-right" ...>` que si `!pageDocument`.

- [ ] **Étape 2 : les règles de `doc.css`**

Ajouter à la fin de `src/styles/doc.css` (avant rien, après tout le reste) :

```css
/* ---- Documents client dans le portail (spec 2026-09-30, sous-projet 1) ----
   Le document porte sa colonne de 880 px et sa nav des sections : pas de
   colonne d'ancres, pas de plafond. */
.doc-root .doc-content--document {
  grid-template-columns: minmax(0, 1fr);
  max-width: none;
}
.doc-root .document-main {
  min-width: 0;
}
/* La barre du portail est collante sur 56 px : la nav des sections du
   document se colle dessous, et une ancre s'arrête sous les deux (56 + 66). */
.doc-root .document-main [data-document-sections] {
  top: 56px;
}
.doc-root .document-main section[id] {
  scroll-margin-top: 122px;
}
/* La flèche des liens externes est un repère de la doc, pas du document. */
.doc-root .document-main a[target="_blank"]::after {
  content: none;
}
/* Sur papier, le document seul : ni barre du portail, ni barre latérale. */
@media print {
  .doc-root > header,
  .doc-root .portal-left {
    display: none !important;
  }
  .doc-root .doc-shell {
    display: block;
  }
}
```

- [ ] **Étape 3 : le scrollspy lit le vrai décalage de la barre**

Dans le `<script>` de `src/components/documents/DocumentSections.astro`, remplacer `hauteurBarre` par :

```ts
  /* Bas de la barre une fois collée : sa hauteur, plus son `top`, qui vaut 0
     en public et 56 px dans le portail (doc.css). */
  const hauteurBarre = () => {
    const barre = [...barres].find((b) => b.offsetParent !== null);
    return barre ? barre.offsetHeight + parseFloat(getComputedStyle(barre).top || "0") : 0;
  };
```

En public, `top` vaut 0 : le calcul ne change pas.

- [ ] **Étape 4 : écrire la route**

Créer `src/pages/espace/projets/[projet]/[etape].astro` :

```astro
---
/* Un document client dans le portail (spec 2026-09-30, sous-projet 1).
   /espace/projets/<projet>/<étape>, publié sur my.coolbeans.cc/projets/…

   Rendu à la demande : la page dépend de la session. Le middleware garantit
   qu'un compte est connecté ; ici on décide s'il lit CE document. Tout refus
   répond 404, comme un projet inexistant : on ne révèle pas qu'un document
   existe. */
export const prerender = false;

import { getCollection } from "astro:content";
import PortalLayout from "../../../../layouts/PortalLayout.astro";
import PageCadrage from "../../../../components/documents/pages/PageCadrage.astro";
import PageProposition from "../../../../components/documents/pages/PageProposition.astro";
import PageLivrable from "../../../../components/documents/pages/PageLivrable.astro";
import PageTemoignage from "../../../../components/documents/pages/PageTemoignage.astro";
import { chargerDocuments } from "../../../../lib/documents/charger";
import {
  cheminPortail,
  documentDuPortail,
  lecture,
  versionsDuPortail,
  type Lecture,
} from "../../../../lib/documents/acces";
import { friseAvec } from "../../../../lib/documents/frise";
import { workspaceDuProjet } from "../../../../lib/documents/nomenclature";
import type { DocumentProjet } from "../../../../lib/documents/projet";
import { getPortalContext, overrideCurrentWorkspace } from "../../../../lib/portail/context";
import { WORKSPACE_COOKIE } from "../../../../lib/portail/current-workspace";
import { workspacesVisibles } from "../../../../lib/portail/appartenances";
import { listWorkspaces } from "../../../../lib/portail/workspaces";
import { portalHref } from "../../../../lib/portail/nav";

const introuvable = async () => {
  const rendu = await Astro.rewrite("/404");
  return new Response(rendu.body, { status: 404, headers: rendu.headers });
};

const { projet = "", etape = "" } = Astro.params;
const { meta, client } = await getPortalContext(Astro);
const workspaces = await listWorkspaces();
const workspace = workspaceDuProjet(workspaces, projet);
const documents = await chargerDocuments();
const racine = documentDuPortail(documents, projet, etape);

const compte = { role: meta.role, portee: workspacesVisibles(workspaces, meta).map((w) => w.slug) };
const lire = (d: DocumentProjet): Lecture => (workspace ? lecture(d, compte, workspace) : { lisible: false });

if (!workspace || !racine || !lire(racine).lisible) return introuvable();

// L'adresse gagne sur le sélecteur, comme pour la doc : un admin ou un
// revendeur qui ouvre le document d'un autre workspace bascule dessus. Sans
// ça, la barre latérale montrerait un client pendant que l'écran en montre
// un autre. Préférence d'affichage, sans effet sur les droits.
if (client?.slug !== workspace.slug) {
  Astro.cookies.set(WORKSPACE_COOKIE, workspace.slug, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  overrideCurrentWorkspace(Astro, workspace);
}

const { ids, bandeaux } = versionsDuPortail(documents, racine, lire);
const versions = (await getCollection(racine.collection))
  .filter((e) => ids.includes(e.id))
  .sort((a, b) => ((a.data as { version?: number }).version ?? 1) - ((b.data as { version?: number }).version ?? 1));

const pastilles = friseAvec(
  documents,
  racine,
  (d) => lire(d).lisible,
  (d) => portalHref(cheminPortail(d), Astro.url.hostname),
);
const titre = versions[versions.length - 1].data.titre;
---

<PortalLayout
  title={`${titre} · Coolbeans`}
  description="Espace client Coolbeans"
  mainClass="document-main"
  pageDocument
>
  {racine.collection === "devis" && <PageProposition versions={versions as never} pastilles={pastilles} contexte="portail" bandeaux={bandeaux} />}
  {racine.collection === "livrable" && <PageLivrable versions={versions as never} pastilles={pastilles} contexte="portail" bandeaux={bandeaux} />}
  {racine.collection === "cadrage" && <PageCadrage versions={versions as never} pastilles={pastilles} contexte="portail" bandeaux={bandeaux} />}
  {racine.collection === "temoignage" && <PageTemoignage versions={versions as never} pastilles={pastilles} contexte="portail" bandeaux={bandeaux} />}
</PortalLayout>
```

Les `as never` tiennent lieu d'un typage par collection que la route ne peut pas exprimer sur une union ; le choix du composant garantit la correspondance. Ne pas les remplacer par des `any`.

- [ ] **Étape 5 : vérifier sans compte**

```bash
npm test
npm run build
```

Puis, serveur de développement lancé :

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:4337/espace/projets/site-web-879/proposition
```

Attendu : `302` vers `/connexion?redirect_url=…` : le middleware protège la route. La vérification connectée (admin, client, revendeur) se fait à la recette finale, par Ludo : les mots de passe du portail ne sont connus que de lui.

Relancer aussi la comparaison au pixel de la tâche 4 (captures `apres-t6`) : les pages publiques ne doivent pas avoir bougé (le script de `DocumentSections` a changé).

- [ ] **Étape 6 : commit**

```bash
git add 'src/pages/espace/projets/[projet]/[etape].astro' src/layouts/PortalLayout.astro src/styles/doc.css src/components/documents/DocumentSections.astro
git commit -m "Un document client se lit dans le portail, par qui y a droit"
```

---

### Tâche 7 : les sections de projet dans la coquille du portail

**Fichiers :**
- Modifier : `src/layouts/PortalLayout.astro`

**Interfaces :**
- Consomme : `sectionsProjets` (tâche 3), `lecture` (tâche 2), `chargerDocuments`, `workspacesVisibles`, `buildSidebar` à cinq paramètres (tâche 3).
- Produit : sur toute page du portail, la barre latérale porte les sections de projet du workspace courant.

- [ ] **Étape 1 : calculer les sections dans la coquille**

Dans le frontmatter de `src/layouts/PortalLayout.astro` :
1. Importer `chargerDocuments` (`../lib/documents/charger`), `lecture` (`../lib/documents/acces`), `sectionsProjets` (`../lib/documents/projets-portail`), `workspacesVisibles` (`../lib/portail/appartenances`).
2. Remplacer la ligne `const clients = admin ? selectableWorkspaces(await listWorkspaces(), client) : [];` par :

```ts
const tousWorkspaces = await listWorkspaces();
const clients = admin ? selectableWorkspaces(tousWorkspaces, client) : [];

// Les documents du cycle du workspace courant, une section par projet. Un
// workspace sans clé n'en a aucun. La règle de lecture est celle de la route
// du document : la barre ne propose jamais une page qui répondrait 404.
const compteLecteur = { role: meta.role, portee: workspacesVisibles(tousWorkspaces, meta).map((w) => w.slug) };
const projets = client?.cle
  ? sectionsProjets(await chargerDocuments(), client.cle, (d) => lecture(d, compteLecteur, client).lisible)
  : [];
```

3. Passer `projets` en cinquième argument de `buildSidebar(...)`.

- [ ] **Étape 2 : vérifier**

```bash
npm test
npm run build
```

Attendu : vert. Le rendu connecté se vérifie à la recette finale.

- [ ] **Étape 3 : commit**

```bash
git add src/layouts/PortalLayout.astro
git commit -m "La barre latérale du portail liste les documents de chaque projet"
```

---

### Tâche 8 : une seule fonction pour l'adresse d'un document

Tout ce que le site émet (mails, cockpit, commentaire Linear, pied du PDF) passe par `adresseDocument`, que le sous-projet 6 basculera vers le portail d'un geste.

**Fichiers :**
- Créer : `src/lib/documents/adresse.ts`, `src/lib/documents/adresse.test.ts`
- Modifier : les appels listés à l'étape 4

**Interfaces :**
- Produit : `adresseDocument(collection: CollectionDocument, id: string): string`, adresse absolue (`https://coolbeans.cc/<collection>/<id>`).

- [ ] **Étape 1 : écrire le test**

```ts
import { expect, test } from "vitest";
import { adresseDocument } from "./adresse";

test("l'adresse publique d'un document garde les barres obliques de son id", () => {
  expect(adresseDocument("devis", "cafa/site-web-8791")).toBe("https://coolbeans.cc/devis/cafa/site-web-8791");
  expect(adresseDocument("cadrage", "en-haut")).toBe("https://coolbeans.cc/cadrage/en-haut");
});
```

Run : `npx vitest run src/lib/documents/adresse.test.ts`
Attendu : FAIL, module introuvable.

- [ ] **Étape 2 : écrire `adresse.ts`**

```ts
/* L'adresse d'un document pour tout ce que le site émet : mails de
 * confirmation, cockpit, commentaire Linear d'une signature, pied du PDF.
 * Une seule fonction, pour que le sous-projet 6 (spec 2026-09-30) la bascule
 * vers le portail d'un geste. D'ici là, l'adresse publique.
 */
import type { CollectionDocument } from "./etapes";

export const ORIGINE_PUBLIQUE = "https://coolbeans.cc";

export function adresseDocument(collection: CollectionDocument, id: string): string {
  return `${ORIGINE_PUBLIQUE}/${collection}/${id}`;
}
```

Run : `npx vitest run src/lib/documents/adresse.test.ts`
Attendu : PASS.

- [ ] **Étape 3 : relire chaque appel avant de le remplacer**

Les appels relevés le 2026-09-30 :

| Fichier | Construit aujourd'hui |
|---|---|
| `src/emails/livrable-confirmation.ts:31` | `` `https://coolbeans.cc/livrable/${slug}` `` |
| `src/emails/devis-confirmation.ts:43` | `` `https://coolbeans.cc/devis/${encodeURIComponent(slug)}` `` |
| `src/emails/temoignage-confirmation.ts:42` | `` `https://coolbeans.cc/temoignage/${slug}` `` |
| `src/emails/cadrage-confirmation.ts:44` | `` `https://coolbeans.cc/cadrage/${slug}` `` |
| `src/lib/devis/signature.ts:101` | `` `[Voir la proposition](https://coolbeans.cc/devis/${ctx.slug})` `` |
| `src/pages/espace/devis/index.astro:95` | `` `https://coolbeans.cc/devis/${baseId}` `` |
| `src/pages/api/cadrage-reponse.ts:182` | `` `https://coolbeans.cc/cadrage/${slug}` `` |
| `src/pages/api/devis-reponse.ts:285` | `` `https://coolbeans.cc/devis/${slug}` `` |
| `src/pages/api/temoignage-reponse.ts:223` | `` `https://coolbeans.cc/temoignage/${slug}` `` |
| `src/pages/api/livrable-reponse.ts:126` | `` `https://coolbeans.cc/livrable/${racine}` `` |
| `src/components/documents/pages/PageProposition.astro` (pied d'impression) | `coolbeans.cc/devis/{versions[0].id}` |

Relancer d'abord le grep pour trouver un appel ajouté depuis :

```bash
grep -rnE 'coolbeans\.cc/(devis|cadrage|livrable|temoignage)' src --include='*.ts' --include='*.astro' | grep -v '\.test\.'
```

`src/emails/transactionnel.ts` n'en cite qu'un exemple dans un commentaire : ne pas le toucher.

- [ ] **Étape 4 : remplacer**

Chaque construction devient `adresseDocument("<collection>", <même variable>)`. Le pied d'impression devient `{adresseDocument("devis", versions[0].id).replace(/^https:\/\//, "")}` : il s'imprime sans le protocole, comme aujourd'hui.

`devis-confirmation.ts` encodait le slug entier : `cafa/site-web-8791` devenait `cafa%2Fsite-web-8791`. `adresseDocument` n'encode pas, les ids n'ayant que `a-z0-9-/`. C'est une correction voulue : le signaler dans le rapport, et si un test attendait `%2F`, aligner ce test et le dire.

- [ ] **Étape 5 : vérifier**

```bash
npm test
npm run build
grep -rnE '`https://coolbeans\.cc/(devis|cadrage|livrable|temoignage)/\$\{' src | grep -v '\.test\.'
```

Attendu : tests et build verts, grep vide.

- [ ] **Étape 6 : commit**

Stager chaque fichier modifié par son chemin, puis :

```bash
git commit -m "Tout lien émis vers un document passe par une seule fonction"
```

---

### Tâche 9 : la doc du portail

**Fichiers :**
- Modifier : `src/content/docs/coolbeans/04-portail.mdx`

- [ ] **Étape 1 : écrire la section**

Lire la page, puis ajouter sous « Comment ça marche » une section « Les documents client » : l'adresse `my.coolbeans.cc/projets/<projet>/<étape>`, qui lit quoi (portée, statut, proposition d'un workspace de revendeur), le bandeau de l'admin, la section par projet de la barre latérale, la clé `cle` des fiches client. Dans « Référence technique », une ligne par fichier créé dans ce sous-projet.

Phrases courtes, une idée par phrase. En MDX, les commentaires s'écrivent `{/* … */}`, jamais `<!-- -->`.

- [ ] **Étape 2 : vérifier et committer**

```bash
npm run build
git add src/content/docs/coolbeans/04-portail.mdx
git commit -m "La doc du portail décrit les documents client"
```

---

## Après la dernière tâche

Par le fil principal, avec Ludo :

1. Revue de toute la branche.
2. **Recette connectée, en local, par Ludo** (lui seul a les mots de passe) : serveur sur le port 4337.
   - Admin : ouvrir `http://localhost:4337/espace/projets/site-web-879/proposition`. En-tête, frise, onglets V1 et V2, barre latérale avec la section « Site web CAFA ». Cliquer une pastille de la frise, puis une entrée de la barre latérale.
   - Admin, un brouillon : passer temporairement un document en `statut: brouillon` en local, vérifier le bandeau jaune, puis remettre.
   - Admin, un workspace de revendeur : un document d'Amusoire, le bandeau bleu sur la proposition si elle existe.
   - Client (lien de connexion obtenu depuis `/espace/utilisateurs`) : ses documents seuls ; l'adresse d'un document d'un autre client répond 404.
   - Imprimer une proposition depuis le portail : ni barre du portail, ni barre latérale, ni bandeau.
3. Cocher les critères de recette du sous-projet 1 dans la spec, mettre COO-236 à jour.
4. Sur l'accord de Ludo : fusion dans `staging`.

## Ce que ce sous-projet ne fait pas

- Le bouton de statut et le statut en base : sous-projet 2. Ici, le statut se lit encore dans le YAML.
- Le jeton personnel, l'invitation, l'ouverture du workspace à la publication : sous-projets 3 à 5.
- La fermeture des adresses publiques et le passage de l'existant : sous-projet 6.
