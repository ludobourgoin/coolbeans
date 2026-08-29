// Résolution du client courant (spec 2026-08-12, §3).
//
// Fonction pure : elle reçoit le registre, le metadata et la valeur du cookie,
// et n'accède ni à Astro ni au réseau. C'est ce qui rend la règle de sécurité
// testable directement.
//
// LA règle : on ne cherche JAMAIS ailleurs que dans la portée du compte
// (workspacesVisibles). Un cookie forgé ne peut donc rien ouvrir — il ne
// désigne au mieux qu'un workspace déjà accessible. L'Action qui le pose
// revérifie de son côté : deux barrières indépendantes.
//
// Amendement du 2026-08-26 : la règle disait « pour un non-admin, le cookie
// est ignoré ». Elle ne tient plus, parce qu'un revendeur a légitimement
// plusieurs workspaces et doit pouvoir basculer entre eux. Filtrer par la
// portée est plus général et strictement aussi sûr : pour un client, dont la
// portée vaut un seul workspace, le résultat est identique à l'ancien.

import { DEFAULT_WORKSPACE, getWorkspaceIn, sortWorkspaces, type PortalWorkspace } from "./workspaces";
import { type PortalMetadata } from "./metadata";
import { workspacesVisibles } from "./appartenances";

/** Cookie de préférence d'affichage. Jamais une autorisation. */
export const WORKSPACE_COOKIE = "portal_workspace";

export function resolveCurrentWorkspace(
  clients: PortalWorkspace[],
  meta: PortalMetadata,
  cookieValue: string | null,
): PortalWorkspace | null {
  // Tout se joue ici : on ne resout que DANS la portée du compte.
  const visibles = workspacesVisibles(clients, meta);

  // Cookie → son propre workspace → défaut → premier de la portée.
  return (
    getWorkspaceIn(visibles, cookieValue) ??
    getWorkspaceIn(visibles, meta.workspace) ??
    getWorkspaceIn(visibles, DEFAULT_WORKSPACE) ??
    sortWorkspaces(visibles)[0] ??
    null
  );
}
