// Choix du picto d'un document, depuis son MIME ou l'hôte de son URL.
//
// Fonction pure, sans accès réseau ni base : c'est ce qui la rend testable
// seule et c'est la raison pour laquelle la famille n'est pas une colonne de
// la table. Le jour où un service s'ajoute, on modifie cette fonction et les
// lignes déjà en base en profitent.
//
// Aucune favicon n'est chargée depuis un serveur tiers, ici ni au rendu. Deux
// raisons : cela signalerait à Google et à Granola quel client consulte quel
// document, et une icône manquante casserait la page le jour où le service
// change d'URL.

export type FamilleDocument =
  | "pdf"
  | "image"
  | "archive"
  | "google-docs"
  | "granola"
  | "page"
  | "lien";

export interface EntreeFamille {
  source: "fichier" | "page" | "lien";
  mime?: string | null;
  url?: string | null;
}

const MIMES_ARCHIVE = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-rar-compressed",
]);

/* Comparaison sur le suffixe d'hôte et jamais sur une inclusion de chaîne :
   `docs.google.com.exemple.net` ne doit pas passer pour Google Docs. */
function hoteEst(hote: string, domaine: string): boolean {
  return hote === domaine || hote.endsWith(`.${domaine}`);
}

export function familleDocument(entree: EntreeFamille): FamilleDocument {
  if (entree.source === "fichier") {
    const mime = (entree.mime ?? "").toLowerCase();
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("image/")) return "image";
    if (MIMES_ARCHIVE.has(mime)) return "archive";
    // Un fichier non reconnu reste un fichier : il se télécharge, il ne
    // s'ouvre pas. Le picto générique de lien mentirait sur ce qui va se
    // passer au clic.
    return "archive";
  }

  if (entree.source === "page") return "page";

  let hote = "";
  try {
    hote = new URL(entree.url ?? "").hostname.toLowerCase();
  } catch {
    // URL invalide : on ne devine pas, on retombe sur le picto neutre.
    return "lien";
  }

  if (hoteEst(hote, "docs.google.com") || hoteEst(hote, "drive.google.com")) return "google-docs";
  if (hoteEst(hote, "granola.ai") || hoteEst(hote, "granola.so")) return "granola";
  // Une page Coolbeans atteinte par un lien externe reste une page Coolbeans.
  if (hoteEst(hote, "coolbeans.cc")) return "page";
  return "lien";
}
