# Barre latérale du portail : par workspace, par projet Linear

- Date : 2026-09-30
- Statut : conception validée en conversation, spec à relire par Ludo
- Branche : `feat/documents-portail` (worktree `~/dev/coolbeans-documents-portail`), à la suite du sous-projet 1
- Complète : `2026-09-30-documents-prives-workspace-design.md` (sous-projet 1, les documents dans le workspace)

## 1. Pourquoi

La barre latérale range deux contenus sous la même racine. « Documentation » porte la doc de passation, « Documents » portait les fichiers déposés, et les documents du cycle arrivent avec le sous-projet 1. Ils ne répondent pas au même besoin.

La section Admin s'affiche dans tous les workspaces. L'Aide s'affiche dans celui de Coolbeans, où elle ne sert à rien.

Les sections de projet du sous-projet 1 naissent des documents : un projet Linear sans document n'existe pas dans le portail.

## 2. Arbitrages de Ludo (2026-09-30)

1. La section Admin n'apparaît que dans le workspace Coolbeans.
2. Le workspace Coolbeans n'affiche pas l'Aide.
3. La doc interne de Coolbeans ne vit que dans le workspace Coolbeans.
4. Il reste deux contenus : les documents d'un projet (audit, cadrage, proposition, production, livraison, suivi) et la documentation du client, qui devient « Mode d'emploi ».
5. Le mode d'emploi appartient au workspace, pas à un projet : un projet n'est pas forcément un site.
6. Un projet du portail est un projet Linear. Tous les projets Linear de la team du client apparaissent, même sans document.
7. Les fichiers déposés disparaissent, table en base comprise.
8. La section « Projets » (Actifs, Terminés, Documents) disparaît.
9. Le chantier se fait sur la branche du sous-projet 1, une seule recette, une seule fusion.

## 3. La barre, workspace par workspace

| Workspace | Sections, dans l'ordre |
|---|---|
| Client, direct ou chez un revendeur, et autres workspaces perso | Bienvenue, une section par projet, Mon site, Mode d'emploi, Aide |
| Coolbeans | Bienvenue, une section par projet, Mon site, Mode d'emploi, Admin |

Les projets viennent juste après Bienvenue : les documents du projet en cours sont ce que le client vient chercher.

- Le workspace Coolbeans se reconnaît à son slug, `coolbeans`.
- Admin est visible quand le compte est admin et que le workspace courant est Coolbeans. Jamais ailleurs.
- L'Aide est absente du workspace Coolbeans. Ses pages restent joignables par leur adresse.
- Tous les workspaces ont leurs sections de projet, Coolbeans et les workspaces perso compris (§4.1).
- Le revendeur voit ce que voit le client, dans les workspaces de son organisation.
- Les règles de visibilité page par page ne changent pas : flag `live` ou `wip`, mapping du client, badge admin.

### 3.1 Une page admin fait basculer sur Coolbeans

Toutes les pages de la section Admin posent le cookie de workspace sur `coolbeans` et appellent `overrideCurrentWorkspace`. La doc applique déjà ce mécanisme, dans `src/pages/docs/[client]/[...slug].astro`.

Pages concernées : `/admin`, `/admin/relances`, `/clients`, `/utilisateurs`, `/devis`, `/devis/reglages`, `/chiffrages`, `/chiffrages/reglages`.

Sans cette bascule, l'admin qui ouvre `/devis` depuis Amusoire verrait le cockpit des devis sous la barre d'Amusoire, sans section Admin.

## 4. Les projets

### 4.1 La source

La liste des projets d'un workspace vient de la team Linear de sa fiche client (`linearTeamId`).

Chaque workspace naît avec sa sous-team Linear, dont la fiche garde l'identifiant (`linearTeamId`). Chaque workspace affiche les projets de sa sous-team, sans exception : clients, Coolbeans, Spinoza, Tielle & Popcorn. Au 2026-09-30, Coolbeans en affiche huit, Tielle & Popcorn deux, Spinoza un.

Une fiche client sans sous-team n'affiche aucun projet. Au 2026-09-30, deux fiches sont dans ce cas : dupontdupont et merciyanis.

La requête lit les projets de la team, sans les archivés ni les annulés (statut de type `canceled`). Elle ne lit que quatre champs : identifiant, nom, type de statut, date de mise à jour. Jamais la description, les membres ni les issues : même liste blanche que le filtre client de la spec du portail (§4.5).

L'ordre suit trois groupes :

1. en cours : statuts de type `started` et `paused` ;
2. à venir : `planned` et `backlog`, dont Proposal ;
3. terminés : `completed`.

Dans chaque groupe, le projet modifié le plus récemment vient en tête.

Le titre de la section est le nom du projet Linear, tel quel. Les noms relevés le 2026-09-30 se lisent côté client : « Site web CAFA », « Site du salon, édition 2026 », « Site de l'association Rev'Olutions Douces ». Un nom interne se lira chez le client : c'est dans Linear qu'on le corrige.

### 4.2 Le lien entre un document et son projet

La table `PROJETS` de `src/lib/documents/nomenclature.ts` associe aujourd'hui un slug à une clé client. Elle associe désormais un slug à `{ client, linear }`, où `linear` est l'identifiant (UUID) du projet Linear.

Le build échoue si une entrée n'a pas d'identifiant, ou si deux entrées portent le même.

Le slug reste le segment d'adresse : `/projets/salon-533/proposition` ne change pas.

