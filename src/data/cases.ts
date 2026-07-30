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
    tag: "amusoire : homepage",
    title: "refonte du site d'un acteur parisien de l'entertain tech",
  },
  {
    span: "span-4 tall",
    num: "№ 039",
    tag: "littlebox : produit",
    title: "boutique en ligne d'une marque lifestyle",
  },
  {
    span: "span-6",
    num: "№ 038",
    tag: "unlockbreath : landing",
    title: "plateforme d'une startup santé & bien-être",
  },
  {
    span: "span-6",
    num: "№ 037",
    tag: "tielle & popcorn : ciné-club",
    title: "site d'un ciné-club associatif",
  },
];
