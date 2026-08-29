// Genere le SQL des tables Better Auth, en version installee exactement.
//
// Pourquoi pas @better-auth/cli : sa derniere version publiee (1.4.21, marquee
// « no longer supported ») est anterieure a la bibliotheque du repo (1.7.2).
// Un schema genere par un CLI plus vieux que la lib qui le lit est un piege.
// getMigrations() vit DANS better-auth : il ne peut pas diverger d'elle.
//
// La base SQLite temporaire est vide : tout ressort donc en « a creer ».
// D1 est du SQLite, le dialecte est le meme.
//
// Extension .mts et non .ts : Node ne traite pas les .ts comme des modules ES
// meme avec "type": "module" dans package.json.
//
// Usage : node --experimental-strip-types scripts/generer-schema-auth.mts

import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { optionsAuth } from "../src/lib/auth/options.ts";

const version = JSON.parse(readFileSync("node_modules/better-auth/package.json", "utf8")).version;
const base = join(mkdtempSync(join(tmpdir(), "ba-schema-")), "vide.sqlite");

const auth = betterAuth({
  baseURL: "https://my.coolbeans.cc",
  secret: "generation-de-schema-uniquement",
  database: new DatabaseSync(base),
  ...optionsAuth(),
});

const { compileMigrations, toBeCreated } = await getMigrations(auth.options);
const tables = toBeCreated.map((t) => t.table).join(", ");

const entete = `-- Tables Better Auth (spec 2026-08-19 §5.1).
--
-- GENERE — ne pas editer a la main. Regenerer apres toute modification de
-- src/lib/auth/options.ts :
--   node --experimental-strip-types scripts/generer-schema-auth.mts
--
-- better-auth ${version}. Plugins actifs : magicLink, organization (teams).
-- Tables : ${tables}

`;

writeFileSync("migrations/0004_better_auth.sql", entete + (await compileMigrations()).trim() + "\n");
console.log(`${toBeCreated.length} tables : ${tables}`);
