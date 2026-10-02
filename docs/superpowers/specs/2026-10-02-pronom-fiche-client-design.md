# Le pronom vient de la fiche client

Date : 2026-10-02
Statut : design validé en conversation le 2026-10-01, spec à relire
Chantier : « Documents client, harmonisation », lot 1 sur 4. Les trois autres : la structure des sections (2), la mise en page (3), l'onboarding (4).
Dépend de : la fusion de `feat/documents-portail` (specs `2026-09-30-documents-prives-workspace-design.md` et `2026-09-30-barre-portail-par-workspace-design.md`). La clé `cle` des fiches client et la règle de lecture d'`acces.ts` en viennent.

## Pourquoi

Le tu et le vous se décident aujourd'hui document par document. Onze YAML portent `tutoiement` une fois `staging` fusionné, les autres vouvoient par défaut, et les formulaires, les accusés de réception et le portail vouvoient en dur. Le 2026-10-01, la V2 UnlockBreath tutoyait Thierry et son formulaire le vouvoyait.

Un prospect lit ses documents dans son workspace dès la publication du premier (spec du 2026-09-30, décision 8). Le portail et ses mails lui parlent donc aussi. Il lui faut un seul pronom, partout.

## Décisions de Ludo du 2026-10-01

1. Le pronom se décide une fois, sur la fiche client.
2. La clé est obligatoire, sans valeur par défaut. Une fiche sans pronom ne passe pas le build.
3. Il vaut partout : documents, formulaires, accusés de réception, interface du portail, mails du portail.
4. La fiche client naît avec le premier document, prospect compris. Le statut du projet Linear dit si c'est un prospect : la fiche ne porte aucun statut.
5. La skill qui crée le premier document crée la fiche si elle manque, et pose la question du pronom une fois.
6. Chez un revendeur, chacun le sien : la proposition suit la fiche de l'organisation, les autres documents suivent celle du client final.
7. Un document peut surcharger le pronom de sa fiche.

## Les clés

| Fichier | Clé | Règle |
|---|---|---|
| `src/content/clients/<slug>.yaml` | `tutoiement: true \| false` | Obligatoire |
| `src/content/organisations/<slug>.yaml` | `tutoiement: true \| false` | Obligatoire |
| Documents : `devis`, `cadrage`, `livrable`, `temoignage` | `tutoiement` | Facultative, sans défaut. Présente, elle surcharge la fiche |

Le schéma des quatre collections de documents perd son `default(false)`. Les clés posées à la main aujourd'hui sont retirées à la migration quand elles répètent la fiche, et gardées quand elles la contredisent.

## La résolution

Une fonction pure, `pronomDuDocument`, dans `src/lib/documents/pronom.ts`. Elle répond `"tu"` ou `"vous"`, dans cet ordre :

1. Le document porte `tutoiement` : il gagne.
2. C'est une proposition dans un workspace de revendeur, selon la règle d'`acces.ts` (collection `devis`, organisation différente de `coolbeans`) : la fiche de l'organisation.
3. Sinon, la fiche du client : `projet` du document (ou de sa racine, pour une version), puis `clientDuProjet` de la nomenclature, puis la fiche dont `cle` correspond.
4. Un document de `HORS_NOMENCLATURE` doit porter sa propre clé. Ceux de Véronique Berthet la portent déjà.
5. Rien ne résout : erreur au build, qui nomme le document.

Le portail parle à la personne connectée. Une seconde fonction, `pronomDuCompte`, suit le rôle du compte :

| Compte | Pronom |
|---|---|
| Client | La fiche client du workspace |
| Revendeur | La fiche de son organisation |
| Admin | La fiche `coolbeans` |

Les mails suivent la même règle, appliquée au destinataire. C'est le seul endroit où un repli existe : un compte qui ne résout rien reçoit le vous, et l'événement part dans les journaux du Worker. Il ne devrait jamais arriver, puisqu'un compte naît avec son workspace.

## Les textes

Chaque fichier qui s'adresse au lecteur garde ses phrases chez lui, sous la forme déjà employée par `CadrageFormulaire.astro` et `devis-confirmation.ts` : un objet par registre, côte à côte, choisi par le pronom. Ranger toutes les phrases dans un module unique les couperait de leur contexte.

Fichiers à passer en double registre, relevés sur `feat/documents-portail` le 2026-10-02 :

| Zone | Fichiers |
|---|---|
| Mails | `auth.ts`, `support-confirmation.ts`, `messagerie-reponse.ts`, `livrable-confirmation.ts` et `temoignage-confirmation.ts` (déjà en double registre, à rebrancher sur la résolution) |
| API | `devis-reponse.ts`, `cadrage-reponse.ts`, `livrable-reponse.ts`, `temoignage-reponse.ts`, `messagerie/nouveau.ts`, `messagerie/reponse.ts` |
| Pages du portail | `demandes.astro`, `demandes/[id].astro`, `liens.astro`, `analytics.astro`, `monitoring.astro`, `seo.astro`, `ressources.astro`, `index.astro`, `doc.astro`, `disponibilites.astro` |
| Composants du portail | `VitesseSite.astro`, `PiecesJointes.astro`, `MessagerieBoard.astro`, `ChoixUrgence.astro` |

