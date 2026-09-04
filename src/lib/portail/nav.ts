// Navigation du portail client — registre central de la sidebar (COO-80).
//
// Depuis la refonte du 2026-08-14 (spec 2026-08-14-portail-sidebar-design.md),
// le portail se navigue exclusivement dans une sidebar gauche : des SECTIONS
// (titre non cliquable + icône) portant des PAGES. Ce fichier est LE registre :
// une entrée de nav n'existe nulle part ailleurs.
//
// Visibilité à deux étages, calculée ici et nulle part ailleurs :
//   1. flag global de lancement (live | wip), constant par page ;
//   2. condition par client (mapping posé : doc, monitors, …).
// Côté client : visible seulement si live ET configuré. Côté admin : tout est
// toujours visible, les entrées non prêtes portent `wip: true` (badge discret).
//
// Une subtilité d'URL traverse tout le portail : `/espace` est un chemin
// INTERNE. Sur my.coolbeans.cc, src/worker.ts réécrit `/projets` en
// `/espace/projets` avant Astro, et redirige `/espace/*` en 301 vers la forme
// courte. L'URL publique n'a donc jamais le préfixe, mais `Astro.url.pathname`
// l'a toujours. D'où deux fonctions distinctes, à ne pas confondre :
//   · portalHref()  construit un lien   → dépend de l'HÔTE
//   · isActive()    surligne l'entrée   → dépend du PATHNAME interne

import { missingKeysFor, moduleCoupe, type PortalWorkspace } from "./workspaces";
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

/* ---- Registre des sections ------------------------------------------------ */

export type IconName = "home" | "globe" | "book" | "folder" | "help" | "lock";

export interface SidebarPage extends PortalNavItem {
  /** Vrai quand la page n'est pas prête pour ce client (badge admin). */
  wip: boolean;
  /** La page porte la pastille de statut UptimeRobot (Monitoring). */
  dot?: boolean;
}

export interface SidebarSection {
  key: string;
  label: string;
  icon: IconName;
  pages: SidebarPage[];
}

/** Page de doc du client courant, résolue par le layout depuis la collection. */
export interface DocPageLink {
  title: string;
  href: string;
}

type PageFlag = "live" | "wip";

interface PageDef {
  label: string;
  /** Chemin sous /espace. */
  path: string;
  /**
   * Flag global de lancement. `wip` tant que la feature n'est pas
   * fonctionnelle — le ticket cité est celui qui la passera `live`.
   */
  flag: PageFlag;
  /** Mapping client requis. Absent = la page ne dépend d'aucun mapping. */
  configured?: (client: PortalWorkspace | null) => boolean;
  dot?: boolean;
}

interface SectionDef {
  key: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  pages: PageDef[];
}

