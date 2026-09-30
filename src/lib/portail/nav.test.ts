import { describe, expect, it } from "vitest";
import type { PortalWorkspace } from "./workspaces";
import { readPortalMetadata } from "./metadata";
import {
  buildSidebar,
  isActive,
  isPortalHost,
  portalHref,
  type DocPageLink,
  type EntreeProjetBarre,
} from "./nav";

const amusoire: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const sansDoc: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const coolbeans: PortalWorkspace = {
  slug: "coolbeans",
  nom: "Coolbeans",
  uptimerobot_monitor_ids: [],
  archive: false,
};

const client = readPortalMetadata({ portalRole: "client", workspace: "amusoire" });
const admin = readPortalMetadata({ portalRole: "admin", workspace: "coolbeans" });

const docPages: DocPageLink[] = [
  { title: "Vue d'ensemble", href: "/docs/amusoire/vue-densemble" },
  { title: "Édition", href: "/docs/amusoire/edition" },
];

const projets: EntreeProjetBarre[] = [
  {
    titre: "Refonte Webflow et intégration technique",
    chemin: "/projets/refonte-webflow-et-integration-technique-9a553e01b917",
  },
  { titre: "Site anglais et Music Quiz", chemin: "/projets/site-anglais-et-music-quiz-8ca6ad11bb6f" },
];

const flat = (sections: ReturnType<typeof buildSidebar>) =>
  sections.flatMap((s) => s.pages.map((p) => ({ section: s.key, ...p })));
const cles = (sections: ReturnType<typeof buildSidebar>) => sections.map((s) => s.key);

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

describe("buildSidebar · workspace client", () => {
  const sections = buildSidebar("my.coolbeans.cc", client, amusoire, docPages, projets);

  it("range Bienvenue, Projets, Mode d'emploi, Aide", () => {
    // Mon site n'a aucune page prête côté client : la section disparaît.
    expect(cles(sections)).toEqual(["bienvenue", "projets", "doc", "aide"]);
  });

  it("ne montre que les pages live et configurées", () => {
    expect(flat(sections).map((p) => p.label)).toEqual([
      "Introduction",
      "Refonte Webflow et intégration technique",
      "Site anglais et Music Quiz",
      "Vue d'ensemble",
      "Édition",
      "Ressources",
      "Disponibilités",
    ]);
  });

  it("ne marque jamais une page wip côté client", () => {
    expect(flat(sections).every((p) => !p.wip)).toBe(true);
  });

  it("masque le bloc Admin", () => {
    expect(sections.find((s) => s.key === "admin")).toBeUndefined();
  });

  it("masque le mode d'emploi d'un workspace sans doc", () => {
    expect(buildSidebar("my.coolbeans.cc", client, sansDoc, []).find((s) => s.key === "doc")).toBeUndefined();
  });

  it("n'a pas de section Projets sans projet", () => {
    expect(cles(buildSidebar("my.coolbeans.cc", client, amusoire, docPages))).toEqual(["bienvenue", "doc", "aide"]);
  });
});

describe("buildSidebar · admin dans un workspace client", () => {
  const sections = buildSidebar("my.coolbeans.cc", admin, amusoire, docPages, projets);
  const pages = flat(sections);

  it("n'affiche pas Admin hors du workspace Coolbeans", () => {
    expect(cles(sections)).toEqual(["bienvenue", "projets", "site", "doc", "aide"]);
  });

  it("badge wip les pages non lancées, pas les autres", () => {
    const wip = pages.filter((p) => p.wip).map((p) => p.label);
    expect(wip).toContain("Monitoring");
    expect(wip).toContain("Liens utiles");
    expect(wip).not.toContain("Introduction");
    expect(wip).not.toContain("Ressources");
  });

  it("badge wip une page dont le mapping client manque", () => {
    const monitoring = pages.find((p) => p.label === "Monitoring");
    expect(monitoring?.wip).toBe(true);
    expect(monitoring?.dot).toBe(true);
  });

  it("ouvre la section Aide par les demandes", () => {
    const aide = sections.find((s) => s.key === "aide")!.pages;
    expect(aide[0]).toMatchObject({ label: "Demandes", href: "/demandes" });
    expect(sections.find((s) => s.key === "bienvenue")!.pages.map((p) => p.label)).not.toContain("Demandes");
  });
});

describe("buildSidebar · workspace Coolbeans", () => {
  const sections = buildSidebar("my.coolbeans.cc", admin, coolbeans, [], projets);

  it("range Bienvenue, Projets, Mon site, Mode d'emploi, Admin, sans Aide", () => {
    expect(cles(sections)).toEqual(["bienvenue", "projets", "site", "doc", "admin"]);
  });

  it("porte les outils admin", () => {
    expect(sections.find((s) => s.key === "admin")!.pages.map((p) => p.label)).toEqual([
      "Accueil admin",
      "Mes clients",
      "Utilisateurs",
      "Devis",
    ]);
  });

  it("pointe le mode d'emploi absent vers la page d'explication, en wip", () => {
    const doc = sections.find((s) => s.key === "doc")!;
    expect(doc.label).toBe("Mode d'emploi");
    expect(doc.pages).toEqual([{ label: "Mode d'emploi", href: "/doc", activePrefix: "/espace/doc", wip: true }]);
  });

  it("un compte non admin n'y voit ni Admin ni Aide", () => {
    const lecteur = readPortalMetadata({ portalRole: "client", workspace: "coolbeans" });
    expect(cles(buildSidebar("my.coolbeans.cc", lecteur, coolbeans, [], projets))).toEqual(["bienvenue", "projets"]);
  });
});

