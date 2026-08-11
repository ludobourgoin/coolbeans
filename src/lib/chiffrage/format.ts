/* Formats d'affichage fr-FR partagés éditeur/pages. */
export const fmtEUR = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
export const fmtJ = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
