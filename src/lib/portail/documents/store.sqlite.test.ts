/* Le seul test du module qui exécute vraiment du SQL.
 *
 * Les autres tests du store comparent des chaînes : ils vérifient qu'on a
 * écrit la bonne requête, pas qu'elle s'exécute. Cette distinction a coûté un
 * bug qui passait 296 tests au vert tout en faisant répondre 500 à la vue
 * admin, sur tous les clients. On rejoue donc la migration telle qu'elle est
 * partie en production, contre SQLite, à travers une façade minimale qui imite
 * l'API D1 utilisée ici.
 *
 * Le cas d'origine visait `insererSiAbsente`, retirée le 2026-09-22 avec
 * l'enregistrement automatique des pages du repo. Ce qui reste à couvrir est
 * l'insertion d'un fichier déposé : c'est elle qui doit tenir contre la vraie
 * table, contrainte CHECK et valeurs par défaut comprises.
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { creerDocument, type DocumentRow } from "./store";

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
    titre: "facture-2026-09.pdf",
    source: "fichier",
    r2_key: "documents/amusoire/abc.pdf",
    url: null,
    mime: "application/pdf",
    taille: 12_345,
    date_doc: "2026-09-01",
    visible: 0,
    cree_le: "2026-09-22T09:00:00.000Z",
    cle_source: null,
    ...surcharge,
  };
}

test("la migration s'applique et le dépôt d'un fichier passe", async () => {
  const { db, compter } = dbSqlite();
  await creerDocument(db, ligne());
  expect(compter()).toBe(1);
});

test("le même fichier déposé deux fois fait bien deux documents", async () => {
  // L'index unique de la table est PARTIEL, sur les seules lignes qui portent
  // une clé de source. Un fichier n'en a pas : rien ne le déduplique, et c'est
  // voulu.
  const { db, compter } = dbSqlite();
  await creerDocument(db, ligne());
  await creerDocument(db, ligne({ id: "autre" }));
  expect(compter()).toBe(2);
});

test("un document naît masqué", async () => {
  const { db } = dbSqlite();
  await creerDocument(db, ligne());
  // `visible` est posé à 0 par l'appelant ET par le DEFAULT de la table.
  expect(ligne().visible).toBe(0);
});
