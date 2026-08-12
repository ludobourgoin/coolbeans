import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import { LAST_SYNC_KEY, teamKey, type PortalKV } from "./kv";
import { syncTeam, syncTeams, type SyncDeps } from "./sync";

const memoire = () => {
  const data = new Map<string, { value: string; metadata: unknown }>();
  const puts: string[] = [];
  const kv: PortalKV = {
    get: async (k) => data.get(k)?.value ?? null,
    getWithMetadata: async <M>(k: string) => {
      const e = data.get(k);
      return { value: e?.value ?? null, metadata: (e?.metadata ?? null) as M | null };
    },
    put: async (k, v, o) => {
      puts.push(k);
      data.set(k, { value: v, metadata: o?.metadata ?? null });
    },
  };
  return { kv, data, puts };
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

/** Faux Asana : une team, un projet, une tâche visible. */
const asanaOk = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/projects")) {
      return json({
        data: [{ gid: "p1", name: "Site web", notes: "Refonte.\n---\nsecret", due_on: "2026-09-30", completed: false, archived: false }],
      });
    }
    return json({
      data: [
        {
          gid: "t1",
          name: "Maquette",
          due_on: "2026-08-20",
          completed: false,
          assignee: { gid: "u1" },
          memberships: [{ project: { gid: "p1" }, section: { name: "🧱 Backlog" } }],
        },
      ],
    });
  }) as unknown as typeof fetch;

let m: ReturnType<typeof memoire>;
let deps: SyncDeps;

beforeEach(() => {
  m = memoire();
  deps = {
    kv: m.kv,
    token: "PAT",
    now: () => new Date("2026-08-12T10:00:00.000Z"),
    log: () => {},
    sleep: async () => {},
    fetchImpl: asanaOk(),
  };
});

describe("syncTeam", () => {
  it("écrit le snapshot de la team et rend son compte", async () => {
    const r = await syncTeam("T1", deps);

    expect(r).toMatchObject({ team_gid: "T1", ok: true, written: true, projects: 1, tasks: 1 });
    const snap = JSON.parse(m.data.get(teamKey("T1"))!.value);
    expect(snap.projects[0].name).toBe("Site web");
    // La portion privée des notes ne doit jamais franchir la frontière.
    expect(snap.projects[0].description).toBe("Refonte.");
    expect(JSON.stringify(snap)).not.toContain("secret");
  });

  // Le coût annoncé dans la spec : P + 3 subrequests, constant quel que soit
  // le nombre de clients. Ici P=1 : 1 liste de projets + 1 liste de tâches +
  // 1 getWithMetadata + 1 put = 4.
  it("consomme 2 requêtes Asana et 4 subrequests pour un projet", async () => {
    const r = await syncTeam("T1", deps);
    expect(r.asana_requests).toBe(2);
    expect(r.subrequests).toBe(4);
  });

  it("ne réécrit rien au second passage sans changement", async () => {
    await syncTeam("T1", deps);
    const r = await syncTeam("T1", { ...deps, now: () => new Date("2026-08-12T10:05:00.000Z") });

    expect(r.written).toBe(false);
    expect(m.puts.filter((k) => k === teamKey("T1"))).toHaveLength(1);
    expect(r.subrequests).toBe(3); // le put n'a pas eu lieu
  });

  // Critère 8 : le portail continue d'afficher le dernier snapshot.
  it("conserve l'ancien snapshot quand Asana tombe", async () => {
    await syncTeam("T1", deps);
    const avant = m.data.get(teamKey("T1"))!.value;

    const r = await syncTeam("T1", {
      ...deps,
      fetchImpl: (async () => new Response("", { status: 500 })) as unknown as typeof fetch,
    });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/500/);
    expect(m.data.get(teamKey("T1"))!.value).toBe(avant);
  });

  // Le board Support a sa propre section d'interface (corrections §7) : il ne
  // doit pas apparaître dans la liste des projets, ni recevoir un badge de
  // statut. Exclu AVANT la requête de tâches — une requête Asana économisée.
  it("exclut un projet listé et ne va pas chercher ses tâches", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/projects")) {
        return json({
          data: [
            { gid: "p1", name: "Site web", notes: "", due_on: null, completed: false, archived: false },
            { gid: "sup", name: "🛟 Support Coolbeans", notes: "", due_on: null, completed: false, archived: false },
          ],
        });
      }
      return json({ data: [] });
    }) as unknown as typeof fetch;

    const r = await syncTeam("T1", { ...deps, fetchImpl }, ["sup"]);

    expect(r.projects).toBe(1);
    expect(r.asana_requests).toBe(2); // 1 liste de projets + 1 seule liste de tâches
    const demandes = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([u]) => new URL(String(u)).searchParams.get("project"))
      .filter(Boolean);
    expect(demandes).toEqual(["p1"]);
  });

  // Un board archivé n'est pas exclu par GID (ce n'est pas le Support), mais
  // isVisibleProject doit quand même l'écarter avant la requête de tâches :
  // `GET /teams/{gid}/projects` renvoie aussi les projets archivés.
  it("exclut un projet archivé et ne va pas chercher ses tâches", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/projects")) {
        return json({
          data: [
            { gid: "p1", name: "Site web", notes: "", due_on: null, completed: false, archived: false },
            { gid: "old", name: "Ancien projet", notes: "", due_on: null, completed: false, archived: true },
          ],
        });
      }
      return json({ data: [] });
    }) as unknown as typeof fetch;

    const r = await syncTeam("T1", { ...deps, fetchImpl });

    expect(r.projects).toBe(1);
    // 1 liste de projets + 1 seule liste de tâches (le projet archivé n'en
    // déclenche aucune) + 1 getWithMetadata + 1 put.
    expect(r.asana_requests).toBe(2);
    expect(r.subrequests).toBe(4);
    const demandes = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([u]) => new URL(String(u)).searchParams.get("project"))
      .filter(Boolean);
    expect(demandes).toEqual(["p1"]);
  });

  // Filet de sécurité : un mapping oublié doit se voir dans les logs, pas se
  // découvrir sur le portail d'un client.
  it("loggue un warning sur un projet qui ressemble à un board Support non exclu", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/projects")
        ? json({ data: [{ gid: "sup", name: "🛟 Support Amusoire", notes: "", due_on: null, completed: false, archived: false }] })
        : json({ data: [] });
    }) as unknown as typeof fetch;

    const r = await syncTeam("T1", { ...deps, fetchImpl, log });

    expect(r.projects).toBe(1); // on ne devine pas : on signale, sans rien masquer
    expect(log.mock.calls.flat()).toContainEqual(
      expect.objectContaining({ reason: "support_project_not_excluded" }),
    );
  });

  it("loggue l'échec sans laisser fuiter le token", async () => {
    const log = vi.fn();
    await syncTeam("T1", {
      ...deps,
      log,
      fetchImpl: (async () => new Response("", { status: 401 })) as unknown as typeof fetch,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("PAT");
  });
});

