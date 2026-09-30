/* Les étapes d'un projet client, dans l'ordre de la frise (spec 2026-09-22 §2).
 *
 * L'étape est un champ, pas une déduction du gabarit (§3) : les documents de
 * domaine CAFA sont des cadrages servis en production. La collection ne donne
 * que la valeur par défaut.
 *
 * L'audit porte le numéro 0 et ne s'affiche que si le projet en a un
 * (arbitrage du 2026-09-29). Cadrage reste l'étape 1 partout.
 */

export const ETAPES = ["audit", "cadrage", "proposition", "production", "livraison", "suivi"] as const;
export type Etape = (typeof ETAPES)[number];

export type Teinte = "teal" | "amber" | "blue" | "gray" | "green" | "purple";

export interface DefinitionEtape {
  etape: Etape;
  numero: number;
  libelle: string;
  teinte: Teinte;
}

export const DEFINITIONS: readonly DefinitionEtape[] = [
  { etape: "audit", numero: 0, libelle: "Audit", teinte: "teal" },
  { etape: "cadrage", numero: 1, libelle: "Cadrage", teinte: "amber" },
  { etape: "proposition", numero: 2, libelle: "Proposition", teinte: "blue" },
  { etape: "production", numero: 3, libelle: "Production", teinte: "gray" },
  { etape: "livraison", numero: 4, libelle: "Livraison", teinte: "green" },
  { etape: "suivi", numero: 5, libelle: "Suivi", teinte: "purple" },
];

export type CollectionDocument = "cadrage" | "devis" | "livrable" | "temoignage";

/** L'étape d'un document qui ne la déclare pas. */
export const ETAPE_HABITUELLE: Record<CollectionDocument, Etape> = {
  cadrage: "cadrage",
  devis: "proposition",
  livrable: "livraison",
  temoignage: "suivi",
};

export function definitionEtape(etape: Etape): DefinitionEtape {
  const d = DEFINITIONS.find((x) => x.etape === etape);
  if (!d) throw new Error(`étape inconnue : ${etape}`);
  return d;
}
