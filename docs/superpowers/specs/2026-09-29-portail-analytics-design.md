# Analytics du portail : la fréquentation du site dans l'espace client

- Date : 2026-09-29
- Issue : COO-16
- Branche : `feat/analytics` (worktree `../coolbeans-analytics`)
- Statut : design validé par Ludo le 2026-09-29

## 1. Objectif

La page `/espace/analytics` montre à chaque client la fréquentation de son site :
visites, pages vues, pages les plus vues, provenance, appareils. Sur 30 jours et sur
6 mois. Le client n'a rien à configurer.

Réussi quand : un client connecté voit des chiffres exacts de son propre site, et
seulement du sien.

Hors périmètre de cette version :

- le tableau admin qui compare tous les sites ;
- les pays, les Core Web Vitals, la comparaison avec la période précédente ;
- le filtrage des robots ;
- l'historique d'avant le lancement au-delà de 7 jours ;
- la pose du snippet sur de nouveaux sites (REV-22, MAT-15, SPI-35, CAFA).

## 2. Source : Cloudflare Web Analytics

Décision du 2026-09-16 (COO-16). Tous les sites sont enregistrés dans le compte
Coolbeans `c973603680fd067768f1849fc1927069`.

Constats des sondes du 2026-09-29 sur l'API GraphQL (`rumPageloadEventsAdaptiveGroups`) :

- **Pas de visiteurs uniques.** Cloudflare compte des visites (`sum.visits`) et des
  pages vues (`count`).
- **Un jour isolé des 7 derniers jours sort exact** (`avg.sampleInterval = 1`).
- **Au-delà de 7 jours, ou sur une fenêtre de plusieurs jours, l'API échantillonne à
  10 %** (`sampleInterval = 10`). Sur un petit site, un jour peut disparaître : le
  2026-09-19 est vide pour tous les sites, alors qu'il avait du trafic.
- Historique disponible : 184 jours, 93 jours au plus par requête, 10 000 lignes par
  page, 300 requêtes par 5 minutes.
- Une requête au niveau du compte, sans filtre `siteTag`, renvoie tous les sites.
- Trafic réel : 1 à 11 pages vues par jour et par site.
- Beaucoup de pages vues « US, desktop » sur des sites locaux : probablement des robots
  qui exécutent le JS. Non traité ici.

Conséquence : la collecte lit un jour à la fois, chaque jour, et stocke le résultat
dans D1. D1 devient l'historique exact, plus précis que le dashboard Cloudflare.

## 3. Architecture

Quatre unités dans `src/lib/analytics/`, plus la page.

| Unité | Rôle | Dépend de |
|---|---|---|
| `cloudflare.ts` | Adaptateur : interroge l'API pour un jour, rend un `JourAnalytics[]` | `fetch` injecté |
| `collecte.ts` | Choisit les jours à relire, appelle l'adaptateur, écrit | adaptateur, `store.ts` |
| `store.ts` | Écritures et lectures D1 | `D1Database` |
| `tableau.ts` | Agrège les lignes D1 pour la page (totaux, série, listes) | fonctions pures |

L'adaptateur est le seul fichier qui connaît Cloudflare. Passer à Umami ou Plausible
revient à écrire un autre adaptateur qui rend le même type.

```ts
interface JourAnalytics {
  siteTag: string;
  jour: string; // AAAA-MM-JJ, UTC
  visites: number;
  pagesVues: number;
  echantillon: number; // sampleInterval max du jour, 1 = exact
  pages: Array<{ valeur: string; visites: number; pagesVues: number }>;
  provenances: Array<{ valeur: string; visites: number; pagesVues: number }>;
  appareils: Array<{ valeur: string; visites: number; pagesVues: number }>;
}
```

### 3.1 Requête GraphQL, un jour

Une requête HTTP par jour, quatre alias, sans filtre `siteTag` :

```graphql
query ($compte: String!, $jour: Date!) {
  viewer {
    accounts(filter: { accountTag: $compte }) {
      totaux: rumPageloadEventsAdaptiveGroups(
        limit: 1000
        filter: { date_geq: $jour, date_leq: $jour }
      ) {
        count
        sum { visits }
        avg { sampleInterval }
        dimensions { siteTag }
      }
      pages: rumPageloadEventsAdaptiveGroups(
        limit: 5000
        orderBy: [count_DESC]
        filter: { date_geq: $jour, date_leq: $jour }
      ) {
        count
        sum { visits }
        dimensions { siteTag requestPath }
      }
      provenances: rumPageloadEventsAdaptiveGroups(
        limit: 5000
        orderBy: [sum_visits_DESC]
        filter: { date_geq: $jour, date_leq: $jour }
      ) {
        count
        sum { visits }
        dimensions { siteTag refererHost }
      }
      appareils: rumPageloadEventsAdaptiveGroups(
        limit: 1000
        filter: { date_geq: $jour, date_leq: $jour }
      ) {
        count
        sum { visits }
        dimensions { siteTag deviceType }
      }
    }
  }
}
```

