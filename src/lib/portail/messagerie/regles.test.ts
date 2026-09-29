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
  test("retire l'enveloppe et ce qui la sépare du message", () => {
    expect(corpsPublie("✉️ C'est en ligne !")).toBe("C'est en ligne !");
    expect(corpsPublie("✉️Sans espace")).toBe("Sans espace");
    // Le format de Ludo : l'enveloppe seule sur sa ligne, puis le message.
    expect(corpsPublie("✉️\n\nHello Nath,\n\nC'est rectifié.")).toBe("Hello Nath,\n\nC'est rectifié.");
  });
  test("accepte l'enveloppe sans sélecteur de variante, et le code :envelope:", () => {
    expect(corpsPublie("\u2709 Sans variante")).toBe("Sans variante");
    expect(corpsPublie(":envelope: Code non converti")).toBe("Code non converti");
  });
  test("commentaire interne → null", () => {
    expect(corpsPublie("Note interne")).toBeNull();
    expect(corpsPublie(" ✉️ marqueur pas en tête")).toBeNull();
    expect(corpsPublie("Je l'ai prévenue ✉️ hier")).toBeNull();
  });
  test("les chevrons ne publient plus rien", () => {
    expect(corpsPublie(">> Ancien marqueur")).toBeNull();
  });
  test("marqueur seul (message retiré à l'édition pendant le délai) → null", () => {
    expect(corpsPublie("✉️")).toBeNull();
    expect(corpsPublie("✉️   \n")).toBeNull();
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
