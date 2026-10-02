/* ============================================================================
   COOLBEANS : import des pièces comptables Tiime dans le portail.

   Spec : docs/superpowers/specs/2026-10-02-devis-et-factures-page-projet-design.md §2.

   Usage :
     node --experimental-strip-types scripts/importer-pieces.mts \
       scripts/pieces/tiime-2026-10-02.json --pdf ~/Downloads [--env staging] [--appliquer]

   Sans --appliquer, rien n'est écrit : le script affiche les pièces
   nouvelles, modifiées, inchangées et écartées. Avec --appliquer, il envoie
   les PDF dans R2 puis écrit les lignes dans D1.
   --env vaut local par défaut. production ne se lance que sur ordre de Ludo.
   ========================================================================== */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJETS } from "../src/lib/documents/nomenclature.ts";
import { planifierImport, sqlEcriture, type Fiche, type PieceManifeste } from "../src/lib/pieces/plan-import.ts";
import type { Piece } from "../src/lib/pieces/piece.ts";

const CIBLES = {
  local: { d1: ["coolbeans-portal", "--local"], r2: ["coolbeans-portal-fichiers", "--local"] },
  staging: {
    d1: ["coolbeans-portal-staging", "--env", "staging", "--remote"],
    r2: ["coolbeans-portal-fichiers-staging", "--remote"],
  },
  production: { d1: ["coolbeans-portal", "--remote"], r2: ["coolbeans-portal-fichiers", "--remote"] },
} as const;

function echouer(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const valeur = (nom: string) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const manifesteChemin = args[0];
const dossierPdf = valeur("--pdf");
const env = (valeur("--env") ?? "local") as keyof typeof CIBLES;
const appliquer = args.includes("--appliquer");
if (!manifesteChemin || manifesteChemin.startsWith("--")) echouer("Premier argument attendu : le manifeste JSON.");
if (!dossierPdf) echouer("--pdf <dossier> est requis.");
if (!CIBLES[env]) echouer(`--env inconnu : ${env}. Valeurs possibles : local, staging, production.`);
const cible = CIBLES[env];

const wrangler = (args: string[]) =>
  execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/* --- Fiches : seule la ligne `raisonsSociales: [A, B]` nous intéresse. --- */
function lireFiches(dossier: string, genre: Fiche["genre"]): Fiche[] {
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".yaml") && !f.startsWith("_"))
    .map((f) => {
      const ligne = readFileSync(join(dossier, f), "utf8").match(/^raisonsSociales:\s*\[(.*)\]\s*$/m);
      const raisonsSociales = ligne
        ? ligne[1].split(",").map((r) => r.trim().replace(/^["'](.*)["']$/, "$1")).filter(Boolean)
        : [];
      return { slug: f.replace(/\.yaml$/, ""), genre, raisonsSociales };
    });
}

const fiches = [
  ...lireFiches("src/content/clients", "client"),
  ...lireFiches("src/content/organisations", "organisation"),
];
const manifeste = (JSON.parse(readFileSync(manifesteChemin, "utf8")) as { pieces: PieceManifeste[] }).pieces;
const pdfs = readdirSync(dossierPdf).filter((f) => f.toLowerCase().endsWith(".pdf"));

/* --- Lignes déjà en base. --- */
let existantes: Piece[];
try {
  const sortie = wrangler(["d1", "execute", ...cible.d1, "--json", "--command", "SELECT * FROM pieces"]);
  existantes = (JSON.parse(sortie) as { results: Piece[] }[])[0].results;
} catch (err) {
  echouer(`Lecture de la table pieces impossible (${env}). Migration 0014 appliquée ?\n${String(err)}`);
}

const plan = planifierImport({ manifeste, fiches, pdfs, existantes, projetsConnus: Object.keys(PROJETS) });

console.log(`Cible : ${env}`);
console.log(`\nNouvelles (${plan.nouvelles.length})`);
for (const p of plan.nouvelles) console.log(`  + ${p.id}  ${p.client ?? p.organisation}  ${p.projet ?? "sans projet"}`);
console.log(`\nModifiées (${plan.modifiees.length})`);
for (const m of plan.modifiees) console.log(`  ~ ${m.piece.id}  ${m.champs.join(", ")}`);
console.log(`\nInchangées (${plan.inchangees.length})`);
console.log(`\nÉcartées (${plan.ecartees.length})`);
for (const x of plan.ecartees) console.log(`  ✗ ${x.id}  ${x.motif}`);

if (!appliquer) {
  console.log("\nRien n'est écrit. Relancer avec --appliquer pour envoyer les PDF et écrire en base.");
  process.exit(0);
}

const aEcrire = [...plan.nouvelles, ...plan.modifiees.map((m) => m.piece)];
if (aEcrire.length === 0) {
  console.log("\nRien à écrire.");
  process.exit(0);
}

for (const p of aEcrire) {
  const [bucket, ...drapeaux] = cible.r2;
  wrangler([
    "r2", "object", "put", `${bucket}/${p.r2_key}`,
    "--file", join(dossierPdf, plan.pdfs[p.id]),
    "--content-type", "application/pdf",
    ...drapeaux,
  ]);
  console.log(`  ↑ ${p.r2_key}`);
}

const fichier = join(mkdtempSync(join(tmpdir(), "pieces-")), "ecriture.sql");
writeFileSync(fichier, sqlEcriture(aEcrire));
wrangler(["d1", "execute", ...cible.d1, "--file", fichier]);

const total = (JSON.parse(wrangler(["d1", "execute", ...cible.d1, "--json", "--command", "SELECT COUNT(*) AS n FROM pieces"])) as {
  results: { n: number }[];
}[])[0].results[0].n;
console.log(`\n✓ ${aEcrire.length} pièce(s) écrite(s). La table en compte ${total}.`);
