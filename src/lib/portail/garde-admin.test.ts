import { describe, expect, it } from "vitest";
import { estRouteAdmin, estRouteProtegee } from "./garde-admin";

describe("estRouteAdmin", () => {
  it("reconnait le prefixe nu et sa forme avec slash", () => {
    expect(estRouteAdmin("/espace/admin")).toBe(true);
    expect(estRouteAdmin("/espace/admin/")).toBe(true);
  });

  it("reconnait une page sous le prefixe", () => {
    expect(estRouteAdmin("/espace/admin/finances/tresorerie")).toBe(true);
  });

  it("reconnait le prefixe d'API", () => {
    expect(estRouteAdmin("/api/admin/export")).toBe(true);
  });

  // Le piege du prefixe non ancre : sans le groupe (\/|$), "administration"
  // serait capte et une page publique deviendrait invisible aux clients.
  it("ne capte pas un chemin qui commence seulement par les memes lettres", () => {
    expect(estRouteAdmin("/espace/administration")).toBe(false);
    expect(estRouteAdmin("/api/administrateurs")).toBe(false);
  });

  it("ne capte pas les routes ordinaires du portail", () => {
    expect(estRouteAdmin("/espace")).toBe(false);
    expect(estRouteAdmin("/espace/projets")).toBe(false);
    expect(estRouteAdmin("/espace/utilisateurs")).toBe(false);
  });

  // La garde se ferme du bon cote : une casse inattendue est gardee plutot
  // qu'ignoree. Astro resout ses routes en respectant la casse, donc cette
  // URL 404 de toute facon — mais la garde ne doit pas etre ce qui en depend.
  it("garde aussi une variante de casse", () => {
    expect(estRouteAdmin("/espace/ADMIN/finances")).toBe(true);
  });
});

describe("estRouteProtegee", () => {
  it("couvre l'espace, la doc et les prefixes admin", () => {
    expect(estRouteProtegee("/espace")).toBe(true);
    expect(estRouteProtegee("/espace/projets")).toBe(true);
    expect(estRouteProtegee("/docs")).toBe(true);
    expect(estRouteProtegee("/docs/amusoire")).toBe(true);
    expect(estRouteProtegee("/api/admin/export")).toBe(true);
  });

  it("laisse passer le site public et les autres API", () => {
    expect(estRouteProtegee("/")).toBe(false);
    expect(estRouteProtegee("/devis/amusoire/site")).toBe(false);
    expect(estRouteProtegee("/api/linear-webhook")).toBe(false);
    expect(estRouteProtegee("/404")).toBe(false);
  });
});
