# Icônes de la boîte à outils (`/tools`) et des Ressources (`/espace/ressources`)

Une icône par outil de `src/data/tools.ts` et par ressource de `src/data/ressources.ts`,
**rapatriée en local** : aucune requête réseau au runtime, aucune dépendance à un
service de favicons tiers. Les deux pages partagent le dossier : `zapier.png`,
`make.png` et `webflow.png` servent aux deux.

## La règle

> [!important] Icône carrée, issue du **favicon du site officiel**
> On prend l'`apple-touch-icon` (souvent 180×180) quand il existe, sinon la plus
> grande variante déclarée dans le `<head>`, sinon `/favicon.ico`.
>
> L'intérêt du favicon comme source unique : il est **déjà dessiné comme une icône
> d'app** — cadrage carré, marges internes, lisible en petit. C'est ce qui permet
> aux 54 vignettes d'avoir la même densité optique sans retouche individuelle.

Le champ `logo` de `Tool` est **obligatoire** (`string`, pas `string | null`) : plus
de fallback « initiales ». Ajouter un outil sans icône ne compile pas, c'est voulu.

Rendu par `src/pages/tools.astro` : vignette 44×44 au liseret `var(--line)`, icône
contenue à 74 %. La vignette garde un fond clair en dark mode — beaucoup de favicons
sont des marques encre sur fond transparent, qui disparaîtraient sur une carte sombre.
Même parti pris que les boîtes du flux hero.

## Cas particuliers

Trois outils **n'utilisent pas** leur favicon, qui était inexploitable. Ils pointent
vers les pictos SVG déjà présents dans `../logos/`, plus nets :

| Outil | Pourquoi | À la place |
|---|---|---|
| sentry | `sentry.io/apple-touch-icon.png` renvoie du HTML, pas une image | `/img/logos/sentry-icon.svg` |
| slack | favicon plafonné à 35×35 (flou dès 44 px) | `/img/logos/slack-icon.svg` |
| airtable | favicon plafonné à 48×48 | `/img/logos/airtable.svg` |

Autres points à savoir :

- **`nuphy.png`** vient du service de favicons Google (`s2/favicons`, 128 px) : le site
  est derrière une protection anti-bot qui répond `429` à tout téléchargement direct.
- **`clerk.svg`** vient de Simple Icons (teinté au violet de marque `#6C47FF`) : le
  favicon officiel plafonne à 32×32.
- **`nextjs.svg`** vient de Simple Icons aussi : `nextjs.org` ne déclare qu'un
  `favicon.ico` 48×48, et n'expose ni `apple-icon.png` ni `icon.png`.
- **Fichiers orphelins** (plus référencés par `tools.ts`, conservés au cas où l'outil
  reviendrait dans la liste) : `clerk.svg` — carte remplacée par Better Auth — et
  `asana.png` — carte retirée, Linear a pris la place.
- **Une icône pour plusieurs cartes, c'est normal** : `cloudflare.png` sert aux trois
  produits Cloudflare, `apple.png` au macbook / iphone / airpods, `dell.png` aux trois
  écrans et à la webcam. Ce sont les mêmes marques.

## Cas particuliers des Ressources

Rapatriées le 2026-09-30. Même règle, avec ces écarts :

| Ressource | Pourquoi | À la place |
|---|---|---|
| iloveimg | les favicons déclarés sont le cœur **rouge** d'iLovePDF, en 16 px | `iloveimg.svg` : le cœur bleu extrait du logo officiel `iloveimg.com/img/iloveimg.svg` |
| lets-enhance | favicon plafonné à 32×32, le manifest pointe vers des fichiers en 404 | `lets-enhance.svg` : le logo du header, recadré sur le picto (viewBox 24×24) |
| search-console | favicon 32×32 ; le service Google renvoie le « G » de google.com | `gstatic.com/images/branding/product/2x/search_console_96dp.png` (192 px) |
| pagespeed-insights | favicon plafonné à 48×48 | gardé tel quel : l'icône produit en haute définition est l'ancienne, grise |

- **`pexels.png`, `flaticon.png`, `microsoft-clarity.png`** viennent du service de
  favicons Google (128 px) : Pexels et Flaticon répondent `403` à tout
  téléchargement direct, Clarity ne déclare qu'un `.ico` 16 px.
- **`flaticon.png`** : la page de blocage de `flaticon.com` sert désormais un favicon
  « Magnific ». Le service Google garde le « F » turquoise de Flaticon, retenu parce
  qu'il correspond au nom affiché sur la carte. À revoir si la marque change.
- **`weglot.png`** : converti depuis le JPG 256 px déclaré en `apple-touch-icon`.
- **`webflow.png`** sert à deux cartes : Webflow University et Support Webflow.

## Ne pas confondre avec `../logos/`

`../logos/` sert la **bande proof** (`/about`) et le **flux hero** (`/`), avec une autre
règle : pictos Iconify + nom rendu en Geist (`--font-display`) à côté. Les deux jeux coexistent, un
même outil peut donc apparaître dans les deux avec des fichiers différents (ex. astro :
`logos/astro-icon.svg` pour la bande, `tools/astro.svg` pour la vignette).
