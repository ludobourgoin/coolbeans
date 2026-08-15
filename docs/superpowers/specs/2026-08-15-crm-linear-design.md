# CRM Coolbeans sur Linear — design

Date : 2026-08-15 · Statut : validé en brainstorm, en attente de relecture finale
Remplace le projet Asana `🎯 crm` (gid 1211981053231553). Annule la décision du
2026-08-13 « le CRM reste sur Asana », rouverte par Ludo le 2026-08-15.

Références : SOP commercial S0→S21 (`src/data/sop.ts`, `02-vente.mdx`), spec
migration Asana→Linear (`2026-08-13-migration-asana-linear-design.md`), skills
`revops` et `prospecting` (amendements 1 à 7 ci-dessous intégrés).

## 1. Décisions cadres

- **Team Linear `🎯 CRM`**, clé `CRM`, privée. Cycles et estimates désactivés.
  Triage activé, **intake mail activé** (transfert d'un mail de prospect →
  issue en Triage).
- **Pipeline long** : la carte vit du premier contact au solde réglé, comme
  dans le SOP. Une carte = une affaire ; jamais de due date sur la carte ; les
  sous-issues portent date et assignation.
- **Le vivier reste dans le Google Sheet** (frontière S0 du SOP inchangée :
  des relations, pas des affaires). Claude y a accès en lecture via le
  connecteur Google Drive et crée les cartes quand un contact se qualifie.
- Pas de groupe de labels « Presta » (décision Ludo).
- Le montant vit dans le titre : `[3 500 €] Client — Objet` (pas de champs
  custom dans Linear). Pas de montant = pas encore estimé.
- Après migration, le projet Asana `🎯 crm` est **gelé en lecture**
  (historique). Aucune suppression sans ordre explicite.
- La team CRM est **hors du futur sync portail** par construction (le sync ne
  lit que les teams clients).

## 2. Statuts = pipeline (12)

Chaque statut porte en description son déclencheur d'entrée et son critère de
sortie, tirés du SOP (amendement « statuts auto-documentés »).

| Statut | Catégorie Linear | Étape SOP | Colonne Asana d'origine |
|---|---|---|---|
| 👋 Contacté | Unstarted | S1 | 👋 Contacté |
| 📆 Rdv pris | Started | S2–S3 | 📆 Rdv pris |
| 🎯 Besoins définis | Started | S4 | 🎯 Besoins définis |
| 📝 Devis envoyé | Started | S5 | 📝 Devis envoyé |
| ☄️ Relancé | Started | S5 (note) | ☄️ Lead relancé |
| 💪 Négo | Started | S6 | 💪 Négo entamée |
| 🚀 Acompte réglé | Started | S9 | 🚀 Acompte réglé |
| 🏗️ En production | Started | S10–S15 | 🏗️ En production |
| 📝 Solde envoyé | Started | S16 | 📝 Facture de solde envoyée |
| ✅ Soldée | Completed | S16 (fin) | ✅ Facture de solde réglée |
| 🧊 En veille | Backlog | S20 | 🧊 En veille |
| 🪦 Perdu | Canceled | S21 | 🪦 PERDU |

