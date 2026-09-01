# Skill `shutdown` : rituel de fin de journée et revue hebdomadaire sur Linear

Date : 2026-09-01
Statut : design validé, implémentation à faire
Livrable : `~/.claude/skills/shutdown/` (user-level privé, sauvegardé via `~/dev/dotfiles`)

## 1. Le problème

Ludo ouvre sa journée sans savoir ce qu'il doit faire, et la ferme sans savoir
ce qu'il a laissé tomber. Linear contient tout le travail mais ne dit rien de
ce qui compte aujourd'hui.

Constat chiffré au 2026-09-01, sur les issues ouvertes assignées à Ludo :

| Mesure | Valeur |
|---|---|
| Issues ouvertes assignées | 334 |
| Front réel (Todo, In Progress, In Review, triage, colonnes CRM actives) | 73 |
| Issues du front sans estimate | 44 sur 73 |
| Issues du front sans priorité | 32 sur 73 |
| Issues en retard | 18, la plus ancienne au 2026-08-07 |
| Issues en In Review (donc en attente d'un tiers) | 9 |
| Répartition de priorité sur les 334 | Urgent 7, High 90, Medium 157, Low 47, aucune 34 |
| Issues portant une `dueDate` | 42 sur 250, concentrées sur CRM (26/33), REV (10/31), AMU (3/7) |
| Teams sans aucune date | SPI, ENH, CAF, MIH, AMA, UNL, OID, LIT, et COO à 2 sur 77 |
| Cycles | activés sur 16 teams sur 17, hebdomadaires, mais 7 issues seulement dedans |

Trois conclusions structurent tout le design.

**La visualisation n'est pas le problème.** Linear la fournit déjà (My Issues
groupé par Priority). Le problème est qu'aucun signal fiable ne dit « ça, c'est
pour cette semaine » : 83 % des issues n'ont ni date ni cycle.

**La priorité seule ne peut pas ordonner une journée.** 90 issues en High n'est
pas un plan. Il faut un second axe d'ordonnancement, que la skill `linear`
n'apporte pas.

**L'invariant de priorité de la skill `linear` est déjà violé.**
`references/priorite.md` pose que plus de 20 % du backlog en Urgent ou High
vide l'échelle de son sens. Le workspace est à 97 sur 335, soit 29 %.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Source de vérité du plan | `dueDate`. Les cycles Linear sont abandonnés |
| Rituels | Un quotidien le soir, un hebdomadaire le vendredi soir en extension du quotidien |
| Périmètre | Linear, plus le mail entrant, plus le calendrier. Pas le nettoyage physique |
| Capacité | Temps de travail = 8 h moins les rendez-vous du jour moins 1 h de marge. Capacité en issues = temps de travail moins 1 h de bloc CRM |
| Actions CRM | Un bloc unique de 1 h par jour, jamais d'estimate en points |
| Estimates manquants | Posés d'office, sauf sur les projets en statut Proposal |
| Écriture Linear | Aucune écriture sans validation en lot du récapitulatif |
| Écriture calendrier | Un créneau par issue, sur un agenda Google dédié `Linear` que la skill possède seule |
| Créneaux de rituel | `Shutdown` 18h-18h30 tous les jours et `Weekly` vendredi 18h30-19h30, sur l'agenda Coolbeans, créés une fois par la skill après validation |
| Weekly planning | Répartition jour par jour sur lundi à vendredi |
| Weekly review | Bilan de la semaine, projets et jalons en danger, lot d'hygiène, updates de projet |
| Mail | Lecture et brouillon seulement. Aucun envoi, jamais |
| Nom | `shutdown` |
| Emplacement | `~/.claude/skills/shutdown/`, privé, sauvegardé par `dotfiles` |

## 3. Pourquoi les cycles sont abandonnés

Un cycle Linear est un objet de team. Ludo travaille sur 17 teams. Il n'existe
pas de cycle transverse au workspace, donc un cycle hebdomadaire imposerait 17
cérémonies parallèles pour une seule personne. Les chiffres confirment que
c'est déjà mort : 16 teams ont les cycles allumés et 7 issues seulement y sont
rattachées.

