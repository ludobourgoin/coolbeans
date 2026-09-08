# Cadrage client — contenu et direction artistique dans le portail

**Date :** 2026-08-18
**Statut :** design validé. **Une V1 a été livrée le 2026-09-05, sur une
architecture différente de celle décrite ici.** Voir le §13, qui prime sur les
§4.2, §5, §6 et §8 partout où ils le contredisent.
**Origine :** brainstorm du 2026-08-18, déclenché par le devis CAFA (CRM-9).

---

## 0. Instruction pour Claude Code

Ce document est la source de vérité du module Cadrage. Toute décision prise ici
prime sur une intuition de session. Les décisions sont datées : si une session
ultérieure en change une, elle amende ce fichier dans le même commit.

---

## 1. Problème

Une étape manque au process Coolbeans, entre le rendez-vous de brief et la
production : la collecte structurée de la matière client. Aujourd'hui elle se
fait par mails successifs, ce qui produit trois défauts.

1. **Le chiffrage repose sur des hypothèses.** Le nombre de pages, l'existence
   des textes, le volume à migrer sont inconnus au moment du devis.
2. **La direction artistique n'est jamais cadrée.** Sur les petits projets, le
   web design fait office de branding : sans adjectifs de marque ni références,
   la conception se fait à l'aveugle.
3. **Le temps passé à relancer et à structurer est invisible**, donc non
   facturé et non planifié.

Le module Cadrage remplace le Google Doc envisagé au départ : les questions
vivent dans le portail, les réponses sont exploitables directement.

---

## 2. Principe

Un questionnaire par projet, accessible au prospect **avant** la signature,
composé de deux niveaux visibles dans un seul formulaire :

- **Bloc devis (bloquant).** Cinq à dix questions fermées qui déplacent le
  prix. Rempli en dix minutes. Conditionne l'envoi du devis, avec repli sur
  hypothèses affichées après cinq jours de silence.
- **Bloc projet (non bloquant).** Ton, direction artistique, contenu page par
  page. Des heures de travail côté client, remplies à son rythme, avant ou
  après signature.

**Les deux blocs sont visibles dès la première ouverture.** C'est un choix
commercial, pas cosmétique : voir le volume de rédaction qui l'attend est ce
qui fait comprendre au client la valeur de l'option Rédaction.

---

## 3. Parcours

| Moment | Acteur | Action |
|---|---|---|
| J+0 | Claude | Génère le questionnaire depuis la demande entrante et la bibliothèque de questions du type de projet (amendé le 2026-08-19 : le questionnaire part **avant** le rendez-vous, plus après) |
| J+0 | Ludo | Relit, corrige, invite le prospect depuis l'admin |
| J+0 | Prospect | Reçoit un lien magique, ouvre son espace |
| J+1 à J+2 | Prospect | Remplit le bloc devis |
| J+2 | Ludo | Call de brief, enregistré par Granola — conversation sur des réponses déjà écrites, et l'ordre de grandeur du prix s'annonce dans les cinq premières minutes |
| J+2 | Ludo | Chiffre sur du réel, envoie le devis |
| J+2 → ∞ | Prospect | Remplit le bloc projet à son rythme |
| à complétion | Ludo | Notifié, produit avec la matière en main |

Repli : sans réponse au bloc devis à J+5, le devis part sur hypothèses
explicitement écrites dans le document (« établi sur la base de six pages et de
contenus fournis ; toute variation donne lieu à révision »).

---

## 4. Architecture des données

Symétrie assumée avec le module Devis, déjà en production : **définition
versionnée dans le repo, réponses en base.**

### 4.1 Définition du questionnaire

Collection de contenu Astro, `src/content/cadrage/<client>-<projet>.yaml`.

- Le **socle générique** (ton, DA, marque, technique) vit dans
  `src/content/cadrage/_socle.yaml` et s'applique à tous les projets.
- La **partie sur-mesure** (contenu page par page) est générée par Claude à
  partir du CR Granola et des issues du projet Linear, puis **relue par Ludo
  avant envoi**. Jamais d'envoi sans relecture.

