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
  { src: "/img/logos/webflow.svg", name: "Webflow" },
  { src: "/img/logos/astro-icon.svg", name: "Astro", mono: true },
  { src: "/img/logos/gsap-icon.svg", name: "GSAP" },
  { src: "/img/logos/shopify.svg", name: "Shopify" },
  { src: "/img/logos/sanity.svg", name: "Sanity" },
  { src: "/img/logos/make.svg", name: "Make" },
  { src: "/img/logos/zapier-icon.svg", name: "Zapier" },
  { src: "/img/logos/figma.svg", name: "Figma" },
];

/** Stack data / ops — ligne 2. */
export const proofSecondary: Logo[] = [
  { src: "/img/logos/notion.svg", name: "Notion", mono: true },
  { src: "/img/logos/airtable.svg", name: "Airtable" },
  { src: "/img/logos/hubspot.svg", name: "HubSpot" },
  { src: "/img/logos/google-analytics.svg", name: "GA4" },
  { src: "/img/logos/slack-icon.svg", name: "Slack" },
  { src: "/img/logos/github-icon.svg", name: "GitHub", mono: true },
  { src: "/img/logos/cloudflare-icon.svg", name: "Cloudflare" },
];
