# Documents client privés, dans le workspace

Date : 2026-09-30
Statut : sous-projet 1 détaillé, sous-projets 2 à 6 cadrés
Remplace : le lot 4 de la spec `2026-09-22-documents-client-entete-design.md` (§6, adresses publiques, et §8, ouverture depuis le portail). Les lots 1 à 3 sont acquis et en production.
Projet Linear : Documents client. Sous-projet 1 : COO-236.

## Pourquoi

Les documents client sont publics. Leur adresse se devine : trois ou quatre chiffres, qu'un script épuise en quelques secondes. Elle n'expire pas et ne se révoque pas. La proposition y porte le prix.

Le 2026-09-29, une proposition Miharu affichait en ligne le taux horaire, la charge et une citation de la cliente. Retirée le 2026-09-30.

L'audit (COO-295) doit naître chez un prospect, dans un projet en Proposal. Un document public ne le permet pas.

## Décisions de Ludo du 2026-09-30

1. Tous les documents deviennent privés : cadrage, audit, proposition, livrable, témoignage. Ils ne se lisent que sur my.coolbeans.cc, dans le workspace du prospect ou du client.
2. Le partage passe par l'invitation dans le workspace. Ludo est prévenu à chaque invitation.
3. Dans un workspace direct, le client invite ses collègues lui-même.
4. Dans un workspace de revendeur, le revendeur est le seul client de Coolbeans. Lui ou Ludo donnent accès aux personnes du client final ; le client final n'invite pas.
5. Dans un workspace de revendeur, la proposition adressée au revendeur ne se lit que par les comptes du revendeur. Les invités du client final voient les autres documents.
6. Le premier accès passe par un jeton personnel : un lien propre à une personne, valable 30 jours, révocable.
7. Un document naît en brouillon. Ludo le relit dans le portail, sous un bandeau qu'il est seul à voir, et le publie d'un bouton.
8. Publier le premier document d'un nouveau client ouvre son workspace et son compte.
9. Tous les documents déjà envoyés passent dans le portail, y compris l'ancienne proposition En Haut et le manuscrit de Véronique Berthet. Les anciennes adresses mènent à la connexion, puis au document.
10. Aucun accès ne part vers un client sans ordre de Ludo.

## Découpage

| # | Sous-projet | Ce qu'il livre | Dépend de |
|---|---|---|---|
| 1 | Les documents dans le workspace | Les quatre gabarits rendus dans le portail, réservés à qui peut les lire, une section par projet dans la barre latérale, le bandeau de brouillon | rien |
| 2 | Le statut se règle dans le portail | Le bouton Publier / Repasser en brouillon, le statut en base, le brouillon par défaut | 1 |
| 3 | Le jeton personnel | Un lien d'accès de 30 jours, émis depuis le portail, révocable | 1 |
| 4 | L'invitation | Inviter une personne dans un workspace, selon la règle directe ou revendeur, Ludo prévenu | 1, 3 |
| 5 | Le workspace ouvert à la publication | Publier le premier document d'un client ouvre son workspace et son compte | 2, 3 |
| 6 | La bascule de l'existant | Comptes des clients existants, anciennes adresses vers la connexion | 1, 3 |

**La bascule vient en dernier.** Fermer les adresses publiques avant que chaque client ait un accès enfermerait dehors ceux qui ont déjà un lien. Jusqu'au sous-projet 6, chaque document se lit aux deux endroits.

Chaque sous-projet aura son plan. Les sous-projets 2 à 6 auront aussi leur spec détaillée : la présente spec n'en fixe que les décisions.

## Sous-projet 1 : les documents dans le workspace

### L'adresse

```
my.coolbeans.cc/projets/<projet>/<étape>
                /projets/site-web-879/proposition
```

Le chemin interne est `/espace/projets/<projet>/<étape>`, réécrit par `src/worker.ts` comme le reste du portail.

- **Le segment projet suffit.** Il est unique dans la nomenclature, qui dit à quel client il appartient. La clé client n'a donc pas à figurer dans l'adresse.
- **L'étape est le mot de la frise** : `audit`, `cadrage`, `proposition`, `production`, `livraison`, `suivi`.
- **Une version ou un chapitre n'a pas d'adresse.** Il vit sous l'onglet de sa racine, comme en public.
- **La page est rendue à la demande**, jamais prérendue : elle dépend de la session.

### Qui lit quoi

