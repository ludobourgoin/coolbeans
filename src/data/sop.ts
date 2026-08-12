/**
 * SOP commercial Coolbeans : le cycle de vie d'une affaire, du premier contact
 * à l'après-vente. Source de vérité du process — aucun rendu, aucun style.
 * Voir docs/superpowers/specs/2026-08-12-sop-commercial-design.md
 *
 * Deux étages cohabitent : le vivier (phase `amont`, une feuille Google tenue à
 * part) et le pipeline (le projet Asana `🎯 crm`). Une carte CRM ne naît que
 * lorsqu'un projet réel est identifié.
 *
 * Le rendu est data-driven : ajouter une étape ici suffit à la faire apparaître
 * dans le schéma et dans les fiches, sans retoucher Sop.astro.
 *
 * Convention structurante : une carte du CRM représente une affaire. Elle n'a
 * ni date d'échéance ni case à cocher — elle avance de colonne, puis se ferme.
 * Ce sont ses SOUS-TÂCHES qui portent la date et l'assignation, remontent dans
 * « Mes tâches » et se cochent. C'est ce que décrit le champ `echeance`.
 */

export type Phase =
  | "amont" // S0 : le vivier, en amont du pipeline
  | "avant-vente"
  | "signature"
  | "production"
  | "apres-vente"
  | "sortie"; // S20 et S21 : mise en veille et perte, hors des quatre phases

export type Owner = "coolbeans" | "client" | "les-deux";

export interface PhaseDef {
  id: Phase;
  nom: string;
  resume: string;
}

export interface Etape {
  id: string; // "S5"
  phase: Phase;
  titre: string;
  colonneCrm?: string; // absent si l'étape n'a pas d'état CRM
  declencheur: string; // ce qui fait entrer dans l'étape
  qui: Owner;
  outils: string[];
  faire: string[]; // actions concrètes, à l'impératif
  sortie: string; // ce qui prouve que l'étape est finie
  echeance?: string; // la sous-tâche « prochaine action » à assigner et à dater
  suivants: { vers: string; si: string }[];
  note?: string;
}

/** Colonne du projet Asana `🎯 crm`, dans l'ordre du board. `changement`
 *  documente la restructuration en cours ; il disparaîtra une fois faite. */
export interface ColonneCrm {
  nom: string;
  changement: "inchangée" | "ajoutée";
}

/** L'ordre fait foi : `amont` d'abord, `sortie` en dernier. Les quatre phases
 *  intermédiaires forment les colonnes du schéma. */
export const phases: PhaseDef[] = [
  {
    id: "amont",
    nom: "Amont",
    resume: "Le vivier : des relations à entretenir, pas des affaires en cours.",
  },
  {
    id: "avant-vente",
    nom: "Avant-vente",
    resume: "Du premier contact au devis accepté. C'est ici qu'on filtre.",
  },
  {
    id: "signature",
    nom: "Signature",
    resume: "La commande devient ferme et l'acompte tombe. Rien ne démarre avant.",
  },
  {
    id: "production",
    nom: "Production",
    resume: "Le travail, dans le projet Asana du client. La carte CRM attend.",
  },
  {
    id: "apres-vente",
    nom: "Après-vente",
    resume: "La carte CRM est close. Tout se passe dans le projet du client.",
  },
  {
    id: "sortie",
    nom: "Sorties",
    resume: "Une affaire qui ne va pas au bout sort par l'une de ces deux portes.",
  },
];

export const colonnesCrm: ColonneCrm[] = [
  { nom: "👋 Contacté", changement: "inchangée" },
  { nom: "📆 Rdv pris", changement: "inchangée" },
  { nom: "🎯 Besoins définis", changement: "inchangée" },
  { nom: "📝 Devis envoyé", changement: "inchangée" },
  { nom: "☄️ Lead relancé", changement: "inchangée" },
  { nom: "💪 Négo entamée", changement: "inchangée" },
  { nom: "🚀 Acompte réglé", changement: "inchangée" },
  { nom: "🏗️ En production", changement: "ajoutée" },
  { nom: "📝 Facture de solde envoyée", changement: "inchangée" },
  { nom: "✅ Facture de solde réglée", changement: "inchangée" },
  { nom: "🧊 En veille", changement: "ajoutée" },
  { nom: "🪦 PERDU", changement: "inchangée" },
  { nom: "🧰 Modèles", changement: "ajoutée" },
];

