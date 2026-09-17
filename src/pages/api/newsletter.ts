import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

/* Inscription à la newsletter depuis le footer du site (Footer.astro).
   La liste vit chez MailerLite, pas chez Resend : Resend porte le
   transactionnel du portail, MailerLite porte l'emailing marketing.

   Inscription directe, pas de double opt-in : l'abonné est créé en statut
   `active` et reçoit la prochaine campagne sans mail de confirmation. Aucun
   mail de confirmation ne vient donc attester du geste, et la preuve du
   consentement tient entièrement dans ce qu'on enregistre ici : date et IP,
   en `opted_in_at` et `optin_ip`. Sans eux il ne resterait qu'une adresse
   dans une liste, ce qui ne prouve rien.

   Aucun groupe : l'abonné atterrit dans la liste globale. Le jour où un
   groupe existe, l'appel devient POST /subscribers avec `groups: [id]`.

   Endpoint ouvert, donc borné : format, longueur, et un champ piège. */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MAX_EMAIL = 200;

/* Validation volontairement permissive : le seul juge du fait qu'une adresse
   existe est le serveur qui la reçoit. On écarte ce qui n'est manifestement
   pas une adresse, on ne tente pas de rejouer la RFC 5322. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Format de date attendu par MailerLite : « yyyy-MM-dd HH:mm:ss », UTC. Ni
   ISO 8601, ni timestamp : un autre format part en 422. */
const horodatage = () => new Date().toISOString().slice(0, 19).replace("T", " ");

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const { email, website } = data as Record<string, unknown>;

  /* Champ piège : invisible et vide pour un humain, rempli par les robots qui
     remplissent tout ce qu'ils trouvent. On répond 200 sans rien créer, pour
     ne pas leur apprendre que le piège existe. */
  if (typeof website === "string" && website.trim() !== "") {
    return json({ ok: true }, 200);
  }

  if (typeof email !== "string" || email.length > MAX_EMAIL || !EMAIL.test(email.trim())) {
    return json({ error: "Adresse e-mail invalide." }, 400);
  }

  const cle = env.MAILERLITE_API_KEY;
  if (!cle) {
    console.error("newsletter : MAILERLITE_API_KEY absente sur cet environnement");
    return json({ error: "Inscription indisponible pour le moment." }, 503);
  }

  /* `ip_address` et `optin_ip` doivent être des IP valides côté MailerLite :
     une valeur nulle ou vide part en 422. On lit l'en-tête que Cloudflare
     pose sur chaque requête, et on omet les deux champs s'il manque plutôt
     que d'envoyer du vide. L'en-tête est absent en local, c'est normal. */
  const ip = request.headers.get("cf-connecting-ip");
  const maintenant = horodatage();

  /* `resubscribe` reste à son défaut (false) : quelqu'un qui s'est désinscrit
     ne revient pas dans la liste parce qu'un formulaire ouvert a reçu son
     adresse. Sans double opt-in, c'est la seule barrière qui reste entre un
     POST forgé et la réinscription d'un désabonné. */
  const charge: Record<string, unknown> = {
    email: email.trim().toLowerCase(),
    status: "active",
    subscribed_at: maintenant,
    opted_in_at: maintenant,
  };
  if (ip) {
    charge.ip_address = ip;
    charge.optin_ip = ip;
  }

  let reponse: Response;
  try {
    reponse = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cle}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(charge),
    });
  } catch (e) {
    console.error("newsletter : MailerLite injoignable", e);
    return json({ error: "Inscription indisponible pour le moment." }, 502);
  }

  /* MailerLite répond 201 à la création et 200 quand l'adresse existait déjà,
     qu'il met alors à jour. Les deux sont un succès du point de vue de la
     personne : elle est abonnée. */
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    console.error("newsletter : MailerLite a refusé", reponse.status, detail.slice(0, 500));
    // 422 = adresse rejetée par MailerLite (jetable, blacklistée, malformée).
    if (reponse.status === 422) return json({ error: "Adresse e-mail refusée." }, 400);
    return json({ error: "Inscription indisponible pour le moment." }, 502);
  }

  return json({ ok: true }, 200);
};
