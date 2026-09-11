// Client Google Calendar v3 pour le calendrier Livraisons.
//
// Compte de service sans delegation a l'echelle du domaine : le calendrier est
// partage a la main avec l'adresse du compte de service. Le jeton est signe
// ici en WebCrypto, sans dependance ajoutee.
//
// L'identifiant de l'evenement est derive de celui de la milestone Linear :
// creer et mettre a jour deviennent la meme operation, et aucune table de
// correspondance n'est tenue.

import { titreEvenement } from "./etiquette";
import type { Livraison } from "./linear-milestones";

const API = "https://www.googleapis.com/calendar/v3/calendars";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const MARQUE = "livraisons";

export function idEvenement(milestoneId: string): string {
  return `lm${milestoneId.replace(/-/g, "")}`;
}

export function lendemain(iso: string): string {
  // slice(0, 10) rend la fonction insensible a une entree qui porterait une
  // heure : seule la date compte, l'evenement est journee entiere.
  const date = iso.slice(0, 10);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function corpsEvenement(l: Livraison): Record<string, unknown> {
  return {
    id: idEvenement(l.milestoneId),
    summary: titreEvenement(l.cleTeam, l.etiquette),
    description: `${l.projetNom}\n${l.projetUrl}`,
    start: { date: l.date },
    end: { date: lendemain(l.date) },
    // Une echeance borne le temps, elle ne l'occupe pas : la marquer occupee
    // fausserait toute recherche de creneau.
    transparency: "transparent",
    extendedProperties: { private: { source: MARQUE } },
  };
}

function base64url(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const texteEnBase64url = (t: string) => base64url(new TextEncoder().encode(t));

async function importerCle(clePriveeBase64: string): Promise<CryptoKey> {
  // `openssl base64` et plusieurs variantes de `base64` inserent des retours
  // a la ligne dans leur sortie : sans ce nettoyage, atob leve une erreur
  // opaque qui ne dit rien du vrai probleme.
  const nettoye = clePriveeBase64.replace(/\s+/g, "");
  const pem = atob(nettoye);
  if (!pem.includes("BEGIN")) {
    throw new Error(
      "Google cle privee : le contenu decode ne contient pas BEGIN. La valeur attendue est le champ " +
        "private_key du JSON du compte de service, encode en base64, pas le JSON entier.",
    );
  }
  const corps = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(corps), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function jetonAcces(email: string, clePriveeBase64: string): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = texteEnBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = texteEnBase64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      // Recul de 60 secondes : un leger decalage d'horloge suffit a faire
      // refuser par Google un jeton dont l'emission semble future.
      iat: maintenant - 60,
      exp: maintenant + 3600,
    }),
  );
  const cle = await importerCle(clePriveeBase64);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cle,
    new TextEncoder().encode(`${entete}.${charge}`),
  );
  const assertion = `${entete}.${charge}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status} : ${await res.text()}`);
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("Google token : reponse sans access_token");
  return access_token;
}

export async function listerIdsLivraisons(jeton: string, calendarId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `source=${MARQUE}`,
      maxResults: "2500",
      showDeleted: "false",
      fields: "items(id),nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${API}/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { authorization: `Bearer ${jeton}` },
    });
    if (!res.ok) throw new Error(`Google list ${res.status} : ${await res.text()}`);
    const page = (await res.json()) as { items?: Array<{ id: string }>; nextPageToken?: string };
    for (const item of page.items ?? []) ids.push(item.id);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

export async function ecrireEvenement(
  jeton: string,
  calendarId: string,
  l: Livraison,
): Promise<"cree" | "maj"> {
  const corps = corpsEvenement(l);
  const id = idEvenement(l.milestoneId);
  const base = `${API}/${encodeURIComponent(calendarId)}/events`;
  const entetes = { authorization: `Bearer ${jeton}`, "content-type": "application/json" };

  const maj = await fetch(`${base}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: entetes,
    body: JSON.stringify(corps),
  });
  if (maj.ok) return "maj";
  if (maj.status !== 404) throw new Error(`Google put ${maj.status} : ${await maj.text()}`);

  const creation = await fetch(base, { method: "POST", headers: entetes, body: JSON.stringify(corps) });
  if (creation.ok) return "cree";
  if (creation.status !== 409) throw new Error(`Google post ${creation.status} : ${await creation.text()}`);

  // 409 sur la creation : Google garde la trace d'un evenement supprime puis
  // recree avec le meme identifiant (date retiree d'une milestone, puis
  // remise quelques jours plus tard). L'evenement existe donc reellement
  // cote Google, il suffit de rejouer le PUT une fois.
  const rattrapage = await fetch(`${base}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: entetes,
    body: JSON.stringify(corps),
  });
  if (!rattrapage.ok) {
    throw new Error(
      `Google put ${rattrapage.status} apres 409 en creation pour ${id} : ${await rattrapage.text()}`,
    );
  }
  return "maj";
}

export async function supprimerEvenement(
  jeton: string,
  calendarId: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${jeton}` },
  });
  // 404 et 410 : l'evenement est deja parti, l'intention est satisfaite.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google delete ${res.status} : ${await res.text()}`);
  }
}
