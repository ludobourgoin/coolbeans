# Migration Asana → Linear — team Coolbeans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire vivre la team Coolbeans (COO) dans Linear — labels, config d'équipe, projets, team modèle, vue de travail — et y retrianger le contenu encore pertinent des 6 projets Asana Coolbeans, avant d'archiver ces derniers ; puis actualiser le SOP commercial pour que la prochaine création de client passe par Linear.

**Architecture:** Opérations pilotées majoritairement via les serveurs MCP `linear-server` et `claude_ai_Asana`. Une partie n'est pas exposée par ces API (création de team, réglages de team, vues personnalisées, archivage de projet Asana) : ces étapes sont manuelles côté Ludo, avec le chemin UI exact donné dans la tâche concernée, suivies d'une vérification API quand c'est possible. La dernière tâche est une édition de fichier classique dans ce repo (aucune commande MCP).

**Tech Stack:** MCP `linear-server`, MCP `claude_ai_Asana`, Astro content collection (`src/content/docs/coolbeans/01-vente.mdx`).

**Spec:** `docs/superpowers/specs/2026-08-13-migration-asana-linear-design.md`

## Global Constraints

- Scope strict à la team Coolbeans (préfixe `COO`) : aucune team cliente existante côté Asana (Fylgo, Promologis, Client A, Oïde, Littlebox, etc.) n'est touchée dans ce plan — leur migration est une session séparée, par client, au moment de son onboarding.
- Pas d'import automatique Asana → Linear : chaque tâche ouverte est relue et reformulée manuellement, jamais copiée telle quelle (décision explicite du spec, section 9).
- Le portail myCoolbeans continue de lire Asana (`src/lib/portail/asana/`) : aucun fichier de ce dossier n'est touché dans ce plan.
- Team Coolbeans Linear existante, id `64bf4683-6650-4250-96bc-0e7cb7df7ea2`, workspace `c6ddebcc-a8cf-4ec0-ac84-077264bb01f9` (coolbeans-hq). 0 projet actuellement, 3 labels déjà présents (`Bug` `684ea5ba-2519-4237-9929-544921294989`, `Feature` `f48edf56-eb44-4771-bddb-7ea44a2ecc27`, `Improvement` `194654bf-d922-44f9-adc3-f3cabc0754e1`).
- Statuts par défaut de la team (déjà en place, rien à créer) : Backlog `19684ff3`, Todo `559fc092`, In Progress `27af2842`, In Review `17330cb2`, Done `c23cf5c9`, Canceled `3adfac28`, Duplicate `8871eb14`.
- **Limites d'API constatées en reconnaissance** : le MCP `linear-server` n'expose aucun outil pour créer une team, modifier les réglages d'une team (Triage / Cycles / Estimates), promouvoir un label team → workspace, ni créer une vue personnalisée. Le MCP `claude_ai_Asana` n'expose aucun outil d'archivage de projet. Toutes ces actions sont donc manuelles, détaillées pas à pas dans la tâche concernée.
- **Écart constaté vs le spec** : 28 tâches Asana ouvertes dans les 6 projets Coolbeans, pas 29. Détail par projet (gid Asana) : Site web Coolbeans `1217361878516618` (4), myCoolbeans `1217409019426531` (11), 🛟 Support Coolbeans `1217414522363591` (0), Contenu blog Coolbeans `1217422464853438` (2), .🧱 [MODÈLE] Projet client `1217425444849319` (6), 🤖 Workflow Claude ↔ Asana `1217426987220674` (5 ouvertes sur 6 — 1 déjà complétée). Team Asana Coolbeans gid `1217361878516615`, workspace Asana gid `1201457508335146`.

---

### Task 1: Labels Bug / Feature / Improvement → niveau workspace

**Files:** N/A — opération Linear (UI + vérification API), aucun fichier repo touché.

**Interfaces:**
- Consumes: labels existants `684ea5ba-2519-4237-9929-544921294989` (Bug), `f48edf56-eb44-4771-bddb-7ea44a2ecc27` (Feature), `194654bf-d922-44f9-adc3-f3cabc0754e1` (Improvement), actuellement rattachés à la team Coolbeans.
- Produces: mêmes labels, visibles par toute team du workspace (nécessaire pour la team « Modèle client » de la Task 4 et pour toute team cliente future).

- [ ] **Step 1: Manuel (Ludo) — promouvoir les 3 labels**

