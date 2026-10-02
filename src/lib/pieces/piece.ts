/* Une pièce comptable Tiime telle que la table `pieces` la porte (spec
   2026-10-02-devis-et-factures-page-projet-design.md §1). Types seuls : le
   script d'import les importe aussi, et Node retire les imports de type. */
export type TypePiece = "devis" | "facture" | "avoir";
export type CategoriePiece = "acompte" | "intermediaire" | "solde";
export type StatutPiece = "a_regler" | "reglee" | "annulee";

export interface Piece {
  /** Type et numéro : `facture-024624`. */
  id: string;
  type: TypePiece;
  /** Numéro Tiime en texte, zéros compris : `024624`. */
  numero: string;
  categorie: CategoriePiece | null;
  emise_le: string;
  echeance: string | null;
  /** Centimes. Négatifs pour un avoir. */
  ht: number;
  tva: number;
  ttc: number;
  statut: StatutPiece | null;
  reglee_le: string | null;
  /** Slug de fiche client. Vide pour une pièce adressée à un revendeur. */
  client: string | null;
  /** Slug de fiche revendeur. Vide pour une pièce adressée à un client. */
  organisation: string | null;
  /** Slug de la table PROJETS. Vide tant que la pièce n'est pas rattachée. */
  projet: string | null;
  raison_sociale: string;
  r2_key: string;
}
