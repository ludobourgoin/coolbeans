import { describe, expect, it } from "vitest";
import { reconcilier } from "./sync";
import type { Livraison } from "./linear-milestones";

const livraison = (milestoneId: string): Livraison => ({
  milestoneId,
  cleTeam: "LIT",
  etiquette: "Intégration",
  date: "2026-09-12",
  projetNom: "Site vitrine LittleBox",
  projetUrl: "https://linear.app/coolbeans-hq/project/littlebox",
});

const deps = (o: {
  livraisons: Livraison[];
  ids: string[];
  ecrire?: (l: Livraison) => Promise<"cree" | "maj">;
}) => {
  const supprimes: string[] = [];
  return {
    supprimes,
    d: {
      lireLivraisons: async () => o.livraisons,
      listerIds: async () => o.ids,
      ecrire: o.ecrire ?? (async () => "maj" as const),
      supprimer: async (id: string) => {
        supprimes.push(id);
      },
    },
  };
};

describe("reconcilier", () => {
  it("cree ce qui manque", async () => {
    const { d } = deps({ livraisons: [livraison("aaaa-bbbb")], ids: [], ecrire: async () => "cree" });
    expect(await reconcilier(d)).toEqual({ crees: 1, maj: 0, supprimes: 0, echecs: 0 });
  });

  it("met a jour ce qui existe deja", async () => {
    const { d } = deps({ livraisons: [livraison("aaaa-bbbb")], ids: ["lmaaaabbbb"] });
    expect(await reconcilier(d)).toEqual({ crees: 0, maj: 1, supprimes: 0, echecs: 0 });
  });

  it("supprime un orphelin", async () => {
    const { d, supprimes } = deps({ livraisons: [], ids: ["lmvieux"] });
    expect(await reconcilier(d)).toEqual({ crees: 0, maj: 0, supprimes: 1, echecs: 0 });
    expect(supprimes).toEqual(["lmvieux"]);
  });

  it("ne supprime pas un evenement encore cible", async () => {
    const { d, supprimes } = deps({ livraisons: [livraison("aaaa-bbbb")], ids: ["lmaaaabbbb"] });
    await reconcilier(d);
    expect(supprimes).toEqual([]);
  });

  it("compte un echec isole sans interrompre le reste", async () => {
    const { d } = deps({
      livraisons: [livraison("aaaa-bbbb"), livraison("cccc-dddd")],
      ids: [],
      ecrire: async (l) => {
        if (l.milestoneId === "aaaa-bbbb") throw new Error("boom");
        return "cree";
      },
    });
    expect(await reconcilier(d)).toEqual({ crees: 1, maj: 0, supprimes: 0, echecs: 1 });
  });
});
