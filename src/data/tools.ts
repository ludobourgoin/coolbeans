export interface Tool {
  name: string;
  desc: string;
  chips: string[];
  href: string;
  /**
   * Icône carrée locale, obligatoire. Source : le favicon du site officiel
   * (`/img/tools/`), qui a l'avantage d'être déjà pensé comme une icône d'app
   * — cadrage carré et marges internes. Voir public/img/tools/README.md.
   */
  logo: string;
}

/** Segment de la boîte à outils : le logiciel d'un côté, le matériel de l'autre. */
export type ToolGroup = "software" | "hardware";

export interface ToolCategory {
  id: string;
  group: ToolGroup;
  title: string;
  cards: Tool[];
}

/** Boîte à outils (page /tools). Icônes rapatriées en local, aucune requête réseau au runtime. */
export const toolCategories: ToolCategory[] = [
  {
    "id": "dev",
    "group": "software",
    "title": "Développement",
    "cards": [
      {
        "name": "Astro",
        "desc": "Framework rendu statique + island hydration. 100/100 PageSpeed par défaut.",
        "chips": [
          "Framework"
        ],
        "href": "https://astro.build",
        "logo": "/img/tools/astro.svg"
      },
      {
        "name": "VS Code",
        "desc": "Éditeur principal. Extensions Astro, ESLint, GitHub Copilot, Biome. Dotfiles versionnés.",
        "chips": [
          "Éditeur"
        ],
        "href": "https://code.visualstudio.com",
        "logo": "/img/tools/vs-code.png"
      },
      {
        "name": "GitHub",
        "desc": "Repos privés des clients, CI/CD, actions de déploiement vers Cloudflare.",
        "chips": [
          "Git",
          "CI/CD"
        ],
        "href": "https://github.com",
        "logo": "/img/tools/github.svg"
      },
      {
        "name": "Claude Code",
        "desc": "Agent terminal pour pair-coding. Refactors, tests, scripts de migration. Un vrai game changer !",
        "chips": [
          "AI coding"
        ],
        "href": "https://www.anthropic.com/claude-code",
        "logo": "/img/tools/claude.png"
      },
      {
        "name": "GSAP",
        "desc": "Librairie d'animation web. Transitions, scroll-triggered, timelines. Entièrement gratuite depuis le rachat par Webflow.",
        "chips": [
          "Animation"
        ],
        "href": "https://gsap.com",
        "logo": "/img/tools/gsap.png"
      },
      {
        "name": "React",
        "desc": "Librairie UI à composants pour les interfaces riches et les apps. En island Astro ou en SPA complète.",
        "chips": [
          "Librairie"
        ],
        "href": "https://react.dev",
        "logo": "/img/tools/react.png"
      },
      {
        "name": "Tailwind CSS",
        "desc": "CSS utility-first : styling rapide, cohérent et purgé à la compilation. Zéro feuille de style qui dérive.",
        "chips": [
          "CSS"
        ],
        "href": "https://tailwindcss.com",
        "logo": "/img/tools/tailwind.png"
      },
      {
        "name": "Clerk",
        "desc": "Authentification clé-en-main : connexion, SSO, gestion des utilisateurs et sessions. Mon défaut pour les apps clientes.",
        "chips": [
          "Auth"
        ],
        "href": "https://clerk.com",
        "logo": "/img/tools/clerk.svg"
      }
    ]
  },
  {
    "id": "cms",
    "group": "software",
    "title": "CMS et no-code",
    "cards": [
      {
        "name": "Sanity Studio",
        "desc": "CMS structuré, customisable, avec un studio React. Mon CMS par défaut pour tous les projets ≥ standard.",
        "chips": [
          "CMS"
        ],
        "href": "https://www.sanity.io/studio",
        "logo": "/img/tools/sanity.png"
      },
      {
        "name": "Webflow",
        "desc": "Site builder visuel pour les projets vitrine sans CMS structuré, ou repris d'un client existant.",
        "chips": [
          "CMS",
          "No-code"
        ],
        "href": "https://webflow.com",
        "logo": "/img/tools/webflow.png"
      },
      {
        "name": "Shopify",
        "desc": "Plateforme e-commerce pour les boutiques clientes. Thèmes custom et checkout intégré.",
        "chips": [
          "E-commerce",
          "CMS"
        ],
        "href": "https://www.shopify.com",
        "logo": "/img/tools/shopify.png"
      },
      {
        "name": "Smootify",
        "desc": "Connecte Webflow et Shopify : conçois des boutiques Shopify headless directement dans Webflow, sans une ligne de code.",
        "chips": [
          "E-commerce",
          "No-code"
        ],
        "href": "https://www.smootify.io",
        "logo": "/img/tools/smootify.png"
      },
      {
        "name": "Airtable",
        "desc": "Base flexible : CRM léger, suivi de contenu et back-office de projets clients.",
        "chips": [
          "Base",
          "No-code"
        ],
        "href": "https://www.airtable.com",
        "logo": "/img/logos/airtable.svg"
      }
    ]
  },
  {
    "id": "automation",
    "group": "software",
    "title": "Automatisation",
    "cards": [
      {
        "name": "Make",
        "desc": "Scénarios d'automatisation visuels entre outils. La colonne vertébrale des workflows clients.",
        "chips": [
          "Automatisation",
          "No-code"
        ],
        "href": "https://www.make.com",
        "logo": "/img/tools/make.png"
      },
      {
        "name": "n8n",
        "desc": "Automatisation self-hosted, plus technique et sans limite d'opérations. Pour les workflows sensibles.",
        "chips": [
          "Automatisation",
          "Self-hosted"
        ],
        "href": "https://n8n.io",
        "logo": "/img/tools/n8n.png"
      },
      {
        "name": "Zapier",
        "desc": "Connexions rapides entre SaaS pour les automatisations simples et les prototypes.",
        "chips": [
          "Automatisation",
          "SaaS"
        ],
        "href": "https://zapier.com",
        "logo": "/img/tools/zapier.png"
      }
    ]
  },
  {
    "id": "hosting",
    "group": "software",
    "title": "Hébergement & déploiement",
    "cards": [
      {
        "name": "Cloudflare Pages",
        "desc": "Hébergement edge gratuit pour 95 % des projets. Workers + D1 pour la partie dynamique. ~10 €/mois max.",
        "chips": [
          "Hosting",
          "Edge"
        ],
        "href": "https://pages.cloudflare.com",
        "logo": "/img/tools/cloudflare.png"
      },
      {
        "name": "Supabase",
        "desc": "Backend Postgres managé : base de données, auth et storage pour les apps clientes.",
        "chips": [
          "Backend",
          "DB"
        ],
        "href": "https://supabase.com",
        "logo": "/img/tools/supabase.png"
      },
      {
        "name": "Cloudflare D1",
        "desc": "Base SQLite serverless sur l'edge Cloudflare. La partie dynamique de mes sites Astro.",
        "chips": [
          "DB",
          "Edge"
        ],
        "href": "https://www.cloudflare.com/developer-platform/d1/",
        "logo": "/img/tools/cloudflare.png"
      },
      {
        "name": "Netlify",
        "desc": "Utilisé sur les vieux projets Webflow et quand le client veut un CMS intégré simple. Déploiement via webhook.",
        "chips": [
          "Hosting",
          "Legacy"
        ],
        "href": "https://www.netlify.com",
        "logo": "/img/tools/netlify.png"
      }
    ]
  },
  {
    "id": "design",
    "group": "software",
    "title": "Design",
    "cards": [
      {
        "name": "Figma",
        "desc": "Quand le client a un designer ou m'envoie ses maquettes. Lecture seule la plupart du temps.",
        "chips": [
          "Design",
          "Handoff"
        ],
        "href": "https://www.figma.com",
        "logo": "/img/tools/figma.png"
      },
      {
        "name": "Claude design",
        "desc": "Prototypage hi-fi rapide à partir du design system coolbeans. Le pont entre wireframes et intégration.",
        "chips": [
          "Design",
          "Prototype"
        ],
        "href": "https://claude.ai",
        "logo": "/img/tools/claude.png"
      },
      {
        "name": "Relume",
        "desc": "Bibliothèques de composants + génération de sitemaps et wireframes pour Webflow et Figma.",
        "chips": [
          "Design",
          "Wireframe"
        ],
        "href": "https://www.relume.io/",
        "logo": "/img/tools/relume.png"
      }
    ]
  },
  {
    "id": "analytics",
    "group": "software",
    "title": "Analyse & SEO",
    "cards": [
      {
        "name": "Cloudflare Web Analytics",
        "desc": "Fallback gratuit pour les projets sans care plan. Moins riche que Plausible mais suffisant pour le suivi de base.",
        "chips": [
          "Analytics"
        ],
        "href": "https://www.cloudflare.com/web-analytics/",
        "logo": "/img/tools/cloudflare.png"
      },
      {
        "name": "Ahrefs",
        "desc": "Audit SEO technique, backlinks, suivi mot-clés. Utilisé lors des phases d'audit en début de projet.",
        "chips": [
          "SEO"
        ],
        "href": "https://ahrefs.com",
        "logo": "/img/tools/ahrefs.png"
      },
      {
        "name": "PostHog",
        "desc": "Product analytics, funnels et session replay pour comprendre l'usage réel des apps.",
        "chips": [
          "Analytics",
          "Product"
        ],
        "href": "https://posthog.com",
        "logo": "/img/tools/posthog.png"
      },
      {
        "name": "Sentry",
        "desc": "Monitoring d'erreurs en production : stack traces, alertes et suivi des releases.",
        "chips": [
          "Monitoring",
          "Erreurs"
        ],
        "href": "https://sentry.io",
        "logo": "/img/logos/sentry-icon.svg"
      },
      {
        "name": "UptimeRobot",
        "desc": "Surveillance uptime et alertes downtime sur tous les sites clients en care plan.",
        "chips": [
          "Monitoring",
          "Uptime"
        ],
        "href": "https://uptimerobot.com",
        "logo": "/img/tools/uptimerobot.png"
      }
    ]
  },
  {
    "id": "email",
    "group": "software",
    "title": "Email & CRM",
    "cards": [
      {
        "name": "Resend",
        "desc": "API email transactionnel pour les apps. Forms de contact, magic links, notifications. Dev-friendly.",
        "chips": [
          "Email API"
        ],
        "href": "https://resend.com",
        "logo": "/img/tools/resend.png"
      },
      {
        "name": "HubSpot",
        "desc": "CRM et marketing automation pour les clients qui centralisent prospection et contenu.",
        "chips": [
          "CRM",
          "Marketing"
        ],
        "href": "https://www.hubspot.com",
        "logo": "/img/tools/hubspot.png"
      },
      {
        "name": "Brevo",
        "desc": "Emailing et marketing automation, alternative RGPD-friendly hébergée en Europe.",
        "chips": [
          "Email",
          "Marketing"
        ],
        "href": "https://www.brevo.com",
        "logo": "/img/tools/brevo.svg"
      },
      {
        "name": "MailerLite",
        "desc": "Newsletter et email transactionnel. Utilisé sur la moitié des projets clients comme CMS email léger.",
        "chips": [
          "Email"
        ],
        "href": "https://www.mailerlite.com",
        "logo": "/img/tools/mailerlite.png"
      },
      {
        "name": "Pipedrive",
        "desc": "CRM commercial orienté pipeline : suivi des deals et relances en prospection active.",
        "chips": [
          "CRM",
          "Sales"
        ],
        "href": "https://www.pipedrive.com",
        "logo": "/img/tools/pipedrive.png"
      }
    ]
  },
  {
    "id": "payments",
    "group": "software",
    "title": "Paiements & facturation",
    "cards": [
      {
        "name": "Stripe",
        "desc": "Paiement clients (acomptes, mensualités care plan), checkout sur les projets e-commerce.",
        "chips": [
          "Paiement"
        ],
        "href": "https://stripe.com",
        "logo": "/img/tools/stripe.svg"
      },
      {
        "name": "Snipcart",
        "desc": "Panier & checkout à greffer sur n'importe quel site statique. Boutiques légères sans refonte complète.",
        "chips": [
          "E-commerce",
          "Checkout"
        ],
        "href": "https://snipcart.com/fr",
        "logo": "/img/tools/snipcart.png"
      },
      {
        "name": "GoCardless",
        "desc": "Prélèvements SEPA automatiques pour les abonnements care plan et mensualités. Sans friction carte.",
        "chips": [
          "Prélèvement",
          "Récurrent"
        ],
        "href": "https://gocardless.com/fr-fr",
        "logo": "/img/tools/gocardless.png"
      }
    ]
  },
  {
    "id": "productivity",
    "group": "software",
    "title": "Productivité et communication",
    "cards": [
      {
        "name": "Asana",
        "desc": "Gestion de projet et suivi des tâches partagés avec les clients.",
        "chips": [
          "Gestion",
          "Projets"
        ],
        "href": "https://asana.com",
        "logo": "/img/tools/asana.png"
      },
      {
        "name": "Google Workspace",
        "desc": "Mail pro, Drive, Meet. Domaine coolbeans.cc. Inchangé depuis 2022.",
        "chips": [
          "Mail",
          "Drive"
        ],
        "href": "https://workspace.google.com",
        "logo": "/img/tools/google-workspace.png"
      },
      {
        "name": "Slack",
        "desc": "Canaux clients lors des projets en cours. Archivé à la livraison, transition vers email + portail care plan.",
        "chips": [
          "Chat"
        ],
        "href": "https://slack.com",
        "logo": "/img/logos/slack-icon.svg"
      },
      {
        "name": "1Password",
        "desc": "Passwords, secrets, SSH keys, env files. Partage de creds avec les clients via vaults dédiés.",
        "chips": [
          "Sécurité"
        ],
        "href": "https://1password.com",
        "logo": "/img/tools/1password.png"
      },
      {
        "name": "Obsidian",
        "desc": "Base de connaissance Markdown locale : notes techniques, snippets, second cerveau hors-ligne.",
        "chips": [
          "Notes",
          "Markdown"
        ],
        "href": "https://obsidian.md",
        "logo": "/img/tools/obsidian.svg"
      },
      {
        "name": "CleanShot Pro",
        "desc": "App Mac pour les captures d'écran et screencasts. Annotations propres, partagées aux clients tous les jours.",
        "chips": [
          "Captures",
          "macOS"
        ],
        "href": "https://cleanshot.com",
        "logo": "/img/tools/cleanshot.png"
      },
      {
        "name": "Notion",
        "desc": "Brouillons, briefs, base de connaissance projets. Parfois exporté comme CMS léger pour les clients.",
        "chips": [
          "Docs",
          "Brief"
        ],
        "href": "https://www.notion.so",
        "logo": "/img/tools/notion.png"
      },
      {
        "name": "Granola",
        "desc": "Prise de notes IA en réunion client. Transcrit, résume et ressort les action items sans bot dans l'appel.",
        "chips": [
          "Notes IA",
          "Réunions"
        ],
        "href": "https://www.granola.ai",
        "logo": "/img/tools/granola.png"
      }
    ]
  },
  {
    "id": "workstation",
    "group": "hardware",
    "title": "Poste de travail",
    "cards": [
      {
        "name": "MacBook Air 15\"",
        "desc": "M4 · 24 Go · 512 Go. Silencieux, sans ventilateur, autonomie incroyable. Increvable.",
        "chips": [
          "Laptop",
          "Apple"
        ],
        "href": "https://www.apple.com/macbook-air/",
        "logo": "/img/tools/apple.png"
      },
      {
        "name": "NuPhy Air75",
        "desc": "Clavier mécanique bas profil, Bluetooth + USB-C. Layout 75 %, switches bien cliquetants, désolé pour l'open space.",
        "chips": [
          "Clavier",
          "Mécanique"
        ],
        "href": "https://nuphy.com/products/air75",
        "logo": "/img/tools/nuphy.png"
      },
      {
        "name": "Dell 27 Plus 4K S2725QC",
        "desc": "Écran 4K USB-C avec hub Thunderbolt intégré. Doc et previews côte à côte.",
        "chips": [
          "Écran",
          "4K"
        ],
        "href": "https://www.dell.com/en-us/shop/dell-27-plus-4k-usb-c-monitor-s2725qc/apd/210-brnc/monitors-monitor-accessories",
        "logo": "/img/tools/dell.png"
      },
      {
        "name": "Dell U2415B",
        "desc": "Écran d'appoint 24\" : logs, terminal et Slack pendant le dev. Recyclé, increvable.",
        "chips": [
          "Écran",
          "Portrait"
        ],
        "href": "https://www.dell.com/support/product-details/en-us/product/dell-u2415/overview",
        "logo": "/img/tools/dell.png"
      },
      {
        "name": "iPhone 17",
        "desc": "Tests mobile réels : captures d'écran et recette responsive sur iOS/Safari.",
        "chips": [
          "Mobile"
        ],
        "href": "https://www.apple.com/iphone-17/",
        "logo": "/img/tools/apple.png"
      }
    ]
  },
  {
    "id": "audio",
    "group": "hardware",
    "title": "Audio & vidéo",
    "cards": [
      {
        "name": "AirPods Pro 2026",
        "desc": "Écouteurs du quotidien : calls en déplacement et réduction de bruit pour le deep work.",
        "chips": [
          "Audio"
        ],
        "href": "https://www.apple.com/airpods-pro/",
        "logo": "/img/tools/apple.png"
      },
      {
        "name": "DJI Mic Mini",
        "desc": "Micro-cravate sans fil pour les tournages et démos vidéo sur le terrain.",
        "chips": [
          "Micro",
          "Vidéo"
        ],
        "href": "https://www.dji.com/mic-mini",
        "logo": "/img/tools/dji.png"
      },
      {
        "name": "Blue Yeti",
        "desc": "Micro USB d'appoint pour les enregistrements voix et les sessions podcast.",
        "chips": [
          "Micro",
          "Audio"
        ],
        "href": "https://www.logitechg.com/en-us/shop/p/yeti-premium-usb-microphone",
        "logo": "/img/tools/logitech-g.png"
      },
      {
        "name": "Dell Pro Webcam WB5023",
        "desc": "Webcam 2K pour les calls clients et démos vidéo. Cadrage net et stable, fixée en haut de l'écran.",
        "chips": [
          "Caméra",
          "Vidéo"
        ],
        "href": "https://www.dell.com/en-us/shop/dell-pro-webcam-wb5023/apd/319-bbjj/pc-accessories",
        "logo": "/img/tools/dell.png"
      }
    ]
  }
];
