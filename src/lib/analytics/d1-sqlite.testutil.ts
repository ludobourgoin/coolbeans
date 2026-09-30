/* Rejoue les migrations telles qu'elles partiront en production, contre
 * SQLite, derrière une façade qui imite l'API D1 utilisée par le module
 * analytics. Même raison que src/lib/documents/reponses.sqlite.test.ts :
 * comparer des chaînes SQL ne dit pas qu'elles s'exécutent. */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { D1Analytics, D1Statement } from "./store";

interface Instruction extends D1Statement {
  executer(): void;
}

export function d1Sqlite(migrations: string[] = ["0011_analytics.sql", "0012_analytics_vitaux.sql"]): {
  db: D1Analytics;
  sqlite: DatabaseSync;
} {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of migrations) {
    sqlite.exec(
      readFileSync(fileURLToPath(new URL(`../../../migrations/${m}`, import.meta.url)), "utf8"),
    );
  }

  const instruction = (sql: string, valeurs: unknown[]): Instruction => ({
    bind: (...v: unknown[]) => instruction(sql, v),
    run: async () => sqlite.prepare(sql).run(...(valeurs as never[])),
    // Copie en objets ordinaires : node:sqlite rend des objets sans prototype.
    all: async <T>() => ({
      results: sqlite.prepare(sql).all(...(valeurs as never[])).map((r) => ({ ...r })) as T[],
    }),
    executer: () => {
      sqlite.prepare(sql).run(...(valeurs as never[]));
    },
  });

  const db: D1Analytics = {
    prepare: (sql) => instruction(sql, []),
    // D1 exécute un batch dans une transaction : on fait de même.
    batch: async (instructions) => {
      sqlite.exec("BEGIN");
      try {
        for (const i of instructions) (i as Instruction).executer();
        sqlite.exec("COMMIT");
      } catch (erreur) {
        sqlite.exec("ROLLBACK");
        throw erreur;
      }
      return [];
    },
  };
  return { db, sqlite };
}
