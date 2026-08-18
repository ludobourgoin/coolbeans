/* ============================================================================
   COOLBEANS — Base des emails (Resend)
   Coquille et blocs partagés par tous les templates (newsletter, transactionnel).
   HTML email-safe : tables, styles inline, valeurs hex figées (pas de var()).
   Les couleurs sont les tokens Geist clair de global.css / geist-tokens.css :
     surface-subtle #fafafa · surface #fff · line #eaeaea · ink #171717
     mute #4d4d4d · accent #171717 · radius card 8px · radius control 6px
   Mode clair forcé : les clients mail gèrent trop mal le dark pour un système
   monochrome — fonds et encres sont posés explicitement partout.
   Geist est tentée via @font-face (Apple Mail l'honore), fallbacks
   identiques à ceux de global.css pour les autres clients. Famille unique
   depuis le retrait de Geomanist (2026-08-18).
   ========================================================================== */

export const INK = "#171717";
export const MUTE = "#4d4d4d";
export const LINE = "#eaeaea";
export const SURFACE = "#ffffff";
export const SURFACE_SUBTLE = "#fafafa";

export const FONT_SANS =
  "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const FONT_DISPLAY = FONT_SANS;
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

/**
 * Espace vertical explicite. Les marges de blocs voisins ne fusionnent pas de
 * façon fiable d'un client mail à l'autre : quand il faut de l'air, on la pose.
 */
export const espace = (hauteur = 24): string =>
  `<div style="height:${hauteur}px;line-height:${hauteur}px;font-size:0;">&nbsp;</div>`;

/** Séparateur horizontal, comme hr du site. */
export const sep = (): string =>
  `<hr style="border:none;border-top:1px solid ${LINE};margin:24px 0;">`;

/** Bouton pleine autonomie (table-based, fiable partout), style .btn du site. */
export const cta = (label: string, url: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;"><tr><td style="background:${INK};border-radius:6px;"><a href="${url}" style="display:inline-block;padding:12px 20px;font-family:${FONT_SANS};font-size:15px;font-weight:500;line-height:1;color:${SURFACE};text-decoration:none;">${label}</a></td></tr></table>`;

/**
 * Bloc de citation : reprend un texte écrit par quelqu'un d'autre (message d'un
 * client dans un formulaire) en le dissociant nettement de la prose de l'email.
 * Le liseré est une cellule pleine plutôt qu'un border-left : Outlook rend le
 * moteur Word, qui avale les bordures de td de façon imprévisible.
 * Le contenu doit déjà être échappé (esc()).
 */
export const citation = (html: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:${SURFACE_SUBTLE};border-radius:6px;"><tr><td width="3" bgcolor="${INK}" style="width:3px;background:${INK};border-radius:6px 0 0 6px;font-size:0;line-height:0;">&nbsp;</td><td style="padding:16px 20px;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:${MUTE};">${html}</td></tr></table>`;

/** Étiquette mono uppercase, le .label du site (kicker, en-têtes de champs). */
export const label = (texte: string): string =>
  `<div style="font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};margin:0 0 16px;">${texte}</div>`;

/**
 * Titre de section interne à une carte (au-dessus d'un kv, d'une citation).
 * Plus discret qu'un h2, mais avec assez d'air au-dessus pour ouvrir une
 * section sans avoir besoin d'un sep() : c'est l'espace qui sépare, pas le trait.
 */
export const titreSection = (texte: string): string =>
  `<p style="margin:36px 0 14px;font-family:${FONT_SANS};font-size:16px;font-weight:600;line-height:1.4;color:${INK};">${texte}</p>`;

/**
 * Tableau de faits label → valeur (récap transactionnel).
 * Les valeurs doivent déjà être échappées (esc()) si elles viennent de
 * l'extérieur. Les paires à valeur vide sont ignorées.
 * Le label et la valeur partagent la même line-height : leurs tailles de police
 * diffèrent (11 vs 15px), c'est la seule façon fiable en email de faire coïncider
 * leurs centres optiques. La dernière ligne n'a pas de filet, sinon le tableau
 * se termine sur un trait qui flotte sous la donnée.
 */
export const kv = (paires: Array<[string, string | undefined | null]>): string => {
  const lignes = paires.filter((paire): paire is [string, string] => !!paire[1]);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;">${lignes
    .map(([cle, valeur], index) => {
      const filet =
        index === lignes.length - 1 ? "" : `border-bottom:1px solid ${LINE};`;
      return `<tr><td style="padding:9px 20px 9px 0;font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:0.1em;line-height:24px;text-transform:uppercase;color:${MUTE};white-space:nowrap;vertical-align:top;">${cle}</td><td width="100%" style="padding:9px 0;font-family:${FONT_SANS};font-size:15px;line-height:24px;color:${INK};${filet}">${valeur}</td></tr>`;
    })
    .join("")}</table>`;
};

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
