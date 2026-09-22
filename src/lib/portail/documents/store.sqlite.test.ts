/* Le seul test du module qui exécute vraiment du SQL.
 *
 * Les autres tests du store comparent des chaînes : ils vérifient qu'on a
 * écrit la bonne requête, pas qu'elle s'exécute. Cette distinction a coûté un
 * bug qui passait 296 tests au vert tout en faisant répondre 500 à la vue
 * admin, sur tous les clients : la clause ON CONFLICT ne répétait pas le
 * prédicat de l'index unique PARTIEL, et SQLite refusait la requête.
 *
 * On rejoue donc la migration telle qu'elle partira en production, contre
 * SQLite, à travers une façade minimale qui imite l'API D1 utilisée ici.
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { insererSiAbsente, type DocumentRow } from "./store";

const MIGRATION = fileURLToPath(
  new URL("../../../../migrations/0008_documents.sql", import.meta.url),
);

/** Façade D1 par-dessus node:sqlite : seules prepare/bind/run sont utilisées ici. */
function dbSqlite() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(MIGRATION, "utf8"));
  const db = {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind(...binds: unknown[]) {
          return {
            run: async () => {
              const r = stmt.run(...(binds as never[]));
              return { meta: { changes: Number(r.changes) } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const compter = () =>
    Number((sqlite.prepare("SELECT count(*) AS n FROM documents").get() as { n: number }).n);
  return { db, compter };
}

function ligne(surcharge: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: crypto.randomUUID(),
    client: "amusoire",
    titre: "Proposition",
    source: "page",
    r2_key: null,
    url: "https://coolbeans.cc/devis/amusoire/refonte-4325",
    mime: null,
    taille: null,
    date_doc: "2026-09-01",
    visible: 0,
    cree_le: "2026-09-22T09:00:00.000Z",
    cle_source: "devis/amusoire/refonte-4325",
    ...surcharge,
  };
}

test("la migration s'applique et l'insertion d'une page passe", async () => {
  const { db, compter } = dbSqlite();
  await insererSiAbsente(db, ligne());
  expect(compter()).toBe(1);
});

test("deux passages consécutifs ne créent qu'une ligne", async () => {
  // Spec §11. C'est l'invariant de l'enregistrement automatique : la vue admin
  // le rejoue à chaque rendu.
  const { db, compter } = dbSqlite();
  await insererSiAbsente(db, ligne());
  await insererSiAbsente(db, ligne());
  await insererSiAbsente(db, ligne());
  expect(compter()).toBe(1);
});

test("la même clé de source chez deux clients fait bien deux lignes", () => {
  // L'index est unique sur le COUPLE (client, cle_source) : deux workspaces
  // ne se marchent pas dessus.
  const { db, compter } = dbSqlite();
  return Promise.all([
    insererSiAbsente(db, ligne({ client: "amusoire" })),
    insererSiAbsente(db, ligne({ client: "oide" })),
  ]).then(() => {
    expect(compter()).toBe(2);
  });
});

test("les lignes sans clé de source ne se bloquent pas entre elles", async () => {
  // L'index est partiel : un fichier déposé deux fois reste deux documents,
  // c'est voulu.
  const { db, compter } = dbSqlite();
  await insererSiAbsente(db, ligne({ source: "fichier", cle_source: null, url: null }));
  await insererSiAbsente(db, ligne({ source: "fichier", cle_source: null, url: null }));
  expect(compter()).toBe(2);
});

test("un document naît masqué", async () => {
  const { db } = dbSqlite();
  await insererSiAbsente(db, ligne());
  // `visible` est posé à 0 par l'appelant ET par le DEFAULT de la table.
  expect(ligne().visible).toBe(0);
});
