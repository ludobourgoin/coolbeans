import { describe, expect, it } from "vitest";
import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";

describe("CATALOGUE_DEFAUT", () => {
  it("porte les valeurs du brief", () => {
    expect(CATALOGUE_DEFAUT.settings.tjm).toBe(600);
    expect(CATALOGUE_DEFAUT.catalog.design.complexe).toBe(2);
    expect(CATALOGUE_DEFAUT.catalog.design.portee).toEqual({ ux: 40, ui: 70 });
    expect(CATALOGUE_DEFAUT.catalog.setup.multilingue.jours).toBe(2);
    expect(CATALOGUE_DEFAUT.catalog.gestion.urgencePct).toBe(20);
    expect(Object.keys(CATALOGUE_DEFAUT.segments)).toEqual([
      "agence", "designer", "pme", "tpe", "association",
    ]);
    // plus aucun multiplicateur de prix par cible
    expect(JSON.stringify(CATALOGUE_DEFAUT.segments)).not.toContain("multiplier");
  });
});

describe("nouveauChiffrage", () => {
  it("part du segment tpe avec sa gestion de projet par défaut", () => {
    const c = nouveauChiffrage(CATALOGUE_DEFAUT);
    expect(c.id).toBeNull();
    expect(c.segment).toBe("tpe");
    expect(c.gestionProjet).toBe(CATALOGUE_DEFAUT.segments.tpe.gestionProjet);
    expect(c.mode).toBe("configurateur");
    expect(c.publishedVersions).toBe(0);
  });
});
