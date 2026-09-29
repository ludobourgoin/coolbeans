/* Contenu de l'aperçu JETABLE du document d'audit (src/pages/apercu-audit.astro).

   Il a la forme du futur YAML de la collection `audit`, pour passer tel quel
   dans src/content/audit/le-tapis-de-laine/ une fois la spec validée. Le
   préfixe `_` le tient hors du routage d'Astro.

   Chiffres : PageSpeed Insights, 3 passages par page et par appareil, médiane,
   mesurés le 2026-09-28. Poids en Mo décimaux (octets / 1 000 000). */

type Ligne = { impact: number; confiance: number; facilite: number };

/* Score ICE : moyenne des trois notes, sur 10, une décimale. */
export const ice = (l: Ligne) => Math.round(((l.impact + l.confiance + l.facilite) / 3) * 10) / 10;
export const virgule = (n: number) => n.toFixed(1).replace(".", ",");

/* Seuils de Google pour le score de performance. */
export const teinteScore = (n: number) => (n >= 90 ? "green" : n >= 50 ? "amber" : "red");

export const causes = {
  symptome: { libelle: "Symptôme", teinte: "gray" },
  structure: { libelle: "Structure", teinte: "purple" },
} as const;

export const contact = {
  mail: "ludo@coolbeans.cc",
  telephone: "06 16 70 03 40",
  tel: "+33616700340",
};

