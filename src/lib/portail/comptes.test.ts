// Seule `prenomDe` est testée ici : les deux autres exports de comptes.ts sont
// des requêtes D1, et les tester demanderait une base — c'est le rôle de la
// recette, pas de Vitest. Le découpage du nom, lui, est de la logique pure, et
// c'est lui qui décide de ce qui s'affiche dans « Bonjour {prenom}, ».

import { describe, expect, it } from "vitest";
import { prenomDe } from "./comptes";

describe("prenomDe", () => {
  it("prend le premier mot du nom complet", () => {
    expect(prenomDe("Marie Dupont")).toBe("Marie");
  });

  it("rend le nom entier quand il n'a qu'un mot", () => {
    expect(prenomDe("Ludo")).toBe("Ludo");
  });

  it("tolère les espaces superflus", () => {
    expect(prenomDe("  Jean-Paul   Sartre ")).toBe("Jean-Paul");
  });

  // Le contrat qui compte : jamais `undefined`. Un appelant écrit
  // « Bonjour {prenom}, » — un undefined y imprimerait le mot.
  it("rend une chaîne vide plutôt qu'undefined", () => {
    expect(prenomDe(null)).toBe("");
    expect(prenomDe(undefined)).toBe("");
    expect(prenomDe("   ")).toBe("");
  });
});
