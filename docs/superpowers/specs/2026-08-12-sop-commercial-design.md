# SOP commercial Coolbeans : du lead à l'après-vente

**Date** : 2026-08-12
**Statut** : design validé, prêt pour plan d'implémentation

## Intention

Une page unique dans la doc Coolbeans qui décrit, de bout en bout, le cycle de vie
d'une affaire : premier contact, qualification, devis, négociation, signature,
production, livraison, après-vente. Elle sert d'aide-mémoire opérationnel pour Ludo,
seule personne à l'exécuter aujourd'hui.

Deux modèles Asana en découlent, décrits ici et créés dans un second temps : une
tâche modèle pour un lead dans le projet `🎯 crm`, un projet modèle pour la
production dans la team du client.

## Contraintes

- **Asana en plan gratuit, et ça ne changera pas.** Pas de champs personnalisés, pas
  de règles ni d'automatisations, pas de modèles de projet personnalisés, pas de
  dépendances, pas de dates de début, pas de jalons, pas de formulaires. Disponibles :
  sections, étiquettes, dates d'échéance, sous-tâches, tâches récurrentes, duplication
  de projet et de tâche (sous-tâches incluses).
- Le site n'embarque pas de moteur de diagramme (pas de mermaid). Les pages de doc
  sont du MDX rendu par `src/pages/docs/[project]/[...slug].astro`, derrière Clerk.
- Ludo travaille seul. Toute étape qui suppose un tiers est hors périmètre.

## Décisions structurantes

### La doc Coolbeans devient un manuel d'exploitation

`src/content/docs/` héberge aujourd'hui des **docs de passation techniques**, une par
client (`amusoire/`, plus le gabarit `_template/`). La doc Coolbeans est un cas à
part : c'est le manuel d'exploitation de l'entreprise, dont `Vente` est la première
page. D'autres sections pourront s'y ajouter (Finance, Production, Marketing).

Cette distinction est ferme : **pour un client, la doc reste purement technique.**
Aucun contenu d'exploitation Coolbeans ne doit fuir dans une doc client, et le
gabarit `_template/` ne change pas.

L'accès est déjà correct : `src/middleware.ts` protège `/docs` derrière Clerk et
l'autorisation par projet se fait dans la page. Seuls Ludo et un admin verront
`/docs/coolbeans/`.

### La carte CRM suit l'argent, le projet Asana suit le travail

Une carte du projet `🎯 crm` représente **une affaire**, du premier contact jusqu'au
règlement de la facture de solde. Elle reste ouverte pendant toute la production.

Un projet dans la team du client représente **le travail** : il naît à l'encaissement
de l'acompte et vit au-delà de la clôture de la carte CRM, puisque l'après-vente
(garantie, étude de cas, suivi) s'y déroule.

Le projet `👨‍💼 projects` de la team `Personal` est un vestige. Le SOP ne le mentionne
pas et il n'est plus alimenté.

### Deux étages : le vivier et le pipeline

Le **vivier** est une feuille Google tenue à part : entourage, agences repérées,
directeurs artistiques à contacter pour des collaborations. Ce sont des relations à
entretenir, pas des affaires en cours. Aucun de ces contacts n'a de projet identifié.

Le **pipeline**, c'est le projet Asana `🎯 crm`. Une carte y naît **dès qu'un projet
réel est identifié**, quelle que soit la source : quelqu'un qui appelle, écrit, réserve
un créneau depuis la page de contact, ou un contact du vivier qui remonte un besoin.

Les deux étages restent séparés. Verser le vivier dans le CRM noierait le pipeline sous
des dizaines de cartes dormantes et rendrait la colonne `👋 Contacté` illisible.

Faiblesse connue du vivier : une feuille de calcul n'a ni échéance ni rappel, et le
mode d'échec d'une liste de réseau est de ne jamais être relue. Correctif retenu, et
le seul : **une tâche récurrente mensuelle dans « Mes tâches » d'Asana**, hors de tout
projet, qui déclenche la revue de la feuille. Une seule tâche, aucune pollution du
pipeline. Elle suppose que la feuille porte au minimum une date de dernier contact et
une colonne « prochaine action ».

### Le CRM démarre au premier contact qualifiant, pas après le rendez-vous

