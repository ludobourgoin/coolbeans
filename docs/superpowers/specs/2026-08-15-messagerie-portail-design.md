# Messagerie du portail client — design

Date : 2026-08-15
Statut : actif — spec de design du milestone « P2 · Messagerie complète » (COO-96 à 99), plan d'implémentation : `../plans/2026-08-15-messagerie-portail.md`. Validé en brainstorm le 2026-08-15, aligné sur la spec produit le 2026-08-17 (voir §12 : quatre écarts, dont deux à trancher par Ludo).

## 1. Objectif

Remplacer le formulaire de support « à sens unique » du portail my.coolbeans.cc
par une messagerie de tickets bidirectionnelle, adossée aux issues Linear :
le client écrit depuis le portail, Ludo répond depuis Linear, les réponses
publiées partent par email et s'affichent dans le fil du ticket.

Principe directeur : **réduire la charge mentale du client**. Un seul outil
(le portail qu'il connaît déjà), pas de login supplémentaire, pas de compte
recréé nulle part.

## 2. Nommage et navigation

- L'entrée de nav s'appelle **« Messagerie »** (pas « Support ») et remonte
  haut dans la sidebar.
- La page conserve la règle pédagogique : **un message = un sujet**. Trois
  sujets = trois tickets séparés (« comme chez le médecin »).
- Vocabulaire côté client : « demande » ou « message », jamais « issue ».

## 3. Architecture

**Linear = surface de travail de Ludo. D1 = registre des tickets + journal
publié, seul lu par le portail. R2 = fichiers. Le webhook Linear = l'unique
pont. Resend = notifications email.**

```
Client (portail)                    Ludo (Linear)
     │                                   │
     │ formulaire / réponse              │ commentaire « >> »
     ▼                                   ▼
   D1 (registre + journal) ◄── webhook + délai de grâce ── Linear
     │        ▲                          ▲
     │        └── réponse client ────────┘ (commentaire via API)
     ▼
   Resend ──► email au client (et à Ludo sur réponse client)
```

Pourquoi ce hybride plutôt que « Linear source de vérité » :

1. **Fuite structurellement impossible** : seul ce qui a été explicitement
   publié existe dans D1. Le portail ne lit jamais les commentaires Linear
   bruts. C'est la spec §8 (filtre client-safe) poussée au niveau
   architecture.
2. **Historique figé** : l'email envoyé et le fil affiché montrent le même
   texte, gelé à la publication. Une édition ultérieure du commentaire
   Linear ne change pas l'historique client.
3. **Stabilité** : lecture locale, pas de dépendance à l'API Linear à chaque
   affichage. D1 est un journal append-only, pas un miroir à réconcilier —
   rien ne peut diverger.

Seule donnée lue en live depuis Linear : le statut des issues pour le board
(un appel par affichage, avec `includeArchived`).

## 4. Modèle de données

### D1

**`tickets`**

| Colonne | Notes |
|---|---|
| `id` | PK |
| `client` | slug du client (registre `src/content/clients/`) |
| `linear_issue_uuid` | **UUID interne**, jamais l'identifiant `AMU-36` (survit au déplacement de team) ; nullable le temps de la création, ré-appairable |
| `author_clerk_id` | utilisateur Clerk auteur du ticket (toujours un utilisateur du client, même en création admin) |
| `created_via` | `portail` (défaut) ou `admin` (ticket ouvert par Ludo au nom du client) |
| `objet` | titre |
| `created_at` | |

**`messages`**

| Colonne | Notes |
|---|---|
| `id` | PK |
| `ticket_id` | FK |
| `direction` | `client` ou `coolbeans` |
| `body` | markdown, contenu figé à la publication |
| `linear_comment_id` | **contrainte UNIQUE** → idempotence des webhooks dupliqués ; null pour les messages client |
| `email_status` | `pending` / `sent` / `bounced` — envoi loggé |
| `published_at` | |

**`attachments`**

| Colonne | Notes |
|---|---|
| `id` | PK |
| `message_id` | FK |
| `r2_key` | clé du fichier dans R2 |
| `filename`, `size`, `mime` | |

### R2

Bucket **privé** pour les pièces jointes des clients. Limites formulaire :
10 Mo par fichier, 3 fichiers par message. Servi exclusivement via une route
du Worker qui vérifie session Clerk + appartenance à la team avant de
streamer. Jamais de bucket public.

### Registre client (`src/content/clients/`)

Un seul champ nouveau par client : `linear_support_project_id` (l'ID du
projet Support de sa team). **Pas** de nom d'affichage ni d'email de
notification : l'identité vient du compte Clerk (prénom + email du compte
myCoolbeans). On ne recrée ni nom ni adresse.

## 5. Côté Linear

- **Un projet « Support » evergreen par team client**, sans target date.
  Sa création fait partie de la checklist d'onboarding manuel d'un portail,
  et son ID est reporté dans le registre client.
