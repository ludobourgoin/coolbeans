import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import type { ActionAPIContext } from "astro:actions";
import { calculer } from "../lib/chiffrage/calc";
import { toDevis } from "../lib/chiffrage/toDevis";
import * as store from "../lib/chiffrage/store";
import { catalogueSchema, chiffrageSchema } from "../lib/chiffrage/schemas";
import type { Chiffrage } from "../lib/chiffrage/types";

/* Garde systématique : session Clerk + rôle admin (publicMetadata), même
   contrôle que les pages /espace/chiffrages. Une requête forgée sans le rôle
   est rejetée ici, indépendamment du middleware. */
async function requireAdmin(context: ActionAPIContext): Promise<void> {
  const user = await context.locals.currentUser();
  const role = ((user?.publicMetadata ?? {}) as { role?: string }).role;
  if (!user || role !== "admin") {
    throw new ActionError({ code: "FORBIDDEN", message: "Réservé à l'administrateur." });
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
};
