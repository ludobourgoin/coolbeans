import { describe, expect, it } from "vitest";
import { ancreSection, listeItem, riche } from "./devis";

describe("ancreSection", () => {
  it("sans version, garde l'ancre nue", () => {
    /* Devis à version unique : les liens déjà partagés restent valides. */
    expect(ancreSection("Ce que ça comprend")).toBe("ce-que-ca-comprend");
  });
  it("préfixe par la version quand il y en a plusieurs", () => {
    /* Toutes les versions d'un devis coexistent dans le même DOM, une seule
       visible. Sans préfixe, `id="budget"` est présent en double et le
       navigateur saute vers celui de la V1, masqué. */
    expect(ancreSection("Budget", 1)).toBe("v1-budget");
    expect(ancreSection("Budget", 2)).toBe("v2-budget");
  });
  it("rend des ancres distinctes d'une version à l'autre", () => {
    expect(ancreSection("Planning", 1)).not.toBe(ancreSection("Planning", 2));
  });
});

describe("listeItem", () => {
  it("normalise une chaîne", () => {
    expect(listeItem("Responsive")).toEqual({ texte: "Responsive" });
  });
  it("laisse passer l'objet avec tooltip", () => {
    expect(listeItem({ texte: "Urgence", tooltip: "+20 %" })).toEqual({
      texte: "Urgence",
      tooltip: "+20 %",
    });
  });
});

describe("riche", () => {
  it("rend un lien markdown cliquable", () => {
    expect(riche("Bijoux [dupontdupontstore.fr](https://dupontdupontstore.fr/)")).toContain(
      '<a class="link" href="https://dupontdupontstore.fr/" target="_blank" rel="noopener">dupontdupontstore.fr</a>',
    );
  });
  it("ignore un schéma autre que http(s)", () => {
    /* le YAML est écrit à la main, mais la page est publique : pas de
       javascript: qui passerait pour un lien de référence. */
    expect(riche("[clic](javascript:alert(1))")).not.toContain("<a");
  });
  it("laisse le gras et les insécables intacts", () => {
    /* \u00a0 écrit en échappement : une insécable littérale dans un fichier de
       test est invisible à la relecture et se perd au premier copier-coller. */
    expect(riche("**15 €** par an")).toBe('<b class="font-bold">15\u00a0€</b> par an');
  });
});
