# Sélecteur de client pour l'admin — design

Conception validée le 2026-08-12. Introduit un objet « client » dans le portail et un sélecteur
réservé à l'admin, permettant de voir le portail tel que chaque client le voit.

Amende deux décisions du doc master « my Coolbeans » (artifact ee024e91), signalées comme telles
plus bas : le schéma canonique du `publicMetadata` (§02, tâche S0.6) et « la colonne gauche reste
réservée à la nav contextuelle de la doc » (§01, Navigation).

## Le besoin

Ludo est admin et client zéro à la fois. Il doit pouvoir basculer d'un espace client à l'autre pour
se mettre à leur place et voir ce qu'ils voient. Par défaut, son propre espace : Coolbeans.

Un client, lui, ne voit que le sien — le sélecteur n'existe pas pour lui.

**Basculer de contexte n'est pas usurper une identité.** L'utilisateur reste authentifié comme
lui-même : le menu compte, le profil et les réglages de sécurité restent les siens en toutes
circonstances. Seules les données affichées changent. À ne pas confondre avec l'impersonation de
Clerk, qui ouvre une vraie session au nom d'un tiers.

## Le problème que ça révèle

Pour basculer entre clients, il faut pouvoir les **énumérer**. Or le code n'en est pas capable :
un client est aujourd'hui trois clés indépendantes (`projects`, `asana_team_gid`,
`uptimerobot_monitor_ids`) posées à la main sur chaque utilisateur Clerk. Il n'existe aucun objet
« client ». Cette fonctionnalité en impose un.

## Architecture

### 1. Un registre de clients dans le repo

Nouvelle collection `clients`, dans la même veine que `devis`, `projets` et `docs`. Un fichier YAML
par client ; le nom du fichier est le slug.

```yaml
# src/content/clients/amusoire.yaml
nom: Amusoire
doc: amusoire                           # slug dans la collection docs — optionnel
asana_team_gid: "1217116359107690"      # optionnel
uptimerobot_monitor_ids: ["800123456"]  # optionnel, tableau dès la V1 (garde-fou 04)
```

Schéma Zod dans `src/content.config.ts` :

```ts
const clients = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/clients" }),
  schema: z.object({
    nom: z.string(),
    doc: z.string().optional(),
    asana_team_gid: z.string().optional(),
    uptimerobot_monitor_ids: z.array(z.string()).default([]),
    archive: z.boolean().default(false),
  }),
});
```

Un cinquième champ, `archive: true`, sort le client du sélecteur **sans rien supprimer** : sa fiche,
sa doc et ses instantanés KV restent, et il reste résoluble par son slug. Archiver n'est pas
supprimer — c'est ce qui permet de garder un ancien client accessible sans allonger la liste
indéfiniment. Un client archivé reparaît dans le sélecteur s'il se trouve être le client courant,
sans quoi le `<select>` afficherait sa première option alors qu'on est ailleurs.

Ce qui reste attaché au client survit donc à tout : **la suppression du compte Clerk n'emporte
rien**. Le compte ne porte qu'un rôle et un slug, jamais de contenu. Le point de fragilité est le
fichier YAML, pas le compte — supprimer la fiche rend la doc inaccessible et orpheline
l'instantané KV. D'où `archive` plutôt qu'une suppression.

Les trois mappings sont optionnels : un client sans doc, sans Asana ou sans monitor est un état
normal, raconté par l'`EmptyState` de S0.6 — à ceci près que les clés manquantes se lisent
désormais sur le **client**, plus sur l'utilisateur.

Pourquoi le repo plutôt que Clerk ou KV : énumérable au build, coût runtime nul, versionné,
relisible en diff, et un client peut être préparé **avant** que quiconque soit invité — ce que
suppose la décision « la création d'un portail est un acte explicite ».

### 2. Le `publicMetadata` se réduit à deux clés

```json
{ "role": "admin", "client": "coolbeans" }
```

> **Amendement au schéma canonique de S0.6.** Les trois clés de mapping migrent de l'utilisateur
> vers le registre. C'est un gain net sur le garde-fou 03 (« trois mappings posés à la main =
> incohérences garanties ») : le mapping d'un client vit à un seul endroit, plus une fois par
> contact. Deux personnes chez Amusoire ne peuvent plus diverger. S0.6 a été écrit avant qu'on sache
> qu'un admin devrait naviguer entre clients.

