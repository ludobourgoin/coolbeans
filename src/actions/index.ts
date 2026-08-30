import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import type { ActionAPIContext } from "astro:actions";
import { saveReglages } from "../lib/chiffrage/store";
import { reglagesSchema } from "../lib/chiffrage/schemas";
import { getWorkspace } from "../lib/portail/workspaces";
import { WORKSPACE_COOKIE } from "../lib/portail/current-workspace";
import { portalHref } from "../lib/portail/nav";
import { retourSchema } from "../lib/portail/retour";
import { requireAdmin as requireAdminGuard } from "../lib/portail/require-admin";
import { lireSession } from "../lib/auth/session";

/* Garde systématique : session Better Auth + type de compte admin, même
   contrôle que les pages /espace/chiffrages. Une requête forgée sans le rôle
   est rejetée ici, indépendamment du middleware.

   La vérification elle-même vit dans lib/portail/require-admin.ts, sans
   dépendance à `astro:actions` : ce module virtuel n'est pas résolvable sous
   Vitest (même contrainte que `astro:content`), et c'est cette garde que la
   spec exige de tester. Ici, on ne fait que convertir l'Error ordinaire
   qu'elle lève en ActionError. */
export async function requireAdmin(context: ActionAPIContext): Promise<void> {
  try {
    const { meta } = await lireSession(context);
    requireAdminGuard(meta);
  } catch (err) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: err instanceof Error ? err.message : "Réservé à l'administrateur.",
    });
  }
}

const SLUG_STRICT = /^[a-z0-9-]+$/;

