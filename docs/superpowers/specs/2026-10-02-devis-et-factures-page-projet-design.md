# Devis et factures dans la page projet

Date : 2026-10-02
Statut : design validé en conversation le 2026-10-02, spec à relire
Dépend de : la page projet du portail (spec `2026-09-30-barre-portail-par-workspace-design.md`, en prod), la table `PROJETS` de `src/lib/documents/nomenclature.ts` et le binding R2 `PORTAL_FILES`.

## Pourquoi

Un client qui cherche sa facture d'acompte la demande par mail, et Ludo la retrouve dans Tiime. Les pièces comptables vivent dans Tiime depuis 2025, dans Shine avant, et nulle part dans le portail.

Le portail montre déjà le projet, son avancement et ses documents. Les pièces comptables s'y ajoutent : le client voit son devis, ses factures et leur statut, et ouvre chaque PDF.

Tiime n'a pas d'API ouverte à Coolbeans (constaté le 2026-09-01). Shine non plus. La source est donc un export manuel : la liste des pièces en CSV et les PDF.

## Propositions et pièces : deux choses

Le code appelle « devis » la proposition commerciale (`src/content/devis/`, `devis_reponses`). Le devis Tiime est un autre document, émis après la validation de la proposition (spec du 2026-09-02).

- La proposition s'affiche déjà dans l'onglet Proposition de la page projet. Ce chantier n'y touche pas.
- Ce chantier ajoute les **pièces** : devis Tiime, factures, avoirs. Le mot `pieces` nomme la table et le code, pour ne pas ajouter un troisième sens à `devis`.

## Décisions de Ludo du 2026-10-02

1. Le portail ne porte que les pièces Tiime. L'historique Shine (2022 à 2024) reste dans le Google Sheet `finance`, onglet `sales`.
2. Le client voit le statut de ses factures.
3. Le statut se met à jour par un clic de l'admin à l'encaissement. Le réimport d'un export rattrape les oublis.
4. Les pièces s'affichent dans un bloc « Devis et factures », entre Avancement et les onglets d'étape.
5. Le registre vit en D1, les PDF dans R2, et un script local les importe depuis l'export Tiime.

## 1. Les données

### 1.1 La table `pieces`

Une migration crée la table. Son numéro se fixe à l'écriture : `0014` au 2026-10-02, à vérifier contre `migrations/` de `staging` à ce moment.

| Colonne | Contenu |
|---|---|
| `id` | Type et numéro : `facture-024624`, `devis-004330`. Clé primaire. Devis et factures ont chacun leur numérotation dans Tiime, le type évite une collision. |
| `type` | `devis`, `facture` ou `avoir`. |
| `numero` | Le numéro Tiime, en texte, zéros compris : `024624`. |
| `categorie` | `acompte`, `intermediaire` ou `solde` pour une facture. Vide pour un devis ou un avoir. |
| `emise_le` | Date d'émission, `YYYY-MM-DD`. |
| `echeance` | Date d'échéance d'une facture, `YYYY-MM-DD`. Vide sinon. |
| `ht`, `tva`, `ttc` | Montants en centimes, entiers. Un avoir porte des montants négatifs. |
| `statut` | `a_regler`, `reglee` ou `annulee` pour une facture. Vide pour un devis ou un avoir. |
| `reglee_le` | Date du règlement, `YYYY-MM-DD`. Vide tant que la facture n'est pas réglée. |
| `client` | Slug de la fiche client (`fylgo`), comme `tickets.client`. Vide pour une pièce adressée à un revendeur. |
| `organisation` | Slug de la fiche revendeur (`trigger`) pour une pièce qui lui est adressée. Vide sinon. |
| `projet` | Slug de la table `PROJETS` (`boutique-shopify-390`). Vide tant que Ludo n'a pas rattaché la pièce. |
| `raison_sociale` | Le destinataire tel que Tiime l'écrit (`ABEAM DRINKS`). |
| `r2_key` | `pieces/<client ou organisation>/<id>.pdf`. |
| `importee_le` | Date et heure du dernier import qui a touché la ligne. |

### 1.2 Les fiches client et revendeur

Les fiches client (`src/content/clients/`) et revendeur (`src/content/organisations/`) reçoivent une liste facultative `raisonsSociales`, les noms sous lesquels Tiime les facture :

