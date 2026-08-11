import { z } from "astro:schema";

const slug = z.string().regex(/^[a-z0-9-]*$/, "Slug : minuscules, chiffres et tirets uniquement.");

export const chiffrageSchema = z.object({
  id: z.string().nullable(),
  date: z.string(),
  nom: z.string(),
  clientSlug: slug,
  projetSlug: slug,
  mode: z.enum(["configurateur", "libre"]),
  segment: z.string(),
  objectif: z.string(),
  pages: z.array(z.object({
    label: z.string(),
    niveau: z.enum(["simple", "standard", "complexe"]),
    ux: z.boolean(), ui: z.boolean(), integ: z.boolean(),
  })),
  devLines: z.array(z.object({ label: z.string(), level: z.enum(["pack1", "pack2", "pack3", "pack4"]) })),
  autres: z.array(z.object({ label: z.string(), jours: z.number().min(0) })),
  setupCms: z.boolean(), setupMultilingue: z.boolean(),
  setupHebergement: z.boolean(), setupDomaine: z.boolean(),
  affinite: z.enum(["neutre", "envie", "pasenvie"]),
  gestionProjet: z.boolean(),
  urgence: z.boolean(),
  margePct: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30)]),
  reductionNom: z.string(),
  reductionMontant: z.number().min(0),
  prixRetenu: z.number().min(0).nullable(),
  postes: z.array(z.object({ label: z.string(), jours: z.number().min(0) })),
  strategique: z.boolean(),
  raison: z.string(),
  publishedKey: z.string().nullable(),
  publishedVersions: z.number().min(0),
});

const setupItem = z.object({ jours: z.number().min(0), clientLabel: z.string() });

export const catalogueSchema = z.object({
  settings: z.object({
    tjm: z.number().positive(), demi: z.number().min(0),
    marcheBas: z.number().min(0), marcheHaut: z.number().min(0),
    joursSemaine: z.number().positive(), semainesMarge: z.number().min(0),
    chargesPct: z.number().min(0).max(100),
  }),
  catalog: z.object({
    design: z.object({
      simple: z.number().min(0), standard: z.number().min(0), complexe: z.number().min(0),
      portee: z.object({ ux: z.number().min(0).max(100), ui: z.number().min(0).max(100) }),
    }),
    integration: z.object({ simple: z.number().min(0), standard: z.number().min(0), complexe: z.number().min(0) }),
    dev: z.object({ pack1: z.number().min(0), pack2: z.number().min(0), pack3: z.number().min(0), pack4: z.number().min(0) }),
    setup: z.object({ cms: setupItem, multilingue: setupItem, hebergement: setupItem, domaine: setupItem }),
    gestion: z.object({
      coefHebdo: z.number().min(0), forfaitCMS: z.number().min(0), forfaitMultilingue: z.number().min(0),
      forfaitHebergement: z.number().min(0), forfaitDomaine: z.number().min(0), urgencePct: z.number().min(0),
    }),
    affinite: z.object({ baisse: z.number().min(0).max(100), hausse: z.number().min(0).max(100) }),
    devisTexts: z.object({
      stackTechnique: z.string(), conditionsReglement: z.string(),
      ceQueCaComprend: z.string(), horsPerimetre: z.string(),
    }),
  }),
  segments: z.record(z.string(), z.object({
    label: z.string(), desc: z.string(), gestionProjet: z.boolean(), note: z.string(),
  })),
});
