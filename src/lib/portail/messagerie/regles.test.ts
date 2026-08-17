import { describe, expect, test } from "vitest";
import {
  corpsPublie,
  prioriteFromUrgence,
  retireImagesLinear,
  statutFromStateType,
} from "./regles";

describe("statutFromStateType", () => {
  test.each([
    ["triage", "en_attente"],
    ["backlog", "en_attente"],
    ["unstarted", "en_attente"],
    ["started", "en_cours"],
    ["completed", "traite"],
    ["canceled", "traite"],
  ])("%s → %s", (type, statut) => {
    expect(statutFromStateType(type)).toBe(statut);
  });
  test("type inconnu ou absent → inconnu (issue supprimée non réparée)", () => {
    expect(statutFromStateType(undefined)).toBe("inconnu");
    expect(statutFromStateType("n_importe_quoi")).toBe("inconnu");
  });
});

describe("prioriteFromUrgence", () => {
  test.each([
    ["bloquant", 1],
    ["urgent", 2],
    ["normal", 3],
    ["pas-presse", 4],
  ])("%s → %i", (urgence, prio) => {
    expect(prioriteFromUrgence(urgence)).toBe(prio);
  });
  test("sans choix → Medium (spec §5)", () => {
    expect(prioriteFromUrgence(null)).toBe(3);
    expect(prioriteFromUrgence("")).toBe(3);
  });
});

describe("corpsPublie", () => {
  test("retire le marqueur et l'espace qui suit", () => {
    expect(corpsPublie(">> C'est en ligne !")).toBe("C'est en ligne !");
    expect(corpsPublie(">>Sans espace")).toBe("Sans espace");
  });
  test("commentaire interne → null", () => {
    expect(corpsPublie("Note interne")).toBeNull();
    expect(corpsPublie(" >> marqueur pas en tête")).toBeNull();
  });
  test("marqueur seul (>> retiré à l'édition pendant le délai) → null", () => {
    expect(corpsPublie(">>")).toBeNull();
    expect(corpsPublie(">>   ")).toBeNull();
  });
});

describe("retireImagesLinear", () => {
  test("retire les images du CDN privé Linear et les compte", () => {
    const md = "Voilà :\n\n![capture](https://uploads.linear.app/abc/def.png)\n\nDis-moi.";
    const { texte, imagesRetirees } = retireImagesLinear(md);
    expect(imagesRetirees).toBe(1);
    expect(texte).not.toContain("uploads.linear.app");
    expect(texte).toContain("Dis-moi.");
  });
  test("texte sans image inchangé", () => {
    const { texte, imagesRetirees } = retireImagesLinear("Rien à voir ici.");
    expect(imagesRetirees).toBe(0);
    expect(texte).toBe("Rien à voir ici.");
  });
});
