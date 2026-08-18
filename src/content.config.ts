import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/* Un fichier YAML par devis dans src/content/devis/<client>/<projet>-<4
   chiffres>.yaml ; le chemin devient l'URL (/devis/<client>/<projet>-1234).
   Un client peut porter plusieurs devis, et les anciens se conservent. Le
   suffixe chiffré rend l'URL non devinable d'un projet à l'autre.
   Les devis d'avant cette convention restent à la racine et gardent leur URL
   à un segment : la route est un catch-all, les deux formes cohabitent, et
   un lien déjà envoyé à un client ne casse jamais. Rendu par
   src/pages/devis/[...slug].astro. Le gras s'écrit **comme en Markdown**
   dans n'importe quelle chaîne.

   Chaque section porte un titre (le libellé mono de la colonne de gauche)
   et combine librement : `texte`, `liste`, `budget` (lignes chiffrées,
   totaux calculés ; une ligne sans `prix` s'affiche « Inclus »),
   `planning` (jalons datés). Les `notes` de fin s'affichent en bandeaux. */
const devis = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/devis" }),
  schema: z.object({
    titre: z.string(),
    objet: z.string(),
    date: z.coerce.date(),
    // Prénom du contact côté client, affiché sur les jalons de planning
    // attribués à "client" (owner: client). Chaque devis a son propre client.
    contact: z.string().optional(),
    envoi: z.object({ date: z.coerce.date(), destinataire: z.string() }).optional(),
    linear: z.object({ projet: z.string().optional(), affaire: z.string().optional() }).optional(),
    sections: z.array(
      z.object({
        titre: z.string(),
        texte: z.string().optional(),
        liste: z
          .array(z.union([z.string(), z.object({ texte: z.string(), tooltip: z.string().optional() })]))
          .optional(),
        budget: z
          .object({
            lignes: z.array(
              z.object({ label: z.string(), prix: z.number().optional(), tooltip: z.string().optional() }),
            ),
            remisePct: z.number().optional(),
            // Libellé de la ligne de remise. « Tarif association », « Geste
            // commercial »… Une remise nommée se valorise ; défaut neutre.
            remiseLabel: z.string().optional(),
            mention: z.string().optional(), // suffixe des totaux, ex. « HT »
            reglement: z.string().optional(),
          })
          .optional(),
        // `options` : un seul planning la plupart du temps, mais peut porter
        // plusieurs scénarios de calendrier alternatifs (ex. démarrage
        // immédiat vs démarrage différé) affichés en petit sélecteur local ;
        // le premier est affiché par défaut.
        planning: z
          .object({
            options: z
              .array(
                z.object({
                  label: z.string(),
                  texte: z.string().optional(),
                  jalons: z.array(
                    z.object({
                      date: z.string(),
                      label: z.string(),
                      owner: z.enum(["coolbeans", "client"]).optional(),
                    }),
                  ),
                  note: z.string().optional(),
                }),
              )
              .min(1),
          })
          .optional(),
        // Image de schéma (sitemap, diagramme de flux Make…), cliquable vers
        // la version plein format (nouvel onglet). Générique : tous les devis
        // ne sont pas des refontes web (ex. automatisation Make × HubSpot).
        diagram: z.object({ image: z.string(), alt: z.string() }).optional(),
      }),
    ),
    notes: z
      .array(
        z.object({
          texte: z.string(),
          tooltip: z.string().optional(),
          tone: z.enum(["neutral", "info", "success", "warning", "error"]).default("info"),
        }),
      )
      .default([]),
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

/* Un fichier MDX par page de doc de passation dans src/content/docs/<client>/ ;
   le préfixe numérique du fichier fixe l'ordre, le reste devient le slug de
   l'URL (/docs/<client>/<slug>). Rendu par src/pages/docs/[client]/[...slug].astro,
   derrière Clerk (voir src/middleware.ts). _template/ = gabarit du standard.
   1 client = 1 doc : ses projets successifs incrémentent la même doc. */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    client: z.string(), // clé client = dossier ("amusoire")
    title: z.string(),
    order: z.number(), // position dans la nav gauche
    status: z.enum(["draft", "review", "final"]).default("final"),
    updated: z.coerce.date(), // date de MAJ de la page
    description: z.string().optional(),
  }),
});

/* Un fichier YAML par client dans src/content/clients/ ; le nom du fichier est
   le slug du client. Source de vérité des mappings d'un client : sa doc, sa
   team Linear, ses monitors. Le publicMetadata Clerk ne porte plus qu'un
   pointeur `client` vers ce registre — voir
   docs/superpowers/specs/2026-08-12-selecteur-de-client-admin-design.md */
const clients = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/clients" }),
  schema: z.object({
    nom: z.string(),
    // Prénom du contact principal : c'est lui que salue la topbar quand un
    // admin est basculé sur ce client (« vue client », retour du 2026-08-17).
    // Absent, la salutation retombe sur le nom du client.
    prenom: z.string().optional(),
    doc: z.string().optional(),
    // UUID de la team Linear du client : le formulaire support y crée ses
    // tickets. Absent = module Support en empty state (COO-30).
    linearTeamId: z.string().optional(),
    // UUID du projet « Support » (evergreen) de la team du client : la
    // messagerie y crée ses tickets. Absent = module Messagerie en empty state.
    linearSupportProjectId: z.string().optional(),
    uptimerobot_monitor_ids: z.array(z.string()).default([]),
    // Workspace « à moi » (Coolbeans, Spinoza…) : en tête du sélecteur,
    // avant le liseret qui le sépare des workspaces clients.
    perso: z.boolean().default(false),
    // Emoji affiché devant le nom dans le sélecteur (workspaces clients).
    emoji: z.string().optional(),
    // Début de la relation client : fonde le tri chronologique du sélecteur.
    depuis: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    // Sort le client du sélecteur sans rien supprimer. Voir PortalWorkspace.
    archive: z.boolean().default(false),
  }),
});

export const collections = { devis, projets, docs, clients };
