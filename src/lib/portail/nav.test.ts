import { describe, expect, it } from "vitest";
import { readPortalMetadata } from "./metadata";
import { buildPortalNav, isActive, isPortalHost, portalHref } from "./nav";

const client = readPortalMetadata({ role: "client", projects: ["amusoire"] });
const sansDoc = readPortalMetadata({ role: "client" });
const admin = readPortalMetadata({ role: "admin", projects: ["amusoire"] });

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
    expect(buildPortalNav("my.coolbeans.cc", client).map((i) => i.label)).toEqual([
      "Projets",
      "Mon site",
      "Doc",
      "Ressources",
      "Support",
    ]);
  });

  it("ajoute Chiffrages pour un admin, sans rien retirer", () => {
    expect(buildPortalNav("my.coolbeans.cc", admin).map((i) => i.label)).toEqual([
      "Projets",
      "Mon site",
      "Doc",
      "Ressources",
      "Support",
      "Chiffrages",
    ]);
  });

  it("pointe la doc sur le premier slug accessible", () => {
    const doc = buildPortalNav("my.coolbeans.cc", client).find((i) => i.label === "Doc");
    expect(doc?.href).toBe("/docs/amusoire");
  });

  // /docs n'existe pas comme route : sans slug, l'entrée doit mener à une page
  // qui explique, pas à un 404 ni disparaître de la nav.
  it("bascule la doc sur une page de l'espace quand aucun slug n'est posé", () => {
    const doc = buildPortalNav("my.coolbeans.cc", sansDoc).find((i) => i.label === "Doc");
    expect(doc?.href).toBe("/doc");
    expect(buildPortalNav("my.coolbeans.cc", sansDoc)).toHaveLength(5);
  });

  it("préfixe tous les liens hors doc en dehors de l'hôte portail", () => {
    expect(buildPortalNav("localhost", client).map((i) => i.href)).toEqual([
      "/espace/projets",
      "/espace/site",
      "/docs/amusoire",
      "/espace/ressources",
      "/espace/support",
    ]);
  });
});

describe("isActive", () => {
  const nav = buildPortalNav("my.coolbeans.cc", client);
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
