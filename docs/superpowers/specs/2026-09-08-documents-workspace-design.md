# Documents du workspace client

> Statut : validé par Ludo le 2026-09-08. Issue : COO-70.
> Remplace le périmètre décrit dans la section 3.9 de
> `2026-08-17-portail-client-strategie-produit.md`, qui est amendée par ce document.

## 1. Ce qu'on construit

Une page `Documents` dans le workspace de chaque client, qui rassemble en une
seule liste tout ce que Coolbeans partage avec lui : cadrages, propositions
commerciales, devis Tiime, factures, contrats, logos, images optimisées, brand
book, comptes rendus de réunion.

Un document n'est visible par le client que lorsque Ludo l'a décidé, document
par document, en un clic.

## 2. La décision structurante

Trois natures de documents cohabitent, et elles n'ont pas le même support :

- un **fichier** déposé par Ludo, stocké dans R2 (PDF, image, archive) ;
- une **page** du site, produite depuis le repo (cadrage, proposition) ;
- un **lien** externe (Google Docs, compte rendu Granola).

La tentation était de dériver la visibilité des pages depuis leur contenu,
par exemple une date d'envoi lue dans le YAML. Écarté : basculer un document
demanderait alors un commit et un déploiement, alors que Ludo veut un clic. Et
une date d'envoi est une déduction, pas une décision.

**D1 devient donc le registre de tout.** Une ligne par document, quelle que
soit sa nature. Le contenu n'est jamais dupliqué : une ligne `page` ou `lien`
ne stocke qu'une URL. Ce que la base stocke, c'est la décision de montrer.

## 3. Modèle de données

Migration `0008_documents.sql`, dans la continuité des sept précédentes.

```sql
CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  client       TEXT NOT NULL,           -- slug du workspace
  titre        TEXT NOT NULL,           -- nom affiché, cf. ci-dessous
  source       TEXT NOT NULL,           -- 'fichier' | 'page' | 'lien'
  r2_key       TEXT,                    -- source 'fichier' uniquement
  url          TEXT,                    -- sources 'page' et 'lien'
  mime         TEXT,                    -- source 'fichier' uniquement
  taille       INTEGER,                 -- octets, source 'fichier'
  date_doc     TEXT NOT NULL,           -- date affichée et clé de tri
  visible      INTEGER NOT NULL DEFAULT 0,
  cree_le      TEXT NOT NULL,
  cle_source   TEXT                     -- identité stable d'une page du repo
);

CREATE INDEX documents_client_date ON documents (client, date_doc DESC);
CREATE UNIQUE INDEX documents_cle_source ON documents (client, cle_source)
  WHERE cle_source IS NOT NULL;
```

`visible` vaut 0 par défaut. C'est l'invariant central : rien n'est montré
sans un geste explicite.

`titre` vient du champ `titre` du YAML pour une page, et du nom du fichier
déposé pour un fichier, modifiable au moment du dépôt. `date_doc` vient du
champ `date` du YAML pour une page, et de la date de dépôt pour un fichier ou
un lien.

La famille de picto n'est pas stockée : elle se calcule au rendu à partir du
MIME ou de l'hôte de l'URL. Une colonne l'aurait figée le jour où la fonction
apprend un nouveau service.

`cle_source` porte le chemin du fichier YAML dans le repo, par exemple
`cadrage/setencorpsmieux/reservation-en-ligne-5138`. L'index unique partiel
garantit qu'une page du repo ne produit jamais deux lignes, même si
l'enregistrement automatique tourne cent fois.

L'accès se fait par un store `src/lib/portail/documents/store.ts`, au même
patron que la messagerie : une fonction égale une requête, le binding D1 passé
en argument, donc testable sans Cloudflare.

## 4. Enregistrement automatique des pages du repo

Quand Ludo ouvre la page `Documents` d'un client en vue admin, le serveur
compare les entrées des collections `cadrage` et `devis` dont le chemin
commence par le slug de ce client aux lignes déjà présentes. Les manquantes
sont insérées, **masquées**.

Idempotent, sans cron ni webhook, et le coût est une requête par rendu de la
vue admin. La vue client ne déclenche jamais cet enregistrement : elle lit,
elle n'écrit pas.

Conséquence voulue : une proposition publiée mais pas encore envoyée existe
dans le registre et reste invisible. Le cas s'est produit le 2026-09-08 avec le
cadrage de Nathalie Givois, publié en production et jamais envoyé.

Un document retiré du repo garde sa ligne. Elle est signalée comme orpheline
en vue admin plutôt que supprimée en silence, parce qu'une suppression
silencieuse ferait disparaître un document que le client voyait la veille.

## 5. Visibilité

**Deux vues, une seule requête différente.**

- Rôle `admin` : toutes les lignes du client courant.
- Rôles `client` et `revendeur` : `WHERE visible = 1`, filtré en SQL.

Le filtre vit dans la requête, jamais dans le rendu. Une ligne masquée ne doit
pas atteindre le navigateur d'un client, même cachée en CSS.

**Le même contrôle s'applique à la route qui sert les fichiers.** Sans lui, un
client qui connaît un identifiant récupère un document masqué. C'est le piège
principal de cette fonctionnalité, et il se teste.

