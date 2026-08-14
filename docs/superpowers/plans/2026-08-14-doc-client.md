# Doc client — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer `project`→`client` dans la collection docs du repo coolbeans, créer la skill `doc-client` dans coolbeans-claude-skills, puis la valider par un premier run réel sur la doc Coolbeans.

**Architecture:** Le système de doc existant (collection Astro `docs`, layout maison, rendu derrière Clerk) est conservé tel quel ; seul le vocabulaire du schéma change (Task 1). La skill est un prompt structuré sur le modèle de la skill `linear` : `SKILL.md` porte le flux, `references/` porte les règles métier (Tasks 2-3). Le premier run sur Coolbeans sert de test d'acceptation de bout en bout (Task 4).

**Tech Stack:** Astro 7 (content collections, MDX), Clerk, vitest, npm (package-lock.json présent). Skill : markdown pur, aucun code.

**Spec:** `docs/superpowers/specs/2026-08-14-doc-client-design.md` — le plan argumente depuis cette spec, la lire d'abord.

## Global Constraints

- Tout le contenu produit (skill, references, doc) est en **français**, dates au format `YYYY-MM-DD`.
- Aucun secret, clé API ou token en clair, nulle part (CLAUDE.md `/dev`).
- Aucune publication en production ; les commits restent sur `staging` (repo coolbeans) et ne sont jamais poussés sans ordre explicite de Ludo.
- La skill ne pose jamais `status: final` et ne commit jamais elle-même (spec §4.3) — contrainte à respecter dans le texte même de SKILL.md.
- Repo coolbeans : gestionnaire de paquets **npm** (`npm test`, `npm run build`).
- Le renommage de Task 1 ne change **aucune URL publique** : `/docs/amusoire/...` reste identique, seul le nom interne du paramètre change.
- Hors scope de ce plan : migration de la doc Amusoire (spec §6), refonte Geist de l'UI (spec §8).

---

### Task 1: Refactor `project` → `client` (repo coolbeans)

**Files:**
- Modify: `src/content.config.ts:~130` (schéma de la collection `docs`)
- Modify: les 13 fichiers `src/content/docs/**/*.mdx` (frontmatter)
- Rename: `src/pages/docs/[project]/` → `src/pages/docs/[client]/` (via `git mv`)
- Modify: `src/pages/docs/[client]/[...slug].astro` (lignes 22, 24, 41-42, 56, 59, 96 de la version actuelle)
- Modify: `src/layouts/DocLayout.astro:32,39-40` et l'usage de `projectLabel` dans le `<BaseLayout title=...>`
- Modify: commentaires `src/actions/index.ts:164`, `src/middleware.ts:6`, `src/content/clients/coolbeans.yaml`
- Test: la validation Zod de la collection au `npm run build` sert de test (rouge tant que le schéma et les frontmatter divergent), plus `npm test` (non-régression des tests vitest existants)

**Interfaces:**
- Consomme : rien (première task).
- Produit : le champ de collection s'appelle `client` (`entry.data.client`), le paramètre de route s'appelle `client` (`Astro.params.client`), la prop de `DocLayout` s'appelle `client: string`. Les tasks 2-4 écrivent des frontmatter `client: "<slug>"`.

- [ ] **Step 1: Changer le schéma (rouge)**

Dans `src/content.config.ts`, collection `docs` :

```ts
// AVANT
    project: z.string(), // clé projet = dossier ("amusoire")
// APRÈS
    client: z.string(), // clé client = dossier ("amusoire")
```

Mettre aussi à jour le commentaire de tête de la collection : « … dans src/content/docs/<projet>/ » → « … dans src/content/docs/<client>/ » et « Rendu par src/pages/docs/[project]/[...slug].astro » → « [client] ».

- [ ] **Step 2: Vérifier que le build échoue**

Run: `npm run build`
Expected: FAIL — Zod signale `client` requis manquant (ou clé inconnue `project`) sur les fichiers de `src/content/docs/`.

- [ ] **Step 3: Migrer les frontmatter (vert)**

```bash
cd /Users/ludovicbourgoin/dev/coolbeans
grep -rl '^project:' src/content/docs --include='*.mdx' | xargs sed -i '' 's/^project:/client:/'
grep -rn '^project:' src/content/docs   # doit ne rien retourner
```

- [ ] **Step 4: Renommer la route et ses usages internes**

