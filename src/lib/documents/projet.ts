/* Ce que la frise et la vérification lisent d'un document, toutes
 * collections confondues, et la vérification de cohérence qui arrête le
 * build (spec 2026-09-22 §4 : « vérifiable au build »).
 *
 * Une racine porte le projet et l'étape. Une version (`versionDe`) en hérite :
 * son propre `etape`, posé par défaut par le schéma, ne compte pas.
 */
import type { CollectionDocument, Etape } from "./etapes";
import { HORS_NOMENCLATURE, clientDuProjet } from "./nomenclature";
import type { StatutDocument } from "./statut";

export interface DocumentProjet {
  collection: CollectionDocument;
  id: string;
  statut: StatutDocument;
  etape: Etape;
  projet?: string;
  /** `linear.projet`, le titre affiché en h1. */
  titreProjet?: string;
  versionDe?: string;
  /** Surcharge du pronom (src/lib/documents/pronom.ts). */
  tutoiement?: boolean;
  /** Date du document, pour ordonner les projets dans la barre latérale du portail. */
  date?: Date;
}

export const cle = (d: Pick<DocumentProjet, "collection" | "id">) => `${d.collection}/${d.id}`;

/** Les incohérences de la nomenclature. Une liste vide veut dire cohérent. */
export function verifierNomenclature(
  documents: DocumentProjet[],
  horsNomenclature: readonly string[] = HORS_NOMENCLATURE,
): string[] {
  const erreurs: string[] = [];
  const racines = documents.filter((d) => !d.versionDe);

  for (const v of documents.filter((d) => d.versionDe)) {
    const racine = racines.find((r) => r.collection === v.collection && r.id === v.versionDe);
    if (!racine) erreurs.push(`${cle(v)} : versionDe « ${v.versionDe} » ne désigne aucune racine de ${v.collection}`);
  }

  const parProjet = new Map<string, DocumentProjet[]>();
  for (const r of racines) {
    if (!r.projet) {
      if (!horsNomenclature.includes(cle(r))) erreurs.push(`${cle(r)} : aucun projet, et absent de HORS_NOMENCLATURE`);
      continue;
    }
    if (!clientDuProjet(r.projet)) erreurs.push(`${cle(r)} : projet « ${r.projet} » absent de la table de nomenclature`);
    if (!r.titreProjet) erreurs.push(`${cle(r)} : linear.projet manquant`);
    parProjet.set(r.projet, [...(parProjet.get(r.projet) ?? []), r]);
  }

  for (const [projet, docs] of parProjet) {
    const parEtape = new Map<Etape, string[]>();
    for (const d of docs) parEtape.set(d.etape, [...(parEtape.get(d.etape) ?? []), cle(d)]);
    for (const [etape, cles] of parEtape) {
      if (cles.length > 1) erreurs.push(`projet ${projet} : ${cles.length} documents à l'étape ${etape} (${cles.join(", ")})`);
    }
    const titres = [...new Set(docs.map((d) => d.titreProjet).filter((t): t is string => !!t))];
    if (titres.length > 1) {
      erreurs.push(`projet ${projet} : linear.projet diverge (${titres.map((t) => `« ${t} »`).join(", ")})`);
    }
  }

  return erreurs;
}
