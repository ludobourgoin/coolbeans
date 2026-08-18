import { describe, expect, it } from "vitest";
import type { PortalWorkspace } from "./workspaces";
import { readPortalMetadata } from "./metadata";
import { WORKSPACE_COOKIE, resolveCurrentWorkspace } from "./current-workspace";

const coolbeans: PortalWorkspace = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [], archive: false };
const amusoire: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const tous = [coolbeans, amusoire];

const admin = readPortalMetadata({ role: "admin", client: "coolbeans" });
const client = readPortalMetadata({ role: "client", client: "amusoire" });

describe("resolveCurrentWorkspace · non-admin", () => {
  // LE test de sécurité : le cookie est une préférence, jamais une autorisation.
  it("ignore le cookie, même valide et pointant un autre client", () => {
    expect(resolveCurrentWorkspace(tous, client, "coolbeans")?.slug).toBe("amusoire");
  });

  it("renvoie son client, cookie absent", () => {
    expect(resolveCurrentWorkspace(tous, client, null)?.slug).toBe("amusoire");
  });

  it("renvoie null si son client n'existe pas au registre", () => {
    const orphelin = readPortalMetadata({ role: "client", client: "disparu" });
    expect(resolveCurrentWorkspace(tous, orphelin, null)).toBeNull();
  });

  it("renvoie null s'il n'a aucun client", () => {
    expect(resolveCurrentWorkspace(tous, readPortalMetadata({}), null)).toBeNull();
  });

  // Discrimine « cookie ignoré » de « cookie utilisé en repli » : sans ces deux
  // cas, une régression du type `getWorkspaceIn(meta.client) ?? getWorkspaceIn(cookieValue)`
  // passerait les tests ci-dessus tout en violant la règle de sécurité.
  it("renvoie null, pas le cookie, quand il n'a aucun client et que le cookie est valide", () => {
    const sansClient = readPortalMetadata({ role: "client" });
    expect(resolveCurrentWorkspace(tous, sansClient, "coolbeans")).toBeNull();
  });

  it("renvoie null, pas le cookie, quand son client est inconnu et que le cookie est valide", () => {
    const orphelin = readPortalMetadata({ role: "client", client: "disparu" });
    expect(resolveCurrentWorkspace(tous, orphelin, "amusoire")).toBeNull();
  });
});

describe("resolveCurrentWorkspace · admin", () => {
  it("suit le cookie quand il désigne un client connu", () => {
    expect(resolveCurrentWorkspace(tous, admin, "amusoire")?.slug).toBe("amusoire");
  });

  it("retombe sur son propre client quand le cookie est absent", () => {
    expect(resolveCurrentWorkspace(tous, admin, null)?.slug).toBe("coolbeans");
  });

  it("retombe sur le défaut quand le cookie désigne un client inconnu", () => {
    expect(resolveCurrentWorkspace(tous, admin, "disparu")?.slug).toBe("coolbeans");
  });

  it("retombe sur le défaut quand il n'a pas de client à lui", () => {
    const sansClient = readPortalMetadata({ role: "admin" });
    expect(resolveCurrentWorkspace(tous, sansClient, null)?.slug).toBe("coolbeans");
  });

  // Le portail reste debout si coolbeans.yaml est renommé ou supprimé.
  it("prend le premier client trié quand le défaut n'existe pas", () => {
    const sansDefaut = [amusoire];
    const sansClient = readPortalMetadata({ role: "admin" });
    expect(resolveCurrentWorkspace(sansDefaut, sansClient, null)?.slug).toBe("amusoire");
  });

  it("renvoie null quand le registre est vide", () => {
    expect(resolveCurrentWorkspace([], admin, null)).toBeNull();
  });
});

describe("WORKSPACE_COOKIE", () => {
  // Renommé portal_client → portal_workspace au passage sélecteur de
  // workspace : changement assumé, la préférence d'affichage des admins se
  // réinitialise une fois vers le défaut (Coolbeans), sans autre effet.
  it("porte un nom stable", () => {
    expect(WORKSPACE_COOKIE).toBe("portal_workspace");
  });
});
