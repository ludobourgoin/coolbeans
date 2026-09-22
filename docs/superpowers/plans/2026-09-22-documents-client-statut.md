# Lot 1 : le statut à trois valeurs des documents client

> **Pour les agents :** SOUS-SKILL REQUISE : `superpowers:subagent-driven-development` (recommandée) ou `superpowers:executing-plans`, tâche par tâche. Les étapes se suivent en cases à cocher (`- [ ]`).

**But :** un document client ne sort du build de production que lorsque Ludo l'a explicitement publié.

**Architecture :** un champ `statut` à trois valeurs sur les quatre collections de documents (`cadrage`, `devis`, `livrable`, `temoignage`), et une fonction pure partagée que les quatre routes appellent dans leur `getStaticPaths`. La décision de construire est sortie des routes pour être testable : `astro:content` est un module virtuel indisponible sous Vitest, donc toute logique laissée dans une route est une logique non testée. Même contrainte et même remède que `src/lib/portail/documents/acces.ts` et `src/lib/portail/require-admin.ts`.

**Stack :** Astro 6, collections de contenu Zod, Vitest, adaptateur Cloudflare.

**Spec :** `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md`, section 10.

**Worktree :** `~/dev/coolbeans-documents-cycle`, branche `feat/documents-cycle`, montée depuis `staging`. Toutes les commandes partent de cette racine.

## Contraintes globales

- **Le défaut de `statut` est `publie`.** Les 35 documents existants n'ont pas ce champ. Tout autre défaut les retire tous de la production au premier build.
- **`trame` et `brouillon` se comportent à l'identique côté client.** Ils ne se distinguent que pour Ludo : l'un est une coquille vide, l'autre un texte en cours de relecture.
- **Un document non publié reste lisible en développement local**, jamais en préproduction. Ces pages sont générées à la compilation, où le nom d'hôte vaut toujours celui de la production : `import.meta.env.DEV` est le seul discriminant disponible. Arbitrage repris du commit ebf5c33.
- **Le passage à `publie` est un geste de Ludo**, jamais un effet de bord d'une autre action.
- Français : relire chaque phrase écrite dans un fichier. Le hook `relire-francais.mjs` bloque sur les fautes connues et ne distingue pas la prose du code : ne jamais appliquer de correction typographique à un fichier `.ts` ou `.astro`.
- Aucune publication en production sans ordre explicite de Ludo.

## Ce que ce lot ne fait pas

`etape`, `projet`, la frise, les nouvelles URLs et l'ouverture depuis le portail sont les lots 2 à 4. Ce lot ne touche à aucun des 35 fichiers de contenu, sauf le seul qui porte déjà `brouillon`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/documents/statut.ts` | créé, le type `StatutDocument` et la seule décision : quelles entrées sortent du build |
| `src/lib/documents/statut.test.ts` | créé, les tests de cette décision |
| `src/content.config.ts` | modifié, le champ `statut` sur les quatre collections, le champ `brouillon` retiré de `livrable` |
| `src/pages/cadrage/[...slug].astro` | modifié, filtre dans `getStaticPaths` |
| `src/pages/devis/[...slug].astro` | modifié, filtre avant le calcul des racines |
| `src/pages/livrable/[...slug].astro` | modifié, le filtre `brouillon` cède la place |
| `src/pages/temoignage/[...slug].astro` | modifié, filtre dans `getStaticPaths` |
| `src/content/livrable/cafa/site-web-v2-6317.yaml` | modifié, `brouillon: true` devient `statut: brouillon` |

---

### Tâche 1 : le filtre partagé et le champ de schéma

**Fichiers :**
- Créer : `src/lib/documents/statut.ts`
- Créer : `src/lib/documents/statut.test.ts`
- Modifier : `src/content.config.ts` (collections `cadrage`, `devis`, `livrable`, `temoignage`)

**Interfaces :**
- Produit : `type StatutDocument = "trame" | "brouillon" | "publie"` et `construitesEnProduction<T extends EntreeStatut>(entrees: T[], dev: boolean): T[]`. Les quatre routes de la tâche 2 n'appellent que cette fonction.
- Consomme : rien.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `src/lib/documents/statut.test.ts` :

