# CRM — Opportunités et check-list d'étapes

Date : 2026-08-19, exécutée le 2026-08-29 · Statut : en vigueur. Modèle appliqué de
bout en bout dans Linear (§9), spec confirmée par Ludo le 2026-08-29 après une seconde
remontée du même symptôme.

Amende `archive/2026-08-15-crm-linear-design.md` §4 (template `🧬 Lead` et ses 14
sous-issues standard). Le reste de cette spec — statuts de pipeline, labels, entrées,
règles d'exploitation — reste en vigueur tel quel.

Ancre Linear : team `🎯 CRM`.

## 1. Le problème

Le design du 2026-08-15 prévoyait **14 sous-issues standard créées à chaque carte**. Ce
n'est pas ce qui s'est passé. Au 2026-08-19, les 22 opportunités ouvertes portent 17
sous-issues au total, et aucune n'est une étape du modèle : ce sont des actions réelles
et datables — « Relancer Jeanne », « Faire le point sur le montant à facturer », « Mail
de suivi (rebranding) ».

L'usage a donc déjà tranché : **la sous-issue sert à porter la prochaine action, pas à
dérouler un process**. Créer les 14 d'avance produirait ~300 issues fantômes pour 22
affaires, chacune héritant d'un statut de pipeline qui ne veut rien dire pour elle.

Deux symptômes le confirment :

- **Les sous-issues héritent des statuts du pipeline.** Une action comme « Relancer
  Simon » se retrouve dans 📝 Devis envoyé ou 🏗️ En production, statuts qui décrivent
  l'état d'une affaire, pas l'avancement d'une tâche.
- **Le Triage est pollué.** 15 des 17 sous-issues y stagnent, faute de statut qui leur
  convienne. Or le Triage est censé ne contenir que les mails de prospects entrants :
  tant qu'il sert de fourre-tout, l'audit « Triage en attente (SLA 4 h) » du brief
  commercial est faux.

## 2. Décision — le modèle hybride

**La check-list vit dans la description. La sous-issue porte la prochaine action.**

- Les **14 étapes standard** deviennent une check-list markdown dans la description de
  l'opportunité, posée par le template à la création. Elle ne porte ni date ni
  assignation : c'est un aide-mémoire de process, coché au fil de l'eau.
- Les **sous-issues sont réservées aux actions réelles** : celles qui doivent remonter
  dans « Mes issues » avec une date et un assigné. Soit une action hors modèle, soit une
  étape standard promue en prochaine action parce qu'elle mérite une échéance.

La règle d'or ne bouge pas : **une opportunité vivante a toujours au moins une sous-issue
assignée et datée.** Cocher une case ne la remplace pas — la case dit « c'est fait », la
sous-issue dit « c'est la prochaine chose à faire, et c'est pour tel jour ».

Ce qu'on gagne : un board lisible, un Triage rendu à son usage, et la check-list qui
devient un révélateur de dettes (au 2026-08-19, quatre affaires en production sans fiche
client `src/content/clients/<slug>.yaml`).

Ce qu'on perd, assumé : les étapes standard ne sont plus requêtables une par une (« quelles
affaires n'ont pas encore leur dossier Drive ? » se lit à l'œil dans la description, pas
en filtre). Pour 22 affaires suivies par une personne, le filtre ne manquait à personne.

## 3. Le gabarit de description

```markdown
## Fiche

- **Source** :
- **Contexte** :
- **Besoin exprimé** :
- **Budget évoqué** :
- **Échéance souhaitée** :
- **Décideur** :
- **Devis** : /devis/<slug>
- **Projet Proposal** :
- **Drive** :

## Check-list

### Avant-vente et signature

- [ ] 1 · Qualifier : besoin, budget, échéance, décideur
- [ ] 2 · Envoyer le lien de réservation
- [ ] 3 · Faire le rendez-vous de découverte
- [ ] 4 · Cadrer le périmètre et chiffrer
- [ ] 5 · Rédiger et publier le devis
- [ ] 6 · Relancer à J+3, J+7, J+14
- [ ] 7 · Émettre la facture d'acompte dans Tiime
- [ ] 8 · Vérifier l'encaissement de l'acompte

### Onboarding et solde

- [ ] 9 · Créer la team Linear du client depuis « Modèle client »
- [ ] 10 · Créer le dossier Drive et le lier dans les notes du projet
- [ ] 11 · Créer la fiche client `src/content/clients/<slug>.yaml`
- [ ] 12 · Créer l'utilisateur Clerk et le portail
- [ ] 13 · Envoyer le mail de bienvenue
- [ ] 14 · Émettre la facture de solde dans Tiime
```

Les 14 libellés sont repris à l'identique du modèle Asana d'origine et de la spec du
2026-08-15 : la migration ne change pas le process, seulement son support.

## 4. Décision — des statuts d'action distincts

**Contrainte Linear à connaître : le jeu de statuts est un attribut de la team.** Il n'y
a pas de workflow séparé pour les sous-issues — parent et enfants piochent dans la même
liste. Un « jeu de statuts dédié aux sous-issues » se construit donc, pas se configure.

