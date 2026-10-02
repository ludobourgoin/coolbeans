/* Ce que le client lit d'une pièce (spec 2026-10-02, §4) : libellé, statut,
   montant, date. Le numéro s'affiche comme sur le PDF, sans zéros de tête. */
import type { Piece } from "./piece";

const NB = " ";

const SUFFIXE: Record<string, string> = {
  acompte: " d'acompte",
  intermediaire: " intermédiaire",
  solde: " de solde",
};

const numeroImprime = (numero: string) => numero.replace(/^0+(?=\d)/, "");

export function libellePiece(p: Pick<Piece, "type" | "categorie" | "numero">): string {
  const numero = numeroImprime(p.numero);
  if (p.type === "devis") return `Devis n°${NB}${numero}`;
  if (p.type === "avoir") return `Avoir n°${NB}${numero}`;
  return `Facture${SUFFIXE[p.categorie ?? ""] ?? ""} n°${NB}${numero}`;
}

export function dateFr(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
}

export function statutPiece(p: Pick<Piece, "type" | "statut" | "reglee_le" | "echeance">): string | null {
  if (p.type !== "facture" || !p.statut) return null;
  if (p.statut === "annulee") return "Annulée";
  if (p.statut === "reglee") return p.reglee_le ? `Réglée le ${dateFr(p.reglee_le)}` : "Réglée";
  return p.echeance ? `À régler, échéance le ${dateFr(p.echeance)}` : "À régler";
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const montantEuros = (centimes: number): string => EUROS.format(centimes / 100);

/** Le nom du fichier téléchargé : « Facture de solde 24624.pdf ». */
export const nomDuPdf = (p: Pick<Piece, "type" | "categorie" | "numero">): string =>
  `${libellePiece(p).replace(`n°${NB}`, "")}.pdf`;
