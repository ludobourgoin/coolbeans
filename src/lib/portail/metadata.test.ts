import { describe, expect, it } from "vitest";
import { isAdmin, readPortalMetadata } from "./metadata";

describe("readPortalMetadata", () => {
  it("ne lève pas sur un metadata absent ou vide", () => {
    for (const raw of [undefined, null, {}]) {
      expect(readPortalMetadata(raw)).toEqual({ role: "client", client: null });
    }
  });

  it("retombe sur client pour tout rôle non reconnu", () => {
    expect(readPortalMetadata({ role: "Admin" }).role).toBe("client");
    expect(readPortalMetadata({ role: "superadmin" }).role).toBe("client");
    expect(readPortalMetadata({ role: 42 }).role).toBe("client");
    expect(readPortalMetadata({ role: "admin" }).role).toBe("admin");
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
