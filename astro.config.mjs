// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

import preact from "@astrojs/preact";

// Hébergement : Cloudflare WORKERS (décision 2026-07-31, pour l'espace client
// qui exige du rendu serveur — cf. _doc-standard/SPEC.md). L'auth était alors
// Clerk ; elle est passée à Better Auth le 2026-08-29, la contrainte reste.
//
// Historique utile : le site était 100 % prérendu sur Cloudflare PAGES, sans
// adaptateur. Les essais précédents avaient échoué parce que la sortie de
// @astrojs/cloudflare (format Workers : dist/client + dist/server + wrangler
// généré) était poussée vers le projet PAGES, qui ne sait pas la servir.
// La cible correcte est un projet WORKERS : `npm run build` puis
// `npx wrangler deploy` (le wrangler.json généré dans dist/ est repris via
// .wrangler/deploy/config.json). L'ancien projet Pages sera remplacé.
//
// Découpage du rendu : le site vitrine reste prérendu (défaut statique) ;
// seuls /espace et /docs déclarent `prerender = false` (SSR, requis par le
// middleware d'authentification — une page prérendue le contournerait).
//
// Better Auth n'a aucune clé publique à injecter au build : tout se joue
// côté Worker, avec BETTER_AUTH_SECRET en secret. Le bloc qui fixait ici la
// publishable key Clerk par environnement est parti avec la dépendance.

// https://astro.build/config
export default defineConfig({
  site: "https://coolbeans.cc",
  // compressHTML (défaut true) supprime les retours à la ligne du HTML, y
  // compris ceux qui séparent un mot d'un <b>/<a> inline quand Prettier
  // replie la ligne — ce qui colle les mots au rendu (« etcommunication »).
  compressHTML: false,
  integrations: [
    mdx(),
    sitemap({
      // Pages privées/utilitaires exclues du sitemap : espace client (SSR,
      // déjà noindex), doc de passation (noindex), devis (pages noindex par
      // définition), connexion (noindex ; `prerender = false` ne suffit pas à
      // l'exclure), design-system (référence interne, bloquée par robots.txt).
      filter: (page) =>
        !page.includes("/espace") &&
        !page.includes("/docs/") &&
        !page.includes("/devis/") &&
        !page.includes("/connexion") &&
        !page.includes("/design-system"),
    }),
    preact(),
  ],
  adapter: cloudflare(),
  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});