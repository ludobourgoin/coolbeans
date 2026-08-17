# Portail client · module Projets — brief d'implémentation

> Rapatrié dans le repo le 2026-08-11 (tâche S0.1) depuis l'annexe A1 du doc master
> « my Coolbeans · Portail client » (v1.0, 2026-08-06).
>
> Toutes les décisions de ce brief ont été arbitrées : ne pas les remettre en question
> sans le signaler explicitement. **En cas de contradiction, `corrections-spec-portail-client.md`
> fait foi.** Amendement du 2026-08-06 : la route admin sync (§8) est **requise**, plus un bonus.

## §1 · Objectif

Afficher dans l'espace client (routes protégées Clerk) l'avancement des projets du client,
**en lecture seule**, à partir des données Asana.

- Le client voit où en est son projet, il n'interagit pas.
- Les données sont synchronisées toutes les heures par un cron Worker, **jamais fetchées depuis le navigateur**.
- Coût d'exploitation cible : 0 €/mois (free tiers Asana, Cloudflare, Clerk).

## §2 · Modèle de données côté Asana (déjà en place)

| Élément | Valeur |
| --- | --- |
| Workspace Asana | `coolbeans.cc`, GID `1201457508335146` |
| Team pilote | « Client A », GID `1217116359107690` |
| Projet pilote | « Projet A », GID `1217116359107657` |

**Conventions de structure :** 1 team Asana = 1 client · 1 projet Asana = 1 projet client réel ·
chaque projet a exactement 4 sections, dans cet ordre : `À faire`, `En cours`, `À valider`, `Terminé`.
Les projets sont créés par duplication d'un modèle, les noms de sections sont donc stables, mais
**le matching doit rester tolérant** (voir §5).

**Champs consommés.** Projet : `name`, `notes` (description courte affichée au client, encadrée par
corrections §4), `due_on` (deadline projet), `completed`. Tâche : `name`, `due_on`, `completed`,
section d'appartenance. Les tâches sont affichées dans **l'ordre manuel du board Asana**.

## §3 · Liaison client ↔ Asana (Clerk)

```json
// publicMetadata de chaque utilisateur Clerk
{ "asana_team_gid": "1217116359107690" }
```

Posé une seule fois à l'onboarding (manuellement via le dashboard Clerk pour l'instant).
Un utilisateur **sans** `asana_team_gid` voit un empty state propre (« Aucun projet pour le moment »),
**pas une erreur**. Plusieurs utilisateurs Clerk peuvent partager le même `asana_team_gid`
(plusieurs contacts chez un même client).

## §4 · Architecture

```
[Cron Worker, toutes les heures]
    → API Asana (PAT, Bearer token)
    → construit un snapshot JSON par team
    → écrit dans Workers KV : clé team:{team_gid}, + clé meta:last_sync

[Requête client]
    → route Astro SSR protégée Clerk
    → lit publicMetadata.asana_team_gid
    → lit KV team:{gid}
    → rend la page (aucun appel Asana au runtime des requêtes)
```

Le site étant déjà un Worker (adapter `@astrojs/cloudflare`), le cron s'ajoute **au même Worker**
via un handler `scheduled` exporté à côté du handler `fetch`.
**Pas de service externe : pas de n8n, pas de Make.**

**Configuration wrangler :** `triggers.crons = ["0 * * * *"]` (1 cron sur les 5 du free plan) ·
binding KV `PORTAL_KV` · secret `ASANA_PAT` via `wrangler secret put`, **jamais exposé côté client
ni commité** · variable `ASANA_WORKSPACE_GID = 1201457508335146`.

| Budget (free tiers, août 2026) | Limite | Consommation du sync |
| --- | --- | --- |
| Asana API | 150 req/min | ~1 + N_projets requêtes par team, par heure (après corrections §2). Marge large ; **retry avec backoff sur HTTP 429** (header `Retry-After`) obligatoire. |
| Workers KV free | 100 000 lectures/j · 1 000 écritures/j | Écritures conditionnelles au changement (corrections §3). |
| Workers free | 100 000 req/j · 10 ms CPU | Budget CPU du cron à vérifier avant implémentation (corrections §0). |

## §5 · Logique du sync (handler scheduled)

**Étapes :**

1. **Récupérer la liste des teams clients.** Source : API Clerk (Backend API, lister les users et
   collecter les `asana_team_gid` distincts, **avec pagination**, cf. corrections §5). Alternative
   acceptable si plus simple : variable d'environnement JSON listant les team GIDs, mais la source
   Clerk est préférée (zéro maintenance).
