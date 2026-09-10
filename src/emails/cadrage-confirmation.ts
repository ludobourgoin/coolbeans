/* ============================================================================
   COOLBEANS · Accusé de réception envoyé AU LEAD après un document de cadrage.

   Même coquille que les autres transactionnels. Une seule variante : un
   cadrage n'a pas de branche « validation » ou « question », il n'engage rien.

   Ce mail fait deux choses, et la seconde compte plus que la première :
   il confirme la réception, et il **rend ses réponses au lead**. Quelqu'un qui
   vient de passer dix minutes sur un questionnaire doit repartir avec une
   trace de ce qu'il a écrit, sans quoi il n'a aucun moyen de se relire ni de
   corriger.

   Le pronom suit celui du document (drapeau `tutoiement` du YAML) : un lead
   tutoyé sur la page qui reçoit un accusé vouvoyé lit deux interlocuteurs.

   L'email interne qui prévient Ludo est composé dans /api/cadrage-reponse.
   ========================================================================== */

import { citation, esc, p, qr, renderTransactionnel, titreSection } from "./transactionnel";
import type { ReponseLisible } from "../lib/cadrage";

export interface CadrageConfirmationProps {
  slug: string;
  /** Prénom seul : obligatoire côté formulaire et côté API, pas de repli. */
  prenom: string;
  /** Titre du document, pour que le mail dise de quoi il parle. */
  titre: string;
  reponses: ReponseLisible[];
  message?: string;
  /** Aligne le pronom sur celui du document. Vouvoiement par défaut. */
  tutoiement?: boolean;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

/* Pas d'encodeURIComponent : le slug porte un slash de séparation
   client / projet, que l'encodage transformerait en %2F et qui casserait la
   route. La regex de validation de l'endpoint garantit déjà qu'il ne contient
   que [a-z0-9-] et des slashs. */
const urlCadrage = (slug: string): string => `https://coolbeans.cc/cadrage/${slug}`;

const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        preheader: "Tes réponses sont bien arrivées, je reviens vers toi avec un chiffrage.",
        accuse:
          "Tes réponses sont bien arrivées. Je les lis, et je reviens vers toi avec un chiffrage ou avec les quelques questions qui resteraient.",
        recap: "Ce que tu m'as répondu",
        message: "Ton message",
        correction:
          "Une réponse à corriger, ou quelque chose à ajouter&nbsp;? Réponds simplement à cet email.",
        correctionTexte:
          "Une réponse à corriger, ou quelque chose à ajouter ? Réponds simplement à cet email.",
        pied: "Tu re&ccedil;ois cet email suite &agrave; tes r&eacute;ponses sur coolbeans.cc.",
        objet: "tes réponses sont bien arrivées",
      }
    : {
        preheader: "Vos réponses sont bien arrivées, je reviens vers vous avec un chiffrage.",
        accuse:
          "Vos réponses sont bien arrivées. Je les lis, et je reviens vers vous avec un chiffrage ou avec les quelques questions qui resteraient.",
        recap: "Ce que vous m'avez répondu",
        message: "Votre message",
        correction:
          "Une réponse à corriger, ou quelque chose à ajouter&nbsp;? Répondez simplement à cet email.",
        correctionTexte:
          "Une réponse à corriger, ou quelque chose à ajouter ? Répondez simplement à cet email.",
        pied: "Vous recevez cet email suite &agrave; vos r&eacute;ponses sur coolbeans.cc.",
        objet: "vos réponses sont bien arrivées",
      };

export function renderCadrageConfirmation(props: CadrageConfirmationProps): EmailPret {
  const { slug, prenom, titre, reponses, message, tutoiement = false } = props;
  const lien = urlCadrage(slug);
  const t = textes(tutoiement);

  const html = renderTransactionnel({
    preheader: t.preheader,
    kicker: `Cadrage · ${esc(titre)}`,
    titre: "Bien reçu, merci",
    contenu: [
      p(`Bonjour ${esc(prenom)},`),
      p(t.accuse),
      titreSection(t.recap),
      qr(reponses.map((r) => [esc(r.question), esc(r.reponse)] as [string, string])),
      message ? titreSection(t.message) + citation(esc(message).replace(/\n/g, "<br>")) : "",
      p(t.correction),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le document", url: lien },
    piedContexte: t.pied,
  });

  const text = [
    `Bonjour ${prenom},`,
    "",
    t.accuse,
    "",
    `${t.recap} :`,
    ...reponses.map((r) => `- ${r.question}\n  ${r.reponse}`),
    message ? "" : null,
    message ? `${t.message} :\n${message}` : null,
    "",
    t.correctionTexte,
    "",
    `Revoir le document : ${lien}`,
    "",
    "À très vite,",
    "Ludo",
  ]
    .filter((ligne) => ligne !== null)
    .join("\n");

  return { subject: `${titre} : ${t.objet}`, html, text };
}
