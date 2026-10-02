/* Le pronom d'un document et d'un compte (spec 2026-10-02, le pronom vient de
 * la fiche client).
 *
 * La fiche client et l'organisation portent `tutoiement`. Un document le
 * surcharge s'il le porte ; une version hérite de sa racine. Sinon : une
 * proposition dans un workspace de revendeur suit l'organisation (elle lui est
 * adressée, comme le dit acces.ts), tout autre document suit la fiche du client.
 *
 * Fonctions pures, comme acces.ts : les gabarits et les routes les appellent
 * avec les collections chargées, les tests sans astro:content.
 */
import type { PortalRole } from "../portail/metadata";
import { ORGANISATION_COOLBEANS } from "./acces";
import type { CollectionDocument } from "./etapes";
import { HORS_NOMENCLATURE, clientDuProjet } from "./nomenclature";
import { cle } from "./projet";

export type Pronom = "tu" | "vous";

/** Ce que la résolution lit d'un document. */
export interface DocumentPronom {
  collection: CollectionDocument;
  id: string;
  projet?: string;
  versionDe?: string;
  tutoiement?: boolean;
}

/** Une fiche client, réduite à ce que la résolution lit. */
export interface FichePronom {
  slug: string;
  cle?: string;
  organisation: string;
  tutoiement?: boolean;
}

/** Une organisation : un revendeur, ou `coolbeans`. */
export interface OrganisationPronom {
  slug: string;
  tutoiement?: boolean;
}

export interface Registres {
  documents: readonly DocumentPronom[];
  fiches: readonly FichePronom[];
  organisations: readonly OrganisationPronom[];
}

/** Le compte connecté, ou le destinataire d'un mail. */
export interface ComptePronom {
  role: PortalRole;
  organisation: string | null;
  workspace: string | null;
}

const pronom = (tutoiement: boolean | undefined): Pronom | undefined =>
  tutoiement === undefined ? undefined : tutoiement ? "tu" : "vous";

/** Slug de la fiche qui porte le pronom de Ludo, celui des comptes admin. */
const FICHE_COOLBEANS = "coolbeans";

export function pronomDuDocument(doc: DocumentPronom, registres: Registres): Pronom | undefined {
  const racine = doc.versionDe
    ? registres.documents.find((d) => d.collection === doc.collection && d.id === doc.versionDe)
    : undefined;

  const surcharge = pronom(doc.tutoiement ?? racine?.tutoiement);
  if (surcharge) return surcharge;

  const projet = racine?.projet ?? doc.projet;
  const cleClient = projet ? clientDuProjet(projet) : undefined;
  const fiche = cleClient ? registres.fiches.find((f) => f.cle === cleClient) : undefined;
  if (!fiche) return undefined;

  if (doc.collection === "devis" && fiche.organisation !== ORGANISATION_COOLBEANS) {
    return pronom(registres.organisations.find((o) => o.slug === fiche.organisation)?.tutoiement);
  }
  return pronom(fiche.tutoiement);
}

export function pronomDuCompte(
  compte: ComptePronom,
  registres: Pick<Registres, "fiches" | "organisations">,
): Pronom | undefined {
  if (compte.role === "admin") {
    return pronom(registres.fiches.find((f) => f.slug === FICHE_COOLBEANS)?.tutoiement);
  }
  if (compte.role === "revendeur") {
    return pronom(registres.organisations.find((o) => o.slug === compte.organisation)?.tutoiement);
  }
  return pronom(registres.fiches.find((f) => f.slug === compte.workspace)?.tutoiement);
}

/** Les documents qui ne résolvent aucun pronom. Une liste vide veut dire cohérent. */
export function verifierPronoms(registres: Registres, horsNomenclature: readonly string[] = HORS_NOMENCLATURE): string[] {
  return registres.documents
    .filter((d) => !pronomDuDocument(d, registres))
    .map((d) =>
      horsNomenclature.includes(cle(d))
        ? `${cle(d)} : hors nomenclature, il doit porter sa propre clé tutoiement`
        : `${cle(d)} : aucun pronom ne se résout (clé tutoiement absente de sa fiche client ou de son organisation)`,
    );
}

/** Le seul repli autorisé : un compte ou un destinataire qui ne résout rien reçoit le vous. */
export function ouVous(p: Pronom | undefined, quoi: string): Pronom {
  if (p) return p;
  console.warn(`pronom non résolu (${quoi}) : repli sur le vous`);
  return "vous";
}
