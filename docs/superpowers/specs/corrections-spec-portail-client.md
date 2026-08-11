# Portail client · module Projets — corrections de la spec

> Rapatrié dans le repo le 2026-08-11 (tâche S0.1) depuis l'annexe A2 du doc master
> « my Coolbeans · Portail client » (v1.0, 2026-08-06).
>
> Ce document complète `brief-portail-client-asana.md` : **en cas de contradiction entre les deux,
> celui-ci fait foi.** Un point bloquant à lever avant de coder (§0), quatre corrections à intégrer
> (§1 à §4), des points mineurs à trancher (§5).

## §0 · Bloquant : vérifier le budget CPU du handler scheduled avant d'implémenter

La spec chiffre les budgets Asana, KV et requêtes Workers, mais **pas le temps CPU du handler
`scheduled` sur le plan gratuit Cloudflare**. C'est le seul point qui peut invalider l'architecture
entière. Le temps d'attente réseau ne compte pas dans le CPU time ; le parsing de dizaines à
centaines de réponses JSON, si.

1. Vérifier dans la doc limites Workers le budget CPU applicable aux Cron Triggers sur le plan
   gratuit (il peut différer des 10 ms/invocation des requêtes HTTP).
2. Si le budget suffit pour un sync de toutes les teams en une passe : implémenter tel que spécifié.
3. Sinon : découper le sync en plusieurs invocations. Le free plan autorise 5 crons : répartir les
   teams en lots déterministes (ex. modulo sur le rang du team GID trié, un lot par cron décalé de
   12 minutes) plutôt qu'augmenter la fréquence.

