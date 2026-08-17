# Doc client Coolbeans — skill de rédaction et restructuration — design

Date : 2026-08-14 · Statut : validé en brainstorming

## 1. Contexte et objectif

Jusqu'ici, la doc technique d'un projet client (ex. Amusoire) était éditée au
fil de l'eau par Claude Code pendant les sessions de travail normales, dans le
repo du client (`amusoire/docs/PASSATION.md`, 78 Ko). Résultat : une doc
désordonnée, avec du code éparpillé et des phrases narratives de type
changelog (« nouvelle procédure actée, l'ancienne n'est plus utilisée ») au
lieu d'un instantané propre de l'état actuel.

Objectif : reprendre la main sur la mise à jour de la doc via une skill dédiée,
invoquée explicitement par Ludo (jamais en session de code normale), qui
scanne l'état réel d'un projet et propose des mises à jour validées avant
écriture.

**Exigence de fond sur le contenu** (posée en relecture du 2026-08-14) : la
doc est lisible de bout en bout par le client, y compris les détails
d'implémentation — vocabulaire accessible à une équipe marketing même sur les
points très techniques. Elle doit permettre au client de confier le projet à
un autre développeur et que la reprise soit fluide. **Pas de filtrage par
audience** (option envisagée puis rejetée) : tout le monde voit tout, c'est
l'écriture qui porte l'accessibilité, pas un cloisonnement de pages.

**Découverte en cours de brainstorming** : une bonne partie de l'infrastructure
existe déjà dans `coolbeans` et n'a pas besoin d'être redesignée — voir §2.

## 2. Ce qui existe déjà — inchangé

- Collection de contenu `docs` (`src/content.config.ts`) : un fichier `.mdx`
  par page, dans `src/content/docs/<slug>/`, schéma `title`, `order`,
  `status: draft|review|final`, `updated`, `description`.
- Gabarit `src/content/docs/_template/` : 6 pages canoniques (vue d'ensemble,
  éditer le site, intégrations et leads, features sur mesure, sécurité et
  conformité, référence et support). Les projets peuvent ajouter des pages
  hors gabarit (ex. `amusoire/04-simulateur-roi.mdx`).
- Layout maison (`DocLayout.astro`, `SidebarNav.astro`, `TocRight.astro`) :
  nav, prev/next et index de recherche calculés dynamiquement depuis la
  collection triée par `order` (`src/pages/docs/[project]/[...slug].astro`,
  lignes 59-91) — rien n'est codé en dur.
- Rendu derrière Clerk, intégré au portail (`PortalNav`/`PortalSidebar`,
  sélecteur de client).
- Lien client → doc : `src/content/clients/<slug>.yaml`, champ `doc: <slug>`,
  toujours 1:1 (un client peut avoir plusieurs projets/repos réels — ex.
  Amusoire site + Amusoire perf-audit — mais une seule doc ; les projets
  successifs **incrémentent** la même doc, pas de sous-arbre par projet).

**Décision écartée : migration vers Astro Starlight.** Envisagée puis
abandonnée après vérification (§9) — aucune dépendance Starlight n'a jamais
existé dans le repo, et les arguments en sa faveur (recherche, nav
auto-générée) ne tiennent pas à l'échelle réelle (7-15 pages par client, index
indépendant par client). Le système maison reste en place.

## 3. Renommage `project` → `client` dans le schéma

Le code existant nomme ce champ `project` (`content.config.ts`,
`DocLayout.astro`, `[project]/[...slug].astro`, `lib/portail/clients.ts`)
alors que le modèle est désormais explicitement client-first (§2). Ça n'a
jamais posé de problème tant qu'un projet = un client par coïncidence ; ça en
posera dès que la skill doit raisonner en « à quel client j'ajoute cette
page ».

**À faire, avant l'implémentation de la skill :**
- `content.config.ts` : `docs` collection, `project: z.string()` → `client:
  z.string()`.
- Dossier de route : `src/pages/docs/[project]/` → `src/pages/docs/[client]/`
  (le chemin d'URL `/docs/<slug>/...` ne change pas, seul le nom du paramètre
  interne change).
- `DocLayout.astro` (props), `Meta.astro` si concerné, tout usage de
  `entry.data.project` / `Astro.params.project`.
- Fichiers `.mdx` existants (`amusoire/*.mdx`, `coolbeans/01-vente.mdx`) :
  frontmatter `project: amusoire` → `client: amusoire`.

Pas de changement de comportement utilisateur, refactor mécanique pure.

