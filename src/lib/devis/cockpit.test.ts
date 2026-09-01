import { describe, expect, it } from "vitest";
import { comparerTri, nomClient } from "./cockpit";

describe("comparerTri", () => {
  it("compare les nombres en nombres, pas en chaînes", () => {
    /* « 480 » vs « 3520 » : comparés en texte, 3520 passerait avant 480. */
    expect(comparerTri("480", "3520", "asc")).toBeLessThan(0);
    expect(comparerTri("480", "3520", "desc")).toBeGreaterThan(0);
  });

  it("ordonne la colonne Statut par position de pipeline, jamais par nom", () => {
    /* Triage lead (0) précède Devis envoyé (1000), qui précède Signée (5500).
       Un tri alphabétique sur les noms mettrait « 🏆 Signée » avant
       « 📥 Triage lead » et ne dirait rien de l'avancement. */
    const positions = ["5500", "0", "1000"];
    const trie = [...positions].sort((a, b) => comparerTri(a, b, "asc"));
    expect(trie).toEqual(["0", "1000", "5500"]);
  });

  it("compare le texte selon les règles françaises", () => {
    expect(comparerTri("é", "f", "asc")).toBeLessThan(0);
    expect(comparerTri("Amusoire", "Miharu", "asc")).toBeLessThan(0);
  });

  it("une cellule vide reste en bas dans les deux sens", () => {
    /* Statut inconnu ou devis jamais envoyé : le remonter en tête d'un tri
       ascendant reléguerait le contenu utile hors de l'écran. */
    expect(comparerTri("", "1000", "asc")).toBeGreaterThan(0);
    expect(comparerTri("", "1000", "desc")).toBeGreaterThan(0);
    expect(comparerTri("1000", "", "asc")).toBeLessThan(0);
    expect(comparerTri("1000", "", "desc")).toBeLessThan(0);
    expect(comparerTri("", "", "asc")).toBe(0);
  });

  it("tri complet : les inconnus en queue, l'ordre du pipeline devant", () => {
    const cellules = ["1000", "", "0", "", "5500"];
    expect([...cellules].sort((a, b) => comparerTri(a, b, "asc"))).toEqual([
      "0",
      "1000",
      "5500",
      "",
      "",
    ]);
    expect([...cellules].sort((a, b) => comparerTri(a, b, "desc"))).toEqual([
      "5500",
      "1000",
      "0",
      "",
      "",
    ]);
  });
});

describe("nomClient", () => {
  const registre = new Map([["revolutions-douces", "Rév'olutions Douces"]]);

  it("préfère le nom du registre des workspaces", () => {
    expect(nomClient("revolutions-douces/salon-2026-5336", registre)).toBe("Rév'olutions Douces");
  });

  it("remet en forme le segment du slug pour un client hors registre", () => {
    /* La plupart des clients de devis ne sont pas des workspaces du portail :
       un prospect n'en a pas encore. */
    expect(nomClient("littlebox/site-vitrine-4712", registre)).toBe("Littlebox");
    expect(nomClient("unlockbreath/plateforme-3271", registre)).toBe("Unlockbreath");
  });

  it("gère les devis d'avant la convention client/projet, restés à la racine", () => {
    expect(nomClient("en-haut", registre)).toBe("En Haut");
  });
});