```bash
git mv 'src/pages/docs/[project]' 'src/pages/docs/[client]'
```

Puis dans `src/pages/docs/[client]/[...slug].astro`, remplacer chaque usage (le mot `projet` dans les commentaires en prose passe à `client` quand il désigne la clé) :

```astro
// ligne 3-4 (commentaire d'en-tête)
// /docs/<client>            → première page du client (order le plus bas)
// /docs/<client>/<slug>     → page correspondante (slug = id sans préfixe numérique)

// ligne 22
const hrefOf = (e: Doc) => `/docs/${e.data.client}/${slugOf(e)}`;

// ligne 24
const { client: clientParam, slug } = Astro.params;
```

Attention au conflit de nom : la ligne 32 destructure déjà `client` depuis `getPortalContext`. Renommer le paramètre d'URL en `clientParam` comme ci-dessus, et adapter :

```astro
// ligne 41-42
if (isAdminUser && clientParam && client?.doc !== clientParam) {
  const proprietaire = await findClientByDoc(clientParam);

// ligne 56
const allowed = clientParam === "_template" ? isAdminUser : effectif?.doc === clientParam;

// ligne 59
const entries = (await getCollection("docs", (e) => e.data.client === clientParam)).sort(

// ligne 96 (prop passée au layout)
  client={entry.data.client}
```

- [ ] **Step 5: Adapter DocLayout.astro**

```astro
// interface Props, ligne 32
  client: string;

// ligne 39-40
const { title, client, nav, headings, prev, next, searchIndex } = Astro.props;
const clientLabel = client.charAt(0).toUpperCase() + client.slice(1);
```

Remplacer les deux usages de `projectLabel` par `clientLabel` dans le `<BaseLayout title={...} description={...}>` juste en dessous.

- [ ] **Step 6: Mettre à jour les commentaires satellites**

- `src/actions/index.ts:164` : `src/pages/docs/[project]/[...slug].astro` → `[client]`.
- `src/middleware.ts:6` : idem.
- `src/content/clients/coolbeans.yaml` : le commentaire « l'autorisation se fait sur `doc === project` dans src/pages/docs/[project]/... » → « `doc === client` dans src/pages/docs/[client]/... ». Reformuler aussi « Doc Coolbeans = manuel d'exploitation de l'entreprise, pas une passation technique » → « Doc Coolbeans = manuel d'exploitation de l'entreprise + doc technique du site et du portail (spec 2026-08-14-doc-client-design.md §7) ».

- [ ] **Step 7: Vérifier**

```bash
npm test          # les tests vitest existants (metadata, nav) passent inchangés
npm run build     # PASS — la collection valide, aucune erreur Zod
grep -rn 'data\.project\|params\.project\|\[project\]' src --include='*.astro' --include='*.ts' | grep -v node_modules
# ne doit rien retourner
```

- [ ] **Step 8: Smoke test manuel**

`npm run dev`, se connecter en admin, vérifier `/docs/amusoire` (nav gauche, une page interne, prev/next) et `/docs/coolbeans`. Les URLs n'ont pas changé.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(docs): renomme project→client dans la collection docs