La `dueDate` traverse les teams, comme une journée de travail. C'est le seul
signal dont la forme correspond au besoin.

Conséquences à assumer :

- La vue custom `Mon sprint` (assigné à moi et cycle actif) devient sans objet.
- Le groupement `Focus` de My Issues perd sa section Cycle. Ludo utilise déjà
  le groupement par Priority à la place.
- Désactiver les cycles sur les 16 teams est un geste de configuration à la
  main de Ludo. La skill ne le fait pas.

## 4. Articulation avec la skill `linear`

Trois couches, sans duplication.

**Couche lue par chemin.** Le `SKILL.md` de `shutdown` pointe vers les
références de `linear` plutôt que de les recopier :

| Fichier | Ce que `shutdown` y prend |
|---|---|
| `~/.claude/skills/linear/references/priorite.md` | Échelle 1 à 4, départages, invariant des 20 % |
| `~/.claude/skills/linear/references/estimation.md` | 1 point vaut 1 heure, plafond à 8, journée de 7 h facturée |
| `~/.claude/skills/linear/references/taxonomie.md` | Teams, labels Type et Domaine, routage projet |
| `~/.claude/skills/linear/references/redaction.md` | Conventions de titre et de description |

Une modification de ces fichiers se propage aux deux skills.

**Couche déléguée.** Toute création ou réécriture d'issue passe par la skill
`linear`. `shutdown` n'écrit jamais une issue lui-même. C'est ce qui garantit
le comportement attendu sur une demande du type « Répondre au mail de Susanne
pour CAFA » : l'étape 3 de `linear` cherche d'abord dans la team CAF, présente
au maximum 3 issues proches, et propose commenter, enrichir, créer une
sous-issue, lier, ou créer. La création d'une issue nouvelle est le dernier
recours, pas le premier réflexe.

`shutdown` écrit en propre uniquement des champs de planification sur des
issues existantes : `dueDate`, `estimate`, `priority`, `stateId`.

**Couche propre à `shutdown`.** Ce que `linear` ne couvre pas : l'ordre
d'exécution (section 5), le calcul de capacité (section 6), le barème des
actions courtes CRM (section 6), l'écriture calendrier (section 7), et les deux
flux rituels (sections 8 et 9).

## 5. Doctrine d'ordonnancement

`priorite.md` dit quelle priorité attribuer à une issue. Il ne dit pas comment
choisir cinq choses parmi 90 High. C'est l'apport propre de cette skill.

Cinq rangs, appliqués dans l'ordre jusqu'à saturation de la capacité :

1. **Urgent (priorité 1).** Toutes, sans exception. Si les P1 dépassent déjà la
   capacité du jour visé, la skill le dit explicitement au lieu de tronquer en
   silence, et propose lesquelles décaler.
2. **Ce qui débloque de l'argent.** Solde à encaisser, devis en attente de
   réponse, facture bloquée. Détection : team CRM en statut `🧾 Solde à
   encaisser` ou `📝 Devis envoyé`, ou issue dont le titre ou la description
   mentionne un solde, un acompte ou une facture. Justification : les 700 €
   d'AMA Languedoc sont bloqués depuis août faute d'un mécanisme qui les
   remonte.
3. **Engagements datés.** `dueDate` inférieure ou égale au jour visé, les
   retards d'abord, du plus ancien au plus récent.
4. **Relances de ce qui attend chez un tiers.** Issues en `In Review`, ou
   portant un blocage externe, sans mouvement depuis plus de 7 jours. Effort
   faible, levier élevé. Justification : l'invitation « domain manager » d'Oïde
   non acceptée depuis le 2026-08-25, l'accès Figma d'Hugo qui bloque
   LittleBox, les 9 issues en In Review.
5. **Le reste**, par priorité décroissante puis par ancienneté.

Une issue sans estimate et sans priorité n'entre à aucun rang. Elle est
comptée dans les signaux d'hygiène, pas dans le plan.

## 6. Calcul de capacité

Deux grandeurs distinctes, à ne jamais confondre dans la sortie de la skill.