La pratique antérieure consistait à créer la carte seulement après un rendez-vous de
découverte concluant, ce qui rendait les colonnes `👋 Contacté` et `📆 Rdv pris`
fictives. Désormais la carte naît dès qu'un projet réel est évoqué, avant même le
rendez-vous. Le coût est de vingt secondes ; le gain est de pouvoir relancer ceux qui
disparaissent entre la première prise de contact et le rendez-vous, et de connaître le
taux de transformation en haut de tunnel.

### Trois conventions remplacent les champs personnalisés absents

1. **La carte ne porte ni date d'échéance ni case cochée : ce sont ses sous-tâches
   qui portent la date et l'assignation.** Une carte représente une affaire, pas une
   action ; elle avance de colonne et se ferme au règlement du solde, sans jamais être
   cochée. Lui coller une échéance la ferait apparaître en retard permanent dans
   « Mes tâches ». C'est la sous-tâche matérialisant la prochaine action qui est
   assignée et datée, remonte dans « Mes tâches » — de fait la liste de travail du
   jour — et se coche une fois faite. Le filet de relance devient : une affaire vivante
   a toujours au moins une sous-tâche assignée et datée.
2. **Étiquettes** pour ce qui se cumule avec l'état : `source-inbound`,
   `source-recommandation`, `source-prospection`, puis `☄️ relance-1`,
   `☄️ relance-2`, `☄️ relance-3`.
3. **Montant dans le titre de la carte** : `[3 500 €] Amusoire — Refonte site`.
   Inélégant, mais c'est le seul moyen de lire le pipeline d'un coup d'œil et de le
   chercher sans champ dédié. Un titre sans montant signifie que l'affaire n'est pas
   encore estimée : c'est une information, pas un oubli. Le montant s'écrit en S4,
   quand le chiffrage s'arrête.

### Le pipeline CRM cible

| # | Colonne | Changement |
|---|---------|------------|
| 1 | `👋 Contacté` | inchangée, redevient le point d'entrée réel |
| 2 | `📆 Rdv pris` | inchangée |
| 3 | `🎯 Besoins définis` | inchangée |
| 4 | `📝 Devis envoyé` | inchangée |
| 5 | `💪 Négo entamée` | inchangée |
| 6 | `🚀 Acompte réglé` | inchangée |
| 7 | `🏗️ En production` | **ajoutée** |
| 8 | `📝 Facture de solde envoyée` | inchangée |
| 9 | `✅ Facture de solde réglée` | inchangée |
| 10 | `🧊 En veille` | **ajoutée** |
| 11 | `🪦 PERDU` | inchangée |
| 12 | `🧰 Modèles` | **ajoutée**, en dernière position, hors pipeline |
| — | `☄️ Lead relancé` | **supprimée** |

`☄️ Lead relancé` disparaît parce qu'une relance est une action, pas un état :
déplacer une carte dans cette colonne effaçait l'information de l'état d'où l'on
relançait, rendant impossible la seule question qui rapporte de l'argent dans un CRM
(« quels devis dorment depuis plus de quinze jours ? »). Ses cartes existantes seront
redispatchées à la main dans leur état réel avant suppression de la colonne.

`🏗️ En production` évite qu'une carte stagne plusieurs semaines dans
`🚀 Acompte réglé` sans qu'on distingue ce qui tourne de ce qui attend.

`🧊 En veille` sépare « pas maintenant, rappelle-moi en septembre » de « perdu ».
Mélangées, les affaires reportées ne sont jamais rouvertes. Une carte en veille porte
obligatoirement une sous-tâche de rappel assignée et datée ; sans elle, la carte
bascule en `🪦 PERDU`.

### Rendu du schéma : grille CSS, pas SVG à coordonnées

Le flux est quasi-linéaire avec trois branches seulement (mise en veille, perte,
boucle de relance). Un graphe libre en SVG exigerait un moteur de placement, soit une
complexité disproportionnée pour trois flèches, et chaque nouvelle étape imposerait de
recalculer des coordonnées à la main.

