import { describe, expect, it } from "vitest";
import { heuresRetenues } from "./heures";
import type { DevisBudget } from "../devis";

const packs = {
  choixUnique: true,
  enAttente: false,
  lignes: [
    { label: "Pack de 10 h", prix: 700, optionnel: true, defaut: false, conseille: false, heures: 10 },
    { label: "Pack de 20 h", prix: 1300, optionnel: true, defaut: true, conseille: false, heures: 20 },
    { label: "Pack de 40 h", prix: 2400, optionnel: true, defaut: false, conseille: true, heures: 40 },
  ],
} as unknown as DevisBudget;

describe("heuresRetenues", () => {
  it("rend les heures du pack que le client a validé", () => {
    expect(heuresRetenues(packs, "[1]")).toBe(20);
    expect(heuresRetenues(packs, "[2]")).toBe(40);
  });

  it("ne compte qu'un pack sur un choix unique, même si la réponse en porte deux", () => {
    expect(heuresRetenues(packs, "[0, 2]")).toBe(10);
  });

  it("additionne les heures du socle et des options retenues", () => {
    const compose = {
      enAttente: false,
      lignes: [
        { label: "Socle", prix: 500, optionnel: false, defaut: true, conseille: false, heures: 8 },
        { label: "Option", prix: 300, optionnel: true, defaut: false, conseille: false, heures: 5 },
      ],
    } as unknown as DevisBudget;
    expect(heuresRetenues(compose, "[1]")).toBe(13);
    expect(heuresRetenues(compose, null)).toBe(8);
  });

  it("rend null quand aucune ligne retenue ne porte d'heures", () => {
    const sansHeures = { enAttente: false, lignes: [{ label: "Site", prix: 900, optionnel: false, defaut: true }] } as unknown as DevisBudget;
    expect(heuresRetenues(sansHeures, null)).toBeNull();
  });

  it("ignore une sélection illisible et retombe sur les défauts", () => {
    expect(heuresRetenues(packs, "pas du json")).toBe(20);
  });
});
