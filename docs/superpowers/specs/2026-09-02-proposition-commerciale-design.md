# Proposition commerciale et devis Tiime — séparer deux documents que le vocabulaire confondait

**Date** : 2026-09-02
**Statut** : lot A livré, lot B à valider
**Demande** : « ajouter une étape supplémentaire au pipeline CRM : proposition
commerciale envoyée, proposition commerciale validée — et ensuite seulement je
génère le devis Tiime et la facture d'acompte, et j'envoie le mail avec les
trois docs. »

## Le problème

Un seul mot, `devis`, désignait deux documents qui n'ont ni le même auteur, ni
le même moment, ni la même valeur juridique :

- la **proposition commerciale** — la page publiée par Coolbeans, qui vend le
  résultat, porte le périmètre et se valide par formulaire ;
- le **devis** — le document comptable émis dans Tiime, avec sa facture
  d'acompte.

La confusion avait une conséquence mesurable dans le pipeline : entre
`📝 Devis envoyé` et `🏆 Signée`, rien. Un client qui validait le formulaire
n'avait pas de colonne, alors que c'est précisément la fenêtre où une affaire
se perd — elle attend des documents que personne ne s'est vu demander
d'émettre. La skill `devis` documentait déjà le trou et interdisait de le
combler seule.

Pire, le code aggravait la confusion : `signature.ts` passait l'affaire
directement en `🏆 Signée` à la validation du formulaire, contredisant la règle
posée le 2026-09-01 (**signée = validation ET acompte**). Le pipeline comptait
comme acquis un encaissement qui n'avait pas eu lieu.

## Lot A — le pipeline (livré)

### Linear

| Geste | Détail |
|---|---|
| Renommage | `📝 Devis envoyé` → `📝 Proposition envoyée` (id inchangé, aucune issue déplacée) |
| Création | `✍️ Proposition validée`, type `started`, position `1500`, couleur `#f2994a` |
| Gabarit `🧬 Opportunité` | check-list passée de 14 à 16 étapes, alignée sur la doc de vente |

Le pipeline compte désormais **14 statuts, dont 11 colonnes d'affaires**.

La position `1500` s'insère entre `📝 Proposition envoyée` (1000) et
`🏆 Signée` (5500). Le cockpit trie sur `state.position`, il suit donc sans
modification.

L'orange `#f2994a` n'est pas décoratif : entre le jaune de l'attente et le vert
de l'encaissement, il dit « une action est due de ton côté ».

> **Piège rencontré.** `templateUpdate` attend `descriptionData` en **objet**.
> Sérialisé en chaîne, Linear l'accepte sans erreur puis l'enveloppe dans un
> `unsupported_block_node` — le gabarit devient illisible dans l'éditeur. Le
> document d'origine reste récupérable dans `attrs.originalNodeData`.

### Automatisme

À la validation du formulaire, `declencherSignature` fait trois choses, dans
cet ordre : crée la sous-tâche, l'accroche en D1, puis déplace l'affaire.

L'état d'arrivée passe de `Signée` à **`Proposition validée`**. Le passage en
`🏆 Signée` reste manuel : sans API Tiime (réservée aux éditeurs de logiciels)
ni webhook bancaire, rien ne peut constater un encaissement à la place de Ludo.
La dernière case de la sous-tâche porte ce rappel.

La sous-tâche s'appelle désormais `Devis et acompte — <titre>` et porte cinq
cases :

1. Créer ou vérifier le client dans Tiime
2. Émettre le devis dans Tiime, au périmètre exact de la proposition validée
3. Émettre la facture d'acompte
4. Envoyer **un seul mail** au client avec les trois documents : proposition
   validée, devis, facture d'acompte
5. À l'encaissement : passer l'affaire en `🏆 Signée`

Un test verrouille l'invariant : `changerEtatAffaire` ne reçoit jamais `Signée`
sur la seule validation du formulaire.

### Fichiers touchés

`src/data/sop.ts` (colonnes, S5 à S8), `src/content/docs/coolbeans/02-vente.mdx`,
`src/lib/devis/signature.ts` et son test, `src/lib/devis/reponses.ts`,
`src/lib/portail/linear-crm.ts` et son test, `src/lib/devis/cockpit.test.ts`,
`src/pages/api/devis-reponse.ts`.

Skills : `devis` (table des statuts, trou comblé), `linear` (SKILL + taxonomie),
`shutdown` (rang 2 du tri), `onboarding-client` (garde-fou : validée ≠ prête à
démarrer).

### Deux dérives corrigées au passage

- Le gabarit Linear demandait de « créer l'utilisateur Clerk », abandonné
  depuis la migration Better Auth du 2026-08-29.
- La doc de vente décrivait l'envoi du devis comme un mail Resend automatique,
  alors que la règle du 2026-09-01 impose que Ludo envoie à la main.

## Lot B — le renommage (à valider)

Décision de Ludo : renommer intégralement, URL comprises, avec des 301 pour que
les liens déjà envoyés continuent de résoudre. 96 fichiers portent le mot.

### Ce qui change

