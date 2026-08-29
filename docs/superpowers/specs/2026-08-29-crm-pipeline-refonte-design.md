# CRM — Refonte du pipeline

Date : 2026-08-29 · Statut : validé, en attente d'exécution.

Amende `2026-08-19-crm-opportunites-checklist-design.md`, dont le modèle hybride
(check-list en description, sous-issue = prochaine action) **reste en vigueur**.
Cette spec ne touche pas au modèle : elle refait l'axe des statuts, que la spec du
19 n'avait pas traité.

Ancre Linear : team `🎯 CRM` (`8b4d63de-72f5-4960-9e71-b5622b96a556`).

## 1. Le problème

Le modèle hybride a été appliqué le 2026-08-29 au matin. Le board est resté
illisible l'après-midi même. La cause n'était pas dans le modèle.

**Dans Linear, les workflow states sont par team, pas par type d'objet.** Tant que
les affaires et leurs actions vivent dans la même team, elles partagent le même jeu
de colonnes. La spec du 19 a séparé les *vocabulaires* (emoji = affaire, sans emoji
= action) mais pas les *axes*. Une convention humaine sans contrainte technique
dérive, et elle a dérivé.

État constaté le 2026-08-29, 17 statuts pour 50 issues (26 affaires, 24 actions) :

- **La dérive a eu lieu.** `CRM-44` (« Relancer Danaë ») et `CRM-33` sont des
  sous-actions classées `🪦 Perdu`. Pire, `CRM-44` est « perdue » alors que son
  affaire `CRM-42` est vivante en `🎯 Besoins définis` : un état d'affaire a servi à
  annuler une tâche, faute de colonne pour ça. Symétriquement, les sous-issues
  créées par API atterrissent en `📥 Triage lead`, qui n'est censé contenir que des
  mails entrants.
- **10 statuts sur 17 sont typés `started`.** Cycle time, vues « active » et graphes
  ne veulent plus rien dire.
- **27 % du board n'est plus de la vente.** 7 affaires sur 26 sont post-signature
  (`🚀 Acompte réglé`, `🏗️ En production`, `✅ Soldée`), alors que la production vit
  déjà dans les teams projet et que la doctrine du 2026-08-29 interdit de la
  dupliquer.
- **Deux doublons.** `☄️ Relancé` est un événement, pas un état, et les labels
  `relance-1/2/3` existent déjà. L'emoji `📝` sert à la fois à `Devis envoyé` et à
  `Solde envoyé`.
- **La règle d'or est en défaut sur 7 affaires** (§7), qui n'ont aucune action
  assignée et datée.

Le fond : un **processus en 13 étapes** a été modélisé dans l'axe qui sert à dire un
**état d'avancement**. Un board répond à « où en est cette affaire », pas à « étape 7
sur 14 ». La check-list, elle, est au bon endroit depuis le 2026-08-29.

## 2. Décision — le pipeline en 10 colonnes

Le CRM garde l'affaire **jusqu'à l'encaissement du solde**, mais ne rejoue pas la
production : le post-signature passe de 4 colonnes à 2, dont la seconde est un rappel
d'argent.

| # | État | Type | Ce qu'il veut dire |
|---|---|---|---|
| 1 | `📥 Triage lead` | `backlog` | mail entrant non qualifié, SLA 4 h |
| 2 | `👋 Contacté` | `unstarted` | contact établi, rien de calé |
| 3 | `📆 Rdv pris` | `started` | découverte calée ou faite |
| 4 | `🎯 À chiffrer` | `started` | besoin cadré, devis à produire |
| 5 | `📝 Devis envoyé` | `started` | devis parti — inclut relances **et** négo |
| 6 | `🏆 Signée` | `started` | acompte réglé, production en cours dans la team projet |
| 7 | `🧾 Solde à encaisser` | `started` | livré, facture de solde à émettre ou en attente de règlement |
| 8 | `🧊 En veille` | `started` | gelée mais vivante, relance différée (§5) |
| 9 | `✅ Soldée` | `completed` | encaissé, terminé |
| 10 | `🪦 Perdue` | `canceled` | + label `Perte` obligatoire |

Vocabulaire des actions réduit à **`Todo` / `Done`**. Avec `Duplicate`, la team passe
de **17 statuts à 13**, et le board affaires n'en montre que 10.

## 3. Ce qui disparaît

| État supprimé | Devient | Pourquoi |
|---|---|---|
| `☄️ Relancé` | labels `relance-1/2/3` | une relance est un événement daté, pas un état ; les labels existent et se cumulent |
| `💪 Négo` | `📝 Devis envoyé` | la négo est un moment du devis envoyé, pas un état séparé ; 1 seule occupante, et c'est une affaire perdue |
| `🏗️ En production` | `🏆 Signée` | la production vit dans la team projet, on ne la duplique pas |
| `Doing` | `Todo` | 0 issue l'a utilisé ; en solo une action est à faire ou faite |

