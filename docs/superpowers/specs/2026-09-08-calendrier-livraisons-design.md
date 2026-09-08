# Calendrier « Livraisons » : design

Date : 2026-09-08
Statut : validé, prêt pour le plan d'implémentation

## Problème

Les échéances tenues devant les clients vivent dans Linear, sous forme de
milestones datées. Elles ne sont visibles nulle part ailleurs. Ludo n'a pas de
vision globale de ses livraisons à venir, indépendamment du moment où il fait
le travail. L'agenda Google est l'endroit où il regarde le temps.

## Décision

Un calendrier Google dédié, nommé **Livraisons**, alimenté en écriture par le
Worker depuis les milestones Linear. Le calendrier est un **miroir** : on n'y
écrit jamais à la main, et Linear reste la seule source de vérité.

Décisions prises lors du cadrage, à ne pas rouvrir sans raison :

- La source est **Linear**, pas le YAML des propositions commerciales. La page
  de proposition reste l'engagement contractuel, mais la date opérationnelle
  vit dans la milestone.
- Le calendrier **Linear** existant, vide et possédé par Ludo, n'est ni
  réutilisé ni renommé. « Livraisons » est un calendrier neuf.
- La distinction « jalon à moi / jalon au client » est **abandonnée**. Une
  milestone Linear est toujours un engagement de livraison de Coolbeans ; le
  YAML des propositions est le seul endroit qui porte `owner: client`, et il
  n'entre pas ici.

## Ce que le calendrier contient

Toutes les milestones de tous les projets Linear, teams clientes **et**
internes, sous trois exclusions :

1. milestone sans `targetDate` ;
2. projet dont le `status.type` est `canceled` ;
3. projet `Test` de la team `MOD` (gabarit de modèle client).

L'exclusion des milestones sans date n'est pas un filtre arbitraire : c'est la
traduction directe de la règle « pas de date cible tant que l'acompte n'est pas
encaissé ». Une affaire non signée n'a donc aucun événement, sans qu'aucun code
n'ait à connaître la notion de signature.

## Format de l'événement

- **Type** : journée entière, à la `targetDate` de la milestone.
  `start.date = targetDate`, `end.date = targetDate + 1 jour`.
- **Titre** : `<CLÉ_TEAM>-<étape>`, par exemple `CAF-Design`,
  `REV-Mise en ligne V1`, `SET-Développement`.
  - `CLÉ_TEAM` est la clé de la première team du projet Linear (`CAF`, `SET`,
    `REV`…). Elle n'est jamais saisie à la main. Un projet rattaché à plusieurs
    teams prend la première renvoyée par l'API ; le cas ne se présente pas
    aujourd'hui.
  - `étape` est le nom de la milestone, normalisé (voir ci-dessous).
- **Description** : nom du projet, puis lien vers le projet Linear.
- **Disponibilité** : `AVAILABILITY_FREE`. Une échéance n'occupe pas le temps
  de travail, elle le borne. Un jalon qui rendrait la journée « occupée »
  fausserait toute recherche de créneau.

### Normalisation du nom de milestone

Deux traitements, dans cet ordre :

1. Retrait d'un préfixe de code en tête :
   `^[A-Z]?\d+\s*[·\u2014\u2013-]\s*`. Les deux échappements sont le cadratin
   et le demi-cadratin, écrits ainsi pour ne pas contrevenir à la règle de
   rédaction : ils sont indispensables ici, les milestones existantes les
   utilisent comme séparateur. `P7 · Moteur d'observations` devient
   `Moteur d'observations` ; `S0`, suivi d'un cadratin puis de `Fondations`,
   devient `Fondations`.
2. Troncature à 30 caractères, avec `…` en fin si coupée.

Ce n'est pas la façon d'obtenir un bon titre, c'est un garde-fou. La convention
retenue est que **les milestones portent des noms courts et parlants**
(`Design`, `Développement`, `Mise en ligne`, `Recette`). La normalisation
garantit qu'une milestone jamais renommée produit tout de même un événement
lisible.

## Mécanique de synchronisation

### Réconciliation sans état

L'identifiant de l'événement Google est **dérivé** de l'identifiant de la
milestone Linear : `"lm" + <uuid sans tirets>`. Les identifiants Google
acceptent les caractères de `a` à `v` et de `0` à `9` ; un UUID
hexadécimal sans tirets
les respecte, et `lm` aussi.

Conséquence : créer et mettre à jour sont la même opération, et **aucune table
de correspondance n'est tenue**. Pas de D1, pas de KV, donc rien qui puisse se
désynchroniser de Linear.

Chaque événement écrit porte `extendedProperties.private.source = "livraisons"`,
qui permet de retrouver l'intégralité de ce que le Worker a posé sur le
calendrier, et lui seul.

### Cycle complet

1. Lire Linear : projets non annulés, avec teams et milestones.
2. Construire l'ensemble cible : une entrée par milestone datée retenue.
3. Lister les événements existants du calendrier filtrés sur
   `privateExtendedProperty=source=livraisons`.
4. Pour chaque entrée cible : `PUT /events/{id}`. Sur `404`, `POST /events`
   avec l'`id` choisi dans le corps.
5. Pour chaque événement listé absent de l'ensemble cible :
   `DELETE /events/{id}`. Les réponses `404` et `410` sont tolérées.