Un document se range sous le projet Linear dont l'identifiant est celui de son `projet`.

### 4.3 Le contenu d'une section

- Une entrée par document que le compte lit, libellée `N · Étape`, dans l'ordre de la frise, comme au sous-projet 1.
- Un projet sans document lisible par le compte affiche une ligne grise et non cliquable : « Aucun document pour l'instant ».
- Un document dont le projet est absent de la liste Linear (projet annulé ou d'une autre team) n'apparaît pas dans la barre. Sa page reste lisible par son adresse, selon les règles d'accès du sous-projet 1.

### 4.4 La lecture de Linear

- Linear est lu au plus une fois toutes les 10 minutes par team. Le résultat se garde dans le cache du Worker (`caches.default`), sous une clé propre à la team.
- Le KV est écarté : son quota gratuit de 1 000 écritures par jour tomberait dès sept workspaces consultés en continu.
- Un appel à Linear abandonne au bout de 2 secondes.
- En cas d'échec (clé absente, délai dépassé, erreur Linear), la barre affiche les sections tirées des documents, exactement comme au sous-projet 1. L'échec se garde 60 secondes, pour qu'une panne de Linear ne ralentisse pas chaque page.
- Une page ne casse jamais à cause de Linear.
- Coût par page : au plus un appel à Linear. Le plafond de 50 sous-requêtes du plan gratuit reste loin.
- La clé est `LINEAR_API_KEY`, déjà posée pour les demandes, en prod comme en staging. Lire les projets ne demande aucun droit de plus.

### 4.5 Ce qui ne change pas

Les règles d'accès (`lecture`), la route `/projets/<projet>/<étape>`, les bandeaux et la frise restent ceux du sous-projet 1.

La barre ne contrôle aucun accès. Masquer un projet ne protège rien : c'est la route qui refuse.

## 5. Le mode d'emploi

- La section « Documentation » devient « Mode d'emploi ».
- L'entrée admin « La doc », affichée quand le workspace n'a pas de doc, devient « Mode d'emploi ». Le titre et le texte de `/espace/doc` suivent.
- La description de `DocLayout` passe de « Documentation de passation » à « Mode d'emploi ».
- La section se place après Mon site. Elle reste absente pour un client dont le workspace n'a pas de doc.
- Les adresses `/docs/<client>/…` et la collection `docs` ne changent pas.
- La doc de Coolbeans reste réservée au workspace Coolbeans. C'est déjà le cas : une doc ne s'affiche que dans le workspace dont la fiche la porte.

## 6. Les suppressions

### 6.1 Avec ce chantier

- La section « Projets » du registre `SECTIONS` (`src/lib/portail/nav.ts`).
- Les pages `src/pages/espace/projets.astro`, `projets/termines.astro` et `projets/documents.astro`.
- Les routes `src/pages/api/documents/nouveau.ts`, `visibilite.ts` et `fichier/[id].ts`.
- Le registre des fichiers déposés, `src/lib/portail/documents/` (store, accès, familles et leurs tests), et le composant `ListeDocuments`, avec tout ce que seuls ces fichiers importent.
- Le module `projets` de `src/lib/portail/workspaces.ts`, dont seule la page `projets.astro` se sert.

Le binding de stockage `PORTAL_FILES` reste : la messagerie et les témoignages s'en servent.

### 6.2 Après la mise en prod, sur ordre de Ludo

L'ordre est imposé : tant que la prod tourne l'ancien code, elle lit la table.

1. Le code du §6.1 part en prod.
2. Un script liste, pour la prod puis pour le staging, les fichiers encore enregistrés : client, titre, date. Ludo lit la liste.
3. Sur son ordre, le script supprime ces fichiers du stockage, puis une migration supprime la table (`DROP TABLE documents`).

La migration s'écrit à l'étape 3, pas avant. Posée plus tôt dans `migrations/`, elle partirait avec la première migration appliquée par une autre session.

## 7. Tests

Barre (`nav.test.ts`) :

- admin dans Coolbeans : Admin présente, Aide absente, sections des projets de la team COO ;
- workspace perso (Spinoza) : sections des projets de sa sous-team ;
- admin dans Amusoire : Admin absente, Aide présente ;
- client : Bienvenue, projets, Mon site, Mode d'emploi, Aide, dans cet ordre ;
- projet sans document : une ligne grise, sans lien.

Projets :

- tri en cours, à venir, terminés, puis par date de mise à jour ;
- projets annulés exclus ;
- document rangé par l'identifiant Linear de son projet ;
- document d'un projet absent de la liste : absent de la barre ;
- Linear en échec : sections tirées des documents, comme au sous-projet 1.

Nomenclature : le build échoue sur un identifiant Linear absent ou en double.

Bascule admin : `/devis` ouvert avec le cookie `amusoire` affiche la barre de Coolbeans.

Recette locale avec `npm run comptes-locaux` : admin dans Coolbeans puis dans Amusoire, revendeur, client-amusoire, client-cafa.

## 8. Doc du portail

`src/content/docs/coolbeans/04-portail.mdx` décrit la nouvelle barre et remplace « Documentation » par « Mode d'emploi ».

## 9. Hors périmètre

- Afficher du projet Linear autre chose que son nom : avancement, jalons, dates.
- Changer les adresses `/docs`.
- Les sous-projets 2 à 6 de la spec du 2026-09-30, inchangés.
