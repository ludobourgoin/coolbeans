import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub du module runtime Workers : jamais utilisé quand on passe `ns` explicitement.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import { CATALOGUE_DEFAUT, nouveauChiffrage } from "./defaults";
import type { Chiffrage } from "./types";
import {
  cleChiffrage, cleDevis, genererId, getCatalogue, getChiffrage,
  listChiffrages, publierVersion, saveChiffrage, type KVLike,
} from "./store";

const memoire = (): KVLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    delete: async (k) => void data.delete(k),
    list: async ({ prefix }) => ({
      keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  };
};

let ns: ReturnType<typeof memoire>;
beforeEach(() => { ns = memoire(); });

const chiffrage = (id: string): Chiffrage & { id: string } => ({
  ...nouveauChiffrage(CATALOGUE_DEFAUT), id, nom: `C${id}`, clientSlug: "acme", projetSlug: "site",
});

describe("store", () => {
  it("les clés suivent le schéma de la spec", () => {
    expect(cleChiffrage("8432")).toBe("chiffrage:8432");
    expect(cleDevis("acme", "site", "8432")).toBe("devis:acme:site-8432");
  });

  it("le catalogue absent retombe sur les valeurs par défaut", async () => {
    expect(await getCatalogue(ns)).toEqual(CATALOGUE_DEFAUT);
  });

  it("sauvegarde puis relit un chiffrage", async () => {
    await saveChiffrage(chiffrage("8432"), ns);
    expect((await getChiffrage("8432", ns))?.nom).toBe("C8432");
  });

  it("liste par préfixe", async () => {
    await saveChiffrage(chiffrage("1111"), ns);
    await saveChiffrage(chiffrage("2222"), ns);
    await ns.put("devis:acme:site-1111", "{}"); // ne doit pas remonter
    const tous = await listChiffrages(ns);
    expect(tous.map((c) => c.id).sort()).toEqual(["1111", "2222"]);
  });

  it("genererId produit 4-5 chiffres et évite les collisions", async () => {
    await saveChiffrage(chiffrage("1000"), ns);
    const tirages = [1000, 1000, 4242]; // deux collisions puis un id libre
    const id = await genererId(ns, () => tirages.shift()!);
    expect(id).toBe("4242");
    expect(id).toMatch(/^\d{4,5}$/);
  });

  it("publierVersion crée puis empile des versions immuables", async () => {
    const c = chiffrage("8432");
    const data = { titre: "T", objet: "O", date: "2026-08-11T00:00:00.000Z", sections: [], notes: [] as never[] };
    const v1 = await publierVersion(c, data, ns);
    expect(v1).toEqual({ url: "/devis/acme/site-8432", n: 1 });
    const v2 = await publierVersion(c, { ...data, titre: "T2" }, ns);
    expect(v2.n).toBe(2);
    const doc = JSON.parse(ns.data.get("devis:acme:site-8432")!);
    expect(doc.versions).toHaveLength(2);
    expect(doc.versions[0].data.titre).toBe("T"); // la V1 n'a pas bougé
  });
});