La colonne Asana « 🧰 Modèles » disparaît : remplacée par le template natif
(§4). S7–S8 (validation du devis, facture d'acompte) restent sans statut
propre, comme sur Asana : la carte est en 💪 Négo ou 📝 Devis envoyé et passe
en 🚀 Acompte réglé à l'encaissement.

## 3. Labels (team-scoped, un par groupe et par issue)

- **Groupe Source** : `inbound` · `recommandation` · `prospection`
- **Groupe Relance** : `relance-1` · `relance-2` · `relance-3`
- **Groupe Perte** : `prix` · `timing` · `concurrent` · `silence` · `hors-cible`

La raison de perte passe du commentaire (SOP S21) au label : elle devient
requêtable (win rate par source, raisons de perte par période).

## 4. Template d'issue `🧬 Lead`

Description = la fiche à remplir du modèle Asana, reprise telle quelle :
Source, Contexte, Besoin exprimé, Budget évoqué (→ titre), Échéance souhaitée,
Décideur, Lien du devis `/devis/<slug>`, Lien du dossier Drive. S'y ajoutent
les **liens croisés** posés au stade devis : projet de périmètre dans la team
du client (celui qui génère la page devis) et dossier Drive.

Les **14 sous-issues standard** sont reprises du modèle Asana, avec une seule
correction (n° 9, migration oblige) :

1. Qualifier : besoin, budget, échéance, décideur
2. Envoyer le lien de réservation
3. Faire le rendez-vous de découverte
4. Cadrer le périmètre et chiffrer
5. Rédiger et publier le devis
6. Relancer à J+3, J+7, J+14
7. Émettre la facture d'acompte dans Tiime
8. Vérifier l'encaissement de l'acompte
9. **Créer la team Linear du client depuis « Modèle client »**
10. Créer le dossier Drive et le lier dans les notes du projet
11. Créer la fiche client `src/content/clients/<slug>.yaml`
12. Créer l'utilisateur Clerk et le portail
13. Envoyer le mail de bienvenue
14. Émettre la facture de solde dans Tiime

Règle d'or inchangée : une affaire vivante a toujours au moins une sous-issue
assignée et datée.

## 5. Entrées du pipeline

- **Triage + intake mail** : un mail de prospect transféré à l'adresse
  d'intake de la team devient une issue en Triage. Claude la transforme en
  carte propre depuis le template. **SLA speed-to-lead : carte créée et lien
  de réservation envoyé sous 4 h ouvrées** (un lead contacté en < 5 min
  convertit ~21× mieux qu'à 30 min ; 4 h est le réalisme solo).
- **Vivier (Google Sheet)** : gate de qualification = signal d'achat (projet
  réel évoqué) **+ fit ICP + aucun disqualifieur**. Le Sheet gagne deux
  colonnes : `signal` (événement justifiant un contact) et `température`
  (chaud / tiède / froid) pour prioriser la revue mensuelle. Quand un contact
  passe le gate, Claude crée la carte (source `prospection`, contexte recopié
  de la ligne).
- **Création directe** en session : Ludo colle un contexte, Claude crée la
  carte depuis le template.

### Mini-ICP (BROUILLON — à calibrer par Ludo avant usage)

Pass/fail, tous requis :
- Budget évoqué ou plausible ≥ 2 000 €
- Structure : TPE/PME, indépendant, association avec budget — pas de particulier
- Besoin dans l'offre : site, boutique, LP, refonte, automatisation, care plan
- Accès direct au décideur (ou l'interlocuteur l'est)

Disqualifieurs immédiats : particulier ; concours/appel d'offres non rémunéré ;
budget explicitement sous le plancher ; demande hors offre sans pont possible.

## 6. Règles d'exploitation (auditées par Claude)

**Stage gates** (violations signalées au brief commercial) :
- dès 🎯 Besoins définis : montant présent dans le titre ;
- dès 📝 Devis envoyé : lien `/devis/<slug>` présent dans la description ;
- toujours : une sous-issue assignée et datée sur toute affaire vivante.

**Seuils de péremption** :
- 👋 Contacté > 2 j sans créneau réservé → relancer (SOP S1) ;
- 🎯 Besoins définis > 7 j sans devis envoyé → alerte ;
- 📝 Devis envoyé / ☄️ Relancé : relances J+3, J+7, J+14 ; silence après
  `relance-3` → 🪦 Perdu, label `silence` (SOP S5) ;
- 💪 Négo > 10 j sans mouvement → alerte ;
- 🚀 Acompte réglé > 7 j sans onboarding démarré → alerte ;
- 📝 Solde envoyé : relances J+8, J+15, puis mise en demeure (SOP S16) ;
- 🧊 En veille à date de rappel passée, ou sans sous-issue datée → proposition
  de bascule en 🪦 Perdu (SOP S20).

**Issue récurrente mensuelle** « Revue vivier + hygiène pipeline » : relire le
Sheet (remplace la tâche récurrente Asana de S0), chasser doublons, veilles
échues et cartes sans prochaine action.

**Brief commercial à la demande** : Triage en attente (SLA), relances du jour,
violations de gates, seuils dépassés, pipeline par étape avec montants parsés
des titres, raisons de perte et win rate par source sur la période.

## 7. Migration depuis Asana

- Recréer les **21 cartes ouvertes** : statut mappé (§2), labels source et
  relance repris des étiquettes, sous-tâches non cochées recréées en
  sous-issues, description et liens repris.
- Les 14 cartes fermées ne sont pas migrées (historique consultable dans
  Asana gelé).
- Créer le template 🧬 Lead, les labels, l'issue récurrente mensuelle.
- Vérification finale : comptage 21/21, aucun statut vide, chaque carte
  vivante a une sous-issue datée.

## 8. Chantiers induits (hors périmètre de la création, à tracker en COO)

- Mettre à jour `src/data/sop.ts` (outils « Asana — 🎯 crm » → « Linear —
  team CRM », `colonnesCrm` → statuts, étape S10 « team Asana » → « team
  Linear ») et `02-vente.mdx`.
- Action Ludo : partager le Google Sheet vivier (ou son URL) pour l'accès en
  lecture, et calibrer le mini-ICP (§5).
- Mettre à jour la mémoire Claude (décision CRM → Linear actée).

## 9. Hors périmètre explicite

Scoring à points, étages MQL/SQL, routing, outils d'enrichissement (YAGNI
solo). Sync portail ↔ Linear (chantier séparé, COO-22 et suivants). Contenu de
l'offre care plan. Automatisation d'un brief planifié (cron) : possible plus
tard, on commence à la demande.
