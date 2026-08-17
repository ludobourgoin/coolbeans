/* Types métier du chiffrage. Zéro dépendance Astro/DOM : partagés entre
   le cockpit, les Actions serveur, la skill devis (via script) et les tests. */

export type Affinite = "neutre" | "envie" | "pasenvie";

export interface Segment {
  label: string;
  desc: string;
  gestionProjet: boolean;
  note: string;
}

export interface Reglages {
  tjm: number;
  heuresJour: number; // 7 : heures effectives d'un jour facturé
  marcheBas: number;
  marcheHaut: number;
  joursSemaine: number;
  semainesMarge: number;
  chargesPct: number;
  gestionPct: number; // +15 % sur la totalité du projet (jamais hebdo)
  urgencePct: number; // +20 %, affiché au devis en valeur absolue
  affinite: { baisse: number; hausse: number };
  segments: Record<string, Segment>;
  devisTexts: {
    stackTechnique: string;
    conditionsReglement: string;
    ceQueCaComprend: string; // une ligne par item
    horsPerimetre: string; // une ligne par item
    urgenceTooltip: string;
  };
}

export interface Reduction {
  nom: string; // « Remise exceptionnelle », « Tarif association »…
  montant?: number; // € — prioritaire sur pct si les deux sont donnés
  pct?: number;
}

export interface ModificateursProjet {
  segment: string; // clé dans reglages.segments
  affinite: Affinite;
  gestionProjet: boolean;
  urgence: boolean;
  margePct: 0 | 10 | 20 | 30;
  reduction: Reduction | null;
  prixRetenu: number | null; // arrondi commercial final décidé par Ludo
}