**Signalétique.** Une pastille `Masqué` sur les seules lignes invisibles, la
ligne en gris atténué. Rien sur les lignes visibles. L'œil doit accrocher
l'exception : si toutes les lignes portent un badge, plus aucune ne se
remarque.

**Bascule.** Un bouton texte sobre en fin de ligne, rendu pour le seul rôle
admin : `Rendre visible` sur une ligne masquée, `Masquer` sur une ligne
visible. Un clic, effet immédiat, retour à l'état précédent si l'appel échoue.
Il poste vers `/api/documents/visibilite`, qui vérifie le rôle admin et
l'appartenance du document au client courant.

Ludo peut aussi demander la bascule à Claude, qui l'applique directement en
base avec `wrangler d1 execute`.

## 6. Interface

Liste verticale à plat, du plus récent au plus ancien, sans regroupement ni
dossier. Décision de Ludo, prise en connaissance de la limite : la lecture se
dégrade au delà d'une trentaine d'entrées, et le sujet se rouvrira à ce
moment.

Une ligne porte, de gauche à droite : le picto de la famille, le **nom du
document** en corps de texte principal, puis le type et la date en gris. Toute
la ligne est cliquable et ouvre dans un nouvel onglet (`target="_blank"`,
`rel="noopener"`). En vue admin, la pastille et le bouton de bascule ferment la
ligne.

**Pictos.** Des logos reconnaissables, pas des glyphes génériques : Google
Docs, Granola, PDF, image, archive, page web Coolbeans, lien externe. Ils sont
embarqués en SVG inline dans `src/components/portail/pictos/`, choisis par une
fonction pure `familleDocument()` qui prend le MIME ou l'hôte de l'URL.

Aucune favicon n'est chargée depuis un serveur tiers. Deux raisons : cela
signalerait à Google et à Granola quel client consulte quel document, et une
icône manquante casserait la page le jour où le service change d'URL.

## 7. Sécurité

La route `/api/documents/fichier/[id]` reprend le patron déjà éprouvé par
`/api/messagerie/fichier/[id]` : session vérifiée, appartenance du document au
client courant vérifiée, allowlist de MIME pour l'affichage inline, et
téléchargement forcé avec `application/octet-stream` pour tout le reste. Le
risque est le même, un XSS stocké servi depuis l'origine qui porte le cookie de
session, et il est déjà traité à cet endroit.

Ce patron remplace les **liens R2 signés à durée de vie limitée** que
prévoyaient la section 4.4 de la spec produit et le recadrage de COO-70. La
protection obtenue est équivalente, et c'est un mécanisme de moins à écrire et
à maintenir. Un lien signé aurait par ailleurs le défaut d'échapper au contrôle
de visibilité une fois émis.

Aucun identifiant ni secret ne se dépose ici. La règle de la spec produit ne
change pas.

## 8. Périmètre

Dans la version 1 :

- la page, en vue client et en vue admin ;
- le registre D1 et l'enregistrement automatique des pages du repo ;
- le dépôt de fichiers depuis la vue admin, vers R2 ;
- l'ajout d'un lien externe depuis la vue admin ;
- la bascule de visibilité ;
- le service des fichiers.

Hors version 1 : le versionnage (COO-89), les dossiers, la recherche, le
filtrage par type, et toute notification automatique.

## 9. Notifications : ce qui change

La spec produit prévoyait une notification différée de quinze minutes,
groupée, envoyée au client après un ajout de documents. **Ludo l'a annulée le
2026-09-08 :** il préviendra ses clients lui-même, depuis Gmail, quand il aura
mis à jour leur workspace.

Ce n'est pas un report. COO-90 est à annuler, pas à déplacer. La section 3.9 de
la spec produit et son critère d'acceptation sur le débounce sont amendés en
conséquence.

## 10. Code touché

- `migrations/0008_documents.sql` : nouveau.
- `src/lib/portail/documents/store.ts` : nouveau, accès D1.
- `src/lib/portail/documents/familles.ts` : nouveau, fonction pure de choix du
  picto, testable seule.
- `src/lib/portail/documents/sync.ts` : nouveau, enregistrement des pages du
  repo.
- `src/pages/espace/projets/documents.astro` : la souche devient la page.
- `src/pages/api/documents/nouveau.ts`, `visibilite.ts`, `fichier/[id].ts` :
  nouveaux.
- `src/components/portail/ListeDocuments.tsx` : île Preact, pour la bascule
  optimiste.
- `src/components/portail/pictos/` : SVG inline.
- `src/lib/portail/nav.ts` : retrait du drapeau `wip` sur l'entrée Documents.

## 11. Tests

- `familles.ts` : table de correspondance MIME et hôte vers famille, cas non
  reconnu compris.
- `sync.ts` : deux passages consécutifs ne créent qu'une ligne ; une page
  retirée du repo laisse sa ligne en place.
- Requête de liste : un rôle client ne reçoit aucune ligne masquée.
- Route fichier : un rôle client reçoit 404 sur un document masqué, et sur un
  document appartenant à un autre client.

Les deux derniers sont les tests qui comptent. Le reste du module peut casser
sans conséquence grave, ces deux là fuient des documents.