**Signaler le résultat de cette vérification avant de poursuivre**, avec la limite constatée et le
choix retenu. Note : la correction §2 divise le volume de parsing par ~5, ce qui améliore
mécaniquement la marge. (Verdict doc master, garde-fou 06 : probablement un faux bloquant à
l'échelle actuelle ; vérifier quand même, ne rien pré-optimiser.)

## §1 · Corriger la règle de statut projet (bug fonctionnel)

La règle d'origine (« si toutes les tâches non cochées sont en `todo` → ready ») est vraie
**par vacuité** quand il n'existe aucune tâche non cochée. Deux affichages faux en découlent :
un projet dont toutes les tâches sont cochées mais non marqué terminé dans Asana s'affiche
« Prêt à démarrer » ; un projet sans aucune tâche aussi.

```
statutProjet(projet, taches):
  si projet.completed === true        → "done"
  sinon:
    restantes = taches où status !== "done"
    si restantes est vide             → "in_progress"   // tout est fait mais projet non clôturé côté Asana
    si toutes restantes ont status === "todo" → "ready"
    sinon                             → "in_progress"
```

Le cas « projet sans aucune tâche » tombe dans `restantes` vide, donc `in_progress`.
Comportement voulu : ne jamais annoncer « Prêt à démarrer » sur un projet dont on ne peut rien déduire.

## §2 · Réduire le nombre de requêtes Asana par projet (5 → 1)

Le brief d'origine faisait 1 + 4 = 5 requêtes par projet (sections puis tâches par section) :
plusieurs centaines de requêtes par cron à vingt clients, alors qu'une seule suffit. Il exigeait
aussi de filtrer les tâches multi-homées sans dire comment. Remplacer par :

```
GET https://app.asana.com/api/1.0/tasks
  ?project={project_gid}
  &opt_fields=name,due_on,completed,memberships.project.gid,memberships.section.name
  &limit=100
```

Points d'implémentation :

- L'ordre des tâches renvoyé suit l'ordre manuel du board. **Ne pas re-trier.**
- Pour chaque tâche, retenir la membership dont `memberships[].project.gid === project_gid` courant,
  et en lire `section.name`. Cela résout d'un coup le filtrage des tâches multi-homées.
- Tâche sans membership correspondante : ignorée (log de warning, pas d'erreur).
- **Gérer la pagination** (`next_page.offset`) : `limit` plafonne à 100 et un projet peut dépasser.
- Regroupement par section et ordre des colonnes (À faire → En cours → À valider → Terminé) faits
  ensuite en mémoire, à partir du nom de section normalisé, selon le matching tolérant du brief.

## §3 · N'écrire dans KV que si le snapshot a changé

Le calcul d'origine était optimiste : `(N_teams × 24) + 24` écritures/jour, soit ~430/jour à
17 clients et un plafond (1 000/j) franchi vers 40 clients, avec échec silencieux du sync.
Rendre les écritures conditionnelles :

1. Construire le snapshot de la team **sans** le champ `synced_at`.
2. Calculer un hash du contenu : SHA-256 du JSON sérialisé avec ordre de clés stable
   (`crypto.subtle.digest`, disponible dans les Workers).
3. Comparer au hash stocké. Préféré : hash dans les métadonnées KV de la clé `team:{gid}`, lu via
   `KV.getWithMetadata()` (pas de lecture de la valeur complète). Alternative : champ `content_hash`
   dans le snapshot.
4. Hash identique : **ne rien écrire**, ne pas mettre à jour `synced_at` pour cette team.
5. Hash différent : écrire le snapshot complet avec `synced_at` à l'heure courante.

Écrire `meta:last_sync` à chaque exécution reste acceptable (24 écritures/jour, indépendant du
nombre de clients). **Conséquence UI :** « Dernière mise à jour » affiche la date du dernier
**changement**, pas de la dernière vérification. Sémantique plus juste pour le client ;
ne jamais exposer `meta:last_sync`.

## §4 · Encadrer l'exposition du champ notes d'Asana

La description d'un projet Asana est un champ de travail interne : notes de chantier, identifiants
de staging, commentaires sur le client. L'exposer brut est un risque de fuite par inadvertance,
pas un risque théorique. Appliquer l'une des deux options (A par défaut) :

| Option | Règle |
| --- | --- |
| **A · Séparateur (défaut)** | Seule la portion de `notes` située **avant** la première ligne contenant uniquement `---` est exposée. Tout ce qui suit est interne et n'entre jamais dans le snapshot. Sans séparateur : exposer seulement la **première ligne non vide**, tronquée à 300 caractères. |
| **B · Exclusion pure** | Ne pas exposer `notes` du tout ; retirer `description` du schéma et le bloc description de l'UI. |

Dans les deux cas : `notes` ne doit jamais être injecté en HTML brut côté rendu.

## §5 · Points mineurs à trancher explicitement

| Point | Décision |
| --- | --- |
| **Projet archivé ou supprimé côté Asana** | Exclu du snapshot, donc il disparaît du portail au sync suivant, sans transition ni message. Comportement confirmé comme voulu ; l'ajouter aux critères d'acceptation si besoin. |
| **Pagination des utilisateurs Clerk (§5.1 du brief)** | L'API Clerk pagine : implémenter la boucle, sinon les clients au-delà de la première page cessent silencieusement d'être synchronisés. |
| **Normalisation du préfixe 🔒** | Le test sur un emoji en début de nom est fragile (espace insécable, sélecteur de variation U+FE0F, espace avant l'emoji). Normaliser : `name.trim().normalize('NFKC')` puis vérifier le préfixe en ignorant les sélecteurs de variation. Cas de test explicite pour une variante. |
| **Versionner le schéma du snapshot** | Champ `schema_version: 1` dans le snapshot. Coût nul aujourd'hui, évite une migration à l'aveugle plus tard. |

## Récapitulatif · critères d'acceptation 9 à 14

9. Un projet dont toutes les tâches sont cochées, mais non marqué terminé dans Asana, s'affiche
   « En cours » et non « Prêt à démarrer ».
10. Un projet sans aucune tâche s'affiche « En cours » et non « Prêt à démarrer ».
11. Deux exécutions successives du cron sans aucun changement dans Asana ne produisent aucune
    écriture KV sur les clés `team:{gid}`.
12. Un projet de plus de 100 tâches est intégralement synchronisé (pagination).
13. Une tâche appartenant à la fois au projet client et à un board interne n'expose que sa section
    du projet client.
14. Une tâche nommée avec une variante du préfixe verrou (espace avant l'emoji, sélecteur de
    variation) est bien exclue.
