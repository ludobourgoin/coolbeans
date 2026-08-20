# Remplacement de Clerk par Better Auth sur le portail

**Date :** 2026-08-19
**Statut :** design validé, implémentation non commencée
**Origine :** brainstorm du 2026-08-19, COO-132. Déclenché par la priorisation du
module Cadrage, dont le lien magique dépend de cette migration.

---

## 0. Instruction pour Claude Code

Ce document est la source de vérité de la migration. Toute décision prise ici
prime sur une intuition de session. Les décisions sont datées : si une session
ultérieure en change une, elle amende ce fichier dans le même commit.

---

## 1. Décision : GO

Clerk est remplacé par Better Auth auto-hébergé dans le Worker.

Trois raisons, dans cet ordre :

1. **Le lien magique.** Le module Cadrage en dépend, et le module Cadrage est
   devenu la première étape du process de vente (spec du 2026-08-19,
   section 7). Clerk propose bien des liens magiques, mais l'expérience passe
   par ses écrans hébergés, en anglais.
2. **Les mails.** Confirmations en anglais, branding Clerk, personnalisation
   derrière le plan Pro. COO-10 prévoyait un contournement webhook + Resend :
   du travail pour rattraper un défaut qu'on n'a plus si les mails sont les
   nôtres.
3. **Le coût de sortie ne sera jamais plus bas.** Un seul utilisateur réel
   (Ludo), aucun compte client actif sur my.coolbeans.cc, un seul repo
   concerné. Attendre ne fait qu'augmenter la facture.

Contre-argument pesé et écarté : la disparition du dashboard Clerk oblige à
construire une page de gestion des utilisateurs (section 4.3). C'est un coût
réel, accepté en connaissance de cause.

---

## 2. Périmètre d'authentification

**E-mail et mot de passe, plus lien magique.** Les deux méthodes coexistent
dès la V1 : l'utilisateur choisit celle qu'il préfère à chaque connexion.

Décision arbitrée le 2026-08-19 après avoir envisagé le lien magique seul.
Raison retenue : le mot de passe est le schéma auquel tout le monde est
habitué, et son absence déroute davantage qu'elle ne simplifie sur une
relation client. Le lien magique reste indispensable, c'est lui que le module
Cadrage utilise pour les prospects.

**Aucune inscription publique.** C'est la conséquence directe et non
négociable de l'ajout du mot de passe : sans ce verrou, n'importe qui se crée
un compte sur le portail. Les comptes naissent d'une **invitation** émise
depuis la page admin (section 4.3). L'invité reçoit un lien qui lui permet de
définir son mot de passe, ou d'entrer directement sans en définir.

**Renoncement assumé :** la délivrabilité devient une responsabilité Coolbeans.
Un lien d'invitation ou de réinitialisation qui tombe en spam est un
utilisateur bloqué, et le support c'est Ludo. Resend sur `send.coolbeans.cc`
est déjà en place et authentifié. Le mot de passe atténue ce risque une fois
le compte ouvert, il ne le supprime pas à l'ouverture.

### Procédure de secours

Perte simultanée du mot de passe et de l'accès à la boîte mail : il n'y a rien
à coder.
Coolbeans possède la base. Insérer un jeton de vérification à la main via
`wrangler d1 execute` sur `coolbeans-portal` suffit à ouvrir une session. La
procédure exacte est à écrire dans la doc d'exploitation au moment de
l'implémentation, une fois le nom des tables connu.

C'est le seul avantage de l'auto-hébergement qu'on ne mentionne jamais : avec
un service tiers, la même situation devient un ticket support.

---

## 3. Architecture

| Choix | Décision | Raison |
|---|---|---|
| Hébergement | Better Auth dans le Worker, wrapper `withCloudflare` | Pas de dépendance externe, pas de quota MAU |
| Base | `d1Native` | Aucun ORM ailleurs dans le repo ; en ajouter un pour l'auth serait une dépendance de plus à maintenir |
| Sessions | D1, pas de KV en secondary storage | Le TTL minimum de 60 s de KV est un piège documenté, pour un gain nul à cette échelle |
| Environnements | Une instance par environnement, sur les D1 déjà séparés (`coolbeans-portal`, `coolbeans-portal-staging`) | Supprime la dualité des `publicMetadata` dev/live de Clerk |
| Plugins | `emailAndPassword` natif + plugin `magicLink` | Cf. section 2 |
| Inscription | Fermée. Comptes créés par invitation depuis la page admin | Sans ce verrou, le portail est ouvert à tous |
| Mails | Resend, expéditeur repris de `src/pages/api/devis-reponse.ts`, rendus par `renderTransactionnel` | Jamais d'expéditeur inventé ; cohérence visuelle avec les transactionnels existants |
| Rôle et workspace | `additionalFields` sur la table user : `role`, `workspace` | Cf. section 4.3 |

