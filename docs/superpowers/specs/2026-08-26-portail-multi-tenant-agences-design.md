# Portail multi-tenant : organisations, marque blanche, tableau de bord

**Date :** 2026-08-26
**Statut :** design validé, implémentation non commencée
**Origine :** besoin exprimé le 2026-08-26 — Baptiste, de l'agence Trigger, doit
voir l'ensemble des chantiers que Trigger confie à Coolbeans.
**Prérequis :** phase A livrée (`2026-08-19-better-auth-migration-design.md`)

---

## 0. Instruction pour Claude Code

Ce document est la source de vérité de la phase B. Le modèle d'authentification
et d'appartenance n'est **pas** décrit ici : il vit dans la spec de phase A,
section 3.1, et prime. Toute décision prise ici est datée ; une session
ultérieure qui en change une amende ce fichier dans le même commit.

---

## 1. Ce que porte cette phase

La phase A rend le portail multi-tenant **en droit** : trois types de compte,
organisations, teams, appartenances. Rien n'en est visible.

La phase B le rend multi-tenant **en fait** :

1. L'URL porte l'organisation et la team
2. Les workspaces d'agence sont en marque blanche
3. Un tableau de bord des projets, à trois portées

Ce n'est pas du confort. Le workspace est ce que Ludo montre en rendez-vous
d'agence : un portail à leur marque, avec leurs chantiers, met en confiance
avant qu'un mot soit prononcé. Ces trois points sont des fonctionnalités
commerciales.

---

## 2. Dépendances

**Le tableau de bord dépend de COO-69** (sync Linear du module Projets). Sans
lui, il n'y a aucun projet à lister : les sections 6 et 10 sont bloquées, les
sections 3 à 5 ne le sont pas. Ne pas commencer la phase B par le tableau.

---

## 3. URL et routage

### 3.1 Schéma

`/<organisation>/<team>/<module>` — sans exception, y compris pour les clients
directs de Coolbeans.

```
my.coolbeans.cc/trigger/amusoire/projets      client d'agence
my.coolbeans.cc/trigger/trigger/projets       l'agence est sa propre cliente
my.coolbeans.cc/coolbeans/fylgo/projets       client direct
my.coolbeans.cc/coolbeans/coolbeans/projets   Coolbeans, client zéro
```

Décision du 2026-08-26 : une seule forme d'URL, jamais deux. Une forme courte
réservée aux clients directs aurait imposé deux schémas de routes à maintenir
et un risque de collision le jour où un client porterait le nom d'un module.

La répétition `/trigger/trigger/` est assumée. Elle est lisible, et sans
ambiguïté avec `/trigger` qui reste le tableau de bord de l'organisation.

### 3.2 Les trois entrées

| URL | Qui la voit | Contenu |
|---|---|---|
| `/` | `admin` | Tableau de bord global, tous comptes confondus |
| `/<organisation>` | `admin`, `agence` | Tableau de bord de l'organisation |
| `/<organisation>/<team>` | tous, selon appartenance | Accueil du workspace |

La racine **redirige vers la portée la plus large du compte** : un `agence`
atterrit sur `/trigger`, un `client` sur `/trigger/amusoire`. Seul l'`admin`
voit une page à `/`.

Tant que COO-69 n'est pas livré, `/` et `/<organisation>` affichent l'accueil
actuel de `src/pages/espace/index.astro` plutôt qu'un tableau vide : les
redirections et les gardes se livrent sans attendre le contenu.

### 3.3 Slugs réservés

Deux familles de routes cohabitent :

- **Les outils d'administration restent à la racine** : `/devis`,
  `/chiffrages`, `/clients`, `/utilisateurs`. Ce sont les outils de Coolbeans,
  pas des modules de workspace.
- **Les modules de workspace vivent sous `/<organisation>/<team>/`.**

Conséquence : une **liste de slugs réservés** interdit qu'une organisation
porte le nom d'un outil admin ou d'une route technique (`connexion`, `api`,
`docs`, `img`…). Elle est vérifiée à la création d'une fiche au registre, pas
seulement au moment de router.

### 3.4 Travail réel

Les 20 pages de `src/pages/espace/` **descendent** dans
`src/pages/espace/[organisation]/[client]/`. C'est un déplacement de fichiers,
pas une réécriture : la résolution du workspace, aujourd'hui implicite, devient
un paramètre de route. Les outils admin listés en 3.3 restent où ils sont.

`src/worker.ts` ne change pas de logique : il continue de préfixer par
`/espace`. Le chemin interne devient simplement
`/espace/<organisation>/<team>/<module>`.

**Les anciennes URLs ne peuvent pas être redirigées par le Worker** : il ne
connaît pas la session, donc il ignore vers quel workspace envoyer `/projets`.
La redirection est applicative, dans le middleware, après lecture de la
session. C'est le piège de cette section.

