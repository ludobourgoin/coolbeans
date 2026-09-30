# Documents client privés, dans le workspace

Date : 2026-09-30
Statut : sous-projet 1 détaillé, sous-projets 2 à 5 cadrés
Remplace : le lot 4 de la spec `2026-09-22-documents-client-entete-design.md` (§6, adresses publiques, et §8, ouverture depuis le portail). Les lots 1 à 3 sont acquis et en production.
Projet Linear : Documents client. Sous-projet 1 : COO-236.

## Pourquoi

Les documents client sont publics. Leur adresse se devine : trois ou quatre chiffres, qu'un script épuise en quelques secondes. Elle n'expire pas et ne se révoque pas. La proposition y porte le prix.

Le 2026-09-29, une proposition Miharu affichait en ligne le taux horaire, la charge et une citation de la cliente. Retirée le 2026-09-30.

L'audit (COO-295) doit naître chez un prospect, dans un projet en Proposal. Un document public ne le permet pas.

## Décisions de Ludo du 2026-09-30

1. Tous les documents deviennent privés : cadrage, audit, proposition, livrable, témoignage. Ils ne se lisent que sur my.coolbeans.cc, dans le workspace du prospect ou du client.
2. Le partage passe par l'invitation dans le workspace. Le client invite ses collègues lui-même, et Ludo est prévenu.
3. Le premier accès passe par un jeton personnel : un lien propre à une personne, valable 30 jours, révocable.
4. Le workspace d'un nouveau client se crée avec son premier document.
5. Tous les documents déjà envoyés passent dans le portail. Les anciennes adresses mènent à la connexion, puis au document.
6. Aucun accès ne part vers un client sans ordre de Ludo.

## Découpage

| # | Sous-projet | Ce qu'il livre | Dépend de |
|---|---|---|---|
| 1 | Les documents dans le workspace | Les quatre gabarits rendus dans le portail, réservés au workspace, une section par projet dans la barre latérale | rien |
| 2 | Le jeton personnel | Un lien d'accès de 30 jours, émis depuis le cockpit, révocable | 1 |
| 3 | L'invitation par le client | « Inviter un collègue » dans l'espace, Ludo prévenu | 1, 2 |
| 4 | Le workspace créé avec le premier document | Workspace et compte ouverts à la publication du premier document d'un client | 2 |
| 5 | La bascule de l'existant | Comptes des clients existants, anciennes adresses vers la connexion | 1, 2 |

**La bascule vient en dernier.** Fermer les adresses publiques avant que chaque client ait un accès enfermerait dehors ceux qui ont déjà un lien. Jusqu'au sous-projet 5, chaque document se lit aux deux endroits.

Chaque sous-projet aura son plan. Les sous-projets 2 à 5 auront aussi leur spec détaillée : la présente spec n'en fixe que les décisions.

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
- **La portée décide.** Un document se lit si son workspace figure dans la portée du compte (`workspacesVisibles`) : son workspace pour un client, ceux de son organisation pour un revendeur, tous pour l'admin. Sinon la page répond 404, jamais 403 : on ne révèle pas qu'un document existe.
- **Le statut.** Un client ne voit que les documents `publie`. L'admin voit aussi `trame` et `brouillon`, sous un bandeau « Brouillon, invisible du client ». Voir la question ouverte 2.
- **L'adresse gagne sur le sélecteur**, comme pour la doc (`src/pages/docs/[client]/[...slug].astro`). Ouvrir un document bascule le workspace courant sur le sien, si la portée le permet.
- **Un workspace sans clé** (Coolbeans, Spinoza…) n'a aucun document du cycle.

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
- **La frise mène aux autres documents du projet, dans le portail.** Une étape sans document lisible est estompée et non cliquable.
- **La barre latérale porte une section par projet** du workspace courant. Titre : le nom Linear du projet. Une entrée par document lisible, libellée par son étape (« 2 · Proposition »), dans l'ordre de la frise. Ces sections suivent la section « Projets », le projet au document le plus récent en tête.

### Deux pièges connus

- **`doc.css` bat Tailwind dans le portail.** `PortalLayout` enveloppe tout dans `.doc-root`, dont les règles à deux classes (`.doc-root .card`) l'emportent sur les utilitaires. Sept composants de document portent la classe `card` : `DocumentReponses`, `DevisReponse`, `CadrageFormulaire`, `LivrableReponse`, `LivrableVideo`, `LivrableMessage`, `TemoignageFormulaire`. Ils passent aux utilitaires qui reproduisent `.card`. Le rendu public ne doit pas bouger : capture avant et après, zéro écart.
- **Le portail n'a aucune règle d'impression.** Une proposition imprimée depuis le portail doit donner le PDF d'aujourd'hui. Sur ces pages, la barre du portail et la barre latérale sont masquées à l'impression.

### Ce qui ne change pas