Le modèle est client-first (1 client = 1 doc, spec 2026-08-14) : le code
dit désormais ce que le modèle veut dire. Aucune URL ne change."
```

---

### Task 2: Skill `doc-client` — SKILL.md (repo coolbeans-claude-skills)

**Files:**
- Create: `/Users/ludovicbourgoin/dev/coolbeans-claude-skills/skills/doc-client/SKILL.md`
- Modify: `/Users/ludovicbourgoin/dev/coolbeans-claude-skills/README.md` (tableau « Skills disponibles »)

**Interfaces:**
- Consomme : le renommage de Task 1 (frontmatter `client:`), la structure `coolbeans/src/content/docs/<client>/` et `src/content/clients/<client>.yaml`.
- Produit : la skill invocable `/doc-client`, qui référence `references/structure.md` et `references/redaction.md` (créés en Task 3 — les noms de fichiers doivent correspondre exactement).

- [ ] **Step 1: Créer SKILL.md avec ce contenu intégral**

````markdown
---
name: doc-client
description: Rédige et met à jour la doc d'un client Coolbeans (portail my.coolbeans.cc). À déclencher quand Ludo écrit "doc-client", "mets à jour la doc de X", "génère la doc de X", "initialise la doc", "doc de passation", demande de scanner un projet pour proposer des mises à jour de doc, ou à l'étape doc de l'onboarding d'un nouveau client. Scanne le repo du projet, compare aux pages existantes, et soumet un récapitulatif à validation avant toute écriture. Ne s'utilise jamais en session de code normale.
---

# Doc client Coolbeans

Produire et maintenir la doc d'un client dans
`coolbeans/src/content/docs/<client>/` : un instantané exact de l'état du
projet, lisible de bout en bout par le client (vocabulaire accessible à une
équipe marketing, même sur les points techniques), et assez précis pour
qu'un autre développeur reprenne le projet sans friction.

## Prérequis

- Accès en lecture au(x) repo(s) du projet cible (code + `git log`).
- Accès en lecture/écriture à `coolbeans/src/content/docs/`.
- Le registre `coolbeans/src/content/clients/<client>.yaml`.

S'il manque l'un des trois, s'arrêter et le dire. Ne jamais inventer de
contenu pour compenser un accès manquant.

## Configuration

Les règles métier vivent dans `references/` :

| Fichier | Contient |
|---|---|
| `references/structure.md` | Pages canoniques, modèle « une page par feature », profondeur progressive, conventions de nommage |
| `references/redaction.md` | Règles d'écriture non négociables |

## Règle cardinale

**Ne jamais écrire ni modifier un fichier sans avoir présenté un
récapitulatif complet et obtenu la validation explicite de Ludo.** Le
récapitulatif précède l'écriture — le `git diff` n'est pas le garde-fou, il
arrive après.

Corollaires, sans exception :

- La skill écrit en `status: draft` ou `review`, **jamais `final`**. Le
  passage à `final` et le commit sont des gestes manuels de Ludo.
- Jamais de commit, jamais de push.
- Aucun fait non observable dans le repo scanné : ce que le code, la config
  et l'historique git ne montrent pas se demande à Ludo, ne se suppose pas.
- Aucun secret, clé API ou token trouvé pendant le scan n'est recopié dans
  la doc : le signaler dans le récapitulatif à la place.

## Flux

### 1. Identifier le client

Résoudre le slug via `src/content/clients/<client>.yaml` (champ `doc:`).
Le dossier `src/content/docs/<slug>/` existe → mode **update**. Il n'existe
pas → mode **init**. Le client n'est pas dans le registre → s'arrêter et
proposer de créer l'entrée d'abord (c'est l'étape registre de l'onboarding,
pas le rôle de cette skill).

### 2. Charger l'état existant (update)

Lire toutes les pages du dossier : `title`, `status`, `updated`, contenu.
Retenir la date `updated` la plus ancienne — c'est l'horizon du scan.

### 3. Scanner le projet

- **init** : scan complet du repo — stack (`package.json`, configs),
  structure des pages/routes, intégrations externes (webhooks, CRM, mails),
  scripts et commandes, décisions visibles dans le code et les commits.
- **update** : scan incrémental — `git log --since=<horizon>` sur le repo
  cible, puis lecture ciblée des zones touchées. Ne pas relire tout le repo
  à chaque passage.

Si le client a plusieurs repos/projets, tous alimentent la **même** doc
client (1 client = 1 doc).

### 4. Extraire les faits observables

Chaque proposition de contenu doit pouvoir citer sa source : un fichier, un
commit, une config. Pendant le scan, noter aussi :

- **Écarts réel/souhaité** (feature à moitié branchée, config incohérente) :
  ils deviennent des propositions d'issue Linear (via la skill `linear`),
  jamais des « à faire » dans la doc.
- **Secrets** : signalés, jamais recopiés.

### 5. Détecter les conflits AVANT de proposer

Si un fait observé contredit une page en `status: final`, le dire
explicitement dans le récapitulatif (« la page X affirme A, le code montre
B ») et proposer la correction. Ne jamais écraser silencieusement du
contenu validé.

### 6. Récapitulatif, questions, validation

Un seul message qui contient :

```
Client   : <slug>  (mode init | update)
Scan     : <repos parcourus, horizon>

Pages :
- <NN-slug.mdx>  [créer | modifier | inchangée]  — quoi et pourquoi, en 1-2 lignes
- ...

Conflits avec du contenu final : <liste ou « aucun »>
Issues Linear proposées        : <liste ou « aucune »>
Secrets détectés               : <liste des emplacements ou « aucun »>

Questions : <ce que le scan ne peut pas savoir, en une seule fois,
             avec une réponse par défaut proposée pour chaque question>