export const audit = {
  titre: "letapisdelaine.fr",
  objet:
    "Ce que j'ai mesuré sur ton site, ce qui le freine, et les deux façons d'y remédier.",
  date: new Date("2026-09-29"),

  intro: [
    {
      titre: "En bref",
      texte:
        "Ton site fonctionne, et tes visiteurs le trouvent plutôt rapide. Mais il repose sur trois plateformes : Webflow affiche les pages, Shopify gère le catalogue et le paiement, Smootify relie les deux. La plupart des défauts relevés ici viennent de cet assemblage, pas d'une erreur isolée.",
      liste: [
        "**10 produits**, saisis dans deux outils à la fois.",
        "**31 à 55 sur 100** sur mobile au test de Google, selon les pages.",
        "**130 Ko de code** ajouté au fil des mois, dont une série de correctifs.",
        "**Aucun bandeau de cookies** actif depuis le 29 juillet.",
      ],
    },
    {
      titre: "Ce que j'ai regardé",
      liste: [
        "Le projet Webflow : 33 pages, 7 collections, 5 langues, et tout le code ajouté au site et aux pages.",
        "Le catalogue Shopify : 10 produits, 12 variantes, 53 photos.",
        "7 pages mesurées avec PageSpeed Insights, l'outil de Google, trois fois chacune sur mobile et sur ordinateur. Je retiens la valeur du milieu.",
        "Les données de Chrome sur tes vrais visiteurs, sur les 28 derniers jours.",
      ],
      note: "Mesures du 28 septembre 2026. Je n'ai rien modifié sur ton site.",
    },
  ],

  mesures: {
    titre: "Mesures",
    texte:
      "Le score va de 0 à 100. L'affichage est le temps qu'il faut, sur mobile, pour que le contenu principal apparaisse.",
    lignes: [
      { page: "Accueil", chemin: "/", mobile: 48, ordinateur: 62, affichage: "4,7 s", poids: "4,3 Mo" },
      { page: "Fiche produit", chemin: "/product/tapis-de-yoga", mobile: 31, ordinateur: 59, affichage: "16,2 s", poids: "4,4 Mo" },
      { page: "Collection", chemin: "/collection", mobile: 52, ordinateur: 57, affichage: "5,0 s", poids: "3,3 Mo" },
      { page: "Yoga", chemin: "/yoga", mobile: 32, ordinateur: 62, affichage: "6,5 s", poids: "3,0 Mo" },
      { page: "Bébé", chemin: "/bebe", mobile: 55, ordinateur: 64, affichage: "4,8 s", poids: "2,3 Mo" },
      { page: "Article du journal", chemin: "/post/quelle-epaisseur-choisir-pour-son-tapis-de-yoga", mobile: 39, ordinateur: 66, affichage: "8,4 s", poids: "2,8 Mo" },
      { page: "Tester le tapis", chemin: "/tester-le-tapis", mobile: 34, ordinateur: 54, affichage: "5,3 s", poids: "17,9 Mo" },
    ],
    note:
      "Ce test simule un téléphone moyen sur une 4G lente : c'est le banc d'essai de Google, sévère par construction. Tes vrais visiteurs s'en sortent mieux. Pour 3 visites sur 4, le contenu principal s'affiche en moins de **2,3 s**, ce qui est bon. L'écart vient du poids des scripts : un téléphone récent en wifi le masque, un téléphone d'entrée de gamme en 4G le subit.",
  },

  constats: [
    {
      titre: "Trois plateformes",
      texte:
        "Webflow affiche les pages et les textes. Shopify porte le catalogue, le stock et le paiement, sur shop.letapisdelaine.fr. Smootify relie les deux : il va chercher chez Shopify, depuis le navigateur du visiteur, les prix, les stocks et les photos.",
      liste: [
        "Sur la fiche produit, la photo principale n'est demandée qu'après **15,9 s** en conditions de test : elle attend que Smootify l'ait récupérée.",
        "Smootify interroge une version de test de l'API Shopify, dite « unstable », qui renvoie des erreurs à chaque page.",
        "Il se charge toujours dans sa dernière version : une mise à jour de Smootify arrive sur ton site sans que personne l'ait testée.",
      ],
    },
    {
      titre: "Chaque produit saisi deux fois",
      texte:
        "Shopify connaît tes 10 produits. Webflow aussi, dans une collection de 58 champs.",
      liste: [
        "Le prix, le prix barré et le message de disponibilité sont recopiés à la main dans Webflow.",
        "La note des avis s'écrit à la main, par exemple « 4.71/5 (148 avis) ».",
        "Les informations lues par Google, dont le prix et le stock, sont écrites à la main dans chaque fiche. Si le prix change dans Shopify, Google peut continuer d'afficher l'ancien.",
        "Les noms divergent déjà : « Le plaid en laine » dans Webflow, « Plaid en laine Lacaune & mérinos » dans Shopify.",
      ],
    },
    {
      titre: "Des correctifs empilés",
      texte:
        "Environ 130 Ko de code ont été ajoutés au site : 50 Ko pour tout le site, 58 Ko page par page, et 24 scripts.",
      liste: [
        "Plusieurs portent le nom de ce qu'ils réparent : « fix_hreflang_production », « fix_nav_footer_dead_links », « fix_checkout_session_stitch ».",
        "Un même réglage, la vitesse de défilement des avis, en est à sa troisième version.",
        "Le code raconte lui-même ses incidents : jusqu'au 23 août, le lien entre le site et le paiement se perdait, et Shopify comptait 0 % de conversion.",
      ],
    },
    {
      titre: "Cookies",
      texte:
        "Le bandeau de cookies est en pause depuis le 29 juillet. En attendant, le code accorde le consentement par défaut à Meta, Google Analytics, Google Ads, Klaviyo et ChatGPT Ads.",
      note: "La CNIL impose de recueillir l'accord du visiteur avant de déposer des traceurs publicitaires.",
    },
    {
      titre: "Poids",
      texte:
        "Chaque page charge environ 170 fichiers, depuis une trentaine de domaines différents.",
      liste: [
        "**Tester le tapis** pèse 17,9 Mo, dont 14,6 Mo de photos. L'une d'elles pèse 3,6 Mo et s'affiche dans une vignette de 370 pixels de large.",
        "La fiche produit charge 729 Ko pour un contrôle anti-robot de Cloudflare.",
        "Sur mobile, le moteur d'animation de Webflow occupe le processeur plus de 5 s par page.",
      ],
    },
  ],

  optimisations: {
    titre: "Optimisations",
    texte:
      "14 optimisations, notées de 1 à 10 sur trois critères : l'impact pour toi, ma confiance dans ce gain, la facilité à le faire sur le site actuel. Le score ICE en est la moyenne. Clique sur une colonne pour trier.",
    /* `cause` : « symptome » se corrige sur le site actuel, « structure » tient
       à l'assemblage des trois plateformes. */
    lignes: [
      { quoi: "Rétablir le bandeau de cookies", pourquoi: "Les traceurs publicitaires tournent sans l'accord des visiteurs depuis le 29 juillet.", cause: "symptome", impact: 9, confiance: 9, facilite: 6, refonte: true },
      { quoi: "Ne saisir chaque produit qu'une fois", pourquoi: "Fini les prix, les stocks et les notes recopiés à la main, et les erreurs qui vont avec.", cause: "structure", impact: 9, confiance: 10, facilite: 1, refonte: true },
      { quoi: "Afficher la photo produit sans attendre Smootify", pourquoi: "C'est la page qui vend. En test, sa photo arrive après 16 s.", cause: "structure", impact: 8, confiance: 8, facilite: 2, refonte: true },
      { quoi: "Alléger les photos de Tester le tapis", pourquoi: "La page perdrait l'essentiel de ses 17,9 Mo.", cause: "symptome", impact: 7, confiance: 9, facilite: 9, refonte: true },
      { quoi: "Alléger le moteur d'animation", pourquoi: "Il occupe le téléphone plus de 5 s par page.", cause: "structure", impact: 7, confiance: 7, facilite: 3, refonte: true },
      { quoi: "Figer la version de Smootify", pourquoi: "Une mise à jour de Smootify ne partirait plus en ligne sans test.", cause: "symptome", impact: 6, confiance: 8, facilite: 8, refonte: true },
      { quoi: "Réduire les scripts de suivi", pourquoi: "Une trentaine de domaines tiers par page, chacun retarde l'affichage.", cause: "symptome", impact: 6, confiance: 7, facilite: 5, refonte: true },
      { quoi: "Retirer les correctifs empilés", pourquoi: "Moins de code à charger, moins de pannes silencieuses.", cause: "structure", impact: 6, confiance: 7, facilite: 3, refonte: true },
      { quoi: "Donner à Google le vrai prix et le vrai stock", pourquoi: "Aujourd'hui écrits à la main, ils peuvent diverger de Shopify.", cause: "structure", impact: 6, confiance: 8, facilite: 2, refonte: true },
      { quoi: "Ne plus dépendre d'une version de test de l'API Shopify", pourquoi: "Shopify peut la modifier sans préavis, et elle renvoie déjà des erreurs.", cause: "structure", impact: 6, confiance: 7, facilite: 1, refonte: true },
      { quoi: "Charger le contrôle anti-robot seulement là où il sert", pourquoi: "729 Ko de moins sur la fiche produit.", cause: "symptome", impact: 5, confiance: 6, facilite: 6, refonte: true },
      { quoi: "Passer d'un abonnement à trois à un seul", pourquoi: "Webflow, Smootify et Shopify : trois factures pour une boutique.", cause: "structure", impact: 5, confiance: 9, facilite: 1, refonte: true },
      { quoi: "Corriger les défauts d'accessibilité", pourquoi: "Boutons sans nom, contrastes faibles, zones tactiles trop petites sur la fiche produit.", cause: "symptome", impact: 4, confiance: 9, facilite: 6, refonte: true },
      { quoi: "Rendre le sélecteur de langue lisible par Google", pourquoi: "Ses liens n'ont pas d'adresse, Google ne peut pas les suivre.", cause: "symptome", impact: 3, confiance: 8, facilite: 8, refonte: true },
    ],
    note:
      "7 lignes sont des symptômes : elles se corrigent sur le site actuel, et le bandeau de cookies mérite de l'être tout de suite, quoi que tu décides. Les 7 autres tiennent à la structure : elles ne se règlent vraiment qu'en changeant d'architecture.",
  },

  comparatif: {
    titre: "Les deux voies",
    solutions: [
      { nom: "Corriger au coup par coup", resume: "Sur Webflow, Smootify et Shopify.", recommandee: false },
      { nom: "Passer sur Shopify seul", resume: "Une seule plateforme, ta boutique actuelle.", recommandee: true },
    ],
    criteres: [
      { label: "Les 7 symptômes", valeurs: ["Corrigés un par un", "Corrigés"] },
      { label: "Les 7 problèmes de structure", valeurs: ["Restent en place", "Réglés"] },
      { label: "Ajouter un produit", valeurs: ["Dans Shopify, puis dans Webflow", "Dans Shopify, une fois"] },
      { label: "Photos des produits", valeurs: ["Chargées par Smootify après la page", "Dans la page dès l'affichage"] },
      { label: "Cookies", valeurs: ["Un bandeau à relier à trois outils", "Le bandeau natif de Shopify"] },
      { label: "Modifier le site", valeurs: ["Dans Webflow, et dans le code ajouté", "Dans l'éditeur de thème Shopify"] },
      { label: "Abonnements", valeurs: ["Webflow, Smootify, Shopify", "Shopify"] },
      { label: "Commandes, clients, avis", valeurs: ["Inchangés", "Inchangés : ta boutique Shopify reste la même"] },
    ],
    mentionCout: "Pas de prix ici : on en parle une fois que tu as vu la démo.",
  },

  suite: {
    titre: "La suite",
    texte:
      "J'ai construit une démo de ta boutique sur Shopify seul, avec tes produits et tes photos. La vidéo te la présente et la compare à ton site actuel.",
    video: null as null | { id: string; titre?: string },
    demo: { libelle: "Voir la démo", url: "#", aide: "Le mot de passe est dans mon mail." },
    contact:
      "Tu me réponds par mail ou tu m'appelles, comme tu préfères.",
  },
};
