# Portail : la barre par workspace, la page par projet Linear

- Date : 2026-09-30
- Statut : conception validée en conversation, spec à relire par Ludo
- Branche : `feat/documents-portail` (worktree `~/dev/coolbeans-documents-portail`), à la suite du sous-projet 1
- Complète : `2026-09-30-documents-prives-workspace-design.md`. Remplace sa barre (une section par projet) et sa route (une adresse par étape).

## 1. Pourquoi

La barre latérale range deux contenus sous la même racine. « Documentation » porte la doc de passation, « Documents » portait les fichiers déposés, et les documents du cycle arrivent avec le sous-projet 1. Ils ne répondent pas au même besoin.

La section Admin s'affiche dans tous les workspaces. L'Aide s'affiche dans celui de Coolbeans, où elle ne sert à rien.

Le sous-projet 1 donne une section de barre à chaque projet et une adresse à chaque étape. Avec tous les projets Linear, la barre de Coolbeans compterait huit sections.

## 2. Arbitrages de Ludo (2026-09-30)

1. La section Admin n'apparaît que dans le workspace Coolbeans.
2. Le workspace Coolbeans n'affiche pas l'Aide.
3. La doc interne de Coolbeans ne vit que dans le workspace Coolbeans.
4. Il reste deux contenus : les documents d'un projet et la documentation du client, qui devient « Mode d'emploi ».
5. Le mode d'emploi appartient au workspace, pas à un projet : un projet n'est pas forcément un site.
6. Un projet du portail est un projet Linear. Chaque workspace naît avec sa sous-team Linear et affiche tous les projets de cette sous-team, même sans document.
7. La barre porte une seule section « Projets », une entrée par projet.
8. Un projet est une seule page : un en-tête pleine largeur, puis les étapes en onglets, et les versions d'une étape en sous-onglets.
9. La description de l'en-tête est le résumé du projet Linear, réécrit pour le client.
10. Une étape sans document garde son onglet, grisé. L'audit n'a d'onglet que si le projet en a un.
11. Les fichiers déposés disparaissent, table en base comprise.
12. La section « Projets » actuelle (Actifs, Terminés, Documents) disparaît.
13. Le chantier se fait sur la branche du sous-projet 1, une seule recette, une seule fusion.

## 3. La barre, workspace par workspace

| Workspace | Sections, dans l'ordre |
|---|---|
| Client, et workspaces perso autres que Coolbeans | Bienvenue, Projets, Mon site, Mode d'emploi, Aide |
| Coolbeans | Bienvenue, Projets, Mon site, Mode d'emploi, Admin |

- Le workspace Coolbeans se reconnaît à son slug, `coolbeans`.
- Admin est visible quand le compte est admin et que le workspace courant est Coolbeans. Jamais ailleurs.
- L'Aide est absente du workspace Coolbeans. Ses pages restent joignables par leur adresse. Demandes vit dans l'Aide depuis le 2026-09-30 : elle disparaît aussi de la barre de Coolbeans.
- Projets porte une entrée par projet de la sous-team, libellée du nom du projet Linear, dans l'ordre du §4.1. La section disparaît quand le workspace n'a aucun projet.
- Le revendeur voit ce que voit le client, dans les workspaces de son organisation.
- Les règles de visibilité page par page ne changent pas : flag `live` ou `wip`, mapping du client, badge admin.

### 3.1 Une page admin fait basculer sur Coolbeans

Toutes les pages de la section Admin posent le cookie de workspace sur `coolbeans` et appellent `overrideCurrentWorkspace`. La doc applique déjà ce mécanisme, dans `src/pages/docs/[client]/[...slug].astro`.

Pages concernées : `/admin`, `/admin/relances`, `/clients`, `/utilisateurs`, `/devis`, `/devis/reglages`. `/chiffrages` et `/chiffrages/reglages` redirigent déjà vers `/devis` : la bascule s'y fait à l'arrivée.

Sans cette bascule, l'admin qui ouvre `/devis` depuis Amusoire verrait le cockpit des devis sous la barre d'Amusoire, sans section Admin.

## 4. Les projets

### 4.1 La source

Chaque workspace naît avec sa sous-team Linear, dont la fiche garde l'identifiant (`linearTeamId`). Chaque workspace affiche les projets de sa sous-team, sans exception : clients, Coolbeans, Spinoza, Tielle & Popcorn. Au 2026-09-30, Coolbeans en compte huit, Tielle & Popcorn deux, Spinoza un.