Conséquence : aucune interface d'administration à construire, définition
versionnée par git, génération en une passe par Claude.

### 4.2 Réponses

Table D1 `cadrage_reponses`, écrite par le portail (même pattern que la
messagerie et les réponses de devis).

**Une ligne par (projet, question, version)**, horodatée : une modification
n'écrase jamais la valeur précédente, elle ajoute une version. L'état courant
d'une question est sa version la plus récente. Ce choix est ce qui rend le
calcul d'écart possible (§6.2) et donne l'historique sans table annexe.

### 4.3 Export vers le repo

Commande explicite (`npm run cadrage:export <client> <projet>`) qui écrit un instantané
Markdown lisible dans `src/content/cadrage/<client>-<projet>.reponses.md`.

Trois bénéfices : Claude lit un fichier plutôt qu'une base, `git diff` montre
ce qui a changé entre deux versions, et le cadrage rejoint naturellement la
documentation client. L'export est un geste explicite, jamais automatique.

---

## 5. Formulaire (UX)

Mise en page retenue : **zones empilées, tout déplié, avec sommaire à badges
épinglé.**

- Sommaire en haut : une ligne par section, avec badge d'état (« Devis · 3/8 »,
  « Quand vous voulez · 0/4 ») et ancre vers la section.
- Zone haute « Pour établir votre devis » : fond appuyé, compteur, barre de
  progression.
- Zone basse « Pour la suite du projet » : **entièrement dépliée**, en retrait
  typographique et par l'espacement. **Jamais en opacité réduite** : un bloc
  translucide se lit comme désactivé et personne n'y touche.
- Enregistrement automatique silencieux, plus un bouton explicite par section
  qui vaut transition d'état.

Types de champs : texte court, texte long, choix unique, choix multiple, jauge
(pour le ton), liste répétable (références de sites, membres du bureau).

Nommage : « Votre projet » côté client. « Cadrage » est du jargon d'agence et
ne sort pas de l'interface admin.

---

## 6. Gel, écarts et notifications

### 6.1 Le gel porte sur le devis, jamais sur le formulaire

Au moment du chiffrage, le devis fige un **instantané horodaté** des réponses
bloquantes, et l'affiche (« établi sur la base de vos réponses du 18 août »).
Le formulaire reste modifiable à vie.

Justification : verrouiller le formulaire empêche la correction d'une erreur de
saisie et, surtout, fait taire une information qui vaut de l'argent. Un client
qui découvre en cours de cadrage qu'il a douze pages et non six doit pouvoir le
dire ; c'est précisément ce que le système est censé faire remonter.

### 6.2 Écarts

Toute divergence entre l'instantané et l'état courant produit un **écart
tracé** (avant / après, horodaté), visible dans le cockpit et notifié. L'écart
est un motif de révision opposable, pas un incident.

### 6.3 Notifications

Quatre événements poussés, par mail Resend **et** commentaire sur la carte CRM
Linear de l'affaire :

1. Bloc devis complété → le chiffrage est possible
2. Réponse bloquante modifiée après devis → écart à traiter
3. Bloc projet complété → la production peut démarrer
4. Sept jours sans activité → relance à décider

Tout le reste (chaque enregistrement, progression partielle, première ouverture)
est un **état** visible dans `/espace/devis`, jamais une notification. Notifier
les sauvegardes garantit que Ludo coupera les notifications et ratera les
quatre qui comptent.

---

## 7. Devis et option « Rédaction des contenus »

La réponse à « qui rédige les textes ? » pilote l'apparition de la ligne
optionnelle au devis.

L'option achète des **livrables nommés**, pas un niveau d'effort invisible :

| Sans l'option | Avec l'option |
|---|---|
| Mise en forme des contenus fournis | Entretien de contenu (45 min) |
| Textes fonctionnels pour combler les trous | Rédaction de toutes les pages |
| Pas de round d'itération sur le texte | Ton calibré sur les réponses de cadrage |
| | 2 rounds d'itération sur les textes |
| | Titres et méta-descriptions travaillés pour le SEO |

