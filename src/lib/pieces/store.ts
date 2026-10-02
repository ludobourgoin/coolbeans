/* Lectures et écritures de la table `pieces` (migration 0014). Le type D1Like
   permet de rejouer ces requêtes contre SQLite dans les tests. */
import type { D1Like } from "../devis/reponses";
import type { Piece } from "./piece";

const COLONNES =
  "id, type, numero, categorie, emise_le, echeance, ht, tva, ttc, statut, reglee_le, client, organisation, projet, raison_sociale, r2_key";

/** Les pièces d'un projet client, de la plus ancienne à la plus récente.
    Une pièce de revendeur n'a pas de client : elle n'en sort jamais. */
export async function piecesDuProjet(d1: D1Like, client: string, projet: string): Promise<Piece[]> {
  const { results } = await d1
    .prepare(`SELECT ${COLONNES} FROM pieces WHERE client = ? AND projet = ? ORDER BY emise_le, id`)
    .bind(client, projet)
    .all<Piece>();
  return results;
}

export async function pieceParId(d1: D1Like, id: string): Promise<Piece | null> {
  const { results } = await d1.prepare(`SELECT ${COLONNES} FROM pieces WHERE id = ?`).bind(id).all<Piece>();
  return results[0] ?? null;
}

export async function toutesLesPieces(d1: D1Like): Promise<Piece[]> {
  const { results } = await d1.prepare(`SELECT ${COLONNES} FROM pieces ORDER BY emise_le DESC, id DESC`).all<Piece>();
  return results;
}

export async function rattacher(d1: D1Like, id: string, projet: string | null): Promise<void> {
  await d1.prepare("UPDATE pieces SET projet = ? WHERE id = ?").bind(projet, id).run();
}

/** Seule une facture se règle. */
export async function marquerReglee(d1: D1Like, id: string, date: string): Promise<void> {
  await d1
    .prepare("UPDATE pieces SET statut = 'reglee', reglee_le = ? WHERE id = ? AND type = 'facture'")
    .bind(date, id)
    .run();
}

export async function annulerReglement(d1: D1Like, id: string): Promise<void> {
  await d1
    .prepare("UPDATE pieces SET statut = 'a_regler', reglee_le = NULL WHERE id = ? AND statut = 'reglee'")
    .bind(id)
    .run();
}