```

Attendre la validation. Ne rien écrire avant.

### 7. Rédiger

Appliquer `references/structure.md` (organisation) et
`references/redaction.md` (écriture) à la lettre. Frontmatter de chaque
page écrite ou modifiée : `client`, `title`, `order`, `status: draft` (ou
`review` si Ludo l'a demandé), `updated` à la date du jour, `description`.

En mode init, partir des pages de `src/content/docs/_template/` : les
copier, remplacer `client: "_template"` par le slug, remplir depuis le
scan, supprimer les pages du gabarit sans objet pour ce client.

### 8. S'arrêter

Rappeler en une ligne ce qui reste à la main de Ludo : relire, passer en
`final`, committer. Ne pas résumer ce qui vient d'être écrit — il va le
lire.

## Cas particuliers

**Rien de neuf.** Le scan ne révèle aucun écart avec la doc : le dire et
s'arrêter. Ne jamais inventer du contenu pour justifier le passage.

**Doc legacy dans le repo client.** Si le repo cible contient une doc
(`docs/`, `PASSATION.md`…), la traiter comme source à fusionner : proposer
son intégration dans les pages, puis proposer sa suppression du repo client
(l'historique git la conserve). Une seule source de vérité.

**Demande hors périmètre.** Si Ludo demande une mise à jour de doc au
milieu d'une session de code, la skill est le bon canal : noter le point,
proposer de lancer le flux complet (scan → récapitulatif) plutôt que
d'éditer la page directement.
````

- [ ] **Step 2: Ajouter la ligne au README du repo skills**

Dans le tableau « Skills disponibles » de
`/Users/ludovicbourgoin/dev/coolbeans-claude-skills/README.md`, après la ligne `linear` :

```markdown
| [`doc-client`](skills/doc-client) | Rédige et met à jour la doc d'un client sur le portail my.coolbeans.cc : scan du repo, récapitulatif validé avant écriture, règles de rédaction strictes |
```

- [ ] **Step 3: Vérifier**

- Le frontmatter de SKILL.md est du YAML valide (`name`, `description` seulement, comme `linear`).
- Les deux chemins `references/structure.md` et `references/redaction.md` cités correspondent exactement aux fichiers de Task 3.
- Relecture croisée avec la spec §4.3-4.4 et §4.8 : chaque corollaire et chaque cas particulier de la spec a son paragraphe.

- [ ] **Step 4: Commit (repo coolbeans-claude-skills)**

```bash
cd /Users/ludovicbourgoin/dev/coolbeans-claude-skills
git add skills/doc-client/SKILL.md README.md
git commit -m "feat(doc-client): skill de rédaction de la doc client