- Toute issue de ticket est créée dans ce projet, **auto-assignée à Ludo**.
- Champ urgence du formulaire → priorité Linear (échelle globale au
  workspace) : Bloquant → 1 Urgent, Urgent → 2 High, Normal → 3 Medium,
  Pas pressé → 4 Low. Sans choix du client → 3 Medium. Mapping ajustable.
- Tâche annexe (repo `coolbeans-claude-skills`) : exclure les projets
  Support du routage proposé par la skill `linear` (une ligne dans
  `references/taxonomie.md`).

## 6. UI

### Board (page Messagerie)

- Liste des tickets du client façon boîte mail : objet, auteur (prénom du
  compte Clerk), date du dernier message, statut.
- **Portée organisation** : tous les utilisateurs du client voient tous les
  tickets du client.
- CTA **« Nouvelle demande »** en haut à gauche du board → popup.
- **Trois statuts**, mappés par `statusType` Linear (jamais par nom d'état) :
  - `triage` / `backlog` / `unstarted` → **En attente**
  - `started` → **En cours**
  - `completed` / `canceled` → **Traité**
  - fetch de statut en échec (issue supprimée non réparée) → « — », sans
    message d'erreur anxiogène.
- Le « pour validation » ne passe pas par un badge mais par un message `>>`
  (« c'est en ligne, dis-moi si ça te va »).

### Popup Nouvelle demande

- **Objet** : obligatoire.
- **Description** : optionnelle.
- **Urgence** : optionnelle (mapping §5).
- **Pièces jointes** : optionnelles, 10 Mo × 3 max.
- À la soumission : ligne D1 d'abord, puis issue Linear (projet Support,
  assignée à Ludo, description = contenu + mention « envoyé depuis le
  portail par {prénom} ({email}) le {date} »). Si la création Linear échoue,
  le ticket existe côté client (« En attente ») et une reprise recrée
  l'issue.

### Page ticket

- Fil de conversation chronologique (messages D1), zone de réponse, upload.
- Réponse client → écrite dans D1 **et** postée en commentaire sur l'issue
  Linear (avec liens vers les fichiers R2 le cas échéant).
- URL stable et partageable (voir §8, intake).

## 7. Flux de publication (Ludo → client)

1. Ludo poste un commentaire commençant par **`>>`** sur l'issue.
2. Le webhook Linear (signature **vérifiée**, non négociable) le met en file
   avec un **délai de grâce de 2-3 min**.
3. À l'échéance, re-fetch du commentaire et envoi de son contenu **actuel** :
   - couvre la touche Entrée qui poste trop tôt (compléter **en éditant** le
     commentaire, jamais en postant un second commentaire) ;
   - sert de fenêtre « undo » : supprimer le commentaire ou retirer le `>>`
     pendant le délai **annule** la publication ;
   - si le commentaire contient une image Linear (`uploads.linear.app`,
     CDN privé), elle est retirée et Ludo est alerté — v1 texte seul dans ce
     sens.
4. Écriture D1 **avant** envoi email (si l'email échoue, le portail fait
   foi ; l'échec est marqué `email_status = failed` — pas de relance
   automatique en v1, follow-up avec le tracking des bounces, amendé le
   2026-08-16 après revue finale). Email via Resend à **l'auteur du ticket uniquement**
   (email du compte Clerk), avec lien « Répondre sur le portail ».
   Pas de reply-to traité : le inbound email est explicitement hors scope.

Notification vers Ludo quand le client répond : email Resend vers
`ludo@coolbeans.cc` (le commentaire étant posté via son propre token, Linear
ne le notifierait pas). Amélioration future possible : acteur applicatif
OAuth (« Noémie via portail »).

## 8. Politique de canaux et intake

- **Canal privilégié** : la messagerie du portail.
- **Réflexe de redirection** : si une demande arrive par un autre canal,
  Ludo envoie d'abord l'URL de la page Messagerie pour que le client crée
  le ticket lui-même (le canal privilégié s'apprend par l'usage).
- **Email accepté** si le client préfère : Ludo crée alors le ticket
  lui-même **depuis l'espace admin du portail** (« ouvrir un ticket au nom
  de {utilisateur} ») — ce qui crée la ligne D1 + l'issue Linear. Une issue
  créée directement dans Linear n'aurait **pas** de page portail (pas de
  ligne D1) : la création au nom du client est donc une fonctionnalité
  **V1**. Détails :
  - `author_clerk_id` = l'utilisateur du client (il reste l'auteur : c'est
    lui qui reçoit les notifications du fil) ; `created_via = admin`.
  - Marqueur de provenance **discret et honnête** sur la page du ticket,
    sous l'objet : « Ouvert par Ludo pour {prénom} » — pas de mimétisme,
    on ne fait pas passer le ticket pour une saisie du client.
  - Un email part au client à la création : « Ludo a ouvert un ticket pour
    vous suite à votre demande », avec le lien du ticket — ça clôt la
    boucle et ça enseigne la messagerie.
  - La description de l'issue Linear mentionne la provenance (« saisi par
    Ludo depuis une demande email »).
- **Slack / WhatsApp** : pour discuter. Si une demande y émerge : URL de la
  Messagerie, ou ticket créé au nom du client si c'est plus fluide sur le
  moment.

