/* Charge les documents des quatre collections sous la forme que lisent la
   frise et la vérification, et arrête le build si la nomenclature est
   incohérente. Non testé sous Vitest, où `astro:content` est indisponible :
   toute la logique vit dans projet.ts et frise.ts. COO-295 ajoutera ici la
   collection `audit`. */
import { getCollection } from "astro:content";
import type { CollectionDocument } from "./etapes";
import { verifierNomenclature, type DocumentProjet } from "./projet";

const COLLECTIONS: CollectionDocument[] = ["cadrage", "devis", "livrable", "temoignage"];

export async function chargerDocuments(): Promise<DocumentProjet[]> {
  const parCollection = await Promise.all(
    COLLECTIONS.map(async (collection) =>
      (await getCollection(collection)).map(
        (e): DocumentProjet => ({
          collection,
          id: e.id,
          statut: e.data.statut,
          etape: e.data.etape,
          projet: e.data.projet,
          titreProjet: e.data.linear?.projet,
          versionDe: "versionDe" in e.data ? e.data.versionDe : undefined,
        }),
      ),
    ),
  );
  const documents = parCollection.flat();
  const erreurs = verifierNomenclature(documents);
  if (erreurs.length > 0) {
    throw new Error(`Nomenclature des documents client incohérente :\n- ${erreurs.join("\n- ")}`);
  }
  return documents;
}