**Point de vigilance :** `baseURL` derrière la réécriture d'hôte
`my.coolbeans.cc` de `src/worker.ts`. C'est là que les cookies se cassent, et
ça ne se voit qu'en déployé, jamais en local.

---

## 4. Surfaces à construire

Clerk fournissait des composants d'interface. Better Auth n'en fournit aucun.
C'est le poste de travail principal de la migration, et celui qu'on
sous-estime.

### 4.1 `/connexion`

Remplace `<SignIn />`. Deux chemins **présentés à parité**, sur le même écran,
à chaque connexion.

Parité veut dire : même poids visuel, même hiérarchie typographique, aucun des
deux relégué au rang de solution de secours derrière un lien discret. Ni « ou
sinon, recevoir un lien », ni un magic link caché sous « Plus d'options ».
L'utilisateur choisit, il ne se rabat pas.

| Chemin | Libellé | Ce qu'il porte |
|---|---|---|
| A | **E-mail et mot de passe** | Les deux champs, plus « Mot de passe oublié » et la page de réinitialisation |
| B | **Recevoir un lien de connexion** | Le champ e-mail, la mention « Recevez un mail avec un lien pour vous connecter directement », et l'écran « lien envoyé » |

La mention du chemin B est **obligatoire** : sans elle, l'utilisateur ne sait
pas ce qui va se passer quand il clique, et une action dont on ne devine pas
l'effet ne se tente pas.

États d'erreur à couvrir, en français : identifiants invalides, lien expiré,
lien déjà utilisé, adresse inconnue, mot de passe trop faible à la définition.

Pas de lien « créer un compte » : l'inscription est fermée (section 2). Un
visiteur sans compte doit comprendre qu'il faut une invitation, pas rester à
chercher un bouton absent.

### 4.2 Menu compte

Remplace `<UserButton />` dans `src/components/portail/PortalNav.astro`. Nom,
adresse, déconnexion. Le composant Clerk réordonnait ses items natifs
(COO-35) : cette contrainte disparaît avec lui.

### 4.3 `/espace/utilisateurs`

Page admin, arbitrée le 2026-08-19 : liste des utilisateurs, **invitation par
e-mail**, attribution du rôle et du workspace, révocation.

L'invitation est le seul chemin de création de compte. Elle envoie un lien qui
ouvre la définition du mot de passe, laquelle reste facultative : l'invité peut
s'en tenir au lien magique.

Alternative écartée : porter le mapping dans `src/content/clients/<slug>.yaml`
(`contacts: [{ email, prenom, role }]`), ce qui aurait supprimé le besoin de
page admin au prix d'un déploiement de six minutes pour ouvrir un accès.
Écartée au profit de l'accès immédiat.

---

## 5. Données

### 5.1 Tables Better Auth

Créées par la CLI de migrations Better Auth, sur les deux D1.

### 5.2 Identifiants Clerk persistés

**Trou non identifié par COO-132.** Les tables de la messagerie portent des
identifiants Clerk, avec des lignes réelles en production depuis le
2026-08-17 (`src/lib/portail/messagerie/store.ts`) :

- `tickets.author_clerk_id`
- `messages.destinataire_clerk_id`

Migration D1 : renommage en `author_user_id` et `destinataire_user_id`, puis
réécriture de l'ancien identifiant Clerk de Ludo vers son nouvel identifiant
Better Auth. Un seul utilisateur, donc un `UPDATE` sur une seule valeur.
L'historique des tickets reste intact et le nom de colonne cesse de mentir.

Le champ `pourClerkId` du formulaire `NouvelleDemandeAdmin.astro` suit le même
renommage.

### 5.3 `metadata.ts`