```
temps de travail d'un jour
  = 8 h
  - somme des rendez-vous du calendrier pour ce jour
    (les créneaux de rituel de la section 7.1 en font partie)
  - 1 h de marge d'imprévu

capacité planifiable en issues
  = temps de travail
  - 1 h de bloc CRM (si au moins une action CRM est due ce jour-là)
```

Le bloc CRM est du travail réel : il compte dans le temps de travail. Il est
retiré de la capacité planifiable parce qu'il n'est pas rempli par des issues
estimées, mais par des actions courtes sans points (voir plus bas).

| Jour sans autre rendez-vous | Temps de travail | dont CRM | Capacité en issues |
|---|---|---|---|
| Jour normal | 6,5 h | 1 h | **5,5 h** |
| Vendredi | 5,5 h | 1 h | **4,5 h** |

Ces chiffres restent cohérents avec `estimation.md`, qui pose qu'une journée
facturée vaut environ 7 h effectives : la base est à 8 h, la marge d'imprévu
ramène à 7 h, et le rituel prélève la demi-heure restante.

**Vocabulaire imposé à la skill.** Elle dit « X h de travail demain, dont 1 h de
CRM, donc Y h d'issues planifiables ». Elle n'annonce jamais un chiffre unique
appelé « capacité » sans dire laquelle des deux grandeurs il désigne.

**Sources calendrier.** Notion Calendar est un client sans API : il affiche des
agendas Google. La skill lit donc Google Calendar, ce qui revient au même. Les
agendas retenus pour le calcul :

| Agenda | Rôle dans le calcul |
|---|---|
| `ludo@coolbeans.cc` (Coolbeans) | Rendez-vous réels **et créneaux de rituel**, déduits de la capacité |
| `Body` | Indisponibilité, déduite de la capacité si le créneau est daté |
| Import Garmin | Ignoré |
| Agenda dédié « Linear » (section 7) | **Toujours exclu**, sous peine de circularité |

**Garde-fou de confiance.** Si l'agenda du jour visé est vide, la skill le dit
au lieu de conclure à 5,5 h disponibles. L'agenda contenait 2 événements sur les
7 jours suivant le 2026-09-01, ce qui ne reflète pas une semaine de travail
réelle. Formulation attendue : « aucun rendez-vous trouvé demain, je planifie 5,5 h ;
corrige si ton agenda n'est pas à jour ».

**Événements qui sont des tâches.** Un événement journée entière sans invité
dont le titre décrit une action (constaté : « Mail Patrice AMA » au 2026-09-02)
est signalé comme candidat à devenir une issue Linear, via la skill `linear`.
Il n'est pas compté comme un rendez-vous.

**Barème des actions courtes CRM.** Une sous-issue de la team CRM (relancer,
répondre, appeler) ne reçoit jamais d'estimate en points : les points sont
réservés au travail facturable et alimentent les devis. Ces actions sont
regroupées dans le bloc CRM de 1 h. Si le lot du jour dépasse une heure, la
skill liste celles à reporter plutôt que d'étendre le bloc.

**Estimates posés d'office.** Sur une issue du front sans estimate, la skill
pose une valeur en appliquant `estimation.md`, avec sa justification en une
phrase. Exception ferme : **jamais sur une issue rattachée à un projet en
statut `Proposal`**, où elle se contente de signaler le manque. Ces projets
alimentent les devis, un chiffre inventé y deviendrait un engagement
commercial.

## 7. Écriture dans le calendrier

Deux natures d'objets, deux agendas, et la distinction est structurante.

| | Créneaux de rituel | Créneaux d'issues |
|---|---|---|
| Quoi | Le shutdown quotidien et le weekly | Le travail planifié, une issue par créneau |
| Agenda | `ludo@coolbeans.cc` (Coolbeans) | Agenda dédié `Linear` |
| Nature | De vrais rendez-vous avec soi-même | Des blocs jetables |
| Cycle de vie | Créés une fois, jamais régénérés | Supprimés et recréés à chaque passage |
| Effet sur la capacité | Déduits, comme tout rendez-vous | Aucun, l'agenda est exclu du calcul |

### 7.1 Les deux créneaux de rituel

