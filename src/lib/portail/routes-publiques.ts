// Les chemins que l'hôte du portail sert tels quels.
//
// Sur my.coolbeans.cc, tout chemin qui n'est pas dans cette liste est
// réécrit en /espace<chemin> par src/worker.ts. Une page publique oubliée
// ici devient donc inatteignable : elle part sous /espace, où le middleware
// exige une session, et renvoie vers la connexion. Le symptôme ne désigne
// jamais sa cause.
//
// La logique vit dans ce module et non dans worker.ts pour être testable :
// worker.ts importe le handler Astro de Cloudflare, indisponible sous
// Vitest. Même raison d'être que garde-admin.ts.

/**
 * Les pages publiques du portail, hors préfixes techniques.
 *
 * Toute page ajoutée à la racine et destinée à quelqu'un qui n'a PAS de
 * session se déclare ici. Les trois actuelles forment le parcours d'accès :
 * se connecter, demander un lien, choisir un nouveau mot de passe.
 */
export const CHEMINS_PUBLICS_PORTAIL = [
  "/connexion",
  "/mot-de-passe-oublie",
  "/reinitialiser",
] as const;

/**
 * `true` quand le chemin doit être servi sans préfixe /espace.
 *
 * La barre finale est tolérée : un lien copié à la main la porte souvent, et
 * la faire échouer enverrait la personne sur une page de connexion sans rien
 * lui expliquer.
 */
export function estServiTelQuel(pathname: string): boolean {
  // Préfixes techniques : les assets buildés et l'API, dont les routes
  // d'authentification que ces pages appellent.
  if (pathname.startsWith("/_") || pathname.startsWith("/api/")) return true;
  // La doc client garde ses URLs propres, elle n'est pas sous /espace.
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return true;

  const sansBarre =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return (CHEMINS_PUBLICS_PORTAIL as readonly string[]).includes(sansBarre);
}
