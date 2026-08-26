// Résolution du client courant (spec 2026-08-12, §3).
//
// Fonction pure : elle reçoit le registre, le metadata et la valeur du cookie,
// et n'accède ni à Astro ni au réseau. C'est ce qui rend la règle de sécurité
// testable directement.
//
// LA règle : pour un non-admin, le cookie est IGNORÉ. Pas masqué, pas filtré —
// ignoré. Un cookie forgé chez un client ne produit donc rien. L'Action qui le
// pose revérifie le rôle de son côté : deux barrières indépendantes.

import { DEFAULT_WORKSPACE, getWorkspaceIn, sortWorkspaces, type PortalWorkspace } from "./workspaces";
import { type PortalMetadata } from "./metadata";

/** Cookie de préférence d'affichage. Jamais une autorisation. */
export const WORKSPACE_COOKIE = "portal_workspace";

export function resolveCurrentWorkspace(
  clients: PortalWorkspace[],
  meta: PortalMetadata,
  cookieValue: string | null,
): PortalWorkspace | null {
  // Un client ne voit que le sien, quoi qu'il envoie.
  if (meta.role !== "admin") return getWorkspaceIn(clients, meta.workspace);

  // Admin : cookie → son propre client → défaut → premier du registre.
  return (
    getWorkspaceIn(clients, cookieValue) ??
    getWorkspaceIn(clients, meta.workspace) ??
    getWorkspaceIn(clients, DEFAULT_WORKSPACE) ??
    sortWorkspaces(clients)[0] ??
    null
  );
}
