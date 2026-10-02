import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DUREE_ECHEC,
  DUREE_SUCCES,
  estValide,
  libelleStatut,
  normaliserProjets,
  projetsDeLaTeam,
  trierProjets,
  type CacheProjets,
  type EntreeCache,
  type ProjetLinear,
  type TypeStatut,
} from "./projets-linear";

const noeud = (o: Record<string, unknown> = {}) => ({
  id: "51b46e5e-ce64-49df-a51b-88a0af3434bc",
  slugId: "e6c1e495a56f",
  url: "https://linear.app/coolbeans-hq/project/site-du-salon-edition-2026-e6c1e495a56f",
  name: "Site du salon, édition 2026",
  description: "  Le site du salon.  ",
  startDate: "2026-08-28",
  targetDate: "2026-10-02",
  updatedAt: "2026-09-30T10:00:00.000Z",
  status: { name: "In Progress", type: "started" },
  labels: { nodes: [] },
  ...o,
});

const projet = (slugId: string, type: TypeStatut, misAJour: string): ProjetLinear => ({
  id: slugId,
  pack: false,
  slugId,
  segment: slugId,
  nom: slugId,
  resume: "",
  statut: { nom: type, type },
  debut: null,
  fin: null,
  misAJour,
});

function cacheMemoire() {
  const entrees = new Map<string, { entree: EntreeCache; secondes: number }>();
  const cache: CacheProjets = {
    lire: async (cle) => entrees.get(cle)?.entree,
    ecrire: async (cle, entree, secondes) => {
      entrees.set(cle, { entree, secondes });
    },
  };
  return { cache, entrees };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("normaliserProjets", () => {
  it("garde le résumé, le segment d'adresse, le statut et les dates", () => {
    expect(normaliserProjets([noeud()])).toEqual([
      {
        id: "51b46e5e-ce64-49df-a51b-88a0af3434bc",
        pack: false,
        slugId: "e6c1e495a56f",
        segment: "site-du-salon-edition-2026-e6c1e495a56f",
        nom: "Site du salon, édition 2026",
        resume: "Le site du salon.",
        statut: { nom: "In Progress", type: "started" },
        debut: "2026-08-28",
        fin: "2026-10-02",
        misAJour: "2026-09-30T10:00:00.000Z",
      },
    ]);
  });

  it("reconnaît un pack d'heures à son label", () => {
    const [p] = normaliserProjets([noeud({ labels: { nodes: [{ name: "Pack d'heures" }] } })]);
    expect(p.pack).toBe(true);
  });

  it("écarte les projets annulés", () => {
    expect(normaliserProjets([noeud({ status: { name: "Canceled", type: "canceled" } })])).toEqual([]);
  });
});

describe("trierProjets", () => {
  it("en cours, puis à venir, puis terminés, le plus récent en tête de chaque groupe", () => {
    const tries = trierProjets([
      projet("termine", "completed", "2026-09-30"),
      projet("propose", "backlog", "2026-09-01"),
      projet("planifie", "planned", "2026-09-20"),
      projet("pause", "paused", "2026-08-01"),
      projet("encours", "started", "2026-09-10"),
    ]);
    expect(tries.map((p) => p.slugId)).toEqual(["encours", "pause", "planifie", "propose", "termine"]);
  });
});

describe("libellés du statut", () => {
  it("traduit les statuts du workspace Linear", () => {
    expect(libelleStatut({ nom: "Proposal", type: "backlog" })).toBe("Proposition");
    expect(libelleStatut({ nom: "Backlog", type: "backlog" })).toBe("À venir");
    expect(libelleStatut({ nom: "Planned", type: "planned" })).toBe("Planifié");
    expect(libelleStatut({ nom: "In Progress", type: "started" })).toBe("En cours");
    expect(libelleStatut({ nom: "Paused", type: "paused" })).toBe("En pause");
    expect(libelleStatut({ nom: "Completed", type: "completed" })).toBe("Terminé");
  });

  it("traduit un statut inconnu d'après son type", () => {
    expect(libelleStatut({ nom: "Recette", type: "started" })).toBe("En cours");
  });

  it("ne tient pour validé qu'un projet sorti de Proposal et de Backlog", () => {
    expect(estValide({ nom: "Proposal", type: "backlog" })).toBe(false);
    expect(estValide({ nom: "Backlog", type: "backlog" })).toBe(false);
    expect(estValide({ nom: "Planned", type: "planned" })).toBe(true);
    expect(estValide({ nom: "In Progress", type: "started" })).toBe(true);
    expect(estValide({ nom: "Completed", type: "completed" })).toBe(true);
  });
});

describe("projetsDeLaTeam", () => {
  it("lit Linear une fois, puis sert le cache pendant 10 minutes", async () => {
    const { cache, entrees } = cacheMemoire();
    const lire = vi.fn(async () => [projet("a", "started", "2026-09-30")]);
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toHaveLength(1);
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toHaveLength(1);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(entrees.get("v1:linear-projets:team")?.secondes).toBe(DUREE_SUCCES);
  });

  it("rend null sur un échec, et garde l'échec 60 secondes", async () => {
    const { cache, entrees } = cacheMemoire();
    const lire = vi.fn(async (): Promise<ProjetLinear[]> => {
      throw new Error("Linear 500");
    });
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toBeNull();
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire })).toBeNull();
    expect(lire).toHaveBeenCalledTimes(1);
    expect(entrees.get("v1:linear-projets:team")?.secondes).toBe(DUREE_ECHEC);
  });

  it("rend null sans clé, sans appeler Linear", async () => {
    const { cache } = cacheMemoire();
    const lire = vi.fn();
    expect(await projetsDeLaTeam("team", { apiKey: undefined, cache, lire })).toBeNull();
    expect(lire).not.toHaveBeenCalled();
  });

  it("abandonne un appel qui dépasse 2 secondes, même si Linear ne rend jamais la main", async () => {
    vi.useFakeTimers();
    const { cache } = cacheMemoire();
    const lire = vi.fn(() => new Promise<ProjetLinear[]>(() => {}));
    const promesse = projetsDeLaTeam("team", { apiKey: "k", cache, lire });
    await vi.advanceTimersByTimeAsync(2001);
    expect(await promesse).toBeNull();
  });

  it("un cache en panne ne casse rien", async () => {
    const cache: CacheProjets = {
      lire: async () => {
        throw new Error("cache");
      },
      ecrire: async () => {
        throw new Error("cache");
      },
    };
    expect(await projetsDeLaTeam("team", { apiKey: "k", cache, lire: async () => [] })).toEqual([]);
  });
});
