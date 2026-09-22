// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

import preact from "@astrojs/preact";
import { execSync } from "node:child_process";

// Empreinte git du build, injectée comme littérale par Vite. Elle sert à la
// bande d'environnement (components/ui/EnvBanner.astro) : une page hors
// production compare son empreinte à celle que sert la production, et signale
// visuellement que ce qu'on lit n'est pas encore ce que le client voit.
//
// Lue ici et nulle part ailleurs. `node:child_process` n'existe pas dans le
// runtime Workers : le calcul doit rester au build, et ce qui traverse est une
// chaîne. Un composant qui appellerait git dans son frontmatter planterait sur
// les pages SSR (/espace et /docs).
//
// Tout échoue en silence : un clone superficiel ne porte pas l'historique, et
// une bande dégradée vaut mieux qu'un build cassé.
const git = (commande, secours) => {
  try {
    return execSync(commande, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return secours;
  }
};

const GIT_SHA = git("git rev-parse --short HEAD", "");
// Quarante empreintes suffisent : au-delà, l'écart entre staging et la
// production n'est plus un oubli de publication mais une branche oubliée.
const GIT_HISTORIQUE = git("git log -n 40 --format=%h", "").split("\n").filter(Boolean);

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
      // déjà noindex), doc de passation (noindex), devis et cadrage (documents
      // commerciaux nominatifs, noindex par définition et bloqués par
      // robots.txt), connexion (noindex ; `prerender = false` ne suffit pas à
      // l'exclure), design-system (référence interne, bloquée par robots.txt).
      filter: (page) =>
        !page.includes("/espace") &&
        !page.includes("/docs/") &&
        !page.includes("/devis/") &&
        !page.includes("/cadrage/") &&
        !page.includes("/connexion") &&
        // Les deux écrans de récupération de mot de passe : sans intérêt dans
        // un index, et leur présence dirait publiquement où se trouve la
        // porte de service du portail.
        !page.includes("/mot-de-passe-oublie") &&
        !page.includes("/reinitialiser") &&
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
    define: {
      __GIT_SHA__: JSON.stringify(GIT_SHA),
      __GIT_HISTORIQUE__: JSON.stringify(GIT_HISTORIQUE),
    },
  },
});