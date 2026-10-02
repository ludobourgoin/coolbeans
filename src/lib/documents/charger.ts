/* Charge les documents des quatre collections sous la forme que lisent la
   frise et la vérification, et arrête le build si la nomenclature est
   incohérente. Non testé sous Vitest, où `astro:content` est indisponible :
   toute la logique vit dans projet.ts et frise.ts. COO-295 ajoutera ici la
   collection `audit`. Il vérifie aussi les clés des fiches client, qui
   relient un workspace à ses documents, et l'unicité des raisons sociales,
   qui relient une pièce Tiime à sa fiche. Il vérifie enfin que chaque
   document résout un pronom (spec 2026-10-02). */
import { getCollection } from "astro:content";
import { verifierRaisonsSociales } from "../pieces/raisons-sociales";
import type { CollectionDocument } from "./etapes";
import { verifierCles, verifierLiensLinear } from "./nomenclature";
import { verifierPronoms } from "./pronom";
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
          tutoiement: e.data.tutoiement,
          date: e.data.date,
        }),
      ),
    ),
  );
  const documents = parCollection.flat();
  const fichesClients = await getCollection("clients");
  const fichesOrganisations = await getCollection("organisations");
  const fiches = fichesClients.map((e) => ({
    slug: e.id,
    cle: e.data.cle,
    organisation: e.data.organisation,
    tutoiement: e.data.tutoiement,
  }));
  const organisations = fichesOrganisations.map((e) => ({
    slug: e.id,
    tutoiement: e.data.tutoiement,
  }));
  const raisons = [
    ...fichesClients.map((e) => ({ chemin: `clients/${e.id}`, raisonsSociales: e.data.raisonsSociales })),
    ...fichesOrganisations.map((e) => ({ chemin: `organisations/${e.id}`, raisonsSociales: e.data.raisonsSociales })),
  ];
  const erreurs = [
    ...verifierNomenclature(documents),
    ...verifierCles(fiches),
    ...verifierLiensLinear(),
    ...verifierRaisonsSociales(raisons),
    ...verifierPronoms({ documents, fiches, organisations }),
  ];
  if (erreurs.length > 0) {
    throw new Error(`Nomenclature des documents client incohérente :\n- ${erreurs.join("\n- ")}`);
  }
  return documents;
}
