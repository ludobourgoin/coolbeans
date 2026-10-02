/* Le pronom du portail : celui de la personne connectée, ou du destinataire
   d'un mail. La règle vit dans documents/pronom.ts ; ce module charge les
   fiches et lit le compte. Non testé sous Vitest (astro:content, D1). */
import { ouVous, pronomDuCompte, type ComptePronom, type Pronom } from "../documents/pronom";
import type { PortalMetadata, PortalRole } from "./metadata";

async function registres() {
  const { getCollection } = await import("astro:content");
  const [fiches, organisations] = await Promise.all([getCollection("clients"), getCollection("organisations")]);
  return {
    fiches: fiches.map((e) => ({
      slug: e.id,
      cle: e.data.cle,
      organisation: e.data.organisation,
      tutoiement: e.data.tutoiement,
    })),
    organisations: organisations.map((e) => ({ slug: e.id, tutoiement: e.data.tutoiement })),
  };
}

/** Le pronom de la personne connectée. Ne lève jamais : une panne donne le vous. */
export async function pronomDuPortail(meta: PortalMetadata): Promise<Pronom> {
  try {
    return ouVous(pronomDuCompte(meta, await registres()), `compte ${meta.role}`);
  } catch (err) {
    console.error("pronom: fiches illisibles", err);
    return ouVous(undefined, "compte : erreur");
  }
}

/**
 * Le pronom du destinataire d'un mail, d'après son compte. Même jointure que
 * listerUtilisateurs (utilisateurs.ts). L'adresse se compare en minuscules :
 * Better Auth la stocke telle que saisie à l'invitation.
 *
 * Ne lève jamais : la messagerie l'appelle après avoir écrit le message en
 * base, et un échec à ce moment-là le laisserait sans mail pour toujours.
 */
export async function pronomDuDestinataire(db: D1Database, email: string): Promise<Pronom> {
  try {
    return await resoudreDestinataire(db, email);
  } catch (err) {
    console.error("pronom: résolution du destinataire impossible", err);
    return ouVous(undefined, "destinataire : erreur");
  }
}

async function resoudreDestinataire(db: D1Database, email: string): Promise<Pronom> {
  const ligne = await db
    .prepare(
      `SELECT u.portalRole AS role, o.slug AS organisation, t.slug AS workspace
         FROM user u
         LEFT JOIN member m ON m.userId = u.id
         LEFT JOIN organization o ON o.id = m.organizationId
         LEFT JOIN teamMember tm ON tm.userId = u.id
         LEFT JOIN team t ON t.id = tm.teamId
        WHERE lower(u.email) = lower(?1)
        LIMIT 1`,
    )
    .bind(email)
    .first<{ role: string; organisation: string | null; workspace: string | null }>();
  if (!ligne) return ouVous(undefined, "destinataire sans compte");
  const compte: ComptePronom = {
    role: (["admin", "revendeur", "client"].includes(ligne.role) ? ligne.role : "client") as PortalRole,
    organisation: ligne.organisation,
    workspace: ligne.workspace,
  };
  return ouVous(pronomDuCompte(compte, await registres()), `destinataire ${compte.role}`);
}
