# Migration des projets Asana en favoris vers Linear

Date : 2026-09-25. Statut : conception validée par Ludo, en session.

## Objectif

Toutes les tâches ouvertes des projets retenus arrivent dans Linear, en Triage,
dans la bonne team, sans perte ni invention. Ludo les trie ensuite depuis
Linear.

## Critères de succès

- Le rapprochement tombe juste : tâches ouvertes du périmètre = issues créées +
  tâches fusionnées + tâches écartées avec leur motif.
- Chaque issue pointe vers sa tâche Asana et en porte tout le contenu : notes,
  sous-tâches, commentaires, pièces jointes.
- Asana reste intact jusqu'à la validation de Ludo.

## Ce que la tentative du 2026-09-04 a appris

- Aucune création sans validation. La passe à blanc tient lieu de validation.
- Rien d'inventé : titres et notes d'origine, les inconnues restent des
  inconnues.
- Rien de supprimé à la source. Vingt tâches s'étaient perdues ainsi ; Ludo les
  a restaurées le 2026-09-25.

## Périmètre

Douze projets : les onze en favoris, plus `Site web Coolbeans` ajouté par Ludo.
Comptes relevés le 2026-09-25.

| Projet Asana | GID | Ouvertes | Team cible |
|---|---|---|---|
| 🏃‍♂️ body | 1211893294366483 | 8 | BOD |
| 🤑 money | 1211893293414985 | 5 | MON |
| ♥️ social | 1211893294366499 | 11 | SOC |
| 🎒 adventures | 1211893294366475 | 13 | ADV |
| 🛋️ environment | 1211893294366511 | 9 | ENV |
| 🧢 coolbeans | 1208893580241097 | 50 | COO |
| Site web Coolbeans | 1217361878516618 | 4 | COO |
| 🍿 programmation | 1212812786472264 | 19 | POP |
| 🍿 tielle & popcorn | 1208892745306447 | 111 | POP |
| 👨‍💼 projects (legacy) | 1213289511494550 | 6 | une team par client |
| 🛠️ support | 1216447136398892 | 6 | une team par client |
| 🎯 crm | 1211981053231553 | 21 | CRM, après rapprochement |
| **Total** | | **263** | |

Écartés, par décision de Ludo :

- les tâches terminées ;
- la tâche support `merci_yanis`, faute de team Linear ;
- `🧬 [MODÈLE] Lead` du CRM, qui existe déjà comme template Linear ;
- les projets hors favoris, qui restent dans Asana : 🎁 webflow (13 ouvertes),
  Tâches préalablement attribuées à Mathilde Jullien Cravotta (5), 📹 ngup (1),
  myCoolbeans (11), Contenu blog Coolbeans (2), .🧱 [MODÈLE] Projet client (6),
  🤖 Workflow Claude ↔ Asana (5), les projets clients Littlebox (3),
  AMA Languedoc (4), Oïde (2), Sète En Corps Mieux (4), UnlockBreath (2),
  Fylgo (1), Mathilde Chevalier (1) et Zelidom (1) ;
- Things, qui fera l'objet d'un chantier séparé.

## Routage

La team suit le projet source. Seuls les projets multi-clients se répartissent
par client, et aucune tâche n'est reclassée d'une sphère à l'autre : c'est au
tri de Ludo.

| Source | Tâche | Team |
|---|---|---|
| projects (legacy) | 💨 UnlockBreath | UNL |
| projects (legacy) | Vidéo KO sur LP Bars et restaus | AMU |
| projects (legacy) | Intégration Shopify Oïde | OID |
| projects (legacy) | 🧘‍♂️ sète en corps mieux | SET |
| projects (legacy) | 🍹 fylgo | FYL |
| projects (legacy) | 🎡 littlebox | LIT |
| support | 🍹 fylgo / 🛟 support | FYL |
| support | 🕶️ mathilde_ch / 🛟 support | MAT |
| support | 🧘‍♂️ sète_en_corps_mieux / 🛟 support | SET |
| support | 🎭 amusoire / support | AMU |
| support | ⚡️ trigger / support | TRI |

Les tâches du projet support portent en plus le label workspace `Support`.

## Forme d'une issue

- Statut Triage de la team cible. Ni assignee, ni priorité, ni estimate, ni
  échéance : Triage n'est pas un engagement, et des échéances passées
  rempliraient la vue « En retard » avant le tri.
- Titre : le nom Asana tel quel, retours à la ligne retirés. En cas de fusion,
  le plus complet des deux titres, sans réécriture.
- Label workspace `Import Asana`, à créer.

Description, dans cet ordre :

```markdown
<notes Asana, telles quelles>

## Asana
- Projet : <projet> · section <section>
- Échéance d'origine : <date ou « aucune »>
- Créée le <date>
- Source : <lien de la tâche>
- Doublon probable de <ID Linear>   (si une issue équivalente existe)
- Fusion de deux tâches Asana : <lien 1>, <lien 2>   (si fusion)

## Sous-tâches
- [ ] <sous-tâche ouverte>
- [x] <sous-tâche terminée>
  - [ ] <sous-tâche de sous-tâche, indentée>

## Commentaires
**<auteur>, <date>** : <texte>

## Pièces jointes
- [<nom>](<lien>)
```

Les sections vides sont omises.

## Doublons

- **Internes à Asana** : fusion en une seule issue qui cite les deux sources.
  Chaque fusion figure dans la passe à blanc pour que Ludo la voie.
- **Avec une issue Linear existante** : import quand même, avec « Doublon
  probable de <ID> » et le lien. Ludo fusionne ou supprime au tri.
- **CRM** : rapprochement avec les affaires de la team CRM. Seules les tâches
  absentes de Linear sont importées. Les écartées figurent dans la passe à
  blanc, chacune avec l'affaire qui la couvre.

## Déroulé

1. **Extraction** : toutes les tâches ouvertes du périmètre, avec sous-tâches,
   commentaires et pièces jointes, par le MCP Asana. Écrite dans un fichier
   JSON local.
2. **Passe à blanc** : une table « tâche → team, titre, fusion, doublon,
   écartée et motif ». Ludo la valide ou la corrige. Rien n'est créé avant.
3. **Import** par script GraphQL, en une fois.
4. **Rapprochement** : le compte de l'objectif, avec un rapport à Ludo.
5. **Vue « Import Asana à trier »** : liste groupée par team, filtrée sur le
   label, pour le tri.
6. **Archivage** des douze projets Asana après la validation de Ludo. Aucune
   suppression.

## Garde-fous techniques

- `issueCreate` avec le `stateId` de l'état Triage de la team cible. Triage est
  actif sur les 30 teams depuis le 2026-09-25.
- Une correspondance « GID Asana → identifiant Linear » s'écrit après chaque
  création. Une relance reprend là où l'import s'est arrêté, sans rien créer en
  double.
- Si l'API Linear répond autre chose que du JSON, relancer, puis relire l'état
  réel avant de reprendre.
- Données personnelles : l'extraction et la table de passe à blanc restent hors
  de tout dépôt git. Cette spec ne cite aucun contenu de tâche.