Endpoint `https://api.cloudflare.com/client/v4/graphql`, en-tête
`Authorization: Bearer <CF_ANALYTICS_TOKEN>`. Une réponse avec `errors` non vide lève
une erreur qui porte le message de l'API.

Mise au format :

- `refererHost` vide devient la valeur `""`, affichée « Accès direct » par la page.
- Une provenance égale au host du site lui-même a 0 visite (navigation interne) :
  les lignes à 0 visite sont écartées.
- `deviceType` vide devient `"autre"`.

### 3.2 Collecte

- Déclenchement : le cron `*/5 * * * *` existant. La collecte ne tourne qu'au premier
  passage de 04:00 UTC (`getUTCHours() === 4 && getUTCMinutes() < 5`), sur le modèle
  de la synchronisation Livraisons dans `src/worker.ts`.
- Sans `CF_ANALYTICS_TOKEN` ou `CF_ACCOUNT_ID`, la tâche se saute et trace
  `{ event: "analytics_collecte", status: "skipped_missing_secrets" }`.
- Jours relus à chaque passage : J-1 à J-7 (UTC). Soit 7 requêtes, 7 des
  50 subrequests du plan gratuit.
- **Invariant : aucun jour antérieur à J-7 n'est jamais écrit.** Au-delà, l'API ne
  rend plus que de l'estimé, qui écraserait l'exact.
- Chaque jour est indépendant : un échec est tracé
  (`status: "error"`, jour, message) et n'empêche pas les autres.
- Réécrire un jour déjà collecté est sans effet de bord : les mesures arrivées en
  retard s'ajoutent, et une panne de moins d'une semaine se rattrape seule.
- Premier passage : les 7 jours exacts disponibles. Aucun historique estimé.

### 3.3 Schéma D1, migration `0011_analytics.sql`

```sql
CREATE TABLE analytics_jours (
  site_tag    TEXT NOT NULL,
  jour        TEXT NOT NULL,
  visites     INTEGER NOT NULL,
  pages_vues  INTEGER NOT NULL,
  echantillon INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (site_tag, jour)
);

CREATE TABLE analytics_repartitions (
  site_tag   TEXT NOT NULL,
  jour       TEXT NOT NULL,
  dimension  TEXT NOT NULL CHECK (dimension IN ('page', 'provenance', 'appareil')),
  valeur     TEXT NOT NULL,
  visites    INTEGER NOT NULL,
  pages_vues INTEGER NOT NULL,
  PRIMARY KEY (site_tag, jour, dimension, valeur)
);

CREATE TABLE analytics_collectes (
  jour       TEXT PRIMARY KEY,
  collecte_le TEXT NOT NULL
);
```

Écriture d'un jour, en un seul `db.batch` :

1. supprimer les lignes `analytics_jours` et `analytics_repartitions` de ce jour ;
2. insérer les lignes du jour pour chaque site ;
3. `INSERT OR REPLACE` dans `analytics_collectes` avec l'horodatage.

`analytics_collectes` distingue un jour collecté sans trafic (0) d'un jour jamais
collecté (absent). C'est aussi le signal qui prouve que le cron tourne, puisque les
journaux du Worker ne sont pas consultables.

## 4. Registre des clients

Nouvelle clé optionnelle dans `src/content/clients/<slug>.yaml`, déclarée dans le
schéma `clients` de `src/content.config.ts` :

```yaml
analytics:
  - host: setencorpsmieux.fr
    siteTag: 7257179f83b6445d93703f1d1f305a4a
```

Valeur par défaut : liste vide. Raccordements de cette version :

| Client | host | siteTag |
|---|---|---|
| `coolbeans` | coolbeans.cc | `2ad7fb260e2a498a900a5d97d41b6853` |
| `setencorpsmieux` | setencorpsmieux.fr | `7257179f83b6445d93703f1d1f305a4a` |
| `spinoza` | scolies.fr | `1172e579f52c48b8b0e28135a61188ad` |
| `revolutions-douces` | revolutionsdouces.org | `4b3f282e3f8a4d90ac63fbeb41577e72` |
| `revolutions-douces` | construire-habiter-autrement.org | `7b1613c4d8524beaae503934203801a4` |

CAFA attend son domaine définitif (CAF-13) : son site de staging n'est pas raccordé.

Dans `src/lib/portail/workspaces.ts` :

- `PortalModule` gagne `"analytics"`, `WorkspaceMappingKey` gagne `"analytics"` ;
- `MODULE_REQUIREMENTS.analytics = ["analytics"]` ;
- `hasMapping(client, "analytics")` est vrai si la liste n'est pas vide.

Dans `src/lib/portail/nav.ts`, l'entrée Analytics passe à `flag: "live"` avec
`configured: (c) => (c?.analytics.length ?? 0) > 0`. Un client sans site ne la voit
pas. Un admin la voit, marquée `wip` s'il n'y a pas de site.

