/* Qui lit le PDF d'une pièce (spec 2026-10-02, §5) : le client courant, pour
   une pièce de son workspace rattachée à un projet. Une pièce de revendeur
   n'a pas de client : elle ne s'ouvre que par la route admin. */
import type { Piece } from "./piece";

export function pieceLisibleParClient(
  piece: Piece | null,
  clientCourant: string | null,
  portee: readonly string[],
): boolean {
  return Boolean(
    piece && clientCourant && piece.client === clientCourant && piece.projet && portee.includes(clientCourant),
  );
}
