import { describe, expect, it } from "vitest";
import { listeItem, riche } from "./devis";

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
