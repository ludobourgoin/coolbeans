import { describe, expect, it, vi } from "vitest";
import { createAsanaClient } from "./asana-client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const client = (fetchImpl: typeof fetch, over = {}) =>
  createAsanaClient({ token: "PAT", fetchImpl, sleep: async () => {}, ...over });

describe("createAsanaClient", () => {
  it("envoie le PAT en Bearer et jamais en query", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [] })) as unknown as typeof fetch;
    await client(fetchImpl).listProjects("T1");

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("PAT");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer PAT" });
  });

  it("demande les opt_fields de corrections §2 et §6 en une seule requête par projet", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [] })) as unknown as typeof fetch;
    await client(fetchImpl).listTasks("p1");

    const url = new URL(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.pathname).toBe("/api/1.0/tasks");
    expect(url.searchParams.get("project")).toBe("p1");
    expect(url.searchParams.get("limit")).toBe("100");
    const champs = (url.searchParams.get("opt_fields") ?? "").split(",");
    for (const c of [
      "name", "due_on", "completed", "assignee",
      "memberships.project.gid", "memberships.section.name",
    ]) {
      expect(champs).toContain(c);
    }
  });

  // Critère 12 : un projet de plus de 100 tâches est intégralement synchronisé.
  it("suit la pagination next_page.offset", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const offset = new URL(String(input)).searchParams.get("offset");
      return offset === null
        ? json({ data: [{ gid: "1", name: "a" }], next_page: { offset: "SUITE" } })
        : json({ data: [{ gid: "2", name: "b" }], next_page: null });
    }) as unknown as typeof fetch;

    const taches = await client(fetchImpl).listTasks("p1");
    expect(taches.map((t) => t.gid)).toEqual(["1", "2"]);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("s'arrête au plafond de pages plutôt que de boucler à l'infini", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ data: [{ gid: "x", name: "x" }], next_page: { offset: "TOUJOURS" } }),
    ) as unknown as typeof fetch;

    await expect(client(fetchImpl, { maxPages: 3 }).listTasks("p1")).rejects.toThrow(/pagination/i);
  });

  // Un 429 consomme du quota : retenter sans respecter Retry-After creuse le trou.
  it("retente après un 429 en respectant Retry-After", async () => {
    const sleep = vi.fn(async () => {});
    let appel = 0;
    const fetchImpl = vi.fn(async () => {
      appel += 1;
      return appel === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "7" } })
        : json({ data: [{ gid: "1", name: "a" }] });
    }) as unknown as typeof fetch;

    const c = createAsanaClient({ token: "PAT", fetchImpl, sleep });
    expect(await c.listProjects("T1")).toHaveLength(1);
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("retombe sur un backoff exponentiel sans Retry-After exploitable", async () => {
    const sleep = vi.fn(async () => {});
    let appel = 0;
    const fetchImpl = vi.fn(async () => {
      appel += 1;
      return appel <= 2 ? new Response("", { status: 429 }) : json({ data: [] });
    }) as unknown as typeof fetch;

    await createAsanaClient({ token: "PAT", fetchImpl, sleep }).listProjects("T1");
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
  });

  it("abandonne après maxRetries et remonte l'erreur", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    await expect(client(fetchImpl, { maxRetries: 2 }).listProjects("T1")).rejects.toThrow(/429/);
  });

  it("remonte une erreur explicite sur 4xx non 429", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(client(fetchImpl).listProjects("T404")).rejects.toThrow(/404/);
  });

  it("compte toutes les requêtes émises, retentatives comprises", async () => {
    let appel = 0;
    const fetchImpl = vi.fn(async () => {
      appel += 1;
      return appel === 1 ? new Response("", { status: 429 }) : json({ data: [] });
    }) as unknown as typeof fetch;

    const c = createAsanaClient({ token: "PAT", fetchImpl, sleep: async () => {} });
    await c.listProjects("T1");
    expect(c.stats.requests).toBe(2);
  });
});