2. **Pour chaque team :** `GET /teams/{team_gid}/projects?opt_fields=name,notes,due_on,completed,archived`,
   en **excluant les projets archived**. Puis pour chaque projet : la requête unique définie en
   corrections §2 (qui remplace le couple sections + tasks du brief d'origine).
3. **Construire le snapshot** (schéma §6 + corrections) et l'écrire dans KV sous `team:{team_gid}`
   avec `synced_at` (ISO 8601, UTC), selon la règle d'écriture conditionnelle corrections §3.
4. **Écrire meta:last_sync** : timestamp global + résumé (nb teams, nb projets, erreurs éventuelles).
   Jamais exposé au client.

**Règles de statut d'une tâche (source de vérité) :** si `completed === true` → `done`,
**quelle que soit sa section**. Sinon, statut dérivé du nom de section normalisé
(trim, minuscules, accents ignorés) :

| Section | Statut | Libellé client (§7) |
| --- | --- | --- |
| à faire | `todo` | À faire |
| en cours | `in_progress` | En cours |
| à valider | `to_validate` | **En attente de votre validation** (seul statut appelant une action : le rendre visuellement saillant) |
| terminé | `done` | Terminé |
| section inconnue | `in_progress` par défaut | + warning loggé. Ne jamais planter le sync pour ça. |

**Statut d'un projet :** la règle du brief d'origine contenait un bug (vrai-par-vacuité) ;
la règle corrigée, qui fait foi, est en corrections §1.

**Règles de visibilité :** toute tâche ou projet dont le nom commence par 🔒 est
**exclu du snapshot** (échappatoire pour du contenu interne ; la règle de base reste : rien
d'interne dans une team client ; normalisation Unicode en corrections §5).
**Ne jamais inclure dans le snapshot :** assignees, commentaires / stories, custom fields,
memberships d'autres projets. Une tâche peut être multi-homée dans des boards internes :
**filtrer sur le projet client courant uniquement** (méthode en corrections §2).

**Robustesse :** une team en erreur (API down, 404) ne bloque pas les autres : try/catch par team,
**conserver l'ancien snapshot KV en cas d'échec** (ne pas écraser avec du vide). Logger les
anomalies (team introuvable côté Asana, section inattendue) : `console.log` suffit
(visible via logs Workers / `wrangler tail`).

## §6 · Schéma du snapshot KV (clé team:{team_gid})

```json
{
  "schema_version": 1,                       // ajout corrections
  "team_gid": "1217116359107690",
  "synced_at": "2026-08-03T16:00:00Z",
  "projects": [
    {
      "gid": "1217116359107657",
      "name": "Projet A",
      "description": "Ceci est la description du projet A.",   // notes encadré par corrections §4
      "due_on": "2026-08-31",
      "status": "in_progress",
      "tasks": [
        { "gid": "…", "name": "Tâche 1", "due_on": "2026-08-06", "status": "done" },
        { "gid": "…", "name": "Tâche 2", "due_on": "2026-08-19", "status": "to_validate" }
      ]
    }
  ]
}
```

**Ordre des projets :** non terminés d'abord (par `due_on` croissant, `null` en dernier),
puis les terminés. **Ordre des tâches :** ordre du board, sections dans l'ordre
À faire → En cours → À valider → Terminé.

## §7 · UI (page Projets de l'espace client)

- Route **SSR protégée Clerk** (middleware existant), en-tête `Cache-Control: no-store`.
- Liste des projets du client. Par projet : nom, description, deadline, badge de statut
  (Prêt à démarrer / En cours / Terminé), tâches groupées par colonne avec leur deadline.
- Tâches `done` : cochées visuellement. Projet `done` : carte entière grisée, reléguée en bas de liste.
- Bandeau discret « Dernière mise à jour le {date} à {heure} » à partir de `synced_at`, en heure de
  Paris, format français. Suite à l'écriture conditionnelle (corrections §3), ce libellé désigne le
  dernier **changement** ; `meta:last_sync` n'est jamais exposé au client.
- **Aucune interaction** : pas de boutons d'édition, pas de liens vers Asana.
- **Empty states :** pas de `asana_team_gid` ou team sans projets → message accueillant, pas d'erreur.
  Snapshot absent (premier déploiement, cron pas encore passé) → « Synchronisation en cours,
  revenez dans quelques minutes ».

## §8 · Route admin sync (requise, amendement 2026-08-06)

Route `POST /api/admin/sync` protégée (secret en header) qui déclenche le même sync à la demande :
tester sans attendre le cron, rafraîchir après une grosse mise à jour Asana, et amorcer le premier
snapshot au déploiement. Le brief d'origine la classait « bonus si trivial » ; elle est
**promue requise** (garde-fou 01 du doc master).

## §9 · Critères d'acceptation (1 à 8)

1. Le cron tourne toutes les heures et met à jour KV sans intervention.
2. Un user Clerk de test avec `asana_team_gid = 1217116359107690` voit « Projet A » avec ses
   4 tâches dans le bon ordre, les bons statuts et les bonnes deadlines.
3. Cocher une tâche dans Asana **sans la déplacer de colonne** → affichée « Terminé » au sync
   suivant (règle `completed` d'abord).
4. Marquer le projet terminé dans Asana → carte grisée « Terminé ».
5. Une tâche préfixée 🔒 dans le board n'apparaît **jamais** dans le portail.
6. Le PAT Asana n'apparaît dans **aucune** réponse réseau côté navigateur.
7. Un user sans `asana_team_gid` obtient l'empty state, **pas une 500**.
8. Couper l'API Asana (simuler une erreur) → le portail continue d'afficher le dernier snapshot
   avec son timestamp.

Les critères 9 à 14 sont définis dans `corrections-spec-portail-client.md` (récapitulatif final).