Deux renommages sans changement de type, donc sans migration : `🎯 Besoins définis`
→ `🎯 À chiffrer`, `🚀 Acompte réglé` → `🏆 Signée`, `📝 Solde envoyé` →
`🧾 Solde à encaisser` (emoji dédoublonné), `🪦 Perdu` → `🪦 Perdue`.

**Aucune recréation d'état n'est nécessaire.** `🧊 En veille` conserve son type
`started`, décidé le 2026-08-26 pour qu'elle tombe en fin de board : Linear trie les
colonnes par catégorie, un état `backlog` remonterait forcément à côté du Triage. La
distorsion des stats reste assumée.

## 4. Les actions ne peuvent plus dériver

La convention emoji est remplacée par deux contraintes.

1. **Le board affaires est filtré `Sub-issues: exclude` + `Hide empty groups`.** Une
   action n'apparaît plus jamais dans une colonne de pipeline, et `Todo` / `Done` /
   `Duplicate` disparaissent de la vue. Une seconde vue **« Mes actions »** filtre
   l'inverse, groupée par échéance.
2. **Le statut par défaut des sous-issues est forcé à `Todo`.** Via les réglages de
   team si Linear expose un défaut distinct pour les sous-issues ; sinon par le
   gabarit `🧬 Opportunité` et par la skill `linear`, qui pose explicitement `Todo` à la
   création. C'est ce qui règle le constat du 2026-08-29 (sous-issues API tombant en
   `📥 Triage lead`).

Une action obsolète passe en `Done` puis s'archive. Elle n'emprunte jamais `🪦 Perdue`.

## 5. Règle nouvelle — l'affaire en veille

Décision du 2026-08-29 : **`🧊 En veille` n'est pas un cimetière.** Une affaire y
entre parce que la relance est différée, pas parce qu'elle est morte.

- Elle porte **obligatoirement une action de suivi datée**, typiquement à J+30 ou
  J+90 : « Revenir vers X ». La règle d'or s'applique à elle comme aux autres.
- Si l'affaire est jugée morte, elle ne va pas en veille : elle passe en `🪦 Perdue`
  avec son label `Perte`. On recrée une affaire si elle redémarre.

Une affaire en veille sans action datée est un défaut de tenue, pas un état normal.

## 6. Plan de migration Linear

À exécuter dans cet ordre, sur feu vert de Ludo. Chaque étape est réversible.

1. Renommer `🎯 Besoins définis` → `🎯 À chiffrer`.
2. Renommer `🚀 Acompte réglé` → `🏆 Signée`.
3. Renommer `📝 Solde envoyé` → `🧾 Solde à encaisser`.
4. Renommer `🪦 Perdu` → `🪦 Perdue`.
5. Migrer les 5 affaires de `🏗️ En production` (`CRM-26`, `CRM-28`, `CRM-29`,
   `CRM-30`, `CRM-46`) vers `🏆 Signée`, puis supprimer `🏗️ En production`.
6. Passer `CRM-22` (En Haut) de `💪 Négo` à `🪦 Perdue` + label `prix` (§7), puis
   supprimer `💪 Négo`.
7. Supprimer `☄️ Relancé` et `Doing` (0 issue chacun).
8. Vérifier les positions pour obtenir l'ordre du §2 — les collisions décalent les
   voisins, poser les positions dans l'ordre croissant.
9. Régler le statut par défaut des sous-issues sur `Todo` (§4).
10. Créer les deux vues de board : « Affaires » (`Sub-issues: exclude`,
    `Hide empty groups`) et « Mes actions » (sous-issues, groupées par échéance).
11. Réécrire la description de la team CRM, qui décrit encore le modèle à 13 états.

## 7. Rattrapage des données

**Corrections d'incohérence :**

- `CRM-44` et `CRM-33`, sous-actions classées `🪦 Perdu` → `Done`, puis archivées.
- `CRM-22` (En Haut) → `🪦 Perdue` + label `prix`. L'affaire est refusée depuis le
  2026-08-24 sur le prix et sur le contenu. Ses 2 actions ouvertes (`CRM-45` due
  2026-09-01, `CRM-23` due 2026-08-14) sont fermées en `Done` et archivées.
- `CRM-8` « Dos et posture » est un doublon de `CRM-34` « 🧘 dos et posture ». On
  garde `CRM-34` (plus récente, emoji conforme, label `inbound`) ; `CRM-8` passe en
  `Duplicate` et s'archive.

