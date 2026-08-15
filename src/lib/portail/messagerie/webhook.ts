// Analyse et authentification des webhooks Linear (spec §7, §9).
// La signature est un HMAC-SHA256 hex du CORPS BRUT, header `linear-signature`.
// Sans vérification, n'importe qui pourrait faire publier de faux messages
// aux clients — c'est la garde non négociable de la spec.
import { corpsPublie } from "./regles";

export async function signatureValide(
  secret: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const cle = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

interface EvenementCommentaire {
  commentId: string;
  issueId: string;
  body: string;
}

/**
 * Ne retient que la création d'un commentaire publiable (marqueur >>).
 * Les updates sont ignorés à dessein : c'est le re-fetch du cron qui lit la
 * version finale, un update pendant le délai de grâce n'a rien à déclencher.
 */
export function analyserEvenement(payload: unknown): EvenementCommentaire | null {
  const p = payload as {
    action?: string;
    type?: string;
    data?: { id?: string; body?: string; issueId?: string };
  };
  if (p.action !== "create" || p.type !== "Comment") return null;
  const { id, body, issueId } = p.data ?? {};
  if (!id || !body || !issueId) return null;
  if (corpsPublie(body) === null) return null;
  return { commentId: id, issueId, body };
}
