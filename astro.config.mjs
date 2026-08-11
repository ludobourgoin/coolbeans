// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import clerk from "@clerk/astro";
import { frFR } from "@clerk/localizations";
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

// En CI (Workers Builds), la publishable key Clerk est fixée ici par
// environnement : instance production pour la prod, instance dev pour staging.
// Ce n'est pas un secret (elle est embarquée dans chaque page envoyée au
// navigateur). En local, .env fait foi. CLERK_SECRET_KEY reste un secret du
// Worker, jamais dans le repo.
if (process.env.WORKERS_CI || process.env.CI) {
  process.env.PUBLIC_CLERK_PUBLISHABLE_KEY =
    process.env.CLOUDFLARE_ENV === "staging"
      ? "pk_test_cHJlY2lzZS1yYW0tNTIuY2xlcmsuYWNjb3VudHMuZGV2JA"
      : "pk_live_Y2xlcmsuY29vbGJlYW5zLmNjJA";
}

// https://astro.build/config
export default defineConfig({
  site: "https://coolbeans.cc",
  // compressHTML (défaut true) supprime les retours à la ligne du HTML, y
  // compris ceux qui séparent un mot d'un <b>/<a> inline quand Prettier
  // replie la ligne — ce qui colle les mots au rendu (« etcommunication »).
  compressHTML: false,
  integrations: [
    // Composants Clerk en français (la page hébergée accounts.* reste en
    // anglais chez Clerk — d'où la page /connexion hébergée dans l'app).
    clerk({ localization: frFR }),
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
