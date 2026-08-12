# Portail client · module Projets — corrections de la spec

> Rapatrié dans le repo le 2026-08-11 (tâche S0.1) depuis l'annexe A2 du doc master
> « my Coolbeans · Portail client » (v1.0, 2026-08-06).
>
> Ce document complète `brief-portail-client-asana.md` : **en cas de contradiction entre les deux,
> celui-ci fait foi.** Un point bloquant à lever avant de coder (§0), quatre corrections à intégrer
> (§1 à §4), des points mineurs à trancher (§5), et les amendements du 2026-08-12 sur le workflow
> Asana réel (§6, qui prime sur tout le reste).

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

## §6 · Amendements du 2026-08-12 — alignement sur le workflow Asana réel

Décisions prises avec Ludovic le 2026-08-12, après création du projet pilote « Site web Coolbeans »
(team Coolbeans, projet GID `1217361878516618`). **En cas de contradiction avec le brief ou les
§1 à §5 ci-dessus, ce §6 fait foi.**

### Colonnes canoniques et mapping des statuts

Les projets suivent désormais six colonnes, relevées sur le projet pilote « Site web Coolbeans »
(GID `1217361878516618`, team Coolbeans) : `📥 Inbox`, `🧱 Backlog`, `🚀 Sprint`, `🚧 En cours`,
`☝️ Pour validation`, `✅ Terminé`. **Le matching doit ignorer les emojis** en plus du trim, de la
casse et des accents. Cette table **remplace** celle du brief §5 :

| Section (normalisée) | Statut | Libellé client |
| --- | --- | --- |
| inbox | — | **Jamais synchronisée** : exclue du snapshot |
| backlog · next sprint · sprint · à faire | `todo` | À faire |
| en cours | `in_progress` | En cours |
| pour validation · à valider | `to_validate` | **En attente de votre validation** (inchangé : seul statut appelant une action) |
| terminé | `done` | Terminé |
| section inconnue | `in_progress` | + warning loggé (inchangé) |

Le libellé « À faire » masque volontairement la mécanique agile : Backlog et Next Sprint sont des
colonnes de travail internes (Next Sprint = file d'attente des tâches confiées à l'agent), mais
leurs tâches restent publiques, fusionnées côté client sous un seul libellé.

### Filtre de visibilité : assignée + deadline

Une tâche n'entre dans le snapshot que si elle a **un assigné ET une `due_on`**, quelle que soit
sa colonne. Conséquence voulue : les items de backlog non dégrossis (sans deadline) ne remontent
jamais sur le portail. Implémentation : ajouter `assignee` aux `opt_fields` de la requête
unique de corrections §2.

### Marqueur d'exclusion : préfixe « . » (remplace 🔒)

Le préfixe 🔒 (brief §5, normalisation en §5 ci-dessus, critère 14) est **remplacé** par un
point : toute tâche ou tout projet dont le nom, après `trim()`, commence par `.` est exclu du
snapshot. Usage : chores internes qui ont besoin d'un assigné et d'une deadline dans Asana sans
être montrés au client. L'exclusion étant au niveau du snapshot, ces tâches n'apparaissent nulle
part sur le portail, vue admin comprise. Plus aucune normalisation Unicode nécessaire ; le point
« Normalisation du préfixe 🔒 » du §5 et le critère 14 sont caducs, remplacés par le critère 17.

## §7 · Module Support (2026-08-12) — hors périmètre S1

Décidé le 2026-08-12. **Ce module n'est pas S1** : il introduit la première écriture vers Asana,
alors que S1 est intégralement en lecture. À planifier comme sprint distinct.

### Structure Asana

Un projet **« Support »** par team cliente, créé à partir d'un modèle et dupliqué, avec les
**six mêmes colonnes que les projets** (noms et emojis identiques, même ordre) et
`default_view: "board"` — noter que le projet pilote « Site web Coolbeans » est en vue liste, le
modèle Support doit être corrigé sur ce point. Teams clientes concernées : 16 au 2026-08-12
(la team « Client A », fictive, et « Personal » sont hors périmètre).

