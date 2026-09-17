import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { getEntry } from "astro:content";
import { renderLivrableConfirmation } from "../../emails/livrable-confirmation";
import {
  citation,
  esc,
  kv,
  p,
  renderTransactionnel,
  titreSection,
} from "../../emails/transactionnel";
import { REPONSES_LIVRABLE, estReponseLivrable } from "../../lib/livrable";

export const prerender = false;

/* Réponse à un document de livrable. Jumeau de /api/cadrage-reponse : aucune
   écriture en base, aucun effet Linear. Le mail est la trace, Ludo lit et
   décide. Une validation de livrable n'est pas une signature : elle ouvre la
   mise en ligne, elle ne déclenche pas de facture. */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MAX_MESSAGE = 8000;

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const { slug, reponse, prenom, nom, email, message, consentement } = data as Record<
    string,
    unknown
  >;

  if (typeof slug !== "string" || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(slug) || slug.length > 96) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (!estReponseLivrable(reponse)) return json({ error: "Requête invalide." }, 400);
  if (
    (typeof prenom === "string" && prenom.length > 100) ||
    (typeof nom === "string" && nom.length > 100) ||
    (typeof email === "string" && email.length > 200)
  ) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (typeof message === "string" && message.length > MAX_MESSAGE) {
    return json({ error: "Message trop long (8 000 caractères max)." }, 400);
  }
  if (typeof prenom !== "string" || !prenom.trim()) {
    return json({ error: "Merci de renseigner votre prénom." }, 400);
  }
  if (typeof nom !== "string" || !nom.trim()) {
    return json({ error: "Merci de renseigner votre nom." }, 400);
  }
  if (consentement !== true) {
    return json({ error: "Merci d'accepter la conservation de vos informations." }, 400);
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json({ error: "Merci de renseigner un email valide." }, 400);
  }
  const messageClient = typeof message === "string" && message.trim() ? message.trim() : undefined;
  if (reponse === "retours" && !messageClient) {
    return json({ error: "Merci de détailler vos retours dans le message." }, 400);
  }

  /* Le document est relu ici : titre et version viennent du YAML, jamais du
     navigateur. Le slug peut désigner une V2 (sans URL propre) : c'est voulu,
     la réponse doit s'étiqueter avec la version que le client regardait. */
  const doc = await getEntry("livrable", slug).catch(() => undefined);
  if (!doc) {
    console.error(`livrable-reponse: document ${slug} introuvable dans la collection`);
    return json({ error: "Document introuvable." }, 404);
  }

  const prenomClient = prenom.trim();
  const nomClient = nom.trim();
  const emailClient = email.trim();
  const libelle = REPONSES_LIVRABLE[reponse];
  const racine = doc.data.versionDe ?? slug;
  const version = doc.data.version;

  const html = renderTransactionnel({
    preheader: `${libelle} · ${esc(doc.data.titre)}`,
    kicker: `Livrable · ${esc(slug)}`,
    titre: `${libelle} (V${version})`,
    contenu: [
      kv([
        ["Réponse", esc(libelle)],
        ["Version", `V${version}`],
        ["Prénom", esc(prenomClient)],
        ["Nom", esc(nomClient)],
        ["Email", esc(emailClient)],
        ["Consentement", "Accord&eacute; via le formulaire du livrable"],
      ]),
      messageClient
        ? titreSection("Message") + citation(esc(messageClient).replace(/\n/g, "<br>"))
        : titreSection("Message") + p("(pas de message)"),
    ].join(""),
    cta: { label: "Voir le livrable", url: `https://coolbeans.cc/livrable/${racine}` },
    piedContexte: "R&eacute;ponse re&ccedil;ue via la page publique du livrable.",
  });

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Livrable Coolbeans <devis@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: emailClient,
      subject: `Livrable ${slug} · ${libelle} · ${prenomClient} ${nomClient}`,
      html,
      text: [
        `Livrable : ${slug} (V${version})`,
        `Document : ${doc.data.titre}`,
        `Réponse : ${libelle}`,
        `Prénom : ${prenomClient}`,
        `Nom : ${nomClient}`,
        `Email : ${emailClient}`,
        "Consentement : accordé via le formulaire du livrable",
        "",
        messageClient ?? "(pas de message)",
      ].join("\n"),
    });
    if (error) throw error;

    /* Accusé de réception au client. Un échec ici ne fait pas échouer la
       requête : la réponse est déjà chez Ludo. */
    const confirmation = renderLivrableConfirmation({
      slug: racine,
      prenom: prenomClient,
      titre: doc.data.titre,
      reponse,
      message: messageClient,
      tutoiement: doc.data.tutoiement,
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
      console.error("livrable-reponse: accusé de réception non envoyé", erreurConfirmation);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("livrable-reponse: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessayez dans un instant." }, 502);
  }
};
