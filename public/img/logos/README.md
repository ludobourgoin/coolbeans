# Logos (marques tierces)

Ces logos étaient chargés depuis des CDN externes (Iconify `logos`, Simple Icons,
favicons) dans les wireframes. Ils sont ici **rapatriés en local** pour un build
Astro autonome — plus aucune dépendance réseau à l'exécution.

## Où ils servent

- **about · bande proof** (marquee sous le hero) : webflow, astro-icon, gsap-icon,
  shopify, sanity, make, zapier-icon, figma, notion, airtable, hubspot,
  google-analytics, slack-icon, github-icon, cloudflare-icon.
- **home · visuel « flux »** (hero) : figma, astro-icon, gsap-icon, cloudflare-icon,
  stripe, make, sanity, notion, github-icon, netlify-icon, supabase-icon, sentry-icon,
  visual-studio-code, brevo, resend, posthog, n8n, claude, hubspot…

> [!important] Règle de la bande proof : **picto carré + nom de marque**
> Le nom est rendu en Geomanist par `LogoMarquee`, à côté du picto. Donc on n'y met
> **jamais un lockup** (`astro.svg`, `zapier.svg`, `github.svg`, `gsap.svg` : le nom
> serait affiché deux fois) et **jamais un picto muet**. Un logo à ajouter dans la
> bande veut donc dire : la variante *glyphe seul* du logo, et son nom dans `name`.
>
> Les pictos monochromes encre (astro-icon, notion, github-icon) portent `mono: true`
> dans `src/data/logos.ts` : ils sont inversés en blanc en dark mode, sans quoi ils
> disparaîtraient sur fond sombre. Attention, la classe CSS s'appelle bien `mono` et
> **pas `invert`** — Tailwind expose une utilitaire globale `.invert` qui, elle,
> s'appliquerait aussi en clair et blanchirait le picto en permanence.

## Sources d'origine

| Fichier | Source |
|---|---|
| `*.svg` (multicolore, ex. figma, shopify, astro, sanity) | `api.iconify.design/logos/<nom>.svg` |
| `*-icon.svg` (glyphe seul, ex. cloudflare-icon, github-icon) | `api.iconify.design/logos/<nom>-icon.svg` |
| `notion.svg`, `stripe.svg`, `make.svg`, `hubspot.svg`… | `cdn.simpleicons.org/<nom>/<hex>` (monochromes teintés) |
| `gsap-icon.svg` (picto 4 cercles) | `gsap.com/safari-pinned-tab.svg` — seul picto carré officiel en vectoriel, recoloré au vert de marque `#0AE448` |
| `gsap.svg` (wordmark) | `cdn.simpleicons.org/gsap/0AE448` — **inutilisé** depuis le passage de la bande proof au picto + nom. Conservé au cas où un lockup serait utile ailleurs. |

## Recommandation Astro (mieux que 30 SVG en dur)

Ces icônes sont toutes disponibles via **`astro-icon` + `@iconify-json/logos`**
(et Simple Icons). Approche native conseillée :

```bash
npm i astro-icon @iconify-json/logos @iconify-json/simple-icons
```

```astro
---
import { Icon } from "astro-icon/components";
---
<Icon name="logos:figma" />
<Icon name="simple-icons:notion" />
```

Les SVG de ce dossier restent utilisables tels quels (`<img src="/img/logos/figma.svg">`)
si tu préfères éviter une dépendance.

## À sourcer manuellement (2)

`ahrefs` et `gocardless` venaient de favicons (pas dans Iconify/Simple Icons) —
non rapatriables automatiquement. Dans les wireframes, un `onerror` les masque
proprement s'ils manquent. Les récupérer depuis les kits de marque officiels si besoin.
