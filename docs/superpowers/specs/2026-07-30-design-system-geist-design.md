# Spec — Design system Coolbeans : passage en monochrome sur base Geist

Date : 2026-07-30
Branche de travail : `staging`
Statut : validé, prêt pour le plan d'implémentation

---

## 0. Contexte et problème

Le design system actuel (`src/styles/global.css`) repose sur une palette cream/beige
(`--surface-marque: #f7f3ef`, `--surface-raise: #f2efe8`) plus une texture papier
(`/img/bg-texture.png`), avec Geomanist comme unique famille typographique.

On veut un système **monochrome** — noir, blanc, nuances de gris — sobre et épuré,
construit sur le design system **Geist** de Vercel (couleurs, grille, espacement,
composants), tout en gardant une signature qui empêche le site de ressembler à
n'importe quel outil pour développeurs.

Contrainte de fond : Geist appliqué au pied de la lettre est l'uniforme visuel de
l'écosystème dev-tool. Un studio web indépendant qui l'adopte tel quel gagne l'épure
et perd son odeur. D'où la décision n° 2 ci-dessous.

## 1. Décisions verrouillées

| # | Décision | Motif |
|---|---|---|
| 1 | Monochrome intégral sur l'interface | Demande initiale : arrêt du beige |
| 2 | **Geomanist reste sur h1/h2**, Geist prend tout le reste | Signature : une display ronde et chaude sur un système froid. Coût nul, fonts déjà self-hostées |
| 3 | Système de couleurs Geist **complet** (10 échelles) | Demandé explicitement. Les échelles colorées ne servent qu'aux états fonctionnels |
| 4 | Refonte complète : tokens + rythme + composants + pages | Demandé explicitement |
| 5 | Images, logos et portraits **gardent leur couleur** | Le monochrome ne concerne que l'interface |
| 6 | Anneau de focus **bleu** (`--ds-focus-color`) | Fait partie du système Geist. Un signal d'accessibilité est un état fonctionnel |
| 7 | Pastilles macOS du Browser en **vraies couleurs** | Trois points gris ne se lisent plus comme un navigateur |
| 8 | `container` reste à **1280px** | Le brief annonçait 1200, le token Geist réel vaut 1400. 1280 est déjà en place, le changer serait du mouvement pour rien |

## 2. Origine des valeurs

Toutes les valeurs Geist de cette spec sont **extraites de la feuille compilée de
vercel.com**, pas reconstituées de mémoire ni recopiées d'une capture. Le script
d'extraction est versionné (§9). Deux arbitrages ont été nécessaires :

- **Cascade.** Un bloc partagé (`:root,:host,.dark,…`) porte les tokens agnostiques
  et sert de socle ; les blocs spécifiques à un thème l'emportent toujours, quel que
  soit leur rang dans le fichier. Vérifié contre la couche `lab()`.
- **Fond sombre.** La feuille de Vercel porte deux définitions concurrentes : le
  système HSL donne `background-100: 4%` et `background-200: 0%`, la couche `lab()`
  aplatit les deux à `#000`. On garde le système HSL — une paire `#000/#000` rend les
  deux tokens indiscernables, donc inutilisables pour alterner des sections.

## 3. Couleurs

### 3.1 Fondation — `src/styles/geist-tokens.css` (vendored, ~20 Ko)

Dix échelles de dix marches : `background` (2), `gray`, `gray-alpha`, `blue`, `red`,
`amber`, `green`, `teal`, `purple`, `pink`. Plus les ombres, tailles, z-index, focus
et tokens de mouvement.

Structure du fichier : hex sRGB en base, surcouche `lab()` / `oklch()` derrière
`@supports (color: lab(0% 0 0))` pour les écrans grand gamut — exactement la
structure que Vercel livre. Thème piloté par la classe `.dark` sur `<html>`
(le toggle existant du site ne change pas).

Échelle de gris de référence :

| marche | clair | sombre |
|---|---|---|
| 100 | `#f2f2f2` | `#1a1a1a` |
| 200 | `#ebebeb` | `#1f1f1f` |
| 300 | `#e6e6e6` | `#292929` |
| 400 | `#eaeaea` | `#2e2e2e` |
| 500 | `#c9c9c9` | `#454545` |
| 600 | `#a8a8a8` | `#878787` |
| 700 | `#8f8f8f` | `#8f8f8f` |
| 800 | `#7d7d7d` | `#7d7d7d` |
| 900 | `#4d4d4d` | `#a0a0a0` |
| 1000 | `#171717` | `#ededed` |