```ts
import { expect, test } from "vitest";
import { construitesEnProduction } from "./statut";

/** Une entrée réduite à ce que le filtre lit, et rien de plus. */
const doc = (id: string, statut: "trame" | "brouillon" | "publie") => ({ id, data: { statut } });

test("en production, seuls les documents publiés sortent du build", () => {
  const entrees = [doc("a", "publie"), doc("b", "brouillon"), doc("c", "trame")];
  expect(construitesEnProduction(entrees, false).map((e) => e.id)).toEqual(["a"]);
});

test("trame et brouillon se comportent à l'identique côté client", () => {
  // Ils ne se distinguent que pour Ludo. Si un jour l'un des deux sort du
  // build, c'est une page non relue servie à une cliente : c'est arrivé le
  // 2026-09-22 sur la V2 du livrable CAFA.
  expect(construitesEnProduction([doc("b", "brouillon")], false)).toEqual([]);
  expect(construitesEnProduction([doc("c", "trame")], false)).toEqual([]);
});

test("en développement local, tout reste lisible", () => {
  // Masquer un document ne doit pas revenir à le perdre : c'est là que Ludo
  // le relit avant de le publier.
  const entrees = [doc("a", "publie"), doc("b", "brouillon"), doc("c", "trame")];
  expect(construitesEnProduction(entrees, true).map((e) => e.id)).toEqual(["a", "b", "c"]);
});

test("le filtre ne réordonne ni ne recopie les entrées", () => {
  // Les routes de devis et de livrable trient ensuite par numéro de version :
  // elles reçoivent bien les mêmes objets, pas des copies.
  const a = doc("a", "publie");
  const b = doc("b", "publie");
  const sortie = construitesEnProduction([a, b], false);
  expect(sortie[0]).toBe(a);
  expect(sortie[1]).toBe(b);
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/lib/documents/statut.test.ts
```

Attendu : ÉCHEC, `Failed to resolve import "./statut"`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `src/lib/documents/statut.ts` :

```ts
/* Les trois états d'un document client (spec 2026-09-22 §10).
 *
 * La décision de construire vit ici et pas dans les routes : `astro:content`
 * est un module virtuel indisponible sous Vitest, donc une règle laissée dans
 * un `getStaticPaths` est une règle non testée. Or c'est celle qui sert, ou
 * non, un document non relu à une cliente.
 *
 * `dev` est un paramètre et non une lecture de `import.meta.env.DEV` à
 * l'intérieur : c'est ce qui rend les deux branches testables.
 */

export type StatutDocument = "trame" | "brouillon" | "publie";

/** Ce que le filtre lit d'une entrée de collection, et rien de plus. */
export interface EntreeStatut {
  data: { statut: StatutDocument };
}

/**
 * Les entrées qui sortent du build.
 *
 * En développement, toutes : masquer un document ne doit pas revenir à le
 * perdre, et c'est en local que Ludo le relit. En production, les seules
 * publiées. Pas de détection de la préproduction : ces pages sont générées à
 * la compilation, où le nom d'hôte vaut toujours celui de la production.
 */
export function construitesEnProduction<T extends EntreeStatut>(entrees: T[], dev: boolean): T[] {
  if (dev) return entrees;
  return entrees.filter((e) => e.data.statut === "publie");
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
npx vitest run src/lib/documents/statut.test.ts
```

Attendu : 4 tests au vert.

- [ ] **Étape 5 : poser le champ sur les quatre collections**

Dans `src/content.config.ts`, insérer ce bloc dans le `z.object({ … })` de `cadrage`, `devis`, `livrable` et `temoignage`. Le poser juste après `date`, où il se lit avec les autres champs de tête :

```ts
    /* Les trois états d'un document (spec 2026-09-22 §10) :
       `trame`     coquille créée avec le projet, jamais servie ;
       `brouillon` texte en cours, pas encore montrable ;
       `publie`    servi en production, listé dans le portail.
       Les deux premiers se comportent pareil côté client ; ils se distinguent
       pour Ludo, qui sait ce qu'il lui reste à écrire.

       Le défaut est `publie` : les 35 documents d'avant ce champ n'en portent
       pas, et tout autre défaut les retirerait tous de la production. */
    statut: z.enum(["trame", "brouillon", "publie"]).default("publie"),
```

- [ ] **Étape 6 : vérifier que le build est intact**

Aucune route ne lit encore `statut` : le nombre de pages doit être exactement celui d'avant.

```bash
npm run build
find dist/client/devis dist/client/cadrage dist/client/livrable dist/client/temoignage -name index.html | wc -l
```

Attendu : build complet sans erreur, et **28**.

- [ ] **Étape 7 : commit**

