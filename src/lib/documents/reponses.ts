/* Réponses aux documents de cadrage, de livrable et de témoignage, persistées
   en D1 (table document_reponses, migration 0009) avant la notification mail.

   Le mail reste envoyé, mais il n'est plus la seule trace : la page publique
   relit cette table pour afficher les réponses à la place du formulaire
   (spec 2026-09-29-reponses-dans-les-documents-design.md). Les propositions
   ont leur propre table, `devis_reponses`, que le cockpit lit déjà. */

import { db, type D1Like } from "../devis/reponses";
import type { ReponseLisible } from "../cadrage";
import type { ReponseLivrable } from "../livrable";

export type TypeDocument = "cadrage" | "livrable" | "temoignage";

export interface NouvelleReponseDocument {
  type: TypeDocument;
  slug: string;
  /** Livrable seulement. Nul pour le cadrage et le témoignage. */
  decision?: ReponseLivrable | null;
  /** Instantané lisible : les libellés tels que le client les a lus. */
  reponses?: ReponseLisible[] | null;
  message?: string | null;
  prenom: string;
  nom: string;
  email: string;
  /** Témoignage : clé R2 de la photo déposée. */
  photoR2?: string | null;
}

export interface ReponseDocument {
  id: number;
  type: TypeDocument;
  slug: string;
  decision: ReponseLivrable | null;
  /** JSON brut de la colonne : `lireReponses` le relit, sans jamais planter. */
  reponses: string | null;
  message: string | null;
  prenom: string;
  nom: string;
  email: string;
  photoR2: string | null;
  origine: "formulaire" | "reprise";
  createdAt: string;
}

const SQL_INSERT =
  "INSERT INTO document_reponses " +
  "(type, slug, decision, reponses, message, prenom, nom, email, photo_r2) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

const COLONNES =
  "id, type, slug, decision, reponses, message, prenom, nom, email, " +
  "photo_r2 AS photoR2, origine, created_at AS createdAt";

/* Une réponse est définitive quand elle n'appelle pas de suite sur la même
   version : toute réponse de cadrage ou de témoignage (decision nulle), une
   validation de livrable. Des retours sur un livrable, eux, laissent le
   formulaire ouvert, pour valider une fois les corrections faites. La
   requête SQL_CLOS ci-dessous dit la même chose : les deux vont ensemble. */
export const estDefinitive = (decision: ReponseLivrable | null) =>
  decision === null || decision === "validation";

const SQL_CLOS =
  "SELECT id FROM document_reponses WHERE type = ? AND slug = ? " +
  "AND (decision IS NULL OR decision = 'validation') LIMIT 1";

export async function enregistrerReponseDocument(
  r: NouvelleReponseDocument,
  d1: D1Like = db(),
): Promise<void> {
  await d1
    .prepare(SQL_INSERT)
    .bind(
      r.type,
      r.slug,
      r.decision ?? null,
      r.reponses ? JSON.stringify(r.reponses) : null,
      r.message ?? null,
      r.prenom,
      r.nom,
      r.email,
      r.photoR2 ?? null,
    )
    .run();
}

/** Toutes les réponses reçues par les versions d'un document, dans l'ordre d'arrivée. */
export async function reponsesDuDocument(
  type: TypeDocument,
  slugs: string[],
  d1: D1Like = db(),
): Promise<ReponseDocument[]> {
  if (!slugs.length) return [];
  const marques = slugs.map(() => "?").join(", ");
  const { results } = await d1
    .prepare(
      `SELECT ${COLONNES} FROM document_reponses ` +
        `WHERE type = ? AND slug IN (${marques}) ORDER BY id`,
    )
    .bind(type, ...slugs)
    .all<ReponseDocument>();
  return results;
}

/** Vrai si ce slug a déjà reçu une réponse définitive : le formulaire est clos. */
export async function documentClos(
  type: TypeDocument,
  slug: string,
  d1: D1Like = db(),
): Promise<boolean> {
  const { results } = await d1.prepare(SQL_CLOS).bind(type, slug).all<{ id: number }>();
  return results.length > 0;
}

/** Relit l'instantané JSON. Une colonne vide ou illisible donne une liste vide. */
export function lireReponses(json: string | null): ReponseLisible[] {
  if (!json) return [];
  try {
    const brut: unknown = JSON.parse(json);
    if (!Array.isArray(brut)) return [];
    return brut
      .filter(
        (r): r is ReponseLisible =>
          !!r && typeof r.question === "string" && typeof r.reponse === "string",
      )
      .map((r) => ({ question: r.question, reponse: r.reponse, decisif: Boolean(r.decisif) }));
  } catch {
    return [];
  }
}
