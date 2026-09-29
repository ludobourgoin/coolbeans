/* Ce que la liste des demandes montre de chaque fil, à la façon d'une boîte de
   réception : un extrait du dernier message et une date courte. Fonctions
   pures, testées sans D1. */

/** Extrait d'un corps markdown, ramené à une ligne de texte brut. */
export function extrait(corps: string | null | undefined, longueur = 140): string {
  if (!corps) return "";
  const texte = corps
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // liens : on garde le libellé
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/^-{3,}$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (texte.length <= longueur) return texte;
  const coupe = texte.slice(0, longueur);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > longueur * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const COMPLET = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "Europe/Paris",
});
const CLE = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ

/**
 * Date courte d'une ligne de boîte de réception : l'heure si c'est aujourd'hui,
 * le jour et le mois si c'est cette année, la date complète sinon. Toujours à
 * l'heure de Paris.
 */
export function dateCourte(iso: string, maintenant: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (CLE.format(d) === CLE.format(maintenant)) return HEURE.format(d);
  if (CLE.format(d).slice(0, 4) === CLE.format(maintenant).slice(0, 4)) return JOUR.format(d);
  return COMPLET.format(d);
}