export const etapes: Etape[] = [
  // ---- Amont ---------------------------------------------------------------
  {
    id: "S0",
    phase: "amont",
    titre: "Vivier de prospection",
    declencheur:
      "Une personne ou une structure vaut la peine d'être connue : entourage, agence repérée, directeur artistique visé pour une collaboration.",
    qui: "coolbeans",
    outils: ["Feuille Google « vivier »", "Asana — Mes tâches"],
    faire: [
      "L'ajouter à la feuille avec sa date de dernier contact et sa prochaine action.",
      "La contacter pour faire savoir que Coolbeans existe.",
      "Entretenir la relation dans la durée : nouvelles, recommandations, contenus.",
    ],
    sortie: "Rien tant qu'aucun projet n'est évoqué. Le vivier n'a pas vocation à se vider.",
    echeance:
      "Tâche récurrente mensuelle dans « Mes tâches » d'Asana, hors de tout projet, pour relire la feuille.",
    suivants: [{ vers: "S1", si: "un contact du vivier remonte un projet réel" }],
    note: "Ces contacts n'entrent jamais dans le CRM tant qu'il n'y a pas de projet identifié. C'est la frontière entre les deux étages : verser le vivier dans le pipeline noierait la colonne 👋 Contacté sous des dizaines de cartes dormantes.",
  },

  // ---- Avant-vente ---------------------------------------------------------
  {
    id: "S1",
    phase: "avant-vente",
    titre: "Premier contact",
    colonneCrm: "👋 Contacté",
    declencheur:
      "Un projet réel est évoqué. Deux sources : entrante (appel, mail, réservation d'un créneau depuis la page de contact) ou issue du vivier.",
    qui: "coolbeans",
    outils: ["Asana — 🎯 crm", "Notion Calendar"],
    faire: [
      "Dupliquer 🧬 [MODÈLE] Lead depuis 🧰 Modèles, la renommer « [budget évoqué €] Client — Objet » et la déposer en 👋 Contacté.",
      "Poser l'étiquette de source : source-inbound, source-recommandation ou source-prospection.",
      "Coller le contexte de l'échange dans la description de la carte.",
      "Envoyer le lien de réservation Notion Calendar.",
    ],
    sortie: "Lien de réservation envoyé.",
    echeance:
      "« Envoyer le lien de réservation », assignée et datée à J+2 : relance si aucun créneau n'est réservé.",
    suivants: [
      { vers: "S2", si: "un créneau est réservé" },
      { vers: "S20", si: "le client dit « plus tard »" },
      { vers: "S21", si: "hors cible, ou silence après deux relances" },
    ],
    note: "La carte naît ici, avant le rendez-vous, et non après. Le coût est de vingt secondes ; le gain est de pouvoir relancer ceux qui disparaissent entre la prise de contact et le rendez-vous, et de connaître le taux de transformation en haut de tunnel.",
  },
  {
    id: "S2",
    phase: "avant-vente",
    titre: "Rendez-vous pris",
    colonneCrm: "📆 Rdv pris",
    declencheur: "Le client a réservé un créneau.",
    qui: "coolbeans",
    outils: ["Asana — 🎯 crm", "Notion Calendar"],
    faire: [
      "Cocher « Envoyer le lien de réservation ».",
      "Dater « Faire le rendez-vous de découverte » au jour du créneau réservé.",
      "Préparer : site actuel, secteur, concurrents, questions à poser.",
    ],
    sortie: "Rendez-vous en agenda, préparation faite.",
    echeance: "« Faire le rendez-vous de découverte », datée au jour du créneau.",
    suivants: [{ vers: "S3", si: "le rendez-vous a lieu" }],
  },
  {
    id: "S3",
    phase: "avant-vente",
    titre: "Rendez-vous de découverte",
    colonneCrm: "📆 Rdv pris",
    declencheur: "L'heure du rendez-vous.",
    qui: "les-deux",
    outils: ["Notion Calendar", "Asana — 🎯 crm"],
    faire: [
      "Cadrer le besoin, le budget, l'échéance, et vérifier qu'on parle au décideur.",
      "Annoncer la suite et le délai d'envoi du devis.",
      "Demander l'accord de principe pour présenter le projet en étude de cas.",
      "Cocher « Qualifier » et « Faire le rendez-vous de découverte ».",
    ],
    sortie: "Trois issues possibles : qualifié, reporté, ou hors cible.",
    echeance: "« Cadrer le périmètre et chiffrer », datée au délai d'envoi du devis annoncé.",
    suivants: [
      { vers: "S4", si: "l'affaire est qualifiée" },
      { vers: "S20", si: "l'affaire est reportée, avec une date de rappel" },
      { vers: "S21", si: "l'affaire est hors cible" },
    ],
    note: "C'est le premier vrai filtre. Une affaire non qualifiée ne reste pas dans le pipeline.",
  },
  {
    id: "S4",
    phase: "avant-vente",
    titre: "Besoins définis",
    colonneCrm: "🎯 Besoins définis",
    declencheur: "L'affaire est qualifiée à l'issue du rendez-vous de découverte.",
    qui: "coolbeans",
    outils: ["Asana — 🎯 crm"],
    faire: [
      "Arrêter le périmètre inclus et le périmètre exclu.",
      "Chiffrer.",
      "Construire l'échéancier — acompte de 30 %, éventuelles factures intermédiaires, solde — chaque ligne datée.",
      "Construire le planning de jalons.",
      "Cocher « Cadrer le périmètre et chiffrer », reporter le montant obtenu dans le titre de la carte.",
    ],
    sortie: "Chiffrage et échéancier arrêtés.",
    echeance: "« Rédiger et publier le devis », datée au jour d'envoi promis.",
    suivants: [{ vers: "S5", si: "le chiffrage est prêt" }],
  },
  {
    id: "S5",
    phase: "avant-vente",
    titre: "Devis envoyé",
    colonneCrm: "📝 Devis envoyé",
    declencheur: "Le chiffrage et l'échéancier sont arrêtés.",
    qui: "coolbeans",
    outils: ["src/content/devis/<slug>.yaml", "Page publique /devis/<slug>", "Asana — 🎯 crm"],
    faire: [
      "Rédiger le YAML : sections, budget, planning, notes.",
      "Vérifier que l'échéancier figure ligne par ligne avec ses dates.",
      "Vérifier que le bloc d'acceptation des CGV est présent.",
      "Publier et envoyer le lien.",
    ],
    sortie: "Le client a reçu le lien du devis.",
    echeance:
      "« Relancer à J+3, J+7, J+14 », redatée à chaque tour ; l'étiquette ☄️ relance-n se pose sur la carte.",
    suivants: [
      { vers: "S6", si: "le client répond" },
      { vers: "S20", si: "le client annonce un report" },
      { vers: "S21", si: "silence total après la relance 3" },
    ],
    note: "Une fois la première relance partie, la carte passe en ☄️ Lead relancé et y reste tant qu'aucune réponse n'arrive : la colonne dit « j'ai relancé, j'attends », l'étiquette ☄️ relance-n dit combien de fois, la sous-tâche datée dit quand est la suivante.",
  },
  {
    id: "S6",
    phase: "avant-vente",
    titre: "Négociation",
    colonneCrm: "💪 Négo entamée",
    declencheur:
      "Le client répond par une question ou une objection — réponse « question » sur la page de devis.",
    qui: "les-deux",
    outils: ["Page /devis/<slug>", "src/content/devis/<slug>.yaml"],
    faire: [
      "Répondre à l'objection.",
      "Réviser le devis si besoin, en publiant une nouvelle version du YAML.",
      "Ne jamais baisser le prix sans retirer du périmètre.",
    ],
    sortie: "Nouvelle version envoyée, ou accord.",
    suivants: [
      { vers: "S7", si: "le client valide le devis" },
      { vers: "S21", si: "désaccord définitif sur le prix ou le périmètre" },
    ],
  },

  // ---- Signature -----------------------------------------------------------
  {
    id: "S7",
    phase: "signature",
    titre: "Validation du devis",
    declencheur:
      "Le client valide sur la page de devis, ce qui transmet raison sociale, SIREN, adresse, TVA et l'acceptation des CGV.",
    qui: "client",
    outils: ["Page /devis/<slug>", "Boîte mail"],
    faire: [
      "Archiver le mail de notification : c'est la preuve contractuelle — horodatage, version des CGV acceptée, identité de facturation.",
    ],
    sortie: "Commande ferme.",
    suivants: [{ vers: "S8", si: "la commande est ferme" }],
  },
  {
    id: "S8",
    phase: "signature",
    titre: "Facture d'acompte",
    declencheur: "La commande est ferme.",
    qui: "coolbeans",
    outils: ["Tiime"],
    faire: [
      "Créer le client dans Tiime avec les informations reçues.",
      "Émettre la facture d'acompte de 30 %.",
      "Saisir les échéances suivantes aux dates du devis.",
    ],
    sortie: "Facture d'acompte envoyée, échéancier saisi dans Tiime.",
    echeance: "« Vérifier l'encaissement de l'acompte », datée à l'échéance de la facture.",
    suivants: [{ vers: "S9", si: "la facture est envoyée" }],
    note: "Rien ne démarre avant encaissement.",
  },
  {
    id: "S9",
    phase: "signature",
    titre: "Acompte encaissé",
    colonneCrm: "🚀 Acompte réglé",
    declencheur: "L'acompte est crédité sur le compte.",
    qui: "client",
    outils: ["Tiime", "Asana — 🎯 crm"],
    faire: [
      "Cocher « Vérifier l'encaissement de l'acompte ».",
      "Déplacer la carte en 🚀 Acompte réglé.",
    ],
    sortie: "Feu vert de production. C'est le seul déclencheur du démarrage.",
    suivants: [{ vers: "S10", si: "l'acompte est encaissé" }],
  },

  // ---- Production ----------------------------------------------------------
  {
    id: "S10",
    phase: "production",
    titre: "Onboarding",
    colonneCrm: "🏗️ En production",
    declencheur: "L'acompte est encaissé.",
    qui: "coolbeans",
    outils: ["Asana", "Google Drive", "Clerk", "src/content/clients/<slug>.yaml"],
    faire: [
      "Créer la team Asana du client.",
      "Dupliquer 🧱 [MODÈLE] Projet client dans cette team, renommer, dater les jalons et les tâches d'après-vente.",
      "Créer src/content/clients/<slug>.yaml avec nom, asana_team_gid et doc.",
      "Créer l'utilisateur Clerk avec le mail du contact et son publicMetadata.",
      "Créer le dossier Drive et le lier dans les notes du projet Asana.",
      "Envoyer le mail de bienvenue : accès au portail, canal de communication, rythme des points, qui fait quoi, ce qui est attendu du client.",
    ],
    sortie: "Le client peut se connecter au portail, le projet Asana est prêt.",
    suivants: [{ vers: "S11", si: "l'onboarding est terminé" }],
    note: "Les six actions sont dans l'ordre : la team Asana conditionne la duplication du projet, dont le GID alimente la fiche client, qui conditionne le portail.",
  },
  {
    id: "S11",
    phase: "production",
    titre: "Exécution",
    declencheur: "L'onboarding est terminé.",
    qui: "les-deux",
    outils: ["Asana — projet du client", "Portail client"],
    faire: [
      "Travailler par sprints.",
      "Faire traverser aux tâches : 🧱 Backlog, 🚀 Sprint, 🚧 En cours, ☝️ Pour validation, ✅ Terminé.",
      "Tenir le point client au rythme convenu.",
      "Envoyer toute demande hors périmètre en 📥 Inbox et la traiter par avenant.",
    ],
    sortie: "Le périmètre du devis est réalisé.",
    suivants: [
      { vers: "S12", si: "une échéance de facturation intermédiaire tombe" },
      { vers: "S13", si: "le périmètre du devis est réalisé" },
    ],
    note: "La carte CRM ne bouge plus : elle attend en 🏗️ En production.",
  },
  {
    id: "S12",
    phase: "production",
    titre: "Facturation intermédiaire",
    declencheur: "Une date de facturation prévue au devis arrive.",
    qui: "coolbeans",
    outils: ["Tiime"],
    faire: [
      "Émettre chaque facture à la date prévue au devis.",
      "Ne pas décaler une échéance parce que le client tarde à répondre.",
    ],
    sortie: "Facture émise à la date convenue.",
    suivants: [{ vers: "S13", si: "la production se poursuit jusqu'à la recette" }],
    note: "Les échéances sont fermes et indépendantes de l'avancement, sauf retard imputable à Coolbeans. Un client qui tarde à répondre paie quand même aux dates convenues.",
  },
  {
    id: "S13",
    phase: "production",
    titre: "Recette et mise en ligne",
    declencheur: "Le périmètre du devis est réalisé.",
    qui: "les-deux",
    outils: ["Asana — projet du client", "Plateforme d'hébergement du site"],
    faire: [
      "Faire la recette avec le client sur la base du périmètre du devis, uniquement.",
      "Corriger.",
      "Mettre en ligne.",
    ],
    sortie: "Le site ou les fonctionnalités tournent en production.",
    suivants: [{ vers: "S14", si: "la mise en ligne est faite" }],
  },
  {
    id: "S14",
    phase: "production",
    titre: "Doc de passation",
    declencheur: "La mise en ligne est faite.",
    qui: "coolbeans",
    outils: ["src/content/docs/<client>/", "Gabarit src/content/docs/_template/"],
    faire: [
      "Créer src/content/docs/<client>/ depuis _template.",
      "Remplir les pages.",
      "Passer les pages en status: final.",
      "Assurer la formation si elle était prévue au devis.",
    ],
    sortie: "La doc du client est publiée et accessible depuis son portail.",
    suivants: [{ vers: "S15", si: "la doc est complète" }],
    note: "Cette doc est technique. Elle ne contient rien du fonctionnement interne de Coolbeans.",
  },
  {
    id: "S15",
    phase: "production",
    titre: "Mail de livraison",
    declencheur: "La doc de passation est prête.",
    qui: "coolbeans",
    outils: ["Boîte mail", "Portail client"],
    faire: [
      "Récapituler les livrables.",
      "Rappeler la garantie de 30 jours, avec sa date de fin explicite.",
      "Poser les trois questions du témoignage : « qu'est-ce qui posait problème avant ? », « qu'est-ce qui a changé ? », « à qui le recommanderais-tu ? ».",
      "Donner les liens vers la doc et le portail.",
    ],
    sortie: "Projet livré, garantie ouverte.",
    suivants: [{ vers: "S16", si: "le mail est parti" }],
    note: "Trois questions courtes obtiennent bien plus de réponses qu'une demande de témoignage libre, et fournissent une matière directement utilisable dans l'étude de cas.",
  },
  {
    id: "S16",
    phase: "production",
    titre: "Facture de solde",
    colonneCrm: "📝 Facture de solde envoyée, puis ✅ Facture de solde réglée",
    declencheur: "Le projet est livré.",
    qui: "coolbeans",
    outils: ["Tiime", "Asana — 🎯 crm"],
    faire: [
      "Émettre le solde dans Tiime.",
      "Relancer à J+8 et J+15.",
      "Passer en mise en demeure au-delà.",
    ],
    sortie: "Solde réglé. La carte CRM se ferme ici.",
    echeance:
      "« Émettre la facture de solde » dans le projet client, puis une relance redatée à J+8 et J+15.",
    suivants: [{ vers: "S17", si: "le solde est réglé" }],
  },

  // ---- Après-vente ---------------------------------------------------------
  {
    id: "S17",
    phase: "apres-vente",
    titre: "Fin de garantie à J+30",
    declencheur: "Trente jours après la livraison.",
    qui: "les-deux",
    outils: ["Asana — projet du client"],
    faire: [
      "Faire le point de clôture.",
      "Lister les bugs traités pendant la garantie.",
      "Proposer le care plan : 65 €/h au lieu de 90 €/h.",
    ],
    sortie: "Garantie close, care plan proposé.",
    echeance:
      "« J+30 : clôture de la garantie et proposition du care plan », du projet client, datée dès la livraison.",
    suivants: [{ vers: "S18", si: "la garantie est close" }],
    note: "Le contenu exact de l'offre de care plan n'est pas arrêté. Le SOP décrit le moment et l'intention ; la définition des formules est un chantier séparé.",
  },
  {
    id: "S18",
    phase: "apres-vente",
    titre: "Étude de cas",
    declencheur: "Le projet est livré et la garantie close.",
    qui: "les-deux",
    outils: ["src/content/projets/<slug>.md", "Sitemap et métadonnées du site"],
    faire: [
      "Rédiger src/content/projets/<slug>.md avec brouillon: true.",
      "Y intégrer le témoignage récolté à la livraison.",
      "Envoyer au client pour validation du contenu.",
      "Publier en passant brouillon: false.",
      "Mettre à jour le sitemap et les métadonnées.",
    ],
    sortie: "Étude de cas en ligne.",
    suivants: [{ vers: "S19", si: "l'étude de cas est publiée" }],
    note: "L'autorisation de principe a été donnée au devis. Ici, seul le contenu se valide.",
  },
  {
    id: "S19",
    phase: "apres-vente",
    titre: "Suivi",
    declencheur: "L'étude de cas est publiée, le client entre en vie courante.",
    qui: "coolbeans",
    outils: ["Asana — projet du client", "Notion Calendar"],
    faire: [
      "Tenir un point trimestriel.",
      "Faire la veille sur les opportunités : nouvelle page, refonte, automatisation, care plan.",
    ],
    sortie: "Relation entretenue, opportunités repérées.",
    suivants: [
      { vers: "S1", si: "une nouvelle opportunité est identifiée : une nouvelle carte CRM naît" },
    ],
  },

  // ---- Sorties latérales ---------------------------------------------------
  {
    id: "S20",
    phase: "sortie",
    titre: "En veille",
    colonneCrm: "🧊 En veille",
    declencheur: "Le client repousse : « pas maintenant, rappelle-moi en septembre ».",
    qui: "coolbeans",
    outils: ["Asana — 🎯 crm"],
    faire: [
      "Déplacer la carte en 🧊 En veille.",
      "Créer la sous-tâche « Relancer », se l'assigner et la dater au jour du rappel convenu.",
      "Noter en commentaire ce qui bloque et ce qui débloquerait.",
    ],
    sortie: "Carte dormante, mais tenue par une sous-tâche datée.",
    echeance:
      "« Relancer », datée au jour convenu. Sans sous-tâche datée, la carte bascule en 🪦 PERDU.",
    suivants: [
      { vers: "S1", si: "la date de rappel arrive et le projet redémarre" },
      { vers: "S21", si: "la date passe sans nouvelle, ou aucune date n'a été posée" },
    ],
    note: "🧊 En veille sépare « pas maintenant » de « perdu ». Mélangées, les affaires reportées ne sont jamais rouvertes.",
  },
  {
    id: "S21",
    phase: "sortie",
    titre: "Perdu",
    colonneCrm: "🪦 PERDU",
    declencheur: "L'affaire ne se fera pas : hors cible, prix, timing, concurrent, silence.",
    qui: "coolbeans",
    outils: ["Asana — 🎯 crm"],
    faire: [
      "Déplacer la carte en 🪦 PERDU.",
      "Noter la raison en commentaire : prix, timing, concurrent, silence, hors cible.",
    ],
    sortie: "Affaire close, raison tracée.",
    suivants: [],
    note: "Sur le plan gratuit, la raison de perte est la seule donnée exploitable pour améliorer le taux de transformation.",
  },
];
