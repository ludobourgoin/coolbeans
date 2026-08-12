import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { esc, kv, p, renderTransactionnel, sep } from "../../emails/transactionnel";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const { slug, reponse, nom, email, message, raisonSociale, siren, adresse, tva } =
    data as Record<string, unknown>;
  if (typeof slug !== "string" || (reponse !== "validation" && reponse !== "question")) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (
    reponse === "validation" &&
    (typeof raisonSociale !== "string" ||
      !raisonSociale.trim() ||
      typeof siren !== "string" ||
      !siren.trim() ||
      typeof adresse !== "string" ||
      !adresse.trim())
  ) {
    return json({ error: "Informations de facturation manquantes." }, 400);
  }

  const objetReponse =
    reponse === "validation" ? "Validation de la proposition" : "Question / remarque";

  const champ = (valeur: unknown): string | undefined =>
    typeof valeur === "string" && valeur ? valeur : undefined;

  const html = renderTransactionnel({
    preheader: `${objetReponse} — devis ${esc(slug)}`,
    kicker: `Devis · ${esc(slug)}`,
    titre: objetReponse,
    contenu: [
      kv([
        ["Nom", champ(nom) && esc(champ(nom)!)],
        ["Email", champ(email) && esc(champ(email)!)],
        ["Raison sociale", champ(raisonSociale) && esc(champ(raisonSociale)!)],
        ["SIREN", champ(siren) && esc(champ(siren)!)],
        ["Adresse", champ(adresse) && esc(champ(adresse)!)],
        ["TVA intracom.", champ(tva) && esc(champ(tva)!)],
      ]),
      champ(message)
        ? sep() + p(esc(champ(message)!).replace(/\n/g, "<br>"))
        : p("(pas de message)"),
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
      replyTo: typeof email === "string" && email ? email : undefined,
      subject: `Devis ${slug} — ${objetReponse}`,
      html,
      text: [
        `Devis : ${slug}`,
        `Réponse : ${objetReponse}`,
        typeof nom === "string" && nom ? `Nom : ${nom}` : null,
        typeof email === "string" && email ? `Email : ${email}` : null,
        typeof raisonSociale === "string" && raisonSociale
          ? `Raison sociale : ${raisonSociale}`
          : null,
        typeof siren === "string" && siren ? `SIREN : ${siren}` : null,
        typeof adresse === "string" && adresse ? `Adresse : ${adresse}` : null,
        typeof tva === "string" && tva ? `TVA intracommunautaire : ${tva}` : null,
        "",
        typeof message === "string" && message ? message : "(pas de message)",
      ]
        .filter((ligne) => ligne !== null)
        .join("\n"),
    });

    if (error) throw error;
    return json({ ok: true }, 200);
  } catch (err) {
    console.error("devis-reponse: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessaie dans un instant." }, 502);
  }
};
