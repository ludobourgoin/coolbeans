// Navigation du portail client (tâche S0.7).
//
// Une subtilité d'URL traverse tout le portail : `/espace` est un chemin
// INTERNE. Sur my.coolbeans.cc, src/worker.ts réécrit `/projets` en
// `/espace/projets` avant Astro, et redirige `/espace/*` en 301 vers la forme
// courte. L'URL publique n'a donc jamais le préfixe, mais `Astro.url.pathname`
// l'a toujours.
//
// D'où deux fonctions distinctes, à ne pas confondre :
//   · portalHref()  construit un lien   → dépend de l'HÔTE
//   · isActive()    surligne l'entrée   → dépend du PATHNAME interne
//
// Sans ça, le portail est incliquable en `astro dev` local (localhost n'est
// pas un hôte portail : il faut y garder le préfixe /espace).

import type { PortalClient } from "./clients";
import { isAdmin, type PortalMetadata } from "./metadata";

/** Hôtes sur lesquels le préfixe /espace est retiré de l'URL publique. */
const PORTAL_HOSTS = ["my.coolbeans.cc", "my-staging.coolbeans.cc"];

export function isPortalHost(hostname: string): boolean {
  return PORTAL_HOSTS.includes(hostname);
}

/**
 * Lien vers une page du portail, à partir de son chemin sous /espace.
 * `portalHref("/projets", "my.coolbeans.cc")` → `/projets`
 * `portalHref("/projets", "localhost")`       → `/espace/projets`
 */
export function portalHref(path: string, hostname: string): string {
  const suffix = path === "/" || path === "" ? "" : path;
  if (isPortalHost(hostname)) return suffix === "" ? "/" : suffix;
  return `/espace${suffix}`;
}

export interface PortalNavItem {
  label: string;
  href: string;
  /** Préfixe de pathname INTERNE qui marque l'entrée comme active. */
  activePrefix: string;
}

/**
 * Une entrée est active sur elle-même et sur ses sous-pages, jamais par
 * simple inclusion de chaîne : `/espace/site` ne doit pas allumer une entrée
 * `/espace/s`. La racine `/espace` n'est active que sur elle-même, sinon elle
 * s'allumerait sur tout le portail.
 */
export function isActive(item: PortalNavItem, pathname: string): boolean {
  const prefix = item.activePrefix;
  if (prefix === "/espace") return pathname === "/espace" || pathname === "/espace/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Les cinq entrées du wireframe, plus les entrées admin-only qui s'y ajoutent
 * (l'espace admin est le même portail, avec du contenu en plus — pas une autre
 * interface).
 *
 * L'entrée Doc suit le CLIENT COURANT et non l'utilisateur : un admin basculé
 * sur Amusoire doit voir la doc d'Amusoire. Quand le client courant n'a pas de
 * doc — ou qu'il n'y a pas de client courant — l'entrée mène à une page de
 * l'espace qui l'explique, plutôt qu'à un lien mort (/docs n'est pas une
 * route) ou à une entrée qui disparaît de la nav.
 */
export function buildPortalNav(
  hostname: string,
  meta: PortalMetadata,
  client: PortalClient | null,
): PortalNavItem[] {
  const at = (path: string) => portalHref(path, hostname);
  const docSlug = client?.doc;

  const items: PortalNavItem[] = [
    { label: "Projets", href: at("/projets"), activePrefix: "/espace/projets" },
    { label: "Mon site", href: at("/site"), activePrefix: "/espace/site" },
    {
      label: "Doc",
      href: docSlug ? `/docs/${docSlug}` : at("/doc"),
      activePrefix: docSlug ? "/docs" : "/espace/doc",
    },
    { label: "Ressources", href: at("/ressources"), activePrefix: "/espace/ressources" },
    { label: "Support", href: at("/support"), activePrefix: "/espace/support" },
  ];

  if (isAdmin(meta)) {
    items.push({
      label: "Chiffrages",
      href: at("/chiffrages"),
      activePrefix: "/espace/chiffrages",
    });
  }

  return items;
}