Le composant rend donc une grille CSS de quatre colonnes, une par phase. Chaque colonne
empile ses étapes ; les connecteurs verticaux sont des pseudo-éléments CSS ; les
branches sont des sorties latérales étiquetées portées par la boîte concernée. Aucune
coordonnée à maintenir, repli en pile sur mobile, et une étape ajoutée aux données se
place d'elle-même.

Les deux étapes de phase `sortie` (mise en veille, perte) ne sont pas une cinquième
colonne : elles se rendent en bandeau sous la grille, les boîtes qui y mènent portant
une flèche latérale étiquetée vers elles.

L'unique étape de phase `amont` (le vivier) se rend en une seule boîte en tête de la
colonne avant-vente, visuellement distincte, avec une flèche vers S1. Elle rappelle que
la moitié des affaires vient d'un contact entretenu de longue date, pas d'un formulaire.

## Architecture

Trois unités, chacune avec une responsabilité unique.

### `src/data/sop.ts` : les données

Source de vérité du process. Un tableau d'étapes typées, plus la liste des phases et
celle des colonnes CRM. Aucun rendu, aucun style.

```ts
export type Phase =
  | "amont"       // S0 : le vivier, en amont du pipeline
  | "avant-vente"
  | "signature"
  | "production"
  | "apres-vente"
  | "sortie";     // S20 et S21 : mise en veille et perte, hors des quatre phases
export type Owner = "coolbeans" | "client" | "les-deux";

export interface Etape {
  id: string;              // "S5"
  phase: Phase;
  titre: string;
  colonneCrm?: string;     // absent si l'étape n'a pas d'état CRM
  declencheur: string;     // ce qui fait entrer dans l'étape
  qui: Owner;
  outils: string[];
  faire: string[];         // actions concrètes, à l'impératif
  sortie: string;          // ce qui prouve que l'étape est finie
  echeance?: string;       // la sous-tâche « prochaine action » à assigner et à dater
  suivants: { vers: string; si: string }[];
  note?: string;
}
```

Les branches sont portées par `suivants` : une entrée par sortie possible, `si`
décrivant la condition. Une étape terminale a un `suivants` vide.

### `src/components/doc/Sop.astro` : le rendu

Lit `sop.ts` et rend deux zones : le schéma (grille de phases) puis les fiches
détaillées, une par étape, ancrées sur `#S5` pour que les boîtes du schéma y renvoient.
Utilise les utilitaires Tailwind branchés sur les tokens de `global.css`, conformément
à la convention du projet. Aucun nom de classe repris de `doc.css` (`.card`
notamment), pour éviter le piège de spécificité connu.

Le composant ne connaît rien du contenu du process : il rend n'importe quel tableau
d'étapes conforme au type.

### `src/content/docs/coolbeans/01-vente.mdx` : la page

Frontmatter `project: "coolbeans"`, `title: "Vente"`, `order: 1`, `status: "final"`.
Le corps porte l'introduction, les conventions du CRM, le `<Sop />`, et les deux
modèles Asana en fin de page. Requiert d'ajouter `doc: coolbeans` dans
`src/content/clients/coolbeans.yaml`.

## Le process, étape par étape

### Phase 0 : amont

**S0 · Vivier de prospection** — aucune colonne CRM
Support : feuille Google tenue à part. Entourage, agences repérées, directeurs
artistiques visés pour des collaborations.
Déclencheur : une personne ou une structure vaut la peine d'être connue.
Faire : l'ajouter à la feuille avec sa date de dernier contact et sa prochaine action ;
la contacter pour faire savoir que Coolbeans existe ; entretenir la relation.
Échéance : tâche récurrente mensuelle dans « Mes tâches » d'Asana pour relire la feuille.
Sortie : rien tant qu'aucun projet n'est évoqué. Le vivier n'a pas vocation à se vider.
Suivants : S1, quand un contact du vivier remonte un projet réel.
Note : ces contacts n'entrent **jamais** dans le CRM tant qu'il n'y a pas de projet
identifié. C'est la frontière entre les deux étages.

### Phase 1 : avant-vente