### 3.5 La doc suit le schéma

`/docs/<client>/<page>` devient `/<organisation>/<team>/doc/<page>`.
L'autorisation, aujourd'hui portée par la comparaison `doc === client` dans
`src/pages/docs/[client]/[...slug].astro`, devient l'appartenance à la team.
C'est une simplification : la règle d'accès de la doc cesse d'être une règle à
part.

### 3.6 Le cookie de sélection change de sens

`portail.choisirWorkspace`, intercepté dans le middleware, ne **porte** plus le
workspace courant : l'URL le fait. Il ne retient que le dernier workspace
visité, pour résoudre `/` et les anciennes URLs. Le commentaire qui accompagne
l'interception décrit un piège coûteux à redécouvrir : le relire avant d'y
toucher, et le réécrire une fois le sens changé.

---

## 4. Registre des organisations

Nouvelle collection `src/content/organisations/<slug>.yaml`, sur le modèle du
registre des clients :

```yaml
nom: Trigger
logo: /img/organisations/trigger.svg
logo_sombre: /img/organisations/trigger-white.svg
couleur: "#1a1a1a"
site: https://trigger.fr
```

`coolbeans.yaml` y figure comme les autres. C'est ce qui fait sortir la marque
Coolbeans du code : le chrome du portail cesse de connaître un logo en dur, il
résout celui de l'organisation courante.

`src/content/clients/<slug>.yaml` gagne un champ `organisation`, obligatoire.

**Édition par les agences hors périmètre** (section 11). Le modèle l'anticipe :
le jour où les réglages passent en D1 + R2, seul le résolveur de marque change,
pas ses appelants.

---

## 5. Marque blanche

Sur un workspace d'agence, **Coolbeans n'apparaît nulle part** : ni logo, ni
lien, ni nom. Le seul reste est le domaine `my.coolbeans.cc`, assumé.

### 5.1 Les sept points de fuite

Recensés le 2026-08-26. La liste est exhaustive à cette date ; la vérifier
avant de conclure l'implémentation.

| Emplacement | Ce qui fuit |
|---|---|
| `src/components/portail/PortalNav.astro` | Logo et wordmark Coolbeans, `aria-label` « myCoolbeans » |
| `src/layouts/EspaceLayout.astro` | `title` « … · Coolbeans », description « Espace client Coolbeans » |
| `src/layouts/BaseLayout.astro` | `og:site_name`, titre PWA « my Coolbeans », schéma `Organization` |
| `src/components/portail/FilMessages.astro` | Signature « Ludo — Coolbeans » sur chaque message sortant |
| `src/components/portail/NouvelleDemande.astro` | « écrivez-moi à ludo@coolbeans.cc » en cas d'erreur |
| Manifeste PWA | Nom et icônes |
| Mails transactionnels | Expéditeur et gabarit (section 8) |

Tous passent par **un résolveur unique** qui rend la marque de l'organisation
courante. Aucun composant ne lit le registre directement.

### 5.2 Le footer est à créer

Le portail n'en a pas. `src/components/Footer.astro` est celui du site
marketing, et n'a rien à faire ici. Le footer de workspace reprend le logo et
la couleur de l'organisation, et rien d'autre.

### 5.3 La signature de la messagerie devient neutre

Décision du 2026-08-26. Sur un workspace d'agence, `FilMessages` signe
**« Ludo »**, sans mention de Coolbeans.

C'est la résolution d'une contradiction réelle : le fil est commun à l'agence
et au client final (section 7), donc le client final écrit à Ludo directement
tout en naviguant dans un portail où Coolbeans n'existe pas. Signer sous
l'identité de l'agence a été écarté : si le client final en parle ensuite à son
interlocuteur Trigger, plus personne ne sait qui a dit quoi. Un sous-traitant
identifié par son prénom est la situation normale ; un sous-traitant déguisé ne
l'est pas.

---

## 6. Tableau de bord des projets

**Un seul composant, trois portées.** Les colonnes constantes disparaissent.

| Vue | URL | Colonnes |
|---|---|---|
| `admin` | `/` | Compte, Client, Projet, Statut projet, Dates, **Statut CRM** |
| `agence` | `/<organisation>` | Client, Projet, Statut projet, Dates, **Statut CRM** |
| `client` | `/<organisation>/<team>` | Projet, Statut projet, Dates |

`Compte` est l'organisation, `Client` la team, `Projet` un projet Linear.
Les données viennent de Linear (COO-69).

### 6.1 Statut CRM

Décision du 2026-08-26 : c'est l'**état commercial** — devis envoyé, acompte
réglé, soldé — et il est **visible de l'agence**, jamais du client final.

