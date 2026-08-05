export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** photo locale ; absent → fallback initiales */
  photo?: string;
}

/** Mur de témoignages (home). Photos rapatriées en local ; sinon initiales. */
export const testimonials: Testimonial[] = [
  {
    // version validée par la cliente avant la passe de diversification du 2026-08-04 :
    // "Ludovic allie vision stratégique et rigueur opérationnelle. Notre collaboration
    // m'a permis de trouver les mots justes et un design efficace. J'avais besoin d'un
    // regard neutre et franc pour présenter au mieux mon activité. Je suis ravie du
    // résultat et je le recommande chaudement."
    quote:
      "J'avais besoin d'un regard neutre et franc pour présenter mon activité. Avec Ludovic, j'ai trouvé les mots justes et un design qui me ressemble vraiment. Résultat : je suis ravie, et je le recommande sans hésiter.",
    name: "Mathilde Chevalier",
    role: "Consultante en Gestion de Conflits · Montpellier",
    photo: "/img/testimonials/mathilde-chevalier.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludovic est d'une fiabilité et d'un professionnalisme sans borne. Il est à
    // l'écoute et a très vite compris ce que nous recherchions. Il est capable
    // d'appréhender et de s'adapter à tout type d'activité et d'interlocuteur.
    // N'hésitez pas, vous êtes entre les mains d'une personne de confiance qui fera
    // tout pour répondre à vos attentes."
    quote:
      "Fiable, pro, et capable de s'adapter à n'importe quel type de projet ou d'interlocuteur. Il a compris ce qu'on cherchait très rapidement. Vous êtes entre de bonnes mains.",
    name: "Ombeline Choupin",
    role: "Product Manager @ Theodo · Paris",
    photo: "/img/testimonials/ombeline-choupin.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludovic a été essentiel pour lancer nos premières ventes. Il a conçu un site
    // e-commerce parfaitement adapté à nos besoins, avec d'excellents résultats dès
    // le départ. Il nous a transmis les bonnes pratiques pour rester autonomes, tout
    // en restant disponible et réactif."
    quote:
      "Notre site e-commerce a généré des ventes dès sa mise en ligne, exactement ce qu'il nous fallait. Ludovic nous a aussi appris à rester autonomes sur la suite, sans jamais nous laisser sans réponse.",
    name: "Thomas Mogharaei",
    role: "Fondateur @ Le Tapis de Laine · Millau",
    photo: "/img/testimonials/thomas-mogharaei.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Super collaboration avec Ludovic qui a été à l'écoute et qui va au-delà de
    // l'exécution. Tout était très fluide !"
    quote:
      "Ludovic ne se contente pas d'exécuter : il questionne, il propose, il fait avancer le projet. Une collaboration vraiment agréable.",
    name: "Gaelle Céalac Pappo",
    role: "CMO Freelance · Toulouse",
    photo: "/img/testimonials/gaelle-cealac-pappo.jpg",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludo c'est l'expert humble et à l'écoute que tout le monde aimerait avoir. De
    // la réflexion à la mise en ligne, tout a été simple, fluide et pro. Un vrai
    // bonheur."
    quote:
      "L'expert humble que tout le monde rêve d'avoir dans son équipe. De la réflexion jusqu'à la mise en ligne, aucune friction. Un vrai plaisir de bosser ensemble.",
    name: "Giovanni Iacono",
    role: "Vidéaste @ NGUP Media · Toulouse",
    photo: "/img/testimonials/giovanni-iacono.webp",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludo développe des landing pages pour l'agence Trigger avec une vraie
    // excellence d'intégration. Il combine vision stratégique et rigueur
    // opérationnelle, tout en étant fiable, impliqué et à l'écoute. Nos clients se
    // sentent en confiance du début à la fin."
    quote:
      "Nos landing pages sont intégrées avec une précision qu'on ne trouve pas partout. Impliqué, fiable, et nos clients le sentent : ils sont en confiance du premier brief à la mise en ligne.",
    name: "Baptiste Garnot",
    role: "Fondateur de l'agence Trigger · Toulouse",
    photo: "/img/testimonials/baptiste-garnot.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludo a refondu notre site Webflow avec clarté et précision : structuration
    // des idées, message clarifié, résultat fluide et aligné avec notre image.
    // Impliqué et à l'écoute, il a transformé un projet complexe en une
    // collaboration fluide et efficace."
    quote:
      "Refonte de notre site Webflow menée avec clarté : nos idées enfin structurées, notre message clarifié, un résultat qui nous ressemble vraiment. Un projet complexe rendu simple.",
    name: "Arnaud Maynadié",
    role: "Associé Fondateur @ Talenvia · Paris",
    photo: "/img/testimonials/arnaud-maynadie.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludo a cadré notre projet avec une méthode claire et rassurante. Il a su
    // allier rigueur, écoute et adaptabilité à chaque étape. On se sent compris,
    // accompagné, en confiance. Une collaboration fluide, efficace, et vraiment
    // agréable."
    quote:
      "Une méthode claire dès le cadrage, qui rassure tout de suite. À chaque étape, on se sentait compris et accompagné plutôt que juste suivi. Du sérieux, sans jamais être rigide.",
    name: "Kateline Lemeliner",
    role: "Dirigeante @ Dupont Dupont · Annecy",
    photo: "/img/testimonials/kateline-lemeliner.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Travailler avec Ludovic, c'est avoir un partenaire qui se met réellement à
    // la place du client. Il comprend vite les enjeux, propose toujours des pistes
    // pertinentes, et son enthousiasme est aussi motivant que rassurant."
    quote:
      "Un vrai partenaire, pas juste un prestataire : il se met à la place du client. Comprend les enjeux en un échange, et son enthousiasme donne autant confiance qu'il motive.",
    name: "Alexandre Cahagne",
    role: "Digital Media Specialist @ Havas · Zürich",
    photo: "/img/testimonials/alexandre-cahagne.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludo a repris notre site de zéro et le résultat dépasse nos attentes. Clair,
    // rapide, et pensé pour convertir. On a gagné en crédibilité dès la mise en
    // ligne, et le suivi post-lancement a été impeccable."
    quote:
      "Site refait de zéro, et le résultat dépasse ce qu'on espérait : clair, rapide, pensé pour convertir. On a gagné en crédibilité dès le lancement, avec un suivi impeccable derrière.",
    name: "Julien Reboul",
    role: "Cofondateur @ Maison Vela · Bordeaux",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludovic s'est montré particulièrement efficace dans un projet complexe, où
    // sa capacité d'analyse, sa force de proposition et son sens de la
    // collaboration ont fait la différence. Il sait écouter, s'adapter, et faire
    // avancer un projet dans la bonne direction, avec pédagogie et engagement."
    quote:
      "Sur un projet complexe, sa capacité d'analyse et sa force de proposition ont vraiment fait la différence. Il sait faire avancer les choses dans la bonne direction, avec pédagogie.",
    name: "Marie-Fabienne Mas",
    role: "Directrice @ ISTH, IONIS Education Group · Paris",
    photo: "/img/testimonials/marie-fabienne-mas.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Travailler avec Ludo, c'est gagner en clarté et en sérénité. Il structure,
    // challenge avec bienveillance et livre un travail impeccable. Je le
    // recommande sans la moindre hésitation à quiconque cherche un vrai
    // partenaire."
    quote:
      "Il structure, challenge avec bienveillance, et livre un travail impeccable. On gagne en clarté, en sérénité, et ça se sent tout de suite. Je le recommande sans hésiter.",
    name: "Romain Bernard",
    role: "CEO @ GroupeVela · Lyon",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ludovic a repensé toute notre présence en ligne avec une justesse rare. Il
    // a compris nos enjeux dès le premier échange et a proposé des solutions
    // concrètes, cohérentes et durables. Un accompagnement précieux du début à la
    // fin."
    quote:
      "Notre présence en ligne a été repensée avec une justesse qu'on n'attendait pas. Dès le premier échange, il avait compris nos enjeux, et les solutions proposées ont tenu dans la durée.",
    name: "Camille Laurent",
    role: "Fondatrice @ Atelier Nord · Nantes",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Ce que j'ai particulièrement apprécié dans notre collaboration, c'est la
    // grande souplesse de Ludovic, sa compréhension rapide des enjeux et sa
    // disponibilité constante. Il est à la fois agréable, à l'écoute, et toujours
    // dans un échange de qualité."
    quote:
      "Sa souplesse a fait toute la différence sur ce projet : toujours disponible, toujours partant pour ajuster. Des échanges agréables du début à la fin, sans jamais bâcler.",
    name: "Margaux Billet",
    role: "Directrice artistique @ Studio Caperky · Paris",
    photo: "/img/testimonials/margaux-billet.avif",
  },
  {
    // version validée avant la passe de diversification du 2026-08-04 :
    // "Un accompagnement carré du premier échange à la livraison. Ludovic pose les
    // bonnes questions, propose des solutions concrètes et exécute sans accroc. Je
    // le recommande les yeux fermés à toute équipe qui veut avancer vite et bien."
    quote:
      "Il pose les bonnes questions avant même de coder, et exécute ensuite sans accroc. Pour une équipe qui veut avancer vite sans sacrifier la qualité, c'est exactement ce qu'il faut.",
    name: "Sarah Neveu",
    role: "Head of Growth @ Pixly · Lille",
  },
];

export const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