Une milestone terminée garde son événement. Le calendrier est une trace des
échéances ; il ne réécrit pas le passé. Seules la suppression de la milestone
et le retrait de sa date font disparaître l'événement.

### Authentification Google

Compte de service, sans délégation à l'échelle du domaine. Le calendrier
« Livraisons » est partagé manuellement avec l'adresse du compte de service, en
droit « Apporter des modifications aux événements ».

Le Worker signe lui-même son jeton, sans dépendance ajoutée :

- JWT `RS256` signé via WebCrypto (`RSASSA-PKCS1-v1_5` / `SHA-256`), claims
  `iss` = adresse du compte de service, `scope` =
  `https://www.googleapis.com/auth/calendar.events`, `aud` =
  `https://oauth2.googleapis.com/token`, `iat`, `exp` = `iat + 3600` ;
- échange contre un jeton d'accès sur `POST https://oauth2.googleapis.com/token`
  avec `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`.

Le jeton n'est pas mis en cache : la tâche s'exécutant une fois par heure, un
jeton par exécution est le comportement le plus simple et le moins fragile.

## Cadence et environnements

Le cron `*/5 * * * *` existe déjà et son handler `scheduled` vit dans
`src/worker.ts`. La synchronisation s'y ajoute comme une tâche de plus, mais ne
s'exécute qu'au **premier passage de chaque heure**
(`new Date(controller.scheduledTime).getUTCMinutes() < 5`).

Elle est **active en production seulement**. En staging les secrets Google sont
absents et la tâche se saute en journalisant, comme le fait déjà la messagerie
avec `skipped_missing_bindings`. Deux Workers écrivant dans le même agenda se
combattraient sans fin.

## Secrets et configuration

Trois secrets Worker, posés en production uniquement :

| Secret | Contenu |
| --- | --- |
| `GOOGLE_SA_EMAIL` | adresse du compte de service |
| `GOOGLE_SA_PRIVATE_KEY` | clé privée PEM du compte de service, encodée en base64 |
| `GOOGLE_CALENDAR_LIVRAISONS_ID` | identifiant du calendrier « Livraisons » |

La clé privée est encodée en base64 pour survivre au passage en secret d'une
valeur multiligne. `LINEAR_API_KEY` existe déjà et est réutilisée telle quelle.

Ces trois clés sont ajoutées à `.dev.vars.example` avec leur commentaire, sans
valeur.

## Erreurs et journalisation

La tâche est isolée du reste du handler `scheduled` : son échec ne doit jamais
empêcher la messagerie de tourner. Un journal JSON par exécution, sur le modèle
existant :

```json
{ "event": "livraisons_sync", "status": "ok", "crees": 2, "maj": 14, "supprimes": 1, "scheduled_at": "…" }
```

`status` vaut `ok`, `skipped_missing_secrets` ou `error` (avec `message`). Un
échec sur un événement isolé est compté et journalisé sans interrompre le
reste : une milestone au nom pathologique ne doit pas geler tout le calendrier.

## Découpage du code

- `src/lib/livraisons/linear-milestones.ts` : requête GraphQL et filtrage.
  Rend une liste normalisée `{ milestoneId, cleTeam, etape, date, projetNom,
  projetUrl }`.
- `src/lib/livraisons/titre.ts` : normalisation du nom et composition du titre.
  Pur, sans dépendance.
- `src/lib/livraisons/google-calendar.ts` : jeton, `PUT`/`POST`/`DELETE`,
  listage par propriété étendue.
- `src/lib/livraisons/sync.ts` : orchestration et diff, seule fonction appelée
  par `src/worker.ts`.

Le client Linear existant `src/lib/portail/linear-graphql.ts` est réutilisé
pour l'appel HTTP ; la requête des milestones lui est propre et vit dans
`linear-milestones.ts`.

## Tests

Tests unitaires purs (`vitest`), aucun appel réseau :

- normalisation du nom : préfixe de code retiré, troncature à 30 caractères,
  nom déjà court laissé intact ;
- composition du titre avec la clé de team ;
- dérivation de l'identifiant d'événement depuis un UUID, et validité du jeu de
  caractères ;
- filtrage : milestone sans date écartée, projet annulé écarté, projet `Test`
  de `MOD` écarté ;
- diff : création, mise à jour, suppression d'orphelin, à partir de deux
  ensembles construits en mémoire.

La recette réelle est une exécution manuelle en production suivie d'une lecture
du calendrier.

## Gestes manuels, à la main de Ludo

1. Créer le projet Google Cloud et le compte de service, activer l'API Google
   Calendar, générer une clé JSON.
2. Créer le calendrier « Livraisons » dans Google Agenda.
3. Le partager avec l'adresse du compte de service, droit « Apporter des
   modifications aux événements ».
4. Transmettre les trois valeurs pour la pose des secrets en production.
5. Renommer progressivement les milestones des teams clientes vers des noms
   courts.

## Hors périmètre

- Les issues Linear datées. Le calendrier ne porte que des livraisons.
- L'écriture inverse (agenda vers Linear). Le miroir est à sens unique.
- L'affichage de ces échéances dans le portail client.
- Le renommage en lot des milestones existantes : convention adoptée pour la
  suite, reprise au fil de l'eau.
