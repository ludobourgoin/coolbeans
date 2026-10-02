/* La frise des étapes d'un document (spec 2026-09-22 §2).
 *
 * Toujours les cinq étapes du cycle, plus l'audit en tête si le projet en a
 * un. Seule l'étape du document courant est colorée : le numéro dit la
 * séquence, inutile de distinguer le passé de l'avenir. Une étape sans
 * document, ou dont le document n'est pas servi, est estompée.
 *
 * `dev` est un paramètre et non une lecture de `import.meta.env.DEV`, comme
 * dans statut.ts : c'est ce qui rend les deux branches testables.
 */
import { DEFINITIONS, type DefinitionEtape } from "./etapes";
import type { DocumentProjet } from "./projet";

export interface Pastille extends DefinitionEtape {
  courante: boolean;
  /** Absent : pas de document à cette étape, ou document non servi. */
  href?: string;
}

/** L'adresse d'un document, jusqu'au lot 4 qui la déplace sous /<client>/<projet>/<étape>. */
export const urlDocument = (d: Pick<DocumentProjet, "collection" | "id">) => `/${d.collection}/${d.id}`;

/**
 * La frise, avec la règle de lecture et la fabrique d'adresse du contexte.
 * Public : `frise` ci-dessous.
 */
export function friseAvec(
  documents: DocumentProjet[],
  courant: Pick<DocumentProjet, "collection" | "id">,
  lisible: (d: DocumentProjet) => boolean,
  url: (d: DocumentProjet) => string,
): Pastille[] {
  const racine = documents.find(
    (d) => !d.versionDe && d.collection === courant.collection && d.id === courant.id,
  );
  if (!racine?.projet) return [];

  const duProjet = documents.filter((d) => !d.versionDe && d.projet === racine.projet);
  const aUnAudit = duProjet.some((d) => d.etape === "audit");

  return DEFINITIONS.filter((def) => def.etape !== "audit" || aUnAudit).map((def) => {
    const doc = duProjet.find((d) => d.etape === def.etape);
    const servi = doc !== undefined && lisible(doc);
    return { ...def, courante: def.etape === racine.etape, href: servi ? url(doc) : undefined };
  });
}

/** La frise des pages publiques : un document non publié n'est servi qu'en développement. */
export function frise(
  documents: DocumentProjet[],
  courant: Pick<DocumentProjet, "collection" | "id">,
  dev: boolean,
): Pastille[] {
  return friseAvec(documents, courant, (d) => dev || d.statut === "publie", urlDocument);
}
