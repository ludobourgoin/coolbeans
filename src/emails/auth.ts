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

const PIED = "Email automatique de votre espace my.coolbeans.cc.";

/** Le lien en toutes lettres, sous le bouton, dans une taille discrète. */
function urlEnClair(url: string): string {
  return p(
    `<span style="font-size:13px;">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur&nbsp;:<br>${lien(esc(url), url)}</span>`,
  );
}

/** Connexion par lien magique : pas de mot de passe à retenir. */
export function renderLienMagique({ url }: { url: string }): EmailPret {
  const html = renderTransactionnel({
    preheader: "Votre lien de connexion à myCoolbeans, valable quelques minutes.",
    kicker: "Connexion · myCoolbeans",
    titre: "Votre lien de connexion",
    contenu: [
      p("Bonjour,"),
      p(
        "Voici votre lien de connexion à votre espace. Il est valable quelques minutes et ne fonctionne qu'une fois.",
      ),
      urlEnClair(url),
      p(
        "Vous n'avez pas demandé cette connexion&nbsp;? Ignorez cet email, rien ne se passera.",
      ),
    ].join(""),
    cta: { label: "Me connecter", url },
    piedContexte: PIED,
  });

  const text = [
    "Bonjour,",
    "",
    "Voici votre lien de connexion à votre espace. Il est valable quelques minutes et ne fonctionne qu'une fois.",
    "",
    url,
    "",
    "Vous n'avez pas demandé cette connexion ? Ignorez cet email, rien ne se passera.",
  ].join("\n");

  return { subject: "Votre lien de connexion à myCoolbeans", html, text };
}

/** Ouverture d'un accès : quelqu'un est invité dans un espace. */
export function renderInvitation({
  url,
  organisation,
  inviteur,
}: {
  url: string;
  organisation: string;
  inviteur?: string;
}): EmailPret {
  const de = inviteur ? `${inviteur} vous ouvre` : "Nous vous ouvrons";

  const html = renderTransactionnel({
    preheader: `Votre accès à l'espace ${organisation} est prêt.`,
    kicker: "Invitation · myCoolbeans",
    titre: "Votre espace vous attend",
    contenu: [
      p("Bonjour,"),
      p(
        `${esc(de)} un accès à <strong>${esc(organisation)}</strong> sur myCoolbeans&nbsp;: la documentation de votre projet, son suivi et la messagerie, au même endroit.`,
      ),
      titreSection("Ce que vous y trouverez"),
      p(
        "La doc de votre projet, l'état de ce qui est en cours, et de quoi me joindre sans passer par le mail.",
      ),
      urlEnClair(url),
    ].join(""),
    cta: { label: "Ouvrir mon espace", url },
    piedContexte: PIED,
  });

  const text = [
    "Bonjour,",
    "",
    `${de} un accès à ${organisation} sur myCoolbeans : la documentation de votre projet, son suivi et la messagerie, au même endroit.`,
    "",
    url,
    "",
    "À très vite,",
    "Ludo",
  ].join("\n");

  return { subject: `Votre accès à ${organisation} sur myCoolbeans`, html, text };
}

/** Mot de passe oublié. */
export function renderReinitialisation({ url, prenom }: { url: string; prenom?: string }): EmailPret {
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const html = renderTransactionnel({
    preheader: "Choisissez un nouveau mot de passe pour votre espace.",
    kicker: "Mot de passe · myCoolbeans",
    titre: "Choisir un nouveau mot de passe",
    contenu: [
      p(esc(bonjour)),
      p(
        "Vous avez demandé à réinitialiser le mot de passe de votre espace. Ce lien est valable une heure.",
      ),
      urlEnClair(url),
      p(
        "Vous n'êtes pas à l'origine de cette demande&nbsp;? Ignorez cet email&nbsp;: votre mot de passe actuel reste valable.",
      ),
    ].join(""),
    cta: { label: "Choisir un nouveau mot de passe", url },
    piedContexte: PIED,
  });

  const text = [
    bonjour,
    "",
    "Vous avez demandé à réinitialiser le mot de passe de votre espace. Ce lien est valable une heure.",
    "",
    url,
    "",
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet email : votre mot de passe actuel reste valable.",
  ].join("\n");

  return { subject: "Réinitialiser votre mot de passe myCoolbeans", html, text };
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
