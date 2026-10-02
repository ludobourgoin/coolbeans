// Le pronom d'un mail ne doit jamais empêcher son envoi : la messagerie écrit
// le message en base avant d'envoyer, et un échec à ce moment-là le laisse
// sans mail pour toujours (publier.ts, ouvrir.ts). Les deux fonctions sont
// donc totales : toute panne retombe sur le vous.
import { afterEach, describe, expect, it, vi } from "vitest";
import { pronomDuDestinataire, pronomDuPortail } from "./pronom";

const silence = () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
};
afterEach(() => vi.restoreAllMocks());

describe("pronomDuDestinataire", () => {
  it("une base en panne donne le vous, sans lever", async () => {
    silence();
    const db = {
      prepare: () => {
        throw new Error("D1 indisponible");
      },
    } as unknown as D1Database;
    await expect(pronomDuDestinataire(db, "a@b.c")).resolves.toBe("vous");
  });

  it("des fiches illisibles (astro:content absent, comme sous Vitest) donnent le vous", async () => {
    silence();
    const db = {
      prepare: () => ({
        bind: () => ({ first: async () => ({ role: "client", organisation: "coolbeans", workspace: "cafa" }) }),
      }),
    } as unknown as D1Database;
    await expect(pronomDuDestinataire(db, "a@b.c")).resolves.toBe("vous");
  });
});

describe("pronomDuPortail", () => {
  it("des fiches illisibles donnent le vous, sans lever", async () => {
    silence();
    await expect(pronomDuPortail({ role: "client", organisation: "coolbeans", workspace: "cafa" })).resolves.toBe("vous");
  });
});
