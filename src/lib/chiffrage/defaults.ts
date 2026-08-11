import type { Catalogue, Chiffrage } from "./types";

export const CATALOGUE_DEFAUT: Catalogue = {
  settings: { tjm: 600, demi: 300, marcheBas: 450, marcheHaut: 650, joursSemaine: 3, semainesMarge: 1, chargesPct: 26 },
  catalog: {
    design: { simple: 0.5, standard: 1, complexe: 2, portee: { ux: 40, ui: 70 } },
    integration: { simple: 0.5, standard: 1, complexe: 1.5 },
    dev: { pack1: 0.5, pack2: 1, pack3: 1.5, pack4: 2 },
    setup: {
      cms: { jours: 0.5, clientLabel: "Gestion autonome de vos contenus (blog, équipe, actualités...)" },
      multilingue: { jours: 2, clientLabel: "Site disponible en plusieurs langues" },
      hebergement: { jours: 0.25, clientLabel: "Hébergement rapide et sécurisé, prêt à l'emploi" },
      domaine: { jours: 0.25, clientLabel: "Nom de domaine et DNS configurés" },
    },
    gestion: { coefHebdo: 0.15, forfaitCMS: 0.5, forfaitMultilingue: 1, forfaitHebergement: 0, forfaitDomaine: 0.25, urgencePct: 20 },
    affinite: { baisse: 20, hausse: 20 },
    devisTexts: {
      stackTechnique:
        "On part sur Astro (développement) + Sanity (CMS) + Cloudflare (hébergement). Pages ultra-légères, site rapide. Coût d'usage nul : hébergement Cloudflare gratuit, aucun abonnement mensuel. Autonomie : vous gérez textes, images et contenus vous-même via Sanity, sans toucher au code. Vous restez libre : le code est dans un dépôt qui vous appartient, le contenu Sanity est exportable, n'importe quel développeur peut reprendre le site.",
      conditionsReglement:
        "30 % à la validation du devis, qui lance la prestation. Solde à la livraison du site fonctionnel.",
      ceQueCaComprend:
        "Responsive (desktop, tablette, mobile)\nConfiguration SEO et bonnes pratiques\nOptimisation de la vitesse\nTests QA sur les 3 navigateurs principaux\nCertificat SSL\nPages légales et page de contact\nDoc de passation pour la prise en main du site\nSupport 30 jours après mise en ligne",
      horsPerimetre:
        "La rédaction des textes et la fourniture des visuels ne sont pas incluses.\nLa conception d'une charte graphique poussée n'est pas incluse (modernisation du design existant).",
    },
  },
  segments: {
    agence: { label: "Agence de com digitale", desc: "Pour leurs clients", gestionProjet: false, note: "L'agence porte sa propre marge et sa gestion de projet." },
    designer: { label: "Designer UX/UI, DA", desc: "Collab : ils designent, tu intègres", gestionProjet: false, note: "Le design n'est pas de ton ressort ici : ne coche que intégration et dev sur mesure. Le designer gère la relation client." },
    pme: { label: "PME, scale-up", desc: "Budgets plus importants", gestionProjet: true, note: "Plus d'enjeux, plus d'allers-retours, plus de coordination : gestion de projet activée par défaut." },
    tpe: { label: "TPE, solopreneur", desc: "Simple et rapide", gestionProjet: false, note: "Cycle court, décision rapide, pas de surcouche de gestion de projet par défaut." },
    association: { label: "Association", desc: "Tarifs ESS", gestionProjet: false, note: "Vérifie le budget réel avant d'appliquer une réduction : utilise le champ « Réduction exceptionnelle » plutôt qu'un abattement automatique." },
  },
};

export const nouveauChiffrage = (cat: Catalogue): Chiffrage => ({
  id: null,
  date: new Date().toISOString().slice(0, 10),
  nom: "",
  clientSlug: "",
  projetSlug: "",
  mode: "configurateur",
  segment: "tpe",
  objectif: "",
  pages: [],
  devLines: [],
  autres: [],
  setupCms: false,
  setupMultilingue: false,
  setupHebergement: false,
  setupDomaine: false,
  affinite: "neutre",
  gestionProjet: cat.segments.tpe?.gestionProjet ?? false,
  urgence: false,
  margePct: 0,
  reductionNom: "",
  reductionMontant: 0,
  prixRetenu: null,
  postes: [],
  strategique: false,
  raison: "",
  publishedKey: null,
  publishedVersions: 0,
});
