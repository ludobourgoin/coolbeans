#!/usr/bin/env node
/* ============================================================================
   COOLBEANS : range une pièce (devis, facture) dans le dossier de son projet.

   Ludo dépose les PDF dans a-classer/ ; Claude lit chacun, trouve le
   workspace et le projet Linear, puis le déplace ici sous
   pieces/<workspace>/<identifiant du projet Linear>/<Nom propre>.pdf.
   La page projet du portail liste ce dossier. R2 ne renomme pas : le script
   copie l'objet vers la cible, vérifie la copie, puis supprime la source.

   Usage :
     node scripts/ranger-piece.mjs "a-classer/Facture_24628.pdf" \
       "pieces/fylgo/42d0fb9d1281/Facture de solde 24628.pdf" [--env staging|production]

   Sans --env, le local. Viser staging ou la production doit être explicite.
   Piège du local (wrangler 4, constaté le 2026-10-03) : `r2 object put
   --local` stocke la clé encodée (« Devis%204330.pdf ») et `get` la cherche
   en clair. Avec un espace dans la cible, la vérification échoue et la
   source reste en place. En remote, les espaces passent.
   ========================================================================== */

import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKETS = {
  local: ["coolbeans-portal-fichiers", "--local"],
  staging: ["coolbeans-portal-fichiers-staging", "--remote"],
  production: ["coolbeans-portal-fichiers", "--remote"],
};

const args = process.argv.slice(2);
const i = args.indexOf("--env");
const env = i === -1 ? "local" : args[i + 1];
const valeurEnv = i === -1 ? -1 : i + 1;
const [source, cible] = args.filter((a, j) => !a.startsWith("--") && j !== valeurEnv);
if (!source || !cible || !BUCKETS[env]) {
  console.error('usage : node scripts/ranger-piece.mjs "<source>" "<cible>" [--env local|staging|production]');
  process.exit(1);
}
if (!/^pieces\/[^/]+\/[^/]+\/[^/]+\.pdf$/i.test(cible)) {
  console.error(`✗ cible mal formée : ${cible} (attendu : pieces/<workspace>/<projet Linear>/<nom>.pdf)`);
  process.exit(1);
}

const [bucket, portee] = BUCKETS[env];
const wrangler = (...a) => execFileSync("npx", ["wrangler", "r2", "object", ...a, portee], { stdio: ["ignore", "pipe", "pipe"] });

const fichier = join(mkdtempSync(join(tmpdir(), "piece-")), "piece.pdf");
wrangler("get", `${bucket}/${source}`, "--file", fichier);
wrangler("put", `${bucket}/${cible}`, "--file", fichier, "--content-type", "application/pdf");
const verif = join(mkdtempSync(join(tmpdir(), "piece-")), "verif.pdf");
wrangler("get", `${bucket}/${cible}`, "--file", verif);
if (statSync(verif).size !== statSync(fichier).size) {
  console.error(`✗ copie incomplète vers ${cible} : la source est gardée.`);
  process.exit(1);
}
wrangler("delete", `${bucket}/${source}`);
console.log(`✓ ${source} → ${cible} (${env})`);
