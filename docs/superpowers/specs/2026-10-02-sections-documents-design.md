# Une liste de sections par type de document

Date : 2026-10-02
Statut : design validé en conversation le 2026-10-02, spec à relire
Chantier : « Documents client, harmonisation », lot 2 sur 4. Lot 1 : `2026-10-02-pronom-fiche-client-design.md`.
Dépend de : la fusion de `feat/documents-portail`, qui déplace les gabarits dans `src/components/documents/pages/` et pose `src/lib/documents/sections.ts`.

## Pourquoi

Les 37 documents emploient une soixantaine de titres de section. Une V2 ne reprend pas toujours ceux de sa V1 : la V1 et la V2 UnlockBreath n'en partageaient que quatre. Les versions vivent sous des onglets d'une même page, et la nav des sections se construit à partir des titres : elle change quand on change d'onglet.

Les titres sont longs (« Tu restes autonome sur ton contenu ») et portent un pronom, qui les lie au registre du client.

## Décisions de Ludo du 2026-10-01 et du 2026-10-02

1. Chaque type de document a sa liste fixe de sections.
2. Le YAML écrit un identifiant de section. Le titre vient du code.
3. Un titre fait un à trois mots, sans pronom.
4. Un contenu propre à un document se range dans une section de la liste, en sous-bloc. Un sous-bloc a un titre libre, de niveau 3.
5. Le code trie les sections selon la liste. L'ordre du YAML ne compte pas.
6. Les versions d'un même document portent exactement les mêmes sections. Un test bloque l'écart.
7. Tous les documents se migrent, envoyés et signés compris. Les montants et les engagements ne bougent pas.
8. Les listes sont courtes. Ludo les corrigera à l'usage.

## Les listes

### Proposition

| Ordre | Identifiant | Titre | Ce qu'elle reçoit |
|---|---|---|---|
| 1 | `contexte` | Contexte | Le besoin, l'objectif, le pourquoi d'un avenant, ce que le projet change pour le client |
| 2 | `perimetre` | Périmètre | Les pages, les fonctionnalités, l'identité, l'autonomie éditoriale, les recommandations |
| 3 | `technique` | Technique | La stack et les outils |
| 4 | `budget` | Budget | Le bloc budget, et en sous-blocs : options, abonnements, validité |
| 5 | `inclus` | Inclus | Ce que la prestation comprend, et ce qu'elle ne comprend pas |
| 6 | `a-fournir` | À fournir | Ce que le client apporte, et quand |
| 7 | `planning` | Planning | Le bloc planning |

### Cadrage

| Ordre | Identifiant | Titre | Ce qu'elle reçoit |
|---|---|---|---|
| 1 | `contexte` | Contexte | Le besoin tel que compris |
| 2 | `analyse` | Analyse | Les constats, en sous-blocs |
| 3 | `solutions` | Solutions | Le comparatif, le simulateur, une marche à suivre en sous-blocs |
| 4 | `questions` | Questions | Les questions du formulaire |

### Livrable

| Ordre | Identifiant | Titre | Ce qu'elle reçoit |
|---|---|---|---|
| 1 | `resume` | Résumé | L'essentiel en deux minutes |
| 2 | `realise` | Réalisé | Ce qui a été fait et les choix, en sous-blocs |
| 3 | `parcours` | Parcours | Le bloc parcours |
| 4 | `a-verifier` | À vérifier | Ce que le client doit regarder ou trancher |
| 5 | `suite` | Suite | La suite, et le message à envoyer |

### Témoignage

| Ordre | Identifiant | Titre | Ce qu'elle reçoit |
|---|---|---|---|
| 1 | `contexte` | Contexte | Pourquoi la demande, ce qu'en fait Coolbeans, l'aperçu du cas client |
| 2 | `questions` | Questions | Les questions du formulaire |

Les listes vivent dans `src/lib/documents/sections.ts`, qui porte déjà la nav des quatre gabarits. Une liste par type, un objet par section : identifiant, titre. L'audit aura la sienne quand il sera construit.

## Le format YAML

Une section s'écrit avec son identifiant, sans titre :

```yaml
sections:
  - section: perimetre
    texte: Introduction de la section, affichée sous le titre.
    liste: [...]
    blocs:
      - titre: L'identité
        texte: ...
        liste: [...]
```

- `section` est une énumération propre au type. Un identifiant hors liste, ou présent deux fois, refuse le build.
- `blocs` accepte `titre`, `texte`, `liste` et `note`, au format des sections d'aujourd'hui. Les blocs gardent l'ordre du YAML.
- Les blocs de données gardent leur forme : `budget`, `planning`, le `comparatif` et le `simulateur` du cadrage, le `parcours` du livrable. Ils se rangent dans leur section, et perdent leurs titres en clair (`parcoursTitre`, `aVerifierTitre`, `suiteTitre`, `comparatif.titre`, `simulateur.titre`, `message.titre`).
- Le cadrage et le témoignage remplacent `intro` par `sections`, comme la proposition et le livrable.

## Le rendu

- Les gabarits trient les sections selon la liste du type, et ignorent l'ordre du YAML.
- Le titre vient de la liste. Les blocs prennent un titre de niveau 3.
- L'ancre d'une section est son identifiant, préfixé par la version quand il y en a plusieurs (`v2-budget`), comme aujourd'hui.
- La nav des sections se construit depuis la liste, à partir des sections présentes.
- Le surlignage des nouveautés d'une version compare désormais les blocs par leur titre et leur texte, et les sections par leur identifiant.