Baptiste doit savoir où en est la facturation de ses chantiers ; le client
final d'une agence n'a rien à connaître de la relation Coolbeans–Trigger.

**Point de sécurité, à traiter comme tel.** Cet état vit dans une team Linear
**privée** (le CRM, migré le 2026-08-16). Ce qui en sort est décidé par une
**liste blanche de champs**, dans le prolongement du filtre de contenu
client-safe de la spec produit du 2026-08-17 §4.5 — jamais par une exclusion
de champs sensibles, qui laisse passer tout champ ajouté plus tard. Un statut
normalisé sort ; le contenu d'une affaire, jamais.

---

## 7. Messagerie

Le fil reste **commun** : l'agence et le client final écrivent au même endroit,
les tickets partent dans la team Linear du workspace. Aucun développement
au-delà de la signature (section 5.3).

Le drapeau `messagerie: false` du registre reste ce qu'il est : une coupure par
workspace, pas par type de compte.

---

## 8. Mails

Les mails d'authentification et transactionnels d'un workspace d'agence
reprennent **le logo et les couleurs de l'organisation**, et son nom en nom
d'affichage de l'expéditeur.

L'adresse technique reste `send.coolbeans.cc` : elle est authentifiée et sa
délivrabilité est acquise. Un domaine d'envoi par agence a été écarté le
2026-08-26 — il ferait de Ludo le responsable de la configuration DNS d'un
tiers, alors que la phase A note déjà que la délivrabilité devient sa
responsabilité en propre.

`renderTransactionnel` prend donc la marque en paramètre, comme le chrome.

---

## 9. Ce qui ne bouge pas

- Le modèle d'authentification et d'appartenance : il est figé en phase A
- Le cockpit Devis, strictement `adminOnly`, à la racine
- Le registre des clients comme source de vérité des mappings
- La messagerie côté métier, le webhook Linear, le cron de relance

---

## 10. Recette

1. `admin` sur `/` : le tableau liste les projets de toutes les organisations
2. `agence` sur `/` : redirigé vers `/trigger`
3. `client` sur `/` : redirigé vers `/trigger/amusoire`
4. `agence` sur `/trigger` : les teams de Trigger, et elles seules
5. `agence` sur `/coolbeans` : refusé
6. `client` sur la team voisine de son organisation : refusé
7. Ancienne URL `/projets` avec session : redirigée vers le bon workspace
8. Ancienne URL sans session : `/connexion`, puis retour sur la page demandée
9. Workspace d'agence : aucune occurrence de « Coolbeans » dans la page rendue,
   balises `head` et manifeste compris
10. Workspace Coolbeans : la marque Coolbeans s'affiche, résolue par le registre
11. Message sortant sur workspace d'agence : signé « Ludo », sans Coolbeans
12. Mail d'invitation sur workspace d'agence : logo et couleurs de l'agence
13. `client` sur le tableau : aucune colonne Statut CRM dans le HTML rendu,
    pas seulement masquée en CSS
14. Doc d'un client : accessible par appartenance, refusée sans
15. Slug d'organisation entrant en collision avec un outil admin : rejeté au
    registre, pas au routage

---

## 11. Hors périmètre

- Édition des réglages de marque par les agences elles-mêmes. Ludo les code, la
  page de réglages viendra ensuite
- Domaine propre par agence (`my.trigger.fr`)
- Facturation, marges et commissions dans le portail
- Droits fins par module pour le type `agence` : il voit ce que voit un
  `client`, plus le tableau de bord et le Statut CRM
- Création d'organisation ou de team depuis une interface

---

## 12. Journal des décisions

| Date | Décision |
|---|---|
| 2026-08-26 | URL unique `/<organisation>/<team>/<module>`, sans forme courte pour les clients directs |
| 2026-08-26 | Les outils admin restent à la racine ; liste de slugs réservés vérifiée au registre |
| 2026-08-26 | La racine redirige vers la portée la plus large du compte |
| 2026-08-26 | La doc passe sous le schéma commun, autorisée par l'appartenance |
| 2026-08-26 | Registre `src/content/organisations/`, Coolbeans y figure comme les autres |
| 2026-08-26 | Marque blanche stricte sur les workspaces d'agence, sauf le domaine |
| 2026-08-26 | Signature de messagerie neutre « Ludo » ; signer sous l'identité de l'agence écarté |
| 2026-08-26 | Mails aux couleurs de l'agence, expéditeur `send.coolbeans.cc` ; domaine par agence écarté |
| 2026-08-26 | Un tableau de bord, trois portées ; Statut CRM visible de l'agence, jamais du client final |
| 2026-08-26 | Le Statut CRM sort du CRM privé par liste blanche de champs |
