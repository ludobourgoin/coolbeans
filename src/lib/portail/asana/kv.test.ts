import { beforeEach, describe, expect, it, vi } from "vitest";

// Même stub que src/lib/chiffrage/store.test.ts : `cloudflare:workers` est un
// module virtuel du runtime, non résolvable sous Vitest. Jamais utilisé ici,
// puisque le binding est passé explicitement.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  LAST_SYNC_KEY,
  readTeamSnapshot,
  teamKey,
  writeSnapshotIfChanged,
  writeSyncReport,
  type PortalKV,
} from "./kv";
import type { SyncReport, TeamSnapshotBody } from "./types";

interface Entree {
  value: string;
  metadata: unknown;
}

const memoire = () => {
  const data = new Map<string, Entree>();
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

const body = (over: Partial<TeamSnapshotBody> = {}): TeamSnapshotBody => ({
  schema_version: 1,
  team_gid: "T1",
  projects: [],
  ...over,
});

let m: ReturnType<typeof memoire>;
beforeEach(() => {
  m = memoire();
});

describe("teamKey", () => {
  it("préfixe par team:", () => {
    expect(teamKey("T1")).toBe("team:T1");
  });
});

describe("writeSnapshotIfChanged", () => {
  it("écrit le snapshot horodaté au premier passage", async () => {
    const r = await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    expect(r.written).toBe(true);
    expect(JSON.parse(m.data.get("team:T1")!.value)).toEqual({
      schema_version: 1,
      team_gid: "T1",
      projects: [],
      synced_at: "2026-08-12T10:00:00.000Z",
    });
    expect(m.data.get("team:T1")!.metadata).toEqual({
      hash: r.hash,
      synced_at: "2026-08-12T10:00:00.000Z",
    });
  });

  // Critère 11 : deux exécutions sans changement, aucune écriture sur team:{gid}.
  it("n'écrit rien quand le contenu n'a pas changé", async () => {
    await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    const r = await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:05:00.000Z");

    expect(r.written).toBe(false);
    expect(m.puts).toEqual(["team:T1"]);
    // Et surtout : synced_at n'a pas bougé. C'est la raison d'être de la règle —
    // « Dernière mise à jour » doit dater du dernier CHANGEMENT, pas de la
    // dernière vérification. À 5 minutes, un horodatage qui bougerait douze
    // fois par heure sans que rien n'ait changé serait un mensonge visible.
    expect(JSON.parse(m.data.get("team:T1")!.value).synced_at).toBe("2026-08-12T10:00:00.000Z");
  });

  it("réécrit dès que le contenu change", async () => {
    await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    const r = await writeSnapshotIfChanged(
      m.kv,
      body({ projects: [{ gid: "p", name: "P", description: "", due_on: null, status: "in_progress", tasks: [] }] }),
      "2026-08-12T10:05:00.000Z",
    );

    expect(r.written).toBe(true);
    expect(JSON.parse(m.data.get("team:T1")!.value).synced_at).toBe("2026-08-12T10:05:00.000Z");
  });

  it("réécrit si la métadonnée de hash est absente ou malformée", async () => {
    await m.kv.put("team:T1", "{}", { metadata: { autre: 1 } });
    expect((await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z")).written).toBe(true);
  });
});

describe("readTeamSnapshot", () => {
  it("relit ce qui a été écrit", async () => {
    await writeSnapshotIfChanged(m.kv, body(), "2026-08-12T10:00:00.000Z");
    expect((await readTeamSnapshot(m.kv, "T1"))?.synced_at).toBe("2026-08-12T10:00:00.000Z");
  });

  it("renvoie null quand la clé n'existe pas", async () => {
    expect(await readTeamSnapshot(m.kv, "INCONNUE")).toBeNull();
  });

  // Une valeur illisible ne doit pas rendre une 500 : le portail affiche
  // l'empty state « synchronisation en cours ».
  it("renvoie null sur un JSON corrompu au lieu de lever", async () => {
    await m.kv.put("team:T1", "{ pas du json");
    expect(await readTeamSnapshot(m.kv, "T1")).toBeNull();
  });
});

describe("writeSyncReport", () => {
  it("écrit sous meta:last_sync à chaque passage", async () => {
    const rapport: SyncReport = {
      at: "2026-08-12T10:00:00.000Z",
      teams: 2, teams_ok: 2, teams_failed: 0,
      projects: 3, tasks: 12, snapshots_written: 1,
      asana_requests: 8, subrequests: 13, duration_ms: 900, errors: [],
    };
    await writeSyncReport(m.kv, rapport);
    expect(JSON.parse(m.data.get(LAST_SYNC_KEY)!.value)).toEqual(rapport);
  });
});
