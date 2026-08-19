// Analyse et authentification des webhooks Linear (spec §7, §9).
// La signature est un HMAC-SHA256 hex du CORPS BRUT, header `linear-signature`.
// Sans vérification, n'importe qui pourrait faire publier de faux messages
// aux clients — c'est la garde non négociable de la spec.
import { SUPPORT_LABEL_ID } from "../linear";
import { corpsPublie } from "./regles";

/** Décode un hex en bytes, ou null si la chaîne n'est pas un hex bien formé. */
function hexVersBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function signatureValide(
  secret: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const signatureBytes = hexVersBytes(signature);
  // 32 octets = taille d'un HMAC-SHA256 ; toute autre longueur est rejetée
  // avant même d'appeler la primitive crypto.
  if (!signatureBytes || signatureBytes.length !== 32) return false;
  const cle = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  // crypto.subtle.verify compare en temps constant côté runtime : une
  // comparaison `===` sur la version hex fuiterait le préfixe commun via le
  // timing, un boulevard pour deviner la signature octet par octet.
  return crypto.subtle.verify("HMAC", cle, signatureBytes, new TextEncoder().encode(rawBody));
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

export interface EvenementIssue {
  issueId: string;
  teamId: string;
  /** Le label « Support » est-il posé sur l'issue après cet événement ? */
  support: boolean;
}

/**
 * Événement d'issue portant (ou ayant porté) le label « Support ».
 *
 * Les `update` comptent autant que les `create` : le geste courant est de
 * créer l'issue puis de poser le label, et c'est aussi comme ça qu'on le
 * retire. On retourne donc l'état du label après l'événement, et l'appelant
 * décide — ouvrir un fil, ou masquer celui qui existe.
 */
export function analyserEvenementIssue(payload: unknown): EvenementIssue | null {
  const p = payload as {
    action?: string;
    type?: string;
    data?: { id?: string; teamId?: string; labelIds?: unknown };
  };
  if (p.type !== "Issue") return null;
  if (p.action !== "create" && p.action !== "update") return null;
  const { id, teamId, labelIds } = p.data ?? {};
  if (!id || !teamId) return null;
  const labels = Array.isArray(labelIds) ? labelIds : [];
  return { issueId: id, teamId, support: labels.includes(SUPPORT_LABEL_ID) };
}
