export interface Case {
  num: string;
  tag: string;
  title: string;
  /** classe de placement dans la grille : "span-8", "span-4 tall", … */
  span: string;
  /** domaine affiché dans la barre d'adresse. Absent = « domaine à confirmer ». */
  url?: string;
  /** chemin de la capture sous /public. Absent = état vide. */
  shot?: string;
}

export const cases: Case[] = [
  {
    span: "span-8",
    num: "№ 040",
    tag: "Amusoire : homepage",
    title: "Refonte du site d'un acteur parisien de l'entertain tech",
  },
  {
    span: "span-4 tall",
    num: "№ 039",
    tag: "Littlebox : produit",
    title: "Boutique en ligne d'une marque lifestyle",
  },
  {
    span: "span-6",
    num: "№ 038",
    tag: "Unlockbreath : landing",
    title: "Plateforme d'une startup santé & bien-être",
  },
  {
    span: "span-6",
    num: "№ 037",
    tag: "Tielle & popcorn : ciné-club",
    title: "Site d'un ciné-club associatif",
  },
];
