# Coolbeans

Site du studio web Coolbeans (Ludovic Bourgoin) — **Astro 6 + Tailwind v4** (CSS-first).

## Design system

- **Source de vérité unique** : [`src/styles/global.css`](src/styles/global.css) — tokens (`@theme`),
  dark mode et primitives (`.btn`, `.btn-ghost`, `.card`, `.field`, `.link`, `.label`,
  `.surface-brand`, `.container-site`). Importée une seule fois dans
  [`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro).
- **Tailwind v4** est branché via `@tailwindcss/vite` dans
  [`astro.config.mjs`](astro.config.mjs) — pas de `tailwind.config.js`, tout vit dans `global.css`.
- **Dark mode** : classe `.dark` sur `<html>`, script anti-flash dans le layout, toggle dans la nav.
- **Accent alternatif** : `data-accent="electric"` sur `<html>` (encre → bleu cobalt).
- Polices **Geomanist** dans `public/fonts/`, assets (texture, logos, photos) dans `public/img/`.

## Structure

```text
src/
├── styles/global.css       source de vérité (tokens + primitives)
├── layouts/BaseLayout.astro <head>, SEO, anti-flash dark
├── components/             Nav · Footer · CtaBand · LogoMarquee
├── data/                   logos · testimonials · tools (page /tools)
└── pages/                  index (home) · about · tools
```

## Commandes

| Commande          | Action                                    |
| :---------------- | :---------------------------------------- |
| `npm install`     | Installe les dépendances                  |
| `npm run dev`     | Serveur local sur `localhost:4321`        |
| `npm run build`   | Build de production dans `./dist/`        |
| `npm run preview` | Prévisualise le build avant déploiement   |

## À faire (hors périmètre v1)

- Pages contact / projets / blog (les CTA « contact » pointent vers `#`).
- Animations gelées en v1 : typewriter du hero, marquees défilants (JS), dropdown nav.
- Favicons `ahrefs` / `gocardless` à sourcer (fallback initiales en attendant).
