# Icônes de la boîte à outils (`/tools`)

Une icône par outil de `src/data/tools.ts`, **rapatriée en local** — aucune requête
réseau au runtime, et aucune dépendance à un service de favicons tiers.

## La règle

> [!important] Icône carrée, issue du **favicon du site officiel**
> On prend l'`apple-touch-icon` (souvent 180×180) quand il existe, sinon la plus
> grande variante déclarée dans le `<head>`, sinon `/favicon.ico`.
>
> L'intérêt du favicon comme source unique : il est **déjà dessiné comme une icône
> d'app** — cadrage carré, marges internes, lisible en petit. C'est ce qui permet
> aux 53 vignettes d'avoir la même densité optique sans retouche individuelle.

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
- **Une icône pour plusieurs cartes, c'est normal** : `cloudflare.png` sert aux trois
  produits Cloudflare, `apple.png` au macbook / iphone / airpods, `dell.png` aux trois
  écrans et à la webcam. Ce sont les mêmes marques.

## Ne pas confondre avec `../logos/`

`../logos/` sert la **bande proof** (`/about`) et le **flux hero** (`/`), avec une autre
règle : pictos Iconify + nom rendu en Geomanist à côté. Les deux jeux coexistent, un
même outil peut donc apparaître dans les deux avec des fichiers différents (ex. astro :
`logos/astro-icon.svg` pour la bande, `tools/astro.svg` pour la vignette).
