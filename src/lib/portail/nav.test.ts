import { describe, expect, it } from "vitest";
import type { PortalClient } from "./clients";
import { readPortalMetadata } from "./metadata";
import { buildPortalNav, isActive, isPortalHost, portalHref } from "./nav";

const avecDoc: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const sansDoc: PortalClient = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [], archive: false };

const client = readPortalMetadata({ role: "client", client: "amusoire" });
const admin = readPortalMetadata({ role: "admin", client: "coolbeans" });

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

describe("buildPortalNav", () => {
  it("expose les cinq entrées du wireframe, dans l'ordre", () => {
    expect(buildPortalNav("my.coolbeans.cc", client, avecDoc).map((i) => i.label)).toEqual([
      "Projets",
      "Mon site",
      "Doc",
      "Ressources",
      "Support",
    ]);
  });

  it("ajoute Chiffrages pour un admin, sans rien retirer", () => {
    expect(buildPortalNav("my.coolbeans.cc", admin, avecDoc).map((i) => i.label)).toEqual([
      "Projets",
      "Mon site",
      "Doc",
      "Ressources",
      "Support",
      "Chiffrages",
    ]);
  });

  it("pointe la doc sur le premier slug accessible", () => {
    const doc = buildPortalNav("my.coolbeans.cc", client, avecDoc).find((i) => i.label === "Doc");
    expect(doc?.href).toBe("/docs/amusoire");
  });

  // /docs n'existe pas comme route : sans slug, l'entrée doit mener à une page
  // qui explique, pas à un 404 ni disparaître de la nav.
  it("bascule la doc sur une page de l'espace quand aucun slug n'est posé", () => {
    const doc = buildPortalNav("my.coolbeans.cc", client, sansDoc).find((i) => i.label === "Doc");
    expect(doc?.href).toBe("/doc");
    expect(buildPortalNav("my.coolbeans.cc", client, sansDoc)).toHaveLength(5);
  });

  it("préfixe tous les liens hors doc en dehors de l'hôte portail", () => {
    expect(buildPortalNav("localhost", client, avecDoc).map((i) => i.href)).toEqual([
      "/espace/projets",
      "/espace/site",
      "/docs/amusoire",
      "/espace/ressources",
      "/espace/support",
    ]);
  });
});

describe("isActive", () => {
  const nav = buildPortalNav("my.coolbeans.cc", client, avecDoc);
  const item = (label: string) => nav.find((i) => i.label === label)!;

  it("s'allume sur la page et ses sous-pages", () => {
    expect(isActive(item("Projets"), "/espace/projets")).toBe(true);
    expect(isActive(item("Projets"), "/espace/projets/1217")).toBe(true);
    expect(isActive(item("Doc"), "/docs/amusoire/01-vue-densemble")).toBe(true);
  });

  it("ne s'allume pas sur une autre entrée", () => {
    expect(isActive(item("Projets"), "/espace/support")).toBe(false);
    expect(isActive(item("Mon site"), "/espace/projets")).toBe(false);
  });

  // Le piège du préfixe nu : /espace/site ne doit pas allumer une entrée /espace/s.
  it("ne s'allume pas sur un préfixe partiel de segment", () => {
    expect(isActive({ label: "x", href: "/s", activePrefix: "/espace/s" }, "/espace/site")).toBe(
      false,
    );
  });

  it("n'allume la racine que sur elle-même", () => {
    const racine = { label: "Espace", href: "/", activePrefix: "/espace" };
    expect(isActive(racine, "/espace")).toBe(true);
    expect(isActive(racine, "/espace/")).toBe(true);
    expect(isActive(racine, "/espace/projets")).toBe(false);
  });
});

describe("buildPortalNav · l'entrée Doc suit le client courant", () => {
  // Le défaut relevé le 2026-08-12 : la nav dérivait de publicMetadata.projects
  // alors que l'accès à la doc se décide sur le client. Un admin basculé sur
  // Amusoire doit voir la doc d'Amusoire, quel que soit son propre client.
  it("pointe la doc du client courant, pas celle de l'utilisateur", () => {
    const doc = buildPortalNav("my.coolbeans.cc", admin, avecDoc).find((i) => i.label === "Doc");
    expect(doc?.href).toBe("/docs/amusoire");
  });

  it("bascule sur la page d'explication quand le client courant n'a pas de doc", () => {
    const nav = buildPortalNav("my.coolbeans.cc", admin, sansDoc);
    expect(nav.find((i) => i.label === "Doc")?.href).toBe("/doc");
  });

  it("bascule aussi quand il n'y a aucun client courant", () => {
    const nav = buildPortalNav("my.coolbeans.cc", client, null);
    expect(nav.find((i) => i.label === "Doc")?.href).toBe("/doc");
  });
});
