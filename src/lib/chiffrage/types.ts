/* Types métier du pilotage tarifaire. Zéro dépendance Astro/DOM :
   partagés entre l'éditeur Preact, les Actions serveur et les tests. */

export type Niveau = "simple" | "standard" | "complexe";
export type Pack = "pack1" | "pack2" | "pack3" | "pack4";
export type Affinite = "neutre" | "envie" | "pasenvie";

export interface Settings {
  tjm: number;
  demi: number;
  marcheBas: number;
  marcheHaut: number;
  joursSemaine: number;
  semainesMarge: number;
  chargesPct: number;
}

export interface Catalog {
  design: { simple: number; standard: number; complexe: number; portee: { ux: number; ui: number } };
  integration: Record<Niveau, number>;
  dev: Record<Pack, number>;
  setup: Record<"cms" | "multilingue" | "hebergement" | "domaine", { jours: number; clientLabel: string }>;
  gestion: {
    coefHebdo: number;
    forfaitCMS: number;
    forfaitMultilingue: number;
    forfaitHebergement: number;
    forfaitDomaine: number;
    urgencePct: number;
  };
  affinite: { baisse: number; hausse: number };
  devisTexts: {
    stackTechnique: string;
    conditionsReglement: string;
    ceQueCaComprend: string; // une ligne par item
    horsPerimetre: string; // une ligne par item
  };
}

export interface Segment {
  label: string;
  desc: string;
  gestionProjet: boolean;
  note: string;
}

export interface Catalogue {
  settings: Settings;
  catalog: Catalog;
  segments: Record<string, Segment>;
}

export interface PageLigne { label: string; niveau: Niveau; ux: boolean; ui: boolean; integ: boolean }
export interface DevLigne { label: string; level: Pack }
export interface AutreLigne { label: string; jours: number }
export interface Poste { label: string; jours: number }

export interface Chiffrage {
  id: string | null; // null tant que jamais sauvegardé
  date: string; // YYYY-MM-DD
  nom: string;
  clientSlug: string;
  projetSlug: string;
  mode: "configurateur" | "libre";
  segment: string; // clé dans catalogue.segments
  objectif: string;
  pages: PageLigne[];
  devLines: DevLigne[];
  autres: AutreLigne[];
  setupCms: boolean;
  setupMultilingue: boolean;
  setupHebergement: boolean;
  setupDomaine: boolean;
  affinite: Affinite;
  gestionProjet: boolean;
  urgence: boolean;
  margePct: 0 | 10 | 20 | 30;
  reductionNom: string;
  reductionMontant: number;
  prixRetenu: number | null;
  /* mode libre uniquement */
  postes: Poste[];
  strategique: boolean;
  raison: string;
  /* publication */
  publishedKey: string | null;
  publishedVersions: number;
}
