/* ============================================================================
   COOLBEANS — Base des emails (Resend)
   Coquille et blocs partagés par tous les templates (newsletter, transactionnel).
   HTML email-safe : tables, styles inline, valeurs hex figées (pas de var()).
   Les couleurs sont les tokens Geist clair de global.css / geist-tokens.css :
     surface-subtle #fafafa · surface #fff · line #eaeaea · ink #171717
     mute #4d4d4d · accent #171717 · radius card 8px · radius control 6px
   Mode clair forcé : les clients mail gèrent trop mal le dark pour un système
   monochrome — fonds et encres sont posés explicitement partout.
   Geomanist/Geist sont tentées via @font-face (Apple Mail les honore),
   fallbacks identiques à ceux de global.css pour les autres clients.
   ========================================================================== */

export const INK = "#171717";
export const MUTE = "#4d4d4d";
export const LINE = "#eaeaea";
export const SURFACE = "#ffffff";
export const SURFACE_SUBTLE = "#fafafa";

export const FONT_SANS =
  "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const FONT_DISPLAY = "'Geomanist', 'Helvetica Neue', Arial, sans-serif";
export const FONT_MONO =
  "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Échappe une valeur non maîtrisée avant interpolation dans du HTML. */
export const esc = (valeur: string): string =>
  valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

/** Étiquette mono uppercase, le .label du site (kicker, en-têtes de champs). */
export const label = (texte: string): string =>
  `<div style="font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};margin:0 0 16px;">${texte}</div>`;

/**
 * Tableau de faits label → valeur (récap transactionnel).
 * Les valeurs doivent déjà être échappées (esc()) si elles viennent de
 * l'extérieur. Les paires à valeur vide sont ignorées.
 */
export const kv = (paires: Array<[string, string | undefined | null]>): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">${paires
    .filter((paire): paire is [string, string] => !!paire[1])
    .map(
      ([cle, valeur]) =>
        `<tr><td style="padding:8px 16px 8px 0;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};white-space:nowrap;vertical-align:top;">${cle}</td><td width="100%" style="padding:8px 0;font-family:${FONT_SANS};font-size:15px;line-height:1.5;color:${INK};border-bottom:1px solid ${LINE};">${valeur}</td></tr>`,
    )
    .join("")}</table>`;

export interface ShellProps {
  /** Texte d'aperçu affiché après l'objet dans la boîte de réception. */
  preheader: string;
  /** Alimente le <title> du document. */
  titre: string;
  /** HTML du contenu de la carte (kicker, h1, corps, cta…). */
  corpsCarte: string;
  /** HTML du pied de page, sous la carte (13px mute, liens compris). */
  pied: string;
}

/** Coquille commune : fond, wordmark, carte, pied. */
export function renderShell({ preheader, titre, corpsCarte, pied }: ShellProps): string {
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
              ${corpsCarte}
            </td>
          </tr>

          <!-- Pied : mute, 13px -->
          <tr>
            <td style="padding:24px 4px 0;font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${MUTE};">
              ${pied}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
