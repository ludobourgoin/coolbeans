/**
 * Hub Ressources du portail client (COO-37, page /espace/ressources).
 *
 * Liens externes recommandés aux clients — équipes marketing qui prennent la
 * main sur leur site au quotidien. Contenu statique, identique pour tous les
 * comptes, géré par Coolbeans ; aucune édition côté client.
 *
 * Distinct de src/data/tools.ts (boîte à outils du site public, orientée
 * stack Coolbeans) : ici, uniquement des outils utilisables sans nous.
 */
export interface Ressource {
  name: string;
  desc: string;
  href: string;
  /** Domaine affiché en kicker sur la carte, sans protocole ni chemin. */
  domain: string;
}

export interface RessourceCategorie {
  id: string;
  title: string;
  cards: Ressource[];
}

export const ressourceCategories: RessourceCategorie[] = [
  {
    id: "images",
    title: "Photos, icônes & illustrations",
    cards: [
      {
        name: "Unsplash",
        desc: "Des photos libres de droits, gratuites et de haute qualité, pour illustrer vos pages et vos articles.",
        href: "https://unsplash.com/fr",
        domain: "unsplash.com",
      },
      {
        name: "Pexels",
        desc: "Photos et vidéos gratuites et libres de droits, avec une recherche en français.",
        href: "https://www.pexels.com/fr-fr/",
        domain: "pexels.com",
      },
      {
        name: "Flaticon",
        desc: "Des millions d'icônes en SVG et PNG pour vos pages, présentations et réseaux sociaux.",
        href: "https://www.flaticon.com/fr/",
        domain: "flaticon.com",
      },
      {
        name: "The Noun Project",
        desc: "Des icônes sobres et cohérentes pour illustrer n'importe quel concept.",
        href: "https://thenounproject.com",
        domain: "thenounproject.com",
      },
      {
        name: "unDraw",
        desc: "Illustrations vectorielles gratuites, personnalisables aux couleurs de votre marque.",
        href: "https://undraw.co",
        domain: "undraw.co",
      },
    ],
  },
  {
    id: "medias",
    title: "Optimiser vos médias",
    cards: [
      {
        name: "iLoveIMG",
        desc: "Redimensionner, compresser ou convertir vos images en quelques clics, sans installer de logiciel.",
        href: "https://www.iloveimg.com/fr",
        domain: "iloveimg.com",
      },
      {
        name: "remove.bg",
        desc: "Supprimer le fond d'une image en une seconde — idéal pour les portraits et les visuels produit.",
        href: "https://www.remove.bg/fr",
        domain: "remove.bg",
      },
      {
        name: "Let's Enhance",
        desc: "Agrandir et améliorer une image trop petite ou floue grâce à l'IA.",
        href: "https://letsenhance.io",
        domain: "letsenhance.io",
      },
      {
        name: "iLovePDF",
        desc: "Compresser, fusionner, convertir et signer vos PDF en ligne.",
        href: "https://www.ilovepdf.com/fr",
        domain: "ilovepdf.com",
      },
    ],
  },
  {
    id: "video",
    title: "Vidéo & démos",
    cards: [
      {
        name: "Loom",
        desc: "Enregistrer votre écran et votre voix pour expliquer, présenter ou signaler un problème — plus rapide qu'une réunion.",
        href: "https://www.loom.com",
        domain: "loom.com",
      },
      {
        name: "HowdyGo",
        desc: "Générer une capture animée de votre site qui défile, parfaite pour les réseaux sociaux.",
        href: "https://www.howdygo.com/free-scrolling-video-generator",
        domain: "howdygo.com",
      },
    ],
  },
  {
    id: "typo",
    title: "Typographie & couleurs",
    cards: [
      {
        name: "Google Fonts",
        desc: "Le catalogue de polices gratuites du web, toutes utilisables commercialement.",
        href: "https://fonts.google.com",
        domain: "fonts.google.com",
      },
      {
        name: "FontPair",
        desc: "Des associations de polices Google Fonts qui fonctionnent, prêtes à réutiliser.",
        href: "https://www.fontpair.co",
        domain: "fontpair.co",
      },
      {
        name: "Coolors",
        desc: "Générer des palettes de couleurs harmonieuses, ou vérifier les contrastes de la vôtre.",
        href: "https://coolors.co",
        domain: "coolors.co",
      },
    ],
  },
  {
    id: "mesure",
    title: "Tester & mesurer",
    cards: [
      {
        name: "Mail-tester",
        desc: "Vérifier que vos newsletters n'atterrissent pas en spam, avant de les envoyer.",
        href: "https://www.mail-tester.com",
        domain: "mail-tester.com",
      },
      {
        name: "Microsoft Clarity",
        desc: "Comprendre comment vos visiteurs utilisent votre site : heatmaps et replays de session, gratuitement.",
        href: "https://clarity.microsoft.com",
        domain: "clarity.microsoft.com",
      },
      {
        name: "PageSpeed Insights",
        desc: "Mesurer la vitesse de votre site telle que Google la voit.",
        href: "https://pagespeed.web.dev",
        domain: "pagespeed.web.dev",
      },
      {
        name: "Search Console",
        desc: "Suivre votre présence dans les résultats Google : impressions, clics, pages indexées.",
        href: "https://search.google.com/search-console",
        domain: "search.google.com",
      },
    ],
  },
  {
    id: "automatisation",
    title: "Automatiser",
    cards: [
      {
        name: "Zapier",
        desc: "Connecter vos outils entre eux — formulaire vers CRM, vente vers tableur — sans code.",
        href: "https://zapier.com/fr",
        domain: "zapier.com",
      },
      {
        name: "Make",
        desc: "Des automatisations visuelles plus poussées. Notre outil de prédilection pour les workflows clients.",
        href: "https://www.make.com",
        domain: "make.com",
      },
    ],
  },
  {
    id: "webflow",
    title: "Webflow",
    cards: [
      {
        name: "Webflow University",
        desc: "La bible Webflow : des cours vidéo gratuits pour apprendre à modifier votre site vous-même.",
        href: "https://university.webflow.com",
        domain: "university.webflow.com",
      },
      {
        name: "Support Webflow",
        desc: "Le support officiel Webflow, inclus dans votre abonnement au site.",
        href: "https://support.webflow.com",
        domain: "support.webflow.com",
      },
      {
        name: "Weglot",
        desc: "Traduire votre site en plusieurs langues sans le reconstruire.",
        href: "https://www.weglot.com",
        domain: "weglot.com",
      },
    ],
  },
];