`readPortalMetadata` lit la session Better Auth au lieu du `publicMetadata`
Clerk. La fonction `legacyClient`, marquée temporaire depuis le 2026-08-12,
disparaît : COO-47 est absorbée.

La tolérance de lecture reste : une forme inattendue dégrade vers un empty
state, jamais vers une 500.

---

## 6. Ce qui ne bouge pas

- **Le middleware garde sa forme.** Matcher `PROTECTED` sur `/espace` et
  `/docs`, redirection vers `/connexion` avec `redirect_url`. Seule la lecture
  de session change.
- **L'interception de `portail.choisirWorkspace`** dans le middleware est
  indépendante de l'authentification. Ne pas y toucher : le commentaire qui
  l'accompagne décrit un piège coûteux à redécouvrir.
- Le registre des workspaces, le sélecteur, la doc client, la messagerie côté
  métier, le cockpit devis.

---

## 7. Français

Better Auth ne fournit aucune traduction. Mapping `$ERROR_CODES` → français à
écrire : c'est le seul texte de la chaîne d'authentification qui ne serait pas
maîtrisé sans ce travail. C'était précisément le reproche fait à Clerk ; ne
pas le reproduire.

---

## 8. Recette

Staging d'abord, production ensuite. Aucune stratégie de bascule à prévoir :
**il n'y a aucun utilisateur réel sur my.coolbeans.cc**, la coexistence des
deux systèmes serait du coût pur.

Scénarios, par environnement :

1. Invitation émise depuis la page admin, réception du mail
2. Premier accès par le lien d'invitation, définition du mot de passe
3. Premier accès par le lien d'invitation, sans définir de mot de passe
4. Connexion par e-mail et mot de passe
5. Mot de passe erroné, message en français
6. Mot de passe oublié, réinitialisation complète
7. Connexion par lien magique, retour après fermeture de l'onglet
8. Lien expiré, puis lien déjà utilisé
9. Accès à `/espace` sans session, redirection et retour sur la page demandée
10. Garde admin sur une action réservée
11. Ticket de messagerie dont l'auteur a été remappé, affichage correct

---

## 9. Issues absorbées

| Issue | Sort |
|---|---|
| COO-10 — emails Clerk en français via webhook Resend | Absorbée. Les mails deviennent les nôtres |
| COO-35 — théminer les composants Clerk | Annulée. Les composants disparaissent |
| COO-47 — retirer `legacyClient` dans `metadata.ts` | Absorbée (section 5.3) |

**Skills Claude :** les 22 skills liées à Clerk (`clerk-*`, `audit-clerk-skill`,
`audit-expo-skill`) se retirent **après** la bascule vérifiée, jamais avant.
La skill `better-auth-cloudflare` est aujourd'hui distillée du README du
package : sa section Astro est une déduction non testée, à corriger avec le
pattern réellement validé.

**Spec Spinoza :** à amender pour démarrer directement sur Better Auth, aucune
migration de code (le repo ne mentionne Clerk que dans ses specs).

---

## 10. Hors périmètre

- 2FA, passkeys, connexion par fournisseur tiers
- Inscription publique, sous toutes ses formes
- Organisations Better Auth
- Toute migration de comptes : il n'y en a pas

---

## 11. Journal des décisions

| Date | Décision |
|---|---|
| 2026-08-19 | GO sur le remplacement de Clerk par Better Auth |
| 2026-08-19 | E-mail et mot de passe dès la V1, plus lien magique. Le lien magique seul avait d'abord été retenu, puis écarté le même jour |
| 2026-08-19 | Aucune inscription publique : les comptes naissent d'une invitation depuis la page admin |
| 2026-08-19 | Les deux méthodes de connexion sont présentées à parité sur `/connexion`, jamais l'une en repli de l'autre |
| 2026-08-19 | `d1Native`, pas de KV en secondary storage, une instance par environnement |
| 2026-08-19 | Rôle et workspace en base (`additionalFields`), avec page admin `/espace/utilisateurs` à construire |
| 2026-08-19 | Colonnes `*_clerk_id` renommées en `*_user_id` et lignes remappées |
| 2026-08-19 | Aucune stratégie de bascule : zéro utilisateur réel sur le portail |
| 2026-08-19 | Procédure de secours par insertion D1 à la main, rien à coder |