> Quirk conservé tel quel : en clair, `gray-300` (`#e6e6e6`) est **plus sombre** que
> `gray-400` (`#eaeaea`). Ce n'est pas une erreur d'extraction — `400` est la couleur
> de bordure, `300` un fond de survol, et les deux ont divergé chez Vercel.

### 3.2 Couche sémantique Coolbeans — `src/styles/global.css`

Les `--ds-*` basculent seuls avec `.dark` : la couche Coolbeans n'a presque rien à
redéclarer en sombre.

| token | source Geist | rôle | clair → sombre |
|---|---|---|---|
| `--surface` | `--ds-background-100` | surface de contenu | `#fff` → `#0a0a0a` |
| `--surface-subtle` | `--ds-background-200` | sections en retrait | `#fafafa` → `#000` |
| `--surface-raise` | `--ds-gray-100` | cartes, chips, encarts | `#f2f2f2` → `#1a1a1a` |
| `--line` | `--ds-gray-400` | filet fin | `#eaeaea` → `#2e2e2e` |
| `--line-strong` | `--ds-gray-500` | filet appuyé | `#c9c9c9` → `#454545` |
| `--ink` | `--ds-gray-1000` | texte principal | `#171717` → `#ededed` |
| `--mute` | `--ds-gray-900` | texte secondaire | `#4d4d4d` → `#a0a0a0` |
| `--accent` | `--ds-gray-1000` | CTA, liens, états actifs | `#171717` → `#ededed` |
| `--accent-ink` | `--ds-background-100` | texte sur aplat accent | `#fff` → `#0a0a0a` |
| `--accent-hover` | — | survol du bouton primaire | `hsl(0 0% 22%)` → `hsl(0 0% 80%)` |
| `--focus` | `--ds-focus-color` | anneau de focus | `blue-700` → `blue-900` |

**Attention au sens du retrait.** En clair, la section alternée est plus *claire*
que le contenu ; en sombre elle est plus *noire*. Ce n'est pas une symétrie
intuitive, c'est celle de Geist.

### 3.3 États fonctionnels

`--info: --ds-blue-700` · `--success: --ds-green-800` · `--warning: --ds-amber-800`
· `--error: --ds-red-800`.

Règle : jamais en fond de section, jamais en CTA, jamais dans la charte. Uniquement
sur du signal. Un message d'erreur en gris n'est pas un message d'erreur.

### 3.4 Contrastes vérifiés

| paire | ratio | verdict |
|---|---|---|
| `--ink` / `--surface` clair | 17,93:1 | AAA |
| `--mute` / `--surface` clair | 8,45:1 | AAA |
| `--ink` / `--surface` sombre | 16,91:1 | AAA |
| `--mute` / `--surface` sombre | 7,57:1 | AAA |
| `--mute` / `--surface-subtle` sombre | 8,03:1 | AAA |

## 4. Typographie

```
--font-display : "Geomanist"      700 / 800   → h1, h2 uniquement
--font-sans    : "Geist Sans"     400–600     → corps, UI, h3–h5, boutons, nav
--font-mono    : "Geist Mono"     500 / 700   → labels, eyebrows, code
```

Geist Sans et Geist Mono en **variable woff2**, extraites du paquet npm `geist@1.7.2`
et self-hébergées dans `public/fonts/` (68 Ko + 70 Ko). Aucun appel CDN, aucune
dépendance ajoutée à `package.json` — les deux fichiers sont vendored.

