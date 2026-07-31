// À placer en src/content.config.ts (le site n'a pas encore de collections).
// Si une collection existe déjà à ce moment-là : fusionner `docs` dans l'export.
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    project: z.string(), // clé projet = dossier ("amusoire")
    title: z.string(),
    order: z.number(), // position dans la nav gauche
    status: z.enum(["draft", "review", "final"]).default("final"),
    updated: z.coerce.date(), // date de MAJ de la page
    description: z.string().optional(),
  }),
});

export const collections = { docs };
