// POST /api/admin/sync — le seul point d'entrée du sync du module Projets.
//
// Trois appelants : le handler `scheduled` du Worker (balayage complet toutes
// les 5 minutes), un curl d'amorçage au déploiement, et l'action admin
// « Synchroniser maintenant ». La route est REQUISE et non un bonus
// (amendement du 2026-08-06) : sans elle, aucun moyen d'amorcer le premier
// snapshot ni de tester sans attendre le cron.
//
// `?team_gid=` optionnel : absent → balayage complet, présent → cette team
// seule (spec 2026-08-12, §2).
//
// La réponse ne contient JAMAIS de secret : elle ne renvoie que le rapport de
// sync, qui est le même objet que meta:last_sync — compteurs et messages
// d'erreur, sans jeton ni URL authentifiée.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAuthorizedSync, SYNC_SECRET_HEADER } from "../../../lib/portail/asana/admin-auth";
import { portalKv } from "../../../lib/portail/asana/kv";
import { syncTeams, type SyncTarget } from "../../../lib/portail/asana/sync";
import { listClients } from "../../../lib/portail/clients";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const POST: APIRoute = async ({ request, url }) => {
  const secret = (env as { ADMIN_SYNC_SECRET?: string }).ADMIN_SYNC_SECRET;
  if (!isAuthorizedSync(request.headers.get(SYNC_SECRET_HEADER), secret)) {
    // 404 plutôt que 401 : la route n'a pas à confirmer son existence à qui
    // n'a pas le secret.
    return json({ error: "Not found" }, 404);
  }

  const token = (env as { ASANA_PAT?: string }).ASANA_PAT;
  if (!token) {
    return json({ error: "ASANA_PAT absent de cet environnement." }, 503);
  }

  const demandee = url.searchParams.get("team_gid");
  const clients = await listClients();

  // Chaque cible porte sa team et le board Support à ne pas synchroniser : ce
  // dernier alimente une section distincte de l'interface (corrections §7) et
  // n'a pas à recevoir un badge de statut de projet.
  const toutes: SyncTarget[] = clients
    .filter((c) => c.asana_team_gid)
    .map((c) => ({
      team_gid: c.asana_team_gid as string,
      exclude_project_gids: c.asana_support_project_gid ? [c.asana_support_project_gid] : [],
    }));

  // Une team demandée doit exister DANS LE REGISTRE : la route ne doit pas
  // servir de proxy vers une team arbitraire du workspace.
  const cibles = demandee ? toutes.filter((t) => t.team_gid === demandee) : toutes;
  if (demandee && cibles.length === 0) {
    return json({ error: "team_gid absent du registre des clients." }, 400);
  }

  const report = await syncTeams(cibles, {
    kv: portalKv(),
    token,
    log: (entry) => console.log(JSON.stringify(entry)),
  });

  return json(report, report.teams_failed > 0 ? 207 : 200);
};
