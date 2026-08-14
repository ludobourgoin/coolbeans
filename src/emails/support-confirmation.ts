/* ============================================================================
   COOLBEANS — Accusé de réception envoyé AU CLIENT après une demande support.
   Même coquille que les autres transactionnels. L'email interne qui prévient
   Ludo est composé dans /api/support, comme celui du devis dans
   /api/devis-reponse. Retourne l'objet, le HTML et la version texte prêts
   pour Resend.
   ========================================================================== */

import { citation, esc, p, renderTransactionnel, titreSection } from "./transactionnel";

export interface SupportConfirmationProps {
  objet: string;
  description: string;
  /**
   * Prénom Clerk, absent si le profil n'en a pas : le « Bonjour » se replie
   * alors sur sa forme nue plutôt que d'inventer un nom.
   */
  prenom?: string;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

const PIED = "Vous recevez cet email suite &agrave; votre demande sur my.coolbeans.cc.";

/** Accusé de réception d'une demande support envoyée depuis le portail. */
export function renderConfirmationSupport(props: SupportConfirmationProps): EmailPret {
  const { objet, description, prenom } = props;
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const html = renderTransactionnel({
    preheader: "Votre demande est bien enregistrée, je reviens vers vous rapidement.",
    kicker: "Support · myCoolbeans",
    titre: "Bien reçu, je m'en occupe",
    contenu: [
      p(esc(bonjour)),
      p(
        "Votre demande est bien enregistrée et arrive directement dans mon outil de suivi. Je reviens vers vous rapidement — en général sous un jour ouvré.",
      ),
      titreSection(`Votre demande — ${esc(objet)}`),
      citation(esc(description).replace(/\n/g, "<br>")),
      p("Un détail à ajouter entre-temps&nbsp;? Répondez simplement à cet email."),
      p("À très vite,<br>Ludo"),
    ].join(""),
    piedContexte: PIED,
  });

  const text = [
    bonjour,
    "",
    "Votre demande est bien enregistrée et arrive directement dans mon outil de suivi. Je reviens vers vous rapidement — en général sous un jour ouvré.",
    "",
    `Votre demande — ${objet} :`,
    description,
    "",
    "Un détail à ajouter entre-temps ? Répondez simplement à cet email.",
    "",
    "À très vite,",
    "Ludo",
  ].join("\n");

  return { subject: `Support — bien reçu : ${objet}`, html, text };
}
