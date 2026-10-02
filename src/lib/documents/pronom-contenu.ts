/* Le pronom d'un document, résolu depuis les collections. Non testé sous
   Vitest, où astro:content est indisponible : la règle vit dans pronom.ts,
   et le build vérifie déjà que chaque document en résout un (charger.ts). */
import { getCollection } from "astro:content";
import type { CollectionDocument } from "./etapes";
import { ouVous, pronomDuDocument, type DocumentPronom, type Registres } from "./pronom";

async function registres(collection: CollectionDocument): Promise<Registres> {
  const [entrees, fiches, organisations] = await Promise.all([
    getCollection(collection),
    getCollection("clients"),
    getCollection("organisations"),
  ]);
  return {
    documents: entrees.map(
      (e): DocumentPronom => ({
        collection,
        id: e.id,
        projet: e.data.projet,
        versionDe: "versionDe" in e.data ? e.data.versionDe : undefined,
        tutoiement: e.data.tutoiement,
      }),
    ),
    fiches: fiches.map((e) => ({
      slug: e.id,
      cle: e.data.cle,
      organisation: e.data.organisation,
      tutoiement: e.data.tutoiement,
    })),
    organisations: organisations.map((e) => ({ slug: e.id, tutoiement: e.data.tutoiement })),
  };
}

/** `true` si le document tutoie son lecteur. */
export async function tutoiementDe(collection: CollectionDocument, id: string): Promise<boolean> {
  const r = await registres(collection);
  const doc = r.documents.find((d) => d.id === id);
  return ouVous(doc ? pronomDuDocument(doc, r) : undefined, `${collection}/${id}`) === "tu";
}