Dans Linear : Team Settings → Coolbeans → Labels → pour chacun de `Bug`, `Feature`, `Improvement`, ouvrir le menu `...` sur la ligne du label et choisir l'option de passage au workspace (le libellé exact peut être « Move to workspace » ou apparaître sous Workspace Settings → Labels → « Add team label to workspace » selon la version de l'UI — chercher l'option qui rattache le label au workspace plutôt qu'à la team). Aucun outil API disponible pour cette étape (pas de `update`/`delete` sur les labels côté MCP Linear).

- [ ] **Step 2: Vérification différée**

La vérification fiable nécessite une deuxième team pour confirmer qu'un label workspace y apparaît sans y avoir été créé. Elle est faite à la Task 4, Step 3, une fois la team « Modèle client » créée : `mcp__linear-server__list_issue_labels(team=<id Modèle client>)` doit renvoyer les 3 mêmes labels.

---

### Task 2: Config de la team Coolbeans — Triage, Cycles hebdo, Estimates

**Files:** N/A — opération Linear (UI + vérification API partielle).

**Interfaces:**
- Consumes: team Coolbeans `64bf4683-6650-4250-96bc-0e7cb7df7ea2`, actuellement 0 cycle (`list_cycles` renvoie `[]`).
- Produces: un cycle actif d'1 semaine (lu par `list_cycles`), utilisé comme filtre par la vue « Mon sprint » (Task 5) et par les issues créées en Task 6.

- [ ] **Step 1: Manuel (Ludo) — activer Triage**

Team Settings → Coolbeans → Triage → activer. Fait de cette team la boîte d'arrivée native pour tout ticket entrant (intégrations, futur portail).

- [ ] **Step 2: Manuel (Ludo) — activer Cycles**

Team Settings → Coolbeans → Cycles → activer → Durée : 1 semaine → Jour de démarrage : au choix de Ludo (recommandation : lundi, pour aligner sur la semaine calendaire — à répliquer ensuite sur la team « Modèle client » et toute team cliente à cycles actifs, pour que « mon sprint » désigne la même semaine partout comme demandé par le spec section 4).

- [ ] **Step 3: Manuel (Ludo) — activer Estimates**

Team Settings → Coolbeans → Estimates → activer → choisir l'échelle (le spec section 4 dit « échelle de points simple, choisie à l'activation, ajustable ensuite » — une échelle Fibonacci courte 1-2-3-5-8 ou linéaire 1-2-3-4-5 conviennent, au choix de Ludo).

- [ ] **Step 4: Vérification (moi) — cycle actif**

`mcp__linear-server__list_cycles(teamId="64bf4683-6650-4250-96bc-0e7cb7df7ea2", type="current")` doit renvoyer un cycle non vide. Triage et Estimates n'ont pas d'endpoint de lecture exposé par ce MCP : confirmation visuelle par Ludo suffit pour ces deux réglages.

---

### Task 3: Les 3 projets de la team Coolbeans

**Files:** N/A — opération Linear, entièrement automatisable via API.

**Interfaces:**
- Consumes: team Coolbeans `64bf4683-6650-4250-96bc-0e7cb7df7ea2`.
- Produces: 3 projets Linear (noms exacts ci-dessous), le 3ᵉ avec 2 milestones. Ces noms de projet sont réutilisés tels quels comme valeur du paramètre `project` en Task 6.

- [ ] **Step 1: Créer les 3 projets**

```
mcp__linear-server__save_project(name="Site web Coolbeans", addTeams=["64bf4683-6650-4250-96bc-0e7cb7df7ea2"])
mcp__linear-server__save_project(name="Portail myCoolbeans", addTeams=["64bf4683-6650-4250-96bc-0e7cb7df7ea2"])
mcp__linear-server__save_project(name="Workflow Claude Code ↔ Linear", addTeams=["64bf4683-6650-4250-96bc-0e7cb7df7ea2"])
```

- [ ] **Step 2: Créer les 2 milestones du projet Workflow**

```
mcp__linear-server__save_milestone(project="Workflow Claude Code ↔ Linear", name="Intégration Git + convention de branche/commit")
mcp__linear-server__save_milestone(project="Workflow Claude Code ↔ Linear", name="Délégation d'agent (Agent Session Linear)")
```

- [ ] **Step 3: Vérification**

`mcp__linear-server__list_projects(team="64bf4683-6650-4250-96bc-0e7cb7df7ea2")` doit renvoyer les 3 projets. `mcp__linear-server__list_milestones(project="Workflow Claude Code ↔ Linear")` doit renvoyer les 2 milestones.

