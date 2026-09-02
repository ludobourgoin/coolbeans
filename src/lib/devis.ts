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

/* Second enrichissement : [texte](url), pour les listes de références. Sans
   lui, une URL écrite dans un YAML s'affiche en texte mort et le client doit
   la recopier à la main. Restreint à http(s) — le YAML est écrit à la main,
   mais un devis est une page publique et `javascript:` n'a rien à y faire. */
const liens = (s: string) =>
  s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a class="link" href="$2" target="_blank" rel="noopener">$1</a>',
  );

export const riche = (s: string) =>
  liens(insecables(esc(s)).replace(/\*\*(.+?)\*\*/g, '<b class="font-bold">$1</b>'));

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

/* Ancre d'une section du devis. Toutes les versions d'un devis sont rendues
   dans le même document, une seule visible : sans préfixe, `id="budget"`
   existerait autant de fois qu'il y a de versions et un clic dans le
   sommaire sauterait vers la section homonyme de la V1, masquée. Un devis à
   version unique garde l'ancre nue, pour ne pas casser les liens partagés. */
export const ancreSection = (titre: string, version?: number) =>
  version === undefined ? slugify(titre) : `v${version}-${slugify(titre)}`;

/* Sélection d'options : les index, dans `budget.lignes`, des lignes `optionnel`
   que le client a cochées. `undefined` = personne n'a encore choisi, on retombe
   sur les `defaut` du YAML. Un index de ligne non optionnelle est ignoré : le
   socle ne se retire pas, même par une requête forgée. */
export type SelectionOptions = readonly number[] | undefined;

/** Index des options cochées à l'ouverture de la page. */
export const selectionDefaut = (budget: DevisBudget): number[] =>
  budget.lignes.flatMap((ligne, i) => (ligne.optionnel && ligne.defaut ? [i] : []));

/** Lignes réellement facturées : tout le socle, plus les options retenues. */
export const lignesRetenues = (budget: DevisBudget, selection?: SelectionOptions) =>
  budget.lignes.filter(
    (ligne, i) => !ligne.optionnel || (selection ? selection.includes(i) : ligne.defaut),
  );

/* Remises à appliquer, dans l'ordre. Normalise l'ancienne forme à remise
   unique vers la nouvelle : un seul chemin de calcul en aval, et les douze
   devis déjà publiés continuent de s'afficher à l'identique. */
export const remisesDe = (budget: DevisBudget): Array<{ label: string; pct: number }> =>
  budget.remises ??
  (budget.remisePct
    ? [{ label: budget.remiseLabel ?? "Remise exceptionnelle", pct: budget.remisePct }]
    : []);

/* Totaux dérivés des lignes retenues ; les lignes sans prix sont « Inclus ».
   Les remises s'enchaînent : chacune mord sur ce que la précédente a laissé,
   jamais sur le total brut. Deux remises de 25 % puis 10 % ne font donc pas
   35 % — et c'est le comportement voulu, c'est ainsi qu'un geste commercial se
   calcule après un barème. */
export const totaux = (budget: DevisBudget, selection?: SelectionOptions) => {
  const total = lignesRetenues(budget, selection).reduce(
    (somme, ligne) => somme + (ligne.prix ?? 0),
    0,
  );
  let restant = total;
  const paliers = remisesDe(budget).map(({ label, pct }) => {
    const montant = (restant * pct) / 100;
    restant -= montant;
    return { label, pct, montant };
  });
  return {
    total,
    paliers,
    remise: total - restant,
    totalFinal: restant,
    mention: budget.mention ?? "",
  };
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

/* Le budget d'un devis vit dans la première section qui en porte un. */
export const budgetDevis = (d: DevisData) => d.sections.find((s) => s.budget)?.budget;

/* Montant à afficher hors de la page de devis (cockpit, tâche de facturation).
   Un devis en construction n'a pas de total : afficher 0 € le ferait passer
   pour un devis gratuit. Un devis sans budget du tout non plus. */
export const montantAffiche = (d: DevisData): string => {
  const budget = budgetDevis(d);
  if (!budget) return "—";
  if (budget.enAttente) return "En construction";
  return eur.format(totaux(budget).totalFinal);
};

/* Valeur numérique du même montant, pour trier la colonne du cockpit. Les
   devis sans total chiffré valent -1 : ils se regroupent en bas du tri
   croissant plutôt que de se mêler aux devis à 0 €. */
export const montantTri = (d: DevisData): number => {
  const budget = budgetDevis(d);
  if (!budget || budget.enAttente) return -1;
  return totaux(budget).totalFinal;
};
