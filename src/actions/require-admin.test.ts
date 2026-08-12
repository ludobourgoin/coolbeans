// La garde vit dans lib/portail/require-admin.ts (pas de dépendance à
// `astro:actions`, module virtuel non résolvable sous Vitest — écart
// documenté dans task-5-report.md). On teste donc cette fonction directement,
// avec un `locals` minimal plutôt qu'un `ActionAPIContext` complet : c'est
// tout ce dont elle a besoin.
import { describe, expect, it } from "vitest";
import type { APIContext } from "astro";
import { requireAdmin } from "../lib/portail/require-admin";

const contexte = (publicMetadata: unknown, connecte = true) =>
  ({
    currentUser: async () => (connecte ? { publicMetadata } : null),
  }) as unknown as APIContext["locals"];

describe("requireAdmin", () => {
  it("laisse passer un admin", async () => {
    await expect(requireAdmin(contexte({ role: "admin" }))).resolves.toBeUndefined();
  });

  it("refuse un client", async () => {
    await expect(requireAdmin(contexte({ role: "client" }))).rejects.toThrow(/administrateur/i);
  });

  it("refuse un metadata vide ou un rôle mal casé", async () => {
    await expect(requireAdmin(contexte({}))).rejects.toThrow();
    await expect(requireAdmin(contexte({ role: "Admin" }))).rejects.toThrow();
  });

  it("refuse une session absente", async () => {
    await expect(requireAdmin(contexte({ role: "admin" }, false))).rejects.toThrow();
  });
});