Deux événements récurrents sur l'agenda `ludo@coolbeans.cc` :

| Événement | Récurrence | Créneau |
|---|---|---|
| `Shutdown` | Tous les jours | 18 h 00 à 18 h 30 |
| `Weekly` | Tous les vendredis | 18 h 30 à 19 h 30 |

Le weekly s'enchaîne immédiatement après le shutdown du vendredi, dans l'ordre
prévu par le spec : le flux quotidien tourne d'abord, puis la revue et le
planning de la semaine.

**Création.** Au premier lancement, la skill détecte l'absence de ces
récurrences, montre exactement ce qu'elle va créer, et écrit après accord
explicite de Ludo. C'est la **seule écriture jamais autorisée** sur l'agenda
Coolbeans. Elle n'a lieu qu'une fois : les récurrences ne sont ensuite ni
régénérées, ni déplacées, ni supprimées par la skill. Si Ludo les déplace à la
main, la skill respecte la nouvelle heure sans commentaire.

**Effet sur la capacité.** Ces créneaux vivant sur l'agenda de référence, ils
sont déduits par le calcul de la section 6 sans traitement particulier :

| Jour | Temps de travail | Capacité en issues |
|---|---|---|
| Jour normal | 8 − 1 marge − 0,5 shutdown = 6,5 h | 5,5 h |
| Vendredi | 8 − 1 marge − 0,5 shutdown − 1 weekly = 5,5 h | 4,5 h |

### 7.2 L'agenda dédié aux créneaux d'issues

Le plan validé est matérialisé en créneaux Google Calendar, pour être visible
sur tous les appareils via Notion Calendar.

**Un agenda dédié, possédé par la skill.** Un agenda Google séparé, nommé
`Linear`, créé le 2026-09-01. Son identifiant, à utiliser directement sans
résolution par nom :

```
c_87c3c54a53a1a48ca56f5ee207f1c08d42945ac80ca356c881e822cf112ce48e@group.calendar.google.com
```

La skill y a tous les droits et n'écrit nulle part ailleurs.
Trois raisons, dont une est une contrainte de correction et pas de confort :

1. **Circularité.** La capacité se calcule comme 8 h moins les rendez-vous. Si
   les blocs de travail étaient écrits sur `ludo@coolbeans.cc`, le passage
   suivant les relirait comme des rendez-vous et conclurait à 0 h disponible.
   L'agenda `Linear` est exclu du calcul (section 6).
2. **Régénération sans risque.** À chaque passage, la skill supprime ses
   créneaux futurs sur `Linear` et les recrée depuis le plan validé. Aucun vrai
   rendez-vous ne peut être touché par cette opération.
3. **Réversibilité.** Décocher l'agenda dans Notion Calendar suffit à faire
   disparaître tout le dispositif, sans rien nettoyer.

**Forme d'un créneau.** Un créneau par issue planifiée, posé séquentiellement
dans les trous laissés par les vrais rendez-vous, à partir de 9 h.

- Titre : `IDENTIFIANT · Titre de l'issue`, par exemple `COO-132 · Trancher et
  planifier le remplacement de Clerk par Better Auth`.
- Durée : l'estimate en heures. Les actions CRM sont regroupées dans un unique
  créneau `CRM · N actions` d'une heure.
- Description : l'URL Linear de l'issue, son projet, et la mention du rang qui
  l'a fait entrer dans le plan.
- Disponibilité : `transparent` (libre), pour ne pas bloquer une prise de
  rendez-vous.

**Portée de la régénération.** Seuls les créneaux à partir d'aujourd'hui sont
supprimés et recréés. Le passé n'est jamais touché : c'est lui qui sert de
journal du plan pour le bilan hebdomadaire (section 9).

**Garde-fou.** Si l'agenda `Linear` est introuvable, la skill s'arrête sur ce
point et demande sa création. Elle ne se rabat jamais sur l'agenda principal.

## 8. Flux quotidien, le soir

### 8.1 Collecte

Une seule passe, requêtes en parallèle :

- Linear, le front : issues assignées à Ludo en statut `started`, `unstarted`,
  `triage`, plus les colonnes actives du CRM. Champs : `identifier`, `title`,
  `estimate`, `priority`, `dueDate`, `state`, `team`, `project`, `updatedAt`,
  `parent`, `url`.
