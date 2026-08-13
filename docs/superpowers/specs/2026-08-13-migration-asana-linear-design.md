# Migration de la team Asana Coolbeans vers Linear — design

Date : 2026-08-13 · Statut : validé en brainstorming (v2, remplace la v1 mono-team du même jour)

## 1. Contexte et objectif

Coolbeans quitte Asana pour Linear comme outil de gestion de projet. Ludo est seul utilisateur de Linear. Il planifie ses sprints seul, semaine par semaine, avec une vélocité suivie **par client** (pas besoin de vue de charge agrégée toutes teams confondues : besoin explicitement retiré pendant le brainstorming, après avoir été le pivot d'une première version mono-team de ce design).

Contraintes structurantes exprimées :
- Une dizaine de projets actifs en moyenne, davantage à terme.
- Un repo GitHub distinct par client.
- Développement à venir d'une application web complexe pour un client.
- Les clients créeront des tickets depuis leur portail (my.coolbeans.cc) et ces tickets doivent arriver dans l'espace du client, pas mélangés aux autres.
- Budget accepté pour le plan Linear Business (~14-16 $/mois pour un siège).

**Hors scope explicite** : rebrancher le portail `myCoolbeans` (`/espace/projets`, `src/lib/portail/asana/`) sur Linear. Le portail continue de lire Asana, dont les données seront figées : assumé, chantier engineering séparé. La migration du premier client est aussi une session séparée.

## 2. Décision structurante : une team Linear par client

Une première version de ce design retenait une team unique (argument : capacity dial global, les Cycles étant strictement scopés par team dans Linear). Ce besoin ayant été retiré, la structure bascule sur ce que les autres contraintes imposent :

- **Une team par client**, créée au moment de l'onboarding du client, jamais en avance. Chaque team a son préfixe de tickets (`FYLGO-3`, etc.).
- **Coolbeans est une team comme les autres** (« client zéro », même logique que le portail) : préfixe `COO`, elle porte les projets web et techniques internes.
- **Plan Business requis** : teams illimitées (Free plafonne à 2, Basic à 5), plus sub-teams et teams privées si utile un jour.

Argument décisif : le routage des tickets portail. Chaque team a sa **Triage** (boîte d'arrivée native, activable par team) ; le portail créera les tickets via l'API Linear directement dans la Triage de la team du client. Le registre clients (`src/content/clients/`) gagnera un champ `linearTeamId` (implémenté dans le chantier portail, pas ici).

## 3. Statuts — rien à créer

Les statuts par défaut de Linear collent au kanban Asana actuel :

| Asana | Linear |
|---|---|
| 📥 Inbox | Triage (ou Backlog) |
| 🧱 Backlog | Backlog |
| 🚀 Sprint | Todo |
| 🚧 En cours | In Progress |
| ☝️ Pour validation | In Review |
| ✅ Terminé | Done |

## 4. Cycles et Estimates — par team, là où le rythme le justifie

- **Cycles** : activés sur la team Coolbeans (durée 1 semaine), et sur les teams clients à activité soutenue (dont la future app web complexe). Laissés éteints sur les clients à activité sporadique. Calendriers alignés (même durée, même jour de démarrage) pour que « mon sprint » désigne la même semaine partout.
- **Estimates** : activés (échelle de points simple, choisie à l'activation dans Team Settings, ajustable ensuite). La vélocité et le capacity dial sont lus par team, conformément au besoin.
- **Vue « Mon sprint »** : vue personnalisée toutes teams (assigné à moi + cycle actif, groupée par team) pour voir tout le travail de la semaine en un écran, avec totaux par groupe.

## 5. Labels

- `Bug` / `Feature` / `Improvement` (existants dans la team Coolbeans) passent au **niveau workspace** pour être partagés par toutes les teams.
- `Blog` : label dans la team Coolbeans (2 tâches actives, travail continu ; promu en projet plus tard si le volume le justifie).

## 6. Projects de la team Coolbeans

- **Site web Coolbeans**
- **Portail myCoolbeans**
- **Workflow Claude Code ↔ Linear** (renommé depuis « …↔ Asana ») : 2 milestones, (1) intégration Git + convention de branche/commit, (2) délégation d'agent façon « Agent Session » Linear si utile plus tard. Ce spec remplace celui du 2026-08-12 : l'essentiel de ce qu'il proposait de coder à la main (trailer de commit, déplacement de colonne automatique) est natif à Linear une fois l'intégration Git branchée.

Support : pas de projet dédié ; les demandes clients arriveront dans la Triage de leur team, le support interne dans la Triage de Coolbeans.

## 7. Onboarding d'un nouveau client (remplace le modèle Asana)

Le hack Asana `.🧱 [MODÈLE] Projet client` (préfixe-point pour masquer du portail) est remplacé par :
- Une team dormante **« Modèle client »** portant la config de référence (statuts, labels, templates de tickets, config cycles), que Ludo ne rejoint pas pour ne pas encombrer la sidebar.
- Checklist d'onboarding : créer la team du client via « Copy team settings » depuis le modèle, connecter son repo GitHub, ajouter le `linearTeamId` au registre du portail.

## 8. Intégration Git

- Connexion GitHub au niveau du workspace (**étape manuelle côté Ludo** : Settings > Integrations > GitHub, flow OAuth non déclenchable via API), en donnant accès aux repos concernés, dont `github.com/ludobourgoin/coolbeans`.
- Pas de lien dur repo ↔ team dans Linear : le lien est par ticket, via le nom de branche suggéré (`ludo/coo-12-titre`) ou `Fixes COO-12` dans un commit/PR, depuis n'importe quel repo connecté. La correspondance « repo du client ↔ tickets de sa team » tient par l'usage.
- Automatisations Git configurées **par team** (statut quand la PR s'ouvre, quand elle merge, format de nom de branche), incluses dans la team modèle.

## 9. Contenu existant — retriage, pas portage mécanique

Linear propose un import assistant Asana natif, écarté : il copie tel quel (statuts réduits à Backlog/Done, pas de retraitement), contraire à la demande explicite de Ludo. On relit chaque tâche ouverte des 6 projets Asana (29 au total : 11 myCoolbeans, 6 modèle, 6 workflow, 4 site web, 2 blog, 0 support) et on ne recrée dans Linear que ce qui reste pertinent, avec titre/description reformulés, projet ou label adapté, statut mappé, assigné à Ludo.

## 10. Nettoyage

- Ce spec remplace `docs/superpowers/specs/2026-08-12-workflow-claude-asana-design.md` (jamais implémenté, rien à défaire côté code).
- Les 6 projets Asana sont archivés (pas supprimés) une fois leur contenu porté.

## 11. Prochaines étapes

1. Prérequis manuels côté Ludo : passage au plan Business, connexion OAuth GitHub.
2. `writing-plans` pour le plan d'exécution : labels workspace, Cycles/Estimates sur Coolbeans, création des 3 projets + milestones, team « Modèle client », vue « Mon sprint », retriage des 29 tâches, archivage Asana.
3. Ensuite, session séparée : onboarding du premier client réel via la checklist de la section 7.
