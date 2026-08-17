# S0.6 · Schéma canonique du `publicMetadata` Clerk

Trois mappings relient un utilisateur Clerk à ses données. Ils sont posés **à la main** dans le
dashboard Clerk à l'onboarding — c'est le garde-fou 03 du doc master : « trois mappings posés à la
main = incohérences garanties ». Ce document est le bloc de référence ; son pendant exécutable est
[`src/lib/portail/metadata.ts`](../../../src/lib/portail/metadata.ts), qui fait foi sur la forme
réellement acceptée.

> **Amendé le 2026-08-12.** Les trois clés de mapping (`projects`, `asana_team_gid`,
> `uptimerobot_monitor_ids`) ont quitté l'utilisateur pour le registre des clients
> (`src/content/clients/*.yaml`). Le `publicMetadata` ne porte plus que `{ role, client }`.
> Ce document reste la référence sur la tolérance de lecture et sur les empty states ; le schéma
> lui-même est décrit dans
> [2026-08-12-selecteur-de-client-admin-design.md](2026-08-12-selecteur-de-client-admin-design.md).

## Bloc de référence

```json
{
  "role": "client",
  "projects": ["amusoire"],
  "asana_team_gid": "1217116359107690",
  "uptimerobot_monitor_ids": ["800123456"]
}
```

| Clé | Type | Alimente | Absente ⇒ |
| --- | --- | --- | --- |
| `role` | `"client"` \| `"admin"` | entrées admin-only de la nav, diagnostic des empty states | traité comme `client` |
| `projects` | tableau de slugs de doc | module **Doc** (`/docs/{slug}`) | aucun accès doc |
| `asana_team_gid` | GID de team Asana, en **chaîne** | modules **Projets** et **Support** | empty state Projets et Support |
| `uptimerobot_monitor_ids` | tableau d'IDs, **dès la V1** | module **Mon site** | empty state Mon site |

`uptimerobot_monitor_ids` est un tableau alors que la V1 assume un seul site par client : c'est la
décision « singulier assumé, metadata en tableau dès le départ » (garde-fou 04), qui évite une
migration de metadata au premier client multi-sites.

Ressources ne dépend d'aucune clé : son contenu est commun à tous les clients.

## Ce que la lecture tolère

La saisie se fait dans un éditeur JSON libre, sans validation côté Clerk. `readPortalMetadata()`
ne lève donc jamais : toute forme inattendue dégrade vers la valeur vide de la clé concernée, et
l'empty state prend le relais. Les cas couverts par les tests :

- **GID saisi sans guillemets** → `1217116359107690` (number) est relu en `"1217116359107690"`.
  C'est l'erreur de saisie la plus probable, les GID Asana n'étant faits que de chiffres.
- **Scalaire au lieu d'un tableau** → `"projects": "amusoire"` vaut `["amusoire"]`.
- **Entrées vides, espaces, doublons** → écartées ; `"  "` équivaut à une clé absente.
- **Rôle inattendu** (`"Admin"`, `"superadmin"`, un nombre) → `client`. Le privilège n'est jamais
  accordé par accident.

Une clé **présente mais vide** compte comme manquante : un `projects: []` ne permet pas plus
d'afficher la doc qu'une clé absente.

## Empty states qui nomment la clé

`missingKeysFor(module, meta)` renvoie les clés qui bloquent un module.
[`EmptyState.astro`](../../../src/components/portail/EmptyState.astro) en fait deux lectures :

- **Client** : un message accueillant, aucune mention de l'implémentation. Le brief l'exige
  (§7 « message accueillant, pas une erreur ») et le critère d'acceptation 7 en fait une condition
  de recette : un user sans `asana_team_gid` obtient cet état, pas une 500.
- **Admin** : le même écran, plus un encart qui nomme la clé absente. L'oubli se diagnostique sur
  la page, sans ouvrir les logs ni le dashboard.

Les deux variantes sont posées côte à côte dans la Bibliothèque de `design-system.astro`.

## Runbook d'onboarding d'un nouveau client

Manuel et assumé (doc master §02). Rappel : la création d'un portail est un acte explicite, Asana
n'en est ni le déclencheur ni la précondition.

1. Créer la team Asana du client, dupliquer le projet modèle (4 sections + section « Demandes »),
   noter le team GID.
2. Créer le monitor UptimeRobot du site (si hébergé/suivi), noter le monitor ID.
3. Si doc de passation : créer le dossier `src/content/docs/{slug}/` depuis le gabarit `_template`.
4. Inviter l'utilisateur via le dashboard Clerk (pas d'inscription ouverte) et poser le
   `publicMetadata` complet selon le bloc ci-dessus. **Vérifier les empty states de chaque module**
   en étant connecté comme admin : c'est le contrôle qui rend l'oubli visible.
