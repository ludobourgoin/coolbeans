import { describe, expect, it } from "vitest";
import { comparerTri, grouperVersions, nomClient } from "./cockpit";

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

describe("grouperVersions", () => {
  const e = (id: string, version = 1, versionDe?: string) => ({ id, data: { version, versionDe } });

  it("une seule ligne pour un devis à plusieurs versions", () => {
    const groupes = grouperVersions([
      e("unlockbreath/plateforme-3271"),
      e("unlockbreath/plateforme-v2-5840", 2, "unlockbreath/plateforme-3271"),
    ]);
    expect(groupes).toHaveLength(1);
    /* L'URL et les réponses D1 restent accrochées à la V1 : c'est elle que le
       formulaire public renvoie, et la seule qui ait une page. */
    expect(groupes[0].baseId).toBe("unlockbreath/plateforme-3271");
    /* Le représentant est la version la plus haute — celle que le client voit
       par défaut en ouvrant le lien. */
    expect(groupes[0].representant.id).toBe("unlockbreath/plateforme-v2-5840");
  });

  it("les devis sans version restent chacun leur propre groupe", () => {
    const groupes = grouperVersions([e("cafa/site-web-8791"), e("en-haut")]);
    expect(groupes.map((g) => g.baseId).sort()).toEqual(["cafa/site-web-8791", "en-haut"]);
  });

  it("ordre des entrées indifférent : la V2 peut arriver avant la V1", () => {
    const groupes = grouperVersions([
      e("x/v2", 2, "x/v1"),
      e("x/v1"),
      e("x/v3", 3, "x/v1"),
    ]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].representant.id).toBe("x/v3");
  });

  it("versionDe qui ne pointe sur rien : l'entrée fait groupe seule", () => {
    /* V1 supprimée ou coquille de saisie : le devis doit rester visible dans
       le cockpit plutôt que de disparaître dans un groupe fantôme. */
    const groupes = grouperVersions([e("orphelin", 2, "disparu")]);
    expect(groupes).toEqual([{ baseId: "orphelin", representant: e("orphelin", 2, "disparu") }]);
  });
});