**Les 7 affaires vivantes sans action datée** (violation de la règle d'or). Actions
et échéances proposées, à ajuster par Ludo :

| Affaire | État | Action proposée | Échéance |
|---|---|---|---|
| `CRM-13` ⚡️ trigger / miharu PDF [300 €] | `🎯 À chiffrer` | Chiffrer et envoyer le devis | 2026-09-01 |
| `CRM-34` 🧘 dos et posture | `👋 Contacté` | Relancer et qualifier le besoin | 2026-09-02 |
| `CRM-4` Heavenly Sweetness [2000 €] | `👋 Contacté` | Relancer et qualifier le besoin | 2026-09-02 |
| `CRM-5` Studio TRAMES | `👋 Contacté` | Relancer et qualifier le besoin | 2026-09-03 |
| `CRM-6` Thomas Perea | `👋 Contacté` | Relancer et qualifier le besoin | 2026-09-04 |
| `CRM-7` Faris | `👋 Contacté` | Relancer et qualifier le besoin | 2026-09-05 |
| `CRM-41` Mathilde Chevalier — Refonte Astro | `🧊 En veille` | Revenir vers Mathilde (J+90) | 2026-11-27 |

Si une de ces affaires n'a toujours pas de signal d'achat à sa relance, elle sort du
board vers le Sheet vivier plutôt que de stagner en `👋 Contacté`.

**Deux actions périmées à retrancher au passage :** `CRM-3` (due 2026-03-01) et
`CRM-23` (due 2026-08-14) portent des échéances mortes depuis des mois.

**Décidé le 2026-08-29 :** `CRM-1` « 🔁 Revue vivier + hygiène pipeline » (label `ops`)
n'est pas une affaire mais une tâche récurrente d'exploitation. Elle **sort vers la
team Coolbeans** en issue récurrente, sinon elle squatte le board affaires même après
le filtre du §4. Son identifiant change au déplacement : mettre à jour les renvois qui
la citent, dont cette spec.

## 8. Le SOP — trois dettes empilées

Le tunnel est codé en dur dans `src/data/sop.ts` (22 étapes S0→S21, 6 phases) et
`src/content/docs/coolbeans/02-vente.mdx`, tous deux rendus sur `/docs/coolbeans`.
L'inspection du 2026-08-29 montre que la refonte du pipeline n'est que la troisième
dette du SOP, pas la seule. Les trois se traitent en une passe.

**Dette 1 — Asana.** `S10 Onboarding` prescrit « créer la team Asana du client »,
« dupliquer `.🧱 [MODÈLE] Projet client` » et le champ `asana_team_gid`. Ses outils
listés sont Asana et Clerk. `S9` liste `Asana — 🎯 crm`. `S11` fait traverser aux
tâches les colonnes Asana `🧱 Backlog / 🚀 Sprint / 🚧 En cours / ☝️ Pour validation
/ ✅ Terminé`. Asana est abandonné depuis le 2026-08-13 : le champ est `linearTeamId`,
le gabarit est la team « Modèle client ».

**Dette 2 — Clerk.** `S10` prescrit « créer l'utilisateur Clerk avec son
`publicMetadata` ». La sortie vers Better Auth est décidée depuis le 2026-08-18 et la
skill `onboarding-client` crée déjà le compte en Better Auth.

**Dette 3 — le pipeline.** Les champs `colonneCrm` référencent `🚀 Acompte réglé`,
`🏗️ En production`, `🎯 Besoins définis`, `📝 Solde envoyé`, `💪 Négo`, `☄️ Relancé`.
Tous renommés ou supprimés par le §2.

**Demande de Ludo du 2026-08-29 : intégrer `onboarding-client` au SOP.** `S10` décrit
6 actions ; la skill en tient 8, précédées d'un **routage en 4 questions** (repo
GitHub ? quelle stack ? workspace portail ? compte utilisateur ? monitoring ?) et
suivies de deux étapes que le SOP ignore : **les engagements écrits du client**
(ce qui est à sa charge porte une date et une porte de sortie) et le **write-back**
dans Linear. `S10` est donc réécrite d'après la skill, et non simplement dépoussiérée.
Les règles cardinales de la skill (rien en prod sans ordre explicite, aucun mail au
client sans validation) remontent dans le SOP, qui est le manuel d'exploitation.

Le travail reste sur `staging`. Aucune publication en production sans ordre explicite.

Aucune skill ne code les états du pipeline (vérifié le 2026-08-29) ; la skill `linear`
n'a besoin que de la règle `Todo` du §4.

Le travail reste sur `staging`. Aucune publication en production sans ordre explicite.

## 9. Ce qu'on perd, assumé

- **La granularité du post-signature.** On ne distingue plus « acompte réglé » de
  « en production » ni de « solde envoyé ». L'avancement réel se lit dans la team
  projet, et `🧾 Solde à encaisser` suffit à ne pas oublier d'argent — c'est ce qui
  aurait attrapé les 3 500 € en retard de `CRM-35` et `CRM-36`.
- **La distinction négo / silence.** Une affaire en `📝 Devis envoyé` peut être en
  discussion active ou sans réponse depuis trois semaines. Les labels `relance-1/2/3`
  et la date de la prochaine action portent l'information.
- **Les stats d'activité restent fausses tant que `🧊 En veille` est `started`.**
  Choix conscient, hérité du 2026-08-26 : la place de la colonne prime sur la
  justesse d'un graphe qu'on ne regarde pas.
