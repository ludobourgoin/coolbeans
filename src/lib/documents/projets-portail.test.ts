import { expect, test } from "vitest";
import { sectionsProjets } from "./projets-portail";
import type { DocumentProjet } from "./projet";

const doc = (p: Partial<DocumentProjet> & Pick<DocumentProjet, "collection" | "id">): DocumentProjet => ({
  statut: "publie",
  etape: "proposition",
  projet: "site-web-879",
  titreProjet: "Site web CAFA",
  date: new Date(2026, 8, 1),
  ...p,
});

const documents = [
  doc({ collection: "livrable", id: "cafa/site-web-8791", etape: "livraison", date: new Date(2026, 8, 17) }),
  doc({ collection: "devis", id: "cafa/site-web-8791" }),
  doc({ collection: "devis", id: "cafa/site-web-v2-4106", projet: undefined, versionDe: "cafa/site-web-8791" }),
  doc({ collection: "cadrage", id: "cafa/nom-de-domaine-9042", etape: "production", statut: "brouillon" }),
  doc({ collection: "devis", id: "unlockbreath/plateforme-3271", projet: "plateforme-327", titreProjet: "Plateforme UnlockBreath" }),
];

const publies = (d: DocumentProjet) => d.statut === "publie";

test("une section par projet du client, une entrée par document lisible, dans l'ordre de la frise", () => {
  expect(sectionsProjets(documents, "caf", publies)).toEqual([
    {
      projet: "site-web-879",
      titre: "Site web CAFA",
      entrees: [
        { label: "2 · Proposition", chemin: "/projets/site-web-879/proposition" },
        { label: "4 · Livraison", chemin: "/projets/site-web-879/livraison" },
      ],
    },
  ]);
});

test("un document que le compte ne lit pas n'a pas d'entrée", () => {
  const tout = sectionsProjets(documents, "caf", () => true);
  expect(tout[0].entrees.map((e) => e.label)).toEqual(["2 · Proposition", "3 · Production", "4 · Livraison"]);
});

test("un projet sans document lisible n'a pas de section", () => {
  expect(sectionsProjets(documents, "caf", () => false)).toEqual([]);
});

test("les projets se rangent du plus récent au plus ancien", () => {
  // Deux projets réels du client `set` dans la nomenclature.
  const set = [
    doc({ collection: "devis", id: "setencorpsmieux/site-internet-7402", projet: "refonte-740", titreProjet: "Refonte", date: new Date(2026, 6, 1) }),
    doc({ collection: "devis", id: "osmose/identite-et-site-2814", projet: "osmose-281", titreProjet: "Osmose", date: new Date(2026, 8, 3) }),
  ];
  expect(sectionsProjets(set, "set", publies).map((s) => s.projet)).toEqual(["osmose-281", "refonte-740"]);
});
