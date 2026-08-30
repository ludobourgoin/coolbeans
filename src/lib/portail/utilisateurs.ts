// Gestion des comptes du portail (spec 2026-08-19 §5.3, plan Task 9).
//
// Ce que la disparition du dashboard Clerk oblige à écrire : ouvrir un accès,
// en changer le type, le révoquer. Trois gestes, réservés à un admin.
//
// POURQUOI DU SQL ET PAS LE FLUX D'INVITATION DU PLUGIN
// Le flux `invite-member` de Better Auth suppose que l'invité puisse
// s'inscrire pour accepter son invitation. Or l'inscription publique est
// verrouillée (`disableSignUp: true`, spec §2) : l'invitation ne mènerait
// nulle part. On crée donc le compte, puis on lui envoie un lien magique —
// qui, lui, fonctionne sur un compte existant.
//
// Un compte ouvert ici n'a PAS de mot de passe : pas de ligne `account`. Sa
// seule porte d'entrée est le lien magique, jusqu'à ce qu'il s'en pose un.

/** Un compte tel que la page Utilisateurs l'affiche. */
export interface UtilisateurPortail {
  id: string;
  email: string;
  nom: string;
  /** admin | revendeur | client. */
  portalRole: string;
  /** Slug de l'organisation, `null` si le compte n'appartient à aucune. */
  organisation: string | null;
  /** Slug de la team, `null` pour un revendeur ou un admin. */
  workspace: string | null;
}

/**
 * Clé d'appartenance à une team, telle que Better Auth la calcule.
 *
 * `base64url(SHA-256(JSON.stringify([teamId, userId])))`, sans padding —
 * copié sur `computeTeamMembershipKey` du plugin organization. La colonne est
 * unique et NOT NULL : une valeur inventée passerait l'insertion et casserait
 * le jour où le plugin, lui, chercherait par cette clé.
 */
export async function cleAppartenance(teamId: string, userId: string): Promise<string> {
  const octets = new TextEncoder().encode(JSON.stringify([teamId, userId]));
  const empreinte = await crypto.subtle.digest("SHA-256", octets);
  return btoa(String.fromCharCode(...new Uint8Array(empreinte)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Identifiant du style de ceux que Better Auth génère (32 caractères). */
export function identifiant(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const octets = crypto.getRandomValues(new Uint8Array(32));
  return [...octets].map((o) => alphabet[o % alphabet.length]).join("");
}

/**
 * Tous les comptes, avec leur portée.
 *
 * Une seule requête : la page en affiche la totalité, il n'y en aura jamais
 * assez pour paginer.
 */
export async function listerUtilisateurs(db: D1Database): Promise<UtilisateurPortail[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.name AS nom, u.portalRole,
              o.slug AS organisation, t.slug AS workspace
         FROM user u
         LEFT JOIN member m ON m.userId = u.id
         LEFT JOIN organization o ON o.id = m.organizationId
         LEFT JOIN teamMember tm ON tm.userId = u.id
         LEFT JOIN team t ON t.id = tm.teamId
        ORDER BY u.portalRole, u.email`,
    )
    .all<UtilisateurPortail>();
  return results ?? [];
}

export interface NouvelUtilisateur {
  email: string;
  nom: string;
  portalRole: "admin" | "revendeur" | "client";
  /** Slug de l'organisation. Obligatoire sauf pour un admin, qui voit tout. */
  organisation?: string;
  /** Slug du workspace. Obligatoire pour un `client`. */
  workspace?: string;
}

/**
 * Ouvre un compte et ses appartenances.
 *
 * Rien n'est envoyé : l'envoi du lien magique est un geste séparé, décidé
 * dans la page. Un compte peut donc exister sans que personne ne le sache,
 * ce qui est exactement ce qu'on veut pendant une phase de test.
 */
export async function creerUtilisateur(
  db: D1Database,
  nouveau: NouvelUtilisateur,
): Promise<{ id: string }> {
  const existant = await db
    .prepare("SELECT id FROM user WHERE email = ?1")
    .bind(nouveau.email)
    .first<{ id: string }>();
  if (existant) throw new Error(`Un compte existe déjà pour ${nouveau.email}.`);

  const maintenant = new Date().toISOString();
  const userId = identifiant();
  const instructions: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt, portalRole)
         VALUES (?1, ?2, ?3, 1, NULL, ?4, ?4, ?5)`,
      )
      .bind(userId, nouveau.nom, nouveau.email, maintenant, nouveau.portalRole),
  ];

  if (nouveau.organisation) {
    const org = await db
      .prepare("SELECT id FROM organization WHERE slug = ?1")
      .bind(nouveau.organisation)
      .first<{ id: string }>();
    if (!org) throw new Error(`Organisation inconnue : ${nouveau.organisation}.`);
    instructions.push(
      db
        .prepare(
          `INSERT INTO member (id, organizationId, userId, role, createdAt)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(
          identifiant(),
          org.id,
          userId,
          nouveau.portalRole === "revendeur" ? "owner" : "member",
          maintenant,
        ),
    );

    if (nouveau.workspace) {
      const team = await db
        .prepare("SELECT id, organizationId FROM team WHERE slug = ?1")
        .bind(nouveau.workspace)
        .first<{ id: string; organizationId: string }>();
      if (!team) throw new Error(`Workspace inconnu : ${nouveau.workspace}.`);
      // Le garde-fou de la spec §3.1 : une appartenance incohérente ouvrirait
      // une team au hasard. Mieux vaut refuser que poser un accès de travers.
      if (team.organizationId !== org.id) {
        throw new Error(
          `Le workspace ${nouveau.workspace} ne relève pas de l'organisation ${nouveau.organisation}.`,
        );
      }
      instructions.push(
        db
          .prepare(
            `INSERT INTO teamMember (id, teamId, userId, membershipKey, createdAt)
             VALUES (?1, ?2, ?3, ?4, ?5)`,
          )
          .bind(identifiant(), team.id, userId, await cleAppartenance(team.id, userId), maintenant),
      );
    }
  }

  await db.batch(instructions);
  return { id: userId };
}

/** Change le type d'un compte. La portée, elle, ne bouge pas. */
export async function changerType(
  db: D1Database,
  userId: string,
  portalRole: "admin" | "revendeur" | "client",
): Promise<void> {
  await db
    .prepare("UPDATE user SET portalRole = ?2, updatedAt = ?3 WHERE id = ?1")
    .bind(userId, portalRole, new Date().toISOString())
    .run();
}

/**
 * Révoque un accès : le compte et tout ce qui s'y rattache.
 *
 * Les cinq suppressions sont explicites plutôt que laissées aux `ON DELETE
 * CASCADE` du schéma : D1 n'applique les clés étrangères que si
 * `PRAGMA foreign_keys` est actif, et un compte révoqué dont la session
 * survivrait continuerait d'ouvrir des pages. La session part en premier,
 * pour la même raison.
 */
export async function revoquer(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM session WHERE userId = ?1").bind(userId),
    db.prepare("DELETE FROM teamMember WHERE userId = ?1").bind(userId),
    db.prepare("DELETE FROM member WHERE userId = ?1").bind(userId),
    db.prepare("DELETE FROM account WHERE userId = ?1").bind(userId),
    db.prepare("DELETE FROM user WHERE id = ?1").bind(userId),
  ]);
}
