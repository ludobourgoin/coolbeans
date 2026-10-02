/* ============================================================================
   COOLBEANS — Mails d'authentification du portail (Better Auth + Resend).

   Trois moments, trois gabarits : le lien magique (connexion sans mot de
   passe), l'invitation (un compte s'ouvre pour quelqu'un), la
   réinitialisation (mot de passe oublié).

   Chaque gabarit rend `{ subject, html, text }` ; `envoyerMailAuth` fait
   l'envoi. La séparation suit celle des autres transactionnels : un module
   d'emails ne connaît pas le réseau, sauf ici où l'appelant est Better Auth
   lui-même, qui n'a rien à savoir de Resend.

   RÈGLE DU LIEN : l'URL apparaît TOUJOURS en toutes lettres sous le bouton.
   Un client mail qui masque ou réécrit les liens ne doit pas empêcher
   quelqu'un de se connecter — il lui reste l'adresse à copier.
   ========================================================================== */

import { Resend } from "resend";
import { esc, lien, p, renderTransactionnel, titreSection } from "./transactionnel";

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

/* Expéditeur repris de la messagerie du portail (`support@coolbeans.cc`),
   pas de celui des devis : ces mails accompagnent l'espace client, et le
   domaine est déjà authentifié chez Resend. Ne jamais en inventer un autre :
   un domaine non authentifié part en spam sans erreur visible. */
const EXPEDITEUR = "Coolbeans <support@coolbeans.cc>";

const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        pied: "Email automatique de ton espace my.coolbeans.cc.",
        enClair: "Si le bouton ne fonctionne pas, copie cette adresse dans ton navigateur&nbsp;:",
        lien: {
          preheader: "Ton lien de connexion à myCoolbeans, valable quelques minutes.",
          titre: "Ton lien de connexion",
          corps: "Voici ton lien de connexion à ton espace. Il est valable quelques minutes et ne fonctionne qu'une fois.",
          pasMoi: "Tu n'as pas demandé cette connexion&nbsp;? Ignore cet email, rien ne se passera.",
          pasMoiTexte: "Tu n'as pas demandé cette connexion ? Ignore cet email, rien ne se passera.",
          objet: "Ton lien de connexion à myCoolbeans",
        },
        invitation: {
          de: (inviteur?: string) => (inviteur ? `${inviteur} t'ouvre` : "Nous t'ouvrons"),
          preheader: (organisation: string) => `Ton accès à l'espace ${organisation} est prêt.`,
          titre: "Ton espace t'attend",
          suite: "la documentation de ton projet, son suivi et tes demandes, au même endroit.",
          section: "Ce que tu y trouveras",
          contenu: "La doc de ton projet, l'état de ce qui est en cours, et de quoi me joindre sans passer par le mail.",
          objet: (organisation: string) => `Ton accès à ${organisation} sur myCoolbeans`,
        },
        reinit: {
          preheader: "Choisis un nouveau mot de passe pour ton espace.",
          corps: "Tu as demandé à réinitialiser le mot de passe de ton espace. Ce lien est valable une heure.",
          pasMoi: "Tu n'es pas à l'origine de cette demande&nbsp;? Ignore cet email&nbsp;: ton mot de passe actuel reste valable.",
          pasMoiTexte: "Tu n'es pas à l'origine de cette demande ? Ignore cet email : ton mot de passe actuel reste valable.",
          objet: "Réinitialiser ton mot de passe myCoolbeans",
        },
      }
    : {
        pied: "Email automatique de votre espace my.coolbeans.cc.",
        enClair: "Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur&nbsp;:",
        lien: {
          preheader: "Votre lien de connexion à myCoolbeans, valable quelques minutes.",
          titre: "Votre lien de connexion",
          corps: "Voici votre lien de connexion à votre espace. Il est valable quelques minutes et ne fonctionne qu'une fois.",
          pasMoi: "Vous n'avez pas demandé cette connexion&nbsp;? Ignorez cet email, rien ne se passera.",
          pasMoiTexte: "Vous n'avez pas demandé cette connexion ? Ignorez cet email, rien ne se passera.",
          objet: "Votre lien de connexion à myCoolbeans",
        },
        invitation: {
          de: (inviteur?: string) => (inviteur ? `${inviteur} vous ouvre` : "Nous vous ouvrons"),
          preheader: (organisation: string) => `Votre accès à l'espace ${organisation} est prêt.`,
          titre: "Votre espace vous attend",
          suite: "la documentation de votre projet, son suivi et vos demandes, au même endroit.",
          section: "Ce que vous y trouverez",
          contenu: "La doc de votre projet, l'état de ce qui est en cours, et de quoi me joindre sans passer par le mail.",
          objet: (organisation: string) => `Votre accès à ${organisation} sur myCoolbeans`,
        },
        reinit: {
          preheader: "Choisissez un nouveau mot de passe pour votre espace.",
          corps: "Vous avez demandé à réinitialiser le mot de passe de votre espace. Ce lien est valable une heure.",
          pasMoi: "Vous n'êtes pas à l'origine de cette demande&nbsp;? Ignorez cet email&nbsp;: votre mot de passe actuel reste valable.",
          pasMoiTexte: "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet email : votre mot de passe actuel reste valable.",
          objet: "Réinitialiser votre mot de passe myCoolbeans",
        },
      };

