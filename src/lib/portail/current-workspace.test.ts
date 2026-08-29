import { describe, expect, it } from "vitest";
import type { PortalWorkspace } from "./workspaces";
import { readPortalMetadata } from "./metadata";
import { WORKSPACE_COOKIE, resolveCurrentWorkspace } from "./current-workspace";

const coolbeans: PortalWorkspace = { slug: "coolbeans", nom: "Coolbeans", organisation: "coolbeans", uptimerobot_monitor_ids: [], archive: false };
const amusoire: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  organisation: "trigger",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const tous = [coolbeans, amusoire];

const admin = readPortalMetadata({ portalRole: "admin", organisation: "coolbeans", workspace: "coolbeans" });
const client = readPortalMetadata({ portalRole: "client", organisation: "trigger", workspace: "amusoire" });

const amusoire2: PortalWorkspace = {
  slug: "durand",
  nom: "Durand",
  organisation: "trigger",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const revendeur = readPortalMetadata({ portalRole: "revendeur", organisation: "trigger" });

describe("resolveCurrentWorkspace · revendeur", () => {
  // Le cookie compte vraiment pour lui : il a plusieurs workspaces legitimes,
  // c'est ce qui distingue son cas de celui d'un client.
  it("suit le cookie quand il désigne une team de son organisation", () => {
    const tousPlus = [coolbeans, amusoire, amusoire2];
    expect(resolveCurrentWorkspace(tousPlus, revendeur, "durand")?.slug).toBe("durand");
  });

  // LE test de sécurité du multi-tenant : hors de son organisation, le cookie
  // ne peut rien ouvrir — il retombe sur sa propre portée, jamais sur la cible.
  it("n'ouvre rien hors de son organisation, même avec un cookie valide", () => {
    const tousPlus = [coolbeans, amusoire, amusoire2];
    expect(resolveCurrentWorkspace(tousPlus, revendeur, "coolbeans")?.organisation).toBe("trigger");
  });

  it("renvoie null quand son organisation n'a aucune team au registre", () => {
    const orphelin = readPortalMetadata({ portalRole: "revendeur", organisation: "inconnue" });
    expect(resolveCurrentWorkspace(tous, orphelin, null)).toBeNull();
  });
});

describe("resolveCurrentWorkspace · non-admin", () => {
  // LE test de sécurité : le cookie est une préférence, jamais une autorisation.
  it("ignore le cookie, même valide et pointant un autre client", () => {
    expect(resolveCurrentWorkspace(tous, client, "coolbeans")?.slug).toBe("amusoire");
  });

  it("renvoie son client, cookie absent", () => {
    expect(resolveCurrentWorkspace(tous, client, null)?.slug).toBe("amusoire");
  });

  it("renvoie null si son client n'existe pas au registre", () => {
    const orphelin = readPortalMetadata({ portalRole: "client", organisation: "trigger", workspace: "disparu" });
    expect(resolveCurrentWorkspace(tous, orphelin, null)).toBeNull();
  });

  it("renvoie null s'il n'a aucun client", () => {
    expect(resolveCurrentWorkspace(tous, readPortalMetadata({}), null)).toBeNull();
  });

  // Discrimine « cookie ignoré » de « cookie utilisé en repli » : sans ces deux
  // cas, une régression du type `getWorkspaceIn(meta.client) ?? getWorkspaceIn(cookieValue)`
  // passerait les tests ci-dessus tout en violant la règle de sécurité.
  it("renvoie null, pas le cookie, quand il n'a aucun client et que le cookie est valide", () => {
    const sansClient = readPortalMetadata({ portalRole: "client", organisation: "trigger" });
    expect(resolveCurrentWorkspace(tous, sansClient, "coolbeans")).toBeNull();
  });

  it("renvoie null, pas le cookie, quand son client est inconnu et que le cookie est valide", () => {
    const orphelin = readPortalMetadata({ portalRole: "client", organisation: "trigger", workspace: "disparu" });
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
    const sansClient = readPortalMetadata({ portalRole: "admin" });
    expect(resolveCurrentWorkspace(tous, sansClient, null)?.slug).toBe("coolbeans");
  });

  // Le portail reste debout si coolbeans.yaml est renommé ou supprimé.
  it("prend le premier client trié quand le défaut n'existe pas", () => {
    const sansDefaut = [amusoire];
    const sansClient = readPortalMetadata({ portalRole: "admin" });
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
