import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT,
  findClientByDocIn,
  getClientIn,
  missingKeysFor,
  sortClients,
  type PortalClient,
} from "./clients";

const coolbeans: PortalClient = { slug: "coolbeans", nom: "Coolbeans", uptimerobot_monitor_ids: [] };
const amusoire: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  asana_team_gid: "1217116359107690",
  uptimerobot_monitor_ids: [],
};
const zebre: PortalClient = { slug: "zebre", nom: "Zèbre", uptimerobot_monitor_ids: [] };
const tous = [zebre, amusoire, coolbeans];

describe("sortClients", () => {
  it("place Coolbeans en tête, puis trie par nom", () => {
    expect(sortClients(tous).map((c) => c.slug)).toEqual(["coolbeans", "amusoire", "zebre"]);
  });

  it("ne plante pas si Coolbeans est absent", () => {
    expect(sortClients([zebre, amusoire]).map((c) => c.slug)).toEqual(["amusoire", "zebre"]);
  });
});

describe("getClientIn", () => {
  it("retrouve un client par son slug", () => {
    expect(getClientIn(tous, "amusoire")).toEqual(amusoire);
  });

  it("renvoie null sur un slug inconnu, vide ou absent", () => {
    for (const s of ["inconnu", "", null, undefined]) {
      expect(getClientIn(tous, s)).toBeNull();
    }
  });
});

describe("findClientByDocIn", () => {
  it("retrouve le client propriétaire d'une doc", () => {
    expect(findClientByDocIn(tous, "amusoire")).toEqual(amusoire);
  });

  // _template n'appartient à aucun client : aucune bascule de contexte.
  it("renvoie null pour une doc que personne ne revendique", () => {
    expect(findClientByDocIn(tous, "_template")).toBeNull();
  });
});

describe("missingKeysFor", () => {
  it("ne réclame rien quand le mapping du module est posé", () => {
    expect(missingKeysFor("projets", amusoire)).toEqual([]);
    expect(missingKeysFor("doc", amusoire)).toEqual([]);
  });

  it("nomme la clé attendue par chaque module", () => {
    expect(missingKeysFor("projets", coolbeans)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("support", coolbeans)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("site", coolbeans)).toEqual(["uptimerobot_monitor_ids"]);
    expect(missingKeysFor("doc", coolbeans)).toEqual(["doc"]);
  });

  // Un utilisateur sans client du tout : tout manque, rien ne plante.
  it("réclame tout quand il n'y a pas de client", () => {
    expect(missingKeysFor("projets", null)).toEqual(["asana_team_gid"]);
    expect(missingKeysFor("site", null)).toEqual(["uptimerobot_monitor_ids"]);
  });

  it("traite un tableau de monitors vide comme une clé manquante", () => {
    expect(missingKeysFor("site", amusoire)).toEqual(["uptimerobot_monitor_ids"]);
  });
});

describe("DEFAULT_CLIENT", () => {
  it("vaut coolbeans", () => {
    expect(DEFAULT_CLIENT).toBe("coolbeans");
  });
});