Une fiche sans sous-team n'affiche aucun projet. Au 2026-09-30, deux fiches sont dans ce cas : dupontdupont et merciyanis.

La requête lit les projets de la sous-team, sans les archivés ni les annulés (statut de type `canceled`).

Elle ne lit que ces champs : identifiant, nom, résumé, statut (nom et type), date de début, date de fin, date de mise à jour, adresse. Jamais la description : elle porte le brief interne et les liens vers le CRM (constaté le 2026-09-30 sur le Salon et sur CAFA).

L'ordre suit trois groupes :

1. en cours : statuts de type `started` et `paused` ;
2. à venir : `planned` et `backlog`, dont Proposal ;
3. terminés : `completed`.

Dans chaque groupe, le projet modifié le plus récemment vient en tête.

### 4.2 L'adresse d'un projet

`/projets/<slug>`, où `<slug>` est le dernier segment de l'adresse Linear du projet : son nom en minuscules suivi de son identifiant court. Exemple : `/projets/site-du-salon-edition-2026-e6c1e495a56f`.

La page retrouve le projet par l'identifiant court, les douze derniers caractères. Si le nom a changé dans Linear, l'ancienne adresse redirige vers la nouvelle.

### 4.3 Le lien entre un document et son projet

La table `PROJETS` de `src/lib/documents/nomenclature.ts` associe aujourd'hui un slug à une clé client. Elle associe désormais un slug à `{ client, linear }`, où `linear` est l'identifiant court du projet Linear (`slugId`, les douze caractères qui terminent son adresse). L'identifiant court, et non l'UUID, parce qu'il sert aussi à retrouver la page d'un projet quand Linear ne répond pas (§4.4).

Le build échoue si une entrée n'a pas d'identifiant, ou si deux entrées portent le même.

Le slug de la table reste l'identité du projet dans le champ `projet` des documents. Il ne sert plus d'adresse.

Un document se range sous le projet Linear dont l'identifiant est celui de son `projet`. Un document dont le projet est absent de la liste Linear (projet annulé ou d'une autre sous-team) n'a pas de page.

### 4.4 La lecture de Linear

- Linear est lu au plus une fois toutes les 10 minutes par sous-team. Le résultat se garde dans le cache du Worker (`caches.default`), sous une clé propre à la sous-team.
- Le KV est écarté : son quota gratuit de 1 000 écritures par jour tomberait dès sept workspaces consultés en continu.
- Un appel à Linear abandonne au bout de 2 secondes.
- En cas d'échec (clé absente, délai dépassé, erreur Linear), la barre et les pages s'appuient sur les documents seuls : un projet par slug de la table qui a un document lisible, titré par le titre de projet de ses documents, sans résumé, statut ni dates. L'échec se garde 60 secondes, pour qu'une panne de Linear ne ralentisse pas chaque page.
- Une page ne casse jamais à cause de Linear.
- Coût par page : au plus un appel à Linear. Le plafond de 50 sous-requêtes du plan gratuit reste loin.
- La clé est `LINEAR_API_KEY`, déjà posée pour les demandes, en prod comme en staging. Lire les projets ne demande aucun droit de plus.

## 5. La page projet

Une seule page HTML par projet. Elle remplace la route du sous-projet 1, `/projets/<projet>/<étape>`, qui n'a jamais été en prod.

### 5.1 L'en-tête

Une section qui prend toute la largeur de son conteneur. Elle porte :

- le titre : le nom du projet Linear ;
- la description : le résumé du projet Linear, tel quel. Résumé vide, rien ne s'affiche ;
- le statut, traduit pour le client : Proposal donne « Proposition », Backlog « À venir », Planned « Planifié », In Progress « En cours », Paused « En pause », Completed « Terminé ». Un statut inconnu s'affiche d'après son type ;
- les dates de début et de fin, seulement quand le projet est validé, c'est-à-dire que son statut est de type `planned`, `started`, `paused` ou `completed`. Une date absente dans Linear ne s'affiche pas.

### 5.2 Les onglets d'étape

