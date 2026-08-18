import { describe, expect, it } from "vitest";
import type { PortalWorkspace } from "./workspaces";
import { readPortalMetadata } from "./metadata";
import { buildSidebar, isActive, isPortalHost, portalHref, type DocPageLink } from "./nav";

const avecDoc: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const sansDoc: PortalWorkspace = {
  slug: "coolbeans",
  nom: "Coolbeans",
  uptimerobot_monitor_ids: [],
  archive: false,
};

const client = readPortalMetadata({ role: "client", client: "amusoire" });
const admin = readPortalMetadata({ role: "admin", client: "coolbeans" });

const docPages: DocPageLink[] = [
  { title: "Vue d'ensemble", href: "/docs/amusoire/vue-densemble" },
  { title: "Édition", href: "/docs/amusoire/edition" },
];

const flat = (sections: ReturnType<typeof buildSidebar>) =>
  sections.flatMap((s) => s.pages.map((p) => ({ section: s.key, ...p })));

describe("isPortalHost", () => {
  it("reconnaît les deux hôtes portail", () => {
    expect(isPortalHost("my.coolbeans.cc")).toBe(true);
    expect(isPortalHost("my-staging.coolbeans.cc")).toBe(true);
  });

  it("écarte les hôtes du site principal et le dev local", () => {
    for (const h of ["coolbeans.cc", "www.coolbeans.cc", "staging.coolbeans.cc", "localhost"]) {
      expect(isPortalHost(h)).toBe(false);
    }
  });
});

describe("portalHref", () => {
  it("retire le préfixe /espace sur l'hôte portail", () => {
    expect(portalHref("/projets", "my.coolbeans.cc")).toBe("/projets");
    expect(portalHref("/projets", "my-staging.coolbeans.cc")).toBe("/projets");
  });

  // Sans ça, le portail est incliquable en `astro dev` : /projets y est
  // la page vitrine des réalisations, pas le module du portail.
  it("garde le préfixe partout ailleurs", () => {
    expect(portalHref("/projets", "localhost")).toBe("/espace/projets");
    expect(portalHref("/projets", "staging.coolbeans.cc")).toBe("/espace/projets");
  });

  it("rend une racine correcte dans les deux cas", () => {
    expect(portalHref("/", "my.coolbeans.cc")).toBe("/");
    expect(portalHref("", "my.coolbeans.cc")).toBe("/");
    expect(portalHref("/", "localhost")).toBe("/espace");
  });
});

describe("buildSidebar · visibilité côté client", () => {
  // La règle à deux étages (spec sidebar 2026-08-14, COO-80) : un client ne
  // voit que les pages `live` ET configurées pour lui. Aujourd'hui seules
  // Introduction, la doc et Ressources sont lancées.
  it("ne montre que les pages live et configurées", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, avecDoc, docPages));
    expect(pages.map((p) => p.label)).toEqual([
      "Introduction",
      "Vue d'ensemble",
      "Édition",
      "Ressources",
    ]);
  });

  it("ne marque jamais une page wip côté client", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, avecDoc, docPages));
    expect(pages.every((p) => !p.wip)).toBe(true);
  });

  it("masque le bloc Admin", () => {
    const sections = buildSidebar("my.coolbeans.cc", client, avecDoc, docPages);
    expect(sections.find((s) => s.key === "admin")).toBeUndefined();
  });

  it("masque la section Documentation d'un client sans doc", () => {
    const sections = buildSidebar("my.coolbeans.cc", client, sansDoc, []);
    expect(sections.find((s) => s.key === "doc")).toBeUndefined();
  });

  it("fait disparaître une section dont aucune page n'est prête", () => {
    const sections = buildSidebar("my.coolbeans.cc", client, avecDoc, docPages);
    // Mon site et Projets : tout est wip aujourd'hui.
    expect(sections.map((s) => s.key)).toEqual(["bienvenue", "doc", "aide"]);
  });
});