describe("syncTeams", () => {
  it("agrège le rapport et l'écrit sous meta:last_sync", async () => {
    const rapport = await syncTeams([{ team_gid: "T1" }, { team_gid: "T2" }], deps);

    expect(rapport).toMatchObject({
      teams: 2, teams_ok: 2, teams_failed: 0,
      projects: 2, tasks: 2, snapshots_written: 2, asana_requests: 4,
      errors: [],
    });
    expect(JSON.parse(m.data.get(LAST_SYNC_KEY)!.value).teams).toBe(2);
  });

  // Brief §5 : une team en erreur ne bloque pas les autres.
  it("isole l'échec d'une team", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/teams/BOOM/")) return new Response("", { status: 404 });
      return (asanaOk() as unknown as (i: RequestInfo | URL) => Promise<Response>)(input);
    }) as unknown as typeof fetch;

    const rapport = await syncTeams([{ team_gid: "BOOM" }, { team_gid: "T2" }], { ...deps, fetchImpl });

    expect(rapport).toMatchObject({ teams: 2, teams_ok: 1, teams_failed: 1 });
    expect(rapport.errors).toEqual([{ team_gid: "BOOM", message: expect.stringContaining("404") }]);
    expect(m.data.has(teamKey("T2"))).toBe(true);
  });

  it("écrit le rapport même quand toutes les teams échouent", async () => {
    const rapport = await syncTeams([{ team_gid: "T1" }], {
      ...deps,
      fetchImpl: (async () => new Response("", { status: 503 })) as unknown as typeof fetch,
    });
    expect(rapport.teams_failed).toBe(1);
    expect(m.data.has(LAST_SYNC_KEY)).toBe(true);
  });

  it("propage les exclusions de chaque cible", async () => {
    const rapport = await syncTeams(
      [{ team_gid: "T1", exclude_project_gids: ["p1"] }, { team_gid: "T2" }],
      deps,
    );
    // Le faux Asana ne sert qu'un projet, p1 : exclu chez T1, gardé chez T2.
    expect(rapport.projects).toBe(1);
  });

  it("ne fait rien et rend un rapport vide sur une liste vide", async () => {
    const rapport = await syncTeams([], deps);
    expect(rapport).toMatchObject({ teams: 0, teams_ok: 0, projects: 0, asana_requests: 0 });
  });
});