**S1 · Premier contact** — colonne `👋 Contacté`
Déclencheur : un projet réel est évoqué. Deux sources : entrante (appel, mail,
réservation d'un créneau depuis la page de contact) ou issue du vivier (S0).
Faire : créer la carte au format `[budget évoqué €] Client — Objet` ; poser l'étiquette
de source ; coller le contexte dans la description ; envoyer le lien de réservation
Notion Calendar.
Prochaine action datée : sous-tâche « Envoyer le lien de réservation », à J+2, relance si aucun créneau réservé.
Sortie : lien de réservation envoyé.
Suivants : S2 si réservation ; S20 si « plus tard » ; S21 si hors cible ou silence
après deux relances.

**S2 · Rendez-vous pris** — colonne `📆 Rdv pris`
Déclencheur : créneau réservé.
Faire : cocher « Envoyer le lien de réservation » ; dater « Faire le rendez-vous de découverte » au jour du créneau ; préparer le site
actuel, le secteur, les concurrents, les questions.
Sortie : rendez-vous en agenda.

**S3 · Rendez-vous de découverte** — colonne `📆 Rdv pris`
Faire : cadrer le besoin, le budget, l'échéance, et vérifier qu'on parle au décideur ;
annoncer la suite et le délai d'envoi du devis ; demander l'accord de principe pour
présenter le projet en étude de cas.
Sortie : trois issues. Qualifié vers S4 ; reporté vers S20 avec date de rappel ; hors
cible vers S21.
Note : c'est le premier vrai filtre. Une affaire non qualifiée ne reste pas dans le
pipeline.

**S4 · Besoins définis** — colonne `🎯 Besoins définis`
Faire : arrêter le périmètre inclus et exclu ; chiffrer ; construire l'échéancier
(acompte de 30 %, éventuelles factures intermédiaires, solde), chaque ligne datée ;
construire le planning de jalons.
Sortie : chiffrage et échéancier arrêtés.

**S5 · Devis envoyé** — colonne `📝 Devis envoyé`
Outils : `src/content/devis/<slug>.yaml`, publié sur `/devis/<slug>`.
Faire : rédiger le YAML (sections, budget, planning, notes) ; vérifier que l'échéancier
figure ligne par ligne avec ses dates et que le bloc d'acceptation des CGV est présent ;
publier et envoyer le lien.
Prochaine action datée : sous-tâche « Relancer », redatée à J+3, J+7 puis J+14, avec
les étiquettes `☄️ relance-n` posées sur la carte.
Sortie : le client a reçu le lien.
Suivants : S6 si réponse ; S20 ou S21 si silence après la relance 3.

**S6 · Négociation** — colonne `💪 Négo entamée`
Déclencheur : le client répond par une question ou une objection (réponse `question`
sur la page de devis).
Faire : répondre ; réviser le devis si besoin en publiant une nouvelle version du YAML.
Règle : ne jamais baisser le prix sans retirer du périmètre.
Sortie : nouvelle version envoyée ou accord.

### Phase 2 : signature

**S7 · Validation du devis**
Déclencheur : le client valide sur la page de devis, ce qui transmet raison sociale,
SIREN, adresse, TVA et l'acceptation des CGV.
Faire : archiver le mail de notification. C'est la preuve contractuelle : horodatage,
version des CGV acceptée, identité de facturation.
Sortie : commande ferme.

**S8 · Facture d'acompte** — outil Tiime
Faire : créer le client dans Tiime avec les informations reçues ; émettre la facture
d'acompte de 30 % ; saisir les échéances suivantes aux dates du devis.
Prochaine action datée : sous-tâche « Vérifier l'encaissement de l'acompte », à l'échéance de la facture.
Règle : rien ne démarre avant encaissement.

**S9 · Acompte encaissé** — colonne `🚀 Acompte réglé`
Sortie : feu vert de production. C'est le seul déclencheur du démarrage.

### Phase 3 : production

**S10 · Onboarding** — colonne `🏗️ En production`
Faire, dans l'ordre :
1. créer la team Asana du client ;
2. dupliquer `🧱 [MODÈLE] Projet client` dans cette team, renommer, dater les jalons et
   les tâches d'après-vente ;
3. créer `src/content/clients/<slug>.yaml` avec `nom`, `asana_team_gid`, `doc` ;
4. créer l'utilisateur Clerk avec le mail du contact et son `publicMetadata` ;
5. créer le dossier Drive et le lier dans les notes du projet Asana ;
6. envoyer le mail de bienvenue : accès au portail, canal de communication, rythme des
   points, qui fait quoi, ce qui est attendu du client.

Sortie : le client peut se connecter, le projet est prêt.

**S11 · Exécution**
Faire : travailler par sprints ; les tâches traversent 🧱 Backlog, 🚀 Sprint, 🚧 En
cours, ☝️ Pour validation, ✅ Terminé ; tenir le point client au rythme convenu. Toute demande hors
périmètre part en Inbox et donne lieu à un avenant.
Note : la carte CRM ne bouge plus, elle attend en `🏗️ En production`.

**S12 · Facturation intermédiaire** — outil Tiime
Règle centrale : **les échéances sont fermes et indépendantes de l'avancement**, sauf
retard imputable à Coolbeans. Un client qui tarde à répondre paie quand même aux dates
convenues.
Faire : émettre chaque facture à la date prévue au devis.

**S13 · Recette et mise en ligne**
Faire : recette avec le client sur la base du périmètre du devis, uniquement ;
corrections ; mise en ligne.
Sortie : le site ou les fonctionnalités tournent en production.

**S14 · Doc de passation**
Faire : créer `src/content/docs/<client>/` depuis `_template`, remplir, passer les
pages en `status: final` ; formation si elle était prévue au devis.
Note : cette doc est technique. Elle ne contient rien du fonctionnement interne de
Coolbeans.

**S15 · Mail de livraison**
Faire : récapituler les livrables ; rappeler la garantie de 30 jours **avec sa date de
fin explicite** ; poser les trois questions du témoignage (« qu'est-ce qui posait
problème avant ? », « qu'est-ce qui a changé ? », « à qui le recommanderais-tu ? ») ;
donner les liens vers la doc et le portail.
Note : trois questions courtes obtiennent bien plus de réponses qu'une demande de
témoignage libre, et fournissent une matière directement utilisable dans l'étude de cas.
Sortie : projet livré, garantie ouverte.

**S16 · Facture de solde** — colonnes `📝 Facture de solde envoyée` puis
`✅ Facture de solde réglée`
Faire : émettre le solde dans Tiime ; relancer à J+8 et J+15 ; mise en demeure au-delà.
Sortie : la carte CRM se ferme ici.

### Phase 4 : après-vente

Ces étapes vivent dans le projet client, la carte CRM étant close.

**S17 · Fin de garantie à J+30**
Faire : faire le point de clôture, lister les bugs traités, proposer le care plan
(65 €/h au lieu de 90 €/h).
Note : le contenu exact de l'offre de care plan n'est pas arrêté. Le SOP décrit le
moment et l'intention ; la définition des formules est un chantier séparé.

**S18 · Étude de cas**
Faire : rédiger `src/content/projets/<slug>.md` avec `brouillon: true` ; y intégrer le
témoignage récolté à la livraison ; envoyer au client pour validation du contenu ;
publier en passant `brouillon: false` ; mettre à jour le sitemap et les métadonnées.
Note : l'autorisation de principe a été donnée au devis. Ici seul le contenu se valide.

**S19 · Suivi**
Faire : point trimestriel ; veille sur les opportunités (nouvelle page, refonte,
automatisation, care plan).

### Sorties latérales

**S20 · En veille** — colonne `🧊 En veille`
Une carte en veille porte obligatoirement une sous-tâche « Relancer », assignée et
datée au jour du rappel convenu. Sans elle, la carte bascule en `🪦 PERDU`.

**S21 · Perdu** — colonne `🪦 PERDU`
Noter la raison en commentaire : prix, timing, concurrent, silence, hors cible. Sur le
plan gratuit, c'est la seule donnée exploitable pour améliorer le taux de
transformation.

## Les deux modèles Asana

Les modèles personnalisés étant payants, les deux passent par la duplication, qui
fonctionne sur le plan gratuit et conserve les sous-tâches.

### Modèle A : la tâche `🧬 [MODÈLE] Lead`

Rangée dans la section `🧰 Modèles` du projet `🎯 crm`, hors pipeline. On la duplique,
on la renomme au format `[montant €] Client — Objet`, on la place dans `👋 Contacté`.

Description pré-remplie : source, contexte, besoin exprimé, budget évoqué, échéance
souhaitée, décideur, lien du devis, lien du dossier Drive.

Sous-tâches, dans l'ordre :
1. Qualifier : besoin, budget, échéance, décideur
2. Envoyer le lien de réservation
3. Faire le rendez-vous de découverte
4. Cadrer le périmètre et chiffrer
5. Rédiger et publier le devis
6. Relancer à J+3, J+7, J+14
7. Émettre la facture d'acompte dans Tiime
8. Vérifier l'encaissement de l'acompte

### Modèle B : le projet `🧱 [MODÈLE] Projet client`

Vit dans la team Coolbeans et se duplique dans la team du client au démarrage. Sections
identiques aux projets existants : `📥 Inbox`, `🧱 Backlog`, `🚀 Sprint`, `🚧 En cours`,
`☝️ Pour validation`, `✅ Terminé`. Noms relevés sur « Site web Coolbeans » et
« myCoolbeans » : ce sont eux qui font foi.

Tâches pré-remplies dans le Backlog, en trois familles.

Onboarding :
- Créer la team Asana du client
- Créer le dossier Drive et le lier dans les notes du projet
- Créer la fiche client `src/content/clients/<slug>.yaml`
- Créer l'utilisateur Clerk et le portail
- Envoyer le mail de bienvenue

Production :
- Recette avec le client
- Mise en ligne
- Rédiger la doc de passation
- Envoyer le mail de livraison et les trois questions du témoignage
- Émettre la facture de solde

Après-vente :
- J+30 : clôture de la garantie et proposition du care plan
- Rédiger l'étude de cas en brouillon
- Faire valider l'étude de cas par le client
- Publier l'étude de cas et mettre à jour le SEO
- Point trimestriel

**Les tâches d'après-vente naissent à la duplication, pas à la fin du projet.** C'est
la seule façon qu'elles ne soient jamais oubliées, puisque le plan gratuit n'offre
aucune règle d'automatisation.

## Hors périmètre

Volontairement écartés, parce qu'ils coûteraient plus que ce qu'ils rapportent sur un
process appelé à bouger plusieurs fois dans les mois à venir :

- génération automatique des modèles Asana depuis `sop.ts` ;
- tout scénario Make ou automatisation de création de carte CRM ;
- synchronisation du CRM vers le portail client ;
- moteur de diagramme générique.

## Dépendances externes

- **CGV et case d'acceptation sur la page de devis** : rédaction des CGV, page `/cgv`,
  case bloquante côté client et côté serveur, traçage de l'horodatage et de la version
  acceptée. Suivi dans la tâche Asana « Devis : acceptation des CGV (case à cocher +
  lien) sur la page de devis », backlog du projet « Site web Coolbeans ».
  L'échéancier ferme et l'autorisation d'étude de cas doivent y figurer.
- **Formules du care plan** : à définir séparément. Le SOP décrit le moment de la
  proposition, pas le contenu de l'offre.
- **Restructuration du projet `🎯 crm`** : redispatch manuel des cartes de
  `☄️ Lead relancé`, puis suppression de la colonne, création de `🏗️ En production`,
  `🧊 En veille` et `🧰 Modèles`.
- **Feuille de prospection** : la spec suppose qu'elle porte une date de dernier
  contact et une colonne « prochaine action ». Si ce n'est pas le cas, ces deux
  colonnes sont à ajouter, sinon la revue mensuelle n'a rien sur quoi mordre. La
  structure de la feuille elle-même reste hors périmètre de cette implémentation.

## Critères de réussite

1. La page `/docs/coolbeans/vente` affiche le vivier en amont, le schéma des quatre
   phases et les vingt-deux fiches d'étape (S0 à S21), et reste lisible sur mobile.
2. Ajouter une étape dans `src/data/sop.ts` la fait apparaître dans le schéma et dans
   les fiches sans aucune retouche de mise en page.
3. Le contenu de chaque étape répond à quatre questions : ce qui la déclenche, qui
   agit, ce qu'il faut faire, ce qui prouve qu'elle est finie.
4. Les deux modèles Asana décrits dans la page sont applicables tels quels sur le plan
   gratuit, sans champ personnalisé ni règle.
