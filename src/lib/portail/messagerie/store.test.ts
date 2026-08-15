import { describe, expect, test } from "vitest";
import { ajouterMessage, publicationsDues, ticketsDuClient } from "./store";

/** Faux D1 : rejoue des résultats fixés et capture sql + bindings. */
function fakeDb(results: unknown[] = []) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          calls.push({ sql, binds });
          return {
            all: async () => ({ results }),
            first: async () => results[0] ?? null,
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

test("ticketsDuClient filtre par client et trie par dernier message", async () => {
  const { db, calls } = fakeDb([]);
  await ticketsDuClient(db, "amusoire");
  expect(calls[0].sql).toMatch(/WHERE client = \?/);
  expect(calls[0].sql).toMatch(/ORDER BY last_message_at DESC/);
  expect(calls[0].binds).toEqual(["amusoire"]);
});

test("ajouterMessage est idempotent sur linear_comment_id", async () => {
  const { db, calls } = fakeDb();
  await ajouterMessage(db, {
    id: "m1",
    ticket_id: "t1",
    direction: "coolbeans",
    body: "Bonjour",
    linear_comment_id: "c1",
    email_status: "none",
    created_at: "2026-08-15T10:00:00.000Z",
  });
  expect(calls[0].sql).toMatch(/INSERT OR IGNORE INTO messages/);
});

test("publicationsDues compare publish_after au temps fourni", async () => {
  const { db, calls } = fakeDb([]);
  await publicationsDues(db, "2026-08-15T10:00:00.000Z");
  expect(calls[0].sql).toMatch(/publish_after <= \?/);
  expect(calls[0].binds).toEqual(["2026-08-15T10:00:00.000Z"]);
});