## Migration

Un script, lancé une fois et relu en diff, réécrit les 37 YAML :

1. Chaque section existante reçoit l'identifiant de la table de correspondance ci-dessous.
2. Une section seule sur son identifiant garde son contenu tel quel.
3. Plusieurs sections sur le même identifiant deviennent des blocs. Chacun garde son ancien titre mot pour mot : un titre de bloc fait partie du corps, déjà écrit dans le registre du client.
4. Les champs de titre en clair disparaissent.
5. Le corps, les montants et les dates ne changent pas d'un caractère. Un test le vérifie en comparant le texte rendu avant et après, titres exclus.

Le script s'arrête sur tout titre qui n'est pas dans la table, plutôt que de deviner.

### Table de correspondance

| Type | Anciens titres | Identifiant |
|---|---|---|
| Proposition | Ce que j'ai compris, Objectif, Le projet, Le principe, Pourquoi cet avenant, Ce que tu y gagnes, Ce que le site change, Ce que la V2 change, Comment une demande se décompte | `contexte` |
| Proposition | Pages, Pages du site, Le site, La page, Fonctionnalités, L'identité, Ce qui est mis en place, Ce qui est fait, Quelques recos, Tu restes autonome sur ton contenu, Ce que tu modifies toi-même, Périmètre | `perimetre` |
| Proposition | Stack, Stack technique recommandée, Socle technique, Technique, Les outils, La machine dessous | `technique` |
| Proposition | Budget, Le budget, Le travail, poste par poste, En option, Ce que tu paies chaque mois, Coûts à anticiper, hors prestation, Validité, Suites | `budget` |
| Proposition | Ce que ça comprend, Ce que couvrent les heures, Ce qui n'était pas compris | `inclus` |
| Proposition | De ton côté, De votre côté, Ce qu'il me faut, Ce dont j'ai besoin de vous, et quand, Ce dont j'ai besoin de toi, et quand, Ce qui reste avant la mise en ligne | `a-fournir` |
| Proposition | Planning, Le déroulé | `planning` |
| Cadrage | Ce que j'ai compris, Ton besoin comme je l'ai compris, Pourquoi ce point, Ce que j'ai fait, Un avertissement | `contexte` |
| Cadrage | Sur l'autonomie, Sur la remarque de ton collègue, Sur le site actuel, L'ancien nom, cafamp.org, Les autres clubs du réseau, Pourquoi c'est vous qui l'achetez, Pourquoi Infomaniak, les constats du manuscrit (Les titres à Des faits, La langue) | `analyse` |
| Cadrage | Le comparatif, le simulateur, La stack que je te propose, L'espace de rédaction, en vidéo, les étapes 1 à 5 de l'achat du domaine, Ce que je ferais | `solutions` |
| Cadrage | Les questions | `questions` |
| Livrable | En deux minutes, Ce que j'ai trouvé, Le point qui compte, Ce que j'ai fait, Les limites de ma recherche | `resume` |
| Livrable | Ce que vous voyez, La logique, Les choix esthétiques, Les choix techniques, La boutique aujourd'hui, Ce qui a été fait, L'état de santé, Les textes écrits pour Google, Le stock entre vos canaux, L'écriture, Les photos, Les dates des anciens articles, Le reste, Deux choses à corriger de notre côté | `realise` |
| Livrable | Le parcours (tous libellés) | `parcours` |
| Livrable | Ce que je vous demande de vérifier, de regarder, de relire, Ce que je n'ai pas pu vérifier, Ce qu'il te reste à trancher, Trois citations à refermer, Un découpage à valider, Des repères temporels, Deux points de contenu à trancher | `a-verifier` |
| Livrable | La suite, Ce qu'il reste à faire, Ce qu'il reste, et chez qui, Votre espace Coolbeans, Le message à envoyer | `suite` |
| Témoignage | Pourquoi je vous demande ça, Ce que j'en fais, l'aperçu du cas client | `contexte` |
| Témoignage | Les questions | `questions` |


## Tests

- Schéma : un identifiant hors liste, ou en double, est refusé, pour chaque type.
- Tri : un YAML aux sections dans le désordre rend la page dans l'ordre de la liste.
- Versions : un test parcourt les YAML et vérifie que chaque version porte les mêmes identifiants que sa racine.
- Migration : le texte rendu de chaque document, titres exclus, est identique avant et après.
- Nav : elle liste les sections présentes, dans l'ordre, avec les ancres posées par les gabarits.

## Hors périmètre

- La place des titres, au-dessus du contenu, et la largeur des sections : lot 3.
- Le pronom : lot 1. Les titres n'en portent plus, ils sortent de son champ.
- Le corps des documents, qui n'est pas réécrit.

## Documentation

- `src/content/docs/coolbeans/05-chiffrages-et-devis.mdx` : les listes, le format `section` et `blocs`.
- Skill `proposition-commerciale` : `references/composition.md` (format YAML, liste de la proposition) et `references/cadrage.md` (liste du cadrage). La règle « La liste des sections est un invariant entre versions » de `SKILL.md` renvoie au test qui la garantit.
- Skill `livraison-client` : la liste du témoignage.
- `docs/superpowers/specs/README.md` : la ligne de cette spec.
