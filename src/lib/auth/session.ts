// Lecture de la session Better Auth, memoisee pour la duree d'une requete.
//
// Remplace `locals.currentUser()` de @clerk/astro, qui refaisait un appel
// reseau bloquant a chaque invocation. La session vient maintenant de D1, mais
// la memoisation reste : le layout et la page la demandent tous les deux.
//
// CE FICHIER EST LE SEUL A CONNAITRE LES IDENTIFIANTS BETTER AUTH.
// La table `session` porte `activeOrganizationId` et `activeTeamId` : des
// identifiants generes, pas les slugs du registre. Tout le reste du portail
// raisonne en slugs. La traduction se fait ici, et nulle part ailleurs — sans
// quoi chaque appelant devrait savoir laquelle des deux formes il tient.

import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { createAuth } from "./server";
import { readPortalMetadata, type PortalMetadata } from "../portail/metadata";

export interface SessionPortail {
  /** `null` si personne n'est connecte. */
  user: { id: string; email: string; name: string | null } | null;
  meta: PortalMetadata;
}

const CACHE_KEY = "__portalSession";

/**
 * Slugs de l'organisation et de la team courantes.
 *
 * Le repli sur « la seule dont il est membre » n'est pas un confort : sans
 * lui, un client dont la session n'a pas encore d'organisation active verrait
 * un portail vide sans qu'aucune erreur ne s'affiche. Quand il y en a
 * plusieurs, on ne devine pas — c'est au selecteur de trancher.
 */
async function resoudreSlugs(
  userId: string,
  organizationId: string | null,
  teamId: string | null,
): Promise<{ organisation: string | null; workspace: string | null }> {
  const row = await env.PORTAL_DB.prepare(
    `SELECT
       (SELECT slug FROM organization WHERE id = ?2) AS orgActive,
       (SELECT slug FROM team WHERE id = ?3) AS teamActive,
       (SELECT o.slug FROM member m JOIN organization o ON o.id = m.organizationId
          WHERE m.userId = ?1) AS orgUnique,
       (SELECT COUNT(*) FROM member WHERE userId = ?1) AS nbOrgs,
       (SELECT t.slug FROM teamMember tm JOIN team t ON t.id = tm.teamId
          WHERE tm.userId = ?1) AS teamUnique,
       (SELECT COUNT(*) FROM teamMember WHERE userId = ?1) AS nbTeams`,
  )
    .bind(userId, organizationId, teamId)
    .first<{
      orgActive: string | null;
      teamActive: string | null;
      orgUnique: string | null;
      nbOrgs: number;
      teamUnique: string | null;
      nbTeams: number;
    }>();

  if (!row) return { organisation: null, workspace: null };
  return {
    organisation: row.orgActive ?? (row.nbOrgs === 1 ? row.orgUnique : null),
    workspace: row.teamActive ?? (row.nbTeams === 1 ? row.teamUnique : null),
  };
}

export function lireSession(
  context: Pick<APIContext, "locals" | "request">,
): Promise<SessionPortail> {
  const cache = context.locals as Record<string, unknown>;
  cache[CACHE_KEY] ??= (async (): Promise<SessionPortail> => {
    const auth = createAuth(env, new URL(context.request.url).origin);
    const session = await auth.api.getSession({ headers: context.request.headers });
    if (!session?.user) return { user: null, meta: readPortalMetadata(null) };

    const s = session.session as { activeOrganizationId?: string | null; activeTeamId?: string | null };
    const slugs = await resoudreSlugs(
      session.user.id,
      s.activeOrganizationId ?? null,
      s.activeTeamId ?? null,
    );

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
      },
      // readPortalMetadata reste tolerant : une forme inattendue degrade vers
      // un empty state, jamais vers une 500.
      meta: readPortalMetadata({
        portalRole: (session.user as Record<string, unknown>).portalRole,
        ...slugs,
      }),
    };
  })();
  return cache[CACHE_KEY] as Promise<SessionPortail>;
}
