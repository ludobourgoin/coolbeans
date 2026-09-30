#!/usr/bin/env node
/* ============================================================================
   COOLBEANS — Comptes de test du portail, en base LOCALE seulement.

   Tester une page de my.coolbeans.cc en local demandait un compte dont
   personne ne connaissait le mot de passe, dans une base locale restée figée :
   ni organisation, ni workspace. Ce script rend la base locale utilisable en
   une commande.

   Ce qu'il fait, et rejoue sans risque autant de fois qu'on veut :
   1. crée les organisations du registre (src/content/organisations) et les
      workspaces du registre (src/content/clients) qui manquent en base ;
   2. crée ou remet à zéro quatre comptes de test, un par rôle utile ;
   3. leur pose le mot de passe `recette-locale` et purge leurs sessions.

   Il ne touche à aucun autre compte, et JAMAIS à une base distante : la
   commande wrangler porte `--local` en dur, et le script refuse de tourner
   avec `--remote` dans ses arguments. Aucun mail ne part.

   Usage : npm run comptes-locaux
   ========================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";

const BASE = "coolbeans-portal";
const MOT_DE_PASSE = "recette-locale";

/* Un compte par rôle qui compte pour tester les documents du portail :
   l'admin voit tout, le revendeur voit les workspaces de Trigger, un client
   final chez un revendeur (Amusoire), un client direct (CAFA). */
const COMPTES = [
  { email: "admin@local.test", nom: "Admin local", role: "admin" },
  { email: "revendeur@local.test", nom: "Revendeur local", role: "revendeur", organisation: "trigger" },
  {
    email: "client-amusoire@local.test",
    nom: "Client Amusoire",
    role: "client",
    organisation: "trigger",
    workspace: "amusoire",
  },
  {
    email: "client-cafa@local.test",
    nom: "Client CAFA",
    role: "client",
    organisation: "coolbeans",
    workspace: "cafa",
  },
];

function sortir(message) {
  console.error(message);
  process.exit(1);
}

if (process.argv.some((a) => a.includes("remote"))) {
  sortir("Refusé : ce script ne touche que la base locale.");
}
if (!fs.existsSync(".wrangler/state")) {
  sortir(
    "Pas de base locale ici (.wrangler/state absent). Dans un worktree, copier celle du clone principal :\n" +
      "  cp -R ../coolbeans/.wrangler/state .wrangler/state",
  );
}

/** Littéral SQL : les apostrophes doublées, rien d'autre à échapper. */
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);

/** Lit un champ de premier niveau d'un YAML simple, sans dépendance. */
function champ(texte, nom) {
  const m = texte.match(new RegExp(`^${nom}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

function registre(dossier) {
  return fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => {
      const texte = fs.readFileSync(path.join(dossier, f), "utf8");
      return { slug: f.replace(/\.yaml$/, ""), nom: champ(texte, "nom"), organisation: champ(texte, "organisation") };
    });
}

const maintenant = new Date().toISOString();
const sql = [];

// 1. Organisations et workspaces manquants. INSERT OR IGNORE : une ligne déjà
// présente (même slug) garde son id, et les appartenances la retrouvent par
// sous-requête sur le slug.
for (const o of registre("src/content/organisations")) {
  sql.push(
    `INSERT OR IGNORE INTO organization (id, name, slug, createdAt) VALUES (${q(`org-${o.slug}`)}, ${q(o.nom ?? o.slug)}, ${q(o.slug)}, ${q(maintenant)});`,
  );
}
for (const c of registre("src/content/clients")) {
  if (!c.organisation) continue;
  sql.push(
    `INSERT OR IGNORE INTO team (id, name, memberCount, organizationId, createdAt, updatedAt, slug) ` +
      `SELECT ${q(`team-${c.slug}`)}, ${q(c.nom ?? c.slug)}, 0, id, ${q(maintenant)}, ${q(maintenant)}, ${q(c.slug)} ` +
      `FROM organization WHERE slug = ${q(c.organisation)};`,
  );
}

// 2 et 3. Les comptes de test, remis à zéro à chaque passage.
for (const [i, compte] of COMPTES.entries()) {
  const id = `local-test-${i + 1}`;
  const empreinte = await hashPassword(MOT_DE_PASSE);
  const userId = `(SELECT id FROM user WHERE email = ${q(compte.email)})`;
  sql.push(
    `INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt, portalRole) ` +
      `VALUES (${q(id)}, ${q(compte.nom)}, ${q(compte.email)}, 1, ${q(maintenant)}, ${q(maintenant)}, ${q(compte.role)});`,
    `UPDATE user SET portalRole = ${q(compte.role)}, name = ${q(compte.nom)}, updatedAt = ${q(maintenant)} WHERE email = ${q(compte.email)};`,
    `DELETE FROM session WHERE userId = ${userId};`,
    `DELETE FROM account WHERE userId = ${userId} AND providerId = 'credential';`,
    `INSERT INTO account (id, issuer, accountId, providerId, userId, password, createdAt, updatedAt) ` +
      `SELECT ${q(`${id}-mdp`)}, 'local:credential', id, 'credential', id, ${q(empreinte)}, ${q(maintenant)}, ${q(maintenant)} ` +
      `FROM user WHERE email = ${q(compte.email)};`,
    `DELETE FROM member WHERE userId = ${userId};`,
    `DELETE FROM teamMember WHERE userId = ${userId};`,
  );
  if (compte.organisation) {
    sql.push(
      `INSERT INTO member (id, organizationId, userId, role, createdAt) ` +
        `SELECT ${q(`${id}-org`)}, o.id, u.id, 'member', ${q(maintenant)} FROM organization o, user u ` +
        `WHERE o.slug = ${q(compte.organisation)} AND u.email = ${q(compte.email)};`,
    );
  }
  if (compte.workspace) {
    sql.push(
      `INSERT INTO teamMember (id, teamId, userId, createdAt) ` +
        `SELECT ${q(`${id}-team`)}, t.id, u.id, ${q(maintenant)} FROM team t, user u ` +
        `WHERE t.slug = ${q(compte.workspace)} AND u.email = ${q(compte.email)};`,
    );
  }
}

const fichier = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "comptes-locaux-")), "comptes.sql");
fs.writeFileSync(fichier, sql.join("\n") + "\n");
try {
  execFileSync("npx", ["wrangler", "d1", "execute", BASE, "--local", "--file", fichier], { stdio: "pipe" });
} catch (err) {
  sortir(`Échec de l'écriture en base locale :\n${err.stderr?.toString() ?? err.message}`);
} finally {
  fs.rmSync(path.dirname(fichier), { recursive: true, force: true });
}

console.log(`Base locale prête. Mot de passe de tous les comptes : ${MOT_DE_PASSE}\n`);
for (const c of COMPTES) {
  const ou = c.workspace ? `workspace ${c.workspace}` : c.organisation ? `organisation ${c.organisation}` : "tout";
  console.log(`  ${c.email.padEnd(28)} ${c.role.padEnd(10)} ${ou}`);
}
