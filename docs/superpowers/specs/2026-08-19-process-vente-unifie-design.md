# Process de vente unifié — une page, trois états

**Date :** 2026-08-19
**Statut :** design validé, implémentation partielle (état 1 livré)
**Origine :** session devis Danaë / Vice Versa, 2026-08-19.

---

## 0. Instruction pour Claude Code

Ce document est la source de vérité du process d'avant-vente. Toute décision
prise ici prime sur une intuition de session. Les décisions sont datées : si
une session ultérieure en change une, elle amende ce fichier dans le même
commit.

Il complète, sans le remplacer, `2026-08-18-cadrage-client-design.md` (module
Cadrage dans le portail) et `2026-08-17-cockpit-devis-design.md`.

---

## 1. Problème

Trois artefacts avaient été pensés séparément : un questionnaire de cadrage,
un devis en construction, un devis chiffré. Trois objets, trois moments, trois
implémentations envisagées.

Ils n'en font qu'un. Ce que le questionnaire demande (quels besoins retenir,
quel niveau d'exigence, quelles contraintes) est exactement ce que la section
« En option » d'un devis propose, et ce que le bloc Chiffrage consomme. Les
traiter séparément multiplie les surfaces, les liens envoyés au prospect, et
les occasions pour lui de dire non.

Conséquence observée : hésitation à chaque nouvelle affaire sur ce qu'il faut
envoyer et quand. Le coût réel n'est pas technique, il est décisionnel.

---

## 2. Principe

**Une page, une URL, trois états.** `coolbeans.cc/devis/<client>/<projet>-<4 chiffres>`

| État | Quand | Ce que la page porte | Ce que le prospect fait |
|---|---|---|---|
| **1 · Cadrage** | Dans l'heure suivant la demande entrante, **avant** le rendez-vous | Périmètre proposé en cases à cocher, niveau de DA, tonalité, contraintes. Budget et planning en attente | Il répond |
| **2 · Chiffré** | Après le rendez-vous de brief | Périmètre arrêté, prix, planning en dates réelles | Il valide ou négocie |
| **3 · Accepté** | À la validation | Acceptation, échéancier, acompte | Il signe et paie |

Le lien ne change jamais. Le prospect ne cherche pas « la dernière version ».

### Décision : le questionnaire part avant le rendez-vous

Deux raisons, dans cet ordre d'importance :

1. **Le rendez-vous cesse d'être une collecte.** Il devient une conversation
   sur des réponses déjà écrites. Une demi-heure gagnée, et on arrive avec un
   point de vue au lieu d'un carnet vierge.
2. **Personne d'autre ne le fait.** Un prospect qui reçoit un document
   structuré avant même le premier appel constate la qualité du process avant
   d'avoir signé quoi que ce soit.

Effet de bord assumé : un prospect qui ne remplit pas cinq minutes de
questionnaire ne signera pas. C'est un filtre gratuit, pas un défaut.

### Décision : le mode « premier jet » ne convient pas à tous les leads

Le critère est la relation commerciale, pas le projet. Voir la skill `devis`,
mode « premier jet », pour la table complète. En résumé : oui sur un entrant
chaud, une recommandation, un proche. Non en situation de compétition
(un document sans prix face à deux concurrents chiffrés sort du comparatif) et
non en prospection sortante (offrir du travail à qui n'a rien demandé dévalue
le temps).

---

## 3. Le formulaire de l'état 1

Chaque besoin proposé se répond en quatre choix :

- **Oui, à mettre au devis**
- **Oui, mais en V2**
- **Peut-être plus tard**
- **Pas besoin**

Le quatrième compte autant que le premier : un « pas besoin » explicite est
une borne opposable plus tard, quand la demande revient en cours de projet.

Un champ libre accompagne chaque bloc — c'est là que se lit le besoin réel,
celui qu'aucune case ne décrit.

### Bibliothèques de besoins, par type de projet

C'est la seule chose qui change entre un site vitrine, une refonte, un
Shopify et du développement sur mesure. **Le process, lui, ne change pas.**
Ces listes restent à écrire ; les rédiger revient à capitaliser les devis
passés plutôt qu'à inventer.

### Niveau de direction artistique

Question systématique, trois niveaux :

1. Sobre et minimaliste, à partir d'une charte existante — Coolbeans.
2. Sobre et minimaliste, sans charte — Coolbeans, avec étape moodboard.
3. Identité de marque poussée — un directeur ou une directrice artistique
   partenaire, recommandé et coordonné par Coolbeans.

Le niveau 3 n'est pas un échec commercial, c'est une qualification. Voir la
doc de vente, section « Le rendez-vous de brief », pour la formulation.

---

## 4. Ce qui existe déjà

- `budget.enAttente` et `planning.options[].indicatif` : la page devis sait
  s'afficher sans montant ni dates fermes. Livré le 2026-08-19.
- Le formulaire de réponse public (D1 + notification Resend), sans
  authentification, se replie sur la seule réponse qui ait du sens quand le
  devis n'a pas de prix. Livré le 2026-08-19.
- Le cockpit `/espace/devis` affiche « En construction ».
- Les sections de questions se rédigent aujourd'hui à la main dans le YAML
  (« Tonalité », « De ton côté » sur le devis Vice Versa).

## 5. Ce qui reste à faire

1. **Les cases à cocher.** Aujourd'hui les questions se lisent sur la page,
   mais se répondent en texte libre dans le formulaire, ou par mail. Le
   passage aux quatre choix par besoin demande une extension du schéma
   (`liste` avec un champ `reponse`) et du formulaire.
2. **Les bibliothèques de besoins** par type de projet.
3. **Le repli de l'état 1 à l'état 2.** Quand le devis devient ferme, les
   sections de cadrage ne doivent plus s'afficher à côté du bloc
   d'acceptation : on ne fait pas signer un document qui contient encore des
   questions ouvertes. Repli ou passage en historique, à trancher.

### Dépendance Better Auth : à ne pas confondre

`2026-08-18-cadrage-client-design.md` fait dépendre l'accès prospect d'un lien
magique, donc du plugin magic-link de Better Auth (COO-132). **Cette
dépendance ne porte que sur la session**, pas sur le questionnaire lui-même :
le devis reste public par décision du 2026-08-18, et le formulaire de réponse
public existe déjà. L'état 1 fonctionne donc sans Better Auth.

Le lien magique reste souhaitable ensuite (reprise plus tard, sauvegarde
partielle, sidebar). Il devra préserver la transférabilité du devis, qui est
la raison pour laquelle il avait été laissé public : un devis se transfère au
président, au trésorier, à un associé, et un lien magique transféré ne
fonctionne plus.

---

## 6. Journal des décisions

| Date | Décision |
|---|---|
| 2026-08-19 | Questionnaire, devis en construction et devis chiffré sont un seul objet à trois états, sur une seule URL |
| 2026-08-19 | Le questionnaire part avant le rendez-vous de brief |
| 2026-08-19 | Le mode « premier jet » est réservé aux leads entrants chauds, jamais en compétition ni en prospection sortante |
| 2026-08-19 | Le niveau de DA est une question systématique ; au-delà du sobre et minimaliste, orientation vers un partenaire |
| 2026-08-19 | L'argent s'annonce dans les cinq premières minutes du rendez-vous de brief |