- Linear, les notifications non lues.
- Gmail, les messages non lus ou non traités de la boîte principale.
- Google Calendar, les événements du lendemain sur `ludo@coolbeans.cc` et `Body`.

Le volume est borné par le front (73 issues au 2026-09-01), jamais par les 334
issues ouvertes.

### 8.2 Tableau de bord

Quatre blocs, dans cet ordre, chacun avec son compte :

1. **En retard.** Issues dont la `dueDate` est passée, de la plus ancienne à la
   plus récente, avec le nombre de jours de retard.
2. **Dû demain.** Issues déjà datées au lendemain.
3. **En attente d'un tiers.** `In Review` ou blocage externe, avec le nombre de
   jours depuis le dernier mouvement.
4. **Signaux d'hygiène.** Une ligne, pas un tableau : nombre d'issues du front
   sans estimate, sans priorité, et pourcentage Urgent plus High sur le
   workspace.

### 8.3 Triage du mail

Chaque message non traité aboutit à une des quatre sorties :

1. Rien à faire, on classe.
2. Se rattache à une issue existante : ajouter un commentaire, via `linear`.
3. Devient une issue : passer la main à la skill `linear`, qui applique sa
   détection de doublons avant toute création.
4. Appelle une réponse : préparer un **brouillon** Gmail.

**Garde-fou non négociable : aucun envoi de mail.** La skill lit et rédige des
brouillons. Elle n'envoie jamais, ne répond jamais, ne transfère jamais, quelle
que soit la formulation de la demande. Règle héritée de `CLAUDE.md` : aucun
contact client sans ordre explicite de Ludo, donné pour ce message précis.

### 8.4 Composition du plan de demain

Appliquer la doctrine d'ordonnancement (section 5) jusqu'à la capacité calculée
(section 6). Le plan produit est une liste ordonnée, chaque ligne portant :
identifiant, titre, projet, estimate retenu, et le rang qui l'a fait entrer.

Le plan du lendemain posé par le weekly du vendredi est le point de départ : le
rituel du soir le rééquilibre, il ne le refait pas de zéro. Ce qui n'a pas été
fait aujourd'hui est repoussé explicitement, avec sa nouvelle date, jamais
silencieusement.

Cas à traiter explicitement :

- **Les P1 saturent déjà la capacité** : le dire, proposer lesquelles décaler,
  ne pas trancher seul.
- **La capacité n'est pas remplie** : proposer des candidats du rang 5, sans
  forcer. Une journée à 4 h planifiées vaut mieux qu'une journée à 5,5 h de
  remplissage arbitraire.
- **Une issue du plan n'a pas d'estimate** : la poser d'office selon la règle
  de la section 6, ou la signaler si le projet est en Proposal.
- **Une issue glisse pour la troisième fois** : le signaler. Trois reports
  successifs veulent dire que l'issue est mal découpée, mal estimée, ou pas
  vraiment voulue.

### 8.5 Récapitulatif et validation

Un seul tableau, soumis en bloc, listant **toutes** les écritures envisagées :
dates posées, dates repoussées, estimates posés d'office, priorités posées,
changements de statut, issues à créer (avec le renvoi vers `linear`), brouillons
de mail préparés, créneaux calendrier à créer ou supprimer.

Rien ne s'écrit avant validation. Ludo valide en bloc ou corrige ligne par ligne.
C'est la règle cardinale de `linear`, adaptée au lot pour ne pas imposer vingt
validations successives.

### 8.6 Écriture puis clôture

Écriture des champs dans Linear, puis régénération des créneaux sur l'agenda
`Linear`.

La skill affiche ensuite trois lignes fixes, que Ludo coche lui-même :

1. Boîte mail vidée, traitée ou reportée.
2. Bureau physique dégagé.
3. Onglets et fenêtres fermés.

Ces trois lignes ne sont ni vérifiées ni automatisées. Elles donnent au rituel
sa fin. La skill n'en fait aucun suivi.

## 9. Flux hebdomadaire, le vendredi soir

