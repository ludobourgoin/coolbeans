# Analyse des trois fichiers financiers — 2026-09-01

Lecture des trois Google Sheets fournis par Ludo, en vue du cockpit financier.
Ce document sert de matière première à la spec. Il n'engage aucune décision.

## Les fichiers

| # | ID Drive | Contenu | Époque |
|---|---|---|---|
| A | `1pXBdSf…VeMoc` | 3 onglets : grille annuelle N26, journal Shine, budget mensuel type | 2025-2026 |
| B | `1MX0eX7…t5pAX0` | 19 onglets : historique complet CA, budgets par année, TVA, retraite, abonnements | 2019-2026 |
| C | `12NnP4D…QK76Y` | 8 onglets : mêmes structures, génération ING puis N26/Shine | 2019-2022 |

Les trois sont trois générations du **même** système, recopié et jamais unifié.

## Le squelette qui a survécu à quatre réécritures

Partout, par compte bancaire et par mois :

```
Solde DdM  (début de mois)
  + ENTREES   (CA, virements inter-comptes, divers)
  − SORTIES   (postes fixes, postes variables, charges, virements sortants)
= Solde FdM  (fin de mois)  →  devient le Solde DdM du mois suivant
```

C'est le seul modèle que Ludo utilise depuis 2019, à travers trois banques
successives (ING, puis N26 + Shine, aujourd'hui Boursorama + N26 + Shine). Il
tient les comptes **en parallèle**, avec les virements inter-comptes traités
comme des lignes ordinaires. C'est la structure à conserver.

Sous-modèle constant : la séparation **fixes / variables**. Le fichier A la
chiffre explicitement — 828 € de fixes, 460 € de variables, 1 288 € au total
par mois.

## Ce que les fichiers contiennent d'irremplaçable

**Historique de CA 2019 → 2026, ligne par ligne** (fichier B onglet 0, plus un
onglet par année). Colonnes : date, client, mission, HT, abattement fiscal
50 %, TVA, TTC, déclaré, charges, règlement. Sept années de facturation
réelle. C'est la seule mesure de saisonnalité dont Ludo dispose.

**CA annuel consolidé** (onglet retraite du fichier B) :

| Année | CA déclaré | Statut |
|---|---|---|
| 2017 | 27 319 € | auto-entrepreneur |
| 2018 | 31 452 € | auto-entrepreneur |
| 2019 | 4 550 € | début micro-entreprise BNC |
| 2020 | 29 881 € | |
| 2021 | 49 662 € | pic — année Talenvia |
| 2022 | 32 380 € | |
| 2023 | 24 220 € | |
| 2024-2026 | non renseigné | trou à combler |

**Trimestres de retraite** (fichier B). Attention : le total « 172 requis,
reste 0 à obtenir » est trompeur. Les lignes 2025 à 2057 portent un « 4 »
pré-rempli qui est une **projection**, pas un acquis. Le compteur réel
s'arrête à 2023. Ne pas lire ce tableau comme « retraite bouclée ».

Barème utile conservé : pour valider 4 trimestres en presta BNC, il faut
10 591 € de CA (Cnav) ou 10 640 € (Cipav).

**Abonnements avec montants mensuels et annualisés** (fichier B) : total
144,48 €/mois, dont 59 € perso et 85,48 € pro. Liste obsolète — Bouygues a
laissé place à Sosh, Claude Pro Max à 180 € n'y figure pas.

**Dépenses pro déductibles avec TVA** (fichier B) : 3 020,74 € HT et 604,15 €
de TVA déductible sur 2023. Modèle de la table dont la TVA a besoin.

**Suivi TVA collectée / déductible / à payer cumulé** (fichiers B et C).

## Les problèmes que le cockpit doit résoudre

**1. La dérive des montants.** Le même poste porte des valeurs différentes
selon l'onglet, parce que chaque année recopie la précédente sans relecture :

| Poste | Valeurs rencontrées |
|---|---|
| Complémentaire santé (Alan) | 70 € · 74 € · 75 € · 100 € |
| Loyer | 400 € · 425 € · 450 € · 600 € · 700 € |
| Téléphone | 10 € (Sosh) · 24 € · 35 € · 45 € (Bouygues) |
| Frais Shine | 4,68 € · 5 € · 6 € |

Aucune de ces valeurs n'est fausse à sa date. Le défaut, c'est qu'aucune n'est
datée : impossible de savoir laquelle vaut aujourd'hui.

**2. Les onglets marqués « A JETER ».** Présents dans les fichiers B et C, sans
qu'ils aient jamais été jetés. Le doute sur ce qui fait foi est permanent.

**3. Aucun lien avec les affaires.** Les encaissements sont saisis à la main
après coup. Les acomptes et soldes vivent aujourd'hui dans Linear (CRM) et
dans `src/content/devis/`, et rien ne les relie au prévisionnel.

**4. Le prévisionnel est plat.** Les mois futurs répètent la même colonne. Il
n'y a ni scénario, ni distinction entre un encaissement certain et un espéré.

## Ce que les formules font réellement

Vérification faite onglet par onglet : les seuls calculs sont des **sommes de
colonnes** et le **chaînage** `Solde FdM(n) → Solde DdM(n+1)`. Une seule
formule conditionnelle, la colonne `Cashflow` (TRUE/FALSE) du journal Shine,
qui marque les lignes à prendre en compte.

Aucun modèle que Ludo ajusterait à la main, aucune simulation, aucun tableau
croisé. **L'argument « on perd les formules en quittant le tableur » ne tient
pas ici.**

## Données à récupérer ailleurs qu'au clavier

- **Affaires, montants, acomptes, soldes** : Linear, teams `CRM` et clients.
- **Devis chiffrés** : `src/content/devis/*.yaml` du repo `coolbeans`.
- **Taux horaires et temps passés** : `~/.claude/skills/devis/references/historique-facturation.md`.
- **Échéancier URSSAF en cours** : 5 271 € sur 4 échéances, 1 667 € payés le
  30/08/2026, puis 1 667 € les 30/09 et 30/10, et 270 € le 30/11.

## Inventaire complet des 19 onglets du fichier B

| # | Contenu | Période | Valeur pour le cockpit |
|---|---|---|---|
| 0 | CA ligne à ligne : date, client, presta, HT, TVA, TTC, n° facture, URSSAF+IR, net | 2019-2025 | **Haute** — table maîtresse |
| 1 | Grille budgétaire N26 + Boursorama + Shine | 2026 | **Haute** — état actuel |
| 2 | CA 2020 par trimestre avec URSSAF | 2020 | Moyenne — historique |
| 3 | Carrière et trimestres retraite depuis 2003 | 2003-2063 | Moyenne — vue longue |
| 4 | Abonnements perso et pro, mensuel/annuel/next payment | ~2025 | **Haute** — à redater |
| 5 | Grille budgétaire N26 + Shine, **avec colonne Catégorie** | 2025 | **Haute** — axe Perso/Pro |
| 6 | Grille budgétaire N26 + Shine | 2024 | Moyenne |
| 7 | CA 2024 avec abattement 50 % et TVA | 2024 | **Haute** |
| 8 | Grille N26 + Shine + suivi TVA | 2023 | Moyenne |
| 9 | CA 2023 avec abattement et TVA | 2023 | **Haute** |
| 10 | Dépenses pro déductibles avec TVA, ligne à ligne | 2023 | **Haute** — modèle |
| 11 | Suivi Internet mensuel, reporté sur Tricount | 2022-2023 | Faible |
| 12 | Grille N26 + Shine + suivi TVA | 2022 | Moyenne |
| 13 | Journal Shine ligne à ligne avec colonne Cashflow | 2022 | **Haute** — modèle journal |
| 14 | CA 2022 avec TVA, acomptes et CA12 | 2022 | **Haute** |
| 15 | TVA collectée / déductible détaillée | 2021-2022 | **Haute** |
| 16 | Grille ING + Shine | 2021 | Faible |
| 17 | CA 2021 par trimestre | 2021 | **Haute** |
| 18 | Grille ING + Shine | 2020 | Faible |

## Faits établis par la lecture complète

**Trois comptes aujourd'hui, pas deux.** L'onglet 2026 suit N26, **Boursorama**
et Shine en parallèle. Boursorama porte le loyer, la complémentaire santé et
Spotify ; N26 porte la nourriture, le coiffeur et le téléphone. La répartition
est réelle, pas théorique.

**L'axe Personnel / Professionnel existe déjà** (onglet 5, colonne Catégorie).
C'est la segmentation à reprendre, pas à inventer.

**La ligne « Équilibre »** apparaît dans toutes les grilles depuis 2020. C'est
la variable d'ajustement qui absorbe l'écart entre prévu et réel.

**Sortie de la franchise en base de TVA : novembre 2021.** Les factures
jusqu'en octobre 2021 portent TVA = 0 ; la première facture avec TVA est
Talenvia novembre 2021 (6 433,33 € HT + 1 286,67 € de TVA). La TVA 2021,
3 340 €, a été déclarée et réglée le 2 mai 2022. Régime simplifié : acomptes
en juillet et décembre, régularisation par la CA12 en mai.

**Chronologie du chiffre d'affaires :**

| Année | CA HT | Charges sociales + IR | Net | Net mensuel |
|---|---|---|---|---|
| 2019 | 6 950 € | — | — | — |
| 2020 | 29 881 € | 7 397 € | 22 483 € | 1 874 € |
| 2021 | 49 662 € | 12 210 € | 37 452 € | 3 121 € |
| 2022 | 32 380 € | 7 891 € | 24 489 € | 2 041 € |
| 2023 | 24 220 € | 5 757 € | 18 463 € | 1 539 € |
| 2024 | 7 330 € | 1 769 € | 5 561 € | **463 €** |
| 2025 | 10 000 € sur S1 | 2 613 € | — | — |

2024 est un décrochage à signaler : le CA divise par trois celui de 2023 et le
net mensuel tombe à 463 €. Toute projection qui prendrait une moyenne des sept
années masquerait cette rupture.

**Charges annuelles retrouvées :** CFE 350 € (2022), 359 € (2022), 727 € (2024),
250 € (acompte 2022). URSSAF trimestrielle variable, de 289 € à 5 784 €.

**Le vocabulaire des postes est stable sur sept ans** : loyer, charges,
complémentaire santé, food, coiffeur, téléphone, internet, Spotify, livres,
restaus et bars, transports, vacances, loisirs, santé, fringues, cadeaux,
retrait DAB, divers, IR, équilibre. Une trentaine de libellés, réutilisés à
l'identique d'une année sur l'autre. C'est la nomenclature à figer.

## Postes de dépense recensés, à dater et valider

Fixes perso : loyer, charges de coloc, complémentaire santé, Sosh, iCloud,
abonnements perso, transports, épargne projet.
Variables perso : nourriture, hygiène, santé, loisirs, habillement.
Pro : Figma, Relume, Webflow (deux abonnements), Claude Pro Max 180 €,
Google Workspace, Namecheap, frais Shine.
Charges : URSSAF trimestrielle, TVA, CFE, impôt sur le revenu.