/** Le lien en toutes lettres, sous le bouton, dans une taille discrète. */
function urlEnClair(url: string, enClair: string): string {
  return p(`<span style="font-size:13px;">${enClair}<br>${lien(esc(url), url)}</span>`);
}

/** Connexion par lien magique : pas de mot de passe à retenir. */
export function renderLienMagique({ url, tutoiement = false }: { url: string; tutoiement?: boolean }): EmailPret {
  const t = textes(tutoiement);
  const html = renderTransactionnel({
    preheader: t.lien.preheader,
    kicker: "Connexion · myCoolbeans",
    titre: t.lien.titre,
    contenu: [p("Bonjour,"), p(t.lien.corps), urlEnClair(url, t.enClair), p(t.lien.pasMoi)].join(""),
    cta: { label: "Me connecter", url },
    piedContexte: t.pied,
  });
  const text = ["Bonjour,", "", t.lien.corps, "", url, "", t.lien.pasMoiTexte].join("\n");
  return { subject: t.lien.objet, html, text };
}

/** Ouverture d'un accès : quelqu'un est invité dans un espace. */
export function renderInvitation({
  url,
  organisation,
  inviteur,
  tutoiement = false,
}: {
  url: string;
  organisation: string;
  inviteur?: string;
  tutoiement?: boolean;
}): EmailPret {
  const t = textes(tutoiement);
  const de = t.invitation.de(inviteur);
  const html = renderTransactionnel({
    preheader: t.invitation.preheader(organisation),
    kicker: "Invitation · myCoolbeans",
    titre: t.invitation.titre,
    contenu: [
      p("Bonjour,"),
      p(`${esc(de)} un accès à <strong>${esc(organisation)}</strong> sur myCoolbeans&nbsp;: ${t.invitation.suite}`),
      titreSection(t.invitation.section),
      p(t.invitation.contenu),
      urlEnClair(url, t.enClair),
    ].join(""),
    cta: { label: "Ouvrir mon espace", url },
    piedContexte: t.pied,
  });
  const text = [
    "Bonjour,",
    "",
    `${de} un accès à ${organisation} sur myCoolbeans : ${t.invitation.suite}`,
    "",
    url,
    "",
    "À très vite,",
    "Ludo",
  ].join("\n");
  return { subject: t.invitation.objet(organisation), html, text };
}

/** Mot de passe oublié. */
export function renderReinitialisation({
  url,
  prenom,
  tutoiement = false,
}: {
  url: string;
  prenom?: string;
  tutoiement?: boolean;
}): EmailPret {
  const t = textes(tutoiement);
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const html = renderTransactionnel({
    preheader: t.reinit.preheader,
    kicker: "Mot de passe · myCoolbeans",
    titre: "Choisir un nouveau mot de passe",
    contenu: [p(esc(bonjour)), p(t.reinit.corps), urlEnClair(url, t.enClair), p(t.reinit.pasMoi)].join(""),
    cta: { label: "Choisir un nouveau mot de passe", url },
    piedContexte: t.pied,
  });
  const text = [bonjour, "", t.reinit.corps, "", url, "", t.reinit.pasMoiTexte].join("\n");
  return { subject: t.reinit.objet, html, text };
}

/**
 * Envoi effectif via Resend.
 *
 * Ne lève jamais : un envoi raté ne doit pas transformer une demande de
 * connexion en erreur 500 côté navigateur. L'échec part dans les logs du
 * Worker, où il se voit, et l'utilisateur peut redemander un lien.
 */
export async function envoyerMailAuth(env: Env, to: string, mail: EmailPret): Promise<void> {
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: EXPEDITEUR,
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) console.error("auth: envoi Resend refusé", error);
  } catch (err) {
    console.error("auth: envoi Resend échoué", err);
  }
}