**Clause de bascule**, inscrite au devis : contenus non fournis à la date
convenue, l'option devient facturable et le devis est révisé. Elle protège du
scénario le plus fréquent, où le client annonce fournir les textes, ne les
fournit pas, et la rédaction se fait gratuitement sous pression de la date de
livraison.

---

## 8. Accès

**Lien magique par e-mail.** Ludo invite depuis l'admin, le prospect reçoit un
lien qui ouvre sa session : aucun mot de passe, aucune inscription. La sidebar
d'un prospect se réduit à « Votre projet » et au devis.

Décision associée : **le devis lui-même reste public**, accessible par son lien
sans authentification. Un devis est fait pour être transféré (au président, au
trésorier, à un associé) ; un lien magique transféré ne fonctionne plus ou
ouvre la session d'autrui. La marque se joue dans le mail, la typographie et la
page, pas dans un péage devant le prix. Le devis peut **aussi** apparaître dans
le portail pour ceux qui y sont déjà (milestone P10).

**Dépendance :** le lien magique s'appuie sur le plugin magic-link de Better
Auth, dont la migration est cadrée mais non faite (COO-132). Deux séquencements
possibles, à trancher au moment du plan :

- **A.** Le module attend la migration Better Auth.
- **B.** On livre d'abord le formulaire pour les clients déjà authentifiés, et
  on branche l'accès prospect après la migration.

---

## 9. Hors périmètre de la V1

- Génération du questionnaire sans relecture de Ludo
- Relance automatique du client (Ludo est notifié, il décide)
- Éditeur visuel de questionnaire
- Plusieurs utilisateurs côté client sur un même cadrage
- Reprise du cadrage dans la documentation de passation
- Traduction du questionnaire

---

## 10. Cas CAFA (2026-08-18)

Aucune partie de ce module ne sera en production à temps pour CAFA, dont le
devis est attendu depuis le 4 août. CAFA sert de **prototype de contenu** : les
questions rédigées pour eux, dans une forme dégradée (mail structuré ou
document partagé), deviennent le socle générique versionné. Le travail de
formulation n'est pas perdu, il est simplement fait avant l'outil.

Conséquence immédiate sur le devis CAFA : la ligne optionnelle « Rédaction des
contenus » et la clause de bascule s'appliquent dès maintenant, sans attendre
le module.

---

## 11. Tests

- Parseur de définition de questionnaire (YAML → objet, types de champs,
  sections, marquage bloquant / non bloquant).
- Écriture et relecture des réponses en D1, y compris historique append-only.
- Dérivation de l'état d'un cadrage (compteurs par section, complétion du bloc
  devis, complétion du bloc projet).
- Calcul d'écart entre instantané et état courant : aucun écart, écart sur une
  réponse bloquante, changement sur une réponse non bloquante (qui ne doit
  produire aucun écart).
- Déclenchement des quatre notifications, et **non-déclenchement** sur simple
  enregistrement.
- Export Markdown : forme stable et diff lisible entre deux exports.

---

## 12. Journal des décisions

| Date | Décision |
|---|---|
| 2026-08-18 | Socle générique versionné + partie sur-mesure générée par Claude, relue avant envoi |
| 2026-08-18 | Réponses en D1, export explicite vers le repo pour lecture par Claude |
| 2026-08-18 | Accès prospect par lien magique ; devis public conservé |
| 2026-08-18 | Cadrage envoyé après le call, bloc devis bloquant, repli sur hypothèses à J+5 |
| 2026-08-18 | Un seul formulaire, deux niveaux, tout visible dès l'ouverture |
| 2026-08-18 | Gel par instantané attaché au devis ; formulaire modifiable à vie |
| 2026-08-18 | Quatre événements notifiés, le reste en état dans le cockpit |
| 2026-08-18 | Option Rédaction définie par livrables nommés + clause de bascule |
| 2026-09-05 | Accès par lien public non devinable, le lien magique est abandonné (§13.1) |
| 2026-09-05 | Aucune écriture en base en V1, le mail est la trace (§13.2) |
| 2026-09-05 | Le tableau comparatif devient le cœur du document (§13.3) |
| 2026-09-05 | Le cadrage remplace parfois le rendez-vous, au lieu de le préparer (§13.4) |

