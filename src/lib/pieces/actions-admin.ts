/* Les trois gestes de la page admin des pièces (spec 2026-10-02, §3), lus et
   validés avant d'atteindre la base. */
import { PROJETS, type EntreeProjet } from "../documents/nomenclature";
import type { Piece } from "./piece";

export type ActionPiece =
  | { action: "rattacher"; id: string; projet: string | null }
  | { action: "regler"; id: string; date: string }
  | { action: "annuler-reglement"; id: string };

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function lireAction(corps: unknown, projetsConnus: readonly string[]): ActionPiece | { erreur: string } {
  if (!corps || typeof corps !== "object") return { erreur: "Corps de requête illisible." };
  const c = corps as Record<string, unknown>;
  const id = texte(c.id);
  const action = texte(c.action);
  if (!["rattacher", "regler", "annuler-reglement"].includes(action)) return { erreur: "Action inconnue." };
  if (!id) return { erreur: "Identifiant de pièce manquant." };
  if (action === "rattacher") {
    const projet = texte(c.projet) || null;
    if (projet && !projetsConnus.includes(projet)) return { erreur: `Projet inconnu : ${projet}.` };
    return { action, id, projet };
  }
  if (action === "regler") {
    const date = texte(c.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Date attendue au format AAAA-MM-JJ." };
    return { action, id, date };
  }
  return { action: "annuler-reglement", id };
}

/** Les projets proposés au rattachement d'une pièce (spec 2026-10-02, §3) :
    ceux de son client dans la table PROJETS, trouvés par la clé de sa fiche.
    Une pièce de revendeur n'entre dans aucune page projet : tous les projets
    lui restent ouverts, pour le classement de l'admin. */
export function projetsProposes(
  piece: Pick<Piece, "client" | "organisation">,
  clesDesFiches: Readonly<Record<string, string | undefined>>,
  projets: Readonly<Record<string, EntreeProjet>> = PROJETS,
): string[] {
  const tous = Object.keys(projets);
  if (!piece.client) return tous;
  const cle = clesDesFiches[piece.client];
  return cle ? tous.filter((p) => projets[p].client === cle) : [];
}
