import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cleAppartenance, identifiant } from "./utilisateurs";

/* La clé d'appartenance est la seule valeur de ces tables qu'on ne choisit
   pas : Better Auth la recalcule pour retrouver une ligne, et une colonne
   unique posée de travers ne se voit qu'au moment où le plugin cherche. On la
   compare donc à l'algorithme du plugin, réécrit ici avec node:crypto :
   base64url(SHA-256(JSON.stringify([teamId, userId]))), sans padding. */
function cleDeReference(teamId: string, userId: string): string {
  return createHash("sha256")
    .update(JSON.stringify([teamId, userId]))
    .digest("base64url");
}

describe("cleAppartenance", () => {
  it("reproduit exactement la clé du plugin organization", async () => {
    const cas: Array<[string, string]> = [
      ["team-abc", "user-123"],
      ["4d66b69aeffd46ebba10c0416b065618", "uNzeGhaPsDWAOYXcXHAo8QVmtAxvxRBQ"],
      ["", ""],
    ];
    for (const [teamId, userId] of cas) {
      expect(await cleAppartenance(teamId, userId)).toBe(cleDeReference(teamId, userId));
    }
  });

  it("ne porte jamais de padding : la colonne est unique, un `=` la ferait diverger", async () => {
    expect(await cleAppartenance("team-abc", "user-123")).not.toContain("=");
  });

  it("distingue deux couples proches", async () => {
    const a = await cleAppartenance("team-a", "user-b");
    const b = await cleAppartenance("team-ab", "user-");
    expect(a).not.toBe(b);
  });
});

describe("identifiant", () => {
  it("fait 32 caractères alphanumériques, comme ceux de Better Auth", () => {
    expect(identifiant()).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it("ne se répète pas", () => {
    const tirages = new Set(Array.from({ length: 50 }, () => identifiant()));
    expect(tirages.size).toBe(50);
  });
});
