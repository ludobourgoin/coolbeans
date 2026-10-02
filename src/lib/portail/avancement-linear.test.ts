import { describe, expect, it, vi } from "vitest";
import {
  construireAvancement,
  construireHeures,
  detailDuProjet,
  libelleDemande,
  libelleEtat,
  statutDemande,
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
  sortOrder: 0,
  estimate: null,
  state: { type, name: type },
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

  it("dans un jalon, suit l'ordre manuel de Linear, les faites en dernier", () => {
    const a = construireAvancement([], [
      issue("Faite", "completed", { sortOrder: -10 }),
      issue("Troisième", "unstarted", { sortOrder: 30 }),
      issue("Première", "started", { sortOrder: -5 }),
      issue("Deuxième", "backlog", { sortOrder: 12, dueDate: "2026-10-05" }),
    ]);
    expect(a.groupes[0].issues.map((i) => i.titre)).toEqual(["Première", "Deuxième", "Troisième", "Faite"]);
    expect(a.groupes[0].issues[1]).toEqual({ titre: "Deuxième", etat: "backlog", echeance: "2026-10-05" });
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

describe("statutDemande", () => {
  it("lit le statut d'une demande sur un pack, statut Chiffrée compris", () => {
    expect(statutDemande({ type: "triage", name: "Triage" })).toBe("a-chiffrer");
    expect(statutDemande({ type: "backlog", name: "Chiffrée" })).toBe("chiffree");
    expect(statutDemande({ type: "backlog", name: "Backlog" })).toBe("a-chiffrer");
    expect(statutDemande({ type: "unstarted", name: "Todo" })).toBe("acceptee");
    expect(statutDemande({ type: "started", name: "In Review" })).toBe("en-cours");
    expect(statutDemande({ type: "completed", name: "Done" })).toBe("faite");
    expect(statutDemande({ type: "canceled", name: "Canceled" })).toBe("non-retenue");
  });

  it("traduit chaque statut pour le client", () => {
    expect(libelleDemande("a-chiffrer")).toBe("À chiffrer");
    expect(libelleDemande("chiffree")).toBe("Chiffrée, attend ton accord");
    expect(libelleDemande("acceptee")).toBe("Acceptée");
    expect(libelleDemande("en-cours")).toBe("En cours");
    expect(libelleDemande("faite")).toBe("Faite");
    expect(libelleDemande("non-retenue")).toBe("Non retenue");
  });
});

describe("construireHeures", () => {
  const demandes = [
    issue("Simulateur", "unstarted", { estimate: 5, sortOrder: 2 }),
    issue("Bandeau", "completed", { estimate: 2, sortOrder: 1 }),
    issue("Libellés", "started", { estimate: 1, sortOrder: 3 }),
    issue("Nouvelle page", "backlog", { estimate: 8, sortOrder: 4, state: { type: "backlog", name: "Chiffrée" } }),
    issue("Formulaire", "triage", { sortOrder: 5 }),
    issue("Refusée", "canceled", { estimate: 3, sortOrder: 0 }),
    issue("Doublon", "duplicate", { estimate: 3, sortOrder: 6 }),
  ];

  it("décompte les demandes acceptées, en cours et faites, au go du client", () => {
    const h = construireHeures(demandes, 20);
    expect(h).toMatchObject({ total: 20, engagees: 8, restantes: 12 });
  });

  it("ne décompte ni les demandes à chiffrer, ni les chiffrées en attente, ni les refusées", () => {
    expect(construireHeures([demandes[3], demandes[4], demandes[5]], 20).engagees).toBe(0);
  });

  it("garde les demandes à chiffrer et les refusées visibles, écarte les doublons", () => {
    expect(construireHeures(demandes, 20).demandes.map((d) => d.titre)).toEqual([
      "Simulateur",
      "Libellés",
      "Nouvelle page",
      "Formulaire",
      "Bandeau",
      "Refusée",
    ]);
  });

  it("porte l'estimate de chaque demande", () => {
    expect(construireHeures(demandes, 20).demandes[0]).toEqual({
      titre: "Simulateur",
      statut: "acceptee",
      heures: 5,
      echeance: null,
    });
  });

  it("sans total connu, ne calcule pas de solde", () => {
    expect(construireHeures(demandes, null)).toMatchObject({ total: null, engagees: 8, restantes: null });
  });

  it("laisse voir un dépassement", () => {
    expect(construireHeures(demandes, 5).restantes).toBe(-3);
  });
});

describe("detailDuProjet", () => {
  it("lit Linear une fois, puis sert le cache", async () => {
    const entrees = new Map();
    const cache: CacheLinear<unknown> = {
      lire: async (c) => entrees.get(c),
      ecrire: async (c, e) => {
        entrees.set(c, e);
      },
    };
    const lire = vi.fn(async () => ({ jalons: [], issues: [issue("A", "started")] }));
    await detailDuProjet("8947ac98efef", { apiKey: "k", cache: cache as never, lire });
    const deuxieme = await detailDuProjet("8947ac98efef", { apiKey: "k", cache: cache as never, lire });
    expect(lire).toHaveBeenCalledTimes(1);
    expect(deuxieme?.issues).toHaveLength(1);
    expect([...entrees.keys()]).toEqual(["v2:linear-detail:8947ac98efef"]);
  });

  it("rend null quand Linear échoue", async () => {
    const cache: CacheLinear<unknown> = { lire: async () => undefined, ecrire: async () => {} };
    const lire = vi.fn(async () => {
      throw new Error("Linear 500");
    });
    expect(await detailDuProjet("8947ac98efef", { apiKey: "k", cache: cache as never, lire })).toBeNull();
  });
});
