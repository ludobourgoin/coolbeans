// Types et logique pure du tableau du cockpit devis
// (spec 2026-09-01-cockpit-devis-tableau-crm-design.md).
//
// Le type de ligne et le comparateur de tri vivent ici plutôt que dans
// DevisBoard.astro : un .astro n'exporte pas de type exploitable à l'import,
// et un comparateur enfermé dans un <script> de composant ne se teste pas.

import type { EtatAffaire } from "../portail/linear-crm";
import type { ReponseDevis } from "./reponses";

export interface LigneDevis {
  slug: string;
  client: string;
  titre: string;
  objet: string;
  /** Montant formaté — « 3 520 € », « En construction », « — ». */
  montant: string;
  /** Même montant en nombre, pour le tri. */
  montantTri: number;
  date: Date;
  dateLisible: string;
  envoi: { date: Date; destinataire: string } | undefined;
  envoiLisible: string | undefined;
  /** État de l'affaire CRM, absent si non rattachée ou Linear injoignable. */
  affaire: EtatAffaire | undefined;
  reponse: ReponseDevis | undefined;
  reponseLisible: string | undefined;
  urlPublique: string;
  urlProjet: string | undefined;
  urlAffaire: string | undefined;
}

export type Sens = "asc" | "desc";

/**
 * Comparateur des cellules de tri, telles qu'écrites dans `data-sort`.
 *
 * Deux règles qui font tout l'intérêt de la fonction :
 *
 * - Une cellule vide (statut inconnu, devis jamais envoyé) reste en bas quel
 *   que soit le sens. La remonter en tête d'un tri ascendant reléguerait le
 *   contenu utile hors de l'écran.
 * - Deux valeurs numériques se comparent en nombres. C'est ce qui fait que la
 *   colonne Statut suit l'ordre du pipeline Linear (`state.position`) et non
 *   l'alphabet : trier « 🏆 Signée » avant « 📥 Triage lead » parce que S
 *   précède T ne dit rien du pipeline.
 */
export function comparerTri(a: string, b: string, sens: Sens): number {
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  const na = Number(a);
  const nb = Number(b);
  const ordre =
    Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b, "fr");
  return sens === "asc" ? ordre : -ordre;
}

/**
 * Nom lisible d'un client à partir du slug du devis.
 *
 * Le registre des workspaces le connaît rarement : un prospect n'a pas encore
 * de workspace, et la plupart des devis en visent un. D'où le repli sur le
 * segment du slug remis en forme.
 */
export function nomClient(slug: string, registre: Map<string, string>): string {
  const segment = slug.includes("/") ? slug.split("/")[0] : slug;
  return (
    registre.get(segment) ??
    segment.replace(/-/g, " ").replace(/\b\p{Letter}/gu, (c) => c.toUpperCase())
  );
}
