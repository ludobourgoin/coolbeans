import { describe, expect, it, vi } from "vitest";
import {
  avancementDuProjet,
  construireAvancement,
  libelleEtat,
  type NoeudIssue,
  type NoeudJalon,
} from "./avancement-linear";
import type { CacheLinear } from "./projets-linear";

const jalon = (id: string, name: string, targetDate: string | null, sortOrder = 0): NoeudJalon => ({
  id,
  name,
  targetDate,
  sortOrder,
});

const issue = (title: string, type: string, o: Partial<NoeudIssue> = {}): NoeudIssue => ({
  title,
  dueDate: null,
  state: { type },
  projectMilestone: null,
  ...o,
});

describe("construireAvancement", () => {
  it("écarte les issues annulées et celles en Triage", () => {
    const a = construireAvancement([], [
      issue("Visible", "unstarted"),
      issue("Annulée", "canceled"),
      issue("À qualifier", "triage"),
    ]);
    expect(a.total).toBe(1);
    expect(a.groupes.flatMap((g) => g.issues.map((i) => i.titre))).toEqual(["Visible"]);
  });

  it("compte les issues faites", () => {
    const a = construireAvancement([], [
      issue("A", "completed"),
      issue("B", "started"),
      issue("C", "completed"),
    ]);
    expect(a).toMatchObject({ faites: 2, total: 3 });
  });

  it("range les issues par jalon, dans l'ordre des dates, les issues sans jalon à la fin", () => {
    const jalons = [jalon("j2", "Mise en ligne", "2026-10-31"), jalon("j1", "Maquettes", "2026-10-10")];
    const a = construireAvancement(jalons, [
      issue("Sans jalon", "unstarted"),
      issue("Intégration", "started", { projectMilestone: { id: "j2" } }),
      issue("Maquette accueil", "completed", { projectMilestone: { id: "j1" } }),
    ]);
    expect(a.groupes.map((g) => g.jalon?.nom ?? null)).toEqual(["Maquettes", "Mise en ligne", null]);
    expect(a.groupes[0].jalon).toEqual({ nom: "Maquettes", date: "2026-10-10" });
  });

  it("n'affiche pas un jalon sans issue visible", () => {
    const a = construireAvancement([jalon("j1", "Vide", "2026-10-10")], [issue("Seule", "unstarted")]);
    expect(a.groupes.map((g) => g.jalon)).toEqual([null]);
  });

  it("place un jalon sans date après les jalons datés", () => {
    const jalons = [jalon("j1", "Plus tard", null), jalon("j2", "Bientôt", "2026-10-10")];
    const a = construireAvancement(jalons, [
      issue("A", "unstarted", { projectMilestone: { id: "j1" } }),
      issue("B", "unstarted", { projectMilestone: { id: "j2" } }),
    ]);
    expect(a.groupes.map((g) => g.jalon?.nom)).toEqual(["Bientôt", "Plus tard"]);
  });

  it("dans un jalon, met les issues ouvertes d'abord, par échéance, puis les faites", () => {
    const a = construireAvancement([], [
      issue("Faite", "completed", { dueDate: "2026-10-01" }),
      issue("Sans échéance", "unstarted"),
      issue("Tardive", "started", { dueDate: "2026-10-20" }),
      issue("Proche", "backlog", { dueDate: "2026-10-05" }),
    ]);
    expect(a.groupes[0].issues.map((i) => i.titre)).toEqual(["Proche", "Tardive", "Sans échéance", "Faite"]);
    expect(a.groupes[0].issues[0]).toEqual({ titre: "Proche", etat: "backlog", echeance: "2026-10-05" });
  });

  it("rend un avancement vide pour un projet sans issue", () => {
    expect(construireAvancement([], [])).toEqual({ faites: 0, total: 0, groupes: [] });
  });
});

describe("libelleEtat", () => {
  it("traduit le type d'état pour le client", () => {
    expect(libelleEtat("backlog")).toBe("À venir");
    expect(libelleEtat("unstarted")).toBe("À faire");
    expect(libelleEtat("started")).toBe("En cours");
    expect(libelleEtat("completed")).toBe("Fait");
  });
});

describe("avancementDuProjet", () => {
  it("lit Linear une fois, puis sert le cache", async () => {
    const entrees = new Map();
    const cache: CacheLinear<unknown> = {
      lire: async (c) => entrees.get(c),
      ecrire: async (c, e) => {
        entrees.set(c, e);
      },
    };
    const lire = vi.fn(async () => construireAvancement([], [issue("A", "started")]));
    await avancementDuProjet("8947ac98efef", { apiKey: "k", cache: cache as never, lire });
    const deuxieme = await avancementDuProjet("8947ac98efef", { apiKey: "k", cache: cache as never, lire });
    expect(lire).toHaveBeenCalledTimes(1);
    expect(deuxieme?.total).toBe(1);
    expect([...entrees.keys()]).toEqual(["v1:linear-avancement:8947ac98efef"]);
  });

  it("rend null quand Linear échoue", async () => {
    const cache: CacheLinear<unknown> = { lire: async () => undefined, ecrire: async () => {} };
    const lire = vi.fn(async () => {
      throw new Error("Linear 500");
    });
    expect(await avancementDuProjet("8947ac98efef", { apiKey: "k", cache: cache as never, lire })).toBeNull();
  });
});