describe("buildSidebar · côté admin", () => {
  const sections = buildSidebar("my.coolbeans.cc", admin, avecDoc, docPages);
  const pages = flat(sections);

  it("montre toutes les sections, bloc Admin en dernier", () => {
    expect(sections.map((s) => s.key)).toEqual([
      "bienvenue",
      "site",
      "doc",
      "projets",
      "aide",
      "admin",
    ]);
  });

  it("badge wip les pages non lancées, pas les autres", () => {
    const wip = pages.filter((p) => p.wip).map((p) => p.label);
    expect(wip).toContain("Monitoring");
    expect(wip).toContain("Liens utiles");
    expect(wip).not.toContain("Introduction");
    expect(wip).not.toContain("Ressources");
    expect(wip).not.toContain("Devis");
  });

  it("badge wip une page dont le mapping client manque", () => {
    // Monitoring est wip pour deux raisons chez Amusoire : flag global ET
    // aucun monitor configuré. Le badge reste un seul et même signal.
    const monitoring = pages.find((p) => p.label === "Monitoring");
    expect(monitoring?.wip).toBe(true);
    expect(monitoring?.dot).toBe(true);
  });

  it("pointe la doc absente vers la page d'explication, en wip", () => {
    const sections = buildSidebar("my.coolbeans.cc", admin, sansDoc, []);
    const doc = sections.find((s) => s.key === "doc");
    expect(doc?.pages).toHaveLength(1);
    expect(doc?.pages[0].href).toBe("/doc");
    expect(doc?.pages[0].wip).toBe(true);
  });
});

describe("buildSidebar · liens et préfixe d'hôte", () => {
  it("préfixe tous les liens hors doc en dehors de l'hôte portail", () => {
    const pages = flat(buildSidebar("localhost", client, avecDoc, docPages));
    expect(pages.map((p) => p.href)).toEqual([
      "/espace",
      "/docs/amusoire/vue-densemble",
      "/docs/amusoire/edition",
      "/espace/ressources",
    ]);
  });

  it("rend des liens courts sur l'hôte portail", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, avecDoc, docPages));
    expect(pages.find((p) => p.label === "Introduction")?.href).toBe("/");
    expect(pages.find((p) => p.label === "Ressources")?.href).toBe("/ressources");
  });
});

describe("buildSidebar · Messagerie remplace Support", () => {
  // COO-XX (spec 2026-08-15-messagerie-portail-design.md §2) : l'entrée
  // s'appelle « Messagerie », pas « Support », et remonte haut dans la nav —
  // juste sous l'accueil, avant la section Projets.
  it("la messagerie remplace le support et vit haut dans la nav", () => {
    const sections = buildSidebar("my.coolbeans.cc", admin, avecDoc, docPages);
    const labels = sections.flatMap((s) => s.pages.map((p) => p.label));
    expect(labels).toContain("Messagerie");
    expect(labels).not.toContain("Support");
    // Position : Messagerie apparaît avant les pages de la section Projets
    // (« Actifs » en est la première).
    expect(labels.indexOf("Messagerie")).toBeLessThan(labels.indexOf("Actifs"));
  });
});

describe("isActive", () => {
  const pages = flat(buildSidebar("my.coolbeans.cc", admin, avecDoc, docPages));
  const page = (label: string) => pages.find((p) => p.label === label)!;

  it("s'allume sur la page et ses sous-pages", () => {
    expect(isActive(page("Actifs"), "/espace/projets")).toBe(true);
    expect(isActive(page("Actifs"), "/espace/projets/1217")).toBe(true);
  });

  it("ne s'allume pas sur une autre entrée", () => {
    expect(isActive(page("Actifs"), "/espace/support")).toBe(false);
    expect(isActive(page("Monitoring"), "/espace/projets")).toBe(false);
  });

  // Le piège du préfixe nu : /espace/site ne doit pas allumer une entrée /espace/s.
  it("ne s'allume pas sur un préfixe partiel de segment", () => {
    expect(isActive({ label: "x", href: "/s", activePrefix: "/espace/s" }, "/espace/site")).toBe(
      false,
    );
  });

  it("n'allume Introduction que sur la racine", () => {
    const intro = page("Introduction");
    expect(isActive(intro, "/espace")).toBe(true);
    expect(isActive(intro, "/espace/")).toBe(true);
    expect(isActive(intro, "/espace/projets")).toBe(false);
  });

  // Chaque page de doc ne s'allume que sur elle-même : toutes partagent le
  // préfixe /docs/<client>, un préfixe commun les allumerait toutes.
  it("n'allume qu'une seule page de doc à la fois", () => {
    expect(isActive(page("Édition"), "/docs/amusoire/edition")).toBe(true);
    expect(isActive(page("Vue d'ensemble"), "/docs/amusoire/edition")).toBe(false);
  });
});
