import { describe, expect, it } from "vitest";
import { listeItem } from "./devis";

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
