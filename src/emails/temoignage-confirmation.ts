/* ============================================================================
   COOLBEANS · Accusé de réception envoyé AU CLIENT après une page de témoignage.

   Même coquille et même intention que l'accusé de cadrage : confirmer, et
   surtout rendre ses réponses à quelqu'un qui vient de donner dix minutes.

   Deux choses le distinguent, et elles tiennent au moment où il part.

   Il **remercie sans rien demander de plus**. C'est le seul mail de la chaîne
   commerciale qui n'attend rien en retour, et lui coller une relance ou une
   question supplémentaire abîmerait exactement ce qu'on vient d'obtenir.

   Il **dit ce qui va se passer de la citation**. Quelqu'un qui écrit une phrase
   sur son prestataire veut savoir où elle va atterrir, et le lui dire vaut
   mieux que de le laisser le découvrir sur une page publique.

   L'email interne qui prévient Ludo est composé dans /api/temoignage-reponse.
   ========================================================================== */

import { citation, esc, p, qr, renderTransactionnel, titreSection } from "./transactionnel";
import type { ReponseLisible } from "../lib/cadrage";

export interface TemoignageConfirmationProps {
  slug: string;
  prenom: string;
  titre: string;
  reponses: ReponseLisible[];
  message?: string;
  tutoiement?: boolean;
  /** Fait mentionner la photo dans l'accusé, seulement si elle est arrivée. */
  avecPhoto?: boolean;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

/* Pas d'encodeURIComponent : le slug porte un slash de séparation
   client / projet, que l'encodage transformerait en %2F. */
const urlTemoignage = (slug: string): string => `https://coolbeans.cc/temoignage/${slug}`;

const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        preheader: "Merci, c'est bien arrivé.",
        accuse:
          "Merci beaucoup. Montrer mon travail est ce qui m'amène mes projets, et ce que tu viens d'écrire vaut plus que tout ce que je peux dire de moi-même.",
        suite:
          "Je reprends tes mots tels quels, sans les réécrire. Si je devais couper quelque chose pour tenir la place, je te le montrerais avant.",
        photo: "Ta photo est bien arrivée aussi.",
        recap: "Ce que tu m'as répondu",
        message: "Ton message",
        correction:
          "Tu veux corriger une phrase, ou en retirer une&nbsp;? Réponds simplement à cet email, et c'est fait.",
        correctionTexte:
          "Tu veux corriger une phrase, ou en retirer une ? Réponds simplement à cet email, et c'est fait.",
        pied: "Tu re&ccedil;ois cet email suite &agrave; tes r&eacute;ponses sur coolbeans.cc.",
        objet: "merci, c'est bien arrivé",
      }
    : {
        preheader: "Merci, c'est bien arrivé.",
        accuse:
          "Merci beaucoup. Montrer mon travail est ce qui m'amène mes projets, et ce que vous venez d'écrire vaut plus que tout ce que je peux dire de moi-même.",
        suite:
          "Je reprends vos mots tels quels, sans les réécrire. Si je devais couper quelque chose pour tenir la place, je vous le montrerais avant.",
        photo: "Votre photo est bien arrivée aussi.",
        recap: "Ce que vous m'avez répondu",
        message: "Votre message",
        correction:
          "Vous voulez corriger une phrase, ou en retirer une&nbsp;? Répondez simplement à cet email, et c'est fait.",
        correctionTexte:
          "Vous voulez corriger une phrase, ou en retirer une ? Répondez simplement à cet email, et c'est fait.",
        pied: "Vous recevez cet email suite &agrave; vos r&eacute;ponses sur coolbeans.cc.",
        objet: "merci, c'est bien arrivé",
      };

export function renderTemoignageConfirmation(props: TemoignageConfirmationProps): EmailPret {
  const { slug, prenom, titre, reponses, message, tutoiement = false, avecPhoto = false } = props;
  const lien = urlTemoignage(slug);
  const t = textes(tutoiement);

  const html = renderTransactionnel({
    preheader: t.preheader,
    kicker: `Témoignage · ${esc(titre)}`,
    titre: "Merci",
    contenu: [
      p(`Bonjour ${esc(prenom)},`),
      p(t.accuse),
      p(avecPhoto ? `${t.suite} ${t.photo}` : t.suite),
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
    avecPhoto ? `${t.suite} ${t.photo}` : t.suite,
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