## 9. Éventualités et défaillances

| Cas | Réponse |
|---|---|
| Issue supprimée par inadvertance | Corbeille Linear ~30 j (restauration) ; le ticket D1 survit (registre + journal), fil intact ; ré-appairage = mise à jour de `linear_issue_uuid` (SQL manuel acceptable en v1) |
| Issue déplacée de team/projet | UUID stable → rien ne casse |
| Webhook dupliqué | UNIQUE sur `linear_comment_id` → idempotent |
| Webhook manqué (endpoint down) | Accepté en v1 (visible à l'œil nu au volume actuel) ; cron de réconciliation en v2 |
| Bounce Resend | V1 : non détecté (exigerait le webhook Resend) — seul l'échec synchrone est marqué `failed`, visible en base et dans le dashboard Resend ; tracking des bounces + relance = follow-up (amendé 2026-08-16) |
| Réponse client sur ticket traité | Autorisée (commentaire sur issue completed), notification à Ludo, réouverture ou recadrage manuels |
| Issue auto-archivée | `includeArchived` au fetch → « Traité » |
| Création Linear échouée à la soumission | Ticket D1 déjà créé, reprise recrée l'issue |
| `>>` posté par erreur | Fenêtre d'annulation du délai de grâce (§7) |

## 10. Hors périmètre V1

- Inbound email (réponse client par mail → commentaire) — l'overkill
  identifié, exclu durablement.
- Lu / non-lu sur le board.
- Cron de réconciliation des webhooks manqués.
- Upload des fichiers clients vers Linear en pièce jointe d'issue (v1 :
  lien portail dans le commentaire).
- Outillage de ré-appairage des orphelins (SQL manuel).
- Images Linear → client.
- Tracking des bounces Resend et relance des emails en échec (amendé
  2026-08-16 : `email_status = failed` couvre l'échec synchrone en v1).

## 11. Quotas (plans gratuits, pour mémoire)

- D1 : 500 Mo/base, 100 k écritures de lignes/jour — messages texte ≈ 1-2 Ko,
  aucune limite atteignable à l'échelle du studio.
- R2 : 10 Go, egress gratuit — ≈ 2 000-3 000 pièces jointes de marge.
- La contrainte réelle est R2, et elle est confortable.

## 12. Alignement sur la spec produit (passe du 2026-08-17)

Relecture contre `2026-08-17-portail-client-strategie-produit.md`. L'architecture D1
(journal publié seul lu par le portail) est **plus forte** que le §4.5 client-safe : aucun
écart de fond. Quatre écarts de détail :

1. **Statuts client — à trancher par Ludo.** Spec produit §3.2 : quatre états (`Reçue` /
   `En cours` / `En validation` / `Résolue`). Cette spec (§6, choix délibéré du brainstorm) :
   trois états mappés par `statusType` (`En attente` / `En cours` / `Traité`), le « pour
   validation » passant par un message `>>` plutôt qu'un badge. Les deux modèles sont
   défendables ; celui qui perd doit être amendé dans l'autre document.
2. **Notification de clôture — à trancher par Ludo.** Spec produit §3.2 (et COO-98) :
   notification « résolu » avec récapitulatif et lien doc. Proposition de résolution : pas de
   machinerie dédiée, une **convention de clôture** sur le flux `>>` existant (dernier message
   `>>` = récapitulatif + lien doc, puis passage en Traité). COO-98 deviendrait une convention
   d'usage plus un gabarit, pas du code.
3. **Plafond de fréquence — tranché (bon sens).** Les emails du fil de conversation sont du
   transactionnel conversationnel : le client les attend, ils sont **exemptés** du plafond
   « deux emails par semaine » du §3.11. Le plafond s'applique aux canaux sortants à
   l'initiative de Coolbeans (digest, observations, opportunités).
4. **Nommage de l'entrée de nav.** Cette spec renomme « Support » en « Messagerie » (§2) ;
   la sidebar (COO-80/81) et la FAQ actuelles disent « Support ». À la livraison de P2 :
   renommage de l'entrée et de la page, la FAQ et le délai de réponse annoncé (COO-99)
   restent sur cette page. D'ici là, « Support » reste le nom en prod.

Note de transition : le module Support MVP (COO-30) crée les tickets directement dans la
team du client via `linearTeamId`, sans projet Support ni D1. Cette spec le remplace à P2
(projet Support evergreen + `linear_support_project_id` + registre D1). Les tickets créés
entre-temps n'auront pas de page de fil : accepté, volume faible.

## Documentation

À la livraison de P2 :

- Doc Coolbeans (client zéro) : page « Messagerie » — fonctionnement du fil, un message =
  un sujet, délais, pièces jointes ; procédure admin « ouvrir un ticket au nom d'un client ».
- Doc interne (repo) : convention `>>`, délai de grâce, mapping `statusType`, procédure de
  ré-appairage d'une issue supprimée.
- FAQ de la page Messagerie mise à jour (remplace la FAQ Support de COO-32).