Scan du repo, récapitulatif validé avant écriture, jamais de status
final ni de commit par la skill. Spec : coolbeans
docs/superpowers/specs/2026-08-14-doc-client-design.md"
```

---

### Task 3: `references/structure.md` + `references/redaction.md`

**Files:**
- Create: `/Users/ludovicbourgoin/dev/coolbeans-claude-skills/skills/doc-client/references/structure.md`
- Create: `/Users/ludovicbourgoin/dev/coolbeans-claude-skills/skills/doc-client/references/redaction.md`

**Interfaces:**
- Consomme : les noms de fichiers annoncés dans SKILL.md (Task 2).
- Produit : les règles que Task 4 (premier run) applique au contenu.

- [ ] **Step 1: Créer structure.md avec ce contenu intégral**

````markdown
# Structure de la doc client

## Le gabarit

`coolbeans/src/content/docs/_template/` définit les pages canoniques :

| Ordre | Page | Rôle |
|---|---|---|
| 1 | Vue d'ensemble | Identité du projet, contexte, marque, liens rapides |
| 2 | Éditer le site | L'usage quotidien : contenu, blog, SEO, interdits |
| 3 | Intégrations & leads | D'où viennent les leads, où ils vont, comment |
| 4+ | Une page **par feature sur mesure** | Voir ci-dessous |
| n-1 | Sécurité & conformité | Accès, RGPD, sauvegardes |
| n | Référence & support | Sitemap, annuaire, qui contacter |

En mode init : copier le gabarit, supprimer les pages sans objet pour ce
client. Une doc courte et juste vaut mieux qu'une doc complète et creuse.

## Une page par feature

Tout ce qui touche une feature — usage simple et détail technique — vit sur
la **même page** (ex. : « Simulateur ROI », « Popup opt-in »). Pas de
séparation doc simple / annexe technique : l'annexe est le quartier où
personne ne vit, elle pourrit en silence.

## Profondeur progressive

Chaque page de feature descend par couches, dans cet ordre :

1. **Ce que c'est, à quoi ça sert** — une ou deux phrases, résultat business.
2. **Ce que vous pouvez modifier vous-même** — coefficients, contenus,
   réglages sans code, avec le geste exact.
3. **Comment ça fonctionne** — l'architecture en langage clair : les outils,
   le chemin d'une donnée, les décisions et leur pourquoi.
4. **Référence technique** — en bas de page : sélecteurs, identifiants,
   chemins de fichiers, tables exactes.

Le lecteur s'arrête où son besoin s'arrête ; le développeur repreneur
descend jusqu'au fond. Rien n'est caché, rien n'est déplacé ailleurs.

## Une page = un sujet, lisible en 5 minutes

Au-delà, scinder : les tables de pure référence descendent dans la page
Référence & support, ou la feature se découpe en deux pages si elle couvre
réellement deux sujets.

## Conventions

- Nom de fichier : `NN-slug.mdx` — `NN` fixe l'ordre dans la nav (= champ
  `order`), slug court, sans accent ni emoji.
- Frontmatter : `client`, `title`, `order`, `status`, `updated`,
  `description` — tous requis (schéma Zod de la collection).
- `status` : `draft` (sorti de la skill) → `review` (en relecture) →
  `final` (validé par Ludo, seul autorisé à le poser).
- 1 client = 1 doc : les projets successifs d'un même client incrémentent
  les pages existantes ou en ajoutent, jamais de sous-arbre par projet.
````

- [ ] **Step 2: Créer redaction.md avec ce contenu intégral**

````markdown
# Règles de rédaction

Ces règles ne sont pas des préférences de style : chacune corrige un défaut
constaté qui a coûté cher. Aucune n'est négociable.

## Langage clair partout, même au fond de la technique

Chaque terme technique est expliqué dans la phrase même, ou remplacé.
Étalon : une équipe marketing comprend la section, y compris la référence
technique. On ne perd **aucune** précision en écrivant clairement.

> Avant : « Make évalue toute chaîne non vide comme truthy dans
> `{{if(...)}}` : `"false"` passerait la condition à vrai. »
>
> Après : « Une case non cochée doit envoyer une valeur **vide**, jamais le
> texte "false" : Make considère n'importe quel texte comme un oui. »

## La voix de l'instantané : rationale oui, narration non

La doc décrit **ce qui est**, jamais ce qui vient de changer.

- Se garde — le *pourquoi* intemporel d'une décision : « Le mail passe par
  Resend, pas par HubSpot : l'add-on transactionnel HubSpot coûte
  ~600 $/mois pour une délivrabilité équivalente. »
- Se jette — l'*actualité* : « confirmée le 2026-07-24 », « l'ancienne
  procédure n'est plus utilisée », « nouvelle version depuis mars », « en
  attendant sa suppression ».

Test : la phrase serait-elle encore juste et utile lue dans deux ans, sans
connaître la chronologie du projet ? Sinon, la reformuler ou la couper.

## Aucun TODO dans la doc

Un écart entre le réel et le souhaité devient une **issue Linear**
(proposée pendant le scan, via la skill `linear`), jamais une annotation
« à faire » ou « reporté » dans une page. La doc décrit ce qui est ; Linear
porte ce qui doit changer.

## Sobriété

- **Un encart (callout) par écran maximum.** Trois alertes par page, c'est
  zéro alerte : réserver l'encart au piège qui coûte des heures.
- **Le gras** pour l'unique chose à ne pas rater dans la section, pas pour
  scander chaque phrase.
- **Zéro emoji** dans le corps de texte et les liens.

## Politique du code

On n'inline que ce que le lecteur va **éditer** (un coefficient en Custom
Attribute, une valeur de config). Tout le reste — formules, logique,
scripts — se référence par chemin de fichier vers le repo
(`src/utils/calculator.ts`), jamais collé : le code cité dans la doc ment
dès le commit suivant.

## Première ligne de chaque page

À qui elle s'adresse et ce qu'on peut en faire. Le lecteur sait en cinq
secondes s'il est au bon endroit.

## Secrets

Jamais de clé, token ou mot de passe dans la doc, même « temporairement ».
Un secret repéré pendant le scan se signale dans le récapitulatif, avec son
emplacement, pour que Ludo décide (1Password/Bitwarden).
````

- [ ] **Step 3: Vérifier**

Relecture croisée avec la spec §4.5 et §4.7 : chaque règle de la spec a son
paragraphe, aucun paragraphe n'invente une règle absente de la spec.
Vérifier que redaction.md respecte lui-même ses règles (pas d'emoji, gras
parcimonieux).

- [ ] **Step 4: Commit (repo coolbeans-claude-skills)**

```bash
cd /Users/ludovicbourgoin/dev/coolbeans-claude-skills
git add skills/doc-client/references/
git commit -m "feat(doc-client): références structure et rédaction"
```

---

### Task 4: Premier run — doc Coolbeans (test d'acceptation)

**Files:**
- Create/Modify: `coolbeans/src/content/docs/coolbeans/*.mdx` (pages en `draft`, contenu déterminé par le scan)
- Aucun autre fichier : ce task est l'exécution de la skill, pas du développement.

**Interfaces:**
- Consomme : la skill installée (Tasks 2-3), le schéma `client:` (Task 1).
- Produit : la doc Coolbeans en `draft` + la preuve que la skill fonctionne de bout en bout.

- [ ] **Step 1: Installer la skill**

```bash
mkdir -p ~/.claude/skills
cp -r /Users/ludovicbourgoin/dev/coolbeans-claude-skills/skills/doc-client ~/.claude/skills/
```

Installation globale (convention du README du repo skills) : la skill lit
des repos clients variés et écrit dans coolbeans, elle doit être disponible
quelle que soit la session. Redémarrer la session Claude Code pour qu'elle
soit détectée.

- [ ] **Step 2: Invoquer `/doc-client` sur le client coolbeans**

Périmètre du scan : le repo `/dev/coolbeans` (site + portail myCoolbeans).
Mode attendu : **update** (le dossier `docs/coolbeans/` existe, avec
`01-vente.mdx` en `final`). La skill doit :

1. Charger `01-vente.mdx` et retenir son `updated` comme horizon.
2. Scanner le repo : stack Astro/Cloudflare, scripts (`verify`, `tokens`),
   workflow de déploiement (Workers Builds, `main`→prod, `staging`→staging),
   portail (Clerk, registre clients, modules), partis pris documentés dans
   `docs/superpowers/specs/`.
3. Proposer le récapitulatif : pages par feature à créer (attendu, à titre
   indicatif : vue d'ensemble, déploiement & environnements, portail
   client, doc & devis, conventions CSS/design system), conflits éventuels
   avec `01-vente.mdx`, questions en un seul message.
4. Attendre la validation de Ludo, puis écrire en `draft`.

- [ ] **Step 3: Vérifier l'acceptation**

La doc produite respecte, page par page :

- une page par feature, profondeur progressive (usage → modifiable →
  fonctionnement → référence) ;
- première ligne = à qui + pour quoi faire ;
- aucun TODO, aucune date-actualité, aucun secret, aucun code collé qui ne
  soit pas éditable par le lecteur ;
- max un callout par écran, pas d'emoji ;
- `status: draft` partout, aucun commit fait par la skill ;
- `npm run build` passe (frontmatter valides).

Tout écart = correction de SKILL.md ou des references (retour Task 2/3),
pas une rustine sur le contenu produit.

- [ ] **Step 4: Validation finale (manuel, Ludo)**

Relire les pages, ajuster, passer en `final`, committer. Ce geste clôt le
plan ; la migration Amusoire (spec §6) est le chantier suivant, hors scope.

---

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : §3 → Task 1 ; §4.1-4.8 → Tasks 2-3 (SKILL.md et
  references reprennent chaque règle) ; §5 (onboarding) → couvert par le
  mode init + le trigger onboarding dans la description de SKILL.md, aucune
  skill séparée à créer conformément à la spec ; §7 → Task 4 ; §6 et §8
  explicitement hors scope (Global Constraints).
- **Placeholders** : aucun — SKILL.md et les deux references sont écrits in
  extenso dans les tasks.
- **Cohérence des noms** : `client` (schéma, param `clientParam`, prop
  DocLayout) ; `doc-client` ; `references/structure.md` /
  `references/redaction.md` identiques entre SKILL.md (Task 2) et Task 3.
