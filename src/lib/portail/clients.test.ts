import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT,
  findClientByDocIn,
  getClientIn,
  missingKeysFor,
  selectableClients,
  sortClients,
  type PortalClient,
} from "./clients";

const coolbeans: PortalClient = { slug: "coolbeans", nom: "Coolbeans", archive: false, uptimerobot_monitor_ids: [] };
const amusoire: PortalClient = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const zebre: PortalClient = { slug: "zebre", nom: "Zèbre", archive: false, uptimerobot_monitor_ids: [] };
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
    expect(missingKeysFor("doc", amusoire)).toEqual([]);
  });

  it("nomme la clé attendue par chaque module", () => {
    expect(missingKeysFor("site", coolbeans)).toEqual(["uptimerobot_monitor_ids"]);
    expect(missingKeysFor("doc", coolbeans)).toEqual(["doc"]);
  });

  // Projets et Support ne dépendent plus d'aucun mapping depuis le retrait du
  // sync Asana : leur empty state dit « module à refaire », pas « clé absente ».
  it("ne réclame rien pour les modules sans dépendance au registre", () => {
    expect(missingKeysFor("projets", coolbeans)).toEqual([]);
    expect(missingKeysFor("support", coolbeans)).toEqual([]);
  });

  // Un utilisateur sans client du tout : tout manque, rien ne plante.
  it("réclame tout quand il n'y a pas de client", () => {
    expect(missingKeysFor("site", null)).toEqual(["uptimerobot_monitor_ids"]);
    expect(missingKeysFor("doc", null)).toEqual(["doc"]);
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

// Archiver un client, ce n'est pas le supprimer : sa fiche, sa doc et ses
// instantanés KV restent, et il reste résoluble. Il sort seulement du
// sélecteur, pour que la liste ne s'allonge pas indéfiniment.
describe("clients archivés", () => {
  const ancien: PortalClient = {
    slug: "ancien",
    nom: "Ancien Client",
    doc: "ancien",
    archive: true,
    uptimerobot_monitor_ids: [],
  };
  const avecArchive = [coolbeans, amusoire, ancien];

  it("reste résoluble par son slug", () => {
    expect(getClientIn(avecArchive, "ancien")).toEqual(ancien);
  });

  it("garde l'accès à sa doc", () => {
    expect(findClientByDocIn(avecArchive, "ancien")).toEqual(ancien);
  });

  it("sort du sélecteur", () => {
    expect(selectableClients(avecArchive, null).map((c) => c.slug)).toEqual([
      "coolbeans",
      "amusoire",
    ]);
  });

  // Sinon le <select> afficherait la première option alors qu'on est ailleurs.
  it("reparaît dans le sélecteur quand c'est le client courant", () => {
    expect(selectableClients(avecArchive, ancien).map((c) => c.slug)).toEqual([
      "coolbeans",
      "amusoire",
      "ancien",
    ]);
  });

  it("n'apparaît pas deux fois si le client courant n'est pas archivé", () => {
    expect(selectableClients(avecArchive, amusoire).map((c) => c.slug)).toEqual([
      "coolbeans",
      "amusoire",
    ]);
  });

  it("un client sans champ archive est actif", () => {
    expect(selectableClients([amusoire], null).map((c) => c.slug)).toEqual(["amusoire"]);
  });
});
