/* ============================================================================
   COOLBEANS — Accusés de réception envoyés AU CLIENT après réponse à un devis.
   Deux variantes, même coquille que les autres transactionnels :
     - validation : annonce l'envoi de la facture d'acompte et ce qu'elle déclenche
     - question   : reprend le message et promet une réponse rapide
   L'email interne qui prévient Ludo est composé dans /api/devis-reponse.
   Chaque renderer retourne l'objet, le HTML et la version texte prêts pour Resend.
   ========================================================================== */

import { esc, kv, p, renderTransactionnel, sep } from "./transactionnel";

export interface DevisConfirmationProps {
  slug: string;
  nom?: string;
  message?: string;
  /** Récap de facturation, repris tel quel du formulaire (variante validation). */
  raisonSociale?: string;
  siren?: string;
  adresse?: string;
  tva?: string;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

const urlDevis = (slug: string): string =>
  `https://coolbeans.cc/devis/${encodeURIComponent(slug)}`;

const bonjour = (nom?: string): string => (nom ? `Bonjour ${esc(nom)},` : "Bonjour,");
const bonjourTexte = (nom?: string): string => (nom ? `Bonjour ${nom},` : "Bonjour,");

const PIED = "Vous recevez cet email suite &agrave; votre r&eacute;ponse sur coolbeans.cc.";

/** Accusé de réception quand le client valide la proposition. */
export function renderConfirmationValidation(props: DevisConfirmationProps): EmailPret {
  const { slug, nom, message, raisonSociale, siren, adresse, tva } = props;
  const lien = urlDevis(slug);

  const html = renderTransactionnel({
    preheader: "Votre validation est bien enregistrée, je vous envoie la facture d'acompte.",
    kicker: `Devis · ${esc(slug)}`,
    titre: "Merci, c'est validé !",
    contenu: [
      p(bonjour(nom)),
      p(
        "Votre validation de la proposition est bien enregistrée. Merci pour votre confiance, j'ai hâte de commencer.",
      ),
      p("<strong>La suite&nbsp;:</strong> je vous envoie la facture d'acompte pour règlement."),
      p(
        "Son règlement valide la prestation et bloque vos créneaux dans mon planning. Ensuite, on démarre.",
      ),
      sep(),
      p("<strong>Les informations que vous m'avez transmises</strong>"),
      kv([
        ["Raison sociale", raisonSociale && esc(raisonSociale)],
        ["SIREN", siren && esc(siren)],
        ["Adresse", adresse && esc(adresse)],
        ["TVA intracom.", tva && esc(tva)],
      ]),
      message ? p("<strong>Votre message</strong>") + p(esc(message).replace(/\n/g, "<br>")) : "",
      p("Une coquille dans ces informations, ou une question&nbsp;? Répondez simplement à cet email."),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le devis", url: lien },
    piedContexte: PIED,
  });

  const text = [
    bonjourTexte(nom),
    "",
    "Votre validation de la proposition est bien enregistrée. Merci pour votre confiance, j'ai hâte de commencer.",
    "",
    "La suite : je vous envoie la facture d'acompte pour règlement. Son règlement valide la prestation et bloque vos créneaux dans mon planning. Ensuite, on démarre.",
    "",
    "Les informations que vous m'avez transmises :",
    raisonSociale ? `- Raison sociale : ${raisonSociale}` : null,
    siren ? `- SIREN : ${siren}` : null,
    adresse ? `- Adresse : ${adresse}` : null,
    tva ? `- TVA intracommunautaire : ${tva}` : null,
    message ? "" : null,
    message ? `Votre message :\n${message}` : null,
    "",
    "Une coquille dans ces informations, ou une question ? Répondez simplement à cet email.",
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
  const { slug, nom, message } = props;
  const lien = urlDevis(slug);

  const html = renderTransactionnel({
    preheader: "Votre message est bien arrivé, je reviens vers vous très vite.",
    kicker: `Devis · ${esc(slug)}`,
    titre: "Bien reçu, je regarde ça",
    contenu: [
      p(bonjour(nom)),
      p(
        "Votre message est bien arrivé. Je le lis attentivement et je reviens vers vous très vite avec une réponse.",
      ),
      message ? sep() + p("<strong>Ce que vous m'avez écrit</strong>") : "",
      message ? p(esc(message).replace(/\n/g, "<br>")) : "",
      message ? sep() : "",
      p(
        "Rien n'est engagé tant que vous n'avez pas validé la proposition. Si vous voulez ajouter quelque chose, répondez simplement à cet email.",
      ),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le devis", url: lien },
    piedContexte: PIED,
  });

  const text = [
    bonjourTexte(nom),
    "",
    "Votre message est bien arrivé. Je le lis attentivement et je reviens vers vous très vite avec une réponse.",
    message ? "" : null,
    message ? `Ce que vous m'avez écrit :\n${message}` : null,
    "",
    "Rien n'est engagé tant que vous n'avez pas validé la proposition. Si vous voulez ajouter quelque chose, répondez simplement à cet email.",
    "",
    `Revoir le devis : ${lien}`,
    "",
    "À très vite,",
    "Ludo",
  ]
    .filter((ligne) => ligne !== null)
    .join("\n");

  return { subject: `Devis ${slug} : bien reçu, je vous réponds vite`, html, text };
}
