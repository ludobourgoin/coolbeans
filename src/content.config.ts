import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/* Un fichier YAML par devis dans src/content/devis/<client>/<projet>-<4
   chiffres>.yaml ; le chemin devient l'URL (/devis/<client>/<projet>-1234).
   Un client peut porter plusieurs devis, et les anciens se conservent. Le
   suffixe chiffré rend l'URL non devinable d'un projet à l'autre.
   Les devis d'avant cette convention restent à la racine et gardent leur URL
   à un segment : la route est un catch-all, les deux formes cohabitent, et
   un lien déjà envoyé à un client ne casse jamais. Rendu par
   src/pages/devis/[...slug].astro. Le gras s'écrit **comme en Markdown**
   dans n'importe quelle chaîne.

   Chaque section porte un titre (le libellé mono de la colonne de gauche)
   et combine librement : `texte`, `liste`, `budget` (lignes chiffrées,
   totaux calculés ; une ligne sans `prix` s'affiche « Inclus »),
   `planning` (jalons datés). Les `notes` de fin s'affichent en bandeaux. */
const devis = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/devis" }),
  schema: z.object({
    titre: z.string(),
    objet: z.string(),
    date: z.coerce.date(),
    // Prénom du contact côté client, affiché sur les jalons de planning
    // attribués à "client" (owner: client). Chaque devis a son propre client.
    contact: z.string().optional(),
    /* Versions successives d'un même devis. Une révision de périmètre n'est
       pas un devis neuf : le client garde son lien, et retrouve sous des
       onglets ce qu'on lui avait proposé avant. `versionDe` porte l'id de la
       V1 (ex. "unlockbreath/plateforme-3271"), qui reste l'URL publique du
       groupe ; les versions suivantes n'ont pas d'URL propre. La plus haute
       s'affiche par défaut, les précédentes restent lisibles à l'identique. */
    version: z.number().int().min(1).default(1),
    versionDe: z.string().optional(),
    envoi: z.object({ date: z.coerce.date(), destinataire: z.string() }).optional(),
    /* Identité de facturation du client, affichée dans le seul en-tête
       d'impression : le PDF part en pièce jointe, détaché de son URL, et
       un document commercial nomme celui à qui il s'adresse. Absent du
       rendu écran, où la page est déjà adressée par son lien privé. */
    destinataire: z
      .object({
        societe: z.string(),
        contact: z.string().optional(),
        adresse: z.array(z.string()),
      })
      .optional(),
    linear: z.object({ projet: z.string().optional(), affaire: z.string().optional() }).optional(),
    sections: z.array(
      z.object({
        titre: z.string(),
        texte: z.string().optional(),
        liste: z
          .array(
            z.union([z.string(), z.object({ texte: z.string(), tooltip: z.string().optional() })]),
          )
          .optional(),
        budget: z
          .object({
            lignes: z.array(
              z.object({
                label: z.string(),
                prix: z.number().optional(),
                tooltip: z.string().optional(),
                /* Ligne à la carte : le client la coche ou la décoche et le
                   total se recalcule sous ses yeux. Sans ce drapeau la ligne
                   est au socle, et rien ne permet de la retirer.

                   Il n'y a volontairement qu'un seul endroit où une option
                   vit : la section « En option » séparée recréait le défaut
                   d'origine — on coche ici, on lit le prix là-bas — et
                   l'effet « je compose selon mon budget » ne tient que si le
                   choix et le total sont dans le même champ de vision. */
                optionnel: z.boolean().default(false),
                /* État initial d'une option. Pré-cochée par défaut : décocher
                   est un geste actif, plus rare que cocher, donc le total
                   d'ouverture doit porter ce qu'on recommande.

                   À passer à `false` quand le socle consomme déjà le budget
                   annoncé par le client : un premier total au-dessus de son
                   budget lui fait peur avant de lui faire choisir (retex Vice
                   Versa du 2026-08-27). */
                defaut: z.boolean().default(true),
              }),
            ),
            /* Devis « en construction » : le périmètre n'est pas encore
               arrêté, donc aucun montant n'est annoncé. Les lignes restent
               visibles — elles disent ce qui sera chiffré — mais les totaux
               cèdent la place à un bandeau d'attente. Permet d'envoyer un
               premier jet au prospect, qui voit la structure de la proposition
               sans qu'on s'engage sur un prix. Le chiffrage vient après. */
            enAttente: z.boolean().default(false),
            remisePct: z.number().optional(),
            // Libellé de la ligne de remise. « Tarif association », « Geste
            // commercial »… Une remise nommée se valorise ; défaut neutre.
            remiseLabel: z.string().optional(),
            /* Remises en cascade, chacune calculée sur le montant déjà remisé
               par la précédente. Sert le cas d'un barème suivi d'un geste
               personnel : le client doit voir les deux efforts séparément,
               sinon le second se fond dans le premier et ne compte pour rien.
               `remisePct` / `remiseLabel` restent lus quand ce champ est
               absent — les devis déjà publiés n'ont pas à être réécrits. */
            remises: z.array(z.object({ label: z.string(), pct: z.number() })).optional(),
            mention: z.string().optional(), // suffixe des totaux, ex. « HT »
            reglement: z.string().optional(),
          })
          .optional(),
        // `options` : un seul planning la plupart du temps, mais peut porter
        // plusieurs scénarios de calendrier alternatifs (ex. démarrage
        // immédiat vs démarrage différé) affichés en petit sélecteur local ;
        // le premier est affiché par défaut.
        planning: z
          .object({
            options: z
              .array(
                z.object({
                  label: z.string(),
                  texte: z.string().optional(),
                  /* Pendant de `budget.enAttente` côté calendrier : les dates
                     sont là pour que le prospect se projette, pas pour
                     l'engager. Affiche un bandeau qui le dit, plutôt que de
                     laisser croire à un planning ferme. */
                  indicatif: z.boolean().default(false),
                  jalons: z.array(
                    z.object({
                      date: z.string(),
                      label: z.string(),
                      owner: z.enum(["coolbeans", "client"]).optional(),
                    }),
                  ),
                  note: z.string().optional(),
                }),
              )
              .min(1),
          })
          .optional(),
        // Image de schéma (sitemap, diagramme de flux Make…), cliquable vers
        // la version plein format (nouvel onglet). Générique : tous les devis
        // ne sont pas des refontes web (ex. automatisation Make × HubSpot).
        diagram: z.object({ image: z.string(), alt: z.string() }).optional(),
        // Remarque de fin de section, rendue après la liste ou le budget :
        // sert aux nuances qui n'ont de sens qu'une fois le contenu lu
        // (arbitrage possible, réserve, recommandation).
        note: z.string().optional(),
      }),
    ),
    notes: z
      .array(
        z.object({
          texte: z.string(),
          tooltip: z.string().optional(),
          tone: z.enum(["neutral", "info", "success", "warning", "error"]).default("info"),
        }),
      )
      .default([]),
  }),
});