---

### Task 4: Team dormante « Modèle client »

**Files:** N/A — opération Linear (UI, largement manuelle).

**Interfaces:**
- Consumes: réglages de la team Coolbeans (Task 2) comme référence à répliquer ; labels workspace (Task 1) à vérifier ici.
- Produces: id de la team « Modèle client », à reporter dans la Task 8 (SOP) comme cible de « Copy team settings » pour l'onboarding d'un client.

- [ ] **Step 1: Manuel (Ludo) — créer la team**

Workspace Settings → Teams → New team → nom `Modèle client`, choisir un préfixe court (ex. `MOD`) pour ne pas entrer en collision avec un futur préfixe client. Ne pas la rejoindre (retirer sa propre appartenance après création si Linear l'ajoute par défaut), pour ne pas l'encombrer dans la sidebar personnelle.

- [ ] **Step 2: Manuel (Ludo) — répliquer la config de référence**

Mêmes réglages que Task 2 sur cette nouvelle team : Triage activé, Cycles activés (même durée 1 semaine, même jour de démarrage que Coolbeans), Estimates activés (même échelle). Statuts par défaut Linear laissés tels quels (correspondance déjà correcte, spec section 3). Si souhaité maintenant, créer un template de ticket minimal (Team Settings → Modèle client → Templates) ; sinon, reporter à la première utilisation réelle lors d'un onboarding — ne bloque pas cette tâche.

- [ ] **Step 3: Vérification (moi) — team créée + labels bien au workspace**

`mcp__linear-server__list_teams()` doit renvoyer 2 teams. Puis `mcp__linear-server__list_issue_labels(team=<id Modèle client>)` doit renvoyer les 3 labels `Bug`/`Feature`/`Improvement` — si absents, la Task 1 n'a pas réellement promu les labels au workspace, à refaire avant de continuer.

- [ ] **Step 4: Noter l'id de la team**

Consigner l'id renvoyé par `list_teams()` pour « Modèle client » — nécessaire à la rédaction de la Task 8.

---

### Task 5: Vue « Mon sprint »

**Files:** N/A — opération Linear, aucun outil API disponible pour les vues personnalisées.

**Interfaces:**
- Consumes: cycles actifs de chaque team (Task 2 pour Coolbeans, futures teams clientes à cycles actifs).
- Produces: une vue personnelle épinglée, sans équivalent API — confirmation visuelle uniquement.

- [ ] **Step 1: Manuel (Ludo) — créer la vue**

Dans Linear : sidebar → « Views » (ou icône `+` à côté de Views) → New view → Filtres : Assignee = moi, Cycle = active cycles, toutes teams → Group by: Team → activer l'affichage des totaux par groupe (option d'agrégation sur l'estimate si proposée par l'UI) → nommer « Mon sprint » → enregistrer et épingler dans la sidebar personnelle.

- [ ] **Step 2: Confirmation**

Pas de vérification API possible ; Ludo confirme visuellement que la vue affiche bien, une fois Task 2 et au moins un cycle actif en place, le travail assigné à lui groupé par team.

---

### Task 6: Retriage des tâches ouvertes des 6 projets Asana Coolbeans

**Files:** N/A — lecture Asana + création Linear via API, aucun fichier repo touché.

**Interfaces:**
- Consumes: les 6 gid de projets Asana listés dans les Global Constraints (28 tâches ouvertes au total) ; les 3 projets Linear et 2 milestones de la Task 3 ; les labels workspace de la Task 1 ; les statuts de la team Coolbeans (Global Constraints) ; la table de correspondance de statuts du spec section 3.
- Produces: un jeu d'issues Linear validé par Ludo, redessiné (fusions/scissions possibles) à partir des 28 tâches sources plutôt que mappé 1:1, recréé dans la team Coolbeans et assigné à Ludo.

- [ ] **Step 1: Lister les tâches ouvertes par projet**

Pour chacun des 6 projets, appeler :

```
mcp__claude_ai_Asana__get_tasks(project=<gid>, opt_fields="name,completed,assignee,due_on,notes")
```