```yaml
# src/content/clients/fylgo.yaml
raisonsSociales: [ABEAM DRINKS]
```

La comparaison ignore la casse et les espaces en trop. Deux fiches qui déclarent la même raison sociale font échouer le build, qu'elles soient client ou revendeur.

### 1.3 Le stockage

Les PDF vont dans le bucket du binding `PORTAL_FILES` : `coolbeans-portal-fichiers` en prod, `coolbeans-portal-fichiers-staging` en staging. Le bucket reste privé. Seule la route du §5 lit ces fichiers.

### 1.4 La règle du statut

- L'import peut passer une facture de `a_regler` à `reglee` ou à `annulee`. Il ne repasse jamais une facture `reglee` en `a_regler`.
- Le clic de l'admin l'emporte toujours, dans les deux sens. Un clic par erreur se corrige depuis la même page.

## 2. L'import

Script `scripts/importer-pieces.mjs`, lancé à la main depuis le poste de Ludo.

- **Entrées** : un manifeste JSON et le dossier des PDF. Le premier export de Tiime (2026-10-02) est arrivé en PDF, avec les listes Devis et Factures en capture : aucun CSV. Le manifeste se rédige depuis ces deux sources, une ligne par pièce. Le premier vit dans `scripts/pieces/tiime-2026-10-02.json`.
- **Client** : chaque ligne porte déjà `client` ou `organisation`. Le script vérifie que la fiche existe et que la raison sociale figure dans ses `raisonsSociales`. Un écart écarte la ligne et s'affiche en sortie.
- **PDF** : retrouvé par son numéro dans le nom du fichier, de la forme `Facture_024626_Coolbeans_<nom>.pdf` et `Devis_004331_Coolbeans_<nom>.pdf`. Une ligne sans PDF écarte la ligne et s'affiche en sortie.
- **Sans option, le script n'écrit rien.** Il affiche quatre listes : pièces nouvelles, pièces modifiées (avec le champ qui change), fiches introuvables, PDF manquants.
- **Avec `--appliquer`**, il envoie chaque PDF dans R2, puis écrit les lignes dans D1. Une ligne existante garde son `projet` s'il a été changé dans l'admin.
- **Cible** : la base locale par défaut, `--env staging` pour le staging, `--env production` pour la prod. La prod ne s'importe que sur ordre de Ludo.
- **Idempotence** : relancer le même manifeste ne change rien et l'annonce.

## 3. La page admin

Page `/espace/admin/pieces`, derrière la garde admin (`src/lib/portail/garde-admin.ts`).

- Un tableau de toutes les pièces, de la plus récente à la plus ancienne : pièce, client, projet, date, montant TTC, statut, lien PDF.
- Deux filtres : « Sans projet » et « À régler ».
- **Rattacher** : un menu par ligne propose les projets du client dans la table `PROJETS`. Le choix s'enregistre aussitôt.
- **Réglée** : un bouton passe la facture en `reglee`, à la date du jour, modifiable avant validation. Une facture réglée montre « Annuler le règlement ».
- La page se range dans la barre admin, à côté des Relances.

## 4. La page projet

Un bloc « Devis et factures » sur `src/pages/espace/projets/[projet].astro`, entre Avancement (ou Heures du pack) et les onglets d'étape, à la même largeur (880 px).

- Il liste les pièces du client courant dont le `projet` désigne ce projet Linear, de la plus ancienne à la plus récente.
- Une ligne par pièce : le libellé, la date d'émission, le montant TTC, le statut, le lien vers le PDF.
- Libellés : « Devis n° 004330 », « Facture d'acompte n° 024610 », « Facture intermédiaire n° … », « Facture de solde n° 024624 », « Avoir n° … ».
- Statut d'une facture : « Réglée le 12/04/2026 », « À régler, échéance le 30/09/2026 », « Annulée ». Un devis et un avoir n'ont pas de statut.
- Montants au format français, `3 528,00 €`. L'espace avant `€` est insécable et se vérifie dans le HTML rendu.
- Le bloc ne s'affiche pas quand le projet n'a aucune pièce visible.
- Un pack d'heures reçoit ses pièces comme les autres projets : sa facture se rattache au projet Linear du pack.
- Coût : une requête D1 par page, aucun appel à Linear de plus.

## 5. La route du PDF

