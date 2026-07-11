export interface Tool {
  name: string;
  desc: string;
  chips: string[];
  href: string;
  /** logo local ; null → fallback initiales */
  logo: string | null;
}

export interface ToolCategory {
  id: string;
  title: string;
  cards: Tool[];
}

/** Boîte à outils (page /tools) — extrait des pages livrées, logos rapatriés en local. */
export const toolCategories: ToolCategory[] = [
  {
    "id": "dev",
    "title": "développement",
    "cards": [
      {
        "name": "astro",
        "desc": "framework rendu statique + island hydration. 100/100 pagespeed par défaut.",
        "chips": [
          "framework",
          "stack ★"
        ],
        "href": "https://astro.build",
        "logo": "/img/logos/astro.svg"
      },
      {
        "name": "vs code",
        "desc": "éditeur principal. extensions astro, eslint, github copilot, biome. dotfiles versionnés.",
        "chips": [
          "éditeur",
          "stack ★"
        ],
        "href": "https://code.visualstudio.com",
        "logo": "/img/logos/visual-studio-code.svg"
      },
      {
        "name": "github",
        "desc": "repos privés des clients, ci/cd, actions de déploiement vers cloudflare.",
        "chips": [
          "git",
          "ci/cd"
        ],
        "href": "https://github.com",
        "logo": "/img/logos/github.svg"
      },
      {
        "name": "claude code",
        "desc": "agent terminal pour pair-coding. refactors, tests, scripts de migration. un vrai game changer !",
        "chips": [
          "ai coding",
          "stack ★"
        ],
        "href": "https://www.anthropic.com/claude-code",
        "logo": "/img/logos/claude.svg"
      },
      {
        "name": "react",
        "desc": "librairie ui à composants pour les interfaces riches et les apps. en island astro ou en spa complète.",
        "chips": [
          "librairie",
          "stack ★"
        ],
        "href": "https://react.dev",
        "logo": null
      },
      {
        "name": "tailwind css",
        "desc": "css utility-first : styling rapide, cohérent et purgé à la compilation. zéro feuille de style qui dérive.",
        "chips": [
          "css",
          "stack ★"
        ],
        "href": "https://tailwindcss.com",
        "logo": null
      },
      {
        "name": "clerk",
        "desc": "authentification clé-en-main : connexion, sso, gestion des utilisateurs et sessions. mon défaut pour les apps clientes.",
        "chips": [
          "auth",
          "stack ★"
        ],
        "href": "https://clerk.com",
        "logo": null
      }
    ]
  },
  {
    "id": "cms",
    "title": "cms et no-code",
    "cards": [
      {
        "name": "sanity studio",
        "desc": "cms structuré, customisable, avec un studio react. mon cms par défaut pour tous les projets ≥ standard.",
        "chips": [
          "cms",
          "stack ★"
        ],
        "href": "https://www.sanity.io/studio",
        "logo": "/img/logos/sanity.svg"
      },
      {
        "name": "webflow",
        "desc": "site builder visuel pour les projets vitrine sans cms structuré, ou repris d'un client existant.",
        "chips": [
          "cms",
          "no-code"
        ],
        "href": "https://webflow.com",
        "logo": "/img/logos/webflow.svg"
      },
      {
        "name": "shopify",
        "desc": "plateforme e-commerce pour les boutiques clientes. thèmes custom et checkout intégré.",
        "chips": [
          "e-commerce",
          "cms"
        ],
        "href": "https://www.shopify.com",
        "logo": "/img/logos/shopify.svg"
      },
      {
        "name": "smootify",
        "desc": "connecte webflow et shopify : conçois des boutiques shopify headless directement dans webflow, sans une ligne de code.",
        "chips": [
          "e-commerce",
          "no-code"
        ],
        "href": "https://www.smootify.io",
        "logo": null
      },
      {
        "name": "airtable",
        "desc": "base flexible : crm léger, suivi de contenu et back-office de projets clients.",
        "chips": [
          "base",
          "no-code"
        ],
        "href": "https://www.airtable.com",
        "logo": "/img/logos/airtable.svg"
      }
    ]
  },
  {
    "id": "automation",
    "title": "automatisation",
    "cards": [
      {
        "name": "make",
        "desc": "scénarios d'automatisation visuels entre outils. la colonne vertébrale des workflows clients.",
        "chips": [
          "automatisation",
          "no-code",
          "stack ★"
        ],
        "href": "https://www.make.com",
        "logo": "/img/logos/make.svg"
      },
      {
        "name": "n8n",
        "desc": "automatisation self-hosted, plus technique et sans limite d'opérations. pour les workflows sensibles.",
        "chips": [
          "automatisation",
          "self-hosted"
        ],
        "href": "https://n8n.io",
        "logo": "/img/logos/n8n.svg"
      },
      {
        "name": "zapier",
        "desc": "connexions rapides entre saas pour les automatisations simples et les prototypes.",
        "chips": [
          "automatisation",
          "saas"
        ],
        "href": "https://zapier.com",
        "logo": "/img/logos/zapier.svg"
      }
    ]
  },
  {
    "id": "hosting",
    "title": "hébergement & déploiement",
    "cards": [
      {
        "name": "cloudflare pages",
        "desc": "hébergement edge gratuit pour 95 % des projets. workers + d1 pour la partie dynamique. ~10 €/mois max.",
        "chips": [
          "hosting",
          "edge",
          "stack ★"
        ],
        "href": "https://pages.cloudflare.com",
        "logo": null
      },
      {
        "name": "supabase",
        "desc": "backend postgres managé : base de données, auth et storage pour les apps clientes.",
        "chips": [
          "backend",
          "db"
        ],
        "href": "https://supabase.com",
        "logo": "/img/logos/supabase-icon.svg"
      },
      {
        "name": "cloudflare d1",
        "desc": "base sqlite serverless sur l'edge cloudflare. la partie dynamique de mes sites astro.",
        "chips": [
          "db",
          "edge",
          "stack ★"
        ],
        "href": "https://www.cloudflare.com/developer-platform/d1/",
        "logo": null
      },
      {
        "name": "netlify",
        "desc": "utilisé sur les vieux projets webflow et quand le client veut un cms intégré simple. déploiement via webhook.",
        "chips": [
          "hosting",
          "legacy"
        ],
        "href": "https://www.netlify.com",
        "logo": "/img/logos/netlify-icon.svg"
      }
    ]
  },
  {
    "id": "design",
    "title": "design",
    "cards": [
      {
        "name": "figma",
        "desc": "quand le client a un designer ou m'envoie ses maquettes. lecture seule la plupart du temps.",
        "chips": [
          "design",
          "handoff"
        ],
        "href": "https://www.figma.com",
        "logo": "/img/logos/figma.svg"
      },
      {
        "name": "claude design",
        "desc": "prototypage hi-fi rapide à partir du design system coolbeans. le pont entre wireframes et intégration.",
        "chips": [
          "design",
          "prototype",
          "stack ★"
        ],
        "href": "https://claude.ai",
        "logo": "/img/logos/claude.svg"
      },
      {
        "name": "relume",
        "desc": "bibliothèques de composants + génération de sitemaps et wireframes pour webflow et figma.",
        "chips": [
          "design",
          "wireframe"
        ],
        "href": "https://www.relume.io/",
        "logo": "/img/relume-icon.png"
      }
    ]
  },
  {
    "id": "analytics",
    "title": "analyse & seo",
    "cards": [
      {
        "name": "cloudflare web analytics",
        "desc": "fallback gratuit pour les projets sans care plan. moins riche que plausible mais suffisant pour le suivi de base.",
        "chips": [
          "analytics"
        ],
        "href": "https://www.cloudflare.com/web-analytics/",
        "logo": null
      },
      {
        "name": "ahrefs",
        "desc": "audit seo technique, backlinks, suivi mot-clés. utilisé lors des phases d'audit en début de projet.",
        "chips": [
          "seo"
        ],
        "href": "https://ahrefs.com",
        "logo": null
      },
      {
        "name": "posthog",
        "desc": "product analytics, funnels et session replay pour comprendre l'usage réel des apps.",
        "chips": [
          "analytics",
          "product"
        ],
        "href": "https://posthog.com",
        "logo": "/img/logos/posthog.svg"
      },
      {
        "name": "sentry",
        "desc": "monitoring d'erreurs en production : stack traces, alertes et suivi des releases.",
        "chips": [
          "monitoring",
          "erreurs"
        ],
        "href": "https://sentry.io",
        "logo": "/img/logos/sentry-icon.svg"
      },
      {
        "name": "uptimerobot",
        "desc": "surveillance uptime et alertes downtime sur tous les sites clients en care plan.",
        "chips": [
          "monitoring",
          "uptime"
        ],
        "href": "https://uptimerobot.com",
        "logo": "/img/uptimerobot-icon.png"
      }
    ]
  },
  {
    "id": "email",
    "title": "email & crm",
    "cards": [
      {
        "name": "resend",
        "desc": "api email transactionnel pour les apps. forms de contact, magic links, notifications. dev-friendly.",
        "chips": [
          "email api"
        ],
        "href": "https://resend.com",
        "logo": "/img/logos/resend.svg"
      },
      {
        "name": "hubspot",
        "desc": "crm et marketing automation pour les clients qui centralisent prospection et contenu.",
        "chips": [
          "crm",
          "marketing"
        ],
        "href": "https://www.hubspot.com",
        "logo": "/img/logos/hubspot.svg"
      },
      {
        "name": "brevo",
        "desc": "emailing et marketing automation, alternative rgpd-friendly hébergée en europe.",
        "chips": [
          "email",
          "marketing"
        ],
        "href": "https://www.brevo.com",
        "logo": "/img/logos/brevo.svg"
      },
      {
        "name": "mailerlite",
        "desc": "newsletter et email transactionnel. utilisé sur la moitié des projets clients comme cms email léger.",
        "chips": [
          "email",
          "stack ★"
        ],
        "href": "https://www.mailerlite.com",
        "logo": "/img/mailerlite-icon.png"
      },
      {
        "name": "pipedrive",
        "desc": "crm commercial orienté pipeline : suivi des deals et relances en prospection active.",
        "chips": [
          "crm",
          "sales"
        ],
        "href": "https://www.pipedrive.com",
        "logo": "/img/pipedrive-icon.png"
      }
    ]
  },
  {
    "id": "payments",
    "title": "paiements & facturation",
    "cards": [
      {
        "name": "stripe",
        "desc": "paiement clients (acomptes, mensualités care plan), checkout sur les projets e-commerce.",
        "chips": [
          "paiement",
          "stack ★"
        ],
        "href": "https://stripe.com",
        "logo": "/img/logos/stripe.svg"
      },
      {
        "name": "snipcart",
        "desc": "panier & checkout à greffer sur n'importe quel site statique. boutiques légères sans refonte complète.",
        "chips": [
          "e-commerce",
          "checkout"
        ],
        "href": "https://snipcart.com/fr",
        "logo": null
      },
      {
        "name": "gocardless",
        "desc": "prélèvements sepa automatiques pour les abonnements care plan et mensualités. sans friction carte.",
        "chips": [
          "prélèvement",
          "récurrent"
        ],
        "href": "https://gocardless.com/fr-fr",
        "logo": null
      }
    ]
  },
  {
    "id": "productivity",
    "title": "productivité et communication",
    "cards": [
      {
        "name": "asana",
        "desc": "gestion de projet et suivi des tâches partagés avec les clients.",
        "chips": [
          "gestion",
          "projets"
        ],
        "href": "https://asana.com",
        "logo": null
      },
      {
        "name": "google workspace",
        "desc": "mail pro, drive, meet. domaine coolbeans.cc. inchangé depuis 2022.",
        "chips": [
          "mail",
          "drive"
        ],
        "href": "https://workspace.google.com",
        "logo": null
      },
      {
        "name": "slack",
        "desc": "canaux clients lors des projets en cours. archivé à la livraison, transition vers email + portail care plan.",
        "chips": [
          "chat"
        ],
        "href": "https://slack.com",
        "logo": "/img/logos/slack-icon.svg"
      },
      {
        "name": "1password",
        "desc": "passwords, secrets, ssh keys, env files. partage de creds avec les clients via vaults dédiés.",
        "chips": [
          "sécurité"
        ],
        "href": "https://1password.com",
        "logo": null
      },
      {
        "name": "obsidian",
        "desc": "base de connaissance markdown locale : notes techniques, snippets, second cerveau hors-ligne.",
        "chips": [
          "notes",
          "markdown"
        ],
        "href": "https://obsidian.md",
        "logo": null
      },
      {
        "name": "cleanshot pro",
        "desc": "app mac pour les captures d'écran et screencasts. annotations propres, partagées aux clients tous les jours.",
        "chips": [
          "captures",
          "macos"
        ],
        "href": "https://cleanshot.com",
        "logo": "/img/cleanshot-icon.png"
      },
      {
        "name": "notion",
        "desc": "brouillons, briefs, base de connaissance projets. parfois exporté comme cms léger pour les clients.",
        "chips": [
          "docs",
          "brief"
        ],
        "href": "https://www.notion.so",
        "logo": "/img/logos/notion.svg"
      },
      {
        "name": "granola",
        "desc": "prise de notes ia en réunion client. transcrit, résume et ressort les action items sans bot dans l'appel.",
        "chips": [
          "notes ia",
          "réunions"
        ],
        "href": "https://www.granola.ai",
        "logo": null
      }
    ]
  },
  {
    "id": "workstation",
    "title": "poste de travail",
    "cards": [
      {
        "name": "macbook air 15\"",
        "desc": "m4 · 24 go · 512 go. silencieux, sans ventilateur, autonomie incroyable. increvable.",
        "chips": [
          "laptop",
          "apple"
        ],
        "href": "https://www.apple.com/macbook-air/",
        "logo": null
      },
      {
        "name": "nuphy air75",
        "desc": "clavier mécanique bas profil, bluetooth + usb-c. layout 75 %, switches bien cliquetants — désolé pour l'open space.",
        "chips": [
          "clavier",
          "mécanique"
        ],
        "href": "https://nuphy.com",
        "logo": null
      },
      {
        "name": "dell 27 plus 4k s2725qc",
        "desc": "écran 4k usb-c avec hub thunderbolt intégré. doc et previews côte à côte.",
        "chips": [
          "écran",
          "4k"
        ],
        "href": "https://www.dell.com",
        "logo": null
      },
      {
        "name": "dell u2415b",
        "desc": "écran d'appoint 24\" : logs, terminal et slack pendant le dev. recyclé, increvable.",
        "chips": [
          "écran",
          "portrait"
        ],
        "href": "https://www.dell.com",
        "logo": null
      },
      {
        "name": "iphone 12 mini",
        "desc": "tests mobile réels : captures d'écran et recette responsive sur petit écran.",
        "chips": [
          "mobile"
        ],
        "href": "https://www.apple.com/iphone/",
        "logo": null
      }
    ]
  },
  {
    "id": "audio",
    "title": "audio & vidéo",
    "cards": [
      {
        "name": "airpods pro 2026",
        "desc": "écouteurs du quotidien : calls en déplacement et réduction de bruit pour le deep work.",
        "chips": [
          "audio"
        ],
        "href": "https://www.apple.com/airpods-pro/",
        "logo": null
      },
      {
        "name": "dji mic mini",
        "desc": "micro-cravate sans fil pour les tournages et démos vidéo sur le terrain.",
        "chips": [
          "micro",
          "vidéo"
        ],
        "href": "https://www.dji.com",
        "logo": null
      },
      {
        "name": "blue yeti",
        "desc": "micro usb d'appoint pour les enregistrements voix et les sessions podcast.",
        "chips": [
          "micro",
          "audio"
        ],
        "href": "https://www.logitechg.com",
        "logo": null
      },
      {
        "name": "dell pro webcam wb5023",
        "desc": "webcam 2k pour les calls clients et démos vidéo. cadrage net et stable, fixée en haut de l'écran.",
        "chips": [
          "caméra",
          "vidéo"
        ],
        "href": "https://www.dell.com",
        "logo": null
      }
    ]
  }
];
