/* ============================================================================
   COOLBEANS — Accusés de réception envoyés AU CLIENT après réponse à un devis.
   Deux variantes, même coquille que les autres transactionnels :
     - validation : annonce l'envoi de la facture d'acompte et ce qu'elle déclenche
     - question   : reprend le message et promet une réponse rapide
   Le pronom suit celui de la proposition (drapeau `tutoiement` du YAML), comme
   pour l'accusé du cadrage.
   L'email interne qui prévient Ludo est composé dans /api/devis-reponse.
   Chaque renderer retourne l'objet, le HTML et la version texte prêts pour Resend.
   ========================================================================== */

import {
  citation,
  esc,
  espace,
  kv,
  p,
  renderTransactionnel,
  titreSection,
} from "./transactionnel";

export interface DevisConfirmationProps {
  slug: string;
  /**
   * Prénom seul, jamais le nom complet : le « Bonjour » d'un accusé de réception
   * se veut chaleureux. Obligatoire côté formulaire et côté API, donc pas de
   * formulation de repli ici.
   */
  prenom: string;
  message?: string;
  /** Récap de facturation, repris tel quel du formulaire (variante validation). */
  raisonSociale?: string;
  siren?: string;
  adresse?: string;
  tva?: string;
  /** Pronom de la proposition. Cf. content.config.ts. */
  tutoiement?: boolean;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

const urlDevis = (slug: string): string =>
  `https://coolbeans.cc/devis/${encodeURIComponent(slug)}`;

const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        pied: "Tu re&ccedil;ois cet email suite &agrave; ta r&eacute;ponse sur coolbeans.cc.",
        validation: {
          preheader: "Ta validation est bien enregistrée, je t'envoie la facture d'acompte.",
          accuse:
            "Ta validation de la proposition est bien enregistrée. Merci pour ta confiance, j'ai hâte de commencer.",
          suite: "je t'envoie la facture d'acompte pour règlement.",
          reglement:
            "Son règlement valide la prestation et bloque tes créneaux dans mon planning. Ensuite, on démarre.",
          recap: "Les informations que tu m'as transmises",
          message: "Ton message",
          correction: "Une coquille dans ces informations, ou une question&nbsp;? Réponds simplement à cet email.",
          correctionTexte: "Une coquille dans ces informations, ou une question ? Réponds simplement à cet email.",
        },
        question: {
          preheader: "Ton message est bien arrivé, je reviens vers toi très vite.",
          accuse:
            "Ton message est bien arrivé. Je le lis attentivement et je reviens vers toi très vite avec une réponse.",
          recap: "Ce que tu m'as écrit",
          engage:
            "Rien n'est engagé tant que tu n'as pas validé la proposition. Si tu veux ajouter quelque chose, réponds simplement à cet email.",
          objet: "je te réponds vite",
        },
      }
    : {
        pied: "Vous recevez cet email suite &agrave; votre r&eacute;ponse sur coolbeans.cc.",
        validation: {
          preheader: "Votre validation est bien enregistrée, je vous envoie la facture d'acompte.",
          accuse:
            "Votre validation de la proposition est bien enregistrée. Merci pour votre confiance, j'ai hâte de commencer.",
          suite: "je vous envoie la facture d'acompte pour règlement.",
          reglement:
            "Son règlement valide la prestation et bloque vos créneaux dans mon planning. Ensuite, on démarre.",
          recap: "Les informations que vous m'avez transmises",
          message: "Votre message",
          correction: "Une coquille dans ces informations, ou une question&nbsp;? Répondez simplement à cet email.",
          correctionTexte: "Une coquille dans ces informations, ou une question ? Répondez simplement à cet email.",
        },
        question: {
          preheader: "Votre message est bien arrivé, je reviens vers vous très vite.",
          accuse:
            "Votre message est bien arrivé. Je le lis attentivement et je reviens vers vous très vite avec une réponse.",
          recap: "Ce que vous m'avez écrit",
          engage:
            "Rien n'est engagé tant que vous n'avez pas validé la proposition. Si vous voulez ajouter quelque chose, répondez simplement à cet email.",
          objet: "je vous réponds vite",
        },
      };

/** Accusé de réception quand le client valide la proposition. */
export function renderConfirmationValidation(props: DevisConfirmationProps): EmailPret {
  const { slug, prenom, message, raisonSociale, siren, adresse, tva, tutoiement = false } = props;
  const lien = urlDevis(slug);
  const t = textes(tutoiement);
  const v = t.validation;

  const html = renderTransactionnel({
    preheader: v.preheader,
    kicker: `Devis · ${esc(slug)}`,
    titre: "Merci, c'est validé !",
    contenu: [
      p(`Bonjour ${esc(prenom)},`),
      p(v.accuse),
      p(`<strong>La suite&nbsp;:</strong> ${v.suite}`),
      p(v.reglement),
      titreSection(v.recap),
      kv([
        ["Raison sociale", raisonSociale && esc(raisonSociale)],
        ["SIREN", siren && esc(siren)],
        ["Adresse", adresse && esc(adresse)],
        ["TVA intracom.", tva && esc(tva)],
      ]),
      message
        ? titreSection(v.message) + citation(esc(message).replace(/\n/g, "<br>"))
        : espace(28),
      p(v.correction),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le devis", url: lien },
    piedContexte: t.pied,
  });

  const text = [
    `Bonjour ${prenom},`,
    "",
    v.accuse,
    "",
    `La suite : ${v.suite} ${v.reglement}`,
    "",
    `${v.recap} :`,
    raisonSociale ? `- Raison sociale : ${raisonSociale}` : null,
    siren ? `- SIREN : ${siren}` : null,
    adresse ? `- Adresse : ${adresse}` : null,
    tva ? `- TVA intracommunautaire : ${tva}` : null,
    message ? "" : null,
    message ? `${v.message} :\n${message}` : null,
    "",
    v.correctionTexte,
    "",
    `Revoir le devis : ${lien}`,
    "",
    "À très vite,",
    "Ludo",
  ]
    .filter((ligne) => ligne !== null)
    .join("\n");

  return { subject: `Devis ${slug} : merci, c'est validé`, html, text };
}

/** Accusé de réception quand le client pose une question ou fait une remarque. */
export function renderConfirmationQuestion(props: DevisConfirmationProps): EmailPret {
  const { slug, prenom, message, tutoiement = false } = props;
  const lien = urlDevis(slug);
  const t = textes(tutoiement);
  const q = t.question;

  const html = renderTransactionnel({
    preheader: q.preheader,
    kicker: `Devis · ${esc(slug)}`,
    titre: "Bien reçu, je regarde ça",
    contenu: [
      p(`Bonjour ${esc(prenom)},`),
      p(q.accuse),
      message ? titreSection(q.recap) : "",
      message ? citation(esc(message).replace(/\n/g, "<br>")) : "",
      p(q.engage),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le devis", url: lien },
    piedContexte: t.pied,
  });

  const text = [
    `Bonjour ${prenom},`,
    "",
    q.accuse,
    message ? "" : null,
    message ? `${q.recap} :\n${message}` : null,
    "",
    q.engage,
    "",
    `Revoir le devis : ${lien}`,
    "",
    "À très vite,",
    "Ludo",
  ]
    .filter((ligne) => ligne !== null)
    .join("\n");

  return { subject: `Devis ${slug} : bien reçu, ${q.objet}`, html, text };
}
