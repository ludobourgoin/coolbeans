#!/usr/bin/env node
/* ============================================================================
   COOLBEANS — Amorçage des organisations et des teams du portail.

   Le registre YAML est la source de vérité :
     src/content/organisations/<slug>.yaml  → une organisation (un revendeur)
     src/content/clients/<slug>.yaml        → une team, dans l'organisation
                                              nommée par son champ `organisation`

   Le script pose en D1 ce qui manque, et RIEN d'autre. Il est idempotent :
   relancé, il ne crée aucun doublon. Il se termine en comparant les deux côtés
   et sort en code 1 s'ils divergent — un slug présent d'un seul côté est une
   erreur, pas un avertissement.

   Il passe par les endpoints du plugin `organization` plutôt que par des INSERT
   directs : le plugin pose des colonnes qu'un INSERT écrit à la main oublierait
   (memberCount, membershipKey…).

   Usage :
     PORTAL_ADMIN_EMAIL=… PORTAL_ADMIN_PASSWORD=… \
       node scripts/amorcer-organisations.mjs --env staging

   `--env production` vise my.coolbeans.cc. Sans `--env`, staging : viser la
   production doit être un geste explicite.
   ========================================================================== */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HOTES = {
  staging: "https://my-staging.coolbeans.cc",
  production: "https://my.coolbeans.cc",
};

const env = argValue("--env") ?? "staging";
const base = HOTES[env];
if (!base) {
  echouer(`--env inconnu : ${env}. Valeurs possibles : staging, production.`);
}

const email = process.env.PORTAL_ADMIN_EMAIL;
const motDePasse = process.env.PORTAL_ADMIN_PASSWORD;
if (!email || !motDePasse) {
  echouer("PORTAL_ADMIN_EMAIL et PORTAL_ADMIN_PASSWORD sont requis (compte admin du portail).");
}

/* --- Lecture du registre ------------------------------------------------- */

// Parse volontairement minimal : ces fiches sont plates (`clé: valeur`), et
// ajouter une dépendance YAML à un script d'amorçage coûterait plus cher que
// les six lignes ci-dessous. Une fiche qui deviendrait imbriquée casserait ici,
// bruyamment — ce qui est le comportement voulu.
function lireFiche(chemin) {
  const champs = {};
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    const m = ligne.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const valeur = m[2].trim().replace(/^["'](.*)["']$/, "$1");
    if (valeur !== "" && !valeur.startsWith("#")) champs[m[1]] = valeur;
  }
  return champs;
}

function lireRegistre(dossier) {
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({ slug: f.replace(/\.yaml$/, ""), ...lireFiche(join(dossier, f)) }));
}

const organisationsAttendues = lireRegistre("src/content/organisations");
const teamsAttendues = lireRegistre("src/content/clients").map((c) => ({
  slug: c.slug,
  nom: c.nom ?? c.slug,
  organisation: c.organisation,
}));

const orpheline = teamsAttendues.find(
  (t) => !organisationsAttendues.some((o) => o.slug === t.organisation),
);
if (orpheline) {
  echouer(
    `Le client « ${orpheline.slug} » se rattache à l'organisation « ${orpheline.organisation} », qui n'a pas de fiche dans src/content/organisations/.`,
  );
}

/* --- Session admin ------------------------------------------------------- */

let cookie = "";

/**
 * Un appel à l'API Better Auth.
 *
 * La méthode compte : `list` et `list-teams` sont des GET à paramètres de
 * requête, `create` et `create-team` des POST à corps JSON. Les poster tous
 * indifféremment renvoie un 404 qui ne dit pas pourquoi.
 */
async function appeler(chemin, donnees, methode = "POST") {
  const url = new URL(`${base}/api/auth${chemin}`);
  if (methode === "GET") {
    for (const [cle, valeur] of Object.entries(donnees ?? {})) {
      if (valeur !== undefined) url.searchParams.set(cle, valeur);
    }
  }
  const reponse = await fetch(url, {
    method: methode,
    // `Origin` est obligatoire : sans lui, Better Auth refuse tout POST en 403
    // MISSING_OR_NULL_ORIGIN, sa protection contre les soumissions cross-site.
    headers: {
      "Content-Type": "application/json",
      origin: base,
      ...(cookie ? { cookie } : {}),
    },
    ...(methode === "POST" ? { body: JSON.stringify(donnees ?? {}) } : {}),
  });
  const setCookie = reponse.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const texte = await reponse.text();
  let resultat = null;
  try {
    resultat = texte ? JSON.parse(texte) : null;
  } catch {
    resultat = { brut: texte };
  }
  if (!reponse.ok) {
    throw new Error(`${chemin} → ${reponse.status} ${texte.slice(0, 200)}`);
  }
  return resultat;
}

