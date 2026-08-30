#!/usr/bin/env node
/* ============================================================================
   COOLBEANS — Recette de l'authentification du portail (spec §8, plan Task 12).

   Déroule les 17 scénarios contre un environnement déployé et rend un rapport.
   Ceux qui dépendent de la réception d'un mail ne peuvent pas se vérifier ici :
   le script déclenche l'envoi et le signale comme À VÉRIFIER À LA MAIN, sans
   jamais prétendre l'avoir vu arriver.

   GARDE-FOU : aucun envoi vers une adresse cliente. Les scénarios qui postent
   un mail visent l'adresse admin passée en variable d'environnement, et rien
   d'autre.

   Usage :
     PORTAL_ADMIN_EMAIL=… PORTAL_ADMIN_PASSWORD=… \
       node scripts/recette-auth.mjs --env staging

   Les comptes de test sont créés au début et supprimés à la fin, dans la base
   de l'environnement visé — jamais en production sans `--env production`.
   ========================================================================== */

import { execFileSync } from "node:child_process";

const HOTES = {
  staging: { url: "https://my-staging.coolbeans.cc", db: "coolbeans-portal-staging" },
  production: { url: "https://my.coolbeans.cc", db: "coolbeans-portal" },
};

const envCible = argValue("--env") ?? "staging";
const cible = HOTES[envCible];
if (!cible) sortir(`--env inconnu : ${envCible}`);

const adminEmail = process.env.PORTAL_ADMIN_EMAIL;
const adminMotDePasse = process.env.PORTAL_ADMIN_PASSWORD;
if (!adminEmail || !adminMotDePasse) {
  sortir("PORTAL_ADMIN_EMAIL et PORTAL_ADMIN_PASSWORD sont requis.");
}

const MDP_TEST = "recette-" + Math.random().toString(36).slice(2, 10);
const COMPTES_TEST = {
  client: `recette-client@coolbeans.cc`,
  revendeur: `recette-revendeur@coolbeans.cc`,
};

const resultats = [];
function noter(numero, intitule, etat, detail = "") {
  resultats.push({ numero, intitule, etat, detail });
  const marque = { ok: "✅", ko: "❌", manuel: "✋", sans: "➖" }[etat];
  console.log(`${marque} ${String(numero).padStart(2)} ${intitule}${detail ? ` — ${detail}` : ""}`);
}

/* --- Outils -------------------------------------------------------------- */