```bash
git add src/lib/documents/statut.ts src/lib/documents/statut.test.ts src/content.config.ts
git commit -m "Le statut à trois valeurs d'un document client

Le champ et la règle qui décide de ce qui sort du build. Aucune route ne les
lit encore : le build reste à 28 pages.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tâche 2 : les quatre routes appliquent le filtre

**Fichiers :**
- Modifier : `src/pages/cadrage/[...slug].astro`
- Modifier : `src/pages/temoignage/[...slug].astro`
- Modifier : `src/pages/devis/[...slug].astro`
- Modifier : `src/pages/livrable/[...slug].astro`

**Interfaces :**
- Consomme : `construitesEnProduction` de la tâche 1.
- Produit : rien que les tâches suivantes lisent.

Deux formes de route. `cadrage` et `temoignage` n'ont pas de versions : le filtre s'applique à la liste entière. `devis` et `livrable` en ont : le filtre s'applique **avant** le calcul des racines, pour que la règle vaille aussi bien sur une racine, qui fait disparaître la page, que sur une version, qui fait disparaître un onglet.

- [ ] **Étape 1 : filtrer la route de cadrage**

Dans `src/pages/cadrage/[...slug].astro`, ajouter l'import sous les autres imports :

```ts
import { construitesEnProduction } from "../../lib/documents/statut";
```

puis remplacer le corps de `getStaticPaths` :

```ts
export async function getStaticPaths() {
  const entries = construitesEnProduction(await getCollection("cadrage"), import.meta.env.DEV);
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
```

- [ ] **Étape 2 : filtrer la route de témoignage**

Dans `src/pages/temoignage/[...slug].astro`, même import, et :

```ts
export async function getStaticPaths() {
  const entries = construitesEnProduction(await getCollection("temoignage"), import.meta.env.DEV);
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
```

- [ ] **Étape 3 : filtrer la route de devis**

Dans `src/pages/devis/[...slug].astro`, même import, et remplacer la première ligne du corps :

```ts
export async function getStaticPaths() {
  /* Le filtre passe AVANT le calcul des racines : sur une racine il fait
     disparaître la page, sur une version il fait disparaître un onglet. */
  const entries = construitesEnProduction(await getCollection("devis"), import.meta.env.DEV);
  const racines = entries.filter((e) => !e.data.versionDe);

  return racines.map((racine) => {
    const versions = [racine, ...entries.filter((e) => e.data.versionDe === racine.id)].sort(
      (a, b) => a.data.version - b.data.version,
    );
    return { params: { slug: racine.id }, props: { versions } };
  });
}
```

- [ ] **Étape 4 : filtrer la route de livrable**

Dans `src/pages/livrable/[...slug].astro`, même import, et remplacer le filtre `brouillon` posé par le commit ebf5c33 :

```ts
export async function getStaticPaths() {
  /* Le filtre passe AVANT le calcul des racines : sur une racine il fait
     disparaître la page, sur une version il fait disparaître un onglet. */
  const entries = construitesEnProduction(await getCollection("livrable"), import.meta.env.DEV);
  const racines = entries.filter((e) => !e.data.versionDe);
  return racines.map((racine) => {
    const versions = [racine, ...entries.filter((e) => e.data.versionDe === racine.id)].sort(
      (a, b) => a.data.version - b.data.version,
    );
    return { params: { slug: racine.id }, props: { versions } };
  });
}
```

À ce stade `site-web-v2-6317.yaml` porte encore `brouillon: true` et aucun `statut` : son défaut vaut `publie`, donc la V2 du livrable CAFA **revient dans le build**. C'est attendu, et la tâche 3 la ressort. Ne pas publier entre les deux.

- [ ] **Étape 5 : vérifier le build**

```bash
npm run build
find dist/client/devis dist/client/cadrage dist/client/livrable dist/client/temoignage -name index.html | wc -l
```

Attendu : **28**. Les 35 documents sont tous à `publie` par défaut, donc rien ne doit disparaître. Un compte inférieur signifie que le défaut du schéma n'est pas `publie` : revenir à l'étape 5 de la tâche 1.

- [ ] **Étape 6 : vérifier à la main qu'un brouillon disparaît**

Poser temporairement `statut: brouillon` en tête de `src/content/cadrage/` sur le premier fichier venu, puis :

```bash
npm run build
find dist/client/cadrage -name index.html | wc -l
```

Attendu : **6** au lieu de 7. Retirer ensuite la ligne et reconstruire pour retrouver 7. Cette vérification ne se commite pas : elle prouve que le schéma, le filtre et la route sont bien raccordés, ce qu'aucun test unitaire ne voit.

- [ ] **Étape 7 : commit**

```bash
git add src/pages/cadrage src/pages/devis src/pages/livrable src/pages/temoignage
git commit -m "Les quatre documents client ne sortent du build que publiés

Le filtre passe avant le calcul des racines : sur une racine il retire la
page, sur une version il retire un onglet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tâche 3 : le brouillon du livrable rejoint le statut

**Fichiers :**
- Modifier : `src/content/livrable/cafa/site-web-v2-6317.yaml`
- Modifier : `src/content.config.ts` (retrait de `brouillon` sur `livrable`)
- Modifier : `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md` (section 10)

**Interfaces :**
- Consomme : le champ `statut` de la tâche 1, le filtre des routes de la tâche 2.
- Produit : rien.

Le champ `brouillon` de la collection `livrable` a été posé le 2026-09-22 en réponse à un incident : la V2 du livrable CAFA est partie en production sans avoir été relue, lisible par la cliente à l'URL qu'elle avait déjà. `statut` le remplace terme à terme, avec une valeur de plus.

- [ ] **Étape 1 : basculer le document**

Dans `src/content/livrable/cafa/site-web-v2-6317.yaml`, remplacer la ligne `brouillon: true` par :

```yaml
statut: brouillon
```

- [ ] **Étape 2 : retirer le champ du schéma**

Dans `src/content.config.ts`, supprimer de la collection `livrable` le bloc posé par ebf5c33, commentaire compris :

```ts
    /* Brouillon : le document existe dans le dépôt mais ne sort pas du build.
       Visible en développement local seulement, pour la relecture. Premier
       pas vers le champ `statut` de la spec du 2026-09-22. */
    brouillon: z.boolean().default(false),
```

Ne toucher à aucun autre `brouillon` : celui de la collection `projets`, sur `src/content/projets/amusoire.md`, concerne les études de cas et suit une autre règle, le `noindex`. Il est hors de ce lot.

- [ ] **Étape 3 : vérifier que le livrable CAFA ressort du build**

```bash
npm run build
find dist/client/livrable -name index.html | wc -l
grep -rl "site-web" dist/client/livrable --include=index.html | head
```

Attendu : **3** pages de livrable, comme avant le lot. La V2 est une version et non une racine : ce qui disparaît est son onglet, pas une page. Ouvrir `dist/client/livrable/cafa/site-web-8791/index.html` et vérifier qu'il ne porte plus d'onglet V2 :

```bash
grep -c "V2" dist/client/livrable/cafa/site-web-8791/index.html
```

Attendu : **0**.

- [ ] **Étape 4 : vérifier qu'elle reste lisible en local**

```bash
npx astro dev stop 2>/dev/null; npm run dev
```

Ouvrir `http://localhost:4321/livrable/cafa/site-web-8791` et vérifier que l'onglet V2 est là. Si la page se sert sans aucune feuille de style, c'est le HMR d'Astro qui a décroché après des écritures répétées hors de l'éditeur : relancer le serveur. Arrêter le serveur avant de continuer.

- [ ] **Étape 5 : corriger la section 10 de la spec**

Dans `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md`, remplacer :

> **Un document non publié n'est pas construit dans le site de production.** Il l'est en préproduction, où Ludo le relit sur `staging.coolbeans.cc`. Filtrage dans `getStaticPaths`, rien de plus.

par :

> **Un document non publié n'est pas construit dans le site de production.** Il reste lisible en développement local, le temps de la relecture : masquer un document ne doit pas revenir à le perdre.
>
> Pas de détection de la préproduction. Ces pages sont générées à la compilation, où le nom d'hôte vaut toujours celui de la production, et les variables de `wrangler.jsonc` sont des variables d'exécution. Distinguer `staging` de la production demanderait une variable de build déclarée par environnement dans Workers Builds, pour un usage que la relecture en local couvre déjà.

- [ ] **Étape 6 : lancer la suite complète**

```bash
npx vitest run
npm run verify
```

Attendu : tous les tests au vert. `verify` sort 2 échecs sur 91, sur `EnvBanner`, `LivrableApercu`, `Artefact`, `404` et `disponibilites` : ils préexistent à ce lot et aucun de ces fichiers n'est touché ici.

- [ ] **Étape 7 : commit**

```bash
git add src/content/livrable/cafa/site-web-v2-6317.yaml src/content.config.ts docs/superpowers/specs/2026-09-22-documents-client-entete-design.md
git commit -m "Le brouillon du livrable rejoint le statut à trois valeurs

Le champ \`brouillon\` posé en urgence après l'incident du livrable CAFA cède
la place. La spec est corrigée sur un point : la relecture se fait en local,
pas en préproduction, parce que ces pages sont générées à la compilation.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Recette du lot

- [ ] Un document en `trame` ou en `brouillon` n'est pas construit en production
- [ ] Le même document s'affiche en développement local
- [ ] Les 28 pages de documents d'avant le lot sont toujours construites
- [ ] Une version non publiée retire son onglet sans retirer la page
- [ ] Le champ `brouillon` n'existe plus sur la collection `livrable`
- [ ] La suite de tests passe en entier

## Ce qui reste à la main de Ludo

- Basculer les documents qu'il ne veut pas encore montrer. Le défaut est `publie` : ce lot ne masque rien tout seul, et c'est voulu.
- Décider quand la branche part en préproduction, puis en production.