/* Un fichier Markdown par étude de cas dans src/content/projets/ ; le nom du
   fichier devient le slug de l'URL (/projets/<fichier>). Rendu par
   src/pages/projets/[slug].astro.

   Le frontmatter YAML porte la fiche du projet (client, stack, captures,
   témoignage…) ; le corps Markdown porte le récit. Les captures sont
   optionnelles : absentes, le composant Browser affiche « capture à
   fournir ». `brouillon: true` publie la page en noindex, le temps de la
   validation. Schéma pensé pour migrer tel quel vers Sanity plus tard. */
const projets = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projets" }),
  schema: z.object({
    titre: z.string(),
    accroche: z.string(),
    numero: z.string().optional(), // « № 040 », même numérotation que data/cases.ts
    client: z.object({
      nom: z.string(),
      contact: z
        .object({
          nom: z.string(),
          role: z.string(),
          photo: z.string().optional(),
        })
        .optional(),
    }),
    secteur: z.string(),
    lieu: z.string().optional(),
    duree: z.string().optional(), // « 6 semaines », texte libre
    miseEnLigne: z.string().optional(), // « juin 2026 », texte libre
    url: z.string().url().optional(),
    prestations: z.array(z.string()).default([]),
    stack: z.array(z.string()).default([]),
    enBref: z.array(z.string()).default([]),
    hero: z.object({ shot: z.string().optional(), alt: z.string() }).optional(),
    avantApres: z
      .array(
        z.object({
          titre: z.string(),
          avant: z.object({ shot: z.string().optional(), alt: z.string() }),
          apres: z.object({ shot: z.string().optional(), alt: z.string() }),
        }),
      )
      .default([]),
    temoignage: z
      .object({
        texte: z.string(),
        auteur: z.string(),
        role: z.string(),
        photo: z.string().optional(),
      })
      .optional(),
    brouillon: z.boolean().default(false),
  }),
});

