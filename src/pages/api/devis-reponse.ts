import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import {
  renderConfirmationQuestion,
  renderConfirmationValidation,
} from "../../emails/devis-confirmation";
import {
  citation,
  esc,
  kv,
  p,
  renderTransactionnel,
  titreSection,
} from "../../emails/transactionnel";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const {
    slug,
    reponse,
    prenom,
    nom,
    email,
    message,
    consentement,
    raisonSociale,
    siren,
    adresse,
    tva,
  } = data as Record<string, unknown>;
  if (typeof slug !== "string" || (reponse !== "validation" && reponse !== "question")) {
    return json({ error: "Requête invalide." }, 400);
  }
  // Prénom obligatoire : il ouvre les accusés de réception, qui n'ont pas de
  // formulation de repli. Nom obligatoire aussi, quelle que soit la réponse.
  if (typeof prenom !== "string" || !prenom.trim()) {
    return json({ error: "Merci de renseigner votre prénom." }, 400);
  }
  if (typeof nom !== "string" || !nom.trim()) {
    return json({ error: "Merci de renseigner votre nom." }, 400);
  }
  // Le consentement conditionne l'envoi : la case du formulaire ne protège que
  // le navigateur, un POST direct doit être refusé de la même façon.
  if (consentement !== true) {
    return json({ error: "Merci d'accepter la conservation de vos informations." }, 400);
  }
  // L'email est obligatoire : il sert d'adresse de réponse ET de destinataire de
  // l'accusé de réception envoyé au client.
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json({ error: "Merci de renseigner un email valide." }, 400);
  }
  // Pour facturer, seule l'adresse est indispensable : raison sociale et SIREN
  // n'existent pas quand le client répond en tant que particulier.
  if (reponse === "validation" && (typeof adresse !== "string" || !adresse.trim())) {
    return json({ error: "Merci de renseigner l'adresse de facturation." }, 400);
  }

  const objetReponse =
    reponse === "validation" ? "Validation de la proposition" : "Question / remarque";

  const champ = (valeur: unknown): string | undefined =>
    typeof valeur === "string" && valeur ? valeur : undefined;

  const prenomClient = prenom.trim();
  const nomClient = nom.trim();
  const emailClient = email.trim();
  // Trace du consentement : sans base de données, l'email de notification est le
  // seul endroit où il en reste une preuve horodatée.
  const traceConsentement = "Accord&eacute; via le formulaire du devis";

  const html = renderTransactionnel({
    preheader: `${objetReponse} — devis ${esc(slug)}`,
    kicker: `Devis · ${esc(slug)}`,
    titre: objetReponse,
    contenu: [
      kv([
        ["Prénom", esc(prenomClient)],
        ["Nom", esc(nomClient)],
        ["Email", esc(emailClient)],
        ["Raison sociale", champ(raisonSociale) && esc(champ(raisonSociale)!)],
        ["SIREN", champ(siren) && esc(champ(siren)!)],
        ["Adresse", champ(adresse) && esc(champ(adresse)!)],
        ["TVA intracom.", champ(tva) && esc(champ(tva)!)],
        ["Consentement", traceConsentement],
      ]),
      champ(message)
        ? titreSection("Message du client") +
          citation(esc(champ(message)!).replace(/\n/g, "<br>"))
        : titreSection("Message du client") + p("(pas de message)"),
    ].join(""),
    cta: {
      label: "Voir le devis",
      url: `https://coolbeans.cc/devis/${encodeURIComponent(slug)}`,
    },
    piedContexte: "R&eacute;ponse re&ccedil;ue via la page publique du devis.",
  });

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Devis Coolbeans <devis@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: emailClient,
      subject: `Devis ${slug} — ${objetReponse}`,
      html,
      text: [
        `Devis : ${slug}`,
        `Réponse : ${objetReponse}`,
        `Prénom : ${prenomClient}`,
        `Nom : ${nomClient}`,
        `Email : ${emailClient}`,
        champ(raisonSociale) && `Raison sociale : ${champ(raisonSociale)}`,
        champ(siren) && `SIREN : ${champ(siren)}`,
        champ(adresse) && `Adresse : ${champ(adresse)}`,
        champ(tva) && `TVA intracommunautaire : ${champ(tva)}`,
        "Consentement : accordé via le formulaire du devis",
        "",
        champ(message) ?? "(pas de message)",
      ]
        .filter((ligne) => ligne !== undefined)
        .join("\n"),
    });

    if (error) throw error;

    // Accusé de réception au client. Un échec ici ne doit pas faire échouer la
    // requête : le message est déjà arrivé chez Ludo, c'est ce qui compte.
    const confirmation = (
      reponse === "validation" ? renderConfirmationValidation : renderConfirmationQuestion
    )({
      slug,
      prenom: prenomClient,
      message: champ(message),
      raisonSociale: champ(raisonSociale),
      siren: champ(siren),
      adresse: champ(adresse),
      tva: champ(tva),
    });

    const { error: erreurConfirmation } = await resend.emails.send({
      from: "Ludo de Coolbeans <devis@coolbeans.cc>",
      to: emailClient,
      replyTo: "ludo@coolbeans.cc",
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
    if (erreurConfirmation) {
      console.error("devis-reponse: accusé de réception non envoyé", erreurConfirmation);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("devis-reponse: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessaie dans un instant." }, 502);
  }
};
