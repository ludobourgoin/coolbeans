import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/* Un fichier YAML par devis dans src/content/devis/ ; le nom du fichier
   devient le slug de l'URL (/devis/<fichier>). Rendu par
   src/pages/devis/[slug].astro. Le gras s'écrit **comme en Markdown**
   dans n'importe quelle chaîne. */
const devis = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/devis" }),
  schema: z.object({
    titre: z.string(),
    objet: z.string(),
    date: z.coerce.date(),
    objectif: z.string(),
    perimetre: z.string(),
    activites: z.array(z.string()),
    livrables: z.array(z.string()),
    budget: z.object({
      lignes: z.array(z.object({ label: z.string(), prix: z.number() })),
      remisePct: z.number().optional(),
      reglement: z.string(),
    }),
    timing: z.string(),
    notes: z.array(z.string()).default([]),
  }),
});

export const collections = { devis };
