/* Les devis et factures d'un projet : des PDF rangés dans R2 sous
   pieces/<workspace>/<identifiant du projet Linear>/<nom>.pdf. Ludo dépose
   les PDF dans a-classer/, Claude les range là (doc 04-portail). Le nom du
   fichier sert de libellé : rien d'autre n'est stocké. */

export interface PieceAffichee {
  libelle: string;
  href: string;
}

export const prefixeDuProjet = (workspace: string, slugId: string) => `pieces/${workspace}/${slugId}/`;

/** Les PDF d'un dossier de projet, nommés par leur fichier, triés par nom. */
export function piecesDuDossier(cles: readonly string[]): PieceAffichee[] {
  return cles
    .filter((cle) => /\.pdf$/i.test(cle))
    .map((cle) => ({
      libelle: (cle.split("/").pop() ?? "").replace(/\.pdf$/i, ""),
      href: `/api/pieces/${cle.replace(/^pieces\//, "").split("/").map(encodeURIComponent).join("/")}`,
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { numeric: true }));
}

/** Une pièce s'ouvre pour le client du workspace qu'elle désigne, dans la
    portée de son compte. Le chemin vient de l'URL : trois segments,
    workspace, projet et fichier PDF, sans détour par « .. ». */
export function pieceLisible(chemin: string, clientCourant: string | null, portee: readonly string[]): boolean {
  const segments = chemin.split("/");
  if (segments.length !== 3 || segments.some((s) => !s || s === "." || s === "..")) return false;
  const [workspace, , fichier] = segments;
  return Boolean(clientCourant) && workspace === clientCourant && portee.includes(workspace) && /\.pdf$/i.test(fichier);
}

/** Ouverture dans le navigateur, nom de fichier encodé selon la RFC 8187. */
export function dispositionInline(fichier: string): string {
  const encode = encodeURIComponent(fichier).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename*=UTF-8''${encode}`;
}
