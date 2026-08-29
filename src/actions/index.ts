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
};