describe("buildSidebar · Projets", () => {
  it("une entrée par projet, libellée du nom Linear", () => {
    const section = buildSidebar("my.coolbeans.cc", client, amusoire, docPages, projets).find(
      (s) => s.key === "projets",
    )!;
    expect(section).toMatchObject({ label: "Projets", icon: "folder" });
    expect(section.pages[0]).toEqual({
      label: "Refonte Webflow et intégration technique",
      href: "/projets/refonte-webflow-et-integration-technique-9a553e01b917",
      activePrefix: "/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917",
      wip: false,
    });
  });

  it("hors du portail, l'entrée garde le préfixe /espace", () => {
    const section = buildSidebar("localhost", client, amusoire, docPages, projets).find((s) => s.key === "projets")!;
    expect(section.pages[0].href).toBe("/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917");
  });

  it("sans projet, la barre ne change pas", () => {
    expect(buildSidebar("my.coolbeans.cc", client, amusoire, docPages)).toEqual(
      buildSidebar("my.coolbeans.cc", client, amusoire, docPages, []),
    );
  });
});

describe("buildSidebar · Mode d'emploi", () => {
  it("nomme Mode d'emploi la section des pages de doc", () => {
    const doc = buildSidebar("my.coolbeans.cc", client, amusoire, docPages).find((s) => s.key === "doc")!;
    expect(doc.label).toBe("Mode d'emploi");
    expect(doc.pages.map((p) => p.label)).toEqual(["Vue d'ensemble", "Édition"]);
  });
});

describe("buildSidebar · Analytics", () => {
  const mesure: PortalWorkspace = {
    ...amusoire,
    analytics: [{ host: "amusoire.fr", siteTag: "0123456789abcdef0123456789abcdef" }],
  };

  it("montre Analytics au client dont le site est raccordé", () => {
    const analytics = flat(buildSidebar("my.coolbeans.cc", client, mesure, docPages)).find(
      (p) => p.label === "Analytics",
    );
    expect(analytics?.section).toBe("site");
    expect(analytics?.wip).toBe(false);
  });

  it("la cache au client sans site raccordé", () => {
    expect(flat(buildSidebar("my.coolbeans.cc", client, amusoire, docPages)).find((p) => p.label === "Analytics")).toBeUndefined();
  });

  it("la montre en wip à l'admin quand le site manque", () => {
    expect(flat(buildSidebar("my.coolbeans.cc", admin, amusoire, docPages)).find((p) => p.label === "Analytics")?.wip).toBe(true);
  });
});

describe("buildSidebar · liens et préfixe d'hôte", () => {
  it("préfixe tous les liens hors doc en dehors de l'hôte portail", () => {
    const pages = flat(buildSidebar("localhost", client, amusoire, docPages, projets));
    expect(pages.map((p) => p.href)).toEqual([
      "/espace",
      "/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917",
      "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f",
      "/docs/amusoire/vue-densemble",
      "/docs/amusoire/edition",
      "/espace/ressources",
      "/espace/disponibilites",
    ]);
  });

  it("rend des liens courts sur l'hôte portail", () => {
    const pages = flat(buildSidebar("my.coolbeans.cc", client, amusoire, docPages));
    expect(pages.find((p) => p.label === "Introduction")?.href).toBe("/");
    expect(pages.find((p) => p.label === "Ressources")?.href).toBe("/ressources");
  });
});

describe("isActive", () => {
  const pages = flat(buildSidebar("my.coolbeans.cc", admin, amusoire, docPages, projets));
  const page = (label: string) => pages.find((p) => p.label === label)!;

  it("s'allume sur la page d'un projet", () => {
    expect(isActive(page("Site anglais et Music Quiz"), "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f")).toBe(true);
  });

  it("ne s'allume pas sur une autre entrée", () => {
    expect(
      isActive(page("Site anglais et Music Quiz"), "/espace/projets/refonte-webflow-et-integration-technique-9a553e01b917"),
    ).toBe(false);
    expect(isActive(page("Monitoring"), "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f")).toBe(false);
  });

  // Le piège du préfixe nu : /espace/site ne doit pas allumer une entrée /espace/s.
  it("ne s'allume pas sur un préfixe partiel de segment", () => {
    expect(isActive({ label: "x", href: "/s", activePrefix: "/espace/s" }, "/espace/site")).toBe(false);
  });

  it("n'allume Introduction que sur la racine", () => {
    const intro = page("Introduction");
    expect(isActive(intro, "/espace")).toBe(true);
    expect(isActive(intro, "/espace/")).toBe(true);
    expect(isActive(intro, "/espace/projets/site-anglais-et-music-quiz-8ca6ad11bb6f")).toBe(false);
  });

  // Chaque page de doc ne s'allume que sur elle-même : toutes partagent le
  // préfixe /docs/<client>, un préfixe commun les allumerait toutes.
  it("n'allume qu'une seule page de doc à la fois", () => {
    expect(isActive(page("Édition"), "/docs/amusoire/edition")).toBe(true);
    expect(isActive(page("Vue d'ensemble"), "/docs/amusoire/edition")).toBe(false);
  });
});
