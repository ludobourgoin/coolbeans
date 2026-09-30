/* L'adresse d'un document pour tout ce que le site émet : mails de
 * confirmation, cockpit, commentaire Linear d'une signature, pied du PDF.
 * Une seule fonction, pour que le sous-projet 6 (spec 2026-09-30) la bascule
 * vers le portail d'un geste. D'ici là, l'adresse publique.
 */
import type { CollectionDocument } from "./etapes";

export const ORIGINE_PUBLIQUE = "https://coolbeans.cc";

export function adresseDocument(collection: CollectionDocument, id: string): string {
  return `${ORIGINE_PUBLIQUE}/${collection}/${id}`;
}
