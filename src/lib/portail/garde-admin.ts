// Qui peut atteindre quel chemin. Fonction pure, comme appartenances.ts : elle
// ne connait ni Astro, ni la session, ni le reseau — c'est ce qui rend la
// garde testable sans base et sans build.
//
// La garde vit ici et non dans les pages parce qu'une protection qu'il faut
// penser a ecrire finit par etre oubliee. Sous ces prefixes, il n'y a rien a
// ecrire : la page est gardee parce qu'elle est la.
//
// Spec : docs/superpowers/specs/2026-09-01-portail-garde-admin-design.md

import { isAdmin, type PortalMetadata } from "./metadata";

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

export type Decision = "passe" | "connexion" | "introuvable";

/**
 * L'ordre des trois questions est la conception, pas un detail :
 * hors perimetre → pas connecte → pas admin. Inverser les deux dernieres
 * renverrait un 404 a un admin dont la session vient d'expirer, qui croirait
 * la page supprimee.
 */
export function decisionAcces(
  pathname: string,
  connecte: boolean,
  meta: PortalMetadata,
): Decision {
  if (!estRouteProtegee(pathname)) return "passe";
  if (!connecte) return "connexion";
  if (estRouteAdmin(pathname) && !isAdmin(meta)) return "introuvable";
  return "passe";
}
