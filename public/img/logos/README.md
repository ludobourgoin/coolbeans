# Logos (marques tierces)

Ces logos étaient chargés depuis des CDN externes (Iconify `logos`, Simple Icons,
favicons) dans les wireframes. Ils sont ici **rapatriés en local** pour un build
Astro autonome — plus aucune dépendance réseau à l'exécution.

## Où ils servent

- **about · bande proof** (marquee sous le hero) : astro, shopify, sanity, make,
  zapier, figma, webflow, cloudflare, notion, airtable, hubspot, google-analytics,
  slack, github…
- **home · visuel « flux »** (hero) : figma, astro-icon, cloudflare-icon, stripe,
  make, sanity, notion, github-icon, netlify-icon, supabase-icon, sentry-icon,
  visual-studio-code, brevo, resend, posthog, n8n, claude, hubspot…

## Sources d'origine

| Fichier | Source |
|---|---|
| `*.svg` (multicolore, ex. figma, shopify, astro, sanity) | `api.iconify.design/logos/<nom>.svg` |
| `*-icon.svg` (glyphe seul, ex. cloudflare-icon, github-icon) | `api.iconify.design/logos/<nom>-icon.svg` |
| `notion.svg`, `stripe.svg`, `make.svg`, `hubspot.svg`… | `cdn.simpleicons.org/<nom>/<hex>` (monochromes teintés) |

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
