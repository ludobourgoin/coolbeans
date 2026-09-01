// Qui peut atteindre quel chemin. Fonction pure, comme appartenances.ts : elle
// ne connait ni Astro, ni la session, ni le reseau — c'est ce qui rend la
// garde testable sans base et sans build.
//
// La garde vit ici et non dans les pages parce qu'une protection qu'il faut
// penser a ecrire finit par etre oubliee. Sous ces prefixes, il n'y a rien a
// ecrire : la page est gardee parce qu'elle est la.
//
// Spec : docs/superpowers/specs/2026-09-01-portail-garde-admin-design.md

const ROUTES_AUTHENTIFIEES = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];
const ROUTES_ADMIN = [/^\/espace\/admin(\/|$)/, /^\/api\/admin(\/|$)/];

/**
 * Le `(\/|$)` n'est pas cosmetique : sans lui, `/espace/administration`
 * tomberait sous la garde admin et disparaitrait pour les clients.
 *
 * La casse est normalisee vers le bas pour que la garde se ferme du bon cote.
 * Astro resout ses routes en respectant la casse, donc `/espace/ADMIN/x` ne
 * mene nulle part — mais faire dependre la securite de ce detail serait un
 * pari, pas une garantie.
 */
export function estRouteAdmin(pathname: string): boolean {
  const chemin = pathname.toLowerCase();
  return ROUTES_ADMIN.some((re) => re.test(chemin));
}

export function estRouteProtegee(pathname: string): boolean {
  const chemin = pathname.toLowerCase();
  return ROUTES_AUTHENTIFIEES.some((re) => re.test(chemin)) || estRouteAdmin(chemin);
}