`GET /api/pieces/<id>`, sur le modèle de `src/pages/api/messagerie/fichier/[id].ts`.

- Elle répond 404 sans session, pour une pièce inconnue, pour une pièce d'un autre client que le workspace courant, et pour une pièce sans projet. Le compte admin suit le workspace courant, comme dans la messagerie.
- Elle sert le fichier en `application/pdf`, affiché dans le navigateur, avec `x-content-type-options: nosniff` et `cache-control: private`.
- Le nom du fichier téléchargé reprend le libellé de la pièce : `Facture de solde 024624.pdf`.

## 6. Les revendeurs

Une pièce adressée à un revendeur ne s'affiche chez aucun client. Exemple : une facture à Trigger pour un lot Miharu. Le client final ne voit jamais le prix de Coolbeans au revendeur. Seul l'admin la voit, dans la page du §3.

L'import la reconnaît à sa raison sociale, déclarée sur une fiche de `src/content/organisations/` : il remplit `organisation` et laisse `client` vide. La page projet ne lit que les pièces du client courant, elle ne la voit donc jamais. Une vue des pièces pour les comptes revendeur viendra si le besoin apparaît.

## 7. Tests

- Import : correspondance de raison sociale (casse, espaces), PDF retrouvé par numéro, ligne écartée et signalée, mode sans écriture, idempotence, règle du statut du §1.4, `projet` jamais écrasé.
- Build : deux fiches qui déclarent la même raison sociale échouent.
- Page projet : bloc absent sans pièce, pièce d'un autre projet absente, pièce sans projet absente, libellés et statuts, montant avec espace insécable.
- Route du PDF : chacun des 404 du §5, type forcé à `application/pdf`.
- Page admin : refusée à un compte client, rattachement, réglée, annulation du règlement.

## 8. La mise en prod

Dans cet ordre, une seule session à la fois pour la migration :

1. La migration s'applique en staging, puis en prod dès le push sur `staging`, avant le merge (règle du 2026-09-04).
2. Le code part en staging.
3. Import en staging depuis le premier export réel. Ludo rattache quelques pièces et recette la page projet et l'admin.
4. Sur ordre de Ludo : merge vers `main`, puis import en prod.

## 9. La doc du portail

`src/content/docs/coolbeans/04-portail.mdx` décrit le bloc, la page admin et le script d'import, dans le même lot.

## 10. Ce que le premier export a appris

- Tiime n'a pas fourni de CSV. Ses listes donnent la date, le numéro, le client, le HT, le TTC et le statut (devis : Accepté ; factures : Payée, Envoyée, Facturée).
- Aucune liste ne donne la date de règlement. `reglee_le` reste vide à l'import et se remplit au clic de l'admin.
- Toutes les factures sont « À réception » : l'échéance vaut la date d'émission.
- Le premier export ne contient ni avoir ni facture annulée.

## 11. Hors périmètre

- Les pièces Shine.
- Le pré-remplissage de la page des relances depuis une pièce. Ce lot vient ensuite, une fois le registre en place.
- Une vue revendeur des pièces.
- Le remplissage de l'onglet `sales` du Google Sheet, qui part du même export mais à la main.

## 12. État au 2026-10-02

- **R2** : les 23 PDF du premier export sont dans le bucket de staging sous `pieces/<client ou organisation>/<id>.pdf`, vérifiés octet par octet. Le bucket de prod attend l'ordre de Ludo.
- **Linear** : la refonte Amusoire passe dans la team Trigger sous le nom « Refonte Amusoire » (identifiant court inchangé, issues TRI-2 à TRI-5). Projets créés, terminés : « Landing pages Promologis » (TRI), « Gravure et prise de rendez-vous » (nouvelle sous-team DupontDupont, `DUP`), « Page d'accueil et méga-menu Webflow » (MER).
- **À faire dans le lot** :
  - `nomenclature.ts` : les clés `tri`, `dup` et `mer`, `refonte-432` rattaché à `tri`, et les trois projets de `projetsNouveaux` du manifeste ;
  - fiches `dupontdupont` et `merciyanis` : leur `linearTeamId`. Ce sont les teams `DUP` (`43af2a28-f9b5-457a-af0d-d730551ef568`) et `MER` (`d4a0264c-fbd7-42dd-b290-df35780d8db3`) ;
  - `raisonsSociales` sur chaque fiche citée par le manifeste.
