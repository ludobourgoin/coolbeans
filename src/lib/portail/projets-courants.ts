/* Les projets d'un workspace pour la requête en cours (spec 2026-09-30, barre
 * par workspace, §4). La barre (PortalLayout) et la page projet les demandent
 * toutes deux : la promesse est mémoïsée par requête et par workspace, comme
 * getPortalContext.
 */
import { env } from "cloudflare:workers";
import { chargerDocuments } from "../documents/charger";
import { lecture, type Lecture } from "../documents/acces";
import type { DocumentProjet } from "../documents/projet";
import { projetsDuWorkspace, type ProjetPortail } from "../documents/projets-portail";
import { workspacesVisibles } from "./appartenances";
import { getPortalContext, type PortalRequestContext } from "./context";
import { cacheWorker, projetsDeLaTeam } from "./projets-linear";
import { listWorkspaces, type PortalWorkspace } from "./workspaces";

const CLE = "__projetsParWorkspace";

/** La règle de lecture du compte connecté, pour les documents d'un workspace. */
export async function lecteurDe(
  context: PortalRequestContext,
  workspace: PortalWorkspace,
): Promise<(d: DocumentProjet) => Lecture> {
  const { meta } = await getPortalContext(context);
  const compte = { role: meta.role, portee: workspacesVisibles(await listWorkspaces(), meta).map((w) => w.slug) };
  return (d) => lecture(d, compte, workspace);
}

export function projetsDe(context: PortalRequestContext, workspace: PortalWorkspace): Promise<ProjetPortail[]> {
  const locals = context.locals as Record<string, unknown>;
  locals[CLE] ??= new Map<string, Promise<ProjetPortail[]>>();
  const memo = locals[CLE] as Map<string, Promise<ProjetPortail[]>>;
  let projets = memo.get(workspace.slug);
  if (!projets) {
    projets = (async () => {
      // Une fiche sans sous-team n'affiche aucun projet (spec §4.1).
      if (!workspace.linearTeamId) return [];
      const [linear, documents, lire] = await Promise.all([
        projetsDeLaTeam(workspace.linearTeamId, { apiKey: env.LINEAR_API_KEY, cache: cacheWorker() }),
        chargerDocuments(),
        lecteurDe(context, workspace),
      ]);
      return projetsDuWorkspace(linear, documents, workspace.cle, (d) => lire(d).lisible);
    })();
    memo.set(workspace.slug, projets);
  }
  return projets;
}
