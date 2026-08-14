// Résolution des pages de doc d'un client — partagée entre la route
// /docs/[client]/[...slug].astro et la sidebar du portail (COO-80), pour que
// les deux listent exactement les mêmes pages dans le même ordre.

import type { CollectionEntry } from "astro:content";

export type DocEntry = CollectionEntry<"docs">;

/** `02-edition.mdx` → `edition` : le préfixe numérique ordonne, le slug non. */
export const slugOf = (e: DocEntry): string => e.id.split("/").pop()!.replace(/^\d+-/, "");

export const hrefOf = (e: DocEntry): string => `/docs/${e.data.client}/${slugOf(e)}`;

/** Pages de doc d'un client, triées par `order`. `[]` sans slug de doc. */
export async function listDocEntries(docSlug: string | null | undefined): Promise<DocEntry[]> {
  if (!docSlug) return [];
  const { getCollection } = await import("astro:content");
  const entries = await getCollection("docs", (e: DocEntry) => e.data.client === docSlug);
  return entries.sort((a, b) => a.data.order - b.data.order);
}
