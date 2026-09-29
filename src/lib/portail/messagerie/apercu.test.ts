import { describe, expect, it } from "vitest";
import { dateCourte, extrait } from "./apercu";

describe("extrait", () => {
  it("ramène le markdown à une ligne de texte", () => {
    expect(
      extrait("Bonjour,\n\n**Le formulaire** ne part plus : voir [la page](https://x.fr).\n![capture](https://x.fr/a.png)"),
    ).toBe("Bonjour, Le formulaire ne part plus : voir la page.");
  });

  it("retire titres, citations, listes et filets", () => {
    expect(extrait("## Titre\n> cité\n- un\n- deux\n---\nfin")).toBe("Titre cité un deux fin");
  });

  it("coupe sur un mot et ajoute des points de suspension", () => {
    const e = extrait("mot ".repeat(60), 30);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(31);
    expect(e).not.toMatch(/ …$/);
  });

  it("rend une chaîne vide sans corps", () => {
    expect(extrait(null)).toBe("");
    expect(extrait("")).toBe("");
  });
});

describe("dateCourte", () => {
  const maintenant = new Date("2026-09-29T15:00:00Z");

  it("donne l'heure de Paris pour aujourd'hui", () => {
    expect(dateCourte("2026-09-29T08:05:00Z", maintenant)).toBe("10:05");
  });

  it("donne le jour et le mois pour cette année", () => {
    expect(dateCourte("2026-09-12T10:00:00Z", maintenant)).toBe("12 sept.");
  });

  it("donne la date complète pour une autre année", () => {
    expect(dateCourte("2025-05-27T10:00:00Z", maintenant)).toBe("27/05/25");
  });

  it("bascule de jour à minuit à Paris, pas en UTC", () => {
    // 22 h 30 UTC le 28, c'est déjà le 29 à Paris : aujourd'hui, donc l'heure.
    expect(dateCourte("2026-09-28T22:30:00Z", maintenant)).toBe("00:30");
  });

  it("rend une chaîne vide sur une date illisible", () => {
    expect(dateCourte("pas une date", maintenant)).toBe("");
  });
});
