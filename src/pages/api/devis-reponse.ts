import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const { slug, reponse, nom, email, message } = data as Record<string, unknown>;
  if (typeof slug !== "string" || (reponse !== "validation" && reponse !== "question")) {
    return json({ error: "Requête invalide." }, 400);
  }

  const objetReponse =
    reponse === "validation" ? "Validation de la proposition" : "Question / remarque";

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Devis Coolbeans <devis@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: typeof email === "string" && email ? email : undefined,
      subject: `Devis ${slug} — ${objetReponse}`,
      text: [
        `Devis : ${slug}`,
        `Réponse : ${objetReponse}`,
        typeof nom === "string" && nom ? `Nom : ${nom}` : null,
        typeof email === "string" && email ? `Email : ${email}` : null,
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