Le vendredi, le flux quotidien s'exécute normalement, puis enchaîne sur ce bloc.
Il se déroule en deux temps : on regarde en arrière, puis on pose la semaine.

### 9.1 Revue de la semaine écoulée

**Bilan.** Trois chiffres et leur écart :

- Heures planifiées : somme des durées des créneaux passés de l'agenda `Linear`
  sur les 7 derniers jours. L'agenda dédié sert de journal du plan, aucun
  fichier d'état supplémentaire n'est nécessaire. Lors de la première semaine,
  l'agenda est vide : la skill annonce le bilan comme non calculable plutôt que
  d'afficher un écart de 100 %.
- Heures bouclées : somme des estimates des issues passées en statut terminé
  pendant la semaine (`completedAt` dans la fenêtre).
- Ce qui a glissé : issues dont la `dueDate` tombait dans la semaine et qui
  sont encore ouvertes, avec le nombre de reports subis.

L'écart entre planifié et bouclé est le seul matériau qui permette de calibrer
les estimates, comme le prévoit `estimation.md`, section Calibration. S'il
dépasse 30 % deux semaines de suite, le signaler comme un défaut d'estimation
et non comme un défaut de discipline.

**Projets et jalons en danger.**

- Projets actifs dont aucune issue n'a bougé depuis plus de 14 jours. Pour
  chacun : est-ce une pause assumée ou un oubli ?
- Milestones à moins de 14 jours, avec la charge restante en heures issue des
  estimates rattachés. Un jalon dont la charge dépasse le temps restant est
  signalé comme intenable, avec l'écart chiffré.
- Affaires CRM sans sous-issue Todo datée. Application de la règle d'or de
  `linear` : une affaire vivante porte toujours au moins une action datée, y
  compris en `🧊 En veille` où la relance se date à J+30 ou J+90.

**Lot d'hygiène.** 10 à 15 issues du front sans estimate ou sans priorité,
traitées d'un coup avec justification, hors projets Proposal. Au rythme d'un lot
par semaine, les 44 issues sans estimate sont résorbées en un mois. Plus le
contrôle de l'invariant des 20 % : si Urgent plus High dépasse ce seuil,
proposer une passe de dégradation. Le workspace est à 29 % au 2026-09-01.

**Mises à jour de projet.** Un update hebdomadaire par projet mené, comme Linear
le recommande. Proposer un texte par projet actif. Ces updates sont internes :
ils ne partent vers aucun client, et le portail `my.coolbeans.cc` n'est pas
alimenté par ce geste.

### 9.2 Planning de la semaine à venir

La capacité est calculée **jour par jour** pour lundi à vendredi, avec la
formule de la section 6 appliquée à chacun des cinq jours depuis l'agenda.

La doctrine d'ordonnancement (section 5) est appliquée sur l'ensemble de la
semaine, et les issues retenues sont réparties dans les cinq journées :

- Les rangs 1 et 2 vont au plus tôt dans la semaine.
- Une issue portant une `dueDate` externe déjà engagée est placée avant cette
  date, jamais dessus.
- Une issue dont l'estimate dépasse la capacité d'une journée est signalée pour
  découpage, conformément au plafond de 8 de `estimation.md`. Elle n'est pas
  étalée sur deux jours.
- La capacité de chaque jour n'est jamais dépassée. Le reliquat non planifié est
  affiché en fin de tableau, avec son volume en heures.

Le résultat est écrit en `dueDate` sur chaque issue, et matérialisé en créneaux
sur l'agenda `Linear` pour les cinq jours (section 7). C'est ce qui permet de
prendre de l'avance le week-end : le lundi et le mardi sont déjà lisibles le
vendredi soir.

**Effet cascade assumé.** Poser cinq jours à l'avance signifie que le glissement
du lundi fausse le reste. La parade n'est pas de renoncer à planifier, c'est le
rééquilibrage de chaque soir (section 8.4), où tout report est explicite et daté.

## 10. La vue Linear « Aujourd'hui »

Une vue custom à créer une fois, en complément de My Issues groupé par Priority
que Ludo utilise déjà.

