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
    quote:
      "Ludovic allie vision stratégique et rigueur opérationnelle. Notre collaboration m'a permis de trouver les mots justes et un design efficace. J'avais besoin d'un regard neutre et franc pour présenter au mieux mon activité. Je suis ravie du résultat et je le recommande chaudement.",
    name: "Mathilde Chevalier",
    role: "Consultante en Gestion de Conflits · Montpellier",
    photo: "/img/testimonials/mathilde-chevalier.avif",
  },
  {
    quote:
      "Ludovic est d'une fiabilité et d'un professionnalisme sans borne. Il est à l'écoute et a très vite compris ce que nous recherchions. Il est capable d'appréhender et de s'adapter à tout type d'activité et d'interlocuteur. N'hésitez pas, vous êtes entre les mains d'une personne de confiance qui fera tout pour répondre à vos attentes.",
    name: "Ombeline Choupin",
    role: "Product Manager @ Theodo · Paris",
    photo: "/img/testimonials/ombeline-choupin.avif",
  },
  {
    quote:
      "Ludovic a été essentiel pour lancer nos premières ventes. Il a conçu un site e-commerce parfaitement adapté à nos besoins, avec d'excellents résultats dès le départ. Il nous a transmis les bonnes pratiques pour rester autonomes, tout en restant disponible et réactif.",
    name: "Thomas Mogharaei",
    role: "Fondateur @ Le Tapis de Laine · Millau",
    photo: "/img/testimonials/thomas-mogharaei.avif",
  },
  {
    quote:
      "Super collaboration avec Ludovic qui a été à l'écoute et qui va au-delà de l'exécution. Tout était très fluide !",
    name: "Gaelle Céalac Pappo",
    role: "CMO Freelance · Toulouse",
    photo: "/img/testimonials/gaelle-cealac-pappo.jpg",
  },
  {
    quote:
      "Ludo c'est l'expert humble et à l'écoute que tout le monde aimerait avoir. De la réflexion à la mise en ligne, tout a été simple, fluide et pro. Un vrai bonheur.",
    name: "Giovanni Iacono",
    role: "Vidéaste @ NGUP Media · Toulouse",
    photo: "/img/testimonials/giovanni-iacono.webp",
  },
  {
    quote:
      "Ludo développe des landing pages pour l'agence Trigger avec une vraie excellence d'intégration. Il combine vision stratégique et rigueur opérationnelle, tout en étant fiable, impliqué et à l'écoute. Nos clients se sentent en confiance du début à la fin.",
    name: "Baptiste Garnot",
    role: "Fondateur de l'agence Trigger · Toulouse",
    photo: "/img/testimonials/baptiste-garnot.avif",
  },
  {
    quote:
      "Ludo a refondu notre site Webflow avec clarté et précision : structuration des idées, message clarifié, résultat fluide et aligné avec notre image. Impliqué et à l'écoute, il a transformé un projet complexe en une collaboration fluide et efficace.",
    name: "Arnaud Maynadié",
    role: "Associé Fondateur @ Talenvia · Paris",
    photo: "/img/testimonials/arnaud-maynadie.avif",
  },
  {
    quote:
      "Ludo a cadré notre projet avec une méthode claire et rassurante. Il a su allier rigueur, écoute et adaptabilité à chaque étape. On se sent compris, accompagné, en confiance. Une collaboration fluide, efficace, et vraiment agréable.",
    name: "Kateline Lemeliner",
    role: "Dirigeante @ Dupont Dupont · Annecy",
    photo: "/img/testimonials/kateline-lemeliner.avif",
  },
  {
    quote:
      "Travailler avec Ludovic, c'est avoir un partenaire qui se met réellement à la place du client. Il comprend vite les enjeux, propose toujours des pistes pertinentes, et son enthousiasme est aussi motivant que rassurant.",
    name: "Alexandre Cahagne",
    role: "Digital Media Specialist @ Havas · Zürich",
    photo: "/img/testimonials/alexandre-cahagne.avif",
  },
  {
    quote:
      "Ludo a repris notre site de zéro et le résultat dépasse nos attentes. Clair, rapide, et pensé pour convertir. On a gagné en crédibilité dès la mise en ligne, et le suivi post-lancement a été impeccable.",
    name: "Julien Reboul",
    role: "Cofondateur @ Maison Vela · Bordeaux",
  },
  {
    quote:
      "Ludovic s'est montré particulièrement efficace dans un projet complexe, où sa capacité d'analyse, sa force de proposition et son sens de la collaboration ont fait la différence. Il sait écouter, s'adapter, et faire avancer un projet dans la bonne direction, avec pédagogie et engagement.",
    name: "Marie-Fabienne Mas",
    role: "Directrice @ ISTH, IONIS Education Group · Paris",
    photo: "/img/testimonials/marie-fabienne-mas.avif",
  },
  {
    quote:
      "Travailler avec Ludo, c'est gagner en clarté et en sérénité. Il structure, challenge avec bienveillance et livre un travail impeccable. Je le recommande sans la moindre hésitation à quiconque cherche un vrai partenaire.",
    name: "Romain Bernard",
    role: "CEO @ GroupeVela · Lyon",
  },
  {
    quote:
      "Ludovic a repensé toute notre présence en ligne avec une justesse rare. Il a compris nos enjeux dès le premier échange et a proposé des solutions concrètes, cohérentes et durables. Un accompagnement précieux du début à la fin.",
    name: "Camille Laurent",
    role: "Fondatrice @ Atelier Nord · Nantes",
  },
  {
    quote:
      "Ce que j'ai particulièrement apprécié dans notre collaboration, c'est la grande souplesse de Ludovic, sa compréhension rapide des enjeux et sa disponibilité constante. Il est à la fois agréable, à l'écoute, et toujours dans un échange de qualité.",
    name: "Margaux Billet",
    role: "Directrice artistique @ Studio Caperky · Paris",
    photo: "/img/testimonials/margaux-billet.avif",
  },
  {
    quote:
      "Un accompagnement carré du premier échange à la livraison. Ludovic pose les bonnes questions, propose des solutions concrètes et exécute sans accroc. Je le recommande les yeux fermés à toute équipe qui veut avancer vite et bien.",
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