Retenu : **trois statuts ajoutés à la team CRM, réservés par convention aux sous-issues.**

| Statut | Catégorie Linear | Usage |
|---|---|---|
| `Todo` | Unstarted | Action posée, pas commencée |
| `Doing` | Started | Action en cours |
| `Done` | Completed | Action faite |

Trois règles les tiennent :

1. **L'absence d'emoji est le signal.** Les 12 statuts de pipeline en portent tous un ;
   les trois statuts d'action, aucun. Un coup d'œil suffit à voir qu'on a mis une carte
   là où elle n'a rien à faire.
2. **Chacun se range en fin de sa catégorie**, pour que le pipeline se lise de gauche à
   droite sans changement : `👋 Contacté` puis `Todo` dans Unstarted, `Doing` après
   `📝 Solde envoyé` dans Started, `Done` après `✅ Soldée` dans Completed.
3. **Les vues pipeline masquent les sous-issues** (View options → *Sub-issues* → off).
   Les trois colonnes restent alors vides sur le board des opportunités, et l'inverse est
   vrai d'une vue filtrée sur les actions.

Écarté : sortir les actions dans une autre team (Coolbeans) pour hériter de son workflow.
Linear l'autorise — une sous-issue peut vivre dans une autre team que son parent — mais la
team CRM est privée et pas Coolbeans : « Relancer Jeanne » y deviendrait lisible de tout
le workspace. Le confort de configuration ne vaut pas cette fuite.

## 5. Décision — vocabulaire

L'issue principale du CRM s'appelle désormais une **Opportunité**. Le mot remplace les
deux termes qui coexistaient : « Lead » (nom du template) et « affaire » (spec, `sop.ts`,
doc commerciale).

| Terme | Désigne | Remplace |
|---|---|---|
| **Opportunité** | La carte CRM : un projet potentiel, du premier contact au solde réglé | « Lead » (carte), « affaire » |
| **Prospect** | La personne en face | « lead » au sens humain |
| **Action** | Une sous-issue datée et assignée | « sous-tâche » (ère Asana) |

Une seule exception gardée : **speed-to-lead**, nom de la métrique de SLA (carte créée et
lien de réservation envoyé sous 4 h ouvrées). C'est un terme de métier, il ne se traduit
pas utilement.

Un client peut porter plusieurs opportunités en parallèle — c'est déjà le cas d'Amusoire,
qui en a quatre. Le mot le dit mieux que « lead », qui laissait entendre une personne, et
mieux qu'« affaire », qui laissait entendre une commande déjà tenue.

## 6. Les trois gestes Linear

**Correction du 2026-08-29 : c'est faux.** L'API GraphQL expose `workflowStateCreate`
et `templateUpdate`, le MCP Linear non. Les trois gestes ont donc été faits par API, et
la version d'origine de ce paragraphe est ce qui les a laissés dormir dix jours. Règle
à en tirer : avant de renvoyer un geste à l'UI, vérifier en GraphQL, pas dans les outils
du MCP (voir la note du statut `Proposal`, créé de la même façon).

1. **Créer les statuts.** Settings → Team `🎯 CRM` → Workflow → `Todo` (Unstarted),
   `Doing` (Started), `Done` (Completed), rangés en fin de catégorie (§4, règle 2).
2. **Renommer et réécrire le template.** Team Settings → Templates → `🧬 Lead` →
   `🧬 Opportunité`, description remplacée par le gabarit du §3. Les 14 sous-issues du
   template sont supprimées.
3. **Corriger la description de la team**, qui dit encore « Une issue = une AFFAIRE » :

   > Pipeline commercial Coolbeans. Une issue = une OPPORTUNITÉ, c'est-à-dire un projet
   > potentiel — jamais un client : un même client peut en avoir plusieurs en parallèle,
   > et une personne sans projet identifié reste dans le vivier (Sheet) ou dans sa team
   > client. L'opportunité n'a pas de due date et porte la check-list des 14 étapes ; ses
   > sous-issues sont les actions, elles portent date, assignation et statut
   > Todo/Doing/Done. Spec : docs/superpowers/specs/2026-08-19-crm-opportunites-checklist-design.md

## 7. Migration

Fait dans la session du 2026-08-19 :

- **Check-list posée sur les 22 opportunités ouvertes**, cases pré-cochées d'après le
  statut de pipeline, qui fait preuve pour les étapes 1 à 8 et 14. L'issue d'ops
  récurrente `CRM-1` est laissée telle quelle : ce n'est pas une opportunité.
- Les étapes **9 à 13** ne sont cochées que sur preuve vérifiable (team Linear du client
  existante, fiche `src/content/clients/<slug>.yaml` présente). Le reste attend une passe
  de Ludo sur les quatre affaires en production.

Reste à faire, une fois les statuts créés (§6.1) :

- **Sortir les 17 sous-issues du Triage** vers `Todo` / `Doing` / `Done`. Faisable par
  l'API, à lancer sur ordre.

## 8. Documentation