/* Un fichier MDX par page de doc de passation dans src/content/docs/<client>/ ;
   le préfixe numérique du fichier fixe l'ordre, le reste devient le slug de
   l'URL (/docs/<client>/<slug>). Rendu par src/pages/docs/[client]/[...slug].astro,
   derrière Clerk (voir src/middleware.ts). _template/ = gabarit du standard.
   1 client = 1 doc : ses projets successifs incrémentent la même doc. */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    client: z.string(), // clé client = dossier ("amusoire")
    title: z.string(),
    order: z.number(), // position dans la nav gauche
    status: z.enum(["draft", "review", "final"]).default("final"),
    updated: z.coerce.date(), // date de MAJ de la page
    description: z.string().optional(),
    /* Libère la max-width du bloc contenu sur cette page seulement. À réserver
       aux pages construites autour d'un tableau de données large : sur de la
       prose, la ligne devient illisible avant d'atteindre le bord de l'écran
       (d'où le plafond par défaut, cf. --portal-content dans doc.css). */
    pleineLargeur: z.boolean().default(false),
  }),
});

/* Un fichier YAML par client dans src/content/clients/ ; le nom du fichier est
   le slug du client. Source de vérité des mappings d'un client : sa doc, sa
   team Linear, ses monitors. Le publicMetadata Clerk ne porte plus qu'un
   pointeur `client` vers ce registre — voir
   docs/superpowers/specs/2026-08-12-selecteur-de-client-admin-design.md */
const clients = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/clients" }),
  schema: z.object({
    nom: z.string(),
    /* Slug du revendeur auquel ce client se rattache (spec 2026-08-19 §3.1) :
       une agence, un freelance, ou `coolbeans` pour un client direct.
       Obligatoire : sans lui un workspace n'appartient a personne, donc plus
       personne ne le voit — pas meme un admin, dont la portee est le registre
       entier mais dont le selecteur passe par l'organisation. */
    organisation: z.string(),
    // Prénom du contact principal : c'est lui que salue la topbar quand un
    // admin est basculé sur ce client (« vue client », retour du 2026-08-17).
    // Absent, la salutation retombe sur le nom du client.
    prenom: z.string().optional(),
    doc: z.string().optional(),
    // UUID de la team Linear du client : le formulaire support y crée ses
    // tickets. Absent = module Support en empty state (COO-30).
    linearTeamId: z.string().optional(),
    // Coupe la messagerie pour ce client sans rien supprimer d'autre. Depuis
    // que les tickets se marquent avec le label workspace « Support » au lieu
    // d'un projet par team (2026-08-19), la team Linear suffit à raccorder le
    // module : il faut donc un « non » explicite pour l'éteindre.
    messagerie: z.boolean().default(true),
    uptimerobot_monitor_ids: z.array(z.string()).default([]),
    // Workspace « à moi » (Coolbeans, Spinoza…) : en tête du sélecteur,
    // avant le liseret qui le sépare des workspaces clients.
    perso: z.boolean().default(false),
    // Emoji affiché devant le nom dans le sélecteur.
    emoji: z.string().optional(),
    /* Image affichée devant le nom, à la place de l'emoji : chemin depuis la
       racine publique (« /img/… »). Réservée aux marques dont le picto EST
       l'identité — Coolbeans. `logoSombre` porte la variante thème sombre ;
       absente, `logo` sert dans les deux thèmes. */
    logo: z.string().optional(),
    logoSombre: z.string().optional(),
    // Début de la relation client : fonde le tri chronologique du sélecteur.
    depuis: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    // Sort le client du sélecteur sans rien supprimer. Voir PortalWorkspace.
    archive: z.boolean().default(false),
  }),
});

/* Un fichier YAML par revendeur dans src/content/organisations/. Le nom du
   fichier est le slug, et c'est le MÊME slug que l'organisation en D1 : le
   registre est la source de vérité, la base porte la copie. Une divergence
   entre les deux est un bug, pas un cas à gérer — scripts/amorcer-organisations.mjs
   échoue dessus.
   Coolbeans y figure comme les autres : c'est ce qui fera sortir sa marque du
   code en phase B. */
const organisations = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/organisations" }),
  schema: z.object({
    nom: z.string(),
  }),
});

/* Un fichier YAML par document de cadrage dans
   src/content/cadrage/<client>/<projet>-<4 chiffres>.yaml ; le chemin devient
   l'URL (/cadrage/<client>/<projet>-1234). Rendu par
   src/pages/cadrage/[...slug].astro.

   C'est le document FRÈRE de la proposition commerciale, pas un de ses états.
   Il part AVANT de savoir s'il y aura une affaire : le devis engage un prix,
   le cadrage recueille un besoin et qualifie. Les fondre en un seul objet
   (spec 2026-08-19, amendée le 2026-09-05) obligeait à publier une page de
   devis pour quelqu'un qu'on n'avait pas encore qualifié.

   Trois blocs, dans cet ordre à l'écran :

   - `intro` réutilise la forme des sections du devis (titre, texte, liste) et
     se rend avec le même composant. Le gras s'écrit **comme en Markdown**.
   - `comparatif` est ce qui distingue ce document d'un formulaire : une
     colonne par solution possible, une ligne par critère, dont l'ordre de
     grandeur du coût. Le lead ne peut pas arbitrer entre son besoin et son
     budget si personne ne lui a dit ce que chaque voie implique.
   - `questions` vient après, et s'y réfère. */
