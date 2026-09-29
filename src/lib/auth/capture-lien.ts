// Récupérer un lien magique au lieu de l'envoyer.
//
// Better Auth ne rend jamais l'URL d'un lien magique : le plugin la passe au
// callback `sendMagicLink`, qui est censé l'expédier. Or Ludo veut souvent
// l'inverse : le lien sous les yeux, pour l'envoyer lui-même dans son propre
// mail, avec ses mots. Les quatre comptes du portail créés le 2026-08-29
// n'ont d'ailleurs jamais reçu de mail pour cette raison.
//
// Mécanique : la route admin réserve un jeton, le passe en en-tête à
// `signInMagicLink`, et `sendMagicLink` le reconnaît, dépose l'URL au lieu
// d'envoyer, puis la route la retire.
//
// L'en-tête seul ne suffit JAMAIS à supprimer l'envoi : il faut que le jeton
// ait été réservé au préalable par la route admin. Sans cette condition, un
// appel non authentifié sur /api/auth/sign-in/magic-link pourrait empêcher un
// mail de partir en posant l'en-tête au hasard.
//
// La réservation vit en mémoire de l'isolat, jamais en base : elle ne survit
// pas à la requête, ce qui est exactement ce qu'on veut d'un lien de connexion.

export const EN_TETE_CAPTURE = "x-coolbeans-capture-lien";

const RESERVATIONS = new Map<string, string | null>();

/** Réserve un jeton de capture. À appeler AVANT `signInMagicLink`. */
export function reserverCapture(): string {
  const jeton = crypto.randomUUID();
  RESERVATIONS.set(jeton, null);
  return jeton;
}

/**
 * Dépose l'URL si le jeton a bien été réservé. Renvoie `false` sinon, et
 * l'appelant doit alors envoyer le mail normalement.
 */
export function deposerLien(jeton: string | null | undefined, url: string): boolean {
  if (!jeton || !RESERVATIONS.has(jeton)) return false;
  RESERVATIONS.set(jeton, url);
  return true;
}

/** Retire l'URL et libère le jeton. `null` si le dépôt n'a pas eu lieu. */
export function retirerLien(jeton: string): string | null {
  const url = RESERVATIONS.get(jeton) ?? null;
  RESERVATIONS.delete(jeton);
  return url;
}
