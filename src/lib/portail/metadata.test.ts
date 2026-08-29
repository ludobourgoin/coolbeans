import { describe, expect, it } from "vitest";
import { isAdmin, isRevendeur, readPortalMetadata } from "./metadata";

const VIDE = { role: "client", organisation: null, workspace: null };

describe("readPortalMetadata", () => {
  it("ne lève pas sur une entrée absente ou vide", () => {
    for (const raw of [undefined, null, {}]) {
      expect(readPortalMetadata(raw)).toEqual(VIDE);
    }
  });

  it("accepte les trois types de compte", () => {
    expect(readPortalMetadata({ portalRole: "admin" }).role).toBe("admin");
    expect(readPortalMetadata({ portalRole: "revendeur" }).role).toBe("revendeur");
    expect(readPortalMetadata({ portalRole: "client" }).role).toBe("client");
  });

  // LA règle de sécurité : liste blanche, pas exclusion. Une valeur inconnue
  // ne doit jamais ouvrir plus que le minimum. « agence » figure exprès dans
  // la liste : c'est l'ancien nom du type, et un compte resté dessus ne doit
  // pas devenir revendeur par accident.
  it("retombe sur client pour toute valeur hors liste blanche", () => {
    for (const v of ["Admin", "ADMIN", "superadmin", "agence", "", 42, null, {}, []]) {
      expect(readPortalMetadata({ portalRole: v }).role).toBe("client");
    }
  });

  it("lit l'organisation et le workspace", () => {
    const m = readPortalMetadata({
      portalRole: "client",
      organisation: "trigger",
      workspace: "amusoire",
    });
    expect(m.organisation).toBe("trigger");
    expect(m.workspace).toBe("amusoire");
  });

  it("rend organisation et workspace nuls quand absents, vides ou mal typés", () => {
    expect(readPortalMetadata({ organisation: "  ", workspace: 42 })).toEqual(VIDE);
  });

  it("rogne les espaces autour des slugs", () => {
    expect(readPortalMetadata({ organisation: " trigger " }).organisation).toBe("trigger");
  });
});

describe("isAdmin / isRevendeur", () => {
  it("distingue les trois types", () => {
    expect(isAdmin({ ...VIDE, role: "admin" } as never)).toBe(true);
    expect(isAdmin({ ...VIDE, role: "revendeur" } as never)).toBe(false);
    expect(isRevendeur({ ...VIDE, role: "revendeur" } as never)).toBe(true);
    expect(isRevendeur({ ...VIDE, role: "admin" } as never)).toBe(false);
  });
});
