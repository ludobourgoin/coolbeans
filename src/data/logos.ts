export interface Logo {
  /** pictogramme seul, jamais un lockup : le nom est rendu à côté, en Geomanist */
  src: string;
  name: string;
  /** picto monochrome encre → inversé en dark mode */
  mono?: boolean;
}

/**
 * Bande "proof" (/about). Règle unique : picto carré + nom de marque.
 * Pas de lockup en image (le nom serait en double), pas de picto muet.
 */

/** Stack orchestrée au quotidien — ligne 1. */
export const proofPrimary: Logo[] = [
  { src: "/img/logos/webflow.svg", name: "webflow" },
  { src: "/img/logos/astro-icon.svg", name: "astro", mono: true },
  { src: "/img/logos/gsap-icon.svg", name: "gsap" },
  { src: "/img/logos/shopify.svg", name: "shopify" },
  { src: "/img/logos/sanity.svg", name: "sanity" },
  { src: "/img/logos/make.svg", name: "make" },
  { src: "/img/logos/zapier-icon.svg", name: "zapier" },
  { src: "/img/logos/figma.svg", name: "figma" },
];

/** Stack data / ops — ligne 2. */
export const proofSecondary: Logo[] = [
  { src: "/img/logos/notion.svg", name: "notion", mono: true },
  { src: "/img/logos/airtable.svg", name: "airtable" },
  { src: "/img/logos/hubspot.svg", name: "hubspot" },
  { src: "/img/logos/google-analytics.svg", name: "ga4" },
  { src: "/img/logos/slack-icon.svg", name: "slack" },
  { src: "/img/logos/github-icon.svg", name: "github", mono: true },
  { src: "/img/logos/cloudflare-icon.svg", name: "cloudflare" },
];
