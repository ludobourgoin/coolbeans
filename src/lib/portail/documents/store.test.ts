import { expect, test } from "vitest";
import {
  basculerVisibilite,
  documentsDuClientAdmin,
  documentsVisibles,
  insererSiAbsente,
  type DocumentRow,
} from "./store";

/** Faux D1 : rejoue des résultats fixés et capture sql + bindings. */
function fakeDb(results: unknown[] = [], changes = 1) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          calls.push({ sql, binds });
          return {
            all: async () => ({ results }),
            first: async () => results[0] ?? null,
            run: async () => ({ meta: { changes } }),
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

const ligne: DocumentRow = {
  id: "d1",
  client: "amusoire",
  titre: "Proposition",
  source: "page",
  r2_key: null,
  url: "https://coolbeans.cc/devis/amusoire/refonte-4325",
  mime: null,
  taille: null,
  date_doc: "2026-09-01",
  visible: 0,
  cree_le: "2026-09-01T10:00:00.000Z",
  cle_source: "devis/amusoire/refonte-4325",
};

/* LE TEST QUI COMPTE : une ligne masquée ne doit jamais partir vers le
   navigateur d'un client. Le filtre vit dans le SQL, pas dans le rendu. */
test("la vue client filtre les lignes masquées en SQL", async () => {
  const { db, calls } = fakeDb([]);
  await documentsVisibles(db, "amusoire");
  expect(calls[0].sql).toMatch(/WHERE client = \? AND visible = 1/);
  expect(calls[0].binds).toEqual(["amusoire"]);
});

test("la vue admin ne filtre pas la visibilité", async () => {
  const { db, calls } = fakeDb([]);
  await documentsDuClientAdmin(db, "amusoire");
  expect(calls[0].sql).toMatch(/WHERE client = \?/);
  expect(calls[0].sql).not.toMatch(/visible = 1/);
});

test("l'insertion des pages du repo ne crée pas de doublon", async () => {
  const { db, calls } = fakeDb();
  await insererSiAbsente(db, ligne);
  expect(calls[0].sql).toMatch(/ON CONFLICT \(client, cle_source\) DO NOTHING/);
});

test("la bascule est bornée au client courant, pas au seul identifiant", async () => {
  // Sans le client dans le WHERE, un identifiant deviné démasquerait le
  // document d'un autre client.
  const { db, calls } = fakeDb([], 1);
  const ok = await basculerVisibilite(db, "d1", "amusoire", true);
  expect(calls[0].sql).toMatch(/WHERE id = \? AND client = \?/);
  expect(calls[0].binds).toEqual([1, "d1", "amusoire"]);
  expect(ok).toBe(true);
});

test("la bascule renvoie false quand aucune ligne ne correspond", async () => {
  const { db } = fakeDb([], 0);
  expect(await basculerVisibilite(db, "inconnu", "amusoire", true)).toBe(false);
});
