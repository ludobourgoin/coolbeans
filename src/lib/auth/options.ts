// Options Better Auth communes a l'execution et a la generation de schema.
//
// Elles vivent ici, et pas dans server.ts, pour une raison precise : le SQL
// des tables est DERIVE de cette configuration (plugins actifs, champs
// additionnels). Si le script de generation lisait une copie, la base et le
// code divergeraient en silence des la premiere modification.
//
// server.ts y ajoute la couche Cloudflare (d1Native, baseURL, secret).
// scripts/generer-schema-auth.ts les lit telles quelles, sur une SQLite vide.

import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";

/**
 * @param env absent en generation de schema : les envois de mail ne sont
 *   jamais appeles dans ce mode, seule la FORME de la configuration compte.
 */
export function optionsAuth(env?: Env) {
  return {
    emailAndPassword: {
      enabled: true,
      // AUCUNE INSCRIPTION PUBLIQUE (spec §2). Le verrou est porte ici, pas
      // seulement par l'absence de formulaire : sans lui, un POST sur
      // /api/auth/sign-up/email ouvrirait un compte a n'importe qui.
      // Verifie dans la lib : api/routes/sign-up.mjs refuse sur ce drapeau.
      disableSignUp: true,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        // Le type de compte : admin | revendeur | client.
        // NE PAS le nommer `role` — le plugin organization en definit deja un
        // sur ses membres, et la collision serait silencieuse.
        // input: false : le type ne se choisit jamais depuis le navigateur,
        // il est pose a l'invitation, par un admin.
        portalRole: { type: "string" as const, defaultValue: "client", input: false },
      },
    },
    plugins: [
      magicLink({
        // Meme verrou : sans lui, demander un lien magique pour une adresse
        // inconnue CREE le compte.
        disableSignUp: true,
        sendMagicLink: async () => {
          if (!env) return; // generation de schema
          throw new Error("sendMagicLink : gabarit branche en Task 6 du plan de migration");
        },
      }),
      // organisation = le revendeur, team = le workspace client (spec §3.1).
      organization({
        teams: { enabled: true },
        schema: {
          // La table `team` de Better Auth n'a que `name`, pas de slug. Or le
          // slug est ce qui relie une team a sa fiche du registre
          // (src/content/clients/<slug>.yaml) : detourner `name`, qui est un
          // libelle d'affichage, ferait dependre l'appariement d'un texte que
          // quelqu'un renommera un jour. On ajoute donc la colonne.
          team: {
            additionalFields: {
              slug: { type: "string" as const, required: true, unique: true },
            },
          },
        },
      }),
    ],
  };
}