---

## 13. Amendement du 2026-09-05 : ce qui a réellement été livré

Suite COO-188. Le §0 demande qu'une session qui change une décision amende ce
fichier dans le même commit : c'est ce que fait cette section.

### 13.1 Lien public, pas lien magique

Le §8 prévoyait un accès prospect par lien magique Better Auth. Abandonné.

Le §8 se contredisait lui-même : il justifie le devis public par le fait qu'un
document commercial se transfère au président, au trésorier, à un associé, et
qu'un lien magique transféré ne fonctionne plus ou ouvre la session d'autrui.
L'argument vaut mot pour mot pour un questionnaire de cadrage, qui se remplit
souvent à plusieurs.

Le cadrage suit donc le régime du devis : URL non devinable
(`/cadrage/<client>/<projet>-<4 chiffres>`), balise `noindex`, `Disallow` dans
`robots.txt`, exclusion du sitemap. Conséquence utile : la dépendance à la
migration Better Auth tombe, et l'arbitrage A ou B du §8 devient sans objet.

### 13.2 Pas de base de données en V1

Le §4.2 prévoyait une table D1 `cadrage_reponses` append-only, qui fondait le
calcul d'écart du §6.2. Rien de tout ça n'est livré.

Raison : une migration D1 est un geste non parallélisable qui part en
production dès le merge sur `staging`, et un cadrage ne pilote aucun statut de
cockpit. Le mail de notification est la trace, et le lead reçoit une copie de
ses réponses. Le gel, les écarts et les quatre notifications du §6 restent hors
périmètre tant qu'aucune base n'existe.

Ce qui tombe avec : l'export Markdown du §4.3, et le §5 (sommaire à badges,
compteurs, enregistrement automatique) qui suppose un état persisté.

### 13.3 Le tableau comparatif est le cœur du document

Absent du design d'origine, et c'est ce qui lui manquait. Un questionnaire qui
demande un budget sans avoir dit ce que chaque voie coûte récolte une réponse
au hasard, inexploitable pour chiffrer.

Le document présente donc, avant les questions, un tableau à une colonne par
solution et une ligne par critère, dont une ligne de coût par colonne et une
solution explicitement recommandée. Règle de rédaction : fonctionnalité X,
bénéfice Y, coût Z. Les questions viennent ensuite et renvoient au tableau.

Les fourchettes sont larges et marquées indicatives. Elles ancrent le lead
avant qu'on ait ses réponses : c'est assumé, et cohérent avec le SOP qui veut
que l'argent se parle tôt, mais ça inverse la règle « borne haute au devis,
budget du lead au brief ».

Cet amendement livre au passage le reste-à-faire noté dans
`2026-08-19-process-vente-unifie-design.md` : les cases à cocher par besoin et
les bibliothèques de besoins par type de projet.

### 13.4 Le cadrage remplace le rendez-vous, il ne le prépare pas toujours

Le §3 le plaçait systématiquement avant un call de brief qui avait lieu de
toute façon. Le besoin réel est autre : éviter le rendez-vous quand il ferait
perdre une heure, typiquement face à quelqu'un sans budget.

Le cadrage occupe donc l'étape **S1b** du SOP, entre le premier contact et le
rendez-vous, et il ouvre trois suites : chiffrer directement, caler un
rendez-vous, ou classer. Les critères d'envoi et de non-envoi sont écrits dans
la doc de vente et dans la skill `proposition-commerciale`.

### 13.5 Ce qui reste valable du design d'origine

- Le §4.1 : définition versionnée en YAML dans le repo, générée par Claude,
  relue par Ludo avant envoi. Jamais d'envoi sans relecture.
- Le §7 : option Rédaction définie par livrables nommés et clause de bascule.
  Indépendant du module.
- Le §9 : hors périmètre de la V1, toujours d'actualité.
- Le §2, dans son intention : des questions fermées qui déplacent le prix. Le
  drapeau `decisif` les marque et les fait remonter en tête du mail. La
  séparation en deux blocs bloquant et non bloquant, elle, attend une base.
