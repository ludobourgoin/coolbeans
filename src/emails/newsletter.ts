/* ============================================================================
   COOLBEANS — Template email newsletter (Resend)
   Coquille et blocs partagés : voir base.ts.

   Usage :
     import { renderNewsletter, p, h2, cta, sep } from "../emails/newsletter";
     const html = renderNewsletter({
       preheader: "Résumé visible dans la boîte de réception",
       kicker: "Newsletter · Août 2026",
       titre: "Le titre de l'édition",
       contenu: [p("Premier paragraphe…"), h2("Section"), p("Suite…")].join(""),
       cta: { label: "Lire l'article", url: "https://coolbeans.cc/blog/…" },
     });
     await resend.emails.send({ from: "Ludo de Coolbeans <ludo@coolbeans.cc>",
       to, subject, html });
   ========================================================================== */

import { FONT_DISPLAY, INK, MUTE, cta, label, renderShell } from "./base";

export { p, h2, lien, liste, sep, cta, esc } from "./base";

export interface NewsletterProps {
  /** Texte d'aperçu affiché après l'objet dans la boîte de réception. */
  preheader: string;
  /** Étiquette mono au-dessus du titre, ex. "Newsletter · Août 2026". */
  kicker?: string;
  titre: string;
  /** Blocs HTML du corps — composer avec p(), h2(), liste(), sep(), cta(). */
  contenu: string;
  /** Bouton principal en fin d'email (optionnel). */
  cta?: { label: string; url: string };
  /** Par défaut : variable Resend des Broadcasts, remplacée à l'envoi. */
  unsubscribeUrl?: string;
}

export function renderNewsletter({
  preheader,
  kicker,
  titre,
  contenu,
  cta: bouton,
  unsubscribeUrl = "{{{RESEND_UNSUBSCRIBE_URL}}}",
}: NewsletterProps): string {
  return renderShell({
    preheader,
    titre,
    corpsCarte: [
      kicker ? label(kicker) : "",
      `<h1 style="margin:0 0 20px;font-family:${FONT_DISPLAY};font-size:28px;font-weight:700;letter-spacing:-0.03em;line-height:1.15;color:${INK};">${titre}</h1>`,
      contenu,
      bouton ? cta(bouton.label, bouton.url) : "",
    ].join(""),
    pied: `Coolbeans — l'op&eacute;rationnel qui tourne tout seul.<br>
              Tu re&ccedil;ois cet email parce que tu t'es inscrit sur
              <a href="https://coolbeans.cc" style="color:${MUTE};text-decoration:underline;">coolbeans.cc</a>.<br>
              <a href="${unsubscribeUrl}" style="color:${MUTE};text-decoration:underline;">Se d&eacute;sinscrire</a>`,
  });
}
