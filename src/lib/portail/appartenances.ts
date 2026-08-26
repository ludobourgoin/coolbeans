// Portee d'un compte : quelles teams il peut voir (spec 2026-08-19 §3.1).
//
// Fonction pure, comme resolveCurrentWorkspace : elle recoit le registre et le
// compte, et n'accede ni a Astro ni au reseau. C'est ce qui rend la garde du
// multi-tenant testable directement, sans base ni session.
//
// Le dernier cas compte plus qu'il n'en a l'air : un `client` dont le
// workspace ne releve pas de son organisation ne voit RIEN. Ce n'est pas de la
// paranoia — c'est ce qui evite qu'une appartenance incoherente, posee par
// erreur a l'invitation, ouvre une team au hasard.

import { isAdmin, type PortalMetadata } from "./metadata";
import type { PortalWorkspace } from "./workspaces";

export function workspacesVisibles(
  clients: PortalWorkspace[],
  meta: PortalMetadata,
): PortalWorkspace[] {
  // L'admin ne passe par aucune appartenance : il lit le registre entier.
  if (isAdmin(meta)) return clients;

  // Sans organisation, aucune portee. Un compte non-admin qui n'appartient a
  // rien ne voit rien, quel que soit son workspace declare.
  if (!meta.organisation) return [];

  const deLOrganisation = clients.filter((c) => c.organisation === meta.organisation);

  // Un revendeur voit toute team de son organisation, y compris celles
  // creees APRES son invitation : c'est ce qui justifie les deux niveaux
  // plutot qu'une etiquette posee sur chaque client.
  if (meta.role === "revendeur") return deLOrganisation;

  return deLOrganisation.filter((c) => c.slug === meta.workspace);
}