Corps : **16px / 1.5 / weight 400** (aujourd'hui 17px / 500). Le 16 aligne le texte
sur la base 4px.

`@font-face` de `geomanist-book` et `geomanist-medium` **supprimés** : h3–h5 et le
corps passent à Geist, seuls bold (700) et black (800) restent utiles. Gain : deux
fichiers de police en moins au chargement. Les fichiers restent sur le disque.

## 5. Rythme et layout

```
--space-2x   8px      --space-8x   32px     --space-24x  96px
--space-3x  12px      --space-10x  40px     --space-32x 128px
--space-4x  16px      --space-16x  64px
--space-6x  24px  (gap par défaut)

--container 1280px    (inchangé — cf. décision 8)
--gutter      24px    (aujourd'hui 56 desktop / 24 mobile)
```

Le passage du gutter de 56 à 24 est le changement le plus visible et le plus
réversible. Si à l'écran ça pince trop, on remonte à 32 sans rien casser d'autre.

Rayons : `--radius-control: 6px` (boutons, champs) · `--radius-card: 8px` (cartes).
Les coins nets à 0px disparaissent — la signature est portée par la typo, pas par
le filet encre.

## 6. Materials — élévation

**Ce n'est pas du verre dépoli.** Aucun `backdrop-filter` dans la feuille de Vercel.
C'est une pile d'ombres dont un anneau de `0 0 0 1px` qui remplace la bordure.

| classe | usage |
|---|---|
| `.material-base` | anneau 1px seul, sans ombre portée |
| `.material-small` | cartes posées, cadre Browser |
| `.material-medium` | — |
| `.material-large` | éléments détachés |
| `.material-tooltip` | infobulles |
| `.material-menu` | popovers, listes déroulantes |
| `.material-modal` | modales, command menu |

## 7. Composants

### 7.1 Bouton — spec Geist stricte

- Bordure en `box-shadow: 0 0 0 1px`, **pas** en `border` : elle ne participe pas au
  calcul de taille.
- Transition `150ms ease-in-out` sur `background`, `color`, `box-shadow`.
  Coupée (`transition: none`) au focus, pour que l'anneau apparaisse instantanément.
- Aucun `transform` au survol ni au clic.

| type | défaut | survol clair | survol sombre |
|---|---|---|---|
| primaire | `--ds-gray-1000` | `hsl(0 0% 22%)` | `hsl(0 0% 80%)` |
| secondaire | surface + anneau `--ds-gray-400` | `--ds-gray-100` | `--ds-gray-200` |
| tertiaire | transparent, sans anneau | `--ds-gray-alpha-200` | idem |

> Le primaire **n'inverse pas** au survol : il s'éclaircit en clair, s'assombrit en
> sombre. Dans les deux cas il se rapproche du fond au lieu de basculer dedans.

Tailles : `small 32px / 6px de padding · 6px de rayon` — `medium 36px / 10px / 6px` —
`large 40px / 14px / 8px`. Le CTA principal utilise `large`.

Focus : `0 0 0 1px <anneau>, 0 0 0 2px var(--surface), 0 0 0 4px var(--focus)`.

Inactif : fond `--ds-gray-100`, texte `--ds-gray-700`, anneau `--ds-gray-400`.

### 7.2 Browser — cadre de portfolio

`container-type: inline-size` sur le cadre, `border-radius: 1.5cqw` au-delà de 768px
(6px en dessous). Le rayon suit la largeur du conteneur, ce qui garde le cadre juste
à toutes les tailles.

Barre : fond `--ds-background-100`, `8px 16px` (mobile) / `10px 20px` (≥768px), trois
zones flex. Pastilles `12px` en `#FE5F57` `#FEBB2E` `#26C941`. Barre d'adresse :
fond `--ds-background-200`, bordure `--ds-gray-400`, `border-radius: 999px`,
padding `4px 4px 4px 16px`, texte 13px `--ds-gray-1000` centré et tronqué.

Vue : `aspect-ratio: 16/10`, fond `--ds-background-200`, image en `object-fit: cover`
ancrée en haut.

**Données.** Le modèle `cases` de `src/pages/index.astro` migre vers
`src/data/cases.ts` et gagne deux champs **optionnels** : `url` et `shot`. Quand ils
sont absents, le cadre affiche un état vide explicite (« capture à fournir » + le tag
du projet). Aucune URL n'est inventée : la seule vérifiable depuis le repo est
`trigger.fr`. Les quatre études de cas existantes (№ 040 à № 037) sont reprises mot
pour mot.

### 7.3 Bibliothèque

Construits aux specs Geist, tous branchés sur les tokens :

**Emploi immédiat sur le site** — `badge` (pilule, 12px/24px medium et 11px/20px +
0,2px d'approche small ; plein = fond `-800/-900` sur `--ds-contrast-fg`, discret =
fond `-200` sur texte `-900`), `avatar` (anneau `0 0 0 1px var(--surface)`, piles à
`-8px`), `breadcrumbs`, `description`, `banner`, `collapse`, `copy-button`.

**Mobilier d'application, construits mais non posés** — `choicebox`,
`clearable-input`, `context-card`, `command-menu`. Ils entrent dans la bibliothèque,
pas dans les pages. Un command menu sur un site de trois pages coûte du JS, un piège
à focus et un travail d'accessibilité pour remplacer une navigation qui tient en cinq
liens. À poser le jour où il y a un volume réel à parcourir.

### 7.4 GridBackdrop

Composant Astro. SVG en `<pattern>` de 64px, `stroke-dasharray="4 5"`,
`stroke="currentColor"` avec `color: var(--line-strong)`, masqué par un
`radial-gradient` pour s'estomper sur les bords. Posé en fond des hero.

### 7.5 Page `/design-system` — vitrine vivante

Une page de référence interne à `/design-system`, **non indexable**, pour revenir sur
le système et l'affiner au fil de l'eau.

Contrainte structurante : elle **importe et consomme les composants Astro réels**.
Elle ne recopie aucun markup. Une page de référence qui duplique le code diverge en
quelques semaines et devient un mensonge — c'est exactement ce qu'on ne veut pas d'un
document destiné à durer. Si un composant change, la page change avec lui.

Contenu : les dix échelles de couleur, la couche sémantique, les états, les spécimens
typographiques, l'échelle d'espacement, les sept niveaux de Materials, la matrice
complète des boutons (3 types × 3 tailles + inactif), le cadre Browser dans ses deux
états, et toute la bibliothèque.

Non-indexation en double barrière : `<meta name="robots" content="noindex, nofollow">`
via une prop `noindex` ajoutée à `BaseLayout.astro`, **et** une entrée `Disallow` dans
un `public/robots.txt` créé pour l'occasion. Le site n'en a pas aujourd'hui ; le
fichier garde tout le reste crawlable. La page n'est liée depuis aucune navigation.

## 8. Suppressions

| élément | sort |
|---|---|
| `--surface-marque`, `--surface-raise` (valeurs cream) | redéfinis, `--surface-marque` renommé `--surface-subtle` |
| grain papier dans `.surface-brand` | retiré. `/img/bg-texture.png` **reste sur le disque**, simplement plus référencé |
| `[data-accent="electric"]` et `.dark[data-accent="electric"]` | supprimés — code mort contraire au monochrome |
| `--card-frame` (filet encre 30 %) | supprimé — remplacé par `--line` |
| `@font-face` geomanist-book et geomanist-medium | supprimés. Fichiers conservés |

Aucun fichier n'est supprimé ni renommé.

## 9. Fichiers touchés

**Créés**
- `src/styles/geist-tokens.css` — fondation vendored, en-tête documentant la source et la date de capture
- `src/components/GridBackdrop.astro`
- `src/components/Browser.astro`
- `src/components/ui/` — Badge, Avatar, Breadcrumbs, Description, Banner, Collapse, CopyButton, Choicebox, ClearableInput, ContextCard, CommandMenu
- `src/data/cases.ts`
- `src/pages/design-system.astro`
- `public/robots.txt`
- `public/fonts/Geist-Variable.woff2`, `public/fonts/GeistMono-Variable.woff2`
- `scripts/extract-geist-tokens.js` — régénération quand Geist bouge
- `scripts/verify-design-system.js` — harnais d'assertions (le projet n'a pas de runner de tests)

