import { describe, expect, it } from "vitest";
import { isAuthorizedSync, SYNC_SECRET_HEADER } from "./admin-auth";

describe("SYNC_SECRET_HEADER", () => {
  it("est en minuscules — Headers.get est insensible à la casse, pas les objets littéraux", () => {
    expect(SYNC_SECRET_HEADER).toBe("x-admin-sync-secret");
  });
});

describe("isAuthorizedSync", () => {
  it("accepte le bon secret", () => {
    expect(isAuthorizedSync("s3cr3t", "s3cr3t")).toBe(true);
  });

  it("refuse un mauvais secret", () => {
    expect(isAuthorizedSync("autre", "s3cr3t")).toBe(false);
  });

  // Le cas qui compte : un secret non posé ne doit pas ouvrir la route.
  it("refuse quand le secret attendu est absent ou vide", () => {
    expect(isAuthorizedSync("s3cr3t", undefined)).toBe(false);
    expect(isAuthorizedSync("s3cr3t", "")).toBe(false);
    expect(isAuthorizedSync("", "")).toBe(false);
  });

  it("refuse quand l'en-tête est absent", () => {
    expect(isAuthorizedSync(null, "s3cr3t")).toBe(false);
  });

  it("refuse un préfixe correct mais tronqué", () => {
    expect(isAuthorizedSync("s3cr", "s3cr3t")).toBe(false);
    expect(isAuthorizedSync("s3cr3t-de-trop", "s3cr3t")).toBe(false);
  });
});
