// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import clerk from "@clerk/astro";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

// Hébergement : Cloudflare WORKERS (décision 2026-07-31, pour l'espace client
// Clerk qui exige du rendu serveur — cf. _doc-standard/SPEC.md).
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
// middleware Clerk — une page prérendue le contournerait).
// Secrets en prod : CLERK_SECRET_KEY = secret du Worker, jamais dans le repo.

// https://astro.build/config
export default defineConfig({
  site: "https://coolbeans.cc",
  integrations: [
    clerk(),
    mdx(),
    sitemap({
      // Pages privées/utilitaires exclues du sitemap : espace client (SSR,
      // déjà noindex), doc de passation (noindex), devis (pages noindex par
      // définition), design-system (référence interne, bloquée par robots.txt).
      filter: (page) =>
        !page.includes("/espace") &&
        !page.includes("/docs/") &&
        !page.includes("/devis/") &&
        !page.includes("/design-system"),
    }),
  ],
  adapter: cloudflare(),
  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
