// La garde vit dans lib/portail/require-admin.ts (pas de dépendance à
// `astro:actions`, module virtuel non résolvable sous Vitest). Depuis la
// bascule vers Better Auth elle est PURE : elle reçoit le compte résolu, la
// lecture de session étant faite par l'Action. On la teste donc en lui
// passant directement des metadata, ce que produit readPortalMetadata.
import { describe, expect, it } from "vitest";
import { requireAdmin } from "../lib/portail/require-admin";
import { readPortalMetadata } from "../lib/portail/metadata";

const compte = (raw: unknown) => readPortalMetadata(raw);

describe("requireAdmin", () => {
  it("laisse passer un admin", () => {
    expect(() => requireAdmin(compte({ portalRole: "admin" }))).not.toThrow();
  });

  it("refuse un client", () => {
    expect(() => requireAdmin(compte({ portalRole: "client" }))).toThrow(/administrateur/i);
  });

  // Le revendeur est le cas neuf : il a plus de portée qu'un client, et
  // aucune sur les outils d'administration. Le cockpit Devis en dépend.
  it("refuse un revendeur", () => {
    expect(() => requireAdmin(compte({ portalRole: "revendeur" }))).toThrow(/administrateur/i);
  });

  it("refuse un compte vide ou un rôle mal casé", () => {
    expect(() => requireAdmin(compte({}))).toThrow();
    expect(() => requireAdmin(compte({ portalRole: "Admin" }))).toThrow();
  });

  it("refuse une session absente", () => {
    expect(() => requireAdmin(compte(null))).toThrow();
  });
});