Le chantier n'est pas *done* tant que ces pages ne sont pas à jour. Elles sont toutes les
deux encore à l'ère Asana — leur réécriture Linear était déjà listée comme chantier induit
par la spec du 2026-08-15 (§8) et n'a pas été faite. **Le renommage de vocabulaire voyage
avec cette réécriture**, il ne se fait pas séparément : renommer « affaire » en
« opportunité » dans une page qui parle encore de colonnes Asana et de « Mes tâches »
n'apporterait rien.

| Page | Ce qu'il faut y faire |
|---|---|
| `src/content/docs/coolbeans/02-vente.mdx` | Réécriture Asana → Linear complète : conventions du CRM, pipeline (12 statuts au lieu des colonnes), « Modèle A · la tâche 🧬 [MODÈLE] Lead » → le template `🧬 Opportunité` et sa check-list, disparition de `🧰 Modèles` |
| `src/data/sop.ts` | `colonnesCrm` → statuts Linear, `outils: ["Asana — 🎯 crm"]` → `["Linear — team CRM"]` sur les 22 étapes, champ `echeance` reformulé (sous-issue au lieu de sous-tâche), S10 « team Asana » → « team Linear », en-tête du fichier |

À tracker en COO.

## 9. Exécution du 2026-08-29

Le modèle n'avait jamais atteint Linear : la branche portant cette spec n'était pas
mergée, les statuts d'action n'existaient pas, et le template continuait de créer les
14 sous-issues. Le symptôme est revenu de lui-même le 2026-08-26 avec l'opportunité du
salon (`CRM-46`), créée avec dix sous-issues numérotées. Tout a été fait dans la session
du 2026-08-29, par API :

- **Statuts d'action créés** dans la team CRM : `Todo` (unstarted, 2000), `Doing`
  (started, 9500, après `🧊 En veille`), `Done` (completed, 2003, après `✅ Soldée`).
  Sans emoji, conformément au §4.
- **Template réécrit** : `🧬 Lead` devient `🧬 Opportunité`, ses 14 sous-issues sont
  supprimées, sa description devient le gabarit du §3. Note technique : `templateData`
  accepte `description` en markdown, converti côté serveur ; `descriptionData` n'est
  plus lisible sur `Issue` par l'API. Note de comportement : la création d'issue par API
  avec `templateId` n'appliquait déjà pas `subIssueData`, seule l'UI le faisait.
- **32 sous-issues migrées** : 17 en `Todo`, 4 en `Done`, 6 archivées (étapes de process
  du salon devenues des cases), 3 déplacées vers la team REV, 2 laissées en `🪦 Perdu`.
  Le `📥 Triage lead` ne contient plus aucune sous-issue : l'audit SLA speed-to-lead
  mesure enfin les vrais leads entrants.
- **Description de la team corrigée** (§6.3), vocabulaire « opportunité » compris.
- **Salon `CRM-46`** : check-list posée avec ses lignes « sans objet, pro bono », section
  « Propre à cette affaire » pour les deux actions hors gabarit, et renvoi explicite vers
  la team REV. `CRM-51/52/54` deviennent `REV-26/27/28` dans le projet Site du salon ;
  `CRM-53` et `CRM-55` sont archivées au profit de `REV-11` et `REV-15`, qui existaient
  déjà et ont reçu leurs dates. Principe : la production ne se duplique pas entre le CRM
  et la team du client.

**État après migration** : 25 opportunités, 23 sous-issues (contre 32), zéro sous-issue
de process.

**Dettes révélées par la règle d'or** : neuf opportunités vivantes sans action
ouverte, deux avec deux actions, et un doublon `CRM-8` / `CRM-34`.

## 10. Suite immédiate, le même jour

Cette spec a été dépassée en quelques heures. L'après-midi du 2026-08-29, le board
était de nouveau illisible : le modèle hybride sépare les *vocabulaires* (emoji =
affaire, sans emoji = action) mais pas les *axes*, or dans Linear les workflow states
sont par team, pas par type d'objet. Une convention humaine sans contrainte technique
dérive.

La suite est `2026-08-29-crm-pipeline-refonte-design.md`, qui **laisse le modèle
hybride en vigueur** et refait l'axe des statuts : 10 colonnes d'affaires, actions
réduites à `Todo` / `Done`, board filtré `Sub-issues: exclude`. Elle a été exécutée
dans Linear le 2026-08-29 en fin d'après-midi, et elle a traité les dettes ci-dessus
(§7 de cette spec-là). Les noms de statuts cités dans le présent document sont donc
périmés : `🎯 Besoins définis` est devenu `🎯 À chiffrer`, `🚀 Acompte réglé` →
`🏆 Signée`, `📝 Solde envoyé` → `🧾 Solde à encaisser`, et `☄️ Relancé`, `💪 Négo`,
`🏗️ En production` et `Doing` n'existent plus.

Le §8 (réécriture Asana → Linear de `02-vente.mdx` et `sop.ts`) reste ouvert, et il
est repris avec deux dettes de plus par le §8 de la spec du 2026-08-29.