- **Du projet au workspace.** Le projet donne la clé client (`nomenclature.ts`). La clé donne le workspace, par un nouveau champ `cle` dans `src/content/clients/<slug>.yaml`. Le build vérifie que chaque `cle` existe dans la nomenclature et qu'aucune n'est portée par deux workspaces.
- **La portée décide.** Un document se lit si son workspace figure dans la portée du compte (`workspacesVisibles`) : son workspace pour un client, tous ceux de son organisation pour un revendeur, tous pour l'admin. Sinon la page répond 404, jamais 403 : on ne révèle pas qu'un document existe.
- **La proposition d'un workspace de revendeur** ne se lit que par les comptes du revendeur et par l'admin. Pour un compte client de ce workspace, elle répond 404 et son étape est estompée dans la frise.
- **Le statut.** Un client ou un revendeur ne voit que les documents `publie`. L'admin voit aussi `trame` et `brouillon`. Au sous-projet 1, le statut se lit encore dans le YAML ; le sous-projet 2 le déplace en base.
- **L'adresse gagne sur le sélecteur**, comme pour la doc (`src/pages/docs/[client]/[...slug].astro`). Ouvrir un document bascule le workspace courant sur le sien, si la portée le permet.
- **Un workspace sans clé** (Coolbeans, Spinoza…) n'a aucun document du cycle.

### Le bandeau de l'admin

Sur un document que le client ne peut pas lire, l'admin voit un bandeau coloré, collé sous la barre du portail : « Brouillon · le client ne voit pas ce document ». La même règle couvre la proposition d'un workspace de revendeur, vue par un admin : « Réservé au revendeur · le client final ne voit pas ce document ».

Contrairement à `EnvBanner`, ce bandeau porte du texte : seul l'admin le voit. Le bouton qui change le statut arrive au sous-projet 2, à côté du bandeau.

### La mise en page

Le document garde la mise en page des lots 2 et 3, posée dans la coquille du portail.

```
┌─────────────────────────────────────────────────────────┐
│ barre du portail (logo, sélecteur, compte)              │
├──────────────┬──────────────────────────────────────────┤
│ Bienvenue    │ ━━━━━━━━━━━━━━━━━━━━━━  filet de l'étape │
│ Mon site     │ Site web CAFA                        h1  │
│ Projets      │ 1 Cadrage 2 Proposition 3 Production…    │
│ Site web CAFA│ ( V1 · 17 sept. ) ( V2 · 22 sept. )      │
│  2 Propos.   │ ──────────────────────────────────────── │
│  3 Product.  │ LE PROJET · BUDGET · PLANNING   collante │
│  4 Livraison │ ──────────────────────────────────────── │
│ Aide         │ titre du document, objet, date           │
│              │ contenu…                                 │
└──────────────┴──────────────────────────────────────────┘
```

- **La barre du portail remplace `DocumentTopbar`.** Le thème et la connexion y sont déjà.
- **Au-dessus de la barre d'onglets, rien ne change d'un onglet à l'autre** : filet, nom du projet, frise, onglets. La règle de la spec du 2026-09-22 vaut aussi dans le portail.
- **La colonne d'ancres de droite disparaît** sur ces pages. La nav des sections du document la remplace.
- **La frise mène aux autres documents du projet, dans le portail.** Une étape sans document lisible par le compte est estompée et non cliquable.
- **La barre latérale porte une section par projet** du workspace courant. Titre : le nom Linear du projet. Une entrée par document lisible par le compte, libellée par son étape (« 2 · Proposition »), dans l'ordre de la frise. Ces sections suivent la section « Projets », le projet au document le plus récent en tête.

### Deux pièges connus

- **`doc.css` bat Tailwind dans le portail.** `PortalLayout` enveloppe tout dans `.doc-root`, dont les règles à deux classes (`.doc-root .card`) l'emportent sur les utilitaires. Sept composants de document portent la classe `card` : `DocumentReponses`, `DevisReponse`, `CadrageFormulaire`, `LivrableReponse`, `LivrableVideo`, `LivrableMessage`, `TemoignageFormulaire`. Ils passent aux utilitaires qui reproduisent `.card`. Le rendu public ne doit pas bouger : capture avant et après, zéro écart.
- **Le portail n'a aucune règle d'impression.** Une proposition imprimée depuis le portail doit donner le PDF d'aujourd'hui. Sur ces pages, la barre du portail, la barre latérale et le bandeau de l'admin sont masqués à l'impression.

### Ce qui ne change pas

