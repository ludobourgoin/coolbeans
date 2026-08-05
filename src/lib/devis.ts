import type { CollectionEntry } from "astro:content";

export type DevisData = CollectionEntry<"devis">["data"];
export type DevisBudget = NonNullable<DevisData["sections"][number]["budget"]>;

/* seul enrichissement autorisé dans les chaînes du YAML : **gras** */
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const riche = (s: string) =>
  esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="font-bold">$1</b>');

export const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/* id d'ancre stable à partir d'un titre de section */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* totaux dérivés des lignes chiffrées ; les lignes sans prix sont « Inclus » */
export const totaux = (budget: DevisBudget) => {
  const total = budget.lignes.reduce((somme, ligne) => somme + (ligne.prix ?? 0), 0);
  const remise = budget.remisePct ? (total * budget.remisePct) / 100 : 0;
  return { total, remise, totalFinal: total - remise, mention: budget.mention ?? "" };
};

export const dateLongue = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);

/* qui porte chaque jalon du planning, en clair */
export const OWNER_LABEL = { coolbeans: "Ludo", client: "Simon" } as const;
export const OWNER_DOT = { coolbeans: "bg-ink", client: "bg-info" } as const;