- **Les adresses publiques restent servies** jusqu'au sous-projet 5. La page publique et la page du portail rendent le même composant, dans deux contextes.
- **Les formulaires postent vers les mêmes `/api/*-reponse`**, déjà servis tels quels sur my.coolbeans.cc. Les réponses en D1 restent indexées par le slug du fichier.
- **Les liens émis** (mails de confirmation, cockpit, commentaire Linear d'une signature, pied du PDF) passent par une seule fonction, `adresseDocument`. Elle rend l'adresse publique jusqu'au sous-projet 5, qui la bascule vers le portail.

### Architecture

- **Quatre composants de page** : `PageCadrage`, `PageProposition`, `PageLivrable`, `PageTemoignage`. Ils reçoivent le groupe de versions, les pastilles et le contexte (`public` ou `portail`). Le gabarit actuel des quatre routes publiques y déménage tel quel. Les routes publiques et la route du portail les rendent.
- **`DocumentEntete` reçoit le contexte.** En `portail`, il ne pose pas `DocumentTopbar`.
- **Une route du portail** : `src/pages/espace/projets/[projet]/[etape].astro`, rendue à la demande. Elle trouve le document racine, vérifie l'accès, choisit le composant de page selon la collection.
- **Logique pure et testée**, dans `src/lib/documents/` :
  - `documentDuPortail(documents, projet, etape)` : la racine visée, ou rien ;
  - `peutLire(document, portee, admin)` : la règle d'accès ;
  - `sectionsProjets(documents, workspace, admin)` : les sections de la barre latérale ;
  - `urlDocument(document, contexte)` : l'adresse publique ou celle du portail, que la frise utilise.
- **Le contenu se lit à l'exécution.** Les collections sont disponibles dans le Worker, comme pour `DocumentReponses` aujourd'hui. Aucune lecture D1 pour afficher un document.

### Critères de recette du sous-projet 1

- [ ] Un client connecté ouvre chacun de ses documents publiés depuis sa barre latérale.
- [ ] Un document d'un autre workspace répond 404, y compris par adresse tapée à la main.
- [ ] Un brouillon répond 404 au client, et s'affiche avec son bandeau pour l'admin.
- [ ] Changer d'onglet ne change rien au-dessus de la barre d'onglets, dans le portail.
- [ ] Les documents publics s'affichent à l'identique : captures avant et après, zéro écart.
- [ ] Une proposition imprimée depuis le portail donne le PDF actuel.
- [ ] Un workspace sans clé n'affiche aucune section de projet.
- [ ] Vérifié sur desktop, tablette et mobile.

## Sous-projets 2 à 5 : ce qui est déjà décidé

### 2. Le jeton personnel

- Ludo l'émet depuis le cockpit, pour une personne (son email) et un workspace.
- Le lien ouvre une session, puis mène au document visé : `my.coolbeans.cc/acces/<jeton>`.
- Valable 30 jours, utilisable plusieurs fois pendant cette durée, révocable depuis le cockpit.
- Le jeton n'est jamais stocké en clair.
- Un mail transféré donne l'accès au destinataire, sous le nom de l'invité. C'est le prix de l'accès en un clic, accepté le 2026-09-30.

### 3. L'invitation par le client

- Un bouton « Inviter un collègue » dans l'espace du client. Il saisit un email, le collègue reçoit son propre jeton.
- Un client n'invite que dans son propre workspace.
- Ludo est prévenu à chaque invitation.

### 4. Le workspace créé avec le premier document

- Publier le premier document d'une clé client sans workspace ouvre ce workspace et le compte de son destinataire.
- La publication passe par un déploiement, où la base D1 n'est pas joignable : le mécanisme exact se tranchera dans la spec de ce sous-projet. Piste : le cockpit liste les documents publiés sans workspace, et un bouton ouvre workspace, compte et jeton d'un geste.
- La fiche client et la team D1 restent à aligner (`amorcer-organisations.mjs`, COO-167).

### 5. La bascule de l'existant

- Un compte pour chaque client qui a un document publié. Jetons générés, mails préparés, envoyés sur ordre de Ludo.
- Chaque ancienne adresse publique renvoie vers la connexion, puis vers le document dans le portail.
- `adresseDocument` bascule vers le portail.
- Les skills qui fabriquent ou citent ces adresses sont mises à jour : `proposition-commerciale`, `livraison-client`, `onboarding-client`.

## Hors périmètre

- La marque blanche des workspaces de revendeur (spec `2026-08-26-portail-multi-tenant-agences-design.md`, phase B).
- La création des trames d'un projet neuf.
- Pré-remplir les formulaires avec l'identité du compte connecté.

## Questions ouvertes

1. **Workspace de revendeur.** La proposition d'un projet Miharu est adressée à Trigger et porte le prix de Coolbeans à Trigger. Proposition : dans un workspace de revendeur, les documents du cycle ne se lisent que par les comptes du revendeur, jamais par ceux du client final.
2. **Relecture des brouillons.** Le lot 1 réservait la relecture au développement local, faute de contrôle d'accès. Dans le portail, l'admin peut relire un brouillon en préproduction comme en production, sans que le client le voie. Proposition : oui.
3. **Documents hors nomenclature.** L'ancienne proposition En Haut (projet annulé) et les deux documents du manuscrit de Véronique Berthet, qui n'est pas cliente. Proposition : ils restent publics à leur adresse actuelle.
