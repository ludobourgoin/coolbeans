export interface Logo {
  src: string;
  alt: string;
  /** afficher le nom à côté du pictogramme */
  label?: string;
  /** logo monochrome encre → inversé en dark mode */
  invert?: boolean;
}

/** Stack orchestrée au quotidien — bande "proof" (ligne 1). */
export const proofPrimary: Logo[] = [
  { src: "/img/logos/webflow.svg", alt: "webflow" },
  { src: "/img/logos/astro.svg", alt: "astro", invert: true },
  { src: "/img/logos/shopify.svg", alt: "shopify", label: "shopify" },
  { src: "/img/logos/sanity.svg", alt: "sanity" },
  { src: "/img/logos/make.svg", alt: "make", label: "make" },
  { src: "/img/logos/zapier.svg", alt: "zapier" },
  { src: "/img/logos/figma.svg", alt: "figma", label: "figma" },
];

/** Stack data / ops — bande "proof" (ligne 2, sens inverse). */
export const proofSecondary: Logo[] = [
  { src: "/img/logos/notion.svg", alt: "notion", invert: true },
  { src: "/img/logos/airtable.svg", alt: "airtable", label: "airtable" },
  { src: "/img/logos/hubspot.svg", alt: "hubspot" },
  { src: "/img/logos/google-analytics.svg", alt: "ga4", label: "ga4" },
  { src: "/img/logos/slack-icon.svg", alt: "slack" },
  { src: "/img/logos/github.svg", alt: "github", invert: true },
  { src: "/img/logos/cloudflare-icon.svg", alt: "cloudflare" },
];
