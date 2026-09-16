import { describe, expect, it } from "vitest";
import {
  feriesFrance,
  grilleMois,
  moisGlissants,
  paques,
  periodeLisible,
  plagesAffichees,
  type Plage,
} from "./disponibilites";

describe("paques", () => {
  it("retrouve les dates connues", () => {
    /* Références du calendrier grégorien : 2024 est un cas tardif proche
       du 31 mars, 2026 tombe le 5 avril, 2038 est le plus tardif du siècle. */
    expect(paques(2024)).toBe("2024-03-31");
    expect(paques(2025)).toBe("2025-04-20");
    expect(paques(2026)).toBe("2026-04-05");
    expect(paques(2038)).toBe("2038-04-25");
  });
});

describe("feriesFrance", () => {
  const f = feriesFrance(2026);
  it("porte les onze jours fériés", () => {
    expect(f.size).toBe(11);
  });
  it("calcule les fêtes mobiles depuis Pâques", () => {
    expect(f.get("2026-04-06")).toBe("Lundi de Pâques");
    expect(f.get("2026-05-14")).toBe("Ascension");
    expect(f.get("2026-05-25")).toBe("Lundi de Pentecôte");
  });
  it("garde les fêtes fixes", () => {
    expect(f.get("2026-01-01")).toBe("Jour de l'an");
    expect(f.get("2026-07-14")).toBe("Fête nationale");
    expect(f.get("2026-12-25")).toBe("Noël");
  });
});

describe("moisGlissants", () => {
  it("part du mois courant et en donne trois", () => {
    expect(moisGlissants("2026-09-16")).toEqual([
      { annee: 2026, mois: 9 },
      { annee: 2026, mois: 10 },
      { annee: 2026, mois: 11 },
    ]);
  });
  it("passe l'année", () => {
    expect(moisGlissants("2026-12-03")).toEqual([
      { annee: 2026, mois: 12 },
      { annee: 2027, mois: 1 },
      { annee: 2027, mois: 2 },
    ]);
  });
});

describe("grilleMois", () => {
  const plages: Plage[] = [
    { du: "2026-10-26", au: "2026-11-01", motif: "Vacances" },
    { du: "2026-09-16", au: "2026-09-16" },
  ];

  it("n'a que cinq colonnes et cale le 1er sur sa colonne", () => {
    /* Octobre 2026 commence un jeudi : la première semaine a trois cases
       vides (lun, mar, mer) puis le 1 et le 2. */
    const g = grilleMois({ annee: 2026, mois: 10 }, { aujourdhui: "2026-09-16", plages });
    expect(g.semaines[0].map((c) => c?.jour ?? null)).toEqual([null, null, null, 1, 2]);
    expect(g.semaines.every((s) => s.length === 5)).toBe(true);
  });

  it("ne contient aucun samedi ni dimanche", () => {
    const g = grilleMois({ annee: 2026, mois: 10 }, { aujourdhui: "2026-09-16", plages });
    const jours = g.semaines.flat().filter(Boolean).map((c) => c!.jour);
    expect(jours).not.toContain(3); // samedi 3 octobre
    expect(jours).not.toContain(4); // dimanche 4 octobre
    expect(jours.length).toBe(22); // jours ouvrés d'octobre 2026
  });

  it("marque les fériés avec leur nom", () => {
    const g = grilleMois({ annee: 2026, mois: 11 }, { aujourdhui: "2026-09-16", plages });
    const onze = g.semaines.flat().find((c) => c?.jour === 11)!;
    expect(onze.etat).toBe("ferie");
    expect(onze.libelle).toBe("Armistice 1918");
  });

  it("marque les jours d'une plage, bornes comprises", () => {
    const g = grilleMois({ annee: 2026, mois: 10 }, { aujourdhui: "2026-09-16", plages });
    const cellules = g.semaines.flat().filter(Boolean) as NonNullable<(typeof g.semaines)[0][0]>[];
    const etats = Object.fromEntries(cellules.map((c) => [c.jour, c.etat]));
    expect(etats[23]).toBe("ouvre");
    expect(etats[26]).toBe("indispo");
    expect(etats[30]).toBe("indispo");
    const lundi = cellules.find((c) => c.jour === 26)!;
    expect(lundi.libelle).toBe("Vacances");
  });

  it("marque le jour courant et les jours passés", () => {
    const g = grilleMois({ annee: 2026, mois: 9 }, { aujourdhui: "2026-09-16", plages });
    const cellules = g.semaines.flat().filter(Boolean) as NonNullable<(typeof g.semaines)[0][0]>[];
    const seize = cellules.find((c) => c.jour === 16)!;
    expect(seize.aujourdhui).toBe(true);
    /* Le jour courant garde son état d'indisponibilité : c'est justement
       aujourd'hui que le client veut savoir. */
    expect(seize.etat).toBe("indispo");
    expect(cellules.find((c) => c.jour === 15)!.passe).toBe(true);
    expect(cellules.find((c) => c.jour === 17)!.passe).toBe(false);
  });

  it("le férié prime sur la plage", () => {
    const g = grilleMois(
      { annee: 2026, mois: 11 },
      { aujourdhui: "2026-09-16", plages: [{ du: "2026-11-09", au: "2026-11-13" }] },
    );
    expect(g.semaines.flat().find((c) => c?.jour === 11)!.etat).toBe("ferie");
  });
});

describe("periodeLisible", () => {
  it("écrit la plage en français, ordinal sur le 1er", () => {
    expect(periodeLisible({ du: "2026-10-26", au: "2026-11-01" })).toBe(
      "du 26 octobre au 1er novembre",
    );
  });
  it("réduit un jour seul à « le … »", () => {
    expect(periodeLisible({ du: "2026-09-16", au: "2026-09-16" })).toBe("le 16 septembre");
  });
});

describe("plagesAffichees", () => {
  it("ne garde que les plages qui touchent la fenêtre, triées", () => {
    const plages: Plage[] = [
      { du: "2026-06-01", au: "2026-06-05", motif: "Passée" },
      { du: "2026-11-25", au: "2026-12-03", motif: "Chevauche la fin" },
      { du: "2026-09-10", au: "2026-09-18", motif: "Chevauche le début" },
      { du: "2027-02-01", au: "2027-02-02", motif: "Trop loin" },
    ];
    const res = plagesAffichees(plages, moisGlissants("2026-09-16"));
    expect(res.map((p) => p.motif)).toEqual(["Chevauche le début", "Chevauche la fin"]);
  });
});