function sql(commande) {
  const sortie = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", cible.db, "--remote", "--command", commande, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const debut = sortie.indexOf("[");
  return JSON.parse(sortie.slice(debut))[0].results ?? [];
}

async function appel(chemin, { methode = "GET", corps, cookies = "", formulaire } = {}) {
  const entetes = { origin: cible.url, ...(cookies ? { cookie: cookies } : {}) };
  let body;
  if (formulaire) {
    entetes["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(formulaire).toString();
  } else if (corps) {
    entetes["content-type"] = "application/json";
    body = JSON.stringify(corps);
  }
  const reponse = await fetch(`${cible.url}${chemin}`, {
    method: methode,
    headers: entetes,
    body,
    redirect: "manual",
  });
  const setCookie = reponse.headers.getSetCookie?.() ?? [];
  return {
    statut: reponse.status,
    emplacement: reponse.headers.get("location"),
    cookies: setCookie.map((c) => c.split(";")[0]).join("; "),
    texte: await reponse.text(),
  };
}

async function connecter(email, motDePasse) {
  const r = await appel("/api/auth/sign-in/email", {
    methode: "POST",
    corps: { email, password: motDePasse },
  });
  return r.statut === 200 ? r.cookies : null;
}

/* --- Préparation --------------------------------------------------------- */

console.log(`Recette de l'authentification — ${cible.url}\n`);

const cookiesAdmin = await connecter(adminEmail, adminMotDePasse);
if (!cookiesAdmin) sortir("Connexion admin impossible : recette interrompue.");

// La page Utilisateurs n'existe que depuis la Task 9 : si elle répond 404,
// l'environnement ne sert pas encore le code qu'on prétend recetter.
const pageUtilisateurs = await appel("/espace/utilisateurs", { cookies: cookiesAdmin });
if (pageUtilisateurs.statut === 404) {
  sortir("La page /espace/utilisateurs n'est pas déployée : attendre la fin du build.");
}

/* --- Scénarios ----------------------------------------------------------- */

// 1. Invitation émise depuis la page admin, réception du mail.
const inviteClient = await appel("/_actions/utilisateurs.inviter", {
  methode: "POST",
  cookies: cookiesAdmin,
  formulaire: {
    nom: "Recette Client",
    email: COMPTES_TEST.client,
    portalRole: "client",
    organisation: "coolbeans",
    workspace: "revolutions-douces",
  },
});
noter(
  1,
  "Invitation émise depuis la page admin",
  [200, 303].includes(inviteClient.statut) ? "ok" : "ko",
  `HTTP ${inviteClient.statut}`,
);

// 12 et 13 : le type et la portée sont posés à l'invitation, pas « au portail ».
const inviteRevendeur = await appel("/_actions/utilisateurs.inviter", {
  methode: "POST",
  cookies: cookiesAdmin,
  formulaire: {
    nom: "Recette Revendeur",
    email: COMPTES_TEST.revendeur,
    portalRole: "revendeur",
    organisation: "trigger",
  },
});
noter(
  12,
  "Invitation `revendeur` portée par une organisation",
  [200, 303].includes(inviteRevendeur.statut) ? "ok" : "ko",
  `HTTP ${inviteRevendeur.statut}`,
);

const sansOrganisation = await appel("/_actions/utilisateurs.inviter", {
  methode: "POST",
  cookies: cookiesAdmin,
  formulaire: { nom: "Sans Org", email: "recette-sans-org@coolbeans.cc", portalRole: "client" },
});
noter(
  13,
  "Invitation `client` sans team refusée",
  sansOrganisation.statut >= 400 ? "ok" : "ko",
  `HTTP ${sansOrganisation.statut}`,
);

// Les comptes de test n'ont pas de mot de passe (accès par lien magique) : on
// leur en pose un directement pour pouvoir jouer les scénarios de connexion.
const idsTest = Object.fromEntries(
  sql(
    `SELECT email, id FROM user WHERE email IN ('${COMPTES_TEST.client}','${COMPTES_TEST.revendeur}')`,
  ).map((r) => [r.email, r.id]),
);

// 4 et 5 : connexion nominale et mot de passe erroné.
const bonneConnexion = await connecter(adminEmail, adminMotDePasse);
noter(4, "Connexion e-mail + mot de passe", bonneConnexion ? "ok" : "ko");

const mauvaise = await appel("/api/auth/sign-in/email", {
  methode: "POST",
  corps: { email: adminEmail, password: "manifestement-faux" },
});
/* L'API répond en anglais — c'est la langue de la bibliothèque. Ce que la
   spec §7 exige, c'est le message vu par la personne : il vit dans
   /connexion, qui traduit tout refus en une seule phrase (et la même pour
   une adresse inconnue, pour ne pas révéler qui a un compte). */
const pageConnexion = await appel("/connexion");
const messageFrancais = /mot de passe incorrect/i.test(pageConnexion.texte);
noter(
  5,
  "Mot de passe erroné, message en français",
  mauvaise.statut >= 400 && messageFrancais ? "ok" : "ko",
  `API HTTP ${mauvaise.statut}, page ${messageFrancais ? "traduite" : "NON traduite"}`,
);

// 6 et 7 : les deux envois. On déclenche, on ne prétend pas les recevoir.
const reset = await appel("/api/auth/request-password-reset", {
  methode: "POST",
  corps: { email: adminEmail, redirectTo: "/connexion" },
});
noter(6, "Mot de passe oublié : envoi déclenché", reset.statut === 200 ? "manuel" : "ko",
  `HTTP ${reset.statut}, vérifier la réception sur ${adminEmail}`);

const magique = await appel("/api/auth/sign-in/magic-link", {
  methode: "POST",
  corps: { email: adminEmail, callbackURL: "/" },
});
noter(7, "Lien magique : envoi déclenché", magique.statut === 200 ? "manuel" : "ko",
  `HTTP ${magique.statut}, vérifier la réception sur ${adminEmail}`);

noter(2, "Premier accès par le lien reçu, avec mot de passe", "manuel", "dépend du mail");
noter(3, "Premier accès par le lien reçu, sans mot de passe", "manuel", "dépend du mail");
noter(8, "Lien expiré puis déjà utilisé", "manuel", "dépend du mail");

// 9 : accès sans session.
/* `/espace/*` est un chemin INTERNE : sur my.*, le Worker le redirige d'abord
   en 301 vers sa forme courte. On demande donc directement la forme courte,
   sinon on mesure la réécriture d'hôte et pas la garde de session. */
const sansSession = await appel("/projets");
const redirigeVersConnexion = [301, 302, 303, 307].includes(sansSession.statut) &&
  (sansSession.emplacement ?? "").includes("connexion");
noter(
  9,
  "Accès sans session : redirection vers /connexion",
  redirigeVersConnexion ? "ok" : "ko",
  `HTTP ${sansSession.statut} → ${sansSession.emplacement ?? "—"}`,
);

// 10 et 17 : les gardes.
const cookiesRevendeur = await poserMotDePasseEtConnecter(COMPTES_TEST.revendeur);
const cookiesClient = await poserMotDePasseEtConnecter(COMPTES_TEST.client);

const actionInterdite = await appel("/_actions/utilisateurs.inviter", {
  methode: "POST",
  cookies: cookiesClient ?? "",
  formulaire: {
    nom: "Interdit",
    email: "interdit@coolbeans.cc",
    portalRole: "client",
    organisation: "coolbeans",
    workspace: "coolbeans",
  },
});
noter(
  10,
  "Garde admin sur une action réservée",
  actionInterdite.statut >= 400 ? "ok" : "ko",
  `HTTP ${actionInterdite.statut}`,
);

const devisPourRevendeur = await appel("/devis", { cookies: cookiesRevendeur ?? "" });
noter(
  17,
  "Cockpit Devis refusé à un `revendeur`",
  [301, 302, 303, 307, 403, 404].includes(devisPourRevendeur.statut) ? "ok" : "ko",
  `HTTP ${devisPourRevendeur.statut}`,
);

// 11 : la messagerie lit les colonnes renommées.
const messagerie = await appel("/messagerie", { cookies: cookiesAdmin });
noter(
  11,
  "Messagerie après renommage des colonnes",
  messagerie.statut === 200 ? "ok" : "ko",
  `HTTP ${messagerie.statut}, ${sql("SELECT count(*) AS n FROM tickets")[0].n} ticket(s)`,
);

// 14, 15, 16 : le multi-tenant.
const docVoisine = await appel("/docs/amusoire/vue-densemble", { cookies: cookiesClient ?? "" });
noter(
  15,
  "Team voisine inaccessible à un `client`",
  [301, 302, 303, 307, 404].includes(docVoisine.statut) ? "ok" : "ko",
  `HTTP ${docVoisine.statut}`,
);

/* Le compte revendeur de la recette n'a AUCUNE appartenance de team : il est
   seulement membre de l'organisation `trigger`. S'il ouvre la doc d'amusoire,
   c'est bien la portée d'organisation qui la lui donne — donc une team
   ajoutée après son invitation lui reviendrait de la même façon, sans
   nouvelle invitation. C'est le scénario 14, mesuré sans attendre qu'une team
   naisse. */
const docDeSonOrganisation = await appel("/docs/amusoire/vue-densemble", {
  cookies: cookiesRevendeur ?? "",
});
const docHorsOrganisation = await appel("/docs/revolutions-douces/comptes-a-ouvrir", {
  cookies: cookiesRevendeur ?? "",
});
noter(
  14,
  "Portée d'un `revendeur` : les teams de son organisation, sans invitation par team",
  docDeSonOrganisation.statut === 200 && docHorsOrganisation.statut !== 200 ? "ok" : "ko",
  `amusoire HTTP ${docDeSonOrganisation.statut}, hors organisation HTTP ${docHorsOrganisation.statut}`,
);

const accueilClient = await appel("/", { cookies: cookiesClient ?? "" });
const aUnSelecteur = /data-workspace-switcher|WorkspaceSwitcher/.test(accueilClient.texte);
noter(
  16,
  "Un seul workspace : aucun sélecteur",
  aUnSelecteur ? "ko" : "ok",
  aUnSelecteur ? "sélecteur présent" : "pas de sélecteur",
);

/* --- Ménage -------------------------------------------------------------- */

for (const email of Object.values(COMPTES_TEST)) {
  const id = idsTest[email];
  if (!id) continue;
  sql(
    `DELETE FROM session WHERE userId='${id}'; DELETE FROM teamMember WHERE userId='${id}'; DELETE FROM member WHERE userId='${id}'; DELETE FROM account WHERE userId='${id}'; DELETE FROM user WHERE id='${id}'`,
  );
}
console.log("\ncomptes de recette supprimés");

const ko = resultats.filter((r) => r.etat === "ko");
const manuels = resultats.filter((r) => r.etat === "manuel");
console.log(
  `\n${resultats.filter((r) => r.etat === "ok").length} vérifiés, ${manuels.length} à vérifier à la main, ${ko.length} en échec`,
);
if (ko.length) process.exit(1);

/* --- Utilitaires --------------------------------------------------------- */

/**
 * Donne un mot de passe à un compte de recette, puis ouvre sa session.
 *
 * Un compte ouvert par la page admin n'en a pas : sa porte d'entrée est le
 * lien magique, qui suppose une boîte mail. La recette écrit donc l'empreinte
 * elle-même, avec la fonction de hachage de Better Auth — jamais une valeur
 * bricolée, qui passerait l'insertion et échouerait à la vérification. Le
 * compte est supprimé en fin de recette.
 */
async function poserMotDePasseEtConnecter(email) {
  const id = idsTest[email];
  if (!id) return null;
  const { hashPassword } = await import("better-auth/crypto");
  const empreinte = await hashPassword(MDP_TEST);
  const maintenant = new Date().toISOString();
  sql(
    `INSERT INTO account (id, issuer, accountId, providerId, userId, password, createdAt, updatedAt)
     VALUES ('${id}acc', 'local:credential', '${id}', 'credential', '${id}', '${empreinte.replace(/'/g, "''")}', '${maintenant}', '${maintenant}')`,
  );
  return connecter(email, MDP_TEST);
}

function argValue(nom) {
  const i = process.argv.indexOf(nom);
  return i === -1 ? undefined : process.argv[i + 1];
}

function sortir(message) {
  console.error(message);
  process.exit(1);
}
