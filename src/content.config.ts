import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/* Un fichier YAML par devis dans src/content/devis/ ; le nom du fichier
   devient le slug de l'URL (/devis/<fichier>). Rendu par
   src/pages/devis/[slug].astro. Le gras s'écrit **comme en Markdown**
   dans n'importe quelle chaîne.

   Chaque section porte un titre (le libellé mono de la colonne de gauche)
   et combine librement : `texte`, `liste`, `budget` (lignes chiffrées,
   totaux calculés ; une ligne sans `prix` s'affiche « Inclus »),
   `planning` (jalons datés). Les `notes` de fin s'affichent en bandeaux. */
const devis = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/devis" }),
  schema: z.object({
    titre: z.string(),
    objet: z.string(),
    date: z.coerce.date(),
    sections: z.array(
      z.object({
        titre: z.string(),
        texte: z.string().optional(),
        liste: z.array(z.string()).optional(),
        budget: z
          .object({
            lignes: z.array(z.object({ label: z.string(), prix: z.number().optional() })),
            remisePct: z.number().optional(),
            mention: z.string().optional(), // suffixe des totaux, ex. « HT »
            reglement: z.string().optional(),
          })
          .optional(),
        planning: z
          .object({
            jalons: z.array(z.object({ date: z.string(), label: z.string() })),
            note: z.string().optional(),
          })
          .optional(),
      }),
    ),
    notes: z.array(z.string()).default([]),
  }),
});

/* Un fichier Markdown par étude de cas dans src/content/projets/ ; le nom du
   fichier devient le slug de l'URL (/projets/<fichier>). Rendu par
   src/pages/projets/[slug].astro.

   Le frontmatter YAML porte la fiche du projet (client, stack, captures,
   témoignage…) ; le corps Markdown porte le récit. Les captures sont
   optionnelles : absentes, le composant Browser affiche « capture à
   fournir ». `brouillon: true` publie la page en noindex, le temps de la
   validation. Schéma pensé pour migrer tel quel vers Sanity plus tard. */
const projets = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projets" }),
  schema: z.object({
    titre: z.string(),
    accroche: z.string(),
    numero: z.string().optional(), // « № 040 », même numérotation que data/cases.ts
    client: z.object({
      nom: z.string(),
      contact: z
        .object({
          nom: z.string(),
          role: z.string(),
          photo: z.string().optional(),
        })
        .optional(),
    }),
    secteur: z.string(),
    lieu: z.string().optional(),
    duree: z.string().optional(), // « 6 semaines », texte libre
    miseEnLigne: z.string().optional(), // « juin 2026 », texte libre
    url: z.string().url().optional(),
    prestations: z.array(z.string()).default([]),
    stack: z.array(z.string()).default([]),
    enBref: z.array(z.string()).default([]),
    hero: z.object({ shot: z.string().optional(), alt: z.string() }).optional(),
    avantApres: z
      .array(
        z.object({
          titre: z.string(),
          avant: z.object({ shot: z.string().optional(), alt: z.string() }),
          apres: z.object({ shot: z.string().optional(), alt: z.string() }),
        }),
      )
      .default([]),
    temoignage: z
      .object({
        texte: z.string(),
        auteur: z.string(),
        role: z.string(),
        photo: z.string().optional(),
      })
      .optional(),
    brouillon: z.boolean().default(false),
  }),
});

export const collections = { devis, projets };
