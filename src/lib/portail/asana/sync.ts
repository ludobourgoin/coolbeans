// Orchestration du sync.
//
// `syncTeam(gid)` est l'unité de base (spec 2026-08-12) : le cron l'appelle en
// boucle, la route admin peut l'appeler une fois. C'est une contrainte de
// DÉCOUPAGE, pas de travail supplémentaire — mais elle doit être posée dès S1,
// sinon elle impose une refonte le jour où le volume l'exige.
//
// Coût d'une team : P + 4 subrequests (1 liste de projets + P listes de tâches
// + 1 getWithMetadata + au plus 1 put). Constant, quel que soit le nombre de
// clients. Le seuil de découpage en tranches et le raisonnement complet sont
// dans docs/superpowers/plans/2026-08-12-portail-projets-sync-asana.md.
//
// Les projets d'une team sont traités SÉQUENTIELLEMENT. Cloudflare plafonne à
// six connexions sortantes simultanées : paralléliser n'achèterait rien de
// significatif ici (~37 s pour 37 clients) et rendrait le débit vers Asana
// beaucoup moins prévisible, alors que c'est justement lui qui est contraint.

import { createAsanaClient } from "./asana-client";
import { writeSnapshotIfChanged, writeSyncReport, type PortalKV } from "./kv";
import { normalizeSectionName } from "./sections";
import { buildTeamSnapshot, type ProjectInput } from "./snapshot";
import type { LogFn, SyncReport } from "./types";

export interface SyncDeps {
  kv: PortalKV;
  /** ASANA_PAT. Ne doit jamais atterrir dans un log ni dans une réponse HTTP. */
  token: string;
  now?: () => Date;
  log?: LogFn;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface SyncTarget {
  team_gid: string;
  /**
   * Projets à ne pas synchroniser. En pratique : le board Support de la team,
   * qui alimente une section distincte de l'interface et n'a pas à recevoir un
   * badge « Prêt à démarrer / En cours / Terminé » (corrections §7).
   */
  exclude_project_gids?: string[];
}

export interface TeamSyncResult {
  team_gid: string;
  ok: boolean;
  written: boolean;
  projects: number;
  tasks: number;
  asana_requests: number;
  subrequests: number;
  error?: string;
}

const echec = (teamGid: string, requetes: number, message: string): TeamSyncResult => ({
  team_gid: teamGid,
  ok: false,
  written: false,
  projects: 0,
  tasks: 0,
  asana_requests: requetes,
  subrequests: requetes,
  error: message,
});

/**
 * Synchronise UNE team. Ne lève jamais : une team en erreur (API down, 404,
 * team supprimée côté Asana) ne doit pas faire tomber les autres, et surtout
 * ne doit pas écraser le snapshot existant par du vide — c'est ce qui permet
 * au portail de continuer à afficher les dernières données connues (critère 8).
 */
export async function syncTeam(
  teamGid: string,
  deps: SyncDeps,
  excludeProjectGids: string[] = [],
): Promise<TeamSyncResult> {
  const { kv, token, now = () => new Date(), log = () => {}, fetchImpl, sleep } = deps;
  const asana = createAsanaClient({ token, fetchImpl, sleep });
  const exclus = new Set(excludeProjectGids);

  try {
    const projets = await asana.listProjects(teamGid);

    const inputs: ProjectInput[] = [];
    for (const project of projets) {
      // Le board Support est exclu ICI et non dans buildTeamSnapshot : filtrer
      // avant la requête de tâches économise une requête Asana par team.
      if (exclus.has(project.gid)) continue;

      // On ne devine pas à partir du nom — « 🛟 Support Coolbeans » ne
      // s'attrape par aucun test d'égalité, et un test de préfixe masquerait
      // un jour un vrai projet client nommé « Support X ». On signale, et le
      // mapping oublié se répare dans le registre.
      if (normalizeSectionName(project.name).startsWith("support")) {
        log({
          event: "portal_sync_warning",
          reason: "support_project_not_excluded",
          team_gid: teamGid,
          project: project.gid,
          name: project.name,
        });
      }

      inputs.push({ project, tasks: await asana.listTasks(project.gid) });
    }

    const body = buildTeamSnapshot(teamGid, inputs, log);
    const { written } = await writeSnapshotIfChanged(kv, body, now().toISOString());

    return {
      team_gid: teamGid,
      ok: true,
      written,
      projects: body.projects.length,
      tasks: body.projects.reduce((n, p) => n + p.tasks.length, 0),
      asana_requests: asana.stats.requests,
      // requêtes Asana + le getWithMetadata + le put s'il a eu lieu
      subrequests: asana.stats.requests + 1 + (written ? 1 : 0),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ event: "portal_sync_team_failed", team_gid: teamGid, message });
    return echec(teamGid, asana.stats.requests, message);
  }
}

/**
 * Balayage. La liste des cibles vient du registre des clients
 * (`src/content/clients/*.yaml`) et est résolue par l'appelant — la tâche S1.1
 * d'origine, qui listait les utilisateurs Clerk pour en déduire les teams, a
 * été supprimée le 2026-08-12 : un appel réseau, une dépendance et un mode de
 * panne en moins à chaque passage.
 *
 * Le jour où le compteur `asana_requests` approche 120, filtrer `targets` au
 * point d'appel suffit à passer en tranche tournante — rien à changer ici.
 */
export async function syncTeams(targets: SyncTarget[], deps: SyncDeps): Promise<SyncReport> {
  const now = deps.now ?? (() => new Date());
  const debut = now();
  const resultats: TeamSyncResult[] = [];

  for (const cible of targets) {
    resultats.push(await syncTeam(cible.team_gid, deps, cible.exclude_project_gids ?? []));
  }

  const somme = (f: (r: TeamSyncResult) => number) => resultats.reduce((n, r) => n + f(r), 0);
  const fin = now();

  const report: SyncReport = {
    at: fin.toISOString(),
    teams: resultats.length,
    teams_ok: resultats.filter((r) => r.ok).length,
    teams_failed: resultats.filter((r) => !r.ok).length,
    projects: somme((r) => r.projects),
    tasks: somme((r) => r.tasks),
    snapshots_written: resultats.filter((r) => r.written).length,
    asana_requests: somme((r) => r.asana_requests),
    // +1 pour l'écriture de meta:last_sync elle-même
    subrequests: somme((r) => r.subrequests) + 1,
    duration_ms: fin.getTime() - debut.getTime(),
    errors: resultats
      .filter((r) => !r.ok)
      .map((r) => ({ team_gid: r.team_gid, message: r.error ?? "erreur inconnue" })),
  };

  await writeSyncReport(deps.kv, report);
  (deps.log ?? (() => {}))({ event: "portal_sync_done", ...report });
  return report;
}
