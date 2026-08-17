import { describe, expect, test } from "vitest";
import { decisionPublication } from "./publier";

describe("decisionPublication", () => {
  test("commentaire supprimé pendant le délai → annuler", () => {
    expect(decisionPublication(null)).toEqual({ type: "annuler" });
  });
  test(">> retiré à l'édition pendant le délai → annuler", () => {
    expect(decisionPublication({ body: "finalement non" })).toEqual({ type: "annuler" });
  });
  test("publie le contenu ACTUEL, marqueur retiré", () => {
    expect(decisionPublication({ body: ">> Version corrigée" })).toEqual({
      type: "publier",
      corps: "Version corrigée",
      imagesRetirees: 0,
    });
  });
  test("les images Linear sont retirées et comptées", () => {
    const d = decisionPublication({
      body: ">> Voilà ![c](https://uploads.linear.app/a/b.png) dis-moi",
    });
    expect(d).toMatchObject({ type: "publier", imagesRetirees: 1 });
    if (d.type === "publier") expect(d.corps).not.toContain("uploads.linear.app");
  });
});