const SECTIONS: SectionDef[] = [
  {
    key: "bienvenue",
    label: "Bienvenue",
    icon: "home",
    pages: [
      { label: "Introduction", path: "/", flag: "live" },
      // Messagerie (spec 2026-08-15-messagerie-portail-design.md §2) :
      // remplace l'ancien Support, remonte juste sous l'accueil. La clé de
      // mapping client reste `support` (MODULE_REQUIREMENTS, EmptyState) —
      // renommer la clé n'apporterait rien et toucherait Task 2.
      {
        label: "Messagerie",
        path: "/messagerie",
        flag: "live",
        configured: (c) => !moduleCoupe("support", c) && missingKeysFor("support", c).length === 0,
      },
      { label: "Liens utiles", path: "/liens", flag: "wip" }, // COO-81
    ],
  },
  {
    key: "site",
    label: "Mon site",
    icon: "globe",
    pages: [
      {
        label: "Monitoring",
        path: "/monitoring",
        flag: "wip", // COO-15 : bloqué sur la création des monitors
        configured: (c) => (c?.uptimerobot_monitor_ids.length ?? 0) > 0,
        dot: true,
      },
      { label: "SEO", path: "/seo", flag: "wip" }, // COO-55
      { label: "Analytics", path: "/analytics", flag: "wip" }, // COO-16
    ],
  },
  // La section Documentation est construite à part : ses pages viennent de la
  // collection `docs` du client courant, pas d'une liste statique.
  {
    key: "projets",
    label: "Projets",
    icon: "folder",
    pages: [
      { label: "Actifs", path: "/projets", flag: "wip" }, // COO-69 (sync Linear)
      { label: "Terminés", path: "/projets/termines", flag: "wip" }, // COO-69
      { label: "Documents", path: "/projets/documents", flag: "wip" }, // COO-70
    ],
  },
  {
    key: "aide",
    label: "Aide",
    icon: "help",
    pages: [
      { label: "Ressources", path: "/ressources", flag: "live" },
      { label: "Disponibilités", path: "/disponibilites", flag: "wip" }, // COO-11
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: "lock",
    adminOnly: true,
    pages: [
      { label: "Accueil admin", path: "/admin", flag: "live" },
      { label: "Mes clients", path: "/clients", flag: "wip" }, // COO-81
      { label: "Utilisateurs", path: "/utilisateurs", flag: "live" },
      { label: "Devis", path: "/devis", flag: "live" },
    ],
  },
];


/**
 * La sidebar complète pour un utilisateur donné.
 *
 * `docPages` : pages de doc du CLIENT COURANT (un admin basculé sur Amusoire
 * voit la doc d'Amusoire), résolues par le layout. Client sans doc : la
 * section pointe pour l'admin vers la page d'explication /espace/doc plutôt
 * qu'un lien mort, et disparaît pour un client.
 */
export function buildSidebar(
  hostname: string,
  meta: PortalMetadata,
  client: PortalWorkspace | null,
  docPages: DocPageLink[],
): SidebarSection[] {
  const admin = isAdmin(meta);
  const at = (path: string) => portalHref(path, hostname);

  const sections: SidebarSection[] = [];

  for (const def of SECTIONS) {
    if (def.adminOnly && !admin) continue;

    const pages: SidebarPage[] = [];
    for (const page of def.pages) {
      const configured = page.configured?.(client) ?? true;
      const ready = page.flag === "live" && configured;
      if (!admin && !ready) continue;
      pages.push({
        label: page.label,
        href: at(page.path),
        activePrefix: page.path === "/" ? "/espace" : `/espace${page.path}`,
        wip: !ready,
        ...(page.dot ? { dot: true } : {}),
      });
    }
    if (pages.length > 0) sections.push({ key: def.key, label: def.label, icon: def.icon, pages });
  }

  // Documentation se place après « Mon site » — ou après « Bienvenue » quand
  // la section site a disparu (client sans page site prête) : un index fixe
  // se décalerait dès qu'une section est filtrée.
  const doc = buildDocSection(admin, docPages, at);
  if (doc) {
    const site = sections.findIndex((s) => s.key === "site");
    const anchor = site >= 0 ? site : sections.findIndex((s) => s.key === "bienvenue");
    sections.splice(anchor + 1, 0, doc);
  }

  return sections;
}

function buildDocSection(
  admin: boolean,
  docPages: DocPageLink[],
  at: (path: string) => string,
): SidebarSection | null {
  if (docPages.length > 0) {
    return {
      key: "doc",
      label: "Documentation",
      icon: "book",
      pages: docPages.map((p) => ({
        label: p.title,
        href: p.href,
        // Chaque page de doc ne s'allume que sur elle-même : toutes partagent
        // le préfixe /docs/<client>, un préfixe commun les allumerait toutes.
        activePrefix: p.href,
        wip: false,
      })),
    };
  }
  if (!admin) return null;
  return {
    key: "doc",
    label: "Documentation",
    icon: "book",
    pages: [{ label: "La doc", href: at("/doc"), activePrefix: "/espace/doc", wip: true }],
  };
}
