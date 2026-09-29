// Seule `prenomDe` est testée ici : les deux autres exports de comptes.ts sont
// des requêtes D1, et les tester demanderait une base — c'est le rôle de la
// recette, pas de Vitest. Le découpage du nom, lui, est de la logique pure, et
// c'est lui qui décide de ce qui s'affiche dans « Bonjour {prenom}, ».

import { describe, expect, it } from "vitest";
import { comptePrincipal, prenomDe } from "./comptes";

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

describe("comptePrincipal", () => {
  const compte = (id: string, prenom: string) => ({ id, prenom, nom: `${prenom} X`, email: `${id}@x.fr` });
  const comptes = [compte("ludo", "Ludovic"), compte("anja", "Anja"), compte("susanne", "Susanne")];

  it("retient le contact principal de la fiche, sans tenir compte de la casse", () => {
    expect(comptePrincipal(comptes, "susanne", "ludo")?.id).toBe("susanne");
  });

  it("prend le premier compte quand la fiche ne nomme personne ou personne de présent", () => {
    expect(comptePrincipal(comptes, undefined, "ludo")?.id).toBe("anja");
    expect(comptePrincipal(comptes, "Karsten", "ludo")?.id).toBe("anja");
  });

  it("ne retient jamais l'admin, même s'il est le contact principal ou le seul membre", () => {
    expect(comptePrincipal(comptes, "Ludovic", "ludo")?.id).toBe("anja");
    expect(comptePrincipal([compte("ludo", "Ludovic")], undefined, "ludo")).toBeUndefined();
  });
});
