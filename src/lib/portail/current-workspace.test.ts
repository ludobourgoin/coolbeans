import { describe, expect, it } from "vitest";
import type { PortalClient } from "./clients";
import { readPortalMetadata } from "./metadata";
import { CLIENT_COOKIE, resolveCurrentClient } from "./current-client";

const coolbeans: PortalClient = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [], archive: false };
const amusoire: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const tous = [coolbeans, amusoire];

const admin = readPortalMetadata({ role: "admin", client: "coolbeans" });
const client = readPortalMetadata({ role: "client", client: "amusoire" });

describe("resolveCurrentClient · non-admin", () => {
  // LE test de sécurité : le cookie est une préférence, jamais une autorisation.
  it("ignore le cookie, même valide et pointant un autre client", () => {
    expect(resolveCurrentClient(tous, client, "coolbeans")?.slug).toBe("amusoire");
  });

  it("renvoie son client, cookie absent", () => {
    expect(resolveCurrentClient(tous, client, null)?.slug).toBe("amusoire");
  });

  it("renvoie null si son client n'existe pas au registre", () => {
    const orphelin = readPortalMetadata({ role: "client", client: "disparu" });
    expect(resolveCurrentClient(tous, orphelin, null)).toBeNull();
  });

  it("renvoie null s'il n'a aucun client", () => {
    expect(resolveCurrentClient(tous, readPortalMetadata({}), null)).toBeNull();
  });

  // Discrimine « cookie ignoré » de « cookie utilisé en repli » : sans ces deux
  // cas, une régression du type `getClientIn(meta.client) ?? getClientIn(cookieValue)`
  // passerait les tests ci-dessus tout en violant la règle de sécurité.
  it("renvoie null, pas le cookie, quand il n'a aucun client et que le cookie est valide", () => {
    const sansClient = readPortalMetadata({ role: "client" });
    expect(resolveCurrentClient(tous, sansClient, "coolbeans")).toBeNull();
  });

  it("renvoie null, pas le cookie, quand son client est inconnu et que le cookie est valide", () => {
    const orphelin = readPortalMetadata({ role: "client", client: "disparu" });
    expect(resolveCurrentClient(tous, orphelin, "amusoire")).toBeNull();
  });
});

describe("resolveCurrentClient · admin", () => {
  it("suit le cookie quand il désigne un client connu", () => {
    expect(resolveCurrentClient(tous, admin, "amusoire")?.slug).toBe("amusoire");
  });

  it("retombe sur son propre client quand le cookie est absent", () => {
    expect(resolveCurrentClient(tous, admin, null)?.slug).toBe("coolbeans");
  });

  it("retombe sur le défaut quand le cookie désigne un client inconnu", () => {
    expect(resolveCurrentClient(tous, admin, "disparu")?.slug).toBe("coolbeans");
  });

  it("retombe sur le défaut quand il n'a pas de client à lui", () => {
    const sansClient = readPortalMetadata({ role: "admin" });
    expect(resolveCurrentClient(tous, sansClient, null)?.slug).toBe("coolbeans");
  });

  // Le portail reste debout si coolbeans.yaml est renommé ou supprimé.
  it("prend le premier client trié quand le défaut n'existe pas", () => {
    const sansDefaut = [amusoire];
    const sansClient = readPortalMetadata({ role: "admin" });
    expect(resolveCurrentClient(sansDefaut, sansClient, null)?.slug).toBe("amusoire");
  });

  it("renvoie null quand le registre est vide", () => {
    expect(resolveCurrentClient([], admin, null)).toBeNull();
  });
});

describe("CLIENT_COOKIE", () => {
  it("porte un nom stable", () => {
    expect(CLIENT_COOKIE).toBe("portal_client");
  });
});
