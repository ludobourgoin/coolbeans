// Choix du picto d'un document, depuis son MIME.
//
// Fonction pure, sans accès réseau ni base : c'est ce qui la rend testable
// seule et c'est la raison pour laquelle la famille n'est pas une colonne de
// la table. Le jour où un format s'ajoute, on modifie cette fonction et les
// lignes déjà en base en profitent.
//
// Arbitrage du 2026-09-22 : un document du portail est TOUJOURS un fichier
// déposé. Les documents qui suivent le cycle de vie d'un projet se listent
// depuis les collections de contenu, et les liens externes (Google Docs,
// Granola) ne sont plus acceptés. D'où la disparition des familles `page`,
// `lien`, `google-docs` et `granola`, et de la lecture de l'hôte qui les
// départageait.

export type FamilleDocument = "pdf" | "image" | "archive";

export function familleDocument(mime: string | null | undefined): FamilleDocument {
  const type = (mime ?? "").toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  /* Tout le reste se télécharge au lieu de s'ouvrir, et un seul picto suffit à
     le dire. La liste des MIME d'archive qui vivait ici n'ajoutait rien : sa
     branche et le cas par défaut rendaient déjà la même famille. */
  return "archive";
}
