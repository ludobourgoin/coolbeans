/* ============================================================================
   COOLBEANS · Accusé de réception envoyé AU CLIENT après une réponse au
   livrable. Même coquille que les autres transactionnels.

   Deux branches : la validation, qui annonce la suite (mise en ligne), et les
   retours, dont le mail rend le texte au client pour qu'il garde une trace de
   ce qu'il a demandé. L'email interne qui prévient Ludo est composé dans
   /api/livrable-reponse.
   ========================================================================== */

import { citation, esc, p, renderTransactionnel, titreSection } from "./transactionnel";
import type { ReponseLivrable } from "../lib/livrable";

export interface LivrableConfirmationProps {
  slug: string;
  prenom: string;
  titre: string;
  reponse: ReponseLivrable;
  message?: string;
  tutoiement?: boolean;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

/* Pas d'encodeURIComponent : le slug porte un slash client / projet, que
   l'encodage casserait. La regex de l'endpoint borne déjà les caractères. */
const urlLivrable = (slug: string): string => `https://coolbeans.cc/livrable/${slug}`;

const textes = (tutoiement: boolean, reponse: ReponseLivrable) =>
  tutoiement
    ? {
        preheader:
          reponse === "validation"
            ? "Ta validation est bien arrivée, je prépare la suite."
            : "Tes retours sont bien arrivés, je reviens vers toi.",
        accuse:
          reponse === "validation"
            ? "Ta validation est bien arrivée, merci. Je prépare la mise en ligne et je reviens vers toi avec les dernières étapes."
            : "Tes retours sont bien arrivés. Je les lis, je les traite, et je te préviens dès que la nouvelle version est en ligne, au même lien.",
        recap: "Ce que tu m'as écrit",
        correction: "Quelque chose à ajouter&nbsp;? Réponds simplement à cet email.",
        correctionTexte: "Quelque chose à ajouter ? Réponds simplement à cet email.",
        pied: "Tu re&ccedil;ois cet email suite &agrave; ta r&eacute;ponse sur coolbeans.cc.",
        objet: reponse === "validation" ? "validation bien reçue" : "retours bien reçus",
      }
    : {
        preheader:
          reponse === "validation"
            ? "Votre validation est bien arrivée, je prépare la suite."
            : "Vos retours sont bien arrivés, je reviens vers vous.",
        accuse:
          reponse === "validation"
            ? "Votre validation est bien arrivée, merci. Je prépare la mise en ligne et je reviens vers vous avec les dernières étapes."
            : "Vos retours sont bien arrivés. Je les lis, je les traite, et je vous préviens dès que la nouvelle version est en ligne, au même lien.",
        recap: "Ce que vous m'avez écrit",
        correction: "Quelque chose à ajouter&nbsp;? Répondez simplement à cet email.",
        correctionTexte: "Quelque chose à ajouter ? Répondez simplement à cet email.",
        pied: "Vous recevez cet email suite &agrave; votre r&eacute;ponse sur coolbeans.cc.",
        objet: reponse === "validation" ? "validation bien reçue" : "retours bien reçus",
      };

export function renderLivrableConfirmation(props: LivrableConfirmationProps): EmailPret {
  const { slug, prenom, titre, reponse, message, tutoiement = false } = props;
  const lien = urlLivrable(slug);
  const t = textes(tutoiement, reponse);

  const html = renderTransactionnel({
    preheader: t.preheader,
    kicker: `Livrable · ${esc(titre)}`,
    titre: "Bien reçu, merci",
    contenu: [
      p(`Bonjour ${esc(prenom)},`),
      p(t.accuse),
      message ? titreSection(t.recap) + citation(esc(message).replace(/\n/g, "<br>")) : "",
      p(t.correction),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le livrable", url: lien },
    piedContexte: t.pied,
  });

  const text = [
    `Bonjour ${prenom},`,
    "",
    t.accuse,
    message ? "" : null,
    message ? `${t.recap} :\n${message}` : null,
    "",
    t.correctionTexte,
    "",
    `Revoir le livrable : ${lien}`,
    "",
    "À très vite,",
    "Ludo",
  ]
    .filter((ligne) => ligne !== null)
    .join("\n");

  return { subject: `${titre} : ${t.objet}`, html, text };
}
