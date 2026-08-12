# Workflow Claude Code ↔ Asana, inspiré de Linear — design

Date : 2026-08-12 · Statut : validé en brainstorming, en attente de relecture finale

## 1. Contexte et objectif

Coolbeans utilise Asana comme référentiel de tâches (sprints internes, boards clients). Claude Code y intervient déjà de deux façons distinctes, qu'il ne faut pas confondre :

1. **En session interactive** (ce document) : Ludo et Claude Code travaillent ensemble sur des tickets Asana, avec les outils Asana MCP disponibles en direct dans la session.
2. **Côté serveur, dans le Worker Cloudflare** (sprint S1 du portail, `src/lib/portail/asana/`) : un client HTTP Asana maison, lecture seule, qui alimente le module Projets du portail client via KV. Ce module reste hors périmètre de ce document — aucune modification n'y est prévue.

Point de départ de la réflexion : Linear vend une architecture où un ticket peut être **délégué** à un agent IA — l'agent reste responsable de l'exécution, un humain reste assigné et responsable du résultat, et chaque étape de l'agent s'affiche comme activité dans le fil du ticket (« Agent Session »). Une **coding session** va plus loin : elle ouvre une sandbox, produit un diff/PR affiché et mergeable directement depuis Linear.

Coolbeans n'a pas vocation à rapatrier des diffs dans Asana — GitHub reste le lieu du code et de la revue. Ce qui vaut la peine d'être repris de Linear, ce n'est pas le mécanisme (sandbox intégrée, review inline), c'est le **modèle** : le ticket comme fil d'activité partagé entre humain et agent, avec un statut qui reflète l'avancement réel du code sans geste manuel.

**Frictions actuelles, à l'origine de ce design :**
- Aucun lien entre un commit/PR et le ticket Asana correspondant — la traçabilité est manuelle.
- Aucune autonomie : chaque intervention sur un ticket part d'un prompt tapé à la main, sans mécanisme pour déléguer un ticket à Claude Code.
- Aucune mémoire persistante par ticket : une nouvelle session repart de zéro sur un sujet déjà touché, sans historique structuré.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Découpage | Deux phases distinctes. Phase 1 : skill + convention, quasi zéro code, livrée dans ce design. Phase 2 : déclenchement automatique par webhook, esquissée ici, **spec séparée** à écrire une fois l'usage réel de la Phase 1 disponible. |
| Où vit l'exécution (Phase 1) | En session Claude Code interactive, via les outils Asana MCP déjà disponibles — pas de nouveau client HTTP, pas de nouveau module applicatif dans le repo `coolbeans`. |
| Déclencheur (Phase 1) | Manuel : `/asana-ticket <id-ou-url>`, ou déclenchement automatique de la skill par correspondance de description (lien Asana collé, formulation « prends ce ticket »), comme les autres skills du repo `my-skills`. |
| Mémoire par ticket | Le fil de commentaires du ticket Asana lui-même — pas de nouveau système de stockage. Chaque commentaire posté par Claude Code sert de point de reprise pour une future session sur ce même ticket. |
| Lien commit ↔ ticket | Trailer de commit `Asana-Task: <url>`, posé automatiquement par la skill dès qu'une session démarre sur un ticket. Pas de convention de nom de branche à respecter côté Ludo. `git log --grep "Asana-Task:"` fait foi. |
| Déclenchement du lien git → Asana | Dans `finishing-a-development-branch` (skill existante) : si la branche porte un ou plusieurs trailers `Asana-Task:`, poster un commentaire de synthèse sur chaque ticket référencé et le déplacer en colonne **« ☝️ Pour validation »**. |
| Format du commentaire | Un seul commentaire par ticket, posté à la fin (pas un par commit) : résumé en 1-3 phrases, lien(s) commit/PR, mention du déplacement de colonne. |
| Colonnes utilisées | Celles déjà documentées par le sync S1 (`todo` / `in_progress` / `to_validate` / `done`, insensibles aux emojis par team) — aucune nouvelle colonne, aucune nouvelle convention de statut. |
| Documentation | Ce workflow est documenté côté interne (repo `my-skills`, index des skills) **et** mentionné dans la documentation de my.coolbeans.cc, indépendamment de la suite donnée à ce design. |

## 3. Architecture (Phase 1)

