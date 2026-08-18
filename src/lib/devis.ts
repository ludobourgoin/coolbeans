import type { CollectionEntry } from "astro:content";

export type DevisData = CollectionEntry<"devis">["data"];
export type DevisBudget = NonNullable<DevisData["sections"][number]["budget"]>;

export type ListeItem = { texte: string; tooltip?: string };

export const listeItem = (item: string | ListeItem): ListeItem =>
  typeof item === "string" ? { texte: item } : item;

/* seul enrichissement autorisé dans les chaînes du YAML : **gras** */
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/* Colle les unités à leur nombre. Sans ça « 150 € » se coupe en fin de ligne
   et laisse l'euro seul au début de la suivante, la faute typographique la
   plus visible sur un document commercial. Traité ici plutôt que dans chaque
   YAML : les devis sont écrits à la main, personne ne saisit d'insécable.
   U+00A0 pour l'euro et le pourcentage, comme le fait Intl.NumberFormat. */
const insecables = (s: string) =>
  s
    /* Deux passes : `\b` ne peut pas suivre « € » ni « % », qui ne sont pas des
       caractères de mot. Les mêler aux unités écrites en toutes lettres faisait
       échouer la règle sur « 150 €. » sans que rien ne le signale. */
    .replace(/(\d)\s+([€%])/g, "$1\u00a0$2")
    .replace(/(\d)\s+(jours?|semaines?|mois|pts?)\b/g, "$1\u00a0$2")
    /* Ponctuation double française : espace fine insécable avant. */
    .replace(/\s+([;:!?])/g, "\u202f$1");

export const riche = (s: string) =>
  insecables(esc(s)).replace(/\*\*(.+?)\*\*/g, '<b class="font-bold">$1</b>');

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

/* qui porte chaque jalon du planning, en clair ; le contact client varie
   selon le devis, "Ludo" reste fixe côté Coolbeans. */
export const OWNER_DOT = { coolbeans: "bg-ink", client: "bg-info" } as const;

/* Le badge porte la couleur : sur un planning, « qui fait quoi » doit se lire
   en diagonale, sans relire chaque ligne. Ludo en encre, le client en info. */
export const OWNER_BADGE = {
  coolbeans: "bg-surface-raise text-ink",
  client: "bg-info/10 text-info",
} as const;

export const ownerLabel = (d: DevisData, owner: "coolbeans" | "client") =>
  owner === "coolbeans" ? "Ludo" : (d.contact ?? "Client");
