/* Le total d'heures d'un pack, lu dans la proposition validée (décision de
 * Ludo du 2026-10-02) : chaque ligne de pack porte ses heures, et le client a
 * retenu une option. Aucune saisie en double, ni dans Linear ni ailleurs.
 */
import { lignesRetenues, normaliserSelection, type DevisBudget } from "../devis";

/** Les index d'options d'une réponse, ou `undefined` s'ils sont illisibles. */
function selection(optionsRetenues: string | null): number[] | undefined {
  if (!optionsRetenues) return undefined;
  try {
    const lu: unknown = JSON.parse(optionsRetenues);
    return Array.isArray(lu) && lu.every((i) => Number.isInteger(i)) ? (lu as number[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Les heures des lignes retenues : le socle, plus les options choisies (une
 * seule sur un choix unique). `null` quand aucune ligne retenue n'en porte.
 */
export function heuresRetenues(budget: DevisBudget, optionsRetenues: string | null): number | null {
  const retenues = lignesRetenues(budget, normaliserSelection(budget, selection(optionsRetenues)));
  const avecHeures = retenues.filter((l) => typeof l.heures === "number");
  return avecHeures.length ? avecHeures.reduce((somme, l) => somme + (l.heures ?? 0), 0) : null;
}