**Réécrits**
- `src/styles/global.css` — couche Coolbeans + primitives

**Modifiés**
- `src/layouts/BaseLayout.astro` — prop `noindex`
- `src/components/Nav.astro`, `Footer.astro`, `CtaBand.astro`, `LogoMarquee.astro`
- `src/pages/index.astro`, `about.astro`, `tools.astro`
- `package.json` — scripts `verify` et `tokens`

Les blocs `<style>` de `Nav.astro`, `Footer.astro`, `CtaBand.astro`, `index.astro` et
`about.astro` disparaissent : tout passe en utilitaires Tailwind branchés sur les
tokens, conformément à la convention CSS du projet.

Liste close des `<style>` tolérés, chacun justifié par une chose que les utilitaires
ne savent pas exprimer. Le harnais de vérification refuse tout autre fichier.

| fichier | justification |
|---|---|
| `Flow.astro` | timeline GSAP — exception déjà actée |
| `LogoMarquee.astro` | `@keyframes` du défilement, **réduit à ça** |
| `Browser.astro` | `container-type` et rayon en `cqw` |
| `ui/Collapse.astro` | `::marker` et contenu généré du chevron |
| `ui/Choicebox.astro` | `:has(:checked)` combiné au survol |
| `ui/ClearableInput.astro` | `:not(:placeholder-shown)` + sélecteur adjacent |
| `ui/ContextCard.astro` | popover au survol et `:focus-within` |

## 10. Vérification

1. `npm run build` passe.
2. Les cinq paires de contraste du §3.4 tiennent, en clair et en sombre.
3. Aucun `--ds-*` référencé sans être défini.
4. Aucune occurrence résiduelle de `surface-marque`, `card-frame`, `data-accent`,
   `bg-texture` dans `src/`.
5. Rendu vérifié sur la preview Cloudflare de `staging`.
6. **Aucune publication en production.** Le déploiement prod attend un ordre explicite.

## 11. Hors périmètre

- Réalignement de `_doc-standard/SPEC.md` §7 « Charte & palette » sur les nouveaux
  tokens — à faire le jour où ce bundle est intégré, pas maintenant.
- Captures d'écran et domaines des sites clients.
- Passage du `container` à 1400px.
- Toute publication en production.