- Filtre : assigné à Ludo, statut non terminé et non annulé, `dueDate`
  inférieure ou égale à aujourd'hui. Les retards sont donc visibles dans la même
  vue que le jour même, ce qui est le comportement voulu.
- Affichage : board, groupé par projet.

Trois limites techniques à connaître :

- `customViewCreate` n'est pas exposé par le MCP Linear. La création passe par
  GraphQL direct avec `LINEAR_API_KEY` (présent dans `coolbeans/.dev.vars`).
- Une icône invalide fait échouer `customViewCreate` avec un message d'erreur
  qui accuse le filtre. Constat du 2026-08-30.
- Le mode board et le groupement par projet sont des préférences d'affichage,
  réglées en un clic dans l'interface après création. L'API pose le filtre, pas
  la présentation.

Le workspace porte déjà 4 vues : `Affaires`, `Mes actions`, `Timeline`,
`Mon sprint`. Cette dernière devient sans objet une fois les cycles abandonnés.

## 11. Structure des fichiers

```
~/.claude/skills/shutdown/
  SKILL.md              routage des deux modes, règle cardinale, garde-fous
  references/
    quotidien.md        le flux du soir, étape par étape
    hebdomadaire.md     la revue et le planning du vendredi
    doctrine.md         ordonnancement, capacité, barème CRM, estimates d'office
    collecte.md         les requêtes Linear, Gmail et Calendar, avec leurs champs
    calendrier.md       agenda dédié, forme des créneaux, règles de régénération
```

Le `SKILL.md` reste court : il route, il pose les garde-fous, il renvoie. Les
références portent le détail.

## 12. Déclenchement

Mots déclencheurs : « shutdown », « je ferme la journée », « on ferme »,
« planifie demain », « rituel du soir », « revue de la semaine », « revue
hebdo », « planifie la semaine », `/shutdown`.

**Séparation avec la skill `cloture`.** `cloture` traite la fin d'une
**conversation** et garde « clôture », « fais le point », « questions en
suspens », « je peux fermer ». `shutdown` traite la fin d'une **journée**. Le
`SKILL.md` de chacune nomme l'autre pour lever l'ambiguïté si la formulation
est douteuse.

## 13. Modèle d'exécution

Le flux quotidien est mécanique : lire, trier, compter, écrire après validation.
Il ne demande pas de raisonnement de haut niveau. La skill recommande donc en
tête de fichier de la lancer sous `sonnet` plutôt que sous un modèle premium.

## 14. Hors périmètre

- Le nettoyage physique du bureau et le rangement digital, au-delà des trois
  lignes de clôture non vérifiées.
- L'envoi de tout mail.
- La création ou la modification de projets Linear.
- L'écriture sur un autre agenda que `Linear`, à la seule exception de la
  création initiale des deux récurrences de rituel (section 7.1).
- La désactivation des cycles sur les 16 teams : geste de configuration à la
  main de Ludo.
- Toute publication ou déploiement.
- Le suivi du temps réellement passé, minute par minute. Le bilan hebdomadaire
  compare des heures planifiées à des heures bouclées, pas du temps mesuré.

## 15. Critères de réussite

- Un rituel du soir tient en moins de 10 minutes une fois le front assaini.
- Aucune issue en retard de plus de 7 jours ne survit à deux revues hebdo
  consécutives sans décision explicite.
- Les 44 issues du front sans estimate sont résorbées en un mois de lots
  hebdomadaires.
- Le ratio Urgent plus High repasse sous 20 %.
- L'écart entre heures planifiées et heures bouclées passe sous 30 %.
- Aucun mail n'est jamais parti sans ordre explicite.

## 16. Gestes préalables à la main de Ludo

Ces trois gestes conditionnent le premier passage de la skill :

1. ~~Créer l'agenda Google `Linear`~~ **fait le 2026-09-01.** Reste à l'afficher
   dans Notion Calendar.
2. Valider, au premier lancement, la création des deux récurrences de rituel sur
   l'agenda Coolbeans (section 7.1).
3. Décider du sort des cycles sur les 16 teams concernées.
4. Valider la création de la vue Linear « Aujourd'hui ».
