/* Qui lit quel document dans le portail (spec 2026-09-30, sous-projet 1).
 *
 * Trois questions, dans cet ordre :
 * 1. le workspace du document est-il dans la portée du compte ? Sinon rien ;
 * 2. le document est-il publié ? Sinon l'admin seul, sous un bandeau ;
 * 3. est-ce la proposition d'un workspace de revendeur ? Elle est adressée au
 *    revendeur et porte le prix de Coolbeans au revendeur : les comptes du
 *    client final ne la lisent pas.
 *
 * Fonctions pures, comme workspacesVisibles : la route les appelle, les tests
 * les exercent sans session ni base.
 */
import type { PortalRole } from "../portail/metadata";
import type { DocumentProjet } from "./projet";

/** Le compte connecté, réduit à ce que la règle lit. */
export interface CompteLecteur {
  role: PortalRole;
  /** Slugs des workspaces de sa portée (workspacesVisibles). */
  portee: readonly string[];
}

/** Le workspace du document, réduit à ce que la règle lit. */
export interface WorkspaceLu {
  slug: string;
  organisation: string;
}

/** Un workspace de cette organisation est un client direct de Coolbeans. */
export const ORGANISATION_COOLBEANS = "coolbeans";

export type Bandeau = "brouillon" | "revendeur";
export type Lecture = { lisible: false } | { lisible: true; bandeau: Bandeau | null };

export function lecture(
  doc: Pick<DocumentProjet, "collection" | "statut">,
  compte: CompteLecteur,
  workspace: WorkspaceLu,
): Lecture {
  if (!compte.portee.includes(workspace.slug)) return { lisible: false };
  const admin = compte.role === "admin";
  if (doc.statut !== "publie") return admin ? { lisible: true, bandeau: "brouillon" } : { lisible: false };
  const auRevendeur = doc.collection === "devis" && workspace.organisation !== ORGANISATION_COOLBEANS;
  if (auRevendeur) {
    if (admin) return { lisible: true, bandeau: "revendeur" };
    return compte.role === "revendeur" ? { lisible: true, bandeau: null } : { lisible: false };
  }
  return { lisible: true, bandeau: null };
}

/** La racine visée par une adresse du portail. Une version n'a pas d'adresse. */
export function documentDuPortail(
  documents: DocumentProjet[],
  projet: string,
  etape: string,
): DocumentProjet | undefined {
  return documents.find((d) => !d.versionDe && d.projet === projet && d.etape === etape);
}

/** Le chemin d'un document sous /espace. Toujours passer le résultat à portalHref. */
export function cheminPortail(doc: Pick<DocumentProjet, "projet" | "etape">): string {
  if (!doc.projet) throw new Error("cheminPortail : document hors nomenclature");
  return `/projets/${doc.projet}/${doc.etape}`;
}

/**
 * Les onglets d'une page du portail : la racine et ses versions que le compte
 * lit, avec le bandeau de chacune. Une version illisible disparaît, sans
 * laisser d'onglet vide.
 */
export function versionsDuPortail(
  documents: DocumentProjet[],
  racine: DocumentProjet,
  lire: (d: DocumentProjet) => Lecture,
): { ids: string[]; bandeaux: Record<string, Bandeau> } {
  const groupe = [
    racine,
    ...documents.filter((d) => d.collection === racine.collection && d.versionDe === racine.id),
  ];
  const ids: string[] = [];
  const bandeaux: Record<string, Bandeau> = {};
  for (const d of groupe) {
    const l = lire(d);
    if (!l.lisible) continue;
    ids.push(d.id);
    if (l.bandeau) bandeaux[d.id] = l.bandeau;
  }
  return { ids, bandeaux };
}