const cadrage = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/cadrage" }),
  schema: z.object({
    titre: z.string(),
    objet: z.string(),
    date: z.coerce.date(),
    // Prénom du destinataire : ouvre l'accusé de réception, comme au devis.
    contact: z.string().optional(),
    /* Le formulaire vouvoie par défaut, parce qu'il est partagé par tous les
       clients. Sur un document dont les questions tutoient, ce mélange se lit
       à deux lignes d'écart : « Vos réponses » posé au-dessus de « Tes 1 500 à
       2 000 € ». Le drapeau bascule les seules phrases du composant qui portent
       un pronom ; les libellés, eux, viennent déjà du YAML. Relevé par Ludo le
       2026-09-10 sur le cadrage Sérial'Générations. */
    tutoiement: z.boolean().default(false),
    linear: z
      .object({
        projet: z.string().optional(),
        affaire: z.string().optional(),
        /* Issue d'origine, quand le cadrage naît d'une demande hors périmètre
           déjà tracée (« SET-16 »). Purement documentaire : rien n'est écrit
           dans Linear par ce module. */
        demande: z.string().optional(),
      })
      .optional(),
    /* Sections d'introduction, au format des sections de devis pour être
       rendues par DevisCorps sans dupliquer une mise en page. */
    intro: z.array(
      z.object({
        titre: z.string(),
        texte: z.string().optional(),
        liste: z
          .array(
            z.union([z.string(), z.object({ texte: z.string(), tooltip: z.string().optional() })]),
          )
          .optional(),
        note: z.string().optional(),
      }),
    ),
    comparatif: z
      .object({
        titre: z.string().default("Les solutions possibles"),
        texte: z.string().optional(),
        /* Une entrée par colonne. `recommandee` met la colonne en avant :
           un tableau qui ne dit pas ce qu'on conseille laisse le lead choisir
           au hasard, ce qui n'est pas l'aider. */
        solutions: z.array(
          z.object({
            nom: z.string(),
            resume: z.string().optional(),
            recommandee: z.boolean().default(false),
          }),
        ),
        /* Une entrée par ligne. `valeurs` est aligné sur `solutions`, dans le
           même ordre : une longueur différente est une erreur de rédaction, et
           le composant la signale au build plutôt que de décaler le tableau. */
        criteres: z.array(
          z.object({
            label: z.string(),
            valeurs: z.array(z.string()),
            tooltip: z.string().optional(),
          }),
        ),
        /* Fourchettes affichées avant d'avoir les réponses : elles ancrent le
           lead, donc elles se disent indicatives. Le texte par défaut le dit
           une fois, sous le tableau, plutôt que sur chaque cellule. */
        mentionCout: z
          .string()
          .default(
            "Ordres de grandeur donnés avant cadrage, à confirmer une fois vos réponses connues.",
          ),
      })
      .optional(),
    questions: z.array(
      z.object({
        /* Identifiant stable, seul élément qui voyage du navigateur au
           serveur. Les libellés sont relus dans ce YAML à la soumission : une
           question réécrite depuis la console n'arriverait jamais dans le
           mail. Même principe que les prix du devis. */
        id: z.string().regex(/^[a-z0-9-]+$/),
        label: z.string(),
        aide: z.string().optional(),
        type: z.enum(["choix", "texte"]),
        /* Marque les questions dont la réponse déplace le chiffrage. Elles
           remontent en tête du mail de notification, séparées du reste : sur
           neuf réponses, les trois qui décident du prix ne doivent pas se
           lire au même rang que les six autres. */
        decisif: z.boolean().default(false),
        requis: z.boolean().default(false),
        // type: choix
        multiple: z.boolean().default(false),
        options: z
          .array(z.object({ valeur: z.string(), label: z.string(), aide: z.string().optional() }))
          .optional(),
        /* Ajoute un « autre » à champ libre en fin de liste. Sans lui, une
           liste fermée force une réponse fausse plutôt qu'une réponse vraie. */
        autre: z.boolean().default(false),
        // type: texte
        long: z.boolean().default(false),
        placeholder: z.string().optional(),
      }),
    ),
    notes: z
      .array(
        z.object({
          texte: z.string(),
          tooltip: z.string().optional(),
          tone: z.enum(["neutral", "info", "success", "warning", "error"]).default("info"),
        }),
      )
      .default([]),
  }),
});

export const collections = { devis, cadrage, projets, docs, clients, organisations };
