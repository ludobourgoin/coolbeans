import { describe, expect, it } from "vitest";
import { isAdmin, missingKeysFor, readPortalMetadata } from "./metadata";

describe("readPortalMetadata", () => {
  it("lit le bloc canonique du doc master", () => {
    expect(
      readPortalMetadata({
        role: "client",
        projects: ["amusoire"],
        asana_team_gid: "1217116359107690",
        uptimerobot_monitor_ids: ["800123456"],
      }),
    ).toEqual({
      role: "client",
      // Pas de clé `client` explicite dans l'entrée : retombée temporaire sur
      // projects[0], voir describe("retombée temporaire sur projects[0]").
      client: "amusoire",
      projects: ["amusoire"],
      asana_team_gid: "1217116359107690",
      uptimerobot_monitor_ids: ["800123456"],
    });
  });

  it("ne lève pas sur un metadata absent ou vide", () => {
    for (const raw of [undefined, null, {}]) {
      expect(readPortalMetadata(raw)).toEqual({
        role: "client",
        client: null,
        projects: [],
        asana_team_gid: null,
        uptimerobot_monitor_ids: [],
      });
    }
  });

  it("retombe sur client pour tout rôle non reconnu", () => {
    expect(readPortalMetadata({ role: "Admin" }).role).toBe("client");
    expect(readPortalMetadata({ role: "superadmin" }).role).toBe("client");
    expect(readPortalMetadata({ role: 42 }).role).toBe("client");
    expect(readPortalMetadata({ role: "admin" }).role).toBe("admin");
  });

  // Le piège le plus probable de la saisie manuelle : un GID Asana tapé sans
  // guillemets dans l'éditeur JSON de Clerk arrive en number.
  it("accepte un GID numérique et le rend en chaîne", () => {
    const meta = readPortalMetadata({ asana_team_gid: 1217116359107690 });
    expect(meta.asana_team_gid).toBe("1217116359107690");
  });

  it("tolère un scalaire là où un tableau est attendu", () => {
    expect(readPortalMetadata({ projects: "amusoire" }).projects).toEqual(["amusoire"]);
    expect(readPortalMetadata({ uptimerobot_monitor_ids: 800123456 }).uptimerobot_monitor_ids)
      .toEqual(["800123456"]);
  });

  it("écarte les entrées vides et dédoublonne", () => {
    const meta = readPortalMetadata({
      projects: ["amusoire", "  ", "", "amusoire", null, "autre"],
      asana_team_gid: "   ",
    });
    expect(meta.projects).toEqual(["amusoire", "autre"]);
    expect(meta.asana_team_gid).toBeNull();
  });

  it("rogne les espaces autour des identifiants", () => {
    expect(readPortalMetadata({ asana_team_gid: " 1217116359107690 " }).asana_team_gid)
      .toBe("1217116359107690");
  });

  it("lit la nouvelle clé client", () => {
    expect(readPortalMetadata({ role: "admin", client: "coolbeans" }).client).toBe("coolbeans");
  });

  it("rend client nul quand la clé est absente, vide ou mal typée", () => {
    expect(readPortalMetadata({}).client).toBeNull();
    expect(readPortalMetadata({ client: "   " }).client).toBeNull();
    expect(readPortalMetadata({ client: 42 }).client).toBeNull();
  });

  it("rogne les espaces autour du slug de client", () => {
    expect(readPortalMetadata({ client: "  amusoire  " }).client).toBe("amusoire");
  });

  // Retombée TEMPORAIRE : entre le déploiement et la mise à jour des comptes
  // dans le dashboard Clerk, un utilisateur n'a pas encore de clé `client`.
  // Sans ça, son portail casse pendant la fenêtre. À retirer ensuite.
  describe("retombée temporaire sur projects[0]", () => {
    it("adopte le premier slug de projects quand client est absent", () => {
      expect(readPortalMetadata({ projects: ["amusoire"] }).client).toBe("amusoire");
    });

    it("tolère un scalaire au lieu d'un tableau", () => {
      expect(readPortalMetadata({ projects: "amusoire" }).client).toBe("amusoire");
    });

    it("ne prend pas le pas sur un client explicite", () => {
      expect(readPortalMetadata({ client: "coolbeans", projects: ["amusoire"] }).client).toBe(
        "coolbeans",
      );
    });

    it("reste null si projects est vide", () => {
      expect(readPortalMetadata({ projects: [] }).client).toBeNull();
    });
  });
});

describe("isAdmin", () => {
  it("distingue admin et client", () => {
    expect(isAdmin(readPortalMetadata({ role: "admin" }))).toBe(true);
    expect(isAdmin(readPortalMetadata({ role: "client" }))).toBe(false);
  });
});

describe("missingKeysFor", () => {
  const complet = readPortalMetadata({
    role: "client",
    projects: ["amusoire"],
    asana_team_gid: "1217116359107690",
    uptimerobot_monitor_ids: ["800123456"],
  });
  const vide = readPortalMetadata({});

  it("ne réclame rien quand les trois mappings sont posés", () => {
    for (const m of ["projets", "site", "doc", "support"] as const) {
      expect(missingKeysFor(m, complet)).toEqual([]);
    }
  });

  it("nomme la clé attendue par chaque module", () => {
    expect(missingKeysFor("projets", vide)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("support", vide)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("site", vide)).toEqual(["uptimerobot_monitor_ids"]);
    expect(missingKeysFor("doc", vide)).toEqual(["projects"]);
  });

  // Une clé présente mais vide n'est pas une clé posée : un tableau vide ne
  // permet pas plus d'afficher le module qu'une clé absente.
  it("traite un tableau vide comme une clé manquante", () => {
    const meta = readPortalMetadata({ projects: [], uptimerobot_monitor_ids: [] });
    expect(missingKeysFor("doc", meta)).toEqual(["projects"]);
    expect(missingKeysFor("site", meta)).toEqual(["uptimerobot_monitor_ids"]);
  });
});
