/* Types métier du chiffrage. Zéro dépendance Astro/DOM : partagés entre
   le cockpit, les Actions serveur, la skill `proposition-commerciale` (via
   script) et les tests.

   `devisTexts` garde son nom : c'est une clé persistée en KV, avec une
   migration depuis le format legacy dans store.ts. La renommer demande une
   migration KV, pas un rechercher-remplacer — cf. le lot B de la spec
   2026-09-02-proposition-commerciale-design.md. */

export type Affinite = "neutre" | "envie" | "pasenvie";

export interface Reglages {
  tjm: number;
  heuresJour: number; // 7 : heures effectives d'un jour facturé
  marcheBas: number;
  marcheHaut: number;
  joursSemaine: number;
  semainesMarge: number;
  chargesPct: number;
  gestionPct: number; // +15 % sur la totalité du projet (jamais hebdo)
  urgencePct: number; // +20 %, affiché sur la proposition en valeur absolue
  affinite: { baisse: number; hausse: number };
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
  segment: string; // informatif (tpe, pme, association…) — plus de registre de segments depuis 2026-08-18
  affinite: Affinite;
  gestionProjet: boolean;
  urgence: boolean;
  margePct: 0 | 10 | 20 | 30;
  reduction: Reduction | null;
  prixRetenu: number | null; // arrondi commercial final décidé par Ludo
}