`docs/superpowers/specs/2026-08-11-portail-publicmetadata.md` est à mettre à jour en conséquence.

### 3. Résolution du client courant

Une seule fonction serveur, `getCurrentClient(locals, cookies)`, mémoïsée par requête comme
`getPortalContext` :

| Rôle | Client résolu |
| --- | --- |
| **client** | son `client`, toujours. Le cookie de sélection est **ignoré**, pas seulement masqué. |
| **admin** | le client sélectionné → à défaut le sien → à défaut `coolbeans`. |

Le slug est validé contre le registre à chaque résolution : inconnu ou supprimé, on retombe sur le
défaut plutôt que de rendre une page vide.

Le défaut est la constante `DEFAULT_CLIENT = "coolbeans"`. Si le fichier correspondant venait à
manquer, la résolution prend le premier client par ordre alphabétique — le portail reste debout au
lieu de rendre une erreur pour une faute de nommage.

### 4. Persistance du choix

Un cookie `portal_client`, `HttpOnly` + `Secure` + `SameSite=Lax`, `Path=/`, durée un an. Posé par
une Astro Action qui revérifie le rôle côté serveur.

**Le cookie est une préférence d'affichage, jamais une autorisation.** C'est la double barrière :
la résolution l'ignore pour un non-admin, et l'Action refuse de le poser. Un cookie forgé chez un
client ne produit rien.

### 5. L'URL gagne sur le sélecteur

Un admin qui ouvre `/docs/amusoire` alors que son contexte est Coolbeans voit la page **et** son
contexte bascule sur Amusoire. C'est ce qu'on attend en tapant une URL, et ça interdit l'état où le
sélecteur affiche un client pendant que l'écran en montre un autre.

Le client à sélectionner se retrouve en cherchant dans le registre celui dont `doc` vaut le slug de
l'URL. **Si aucun client ne le revendique — le cas de `_template` — aucune bascule n'a lieu** et le
contexte courant est laissé intact ; la page reste accessible par le test de rôle qui lui est propre.

Contrepartie assumée : une requête GET pose un cookie, ce qui n'est pas pur. Il s'agit d'une
préférence d'affichage, sans effet sur les données.

### 6. Le gabarit

`EspaceLayout` gagne une colonne de gauche permanente de 264 px — la largeur de celle de la doc —
et devient un shell à deux colonnes. `DocLayout` reste à trois et voit le sélecteur s'ajouter en
haut de sa colonne, au-dessus de la liste des pages. **Un seul composant de colonne partagé** par
les deux layouts, pour qu'ils ne divergent pas.

La colonne **ne se rend que si elle a quelque chose à porter**. Pour un client sur `/projets`
aujourd'hui — ni sélecteur, ni nav contextuelle — elle disparaît au lieu d'afficher 264 px de vide.

> **Amendement à la décision « Navigation » du doc master (§01)**, qui réservait la colonne gauche à
> la nav contextuelle de la doc. Arbitrage de Ludo du 2026-08-12, sur maquette.

La topbar évolue avec la maquette : logo `myCoolbeans` en un mot, « Hello, {prénom} » à côté de
l'avatar, et le champ de recherche remonte du panneau de doc vers la barre, libellé « Rechercher
dans la doc ⌘K ». Le champ est rendu en permanence ; `DocLayout` l'active quand un index de doc est
présent, il reste inerte ailleurs. Cela remplace l'« emplacement ⌘K » posé en S0.7.

Les cinq entrées de nav sont conservées, « Mon site » compris : son absence de la maquette était un
raccourci de croquis.

### 7. Le sélecteur

Un `<select>` dans un formulaire qui poste vers l'Astro Action. Soumission au changement via un
court script ; sans JavaScript, un bouton de validation prend le relais. Rendu pour les admins
uniquement.

**La liste contient tous les clients du registre**, sans filtre : un admin les voit tous. Coolbeans
en tête, les autres par ordre alphabétique — à deux ou cinq clients, un tri plus élaboré serait
prématuré. Chaque option affiche le champ `nom`, pas le slug.

Sous 900 px la colonne se replie et le sélecteur passe dans la topbar, sans quoi il disparaîtrait
avec elle.

## Flux de données