en filtrant les tâches où `completed=false` (le champ `completed` peut nécessiter d'être ajouté à `opt_fields` selon la réponse par défaut).

- [ ] **Step 2: Lire chaque tâche en détail**

Pour chaque tâche ouverte, appeler :

```
mcp__claude_ai_Asana__get_task(task_id=<gid>, include_comments=true, include_subtasks=true)
```

Lire titre, description, sous-tâches et commentaires pour juger de la pertinence actuelle (date du jour : 2026-08-13).

- [ ] **Step 3: Redessiner, pas mapper 1:1**

Objectif : le meilleur découpage possible pour piloter le travail à venir dans Linear, pas une copie reformulée tâche par tâche. Pour chacune des 28 tâches sources, décider parmi :
- `discard` — périmée, doublon, déjà couverte ailleurs, ou déjà résolue de fait (sous-tâches/commentaires en attestent) ;
- `keep en l'état` — reformulée, mais reste une seule issue ;
- `merge` — plusieurs tâches sources qui décrivent la même chose ou le même petit chantier deviennent **une seule** issue Linear ;
- `split` — une tâche source trop large (plusieurs sous-tâches Asana qui sont en réalité des travaux indépendants) devient **plusieurs** issues Linear, éventuellement rattachées à des milestones différents du projet « Workflow Claude Code ↔ Linear » quand c'est le bon niveau de découpage.

Pour chaque issue cible du résultat (après merge/split), préparer :
- titre reformulé (jamais copié tel quel),
- description resynthétisée, qui référence les tâches Asana sources dont elle est issue (traçabilité au cas où),
- projet Linear cible parmi les 3 de la Task 3 (ou aucun, si transverse),
- label parmi `Bug`/`Feature`/`Improvement` si pertinent,
- statut Linear mappé via la table du spec section 3 (Inbox/Backlog Asana → Backlog, Sprint → Todo, En cours → In Progress, Pour validation → In Review, Terminé → Done — aucune tâche ouverte ne devrait mapper sur Done),
- estimation si évidente à ce stade, sinon laissée vide,
- assigné : Ludo.

- [ ] **Step 4: Présenter le résultat à Ludo avant toute création**

Produire deux listes, pas une correspondance mécanique tâche-par-tâche :
1. Les tâches sources écartées (`DISCARD`), avec la raison en une ligne chacune.
2. Les issues cibles proposées pour Linear, chacune avec son titre, son résumé, son projet/label/statut/estimation, et la liste des tâches Asana sources dont elle découle (une seule pour un `keep`, plusieurs pour un `merge`, une source pouvant apparaître sur plusieurs issues cibles pour un `split`).

Attendre validation explicite de Ludo — ajustements possibles avant de continuer.

- [ ] **Step 5: Créer les issues validées**

Pour chaque issue cible validée :

```
mcp__linear-server__save_issue(
  title=<titre reformulé>,
  team="64bf4683-6650-4250-96bc-0e7cb7df7ea2",
  project=<nom du projet Linear ou omis>,
  labels=[<labels>],
  state=<statut mappé>,
  assignee="me",
  estimate=<valeur ou omis>,
  description=<description resynthétisée>
)
```

- [ ] **Step 6: Vérification**

`mcp__linear-server__list_issues(team="64bf4683-6650-4250-96bc-0e7cb7df7ea2")` — le nombre d'issues doit correspondre exactement au nombre d'issues cibles validées par Ludo à l'étape 4 (après merge/split, ce nombre peut différer des 28 tâches sources).

---

### Task 7: Archivage des 6 projets Asana

**Files:** N/A — opération Asana, manuelle (aucun outil d'archivage exposé par le MCP `claude_ai_Asana`).

**Interfaces:**
- Consumes: confirmation que la Task 6 est terminée et validée par Ludo (précondition bloquante — ne pas archiver avant que le contenu retenu existe bien dans Linear).
- Produces: les 6 projets passent en `archived=true` côté Asana (pas de suppression).

- [ ] **Step 1: Précondition**

Ne démarrer cette tâche qu'après confirmation explicite de Ludo que la Task 6 est complète et satisfaisante.

- [ ] **Step 2: Manuel (Ludo) — archiver chaque projet**

Pour chacun des 6 projets (Site web Coolbeans, myCoolbeans, 🛟 Support Coolbeans, Contenu blog Coolbeans, .🧱 [MODÈLE] Projet client, 🤖 Workflow Claude ↔ Asana) : ouvrir le projet dans Asana → menu `⋯` en haut à droite → « Archive project ». Ne jamais choisir « Delete ».

- [ ] **Step 3: Vérification (moi)**

```
mcp__claude_ai_Asana__get_projects(team="1217361878516615", archived=true)
```

doit lister les 6 projets, et

```
mcp__claude_ai_Asana__get_projects(team="1217361878516615", archived=false)
```

doit n'en lister aucun.

---

### Task 8: Mise à jour du SOP commercial — création de client sur Linear

**Files:**
- Modify: `src/content/docs/coolbeans/01-vente.mdx` (sous-tâche 9 du Modèle A, ~ligne 119 ; section « Modèle B », ~lignes 128-140+)

**Interfaces:**
- Consumes: id de la team « Modèle client » (Task 4, Step 4) ; noms des 3 projets Linear Coolbeans (Task 3, comme exemple de structure de départ) — le spec section 7 comme source de la checklist d'onboarding.
- Produces: SOP à jour, lisible sur `/docs/coolbeans` (rendu via `src/components/doc/Sop.astro` depuis `src/data/sop.ts`).

- [ ] **Step 1: Remplacer la sous-tâche 9 du Modèle A**

Dans la liste des 14 sous-tâches (section « Modèle A · la tâche 🧬 [MODÈLE] Lead »), remplacer le texte actuel de l'item 9 :

> 9. Créer la team Asana du client et y dupliquer le modèle de projet

par :

> 9. Créer la team Linear du client (« Copy team settings » depuis la team « Modèle client ») et y créer le premier projet

- [ ] **Step 2: Réécrire la section « Modèle B »**

Remplacer le contenu de la section « Modèle B · le projet .🧱 [MODÈLE] Projet client » (titre inclus) par une description de la team dormante Linear « Modèle client » : ce qu'elle porte (statuts par défaut Linear, labels workspace `Bug`/`Feature`/`Improvement`, Triage/Cycles hebdo/Estimates activés, template de ticket si créé en Task 4), et le mécanisme de duplication via « Copy team settings » plutôt que la duplication de projet Asana. Retirer le `<Callout type="piege">` sur le point-préfixe : ce piège était spécifique à `src/lib/portail/asana/sync.ts` et n'a plus lieu d'être pour la création d'une team Linear.

- [ ] **Step 3: Ajouter la note sur `linearTeamId`**

Préciser dans la sous-tâche 9 ou juste après que l'ajout du champ `linearTeamId` au registre `src/content/clients/<slug>.yaml` reste un chantier engineering séparé (portail non rebranché sur Linear à ce stade) — pour éviter qu'un futur relecteur du SOP pense que c'est déjà câblé.

- [ ] **Step 4: Relire la page pour toute autre mention résiduelle**

Vérifier qu'aucune autre partie de `01-vente.mdx` ne suppose encore un projet de travail Asana côté client (le pipeline `🎯 crm` et son modèle de lead restent inchangés — c'est uniquement le projet de *travail* du client qui migre).

- [ ] **Step 5: Vérification visuelle**

Lancer le serveur de dev (ou réutiliser une instance déjà lancée) et confirmer avec Ludo le rendu de la page sur `/docs/coolbeans` avant de considérer la tâche terminée. Ne pas commiter sans demande explicite.

---

## Self-Review

**Couverture spec :** Task 1 = spec §5 (labels workspace). Task 2 = spec §4 (Triage/Cycles/Estimates). Task 3 = spec §6 (3 projets Coolbeans + 2 milestones). Task 4 = spec §7 (team dormante modèle). Task 5 = spec §4 (vue « Mon sprint »). Task 6 = spec §9 (retriage, pas import mécanique). Task 7 = spec §10 (archivage, pas suppression). Task 8 = spec §11 point 3 (checklist d'onboarding reportée dans le process réel), déclenché par la demande explicite de Ludo en cours de session.

**Hors scope confirmé :** aucune team cliente existante touchée ; `src/lib/portail/asana/` non modifié ; onboarding du premier client réel = session séparée (spec §11 point 3).

**Points d'attention transverses :** Task 7 dépend d'une validation explicite après Task 6 (pas d'archivage automatique enchaîné). Task 4 dépend du résultat de Task 1 pour sa propre vérification. Task 8 dépend de l'id récupéré en Task 4 et doit être écrite après exécution réelle des tâches 1-7, pour décrire des manipulations UI vérifiées plutôt que supposées. Task 6 vise une organisation optimisée du résultat (demande explicite de Ludo en cours de session) : merge/split autorisés, pas de contrainte de correspondance 1:1 avec les tâches Asana sources.