Les formulaires et les accusés de réception des documents ont déjà leur double registre. Ils passent de la clé du document à `pronomDuDocument`.

## Les valeurs

Déduites des documents envoyés et des mails, à valider par Ludo à la relecture.

| Fiche | Clé | Pronom proposé | Source |
|---|---|---|---|
| amusoire | amu | vous | 3 documents, vouvoyés |
| cafa | caf | vous | 3 documents, vouvoyés |
| fylgo | fyl | vous | 2 documents, vouvoyés |
| littlebox | lit | tu | 1 document, tutoyé |
| mathilde-chevalier | mat | tu | 1 document, tutoyé |
| oide | oid | vous | 1 document, trois occurrences seulement |
| revolutions-douces | rev | tu | 2 documents, tutoyés |
| setencorpsmieux | set | tu | 3 documents, tutoyés |
| unlockbreath | unl | tu | Décision du 2026-10-01 |
| coolbeans | | tu | Le workspace de Ludo |
| spinoza | | tu | Perso |
| tielle-popcorn | | tu | Perso |
| dupontdupont | | tu | Mail à Kat du 2026-01-25 |
| merciyanis | | tu | Mails à Gaëlle et Laura, janvier et août 2026 |

Fiches à créer, pour les clients de la nomenclature qui n'en ont pas :

| Clé | Client | Organisation | Pronom proposé | Source |
|---|---|---|---|---|
| mal | Aurélie Malbec | coolbeans | tu | 3 documents, tutoyés |
| mih | Miharu | trigger | vous | 2 documents, vouvoyés |
| uni | Université de Montpellier | coolbeans | tu | Mails à Isabelle Tournier, septembre 2026. Les documents vouvoient l'équipe du labo |
| vic | Vice Versa | coolbeans | tu | 1 document, tutoyé |

Organisations : `coolbeans`, tu. `trigger`, tu.

## La création de fiche par les skills

La skill `proposition-commerciale`, mode cadrage compris, résout le client du projet avant de composer. La fiche manque : elle la crée avec `nom`, `organisation`, `cle`, `prenom` et `tutoiement`, et pose la question du pronom à Ludo, une fois, par une question interactive. Elle ne compose rien tant que la fiche n'existe pas.

Le lot 4 fera de cette étape le début de l'onboarding. Le lot 1 n'en livre que le minimum.

## Migration

1. Ajouter `tutoiement` aux 14 fiches et aux 2 organisations, créer les 4 fiches manquantes, avec les valeurs validées.
2. Rendre la clé obligatoire dans les deux schémas.
3. Retirer des documents les clés qui répètent leur fiche. Lister à Ludo celles qui la contredisent avant de les garder.
4. Brancher les formulaires et les accusés des documents sur `pronomDuDocument`.
5. Passer les fichiers de la section « Les textes » en double registre.

Les étapes 1 à 3 partent dans un même commit : la clé ne devient obligatoire qu'une fois toutes les fiches remplies.

## Tests

- Schéma : une fiche client ou une organisation sans `tutoiement` est refusée.
- `pronomDuDocument` : surcharge du document, proposition chez un revendeur, autre document chez un revendeur, client direct, version sans `projet` qui hérite de sa racine, document hors nomenclature, document sans résolution.
- `pronomDuCompte` : client, revendeur, admin, compte sans résolution.
- Un test parcourt les YAML de `src/content/` et vérifie que chaque document résout un pronom, sur le modèle de `nomenclature.test.ts`.
- Pour chaque mail et chaque objet de phrases : la variante tu ne contient ni `vous`, ni `votre`, ni `vos`, et la variante vous ne contient ni `tu`, ni `ton`, ni `ta`, ni `tes`.

## Hors périmètre

- Les titres de section : le lot 2 les rend courts et sans pronom.
- Le corps des documents, rédigé à la main dans le YAML. Le lot 1 ne le réécrit pas.
- Les mails internes adressés à Ludo.
- La description par défaut de `BaseLayout.astro`, qui s'adresse au visiteur du site vitrine.

## Documentation

- `src/content/docs/coolbeans/04-portail.mdx` : la fiche client et l'organisation portent `tutoiement`, la règle du revendeur, la règle du compte connecté.
- Skill `proposition-commerciale`, `references/composition.md` et `references/cadrage.md` : créer la fiche si elle manque, poser la question du pronom.
- `docs/superpowers/specs/README.md` : la ligne de cette spec.
