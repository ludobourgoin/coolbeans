import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub du module runtime Workers : jamais utilisé quand on passe `ns` explicitement.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import { REGLAGES_DEFAUT } from "./defaults";
import { getReglages, saveReglages, type KVLike } from "./store";

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

// Ancien format `pilotage:catalog`, tel que stocké avant le chantier cockpit-devis.
const catalogueLegacy = {
  settings: {
    tjm: 555,
    demi: false,
    marcheBas: 400,
    marcheHaut: 700,
    joursSemaine: 4,
    semainesMarge: 2,
    chargesPct: 28,
  },
  catalog: {
    affinite: { baisse: 15, hausse: 25 },
    gestion: { urgencePct: 22 },
    devisTexts: {
      stackTechnique: "Stack legacy",
      conditionsReglement: "Conditions legacy",
      ceQueCaComprend: "Item legacy",
      horsPerimetre: "Hors legacy",
    },
  },
  segments: {
    pme: { label: "PME legacy", desc: "desc legacy", gestionProjet: true, note: "note legacy" },
  },
};

let ns: ReturnType<typeof memoire>;
beforeEach(() => {
  ns = memoire();
});

describe("store — Réglages", () => {
  it("rend REGLAGES_DEFAUT si la clé pilotage:reglages est vide et qu'il n'y a pas d'ancien catalogue", async () => {
    expect(await getReglages(ns)).toEqual(REGLAGES_DEFAUT);
  });

  it("sauvegarde puis relit les réglages (roundtrip)", async () => {
    const r = { ...REGLAGES_DEFAUT, tjm: 700 };
    await saveReglages(r, ns);
    expect(await getReglages(ns)).toEqual(r);
  });

  it("migre depuis l'ancien pilotage:catalog quand pilotage:reglages est vide", async () => {
    await ns.put("pilotage:catalog", JSON.stringify(catalogueLegacy));

    const reglages = await getReglages(ns);

    // Champs repris tels quels depuis l'ancien format.
    expect(reglages.tjm).toBe(555);
    expect(reglages.marcheBas).toBe(400);
    expect(reglages.marcheHaut).toBe(700);
    expect(reglages.joursSemaine).toBe(4);
    expect(reglages.semainesMarge).toBe(2);
    expect(reglages.chargesPct).toBe(28);
    expect(reglages.affinite).toEqual({ baisse: 15, hausse: 25 });
    expect(reglages.urgencePct).toBe(22);
    expect(reglages.segments).toEqual(catalogueLegacy.segments);
    expect(reglages.devisTexts.stackTechnique).toBe("Stack legacy");
    expect(reglages.devisTexts.conditionsReglement).toBe("Conditions legacy");
    expect(reglages.devisTexts.ceQueCaComprend).toBe("Item legacy");
    expect(reglages.devisTexts.horsPerimetre).toBe("Hors legacy");

    // Champs absents de l'ancien format : complétés depuis REGLAGES_DEFAUT.
    expect(reglages.gestionPct).toBe(15);
    expect(reglages.heuresJour).toBe(7);
    expect(reglages.devisTexts.urgenceTooltip).toBe(REGLAGES_DEFAUT.devisTexts.urgenceTooltip);
  });

  it("la migration ne touche jamais pilotage:catalog (ni écriture, ni suppression)", async () => {
    await ns.put("pilotage:catalog", JSON.stringify(catalogueLegacy));
    await getReglages(ns);
    expect(await ns.get("pilotage:catalog")).toBe(JSON.stringify(catalogueLegacy));
    expect(await ns.get("pilotage:reglages")).toBeNull();
  });

  it("pilotage:reglages corrompu retombe sur REGLAGES_DEFAUT sans rejeter (pas de pilotage:catalog)", async () => {
    await ns.put("pilotage:reglages", "{pas du json");
    await expect(getReglages(ns)).resolves.toEqual(REGLAGES_DEFAUT);
  });

  it("pilotage:catalog corrompu (pilotage:reglages vide) retombe sur REGLAGES_DEFAUT sans rejeter", async () => {
    await ns.put("pilotage:catalog", "{pas du json non plus");
    await expect(getReglages(ns)).resolves.toEqual(REGLAGES_DEFAUT);
  });
});