- **Les adresses publiques restent servies** jusqu'au sous-projet 6. La page publique et la page du portail rendent le même composant, dans deux contextes.
- **Les formulaires postent vers les mêmes `/api/*-reponse`**, déjà servis tels quels sur my.coolbeans.cc. Les réponses en D1 restent indexées par le slug du fichier.
- **Les liens émis** (mails de confirmation, cockpit, commentaire Linear d'une signature, pied du PDF) passent par une seule fonction, `adresseDocument`. Elle rend l'adresse publique jusqu'au sous-projet 6, qui la bascule vers le portail.

### Architecture

- **Quatre composants de page** : `PageCadrage`, `PageProposition`, `PageLivrable`, `PageTemoignage`. Ils reçoivent le groupe de versions, les pastilles et le contexte (`public` ou `portail`). Le gabarit actuel des quatre routes publiques y déménage tel quel. Les routes publiques et la route du portail les rendent.
- **`DocumentEntete` reçoit le contexte.** En `portail`, il ne pose pas `DocumentTopbar`.
- **Une route du portail** : `src/pages/espace/projets/[projet]/[etape].astro`, rendue à la demande. Elle trouve le document racine, vérifie l'accès, choisit le composant de page selon la collection.
- **Logique pure et testée**, dans `src/lib/documents/` :
  - `documentDuPortail(documents, projet, etape)` : la racine visée, ou rien ;
  - `peutLire(document, compte, workspace)` : la règle d'accès, statut et revendeur compris ;
  - `sectionsProjets(documents, compte, workspace)` : les sections de la barre latérale ;
  - `urlDocument(document, contexte)` : l'adresse publique ou celle du portail, que la frise utilise.
- **Le contenu se lit à l'exécution.** Les collections sont disponibles dans le Worker, comme pour `DocumentReponses` aujourd'hui. Aucune lecture D1 pour afficher un document au sous-projet 1.

### Critères de recette du sous-projet 1

- [ ] Un client connecté ouvre chacun de ses documents publiés depuis sa barre latérale.
- [ ] Un document d'un autre workspace répond 404, y compris par adresse tapée à la main.
- [ ] Un brouillon répond 404 au client, et s'affiche pour l'admin sous le bandeau.
- [ ] Un compte revendeur lit les documents de tous les workspaces de son organisation.
- [ ] Un compte client d'un workspace de revendeur lit tout sauf la proposition, qui lui répond 404.
- [ ] Changer d'onglet ne change rien au-dessus de la barre d'onglets, dans le portail.
- [ ] Les documents publics s'affichent à l'identique : captures avant et après, zéro écart.
- [ ] Une proposition imprimée depuis le portail donne le PDF actuel.
- [ ] Un workspace sans clé n'affiche aucune section de projet.
- [ ] Vérifié sur desktop, tablette et mobile.

## Sous-projets 2 à 6 : ce qui est déjà décidé

### 2. Le statut se règle dans le portail

- Sur la page d'un document, l'admin voit un bouton à côté du bandeau : « Publier pour le client », ou « Repasser en brouillon ».
- Le statut s'écrit en base (D1), avec la date et l'auteur. La page du portail le lit à chaque visite : publier ne demande plus de déploiement.
- Le statut du YAML devient la valeur de départ, tant que la base n'en a pas.
- Le défaut du schéma passe de `publie` à `brouillon` : un champ oublié cache au lieu d'exposer. Les documents déjà en ligne reçoivent `statut: publie` écrit en toutes lettres, pour qu'aucun ne disparaisse.
- `trame` reste une indication pour Ludo, traitée comme un brouillon.
- Publier reste un geste de Ludo, jamais l'effet de bord d'une autre action (spec du 2026-09-22, §10).

### 3. Le jeton personnel

- Ludo l'émet depuis le portail, pour une personne (son email) et un workspace.
- Le lien ouvre une session, puis mène au document visé : `my.coolbeans.cc/acces/<jeton>`.
- Valable 30 jours, utilisable plusieurs fois pendant cette durée, révocable.
- Le jeton n'est jamais stocké en clair.
- Un mail transféré donne l'accès au destinataire, sous le nom de l'invité. C'est le prix de l'accès en un clic, accepté le 2026-09-30.

### 4. L'invitation

- Un bouton « Inviter une personne » dans l'espace. Il saisit un email, l'invité reçoit son propre jeton.
- Dans un workspace direct, le client invite ses collègues dans son propre workspace.
- Dans un workspace de revendeur, le revendeur et Ludo invitent. Le client final n'a pas le bouton.
- Ludo est prévenu à chaque invitation.

### 5. Le workspace ouvert à la publication

- Publier le premier document d'une clé client sans workspace ouvre ce workspace, rattaché à l'organisation Coolbeans ou à celle du revendeur, et le compte de son destinataire.
- Le geste est le bouton du sous-projet 2 : la base est joignable à ce moment-là, contrairement au déploiement.
- La fiche client et la team D1 restent à aligner (`amorcer-organisations.mjs`, COO-167).

### 6. La bascule de l'existant

- Un compte pour chaque client qui a un document publié. Jetons générés, mails préparés, envoyés sur ordre de Ludo.
- Chaque ancienne adresse publique renvoie vers la connexion, puis vers le document dans le portail.
- `adresseDocument` bascule vers le portail.
- Les documents hors nomenclature y entrent : En Haut reçoit la clé `enh` (sa team Linear), et son ancienne proposition un projet dont la référence de trois chiffres se tire à la bascule. Véronique Berthet reçoit la clé `vbe`, seule clé qui ne vient pas d'une team Linear : elle n'est pas cliente. `HORS_NOMENCLATURE` se vide.
- Les skills qui fabriquent ou citent ces adresses sont mises à jour : `proposition-commerciale`, `livraison-client`, `onboarding-client`.

## Hors périmètre

- La marque blanche des workspaces de revendeur (spec `2026-08-26-portail-multi-tenant-agences-design.md`, phase B).
- La création des trames d'un projet neuf.
- Pré-remplir les formulaires avec l'identité du compte connecté.