export const server = {
  /* Le devis lui-même naît hors de l'admin (projet Linear → skill devis →
     YAML) : la seule écriture restante ici est celle des Réglages, source de
     vérité des prix lue par la skill. */
  reglages: {
    sauvegarder: defineAction({
      input: reglagesSchema,
      handler: async (input, context) => {
        await requireAdmin(context);
        await saveReglages(input);
        return { ok: true as const };
      },
    }),
  },

  portail: {
    /* Bascule l'admin d'un espace client à un autre. Le cookie posé ici est
       une préférence d'affichage : la résolution côté serveur l'ignore pour
       un non-admin, et cette action refuse de le poser. Deux barrières
       indépendantes plutôt qu'une. */
    choisirWorkspace: defineAction({
      accept: "form",
      input: z.object({
        workspace: z.string().regex(SLUG_STRICT, "Slug invalide."),
        // Chemin de retour, forcément interne, sur toute sa longueur. Deux
        // choses à empêcher :
        // - un hôte externe : "//evil.example/x" commence par une barre et
        //   est pourtant une URL protocole-relative, que le navigateur
        //   résout vers https://evil.example/x ; "/\evil.example" est
        //   normalisé en "//evil.example" par plusieurs navigateurs. D'où
        //   l'exigence d'une barre initiale NON suivie d'une seconde barre
        //   ni d'un antislash.
        // - une injection d'en-tête / response-splitting si `retour` finit
        //   un jour dans un `Location:` : sans `$` de fin, une valeur comme
        //   "/x\r\nLocation: https://evil.example" passait, le CRLF n'étant
        //   contraint nulle part après le premier caractère. D'où le `$`
        //   qui ancre toute la chaîne et l'exclusion des caractères de
        //   contrôle (CR, LF, tabulation, NUL, DEL) sur toute sa longueur.
        //
        // Schéma partagé (src/lib/portail/retour.ts) : le test Vitest de ce
        // champ l'importe directement plutôt que de recopier la regex.
        retour: retourSchema,
      }),
      handler: async ({ workspace, retour }, context) => {
        await requireAdmin(context);

        const cible = await getWorkspace(workspace);
        if (!cible) {
          throw new ActionError({ code: "NOT_FOUND", message: "Workspace inconnu." });
        }

        context.cookies.set(WORKSPACE_COOKIE, cible.slug, {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });

        // Depuis une page de doc, revenir sur `retour` (la doc elle-même)
        // relance aussitôt la règle « l'URL gagne » de
        // src/pages/docs/[client]/[...slug].astro : cette route réécrirait
        // le cookie vers le propriétaire de LA DOC AFFICHÉE, annulant la
        // bascule qu'on vient de faire. On atterrit donc sur l'accueil du
        // portail du nouveau client — décision produit du 2026-08-12.
        // Toutes les autres bascules (nav, sidebar) reviennent sur la page
        // courante, sans changement de comportement.
        //
        // `context.url` reflète l'hôte de la requête entrante ; ActionAPIContext
        // n'expose pas de méthode redirect() — c'est au niveau du middleware
        // qui appelle ce handler (src/middleware.ts) que la redirection 303
        // est effectivement émise.
        const redirectTo = retour.startsWith("/docs/")
          ? portalHref("/", context.url.hostname)
          : retour;

        return { client: cible.slug, redirectTo };
      },
    }),
  },

  /* Gestion des comptes du portail (plan Task 9). La surface que la
     disparition du dashboard Clerk rend obligatoire : ouvrir un accès, en
     changer le type, le révoquer.

     UNE INVITATION EST TOUJOURS PORTÉE PAR UNE ORGANISATION, et pour un
     `client` par une team : il n'existe aucun chemin qui invite « au
     portail ». Le schéma le refuse plus bas, la page ne l'offre pas. */
  utilisateurs: {
    inviter: defineAction({
      accept: "form",
      input: z
        .object({
          email: z.string().email("Adresse invalide."),
          nom: z.string().min(1, "Un nom est nécessaire."),
          portalRole: z.enum(["admin", "revendeur", "client"]),
          organisation: z.string().regex(SLUG_STRICT, "Slug invalide.").optional(),
          workspace: z.string().regex(SLUG_STRICT, "Slug invalide.").optional(),
          /* L'envoi du mail est un geste SÉPARÉ de la création, et il est
             décoché par défaut : pendant la phase de test, personne ne doit
             recevoir quoi que ce soit sans une décision explicite. */
          envoyerLeMail: z.boolean().default(false),
        })
        .refine((v) => v.portalRole === "admin" || Boolean(v.organisation), {
          message: "Un compte non-admin appartient forcément à une organisation.",
          path: ["organisation"],
        })
        .refine((v) => v.portalRole !== "client" || Boolean(v.workspace), {
          message: "Un compte client appartient forcément à un workspace.",
          path: ["workspace"],
        }),
      handler: async (input, context) => {
        await requireAdmin(context);
        const { env } = await import("cloudflare:workers");
        const { creerUtilisateur } = await import("../lib/portail/utilisateurs");

        try {
          await creerUtilisateur(env.PORTAL_DB, input);
        } catch (err) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Création impossible.",
          });
        }

        if (input.envoyerLeMail) {
          const { createAuth } = await import("../lib/auth/server");
          const origine = new URL(context.request.url).origin;
          await createAuth(env, origine).api.signInMagicLink({
            body: { email: input.email, callbackURL: "/" },
            headers: context.request.headers,
          });
        }

        return { ok: true as const, mailEnvoye: input.envoyerLeMail };
      },
    }),

    changerType: defineAction({
      accept: "form",
      input: z.object({
        userId: z.string().min(1),
        portalRole: z.enum(["admin", "revendeur", "client"]),
      }),
      handler: async ({ userId, portalRole }, context) => {
        await requireAdmin(context);
        const { env } = await import("cloudflare:workers");
        const { changerType } = await import("../lib/portail/utilisateurs");
        await changerType(env.PORTAL_DB, userId, portalRole);
        return { ok: true as const };
      },
    }),

    revoquer: defineAction({
      accept: "form",
      input: z.object({ userId: z.string().min(1) }),
      handler: async ({ userId }, context) => {
        await requireAdmin(context);
        const { env } = await import("cloudflare:workers");
        const { lireSession } = await import("../lib/auth/session");
        const { revoquer } = await import("../lib/portail/utilisateurs");

        /* Se révoquer soi-même ferme la porte de l'intérieur : plus personne
           ne peut ouvrir de compte, l'inscription publique étant verrouillée. */
        const { user } = await lireSession(context);
        if (user?.id === userId) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "On ne révoque pas son propre compte.",
          });
        }

        await revoquer(env.PORTAL_DB, userId);
        return { ok: true as const };
      },
    }),
  },
};
