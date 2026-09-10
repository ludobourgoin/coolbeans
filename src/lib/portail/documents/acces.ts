// La règle d'accès à un fichier, isolée du transport.
//
// Elle vit ici et pas dans la route parce que la route importe
// `cloudflare:workers`, module virtuel indisponible sous Vitest : y laisser la
// décision reviendrait à ne pas la tester. Or c'est LA règle qui fuit des
// documents si elle casse (spec §11).
//
// Même raison d'être que require-admin.ts, extraite des Actions pour la même
// contrainte.

import type { DocumentRow } from "./store";

export interface DemandeFichier {
  /** `null` si personne n'est connecté. */
  connecte: boolean;
  /** Slug du client courant, `null` si aucun n'est résolu. */
  clientCourant: string | null;
  admin: boolean;
  doc: DocumentRow | null;
}

/**
 * Vrai si le fichier peut être servi. Quatre refus, dans cet ordre, et chacun
 * a déjà sa raison d'exister :
 *
 *   - pas de session ;
 *   - document inconnu, ou qui n'est pas un fichier ;
 *   - document d'un autre client, même pour un admin : il regarde un workspace
 *     à la fois, et un identifiant deviné ne doit pas traverser cette frontière ;
 *   - document masqué demandé par un rôle non-admin. C'est le piège principal :
 *     la liste ne le montre pas, mais l'URL reste devinable.
 */
export function peutServirFichier(d: DemandeFichier): boolean {
  if (!d.connecte) return false;
  if (!d.doc || d.doc.source !== "fichier" || !d.doc.r2_key) return false;
  if (!d.clientCourant || d.doc.client !== d.clientCourant) return false;
  if (d.doc.visible !== 1 && !d.admin) return false;
  return true;
}

/**
 * Type de contenu et disposition d'un fichier servi.
 *
 * Le MIME vient de celui qui a déposé le fichier : le servir tel quel ouvre à
 * du XSS stocké (un `text/html` affiché inline sur l'origine qui porte le
 * cookie de session). Seule une allowlist courte s'affiche dans le navigateur,
 * tout le reste part en téléchargement forcé.
 */
export function serviceFichier(mime: string | null, titre: string) {
  const type = mime ?? "application/octet-stream";
  const sur = type.startsWith("image/") || type === "application/pdf";
  const nom = encodeURIComponent(titre);
  return {
    contentType: sur ? type : "application/octet-stream",
    disposition: `${sur ? "inline" : "attachment"}; filename*=UTF-8''${nom}`,
  };
}
