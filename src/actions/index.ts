import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import type { ActionAPIContext } from "astro:actions";
import { calculer } from "../lib/chiffrage/calc";
import { toDevis } from "../lib/chiffrage/toDevis";
import * as store from "../lib/chiffrage/store";
import { catalogueSchema, chiffrageSchema } from "../lib/chiffrage/schemas";
import type { Chiffrage } from "../lib/chiffrage/types";
import { getClient } from "../lib/portail/clients";
import { CLIENT_COOKIE } from "../lib/portail/current-client";
import { requireAdmin as requireAdminGuard } from "../lib/portail/require-admin";

/* Garde systématique : session Clerk + rôle admin (publicMetadata), même
   contrôle que les pages /espace/chiffrages. Une requête forgée sans le rôle
   est rejetée ici, indépendamment du middleware.

   La vérification elle-même vit dans lib/portail/require-admin.ts, sans
   dépendance à `astro:actions` : ce module virtuel n'est pas résolvable sous
   Vitest (même contrainte que `astro:content`), et c'est cette garde que la
   spec exige de tester. Ici, on ne fait que convertir l'Error ordinaire
   qu'elle lève en ActionError. */
export async function requireAdmin(context: ActionAPIContext): Promise<void> {
  try {
    await requireAdminGuard(context.locals);
  } catch (err) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: err instanceof Error ? err.message : "Réservé à l'administrateur.",
    });
  }
}

const SLUG_STRICT = /^[a-z0-9-]+$/;

export const server = {
  chiffrages: {
    sauvegarder: defineAction({
      input: chiffrageSchema,
      handler: async (input, context) => {
        await requireAdmin(context);
        const c = { ...input } as Chiffrage;
        if (c.id) {
          const stored = await store.getChiffrage(c.id);
          if (!stored) throw new ActionError({ code: "NOT_FOUND", message: "Chiffrage introuvable." });
          // l'état de publication et les slugs publiés ne se réécrivent pas depuis le client
          c.publishedKey = stored.publishedKey;
          c.publishedVersions = stored.publishedVersions;
          if (stored.publishedVersions > 0) {
            c.clientSlug = stored.clientSlug;
            c.projetSlug = stored.projetSlug;
          }
        } else {
          c.id = await store.genererId();
          c.publishedKey = null;
          c.publishedVersions = 0;
        }
        await store.saveChiffrage(c as Chiffrage & { id: string });
        return c as Chiffrage & { id: string };
      },
    }),

    publier: defineAction({
      input: z.object({ id: z.string() }),
      handler: async ({ id }, context) => {
        await requireAdmin(context);
        const c = await store.getChiffrage(id);
        if (!c) throw new ActionError({ code: "NOT_FOUND", message: "Chiffrage introuvable." });
        if (c.mode !== "configurateur")
          throw new ActionError({ code: "BAD_REQUEST", message: "Le chiffrage libre ne se publie pas." });
        const manques = [
          !c.nom.trim() && "un nom de client/projet",
          !c.objectif.trim() && "l'objectif",
          !SLUG_STRICT.test(c.clientSlug) && "un slug client valide",
          !SLUG_STRICT.test(c.projetSlug) && "un slug projet valide",
          c.prixRetenu == null && "le prix retenu",
        ].filter((m): m is string => Boolean(m));
        if (manques.length)
          throw new ActionError({ code: "BAD_REQUEST", message: `Il manque ${manques.join(", ")}.` });

        const catalogue = await store.getCatalogue();
        const calc = calculer(c, catalogue);
        if (calc.totalJoursProduction <= 0)
          throw new ActionError({ code: "BAD_REQUEST", message: "Ajoute au moins une ligne de production." });

        const data = toDevis(c, catalogue, calc, new Date().toISOString());
        const { url, n } = await store.publierVersion(c as Chiffrage & { id: string }, data);
        c.publishedKey = store.cleDevis(c.clientSlug, c.projetSlug, c.id as string);
        c.publishedVersions = n;
        await store.saveChiffrage(c as Chiffrage & { id: string });
        return { url, version: n };
      },
    }),

    supprimer: defineAction({
      accept: "form",
      input: z.object({ id: z.string() }),
      handler: async ({ id }, context) => {
        await requireAdmin(context);
        await store.deleteChiffrage(id);
        return { ok: true as const };
      },
    }),
  },

  catalogue: {
    sauvegarder: defineAction({
      input: catalogueSchema,
      handler: async (input, context) => {
        await requireAdmin(context);
        await store.saveCatalogue(input);
        return { ok: true as const };
      },
    }),
  },

  portail: {
    /* Bascule l'admin d'un espace client à un autre. Le cookie posé ici est
       une préférence d'affichage : la résolution côté serveur l'ignore pour
       un non-admin, et cette action refuse de le poser. Deux barrières
       indépendantes plutôt qu'une. */
    choisirClient: defineAction({
      accept: "form",
      input: z.object({
        client: z.string().regex(SLUG_STRICT, "Slug invalide."),
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
        retour: z
          .string()
          .regex(/^\/(?![/\\])[^\x00-\x1f\x7f]*$/, "Chemin de retour invalide.")
          .default("/"),
      }),
      handler: async ({ client, retour }, context) => {
        await requireAdmin(context);

        const cible = await getClient(client);
        if (!cible) {
          throw new ActionError({ code: "NOT_FOUND", message: "Client inconnu." });
        }

        context.cookies.set(CLIENT_COOKIE, cible.slug, {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });

        return { client: cible.slug, retour };
      },
    }),
  },
};
