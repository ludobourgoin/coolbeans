import { describe, expect, it } from "vitest";
import { COLUMN_ORDER, isHiddenName, mapSection, normalizeSectionName } from "./sections";

describe("normalizeSectionName", () => {
  it("retire les emojis, la casse et les accents", () => {
    expect(normalizeSectionName("🚧 En cours")).toBe("en cours");
    expect(normalizeSectionName("✅ Terminé")).toBe("termine");
    expect(normalizeSectionName("🧱 Backlog")).toBe("backlog");
    expect(normalizeSectionName("📥 Inbox")).toBe("inbox");
    expect(normalizeSectionName("🚀 Sprint")).toBe("sprint");
  });

  // ☝️ = U+261D suivi du sélecteur de variation U+FE0F. Sans traitement du
  // sélecteur, il resterait un caractère invisible dans la chaîne normalisée
  // et le matching échouerait sur la seule colonne qui appelle une action.
  it("gère le sélecteur de variation de ☝️", () => {
    expect(normalizeSectionName("☝️ Pour validation")).toBe("pour validation");
  });

  it("écrase les espaces multiples, insécables et de bord", () => {
    expect(normalizeSectionName("  À  faire  ")).toBe("a faire");
  });

  // Le piège : \p{Emoji} matche les CHIFFRES et # et *. Une normalisation
  // écrite avec \p{Emoji} au lieu de \p{Extended_Pictographic} transformerait
  // « Sprint 2 » en « sprint » — silencieusement.
  it("ne mange pas les chiffres", () => {
    expect(normalizeSectionName("🚀 Sprint 2")).toBe("sprint 2");
  });

  it("renvoie une chaîne vide sur une entrée vide", () => {
    expect(normalizeSectionName("")).toBe("");
    expect(normalizeSectionName("   ")).toBe("");
  });
});

describe("mapSection", () => {
  it("exclut Inbox du snapshot", () => {
    expect(mapSection("📥 Inbox")).toEqual({ kind: "excluded" });
  });

  it("fusionne Backlog, Sprint, Next Sprint et À faire sous todo", () => {
    for (const nom of ["🧱 Backlog", "🚀 Sprint", "Next Sprint", "À faire"]) {
      expect(mapSection(nom)).toEqual({ kind: "status", status: "todo" });
    }
  });

  it("mappe les trois autres colonnes", () => {
    expect(mapSection("🚧 En cours")).toEqual({ kind: "status", status: "in_progress" });
    expect(mapSection("☝️ Pour validation")).toEqual({ kind: "status", status: "to_validate" });
    expect(mapSection("À valider")).toEqual({ kind: "status", status: "to_validate" });
    expect(mapSection("✅ Terminé")).toEqual({ kind: "status", status: "done" });
  });

  // Emojis relevés sur la team Amusoire au 2026-08-12. Ce ne sont PAS ceux de
  // la team Coolbeans : 🍫 contre 🧱, 🤙 contre ☝️. C'est ce qui rend le
  // matching insensible aux emojis structurellement nécessaire — un board par
  // client, des emojis choisis à la main, aucune convention à espérer.
  it("mappe les mêmes colonnes avec les emojis d'une autre team", () => {
    expect(mapSection("🍫 Backlog")).toEqual({ kind: "status", status: "todo" });
    expect(mapSection("🤙 Pour validation")).toEqual({ kind: "status", status: "to_validate" });
  });

  it("signale une section inconnue sans trancher", () => {
    expect(mapSection("🤷 Peut-être un jour")).toEqual({ kind: "unknown" });
  });
});

describe("isHiddenName", () => {
  it("exclut un nom commençant par un point", () => {
    expect(isHiddenName(".chore interne")).toBe(true);
  });

  // Critère d'acceptation 17 : « y compris avec espaces avant le point ».
  it("exclut malgré des espaces de tête, insécables compris", () => {
    expect(isHiddenName("   .chore")).toBe(true);
    expect(isHiddenName(" .chore")).toBe(true);
  });

  it("n'exclut pas un point ailleurs qu'en tête", () => {
    expect(isHiddenName("Refonte v2.0")).toBe(false);
    expect(isHiddenName("Livraison finale.")).toBe(false);
  });
});

describe("COLUMN_ORDER", () => {
  it("suit l'ordre d'affichage client", () => {
    expect([...COLUMN_ORDER]).toEqual(["todo", "in_progress", "to_validate", "done"]);
  });
});
