#!/usr/bin/env node
/* ============================================================================
   COOLBEANS — Rattacher un workspace à une autre organisation.

   Un workspace est une team Better Auth, rangée dans l'organisation de son
   revendeur. Quand un client change de revendeur (Amusoire, passée de Trigger
   à Coolbeans le 2026-09-30, COO-303), la fiche du registre change et la team
   doit suivre en base.

   Le plugin `organization` ne sait pas le faire : `update-team` ignore
   volontairement `organizationId` (vérifié sur better-auth 1.7 le 2026-10-01).
   Ce script change donc la seule colonne `team.organizationId`, et rien
   d'autre. Il refuse de toucher une team qui a des membres ou des invitations
   en attente : leurs rattachements à l'organisation ne suivent pas la team, et
   les déplacer à la main reviendrait à réécrire ce que le plugin pose.

   Sans --appliquer, il affiche ce qu'il ferait et n'écrit rien. Après écriture,
   il relit la base et vérifie le résultat.

   Usage :
     node scripts/deplacer-workspace.mjs <workspace> <organisation> --env local
     node scripts/deplacer-workspace.mjs amusoire coolbeans --env staging --appliquer

   `--env` vaut local (défaut), staging ou production. La production est un
   geste qui ne se fait que sur ordre explicite de Ludo.
   ========================================================================== */
import { execFileSync } from "node:child_process";

const CIBLES = {
  local: { base: "coolbeans-portal", options: ["--local"] },
  staging: { base: "coolbeans-portal-staging", options: ["--remote", "--env", "staging"] },
  production: { base: "coolbeans-portal", options: ["--remote"] },
};

function sortir(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const iEnv = args.indexOf("--env");
const env = iEnv === -1 ? "local" : args[iEnv + 1];
const appliquer = args.includes("--appliquer");
// La valeur de --env n'est pas un argument positionnel ; sans --env, aucun ne
// s'écarte.
const positionnels = args.filter((a, i) => !a.startsWith("--") && (iEnv === -1 || i !== iEnv + 1));
const [workspace, organisation] = positionnels;

const cible = CIBLES[env];
if (!cible) sortir(`--env inconnu : ${env}. Valeurs possibles : local, staging, production.`);
if (!workspace || !organisation) {
  sortir("Usage : node scripts/deplacer-workspace.mjs <workspace> <organisation> [--env local|staging|production] [--appliquer]");
}

/** Littéral SQL : les apostrophes doublées, rien d'autre à échapper. */
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;

function sql(commande) {
  const sortie = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", cible.base, ...cible.options, "--json", "--command", commande],
    { stdio: ["ignore", "pipe", "pipe"] },
  ).toString();
  return JSON.parse(sortie)[0]?.results ?? [];
}

function lireTeam() {
  return sql(
    `SELECT t.id, t.slug, o.slug AS organisation FROM team t ` +
      `JOIN organization o ON o.id = t.organizationId WHERE t.slug = ${q(workspace)}`,
  )[0];
}

const team = lireTeam();
if (!team) sortir(`Aucune team « ${workspace} » dans la base ${env}.`);

const [cibleOrg] = sql(`SELECT id FROM organization WHERE slug = ${q(organisation)}`);
if (!cibleOrg) sortir(`Aucune organisation « ${organisation} » dans la base ${env}.`);

console.log(`${env} : team « ${team.slug} » rattachée à « ${team.organisation} ».`);
if (team.organisation === organisation) {
  console.log("Déjà rattachée à la bonne organisation : rien à faire.");
  process.exit(0);
}

const [{ n: membres }] = sql(`SELECT count(*) AS n FROM teamMember WHERE teamId = ${q(team.id)}`);
const [{ n: invitations }] = sql(
  `SELECT count(*) AS n FROM invitation WHERE teamId = ${q(team.id)} AND status = 'pending'`,
);
if (membres > 0 || invitations > 0) {
  sortir(
    `Refusé : la team a ${membres} membre(s) et ${invitations} invitation(s) en attente. ` +
      "Leurs rattachements à l'organisation ne suivent pas la team ; ce script ne les déplace pas.",
  );
}

console.log(`À faire : rattacher « ${team.slug} » à « ${organisation} ».`);
if (!appliquer) {
  console.log("Simulation : rien n'est écrit. Relancer avec --appliquer pour écrire.");
  process.exit(0);
}

sql(
  `UPDATE team SET organizationId = ${q(cibleOrg.id)}, updatedAt = ${q(new Date().toISOString())} ` +
    `WHERE id = ${q(team.id)}`,
);

const apres = lireTeam();
if (apres?.organisation !== organisation) {
  sortir(`Échec : la team est rattachée à « ${apres?.organisation ?? "?"} » après écriture.`);
}
console.log(`Fait : « ${apres.slug} » est rattachée à « ${apres.organisation} » dans la base ${env}.`);