```
Requête → middleware Clerk (session)
        → getPortalContext(locals)        → { user, meta: { role, client } }
        → getCurrentClient(locals, cookies)
             · non-admin → registre[meta.client]
             · admin     → registre[cookie] ?? registre[meta.client] ?? registre.coolbeans
        → la page lit le client résolu, jamais une valeur venue du navigateur
```

Le changement de client :

```
<select> → POST Action → vérifie role === "admin"
                       → valide le slug contre le registre
                       → pose le cookie
                       → 303 vers la page courante
```

## Contrôle d'accès à la doc

La règle actuelle (`role === "admin"` voit tout) est remplacée par : **un utilisateur voit la doc de
son client courant**. Pour un admin, le client courant étant celui qu'il a choisi — ou celui que
l'URL vient d'imposer (§5) — l'accès reste total sans clause d'exception.

`_template` reste réservé aux admins, par un test explicite sur le rôle.

Cela résout au passage l'incohérence relevée le 2026-08-12 : la nav et l'accueil dérivaient de
`projects` alors que la route doc accordait tout aux admins, si bien qu'un admin sans `projects`
lisait « Aucune documentation associée à votre compte » tout en pouvant ouvrir `/docs/amusoire`.

## Gestion des erreurs

| Situation | Comportement |
| --- | --- |
| Cookie portant un slug inconnu | Ignoré, retour au client par défaut. Pas d'erreur. |
| Utilisateur sans clé `client` | Retombée temporaire sur `projects[0]` (voir Migration), sinon empty state nommant la clé manquante pour l'admin. |
| Client sans `doc` | L'entrée Doc mène à `/espace/doc`, qui explique. Comportement S0.7 inchangé. |
| Client sans `asana_team_gid` | Empty state de Projets nommant la clé, côté admin. Inchangé, la clé se lit juste ailleurs. |
| Non-admin postant l'Action | Refus côté serveur, cookie non posé. |

## Tests

Le gros de la logique est pur et se teste sans navigateur, comme `metadata.ts` et `nav.ts` :

- `getCurrentClient` — les deux rôles, cookie absent, cookie valide, cookie inconnu, utilisateur
  sans `client`, retombée `projects[0]`.
- **Le cookie est ignoré pour un non-admin** — le test qui compte, c'est la barrière de sécurité.
- Validation du slug contre le registre.
- La nav dérivée du client courant plutôt que de `projects`.
- L'Action : refus si le rôle n'est pas admin, refus si le slug est inconnu.

Les composants `.astro` ne sont pas testables en l'état (vitest n'est pas outillé pour) : la
vérification passe par le build et un contrôle manuel après déploiement.

## Migration

1. Créer `src/content/clients/coolbeans.yaml` et `amusoire.yaml`.
2. Dashboard Clerk, deux éditions manuelles :
   - Ludo → `{ "role": "admin", "client": "coolbeans" }`
   - contact Amusoire → `{ "role": "client", "client": "amusoire" }`
3. Retirer la retombée temporaire une fois les deux comptes à jour.

**La fenêtre entre le déploiement et l'étape 2** laisse les utilisateurs sans clé `client`. D'où la
retombée sur `projects[0]` : sans elle, le portail du client casse pendant l'intervalle.

## Hors périmètre

- **Pas d'interface de création de client.** Ajouter un client = un fichier YAML et un commit.
  Cohérent avec « la création d'un portail est un acte explicite », même si l'acte se passe dans le
  repo plutôt que dans l'espace super-admin. Une interface pourra venir si le rythme le justifie.
- **Pas de nav contextuelle par module.** La colonne existe et porte le sélecteur ; les modules la
  rempliront à mesure.
- **Pas de second palier de rôle.** « super-admin » désigne le `role: "admin"` existant ; Ludo est
  le seul admin.

## Effet sur S1

La liste des teams Asana se lit désormais dans le registre. Cela **supprime la tâche S1.1**
(connecteur teams via l'API Clerk avec pagination) et, avec elle, le point « pagination des
utilisateurs Clerk » du §5 des corrections : un appel réseau, une dépendance et un mode de panne en
moins à chaque sync.

`syncTeam(gid)` reste l'unité de base, comme arbitré dans
[2026-08-12-portail-sync-par-team.md](2026-08-12-portail-sync-par-team.md) — le cron itère
simplement sur le registre au lieu d'interroger Clerk.