- Un onglet par étape, dans l'ordre : Audit, Cadrage, Proposition, Production, Livraison, Suivi. L'audit n'a d'onglet que si le projet a un audit lisible par le compte.
- Une étape sans document lisible par le compte a son onglet grisé, sans clic. Un brouillon que le client ne lit pas compte comme absent : l'onglet ne trahit pas son existence.
- L'onglet ouvert à l'arrivée est celui du document le plus récent. Un projet sans document n'a aucun onglet ouvert : l'en-tête et les onglets grisés suffisent.
- L'adresse désigne l'onglet : `?etape=proposition`. Changer d'onglet met l'adresse à jour sans recharger la page. Un lien reçu par mail ouvre donc la bonne étape.
- Les onglets remplacent la frise dans le portail. Les pages publiques gardent la leur jusqu'au sous-projet 6.

### 5.3 Les sous-onglets de version

- Une étape porte un document et ses versions (champ `versionDe`). Les versions sont des sous-onglets, comme les propositions d'aujourd'hui.
- La version ouverte à l'arrivée est la plus récente. L'adresse la désigne : `?etape=proposition&version=<id>`.
- Une étape sans autre version n'affiche pas de sous-onglet.

### 5.4 Ce que la page envoie

- Le serveur ne rend que les documents que le compte lit. Un document refusé n'atteint jamais le navigateur, même caché.
- Les règles d'accès (`lecture`) et les bandeaux restent ceux du sous-projet 1. L'admin lit les brouillons sous leur bandeau, dans leur onglet.
- Un projet hors de la portée du compte, ou inconnu, répond 404.
- L'impression ne sort que l'onglet ouvert, sans la barre ni l'en-tête du portail.

### 5.5 L'avancement (ajout du 2026-10-01)

Un bloc « Avancement » se place entre l'en-tête et les onglets d'étape. Décision de Ludo du 2026-10-01.

- Il liste les issues du projet Linear, rangées par jalon dans l'ordre de leurs dates, les issues sans jalon à la fin.
- Chaque issue montre son titre, son état traduit d'après son type (Backlog « À venir », Todo « À faire », In Progress et In Review « En cours », Done « Fait ») et son échéance.
- Les issues annulées et celles en Triage ne s'affichent pas. Les issues faites se replient sous leur jalon.
- Un compteur ouvre le bloc : « 7 sur 12 faites ».
- Jamais lus : la description, les commentaires, l'assigné, l'estimate.
- Même lecture que les projets : cache de 10 minutes, abandon à 2 secondes. Linear muet ou projet sans issue visible : le bloc ne s'affiche pas.

### 5.6 La liste des projets (ajout du 2026-10-02)

- Une entrée « Tous » ouvre la section Projets de la barre. Elle ne s'allume que sur la liste, pas sur la page d'un projet.
- La page `/projets` reprend les projets de la barre, dans le même ordre, en tableau : le nom (lien vers sa page), le statut en couleur, une jauge verte (issues faites sur issues visibles, comme le bloc Avancement), les dates de début et de fin une fois le projet validé.
- Le bloc Avancement de la page projet suit la largeur des documents (880 px) et sa barre passe au même vert.

### 5.7 Les packs d'heures (ajout du 2026-10-02)

- Un projet Linear qui porte le label de projet « Pack d'heures » est un pack. Sa page remplace le bloc Avancement par « Heures du pack ».
- Le total vient de la proposition validée : chaque ligne de pack porte `heures` (10, 20, 40), et le portail lit le pack retenu dans `devis_reponses`. Proposition pas encore validée : « Pack en attente de validation », sans jauge.
- Les heures sortent du pack au go du client : la somme des estimates des demandes acceptées (Todo), en cours et faites. La jauge verte montre les heures restantes ; un dépassement s'affiche.
- Statuts lus par le client : Triage « À chiffrer », Chiffrée « Chiffrée, attend ton accord », Todo « Acceptée », In Progress et In Review « En cours », Done « Faite », Canceled « Non retenue ». Le statut « Chiffrée » (type backlog) est créé dans la team Web, dont héritent les sous-teams clientes.
- Sur un pack, les demandes à chiffrer et les non retenues restent visibles ; faites et non retenues se replient. Chaque demande montre son estimate en heures.
- Une demande faite depuis Demandes, dans un workspace qui a un pack planifié ou en cours, se range dans ce projet Linear (`projectId`), toujours en Triage.
- La liste « Tous » montre les heures restantes d'un pack à la place des issues faites.

## 6. Le mode d'emploi

