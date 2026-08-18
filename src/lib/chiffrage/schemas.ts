import { z } from "astro:schema";

/* Validation serveur des Réglages (action reglages.sauvegarder). Miroir du
   type Reglages de ./types.ts : les deux évoluent ensemble. */
export const reglagesSchema = z.object({
  tjm: z.number().positive(),
  heuresJour: z.number().positive(),
  marcheBas: z.number().min(0),
  marcheHaut: z.number().min(0),
  joursSemaine: z.number().positive(),
  semainesMarge: z.number().min(0),
  chargesPct: z.number().min(0).max(100),
  gestionPct: z.number().min(0).max(100),
  urgencePct: z.number().min(0).max(100),
  affinite: z.object({
    baisse: z.number().min(0).max(100),
    hausse: z.number().min(0).max(100),
  }),
  devisTexts: z.object({
    stackTechnique: z.string(),
    conditionsReglement: z.string(),
    ceQueCaComprend: z.string(),
    horsPerimetre: z.string(),
    urgenceTooltip: z.string(),
  }),
});
