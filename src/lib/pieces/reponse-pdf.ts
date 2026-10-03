/* Le PDF d'une pièce, servi tel quel : type forcé, jamais deviné par le
   navigateur, jamais en cache partagé. */
import { nomDuPdf } from "./affichage";
import type { Piece } from "./piece";

export function reponsePdf(objet: { body: ReadableStream }, piece: Piece): Response {
  return new Response(objet.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(nomDuPdf(piece))}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