## 4. La skill `doc-client`

### 4.1 Emplacement

`coolbeans-claude-skills/skills/doc-client/` — **pas** dans `/dev/coolbeans`.
Même repo que la skill `linear`, même structure (`SKILL.md` + `references/`),
dont elle s'inspire directement.

### 4.2 Prérequis

Accès en lecture au repo du projet cible (code, `git log`) et en
lecture/écriture à `coolbeans/src/content/docs/<client>/`. Si l'un des deux
manque, s'arrêter et le dire — jamais de contenu inventé.

### 4.3 Règle cardinale

**Ne jamais écrire une page sans avoir présenté et fait valider le
récapitulatif de ce qui va changer.** Pas de git diff a posteriori comme seul
garde-fou : le récapitulatif (pages touchées, ajouts/changements/retraits)
est présenté et validé **avant** l'écriture des fichiers, comme la skill
`linear` valide avant `save_issue`.

Corollaires :
- Jamais de `status: final` posé par la skill elle-même — seulement `draft`
  ou `review`. Le passage à `final` et le commit restent des gestes manuels
  de Ludo.
- Jamais de contenu déduit/supposé qui n'est pas observable dans le repo
  scanné.
- Jamais de secret, clé API ou token trouvé pendant le scan recopié dans la
  doc — le signaler dans le récapitulatif à la place.

### 4.4 Flux

1. **Identifier le client** : résoudre `clients.yaml` → dossier
   `docs/<client>/`. Si absent → mode `init`.
2. **Charger l'état actuel** : lire les pages existantes et leur `updated`.
3. **Scanner le repo cible** :
   - `init` (première fois sur ce client) : scan complet du repo.
   - `update` : incrémental — `git log --since=<updated le plus ancien>` sur
     le repo cible, ciblé sur ce qui a changé depuis la dernière page mise à
     jour, pas un re-scan complet à chaque fois.
4. **Extraire les faits observables** — stack, workflows, décisions
   d'architecture visibles dans le code/commits/config, jamais de supposition.
5. **Détecter les conflits AVANT de proposer** : si le scan contredit une page
   existante en `status: final`, le signaler explicitement plutôt que
   d'écraser silencieusement (équivalent de la détection de doublons Linear,
   avant les questions).
6. **Présenter le récapitulatif** : pages touchées, nature du changement,
   raison. Poser les questions manquantes en une fois s'il en reste
   (ex. contexte que le code seul ne révèle pas). Attendre la validation.
7. **Rédiger** selon `references/redaction.md`, en `status: draft` ou
   `review`.
8. Ne jamais commit, ne jamais passer en `final`.

### 4.5 Structure du contenu : par feature, profondeur progressive

Décision (2026-08-14, remplace une option « doc simple + annexes techniques »
écartée — l'annexe recrée la ségrégation d'audience et pourrit en silence) :

- **Une page par feature** : tout ce qui touche une feature — usage simple et
  détail technique — vit sur la même page (modèle déjà en place :
  `amusoire/04-simulateur-roi.mdx`, `05-popup-opt-in.mdx`).
- **Profondeur progressive dans la page**, dans cet ordre : (1) ce que c'est
  et à quoi ça sert ; (2) ce que le client peut modifier lui-même ;
  (3) comment ça fonctionne, en langage clair ; (4) référence technique
  exacte en bas de page (sélecteurs, IDs, chemins de fichiers). Le lecteur
  s'arrête où son besoin s'arrête ; le dev repreneur descend jusqu'au fond.

### 4.6 Références externalisées

| Fichier | Contient |
|---|---|
| `references/structure.md` | Pages canoniques du gabarit, modèle « une page par feature » + ordre de profondeur progressive (§4.5), quand ajouter une page hors gabarit, règle « une page = un sujet, lisible en 5 min » (au-delà : scinder en sortant la référence pure) |
| `references/redaction.md` | Règles d'écriture, voir §4.7 |

### 4.7 Règles de rédaction (contenu de `references/redaction.md`)

Tirées de l'audit des pages Amusoire existantes (relecture 2026-08-14) :

- **Langage clair partout, même au fond de la couche technique** : chaque
  terme technique est expliqué dans la phrase même ou remplacé, jamais
  supposé connu. Étalon : une équipe marketing comprend la section. Ex. :
  « Make évalue toute chaîne non vide comme truthy » → « une case non cochée
  doit envoyer une valeur vide, jamais le texte "false" : Make considère
  n'importe quel texte comme un oui ».
