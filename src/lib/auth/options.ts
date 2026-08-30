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
import {
  envoyerMailAuth,
  renderInvitation,
  renderLienMagique,
  renderReinitialisation,
} from "../../emails/auth";

/**
 * @param env absent en generation de schema : les envois de mail ne sont
 *   jamais appeles dans ce mode, seule la FORME de la configuration compte.
 * @param baseURL origine REELLE de la requete, pour les liens des mails
 *   d'invitation. Absente en generation de schema, pour la meme raison.
 */
export function optionsAuth(env?: Env, baseURL = "https://my.coolbeans.cc") {
  return {
    emailAndPassword: {
      enabled: true,
      // AUCUNE INSCRIPTION PUBLIQUE (spec §2). Le verrou est porte ici, pas
      // seulement par l'absence de formulaire : sans lui, un POST sur
      // /api/auth/sign-up/email ouvrirait un compte a n'importe qui.
      // Verifie dans la lib : api/routes/sign-up.mjs refuse sur ce drapeau.
      disableSignUp: true,
      minPasswordLength: 8,
      // Mot de passe oublie : le seul chemin de recuperation autonome, tant
      // que personne d'autre que Ludo ne peut ouvrir un compte.
      sendResetPassword: async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
        if (!env) return; // generation de schema
        await envoyerMailAuth(env, user.email, renderReinitialisation({ url, prenom: user.name }));
      },
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
        sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
          if (!env) return; // generation de schema
          await envoyerMailAuth(env, email, renderLienMagique({ url }));
        },
      }),
      // organisation = le revendeur, team = le workspace client (spec §3.1).
      organization({
        teams: {
          enabled: true,
          // Pas de team par defaut a la creation d'une organisation. Le plugin
          // en cree une d'office, sans slug — et notre colonne `slug` est
          // requise : la creation echouait en D1_ERROR NOT NULL sur team.slug,
          // sans que le message dise que la team fautive etait implicite.
          // Nos teams viennent toutes du registre YAML, jamais d'un effet de
          // bord (scripts/amorcer-organisations.mjs).
          defaultTeam: { enabled: false },
        },
        // Le mail qui ouvre un acces. C'est le seul envoi declenche par un
        // geste d'admin et non par la personne elle-meme : il ne part donc
        // que sur une invitation explicitement creee depuis /espace/utilisateurs.
        sendInvitationEmail: async (data: {
          id: string;
          email: string;
          organization: { name: string };
          inviter: { user: { name?: string | null } };
        }) => {
          if (!env) return; // generation de schema
          // baseURL vient de la requete en cours (server.ts), jamais d'une
          // constante : le portail est servi sur my.coolbeans.cc par
          // reecriture d'hote, et une URL figee casserait le lien en staging.
          const url = `${baseURL}/invitation/${data.id}`;
          await envoyerMailAuth(
            env,
            data.email,
            renderInvitation({
              url,
              organisation: data.organization.name,
              inviteur: data.inviter.user.name ?? undefined,
            }),
          );
        },
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