Aucun composant serveur. Trois pièces, toutes côté outillage Claude Code :

- **Skill `coolbeans-dev:asana-ticket`** (nouvelle, dans `my-skills/6-coolbeans-dev/skills/`) : lit la tâche visée (titre, description, sous-tâches, fil de commentaires complet) via les outils Asana MCP, en fait la synthèse, démarre le travail avec ce contexte, et instruit d'ajouter le trailer `Asana-Task: <url>` à tout commit créé pendant cette session sur ce ticket — de façon prospective (aucune réécriture de commits déjà créés avant l'invocation de la skill).
- **Extension de `finishing-a-development-branch`** (skill existante, `superpowers`) : en fin de branche, avant de présenter le menu de fusion, `git log --grep "Asana-Task:"` sur la plage de commits de la branche. Pour chaque URL de ticket trouvée (dédupliquées), poster le commentaire de synthèse et déplacer la colonne via les outils Asana MCP.
- **Documentation** : entrée dans `my-skills/Index des skills.md` pour la nouvelle skill, et un paragraphe dans la doc de my.coolbeans.cc décrivant le workflow (à faire indépendamment du sort de ce design).

Pas de nouvelle dépendance, pas de nouveau binding, pas de nouveau secret : les outils Asana MCP utilisés sont déjà connectés à la session.

## 4. Cas d'erreur et limites (Phase 1)

- **Trailer `Asana-Task:` absent** → `finishing-a-development-branch` continue sans étape Asana. Amélioration optionnelle, jamais bloquante.
- **Plusieurs tickets référencés sur une même branche** → chacun reçoit son commentaire et son déplacement de colonne, pas seulement le premier trouvé.
- **Ticket introuvable, déjà terminé ou archivé** → le commentaire est posté si possible (traçabilité), mais aucune tentative de déplacement arrière ; l'anomalie est signalée dans le rapport de fin de tâche, jamais passée sous silence.
- **Panne ou erreur de l'API Asana au moment de commenter/déplacer** → n'interrompt jamais la fin du travail de code. Le git reste la source de vérité ; l'échec du lien Asana est signalé, à retenter à la prochaine occasion.
- **Skill invoquée sur un lien qui n'est pas une tâche** (projet, portfolio) → le dire clairement plutôt qu'improviser une interprétation.

## 5. Validation

Pas de suite de tests automatisés — c'est une skill et une convention, pas du code applicatif exécuté en production. Validation par usage réel : essayer sur 2-3 tickets de sprints en cours, ajuster le format du commentaire et le mapping de colonnes si besoin. Cet usage réel est aussi ce qui doit nourrir le périmètre exact de la Phase 2 (quelle catégorie de tâches répétitives mérite un déclenchement automatique — non tranché ici, volontairement).

## 6. Phase 2 (esquisse, hors périmètre d'implémentation de ce design)

Pour mémoire, à concevoir dans un spec séparé une fois qu'un signal d'usage réel de la Phase 1 existe :

- Un endpoint Worker recevant les webhooks Asana (même famille que `POST /api/admin/sync` du sprint S1), avec handshake `X-Hook-Secret`.
- Un déclenchement de session Claude Code sans intervention humaine (agents planifiés/cloud), scopé à une catégorie de tâches étroite et bien définie — pas un déclenchement généralisé sur tout ticket assigné.
- Réutilisation intégrale de la convention de trailer/commentaire/colonnes de la Phase 1 : aucune reconception.
- Point de vigilance déjà repéré dans le plan du sprint S1 : les webhooks Asana ont été écartés une première fois pour le sync du portail (coût du handshake et du cycle de vie par projet jugé disproportionné face à un simple polling). La Phase 2 réintroduit ce coût délibérément, cette fois pour un vrai besoin de déclenchement (pas de synchronisation de données) — à documenter explicitement dans le spec de Phase 2 pour ne pas paraître contredire l'arbitrage du plan S1 sans explication.

## 7. Prochaines étapes

1. Relecture de ce design par Ludo.
2. `writing-plans` pour un plan d'implémentation de la Phase 1 (essentiellement : rédaction de la skill `asana-ticket`, extension de `finishing-a-development-branch`, mise à jour de l'index des skills, paragraphe de doc mycoolbeans).
3. Usage réel sur quelques tickets avant d'envisager la Phase 2.
