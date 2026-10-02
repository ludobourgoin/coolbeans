# Les titres de section au-dessus du contenu

Date : 2026-10-02
Statut : design validé en conversation le 2026-10-02, spec à relire
Chantier : « Documents client, harmonisation », lot 3 sur 4. Lots 1 et 2 : `2026-10-02-pronom-fiche-client-design.md`, `2026-10-02-sections-documents-design.md`.
Dépend de : la fusion de `feat/documents-portail`, qui déplace les gabarits dans `src/components/documents/pages/`.

## Pourquoi

Les titres de section vivent dans une colonne de 180 px, à gauche du contenu. La grille est recopiée une vingtaine de fois dans les composants des documents.

Le comparatif du cadrage sort de la colonne de lecture pour s'étendre à la largeur du site, et il emporte son titre : le bord gauche de ce titre ne s'aligne plus sur celui des autres sections. La hiérarchie visuelle se lit mal.

## Décisions de Ludo du 2026-10-01

1. Dans tous les documents, le titre d'une section se place au-dessus de son contenu.
2. Le titre est le h2 du design system.
3. Le bloc occupe une colonne de 880 px. Les paragraphes restent limités à une soixantaine de caractères par ligne.
4. Dans une section large, le titre et le texte d'intro gardent la largeur standard. Seul le contenu s'étend.
5. Les formulaires de réponse et le bloc des réponses suivent la même règle.

## Le composant

Un composant unique, `src/components/documents/SectionDocument.astro`, porte la mise en page de toutes les sections :

| Prop | Rôle |
|---|---|
| `titre` | Le titre, rendu en h2 |
| `ancre` | L'`id` de la section, comme aujourd'hui |
| `intro` | Le texte d'intro, en HTML déjà passé par `riche()` |
| `large` | Le contenu s'étend à la largeur du site |
| `neuf` | Le surlignage des nouveautés d'une version |

Il rend, dans la colonne de 880 px : le filet de séparation, le h2, l'intro, puis le contenu passé en slot. Avec `large`, seul le slot sort de la colonne, par la marge négative déjà employée par `CadrageComparatif.astro`. Le h2 et l'intro ne bougent pas.

Un second composant, `BlocDocument.astro`, rend un sous-bloc du lot 2 : un h3, puis son texte et sa liste.

## Le style

- Le h2 reprend le style global de `src/styles/global.css` : police d'affichage, graisse 700, 28 à 44 px selon la largeur. Le libellé en mono majuscule de 15 px disparaît des sections.
- Le h3 des sous-blocs reprend lui aussi le style global, de 20 à 26 px.
- Les paragraphes gardent `max-w-[58ch]`. Tableaux, budget, planning, parcours et formulaires prennent les 880 px.
- Sous 700 px, rien ne change de logique : le titre était déjà au-dessus.
- À l'impression de la proposition, le h2 descend à la taille du h3, pour garder des pages compactes.

## Ce qui migre

Toutes les occurrences de `grid-cols-[180px_1fr]` dans les composants et les gabarits des documents. Relevé du 2026-10-02 sur `feat/documents-portail` :

| Zone | Composants |
|---|---|
| Proposition | `DevisCorps.astro` (sections et notes), `DevisReponse.astro`, `DocumentReponses.astro` |
| Cadrage | `CadrageIntro.astro`, `CadrageComparatif.astro` (large), `CadrageSimulateur.astro`, `CadrageFormulaire.astro` |
| Livrable | `LivrableApercu.astro`, `LivrableVideo.astro`, `LivrableMessage.astro`, `LivrableParcours.astro`, `LivrableSuite.astro`, `LivrableReponse.astro` |
| Témoignage | `TemoignageCasClient.astro`, `TemoignageFormulaire.astro` |
| Gabarits de page | Les blocs de notes des pages de cadrage, de livrable et de témoignage, à leur emplacement après la fusion |

La nav des sections et les ancres ne changent pas.

## Tests

- Un test refuse toute occurrence de `grid-cols-[180px_1fr]` dans `src/components/{devis,cadrage,livrable,temoignage,documents}`.
- Recette Playwright, sur le Chrome installé, des quatre types de document à 1 440, 768 et 390 px :
  - le bord gauche de chaque h2 de section est le même sur toute la page, section large comprise ;
  - aucune page ne déborde horizontalement ;
  - la proposition imprimée tient ses titres en h3.
- Les captures sont montrées à Ludo en local, jamais en staging.

## Hors périmètre

- L'en-tête du document et les onglets d'étape, posés par la spec du 2026-09-30 sur la barre du portail.
- Le contenu et l'ordre des sections : lot 2.

## Documentation

- La page `/design-system` : le motif de section de document, avec son titre au-dessus et la variante large.
- `src/content/docs/coolbeans/05-chiffrages-et-devis.mdx` : la mise en page des documents.
- `docs/superpowers/specs/README.md` : la ligne de cette spec.
