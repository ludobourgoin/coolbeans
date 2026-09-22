// Règles du mot de passe, au même endroit pour le serveur et pour l'écran.
//
// `LONGUEUR_MIN` est lue par les options Better Auth (`minPasswordLength`) et
// par la page de réinitialisation. Deux valeurs écrites séparément finiraient
// par diverger, et l'écran annoncerait une règle que le serveur ne tient pas.

export const LONGUEUR_MIN = 8;

/**
 * Le message d'erreur à afficher, ou `null` si le mot de passe convient.
 *
 * Rend un message et non un booléen : à l'écran, « ce n'est pas valide » sans
 * dire pourquoi oblige la personne à deviner, sur un formulaire qu'elle
 * n'ouvre qu'une fois.
 */
export function validerNouveauMotDePasse(
  motDePasse: string,
  confirmation: string,
): string | null {
  if (!motDePasse) return "Choisissez un mot de passe.";
  if (motDePasse.length < LONGUEUR_MIN) {
    return `Votre mot de passe doit faire au moins ${LONGUEUR_MIN} caractères.`;
  }
  // Comparaison avant la confirmation vide : « les deux ne correspondent pas »
  // décrit mieux un champ oublié que « confirmez votre mot de passe », qui
  // laisse croire à une étape en plus.
  if (motDePasse !== confirmation) return "Les deux mots de passe ne correspondent pas.";
  return null;
}
