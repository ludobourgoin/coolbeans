// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";

// Hébergement : Cloudflare PAGES. Site entièrement prérendu, donc aucun
// adaptateur — Pages sert le contenu de `dist/` tel quel.
//
// Ne pas ajouter d'adaptateur « au cas où ». Les deux essais faits :
//   @astrojs/node       → produit un serveur Node standalone, que Pages ne sait
//                         pas exécuter. Déploiement en 404 sur toutes les
//                         routes, sans message d'erreur.
//   @astrojs/cloudflare → vise Cloudflare WORKERS, pas Pages : sortie découpée
//                         en dist/client + dist/server et wrangler.json à
//                         bindings Workers. Pages ne trouve pas le site.
//
// Clerk reste en dépendance mais n'est PAS enregistré ici : l'intégration
// n'a de sens qu'avec du rendu serveur, et aucune page n'en fait aujourd'hui.
// Le jour du dashboard client (cf. _doc-standard/SPEC.md, hors périmètre v1),
// deux chemins : migrer le projet Pages vers Workers, ou protéger la zone via
// Cloudflare Access — ce que le README du bundle doc prévoyait déjà.

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