## 5. Page `/espace/analytics`

Remplace la page-souche actuelle. Rendu serveur, `prerender = false`,
`Cache-Control: no-store`, dans `EspaceLayout`.

**Sécurité.** La page ne lit que les `siteTag` du client courant, résolu par
`getPortalContext`. Le paramètre `site` est un host, cherché dans la liste du client.
Un host inconnu retombe sur le premier site. Un `siteTag` ne vient jamais de l'URL.

**Paramètres.**

- `periode` : `30j` (défaut) ou `6m`.
- `site` : host du site, utile seulement si le client en a plusieurs. Défaut : le
  premier de la liste YAML.

**Fenêtre.** La période se termine à J-1 (UTC), dernier jour complet. `30j` couvre
J-30 à J-1, `6m` couvre J-182 à J-1. La page n'affiche que les jours présents dans
`analytics_collectes`.

**Contenu, de haut en bas.**

1. Titre « Analytics », sous-titre « L'audience de votre site, sans cookies. »
2. Sélecteur de site (si plusieurs), sélecteur de période.
3. « Données depuis le <jour> », où `<jour>` est le plus ancien jour de
   `analytics_collectes`. Un site raccordé plus tard affiche 0 sur les jours
   antérieurs à son enregistrement chez Cloudflare.
4. Deux chiffres clés sur la période : Visites, Pages vues.
5. Graphique en barres des visites, SVG rendu côté serveur, sans JavaScript :
   une barre par jour en `30j`, une par semaine (lundi) en `6m`. Un jour collecté
   sans trafic vaut 0. Un jour jamais collecté n'a pas de barre.
6. Trois listes :
   - Pages les plus vues : 10 premières par pages vues ;
   - Provenance : 10 premières par visites, `""` affiché « Accès direct » ;
   - Appareils : part des visites, libellés « Mobile », « Ordinateur »,
     « Tablette », « Autre ».
7. Si un jour de la période a `echantillon > 1` : une note discrète « Certains jours
   sont estimés par Cloudflare. »
8. Admin seulement : « Dernière collecte : <date et heure> ».

**États vides.**

- Aucun site raccordé : `EmptyState` avec `missingKeysFor("analytics", client)`, qui
  montre la clé manquante à l'admin.
- Site raccordé, aucun jour collecté : `EmptyState` « Les premiers chiffres arrivent
  demain matin. »

**Design.** Relire `/design-system` avant de coder (labels `.label field-label`,
tokens de `global.css`). Le graphique suit le skill `dataviz`.

## 6. Configuration

- Secret `CF_ANALYTICS_TOKEN` : jeton API Cloudflare, permission « Account Analytics :
  Read » sur le compte Coolbeans. En prod et en staging.
- Variable `CF_ACCOUNT_ID` dans `vars`, dupliquée dans `env.staging` (les `vars` ne
  sont pas héritées).
- Les deux déclarés dans `src/worker-env.d.ts`.

## 7. Tests (vitest)

- `cloudflare.test.ts` : mise au format à partir de réponses réelles enregistrées le
  2026-09-29 ; accès direct, provenance interne écartée, appareil vide ; erreur
  GraphQL qui lève.
- `collecte.test.ts` : fenêtre J-1 à J-7, rien avant J-7, un jour en échec
  n'arrête pas les autres, idempotence.
- `store.test.ts` : SQLite en mémoire (`node:sqlite`), comme
  `src/lib/documents/reponses.sqlite.test.ts` ; réécriture d'un jour, jour sans
  trafic enregistré dans `analytics_collectes`.
- `tableau.test.ts` : totaux, série par jour et par semaine, jours non collectés
  absents, top 10, parts d'appareils, drapeau d'estimation.
- `workspaces.test.ts` et `nav.test.ts` : module `analytics`, visibilité de l'entrée.

## 8. Documentation

- `src/content/docs/coolbeans/04-portail.mdx` : section Analytics (source, collecte,
  raccorder un client).
- `docs/superpowers/specs/2026-08-17-portail-client-strategie-produit.md` : §4.1 et
  arbitrage 9.2 disent encore « Plausible vs Umami suspendu ». Les mettre à jour
  vers la décision du 2026-09-16.

## 9. Mise en service

Aucune publication en production sans ordre de Ludo.

1. Créer le jeton API et poser le secret en staging et en prod.
2. Appliquer `0011_analytics.sql` à la base prod au push sur `staging` (une seule
   session à la fois).
3. Le lendemain matin, vérifier que `analytics_collectes` contient 7 jours.

## 10. Risques connus

- Jours en UTC : décalage de 1 à 2 heures avec l'heure de Paris.
- Bruit de robots (« US, desktop ») compté comme des visites.
- Au-delà de 10 sites hors proxy Cloudflare (Shopify, Webflow), il faut un autre
  outil ou un proxy.
