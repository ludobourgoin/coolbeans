/* ============================================================================
   COOLBEANS — Template email transactionnel (Resend)
   Même coquille que la newsletter (base.ts), sans lien de désinscription :
   un email transactionnel accompagne une action, il n'a pas d'opt-out.

   Usage :
     import { renderTransactionnel, p, kv, esc } from "../emails/transactionnel";
     const html = renderTransactionnel({
       preheader: "Résumé visible dans la boîte de réception",
       kicker: "Devis · mon-slug",
       titre: "Validation de la proposition",
       contenu: [kv([["Nom", esc(nom)]]), p("…")].join(""),
       cta: { label: "Voir le devis", url: "https://coolbeans.cc/devis/…" },
     });
   ========================================================================== */

import { FONT_DISPLAY, INK, MUTE, cta, label, renderShell } from "./base";

export {
  p,
  h2,
  lien,
  liste,
  sep,
  espace,
  cta,
  kv,
  esc,
  citation,
  label,
  titreSection,
} from "./base";

export interface TransactionnelProps {
  /** Texte d'aperçu affiché après l'objet dans la boîte de réception. */
  preheader: string;
  /** Étiquette mono au-dessus du titre, ex. "Devis · slug". */
  kicker?: string;
  titre: string;
  /** Blocs HTML du corps — composer avec p(), kv(), sep(), liste()… */
  contenu: string;
  /** Bouton principal en fin d'email (optionnel). */
  cta?: { label: string; url: string };
  /** Ligne de contexte du pied, ex. "Email automatique envoyé depuis coolbeans.cc." */
  piedContexte?: string;
}

export function renderTransactionnel({
  preheader,
  kicker,
  titre,
  contenu,
  cta: bouton,
  piedContexte = "Email automatique envoy&eacute; depuis coolbeans.cc.",
}: TransactionnelProps): string {
  return renderShell({
    preheader,
    titre,
    corpsCarte: [
      kicker ? label(kicker) : "",
      `<h1 style="margin:0 0 20px;font-family:${FONT_DISPLAY};font-size:24px;font-weight:700;letter-spacing:-0.03em;line-height:1.15;color:${INK};">${titre}</h1>`,
      contenu,
      bouton ? cta(bouton.label, bouton.url) : "",
    ].join(""),
    pied: `Coolbeans — l'op&eacute;rationnel qui tourne tout seul.<br>
              ${piedContexte}<br>
              <a href="https://coolbeans.cc" style="color:${MUTE};text-decoration:underline;">coolbeans.cc</a>`,
  });
}
