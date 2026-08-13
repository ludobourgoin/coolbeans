# Migration de la team Asana Coolbeans vers Linear — design

Date : 2026-08-13 · Statut : validé en brainstorming

## 1. Contexte et objectif

Coolbeans quitte Asana pour Linear comme outil de gestion de projet. Ludo est seul utilisateur de Linear et doit pouvoir planifier sa charge de travail semaine par semaine, tous projets confondus (travail interne Coolbeans + tous les projets clients), sans perdre cette vue d'ensemble en cours de route.

Ce document couvre la migration de la team Asana **Coolbeans** (le travail interne : site web, portail, blog, support, chantiers transverses) vers Linear. La migration d'une team client sera traitée séparément, une fois ce socle en place — mais la structure retenue ici change ce que ça voudra dire concrètement (cf. section 5).

**Hors scope explicite** : rebrancher `myCoolbeans` (`/espace/projets`, `src/lib/portail/asana/`) sur Linear. Le portail continue de lire Asana, dont les données seront figées une fois la team Coolbeans quittée — c'est assumé, à traiter comme chantier engineering séparé.

## 2. Décision structurante : une seule team, les clients sont des Projects

Premier réflexe (team Linear dédiée par client, ou sub-teams) écarté après vérification dans la doc Linear : les Cycles sont strictement scopés par team (« you can't view more than one team's cycles at once »), y compris pour les sub-teams qui ne font qu'hériter du même calendrier sans mutualiser le capacity dial. Avec plusieurs teams, Ludo n'aurait jamais de vue agrégée de sa charge totale — exactement le besoin qu'il a formulé.

**Décision** : une seule team Linear, **Coolbeans** (déjà existante), pour tout — travail interne et tous les clients. Un engagement client devient un **Project** dans cette team, pas une team séparée. Ça donne nativement, sans bidouille :
- Un seul cycle, un seul capacity dial, qui couvre tout le travail assigné à Ludo, tous clients confondus.
- Aucun sujet de plafond de plan Linear (nombre de teams, sub-teams réservées au plan Business) — une team unique suffit indéfiniment.
- Un accès immédiat à l'intégration Git (connectée à la team, pas au Project) pour tous les repos, clients compris.

## 3. Statuts — rien à créer

Les statuts par défaut de la team Linear collent déjà au kanban Asana actuel :

| Asana | Linear |
|---|---|
| 📥 Inbox | Backlog |
| 🧱 Backlog | Backlog |
| 🚀 Sprint | Todo |
| 🚧 En cours | In Progress |
| ☝️ Pour validation | In Review |
| ✅ Terminé | Done |

## 4. Cycles et Estimates — activés

- **Cycles** : activés sur la team Coolbeans, durée 1 semaine. Un seul cycle actif à la fois couvre tout (interne + clients), avec capacity dial calculé sur la vélocité des 3 derniers cycles complétés (estimation grossière au départ, faute d'historique).
- **Estimates** : activés (échelle simple, ex. Fibonacci ou points 1/2/3/5/8 — à choisir dans Team Settings > General au moment de l'activation, ajustable ensuite sans perte de données). Nécessaire pour que le capacity dial ait quelque chose à mesurer.

## 5. Labels d'area (à créer)

`Site web` · `Portail` (myCoolbeans) · `Blog` · `Support` · `Workflow`. Les labels de type existants (`Feature`/`Bug`/`Improvement`) restent inchangés, orthogonaux aux labels d'area. Ces labels couvrent le travail continu, sans date de fin — ce qui ne mérite pas un Project dédié.

## 6. Projects

- **`Workflow Claude Code ↔ Linear`** (renommé depuis « …↔ Asana ») : Project avec 2 milestones — (1) intégration Git + convention de branche/commit, (2) délégation d'agent façon « Agent Session » Linear si utile plus tard. Le spec Asana du 2026-08-12 est remplacé par celui-ci : l'essentiel de ce qu'il proposait de coder à la main (trailer de commit, déplacement de colonne auto) est déjà natif à Linear une fois l'intégration Git branchée.
- **Project Template « Nouveau client »** : remplace le hack Asana `.🧱 [MODÈLE] Projet client` (préfixe-point pour le masquer du portail — hack devenu sans objet, le portail ne lit pas encore Linear). Utilisé pour instancier le Project de chaque futur client dans la team Coolbeans — plus besoin de monter une nouvelle team à chaque client.
- Le reste (site web, portail, blog, support) reste en issues labellisées dans le backlog de la team, sans Project dédié.

## 7. Contenu existant — retriage, pas portage mécanique

Linear propose un import assistant Asana natif (Settings > Administration > Import/Export), mais il copie tel quel (statuts réduits à Backlog/Done, pas de retraitement). Ludo a été explicite : pas de migration tâche par tâche. On relit donc chaque tâche ouverte des 6 projets Asana (29 au total : 11 myCoolbeans, 6 modèle, 6 workflow, 4 site web, 2 blog — 0 support) et on ne recrée dans Linear que ce qui reste pertinent aujourd'hui, avec titre/description reformulés, label d'area + statut mappé, assigné à Ludo. Le bruit et l'obsolète restent de côté.

## 8. Intégration Git

Connecter `github.com/ludobourgoin/coolbeans` à la team Linear Coolbeans — **étape manuelle côté Ludo** (Settings > Integrations > GitHub dans Linear, flow OAuth non déclenchable via API). Une fois branché : nom de branche suggéré par Linear (`ludo/cool-12-titre`), et `Fixes COOL-12` / `Closes COOL-12` dans un commit ou une PR lie et clôt le ticket automatiquement.

## 9. Nettoyage

- Ce spec remplace `docs/superpowers/specs/2026-08-12-workflow-claude-asana-design.md` (jamais implémenté, rien à défaire côté code).
- Les 6 projets Asana sont archivés (pas supprimés) une fois leur contenu porté, pour arrêter leur usage sans perdre l'historique.

## 10. Prochaines étapes

1. `writing-plans` pour le plan d'exécution : activation Cycles/Estimates, création des labels, création du Project Workflow + milestones, création du Project Template, retriage et recréation des issues pertinentes, connexion Git (étape manuelle documentée pour Ludo), archivage des projets Asana, mise à jour du statut de l'ancien spec.
2. Une fois ce socle en place : migration du premier client, qui consistera simplement à instancier un Project depuis le template — plus légère que prévu à l'origine.
