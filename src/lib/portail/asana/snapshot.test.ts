import { describe, expect, it } from "vitest";
import { buildTeamSnapshot, hashSnapshot, publicDescription, stableStringify } from "./snapshot";
import type { AsanaProject, AsanaTask, TeamSnapshotBody } from "./types";

const log = () => {};

const tache = (over: Partial<AsanaTask> = {}): AsanaTask => ({
  gid: "t1",
  name: "Tâche",
  due_on: "2026-08-20",
  completed: false,
  assignee: { gid: "u1" },
  memberships: [{ project: { gid: "p1" }, section: { name: "🧱 Backlog" } }],
  ...over,
});

const projet = (over: Partial<AsanaProject> = {}): AsanaProject => ({
  gid: "p1",
  name: "Site web Coolbeans",
  notes: "",
  due_on: "2026-09-30",
  completed: false,
  archived: false,
  ...over,
});

describe("publicDescription", () => {
  it("n'expose que ce qui précède le premier séparateur ---", () => {
    const notes = "Refonte du site vitrine.\n\n---\nstaging : https://staging.example\nPAT : xxx";
    expect(publicDescription(notes)).toBe("Refonte du site vitrine.");
  });

  it("renvoie une chaîne vide si le séparateur est en tête", () => {
    expect(publicDescription("---\nnotes internes")).toBe("");
  });

  // Cas réel : les notes de « 🎭 Refonte site » (Amusoire) au 2026-08-12. Le
  // `---` y précède une note de bas de page, pas une frontière public/privé —
  // toute la pile de liens internes est donc AVANT lui. D'où le plafond de 300
  // caractères appliqué aussi à cette branche : exposer strictement moins que
  // la règle de corrections §4 ne la contredit pas.
  it("plafonne aussi la portion qui précède le séparateur", () => {
    const notes = [
      "Leur cahier des charges :",
      "https://docs.google.com/document/d/11h_FusxhmsITyl620BX071jDzZcKD8A1JzPyWOfck2Q/edit?tab=t.0#heading=h.th2qsktzbmjs",
      "",
      "Notre Drive :",
      "https://drive.google.com/drive/u/1/folders/1MRCQQoGzl4GNFgHXqYP9-IiPrQlFd61I",
      "",
      "Checklist Webflow Finsweet Starter :",
      "https://docs.google.com/document/d/1bfgcLjpivvfwcXr1KB7hFW6Il8UnKwAwDIZ9I9FCcSo/edit?tab=t.0",
      "---",
      "Tâche d'origine (👨‍💼 projects) : https://app.asana.com/…",
    ].join("\n");

    const out = publicDescription(notes);
    expect(out).toHaveLength(301);
    expect(out.endsWith("…")).toBe(true);
    // La note de bas de page ne franchit jamais la frontière.
    expect(out).not.toContain("Tâche d'origine");
  });

  // Sans séparateur, on n'expose que la première ligne non vide : le reste
  // d'un champ de travail interne n'a aucune raison d'atterrir chez le client.
  it("sans séparateur, ne garde que la première ligne non vide", () => {
    expect(publicDescription("\n\nRefonte du site.\nRDV hebdo le mardi.")).toBe("Refonte du site.");
  });

  it("tronque à 300 caractères et signale la coupe", () => {
    const out = publicDescription("a".repeat(400));
    expect(out).toHaveLength(301);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 300)).toBe("a".repeat(300));
  });

  it("ne tronque pas une ligne d'exactement 300 caractères", () => {
    expect(publicDescription("b".repeat(300))).toBe("b".repeat(300));
  });

  it("tolère l'absence de notes", () => {
    expect(publicDescription(null)).toBe("");
    expect(publicDescription(undefined)).toBe("");
    expect(publicDescription("   ")).toBe("");
  });
});

describe("buildTeamSnapshot", () => {
  it("assemble un snapshot versionné, sans synced_at", () => {
    const body = buildTeamSnapshot("T1", [{ project: projet(), tasks: [tache()] }], log);
    expect(body).toEqual({
      schema_version: 1,
      team_gid: "T1",
      projects: [
        {
          gid: "p1",
          name: "Site web Coolbeans",
          description: "",
          due_on: "2026-09-30",
          status: "ready",
          tasks: [{ gid: "t1", name: "Tâche", due_on: "2026-08-20", status: "todo" }],
        },
      ],
    });
    expect(body).not.toHaveProperty("synced_at");
  });

  it("écarte les projets archivés et les projets préfixés d'un point", () => {
    const body = buildTeamSnapshot(
      "T1",
      [
        { project: projet({ gid: "a", archived: true }), tasks: [] },
        { project: projet({ gid: "b", name: ".interne" }), tasks: [] },
        { project: projet({ gid: "c" }), tasks: [] },
      ],
      log,
    );
    expect(body.projects.map((p) => p.gid)).toEqual(["c"]);
  });

  it("normalise due_on absent en null", () => {
    const body = buildTeamSnapshot("T1", [{ project: projet({ due_on: undefined }), tasks: [] }], log);
    expect(body.projects[0].due_on).toBeNull();
  });
});

describe("stableStringify", () => {
  it("produit la même chaîne quel que soit l'ordre des clés", () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
  });

  it("préserve l'ordre des tableaux", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("hashSnapshot", () => {
  const body = (over: Partial<TeamSnapshotBody> = {}): TeamSnapshotBody => ({
    schema_version: 1,
    team_gid: "T1",
    projects: [],
    ...over,
  });

  it("renvoie un SHA-256 hexadécimal de 64 caractères", async () => {
    expect(await hashSnapshot(body())).toMatch(/^[0-9a-f]{64}$/);
  });

  // Critère 11 : deux passages sans changement ne doivent produire aucune écriture.
  it("est stable d'un appel à l'autre pour un contenu identique", async () => {
    expect(await hashSnapshot(body())).toBe(await hashSnapshot(body()));
  });

  it("change dès que le contenu change", async () => {
    const a = await hashSnapshot(body());
    const b = await hashSnapshot(body({ team_gid: "T2" }));
    expect(a).not.toBe(b);
  });
});
