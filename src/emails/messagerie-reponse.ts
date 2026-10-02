/* ============================================================================
   COOLBEANS — Réponse de Ludo publiée sur un ticket de la messagerie.
   Envoyée AU CLIENT par le cron de publication (lib/portail/messagerie/publier.ts).
   Le corps est le markdown du commentaire Linear, images déjà retirées ;
   rendu volontairement en texte (esc + <br>), pas de parseur markdown : un
   lien nu reste cliquable dans tous les clients mail, c'est suffisant.
   ========================================================================== */
import { citation, esc, p, renderTransactionnel } from "./transactionnel";
import type { EmailPret } from "./support-confirmation";

export function renderReponseMessagerie(props: {
  objet: string;
  corps: string;
  prenom?: string;
  urlTicket: string;
  /** Pronom du destinataire (src/lib/portail/pronom.ts). Vous par défaut. */
  tutoiement?: boolean;
}): EmailPret {
  const tu = props.tutoiement ?? false;
  const bonjour = props.prenom ? `Bonjour ${esc(props.prenom)},` : "Bonjour,";
  const html = renderTransactionnel({
    preheader: props.corps.slice(0, 120),
    kicker: tu ? "Ta demande" : "Votre demande",
    titre: `Re : ${esc(props.objet)}`,
    contenu: [
      p(bonjour),
      citation(esc(props.corps).replace(/\n/g, "<br>")),
      p(tu ? "Tu peux r&eacute;pondre directement depuis ton espace." : "Vous pouvez r&eacute;pondre directement depuis votre espace."),
    ].join(""),
    cta: { label: "Répondre sur le portail", url: props.urlTicket },
    piedContexte: tu
      ? "Tu re&ccedil;ois cet email car un ticket te concerne sur my.coolbeans.cc."
      : "Vous recevez cet email car un ticket vous concerne sur my.coolbeans.cc.",
  });
  return {
    subject: `Re : ${props.objet}`,
    html,
    text: `${props.prenom ? `Bonjour ${props.prenom},` : "Bonjour,"}\n\n${props.corps}\n\nRépondre : ${props.urlTicket}`,
  };
}
