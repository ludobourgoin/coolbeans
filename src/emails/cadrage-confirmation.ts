/* ============================================================================
   COOLBEANS · Accusé de réception envoyé AU LEAD après un document de cadrage.

   Même coquille que les autres transactionnels. Une seule variante : un
   cadrage n'a pas de branche « validation » ou « question », il n'engage rien.

   Ce mail fait deux choses, et la seconde compte plus que la première :
   il confirme la réception, et il **rend ses réponses au lead**. Quelqu'un qui
   vient de passer dix minutes sur un questionnaire doit repartir avec une
   trace de ce qu'il a écrit, sans quoi il n'a aucun moyen de se relire ni de
   corriger.

   L'email interne qui prévient Ludo est composé dans /api/cadrage-reponse.
   ========================================================================== */

import {
  citation,
  esc,
  kv,
  p,
  renderTransactionnel,
  titreSection,
} from "./transactionnel";
import type { ReponseLisible } from "../lib/cadrage";

export interface CadrageConfirmationProps {
  slug: string;
  /** Prénom seul : obligatoire côté formulaire et côté API, pas de repli. */
  prenom: string;
  /** Titre du document, pour que le mail dise de quoi il parle. */
  titre: string;
  reponses: ReponseLisible[];
  message?: string;
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

const PIED = "Vous recevez cet email suite &agrave; vos r&eacute;ponses sur coolbeans.cc.";

export function renderCadrageConfirmation(props: CadrageConfirmationProps): EmailPret {
  const { slug, prenom, titre, reponses, message } = props;
  const lien = urlCadrage(slug);

  const html = renderTransactionnel({
    preheader: "Vos réponses sont bien arrivées, je reviens vers vous avec un chiffrage.",
    kicker: `Cadrage · ${esc(titre)}`,
    titre: "Bien reçu, merci",
    contenu: [
      p(`Bonjour ${esc(prenom)},`),
      p(
        "Vos réponses sont bien arrivées. Je les lis, et je reviens vers vous avec un chiffrage ou avec les quelques questions qui resteraient.",
      ),
      p(
        "<strong>Rien n'est engagé&nbsp;:</strong> ce document sert à cadrer le besoin et à vous donner un prix juste, pas à démarrer quoi que ce soit.",
      ),
      titreSection("Ce que vous m'avez répondu"),
      kv(reponses.map((r) => [r.question, esc(r.reponse)] as [string, string])),
      message
        ? titreSection("Votre message") + citation(esc(message).replace(/\n/g, "<br>"))
        : "",
      p("Une réponse à corriger, ou quelque chose à ajouter&nbsp;? Répondez simplement à cet email."),
      p("À très vite,<br>Ludo"),
    ].join(""),
    cta: { label: "Revoir le document", url: lien },
    piedContexte: PIED,
  });

  const text = [
    `Bonjour ${prenom},`,
    "",
    "Vos réponses sont bien arrivées. Je les lis, et je reviens vers vous avec un chiffrage ou avec les quelques questions qui resteraient.",
    "",
    "Rien n'est engagé : ce document sert à cadrer le besoin et à vous donner un prix juste, pas à démarrer quoi que ce soit.",
    "",
    "Ce que vous m'avez répondu :",
    ...reponses.map((r) => `- ${r.question}\n  ${r.reponse}`),
    message ? "" : null,
    message ? `Votre message :\n${message}` : null,
    "",
    "Une réponse à corriger, ou quelque chose à ajouter ? Répondez simplement à cet email.",
    "",
    `Revoir le document : ${lien}`,
    "",
    "À très vite,",
    "Ludo",
  ]
    .filter((ligne) => ligne !== null)
    .join("\n");

  return { subject: `${titre} : vos réponses sont bien arrivées`, html, text };
}
