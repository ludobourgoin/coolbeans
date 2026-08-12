import { describe, expect, it } from "vitest";
import { COLUMN_LABELS, formatDueOn, formatSyncedAt, PROJECT_STATUS } from "./format";

describe("formatDueOn", () => {
  it("écrit une date Asana en français", () => {
    expect(formatDueOn("2026-08-06")).toBe("6 août 2026");
    expect(formatDueOn("2026-01-01")).toBe("1 janvier 2026");
    expect(formatDueOn("2026-12-31")).toBe("31 décembre 2026");
  });

  // due_on est une date SANS heure. La convertir en Date puis la reformater
  // ferait passer le fuseau dans l'équation pour rien : une deadline au 1er
  // janvier ne doit jamais s'afficher « 31 décembre ». D'où le découpage de
  // chaîne, insensible au fuseau par construction.
  it("ne dépend d'aucun fuseau horaire", () => {
    expect(formatDueOn("2026-01-01")).not.toContain("décembre");
  });

  it("rend la chaîne telle quelle si elle n'a pas la forme attendue", () => {
    expect(formatDueOn("bientôt")).toBe("bientôt");
    expect(formatDueOn("")).toBe("");
  });
});

describe("formatSyncedAt", () => {
  // Intl glisse selon les versions d'ICU une espace insécable ou une espace
  // fine insécable avant l'heure. On normalise, plutôt que d'écrire un test
  // qui casserait à la prochaine montée de version de Node.
  const espaces = (s: string) => s.replace(/[  ]/g, " ");

  // synced_at est un instant : il doit s'afficher en heure de Paris (brief §7).
  it("convertit un instant UTC en heure de Paris, en été", () => {
    expect(espaces(formatSyncedAt("2026-08-12T13:47:00.000Z"))).toBe("12 août 2026 à 15:47");
  });

  it("gère l'heure d'hiver", () => {
    expect(espaces(formatSyncedAt("2026-01-15T09:05:00.000Z"))).toBe("15 janvier 2026 à 10:05");
  });

  it("rend une chaîne vide sur un horodatage illisible plutôt que Invalid Date", () => {
    expect(formatSyncedAt("n'importe quoi")).toBe("");
    expect(formatSyncedAt("")).toBe("");
  });
});

describe("libellés", () => {
  // §6 : « En attente de votre validation » est le seul statut appelant une
  // action du client. Le libellé ne doit pas être raccourci.
  it("nomme les colonnes côté client", () => {
    expect(COLUMN_LABELS).toEqual({
      todo: "À faire",
      in_progress: "En cours",
      to_validate: "En attente de votre validation",
      done: "Terminé",
    });
  });

  it("nomme les statuts de projet", () => {
    expect(PROJECT_STATUS.ready.label).toBe("Prêt à démarrer");
    expect(PROJECT_STATUS.in_progress.label).toBe("En cours");
    expect(PROJECT_STATUS.done.label).toBe("Terminé");
  });
});