### Mapping de statuts propre au Support

Le Support **déroge au §6** : sur un board de support, la colonne Inbox porte une information
légitime pour le client (« ton ticket est arrivé »), là où sur un projet elle est du brouillon.

| Section | Projets (§6) | Support (§7) |
| --- | --- | --- |
| Inbox | exclue du snapshot | **visible**, libellé « Reçu » |
| autres colonnes | cf. §6 | identique au §6 |

Le projet Support est **exclu de la liste des projets** du portail et de la règle de statut projet
de §1 : pas de badge « Prêt à démarrer / En cours / Terminé » sur un board de support. Il alimente
une section distincte de l'interface.

### Création d'un ticket depuis le portail

Écriture directe depuis le Worker (`POST /tasks` de l'API Asana avec `ASANA_PAT`), **sans service
externe** — la règle « pas de n8n, pas de Make » du brief §4 s'applique ici aussi. Un webhook vers
un tiers ne pourrait rien répondre au formulaire et placerait une copie du PAT hors du périmètre.

À la création : tâche placée dans la colonne Inbox du projet Support de la team du client,
assignée à Ludovic, `due_on` = **J+1 ouvré** (voir ci-dessous).

Points d'implémentation :

- **Retour immédiat au client** : après création, écrire le ticket dans le snapshot KV de la team
  sans attendre le cron, sinon le ticket reste invisible jusqu'à 5 minutes. Alternative :
  déclencher un sync ciblé de la team.
- **Assainir le titre saisi** : retirer les `.` en tête, sinon un client titrant « .urgent » rend
  son propre ticket invisible via la règle d'exclusion du §6. Idem pour tout marqueur futur.
- **Anti-abus** : la route crée des objets dans Asana à partir d'une saisie client. Limiter le
  débit par utilisateur ; les pages étant derrière Clerk, l'auteur est toujours identifié.
- Le client ne peut écrire que dans le projet Support **de sa propre team**, jamais ailleurs.

### Calcul de J+1 ouvré (jours fériés France)

Samedi, dimanche et jours fériés français sont sautés. Aucun appel externe : la liste se calcule.
Fixes : 1/1, 1/5, 8/5, 14/7, 15/8, 1/11, 11/11, 25/12. Mobiles, dérivées de Pâques (algorithme de
Meeus/Butcher) : Lundi de Pâques (+1), Ascension (+39), Lundi de Pentecôte (+50). Pas de dérogation
Alsace-Moselle. Cas de test : ticket créé un vendredi → deadline au lundi ; ticket créé la veille
d'un férié → deadline au jour ouvré suivant.

## Récapitulatif · critères d'acceptation 9 à 18

9. Un projet dont toutes les tâches sont cochées, mais non marqué terminé dans Asana, s'affiche
   « En cours » et non « Prêt à démarrer ».
10. Un projet sans aucune tâche s'affiche « En cours » et non « Prêt à démarrer ».
11. Deux exécutions successives du cron sans aucun changement dans Asana ne produisent aucune
    écriture KV sur les clés `team:{gid}`.
12. Un projet de plus de 100 tâches est intégralement synchronisé (pagination).
13. Une tâche appartenant à la fois au projet client et à un board interne n'expose que sa section
    du projet client.
14. ~~Une tâche nommée avec une variante du préfixe verrou (espace avant l'emoji, sélecteur de
    variation) est bien exclue.~~ Caduc (§6) : remplacé par le critère 17.
15. Une tâche en colonne Inbox, même assignée et datée, n'apparaît jamais sur le portail.
16. Une tâche sans assigné ou sans deadline n'apparaît pas, quelle que soit sa colonne.
17. Une tâche dont le nom commence par « . » (y compris avec espaces avant le point), assignée
    et datée, est exclue du snapshot ; idem pour un projet.
18. Des tâches assignées et datées en Backlog et en Next Sprint s'affichent côté client sous le
    seul libellé « À faire », dans l'ordre du board.