- **Rationale ≠ narration** : le *pourquoi* intemporel d'une décision se
  garde (ex. « pourquoi Resend : l'add-on HubSpot coûte ~600 $/mois ») ;
  l'*actualité* d'un changement se jette (« confirmée le 2026-07-24 »,
  « l'ancienne procédure n'est plus utilisée », « en attendant sa
  suppression »).
- **Aucun TODO dans la doc** : un écart constaté entre le réel et le souhaité
  devient une issue Linear (la skill la propose pendant le scan), jamais une
  annotation « à faire » dans une page. La doc décrit ce qui est ; Linear
  porte ce qui doit changer.
- **Sobriété (cible Geist)** : un encart (callout) par écran maximum ; le
  gras réservé à l'unique chose à ne pas rater ; zéro emoji dans le corps de
  texte et les liens.
- **Politique du code** : on n'inline que ce que le lecteur va *éditer*
  (ex. coefficients en Custom Attributes Webflow). Tout le reste se référence
  par chemin de fichier vers le repo, jamais collé — le code cité en doc ment
  dès le commit suivant.
- **Première ligne de chaque page** : à qui elle s'adresse et ce qu'on peut
  en faire.
- **Secrets** : jamais recopiés (cf. §4.3).

### 4.8 Cas particuliers

- **Premier scan d'un client** : mode `init`, page vierge depuis `_template`.
- **Rien de neuf détecté** : le dire explicitement, ne pas inventer de contenu
  pour meubler le récapitulatif.
- **Client multi-projets** (ex. Amusoire site + perf-audit) : les projets
  successifs incrémentent la même doc client, pas de sous-arbre séparé (§2).
- **Contenu sensible détecté** (secret, clé API) : jamais recopié, toujours
  signalé.

## 5. Onboarding nouveau client

Pas une skill séparée : une étape du flux d'onboarding existant (registre
`clients.yaml` + team Linear, via la skill `linear` ou à la main) qui invoque
`doc-client init` comme étape doc. Pas de nouvelle skill dédiée à
l'onboarding pour l'instant — à revisiter si ce flux se complexifie.

## 6. Migration de la doc existante

Seul Amusoire a une doc legacy substantielle
(`amusoire/docs/PASSATION.md` + `sitemap-brief-claude-design.md` ;
`index.html` est un artefact de build, pas une source). Une fois fusionné
dans `docs/amusoire/*.mdx` (via `doc-client update`, en éliminant toute
narration), les fichiers legacy du repo Amusoire sont **supprimés**
(l'historique reste dans git). Zelidom a un doc isolé
(`integration-o2.html`), secondaire, à migrer si utile plus tard. Les autres
clients (fylgo, littlebox, sete_en_corps_mieux, atelier-cecile-geiger)
n'ont pas de doc legacy substantielle : onboarding à froid via §5, pas de
migration.

Hors scope de cette itération — chantier séparé, après que la skill soit
construite et validée sur un premier cas réel (§7).

## 7. Premier cas d'usage réel : doc Coolbeans

Une fois la skill construite, premier run en mode `init`/`update` sur le
client `coolbeans` lui-même (site + myCoolbeans), pour produire la doc
manquante : scripts, workflows, partis pris d'architecture, informations
importantes. Objectif explicite de Ludo : pouvoir revenir dans 3 mois et
comprendre pourquoi telle décision a été prise. Sert aussi de validation de
bout en bout de la skill avant de l'utiliser sur des clients.

## 8. Hors périmètre

- **Refonte Geist de l'UI `/docs/*`** : chantier séparé, condition de la mise
  en prod / lancement client. Ne pas mélanger avec ce chantier.

## 9. Starlight — décision écartée

Aucune dépendance `@astrojs/starlight` n'a jamais existé dans le repo
(vérifié : `package.json`, `node_modules`, grep repo entier). Le layout
3 colonnes (`DocLayout.astro`) ressemble à Starlight par convergence de
pattern, pas par filiation. Les arguments initialement avancés en faveur
d'une migration (recherche à l'échelle, nav auto-générée) ne tiennent pas à
la taille réelle des docs (7-15 pages, un index indépendant par client) :
recherche JS maison suffisante, nav/prev/next déjà calculés dynamiquement
depuis la collection (§2). Reste non vérifié et non bloquant : la faisabilité
de faire tourner plusieurs instances Starlight indépendantes dans un seul
projet Astro gated Clerk — non pertinent puisque la migration n'est pas
retenue.