- La section « Documentation » devient « Mode d'emploi ».
- L'entrée admin « La doc », affichée quand le workspace n'a pas de doc, devient « Mode d'emploi ». Le titre et le texte de `/espace/doc` suivent.
- La description de `DocLayout` passe de « Documentation de passation » à « Mode d'emploi ».
- La section se place après Mon site. Elle reste absente pour un client dont le workspace n'a pas de doc.
- Les adresses `/docs/<client>/…` et la collection `docs` ne changent pas.
- La doc de Coolbeans reste réservée au workspace Coolbeans. C'est déjà le cas : une doc ne s'affiche que dans le workspace dont la fiche la porte.

## 7. Les suppressions

### 7.1 Avec ce chantier

- La section « Projets » actuelle du registre `SECTIONS` (`src/lib/portail/nav.ts`), remplacée par la nouvelle.
- Les pages `src/pages/espace/projets.astro`, `projets/termines.astro` et `projets/documents.astro`.
- La route du sous-projet 1, `src/pages/espace/projets/[projet]/[etape].astro`, et `sectionsProjets`, remplacées par la page projet.
- Les routes `src/pages/api/documents/nouveau.ts`, `visibilite.ts` et `fichier/[id].ts`.
- Le registre des fichiers déposés, `src/lib/portail/documents/` (store, accès, familles et leurs tests), et le composant `ListeDocuments`, avec tout ce que seuls ces fichiers importent.
- Le module `projets` de `src/lib/portail/workspaces.ts`, dont seule la page `projets.astro` se sert.

Le binding de stockage `PORTAL_FILES` reste : la messagerie et les témoignages s'en servent.

### 7.2 Après la mise en prod, sur ordre de Ludo

L'ordre est imposé : tant que la prod tourne l'ancien code, elle lit la table.

1. Le code du §7.1 part en prod.
2. Un script liste, pour la prod puis pour le staging, les fichiers encore enregistrés : client, titre, date. Ludo lit la liste.
3. Sur son ordre, le script supprime ces fichiers du stockage, puis une migration supprime la table (`DROP TABLE documents`).

La migration s'écrit à l'étape 3, pas avant. Posée plus tôt dans `migrations/`, elle partirait avec la première migration appliquée par une autre session.

## 8. Avant la mise en prod

Les résumés Linear s'affichent chez le client. Chaque projet d'une sous-team client reçoit un résumé écrit pour le client, ou un résumé vide. Claude rédige les résumés, Ludo les valide, puis Claude les pose dans Linear.

## 9. Tests

Barre (`nav.test.ts`) :

- admin dans Coolbeans : Admin présente, Aide absente, Projets avec les projets de la sous-team COO ;
- admin dans Amusoire : Admin absente, Aide présente ;
- client : Bienvenue, Projets, Mon site, Mode d'emploi, Aide, dans cet ordre ;
- workspace sans projet : pas de section Projets.

Projets :

- tri en cours, à venir, terminés, puis par date de mise à jour ;
- projets annulés exclus ;
- document rangé par l'identifiant Linear de son projet ;
- adresse retrouvée par l'identifiant court, redirection quand le nom a changé ;
- Linear en échec : projets tirés des documents, sans résumé, statut ni dates.

Page projet :

- statut traduit, dates masquées tant que le projet n'est pas validé ;
- onglet grisé pour une étape sans document, et pour un brouillon côté client ;
- onglet d'audit absent sans audit ;
- onglet ouvert à l'arrivée : le document le plus récent, ou celui de `?etape=` ;
- sous-onglets de version, la plus récente ouverte ;
- le HTML servi au client ne contient aucun document qu'il ne lit pas ;
- 404 hors de portée.

Nomenclature : le build échoue sur un identifiant Linear absent ou en double.

Bascule admin : `/devis` ouvert avec le cookie `amusoire` affiche la barre de Coolbeans.

Recette locale avec `npm run comptes-locaux` : admin dans Coolbeans puis dans Amusoire, revendeur, client-amusoire, client-cafa.

## 10. Doc du portail

`src/content/docs/coolbeans/04-portail.mdx` décrit la nouvelle barre et la page projet, et remplace « Documentation » par « Mode d'emploi ».

## 11. Hors périmètre

- Afficher des issues autre chose que le §5.5 : description, commentaires, assigné, estimate.
- Changer les adresses `/docs`.
- Les pages publiques des documents : elles basculent au sous-projet 6.
- Les sous-projets 2 à 6 de la spec du 2026-09-30. Leurs liens visent désormais la page projet et son onglet.
