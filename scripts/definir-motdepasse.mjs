#!/usr/bin/env node
/* ============================================================================
   COOLBEANS — Pose un mot de passe sur un compte du portail.

   Chemin de SECOURS, pas la voie normale. Depuis le 2026-08-30 les mails
   d'authentification sont branchés (lien magique, réinitialisation) : pour un
   vrai client, on passe par là. Ce script existe pour les cas où aucun mail ne
   doit partir — se donner accès à un compte de test, reprendre la main sur un
   compte dont le mot de passe est perdu, amorcer un environnement.

   Le mot de passe ne quitte jamais ce terminal : saisie masquée, jamais écrit
   sur disque ni affiché, jamais passé en argument (donc absent de l'historique
   du shell). Seule son empreinte scrypt — le format attendu par Better Auth,
   `sel:hash` — part vers D1.

   Les sessions ouvertes du compte sont fermées au passage : changer un mot de
   passe sans les fermer ne change rien pour qui détient déjà un cookie.

   Usage :
     node scripts/definir-motdepasse.mjs <email>                  # D1 local
     node scripts/definir-motdepasse.mjs <email> --env staging
     node scripts/definir-motdepasse.mjs <email> --env production

   Sans --env, le local : viser un environnement déployé doit être un geste
   explicite. Même règle que scripts/amorcer-organisations.mjs.
   ========================================================================== */

import { execFileSync } from "node:child_process";
import { hashPassword } from "better-auth/crypto";

/* Nom de la base et portée wrangler par environnement. Le local et la
   production partagent le même nom de base : c'est le drapeau qui les
   sépare, d'où le couple plutôt qu'une simple chaîne. */
const CIBLES = {
  local: ["coolbeans-portal", "--local"],
  staging: ["coolbeans-portal-staging", "--remote"],
  production: ["coolbeans-portal", "--remote"],
};

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const envIndex = args.indexOf("--env");
const env = envIndex === -1 ? "local" : args[envIndex + 1];

if (!email || !CIBLES[env]) {
  console.error(
    "usage : node scripts/definir-motdepasse.mjs <email> [--env local|staging|production]",
  );
  process.exit(1);
}
const [base, portee] = CIBLES[env];

/* Entrée non interactive (tube) : tout est lu d'avance, une fois. Deux appels
   successifs se partagent la file — sinon le premier avalerait aussi la
   réponse du second. C'est ce qui rend le script testable sans terminal. */
const lignesEnAttente = process.stdin.isTTY
  ? []
  : (
      await new Promise((resolve) => {
        let tampon = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (c) => (tampon += c));
        process.stdin.on("end", () => resolve(tampon));
      })
    )
      .split("\n")
      .map((l) => l.replace(/\r$/, ""));

/** Saisie masquée en terminal, ligne à ligne sur un tube. Rien n'est affiché. */
function demander(question) {
  process.stdout.write(question);

  if (!process.stdin.isTTY) {
    process.stdout.write("\n");
    return Promise.resolve(lignesEnAttente.shift() ?? "");
  }

  return new Promise((resolve) => {
    let saisie = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (touche) => {
      switch (touche) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl-D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(saisie);
          break;
        case "\u0003": // Ctrl-C : sortir sans rien modifier
          process.stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
          break;
        case "\u007f": // retour arrière
        case "\b":
          saisie = saisie.slice(0, -1);
          break;
        default:
          // Ignore les séquences d'échappement (flèches, etc.).
          if (touche >= " ") saisie += touche;
      }
    };
    process.stdin.on("data", onData);
  });
}

const motdepasse = await demander(`Nouveau mot de passe pour ${email} (${env}) : `);
const confirmation = await demander("Confirmez : ");

if (motdepasse !== confirmation) {
  console.error("Les deux saisies diffèrent. Rien n'a été modifié.");
  process.exit(1);
}
// Même plancher que la configuration Better Auth (src/lib/auth/options.ts).
if (motdepasse.length < 8) {
  console.error("Le mot de passe doit faire au moins 8 caractères. Rien n'a été modifié.");
  process.exit(1);
}

const empreinte = await hashPassword(motdepasse);
const emailSql = email.replaceAll("'", "''");
const maintenant = new Date().toISOString();

/* Un compte peut n'avoir aucune ligne `account` — créé sans mot de passe, par
   la page /espace/utilisateurs ou à la main. On pose donc la ligne manquante
   avant d'écrire l'empreinte. Les trois ordres sont sûrs à rejouer.

   `issuer = 'local:credential'` reprend la convention des comptes existants
   (posée par la procédure de secours du 2026-08-29). */
const sql = `
INSERT INTO account (id, issuer, accountId, providerId, userId, password, createdAt, updatedAt)
SELECT lower(hex(randomblob(12))), 'local:credential', u.id, 'credential', u.id, '', '${maintenant}', '${maintenant}'
  FROM user u
 WHERE u.email = '${emailSql}'
   AND NOT EXISTS (SELECT 1 FROM account a WHERE a.userId = u.id AND a.providerId = 'credential');

UPDATE account
   SET password = '${empreinte}', updatedAt = '${maintenant}'
 WHERE providerId = 'credential'
   AND userId = (SELECT id FROM user WHERE email = '${emailSql}');

DELETE FROM session
 WHERE userId = (SELECT id FROM user WHERE email = '${emailSql}');

SELECT (SELECT COUNT(*) FROM account a JOIN user u ON u.id = a.userId
         WHERE u.email = '${emailSql}' AND a.password = '${empreinte}') AS compte_pret;
`;

execFileSync("npx", ["wrangler", "d1", "execute", base, portee, "--command", sql], {
  stdio: "inherit",
});
console.log(
  `\nMot de passe posé pour ${email} (${env}). Les sessions ouvertes de ce compte sont fermées.` +
    `\nSi « compte_pret » vaut 0 ci-dessus, l'adresse n'existe pas dans cette base.`,
);
