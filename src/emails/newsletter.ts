/* ============================================================================
   COOLBEANS — Template email newsletter (Resend)
   HTML email-safe : tables, styles inline, valeurs hex figées (pas de var()).
   Les couleurs sont les tokens Geist clair de global.css / geist-tokens.css :
     surface-subtle #fafafa · surface #fff · line #eaeaea · ink #171717
     mute #4d4d4d · accent #171717 · radius card 8px · radius control 6px
   Mode clair forcé : les clients mail gèrent trop mal le dark pour un système
   monochrome — fonds et encres sont posés explicitement partout.
   Geomanist/Geist sont tentées via @font-face (Apple Mail les honore),
   fallbacks identiques à ceux de global.css pour les autres clients.

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

const INK = "#171717";
const MUTE = "#4d4d4d";
const LINE = "#eaeaea";
const SURFACE = "#ffffff";
const SURFACE_SUBTLE = "#fafafa";

const FONT_SANS =
  "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_DISPLAY = "'Geomanist', 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

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

/** Paragraphe standard. */
export const p = (html: string): string =>
  `<p style="margin:0 0 16px;font-family:${FONT_SANS};font-size:16px;line-height:1.5;color:${INK};">${html}</p>`;

/** Intertitre de section (équivalent h3 du site : Geist semi-bold). */
export const h2 = (texte: string): string =>
  `<h2 style="margin:32px 0 12px;font-family:${FONT_SANS};font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;color:${INK};">${texte}</h2>`;

/** Lien inline à utiliser dans p() — souligné, encre. */
export const lien = (label: string, url: string): string =>
  `<a href="${url}" style="color:${INK};text-decoration:underline;text-underline-offset:2px;">${label}</a>`;

/** Liste à puces. */
export const liste = (items: string[]): string =>
  `<ul style="margin:0 0 16px;padding-left:20px;">${items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-family:${FONT_SANS};font-size:16px;line-height:1.5;color:${INK};">${item}</li>`,
    )
    .join("")}</ul>`;

/** Séparateur horizontal, comme hr du site. */
export const sep = (): string =>
  `<hr style="border:none;border-top:1px solid ${LINE};margin:24px 0;">`;

/** Bouton pleine autonomie (table-based, fiable partout), style .btn du site. */
export const cta = (label: string, url: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;"><tr><td style="background:${INK};border-radius:6px;"><a href="${url}" style="display:inline-block;padding:12px 20px;font-family:${FONT_SANS};font-size:15px;font-weight:500;line-height:1;color:${SURFACE};text-decoration:none;">${label}</a></td></tr></table>`;

export function renderNewsletter({
  preheader,
  kicker,
  titre,
  contenu,
  cta: bouton,
  unsubscribeUrl = "{{{RESEND_UNSUBSCRIBE_URL}}}",
}: NewsletterProps): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${titre}</title>
<style>
  /* Chargées par les clients qui le permettent (Apple Mail) ; les autres
     retombent sur les fallbacks des stacks inline. */
  @font-face {
    font-family: "Geist Sans";
    src: url("https://coolbeans.cc/fonts/Geist-Variable.woff2") format("woff2");
    font-weight: 100 900;
  }
  @font-face {
    font-family: "Geomanist";
    src: url("https://coolbeans.cc/fonts/geomanist-bold-webfont.woff2") format("woff2");
    font-weight: 700;
  }
  @media only screen and (max-width: 640px) {
    .card-pad { padding: 24px !important; }
    .container { width: 100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${SURFACE_SUBTLE};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE_SUBTLE}">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Wordmark texte : Gmail bloque les SVG en <img>, le texte passe partout -->
          <tr>
            <td style="padding:0 4px 20px;">
              <a href="https://coolbeans.cc" style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;letter-spacing:-0.03em;color:${INK};text-decoration:none;">coolbeans</a>
            </td>
          </tr>

          <!-- Carte principale : .card du site (surface, line, radius 8px) -->
          <tr>
            <td class="card-pad" bgcolor="${SURFACE}" style="background:${SURFACE};border:1px solid ${LINE};border-radius:8px;padding:32px;">
              ${
                kicker
                  ? `<div style="font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};margin:0 0 16px;">${kicker}</div>`
                  : ""
              }
              <h1 style="margin:0 0 20px;font-family:${FONT_DISPLAY};font-size:28px;font-weight:700;letter-spacing:-0.03em;line-height:1.15;color:${INK};">${titre}</h1>
              ${contenu}
              ${bouton ? cta(bouton.label, bouton.url) : ""}
            </td>
          </tr>

          <!-- Pied : mute, 13px, désinscription -->
          <tr>
            <td style="padding:24px 4px 0;font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${MUTE};">
              Coolbeans — l'op&eacute;rationnel qui tourne tout seul.<br>
              Tu re&ccedil;ois cet email parce que tu t'es inscrit sur
              <a href="https://coolbeans.cc" style="color:${MUTE};text-decoration:underline;">coolbeans.cc</a>.<br>
              <a href="${unsubscribeUrl}" style="color:${MUTE};text-decoration:underline;">Se d&eacute;sinscrire</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
