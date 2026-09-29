/* ============================================================================
   COOLBEANS : aperçu et envoi d'une relance de facture.

   Sous /api/admin/, donc gardée par le middleware au même titre que
   /espace/admin (voir src/lib/portail/garde-admin.ts). Rien à écrire ici pour
   la protection : elle tient au préfixe.

   Deux actions sur la même route parce que l'aperçu doit composer exactement
   ce que l'envoi expédiera. Deux chemins de rendu séparés finiraient par
   diverger, et on découvrirait l'écart chez le client.
   ========================================================================== */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";

import { renderRelanceFacture, type NiveauRelance } from "../../../emails/relance-facture";

export const prerender = false;

const EXPEDITEUR = "Coolbeans Facturation <facturation@coolbeans.cc>";

/** Les réponses partent chez Ludo, pas sur l'adresse de facturation. */
const REPONDRE_A = "ludo@coolbeans.cc";

const NIVEAUX: NiveauRelance[] = ["rappel", "relance", "mise-en-demeure"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const estISO = (valeur: unknown): valeur is string =>
  typeof valeur === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valeur);

const estEmail = (valeur: unknown): valeur is string =>
  typeof valeur === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);

const texte = (valeur: unknown): string => (typeof valeur === "string" ? valeur.trim() : "");

export const POST: APIRoute = async ({ request }) => {
  let corps: Record<string, unknown>;
  try {
    corps = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Corps de requête illisible." }, 400);
  }

  const action = texte(corps.action) || "apercu";
  if (action !== "apercu" && action !== "envoi") {
    return json({ error: "Action inconnue." }, 400);
  }

  const niveau = texte(corps.niveau) as NiveauRelance;
  if (!NIVEAUX.includes(niveau)) {
    return json({ error: "Niveau de relance inconnu." }, 400);
  }

  const societe = texte(corps.societe);
  const numeroFacture = texte(corps.numeroFacture);
  const iban = texte(corps.iban);
  const bic = texte(corps.bic);

  if (!societe || !numeroFacture || !iban || !bic) {
    return json({ error: "Société, numéro de facture, IBAN et BIC sont obligatoires." }, 400);
  }

  if (!estISO(corps.emissionISO) || !estISO(corps.echeanceISO)) {
    return json({ error: "Dates attendues au format AAAA-MM-JJ." }, 400);
  }

  if (corps.echeanceISO < corps.emissionISO) {
    return json({ error: "L'échéance précède l'émission." }, 400);
  }

  const montantTTC = Number(corps.montantTTC);
  if (!Number.isFinite(montantTTC) || montantTTC <= 0) {
    return json({ error: "Montant TTC invalide." }, 400);
  }

  const montantHTBrut = Number(corps.montantHT);
  const montantHT = Number.isFinite(montantHTBrut) && montantHTBrut > 0 ? montantHTBrut : undefined;

  const mail = renderRelanceFacture({
    niveau,
    societe,
    prenom: texte(corps.prenom) || undefined,
    numeroFacture,
    emissionISO: corps.emissionISO,
    echeanceISO: corps.echeanceISO,
    montantTTC,
    montantHT,
    iban,
    bic,
    lienFacture: texte(corps.lienFacture) || undefined,
  });

  if (action === "apercu") {
    return json({ subject: mail.subject, html: mail.html, text: mail.text });
  }

  /* L'envoi ne valide les destinataires qu'ici : un aperçu doit rester
     possible avant même de savoir à qui la relance partira. */
  const destinataires = Array.isArray(corps.destinataires)
    ? corps.destinataires.map((d) => texte(d)).filter(Boolean)
    : [];

  if (destinataires.length === 0 || !destinataires.every(estEmail)) {
    return json({ error: "Au moins un destinataire valide est nécessaire." }, 400);
  }

  if (!env.RESEND_API_KEY) {
    console.error("relance-facture: RESEND_API_KEY absent de cet environnement");
    return json({ error: "Envoi indisponible sur cet environnement." }, 503);
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: EXPEDITEUR,
      to: destinataires,
      replyTo: REPONDRE_A,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (error) {
      console.error("relance-facture: Resend a refusé l'envoi", error);
      return json({ error: "Envoi refusé par Resend." }, 502);
    }

    return json({ ok: true, id: data?.id ?? null, subject: mail.subject });
  } catch (err) {
    console.error("relance-facture: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessaie dans un instant." }, 502);
  }
};