async function connecter() {
  await appeler("/sign-in/email", { email, password: motDePasse });
  console.log(`connecté sur ${base} en tant que ${email}`);
}

/* --- Amorçage ------------------------------------------------------------ */

async function amorcer() {
  const existantes = await appeler("/organization/list", null, "GET").catch(() => []);
  const dejaLa = new Set((Array.isArray(existantes) ? existantes : []).map((o) => o.slug));

  for (const org of organisationsAttendues) {
    if (dejaLa.has(org.slug)) continue;
    await appeler("/organization/create", { name: org.nom, slug: org.slug });
    console.log(`organisation créée : ${org.slug}`);
  }

  // Relecture après création : on travaille sur l'état réel de la base, jamais
  // sur ce qu'on croit avoir posé.
  const organisations = await appeler("/organization/list", null, "GET");
  const idParSlug = new Map(organisations.map((o) => [o.slug, o.id]));

  const teamsExistantes = new Map();
  for (const org of organisations) {
    const teams = await appeler(
      "/organization/list-teams",
      { organizationId: org.id },
      "GET",
    ).catch(() => []);
    for (const t of Array.isArray(teams) ? teams : []) {
      teamsExistantes.set(t.slug, org.slug);
    }
  }

  for (const team of teamsAttendues) {
    if (teamsExistantes.has(team.slug)) continue;
    await appeler("/organization/create-team", {
      name: team.nom,
      slug: team.slug,
      organizationId: idParSlug.get(team.organisation),
    });
    teamsExistantes.set(team.slug, team.organisation);
    console.log(`team créée : ${team.slug} (${team.organisation})`);
  }

  return { organisations, teamsExistantes };
}

/* --- Vérification d'écart ------------------------------------------------ */

function verifier({ organisations, teamsExistantes }) {
  const registreOrgs = organisationsAttendues.map((o) => o.slug).sort();
  const d1Orgs = organisations.map((o) => o.slug).sort();
  const registreTeams = teamsAttendues.map((t) => t.slug).sort();
  const d1Teams = [...teamsExistantes.keys()].sort();

  console.log(`registre : ${registreOrgs.join(", ")}`);
  console.log(`D1       : ${d1Orgs.join(", ")}`);
  console.log(
    `teams    : ${teamsAttendues.map((t) => `${t.slug}(${teamsExistantes.get(t.slug) ?? "?"})`).join(", ")}`,
  );

  const ecarts = [
    ...difference(registreOrgs, d1Orgs).map((s) => `organisation « ${s} » : dans le registre, absente de D1`),
    ...difference(d1Orgs, registreOrgs).map((s) => `organisation « ${s} » : dans D1, absente du registre`),
    ...difference(registreTeams, d1Teams).map((s) => `team « ${s} » : dans le registre, absente de D1`),
    ...difference(d1Teams, registreTeams).map((s) => `team « ${s} » : dans D1, absente du registre`),
    ...teamsAttendues
      .filter((t) => teamsExistantes.get(t.slug) !== t.organisation)
      .map(
        (t) =>
          `team « ${t.slug} » : rattachée à « ${teamsExistantes.get(t.slug)} » en D1, à « ${t.organisation} » dans le registre`,
      ),
  ];

  if (ecarts.length) {
    console.error("\nÉcarts entre le registre et D1 :");
    for (const e of ecarts) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nregistre et D1 concordent.");
}

const difference = (a, b) => a.filter((x) => !b.includes(x));

function argValue(nom) {
  const i = process.argv.indexOf(nom);
  return i === -1 ? undefined : process.argv[i + 1];
}

function echouer(message) {
  console.error(message);
  process.exit(1);
}

await connecter();
verifier(await amorcer());
