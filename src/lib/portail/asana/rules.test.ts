import { describe, expect, it, vi } from "vitest";
import {
  isVisibleProject,
  projectStatus,
  sectionNameFor,
  sortProjects,
  sortTasks,
  toTaskSnapshot,
} from "./rules";
import type { AsanaProject, AsanaTask, ProjectSnapshot, TaskSnapshot } from "./types";

const PROJET = "111";
const AUTRE = "999";

const tache = (over: Partial<AsanaTask> = {}): AsanaTask => ({
  gid: "t1",
  name: "Maquette de la home",
  due_on: "2026-08-20",
  completed: false,
  assignee: { gid: "u1" },
  memberships: [{ project: { gid: PROJET }, section: { name: "🚧 En cours" } }],
  ...over,
});

const snap = (over: Partial<TaskSnapshot> = {}): TaskSnapshot => ({
  gid: "t",
  name: "T",
  due_on: "2026-08-20",
  status: "todo",
  ...over,
});

const projet = (over: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  gid: "p",
  name: "P",
  description: "",
  due_on: null,
  status: "in_progress",
  tasks: [],
  ...over,
});

describe("sectionNameFor", () => {
  // Critère 13 : une tâche multi-homée n'expose que sa section du projet client.
  it("retient la membership du projet courant", () => {
    const t = tache({
      memberships: [
        { project: { gid: AUTRE }, section: { name: "🔥 Urgent interne" } },
        { project: { gid: PROJET }, section: { name: "☝️ Pour validation" } },
      ],
    });
    expect(sectionNameFor(t, PROJET)).toBe("☝️ Pour validation");
  });

  it("renvoie null quand aucune membership ne correspond", () => {
    expect(sectionNameFor(tache({ memberships: [] }), PROJET)).toBeNull();
    expect(sectionNameFor(tache({ memberships: undefined }), PROJET)).toBeNull();
  });
});

describe("toTaskSnapshot", () => {
  const log = () => {};

  it("convertit une tâche visible", () => {
    expect(toTaskSnapshot(tache(), PROJET, log)).toEqual({
      gid: "t1",
      name: "Maquette de la home",
      due_on: "2026-08-20",
      status: "in_progress",
    });
  });

  // Critère 3 : cocher sans déplacer de colonne suffit.
  it("donne done à une tâche cochée, quelle que soit sa colonne", () => {
    const t = tache({ completed: true });
    expect(toTaskSnapshot(t, PROJET, log)?.status).toBe("done");
  });

  // Critère 16.
  it("écarte une tâche sans assigné ou sans deadline", () => {
    expect(toTaskSnapshot(tache({ assignee: null }), PROJET, log)).toBeNull();
    expect(toTaskSnapshot(tache({ due_on: null }), PROJET, log)).toBeNull();
    expect(toTaskSnapshot(tache({ due_on: "" }), PROJET, log)).toBeNull();
  });

  // Critère 15 : même assignée et datée, une tâche d'Inbox n'existe pas.
  it("écarte une tâche de la colonne Inbox", () => {
    const t = tache({ memberships: [{ project: { gid: PROJET }, section: { name: "📥 Inbox" } }] });
    expect(toTaskSnapshot(t, PROJET, log)).toBeNull();
  });

  // Critère 17.
  it("écarte une tâche dont le nom commence par un point", () => {
    expect(toTaskSnapshot(tache({ name: " .relancer l'hébergeur" }), PROJET, log)).toBeNull();
  });

  it("écarte une tâche sans membership sur le projet courant, avec un warning", () => {
    const log = vi.fn();
    expect(toTaskSnapshot(tache({ memberships: [] }), PROJET, log)).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it("retombe sur in_progress et loggue pour une section inconnue", () => {
    const log = vi.fn();
    const t = tache({ memberships: [{ project: { gid: PROJET }, section: { name: "🤷 Divers" } }] });
    expect(toTaskSnapshot(t, PROJET, log)?.status).toBe("in_progress");
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("isVisibleProject", () => {
  const p = (over: Partial<AsanaProject> = {}): AsanaProject => ({ gid: "p", name: "Site web", ...over });

  it("accepte un projet ordinaire", () => {
    expect(isVisibleProject(p())).toBe(true);
  });

  // Corrections §5 : un projet archivé disparaît du portail au sync suivant.
  it("écarte un projet archivé", () => {
    expect(isVisibleProject(p({ archived: true }))).toBe(false);
  });

  it("écarte un projet dont le nom commence par un point", () => {
    expect(isVisibleProject(p({ name: ".interne" }))).toBe(false);
  });
});

describe("projectStatus", () => {
  const p = (over: Partial<AsanaProject> = {}): AsanaProject => ({ gid: "p", name: "Site web", ...over });

  it("done si le projet est marqué terminé dans Asana", () => {
    expect(projectStatus(p({ completed: true }), [snap({ status: "todo" })])).toBe("done");
  });

  // Critère 9 : le bug de vacuité de la règle d'origine.
  it("in_progress quand tout est fait mais le projet non clôturé", () => {
    expect(projectStatus(p(), [snap({ status: "done" }), snap({ status: "done" })])).toBe("in_progress");
  });

  // Critère 10.
  it("in_progress sur un projet sans aucune tâche", () => {
    expect(projectStatus(p(), [])).toBe("in_progress");
  });

  it("ready quand toutes les tâches restantes sont en todo", () => {
    expect(projectStatus(p(), [snap({ status: "todo" }), snap({ status: "done" })])).toBe("ready");
  });

  it("in_progress dès qu'une tâche restante a bougé", () => {
    expect(projectStatus(p(), [snap({ status: "todo" }), snap({ status: "to_validate" })])).toBe("in_progress");
  });
});

describe("sortTasks", () => {
  // Critère 18 : Backlog et Sprint fusionnés, dans l'ordre du board.
  it("groupe par colonne et préserve l'ordre du board dans chaque groupe", () => {
    const entree = [
      snap({ gid: "a", status: "done" }),
      snap({ gid: "b", status: "todo" }),
      snap({ gid: "c", status: "to_validate" }),
      snap({ gid: "d", status: "todo" }),
      snap({ gid: "e", status: "in_progress" }),
    ];
    expect(sortTasks(entree).map((t) => t.gid)).toEqual(["b", "d", "e", "c", "a"]);
  });
});

describe("sortProjects", () => {
  it("place les non terminés d'abord, par deadline croissante, null en dernier", () => {
    const entree = [
      projet({ gid: "fini", status: "done", due_on: "2026-01-01" }),
      projet({ gid: "sans-date", due_on: null }),
      projet({ gid: "tard", due_on: "2026-12-01" }),
      projet({ gid: "tot", due_on: "2026-09-01" }),
    ];
    expect(sortProjects(entree).map((p) => p.gid)).toEqual(["tot", "tard", "sans-date", "fini"]);
  });
});
