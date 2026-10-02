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
  /** Pronom de l'auteur (src/lib/portail/pronom.ts). Vous par défaut. */
  tutoiement?: boolean;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        pied: "Tu re&ccedil;ois cet email suite &agrave; ta demande sur my.coolbeans.cc.",
        preheader: "Ta demande est bien enregistrée, je reviens vers toi rapidement.",
        accuse:
          "Ta demande est bien enregistrée et arrive directement dans mon outil de suivi. Je reviens vers toi rapidement, en général sous un jour ouvré.",
        demande: "Ta demande",
        detail: "Un détail à ajouter entre-temps&nbsp;? Réponds simplement à cet email.",
        detailTexte: "Un détail à ajouter entre-temps ? Réponds simplement à cet email.",
      }
    : {
        pied: "Vous recevez cet email suite &agrave; votre demande sur my.coolbeans.cc.",
        preheader: "Votre demande est bien enregistrée, je reviens vers vous rapidement.",
        accuse:
          "Votre demande est bien enregistrée et arrive directement dans mon outil de suivi. Je reviens vers vous rapidement, en général sous un jour ouvré.",
        demande: "Votre demande",
        detail: "Un détail à ajouter entre-temps&nbsp;? Répondez simplement à cet email.",
        detailTexte: "Un détail à ajouter entre-temps ? Répondez simplement à cet email.",
      };

/** Accusé de réception d'une demande support envoyée depuis le portail. */
export function renderConfirmationSupport(props: SupportConfirmationProps): EmailPret {
  const { objet, description, prenom, tutoiement = false } = props;
  const t = textes(tutoiement);
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const html = renderTransactionnel({
    preheader: t.preheader,
    kicker: "Support · myCoolbeans",
    titre: "Bien reçu, je m'en occupe",
    contenu: [
      p(esc(bonjour)),
      p(t.accuse),
      titreSection(`${t.demande} · ${esc(objet)}`),
      citation(esc(description).replace(/\n/g, "<br>")),
      p(t.detail),
      p("À très vite,<br>Ludo"),
    ].join(""),
    piedContexte: t.pied,
  });

  const text = [
    bonjour,
    "",
    t.accuse,
    "",
    `${t.demande} · ${objet} :`,
    description,
    "",
    t.detailTexte,
    "",
    "À très vite,",
    "Ludo",
  ].join("\n");

  return { subject: `Support · bien reçu : ${objet}`, html, text };
}