| Aujourd'hui | Après |
|---|---|
| `/devis/<client>/<projet>` | `/proposition/<client>/<projet>` |
| `src/content/devis/` | `src/content/propositions/` |
| `src/pages/devis/[...slug].astro` | `src/pages/proposition/[...slug].astro` |
| `src/pages/api/devis-reponse.ts` | `src/pages/api/proposition-reponse.ts` |
| `src/lib/devis.ts`, `src/lib/devis/` | `src/lib/proposition.ts`, `src/lib/proposition/` |
| `src/components/devis/` | `src/components/proposition/` |
| `src/emails/devis-confirmation.ts` | `src/emails/proposition-confirmation.ts` |
| `/espace/devis` et `/espace/devis/reglages` | `/espace/propositions`, `/espace/propositions/reglages` |
| `my.coolbeans.cc/devis` | `my.coolbeans.cc/propositions` |
| table D1 `devis_reponses` | `proposition_reponses` |

### Ce qui ne change pas

- **`devis@coolbeans.cc`** : boîte Google Workspace, hors code. La renommer
  casserait la réception des validations déjà en circulation. Un alias
  `proposition@` pourra s'ajouter plus tard, sans rien retirer.
- **Le mot « devis » là où il désigne le document Tiime** — et il en désigne
  désormais un vrai. Le renommage est ciblé, pas un `sed` global : chaque
  occurrence se relit.
- **Les specs archivées** (`docs/superpowers/specs/`, `archive/`) : ce sont des
  décisions datées, les réécrire falsifierait l'historique.

### Les redirections

Douze propositions sont publiées, dont plusieurs sont chez des clients — CAFA V2
est partie hier. Un lien mort dans un mail commercial est un incident.

Redirection dans `astro.config.mjs`, où Astro rend un 301 par défaut :

```js
redirects: {
  "/devis/[...slug]": "/proposition/[...slug]",
  "/espace/devis": "/espace/propositions",
  "/espace/devis/reglages": "/espace/propositions/reglages",
}
```

Le catch-all couvre les deux formes d'URL qui cohabitent — un segment
(`/devis/en-haut`, convention d'avant) et deux (`/devis/cafa/site-web-8791`).

Sur `my.coolbeans.cc`, la réécriture d'hôte vit dans `src/worker.ts` et ne voit
que le chemin après `/espace` : la redirection Astro s'applique donc aussi au
portail, mais **à vérifier explicitement en staging** — le Worker s'exécute
avant les assets (`run_worker_first`), l'ordre des deux couches n'est pas
évident sur le papier.

Ces redirections restent **définitivement** : aucun coût à les garder, et un
devis de 2026 peut être rouvert depuis un vieux mail en 2028.

### La migration D1

```sql
-- migrations/0008_proposition_reponses.sql
ALTER TABLE devis_reponses RENAME TO proposition_reponses;
```

Le numéro `0007` est pris par `0007_devis_options.sql` (périmètre composé,
livré le 2026-09-02 par un chantier parallèle). La table porte donc désormais
`options_retenues` et `montant_retenu`, à reprendre telles quelles.

SQLite renomme la table sans toucher aux données ni aux index. Mais la
migration doit être **appliquée en prod dès le push sur `staging`** : une autre
session peut merger et publier le code sans elle, et le code d'après lit une
table qui n'existerait plus sous son ancien nom (incident du 2026-08-19).

C'est le seul geste irréversible du lot, et le seul qui casse en production s'il
est fait dans le mauvais ordre.

### Ordre d'exécution

1. Migration `0007` écrite, appliquée en local, puis **en prod avant tout push**.
2. Renommage des modules `src/lib`, `src/components`, `src/emails` — pas d'URL,
   diff mécanique, tests verts à chaque étape.
3. Renommage de la collection de contenu + `content.config.ts` + les 12 YAML
   déplacés (`git mv`, l'historique se suit).
4. Renommage des routes + redirections + filtre du sitemap.
5. Vocabulaire restant dans la doc et les skills.
6. Build, tests, `npm run verify`, recette en staging sur une vieille URL.

### À trancher avant de commencer

- **`/proposition/` ou `/propositions/`** ? Le singulier lit mieux au niveau
  d'un document (`/proposition/cafa/site-web-8791`), le pluriel colle aux
  autres routes du portail (`/projets`, `/chiffrages`). Recommandation :
  singulier côté public, pluriel côté cockpit — c'est ce que dit le tableau.
- **La skill `devis`** : la renommer en `proposition-commerciale` ? « Génère le
  devis » devient une phrase ambiguë maintenant que le devis existe pour de
  vrai. Renommer impose de mettre à jour le catalogue des skills et de
  resauvegarder les dotfiles.
- **`src/lib/chiffrage/`** et `/espace/chiffrages` : sept fichiers y parlent de
  devis. Le chiffrage est l'étape amont, distincte des deux documents. Rien à
  renommer, mais le vocabulaire interne est à relire.

## Ce qui reste ouvert

- Le passage en `🏆 Signée` restera manuel tant que Tiime n'ouvre pas son API.
  L'intégration Make existe, mais le compte Make est celui de Trigger.
- Les CGV et leur case d'acceptation (`COO-5`) sont toujours au backlog. Une
  proposition validée sans CGV acceptées reste une commande ferme fragile.
