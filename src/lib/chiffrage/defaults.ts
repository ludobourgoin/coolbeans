import type { ModificateursProjet, Reglages } from "./types";

export const REGLAGES_DEFAUT: Reglages = {
  tjm: 600,
  heuresJour: 7,
  marcheBas: 450,
  marcheHaut: 650,
  joursSemaine: 3,
  semainesMarge: 1,
  /* 28,5 : micro-entreprise BNC 2026, soit cotisations 26,1 % + CFP 0,2 %
     + versement libératoire 2,2 %. Le « net » qui en découle est le vrai
     argent en poche, IR compris. */
  chargesPct: 28.5,
  gestionPct: 15,
  urgencePct: 20,
  affinite: { baisse: 10, hausse: 10 },
  devisTexts: {
    stackTechnique:
      "On part sur Astro (développement) + Sanity (CMS) + Cloudflare (hébergement). Pages ultra-légères, site rapide. Coût d'usage nul : hébergement Cloudflare gratuit, aucun abonnement mensuel. Autonomie : vous gérez textes, images et contenus vous-même via Sanity, sans toucher au code. Vous restez libre : le code est dans un dépôt qui vous appartient, le contenu Sanity est exportable, n'importe quel développeur peut reprendre le site.",
    conditionsReglement:
      "30 % à la validation du devis, qui lance la prestation. Solde à la livraison du site fonctionnel.",
    ceQueCaComprend:
      "Responsive (desktop, tablette, mobile)\nConfiguration SEO et bonnes pratiques\nOptimisation de la vitesse\nTests QA sur les 3 navigateurs principaux\nCertificat SSL, hébergement et raccordement du nom de domaine (DNS)\nMise en place du suivi de fréquentation (analytics sans cookies)\nLe code livré dans un dépôt qui vous appartient\nPages légales\nDoc de passation pour la prise en main du site\nSupport 30 jours après mise en ligne",
    horsPerimetre:
      "La rédaction des textes et la fourniture des visuels ne sont pas incluses.\nLa conception d'une charte graphique poussée n'est pas incluse (modernisation du design existant).",
    urgenceTooltip:
      "Je vous fais passer en priorité pour répondre à votre deadline (+20 %).",
  },
};

export const MODIFICATEURS_DEFAUT: ModificateursProjet = {
  segment: "tpe",
  affinite: "neutre",
  gestionProjet: false,
  urgence: false,
  margePct: 0,
  reduction: null,
  prixRetenu: null,
};
