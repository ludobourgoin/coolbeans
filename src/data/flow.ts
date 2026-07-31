export interface FlowIcon {
  src: string;
  tip: string;
}

export interface FlowBox {
  title: string;
  left: number;
  top: number;
  /** boîte flottante (contour tireté) vs connectée (plein) */
  float?: boolean;
  icons: FlowIcon[];
}

/**
 * Boîtes du « flux » hero — positions du canvas 1280×440 (reprises du wireframe).
 * Icônes rapatriées en local ; snipcart / gocardless / ahrefs non dispo → omis.
 */
export const flowBoxes: FlowBox[] = [
  // connectées (plein) — colonne centrale
  {
    title: "Design",
    left: 283,
    top: 38,
    icons: [
      { src: "/img/logos/figma.svg", tip: "figma" },
      { src: "/img/logos/claude.svg", tip: "claude design" },
      { src: "/img/relume-icon.png", tip: "relume" },
    ],
  },
  {
    title: "Développement",
    left: 283,
    top: 133,
    icons: [
      { src: "/img/logos/astro-icon.svg", tip: "astro" },
      { src: "/img/logos/visual-studio-code.svg", tip: "vs code" },
      { src: "/img/logos/github-icon.svg", tip: "github" },
      { src: "/img/logos/claude.svg", tip: "claude code" },
    ],
  },
  {
    title: "Hébergement & déploiement",
    left: 283,
    top: 228,
    icons: [
      { src: "/img/logos/cloudflare-icon.svg", tip: "cloudflare pages" },
      { src: "/img/logos/netlify-icon.svg", tip: "netlify" },
      { src: "/img/logos/supabase-icon.svg", tip: "supabase" },
    ],
  },
  {
    title: "Paiements & facturation",
    left: 283,
    top: 323,
    icons: [
      { src: "/img/logos/stripe.svg", tip: "stripe" },
      { src: "/img/logos/gocardless.svg", tip: "gocardless" },
      { src: "/img/logos/snipcart.png", tip: "snipcart" },
      { src: "/img/logos/pennylane.png", tip: "pennylane" },
    ],
  },
  // flottantes (tireté) — colonne gauche
  {
    title: "CMS & no-code",
    left: 80,
    top: 38,
    float: true,
    icons: [
      { src: "/img/logos/sanity.svg", tip: "sanity studio" },
      { src: "/img/logos/webflow.svg", tip: "webflow" },
      { src: "/img/logos/shopify.svg", tip: "shopify" },
      { src: "/img/logos/airtable.svg", tip: "airtable" },
    ],
  },
  {
    title: "Automatisation",
    left: 80,
    top: 133,
    float: true,
    icons: [
      { src: "/img/logos/make.svg", tip: "make" },
      { src: "/img/logos/n8n.svg", tip: "n8n" },
      { src: "/img/logos/zapier-icon.svg", tip: "zapier" },
    ],
  },
  {
    title: "Email & CRM",
    left: 80,
    top: 228,
    float: true,
    icons: [
      { src: "/img/mailerlite-icon.png", tip: "mailerlite" },
      { src: "/img/logos/resend.svg", tip: "resend" },
      { src: "/img/logos/hubspot.svg", tip: "hubspot" },
      { src: "/img/logos/brevo.svg", tip: "brevo" },
    ],
  },
  {
    title: "Analyse & SEO",
    left: 80,
    top: 323,
    float: true,
    icons: [
      { src: "/img/logos/posthog.svg", tip: "posthog" },
      { src: "/img/logos/sentry-icon.svg", tip: "sentry" },
      { src: "/img/uptimerobot-icon.png", tip: "uptimerobot" },
    ],
  },
];
