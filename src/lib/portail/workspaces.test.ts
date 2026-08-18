import { describe, expect, it, test } from "vitest";
import {
  DEFAULT_WORKSPACE,
  findWorkspaceByDocIn,
  getWorkspaceIn,
  MODULE_REQUIREMENTS,
  missingKeysFor,
  selectableWorkspaces,
  sortWorkspaces,
  type PortalWorkspace,
} from "./workspaces";

const coolbeans: PortalWorkspace = {
  slug: "coolbeans",
  nom: "Coolbeans",
  perso: true,
  archive: false,
  uptimerobot_monitor_ids: [],
};
const spinoza: PortalWorkspace = {
  slug: "spinoza",
  nom: "Spinoza",
  perso: true,
  archive: false,
  uptimerobot_monitor_ids: [],
};
const amusoire: PortalWorkspace = {
  slug: "amusoire",
  nom: "Amusoire",
  doc: "amusoire",
  emoji: "🎮",
  depuis: "2026-08-12",
  uptimerobot_monitor_ids: [],
  archive: false,
};
const zebre: PortalWorkspace = {
  slug: "zebre",
  nom: "Zèbre",
  depuis: "2026-05-01",
  archive: false,
  uptimerobot_monitor_ids: [],
};
const tous = [zebre, amusoire, spinoza, coolbeans];

describe("sortWorkspaces", () => {
  // Le sélecteur est un sélecteur de workspace : les miens d'abord
  // (Coolbeans puis les autres persos), puis les clients par ancienneté.
  it("place les workspaces perso en tête, Coolbeans premier", () => {
    expect(sortWorkspaces(tous).map((c) => c.slug)).toEqual([
      "coolbeans",
      "spinoza",
      "zebre",
      "amusoire",
    ]);
  });

  it("trie les clients par date `depuis` croissante", () => {
    expect(sortWorkspaces([amusoire, zebre]).map((c) => c.slug)).toEqual(["zebre", "amusoire"]);
  });

  it("relègue un client sans `depuis` en fin de liste, trié par nom", () => {
    const sansDate: PortalWorkspace = {
      slug: "sans-date",
      nom: "Sans Date",
      archive: false,
      uptimerobot_monitor_ids: [],
    };
    expect(sortWorkspaces([sansDate, amusoire, zebre]).map((c) => c.slug)).toEqual([
      "zebre",
      "amusoire",
      "sans-date",
    ]);
  });

  it("ne plante pas si Coolbeans est absent", () => {
    expect(sortWorkspaces([zebre, amusoire]).map((c) => c.slug)).toEqual(["zebre", "amusoire"]);
  });
});

describe("getWorkspaceIn", () => {
  it("retrouve un client par son slug", () => {
    expect(getWorkspaceIn(tous, "amusoire")).toEqual(amusoire);
  });

  it("renvoie null sur un slug inconnu, vide ou absent", () => {
    for (const s of ["inconnu", "", null, undefined]) {
      expect(getWorkspaceIn(tous, s)).toBeNull();
    }
  });
});

describe("findWorkspaceByDocIn", () => {
  it("retrouve le client propriétaire d'une doc", () => {
    expect(findWorkspaceByDocIn(tous, "amusoire")).toEqual(amusoire);
  });

  // _template n'appartient à aucun client : aucune bascule de contexte.
  it("renvoie null pour une doc que personne ne revendique", () => {
    expect(findWorkspaceByDocIn(tous, "_template")).toBeNull();
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

  // Projets ne dépend plus d'aucun mapping depuis le retrait du sync Asana :
  // son empty state dit « module à refaire », pas « clé absente ».
  it("ne réclame rien pour les modules sans dépendance au registre", () => {
    expect(missingKeysFor("projets", coolbeans)).toEqual([]);
  });

  // Support crée ses tickets dans la team Linear du client, et la messagerie
  // dans son projet Support (COO-30).
  it("réclame la team Linear pour le support", () => {
    expect(missingKeysFor("support", coolbeans)).toEqual([
      "linearTeamId",
      "linearSupportProjectId",
    ]);
    expect(
      missingKeysFor("support", {
        ...coolbeans,
        linearTeamId: "uuid",
        linearSupportProjectId: "uuid-projet",
      }),
    ).toEqual([]);
  });

  // La messagerie a aussi besoin du projet Support Linear où créer ses tickets.
  test("le module support exige la team ET le projet Support Linear", () => {
    expect(MODULE_REQUIREMENTS.support).toEqual(["linearTeamId", "linearSupportProjectId"]);
  });

  // Un utilisateur sans client du tout : tout manque, rien ne plante.
  it("réclame tout quand il n'y a pas de client", () => {
    expect(missingKeysFor("site", null)).toEqual(["uptimerobot_monitor_ids"]);
    expect(missingKeysFor("doc", null)).toEqual(["doc"]);
    expect(missingKeysFor("support", null)).toEqual(["linearTeamId", "linearSupportProjectId"]);
  });

  it("traite un tableau de monitors vide comme une clé manquante", () => {
    expect(missingKeysFor("site", amusoire)).toEqual(["uptimerobot_monitor_ids"]);
  });
});

describe("DEFAULT_WORKSPACE", () => {
  it("vaut coolbeans", () => {
    expect(DEFAULT_WORKSPACE).toBe("coolbeans");
  });
});

// Archiver un client, ce n'est pas le supprimer : sa fiche, sa doc et ses
// instantanés KV restent, et il reste résoluble. Il sort seulement du
// sélecteur, pour que la liste ne s'allonge pas indéfiniment.
describe("clients archivés", () => {
  const ancien: PortalWorkspace = {
    slug: "ancien",
    nom: "Ancien Client",
    doc: "ancien",
    archive: true,
    uptimerobot_monitor_ids: [],
  };
  const avecArchive = [coolbeans, amusoire, ancien];

  it("reste résoluble par son slug", () => {
    expect(getWorkspaceIn(avecArchive, "ancien")).toEqual(ancien);
  });

  it("garde l'accès à sa doc", () => {
    expect(findWorkspaceByDocIn(avecArchive, "ancien")).toEqual(ancien);
  });

  it("sort du sélecteur", () => {
    expect(selectableWorkspaces(avecArchive, null).map((c) => c.slug)).toEqual([
      "coolbeans",
      "amusoire",
    ]);
  });

  // Sinon le <select> afficherait la première option alors qu'on est ailleurs.
  it("reparaît dans le sélecteur quand c'est le client courant", () => {
    expect(selectableWorkspaces(avecArchive, ancien).map((c) => c.slug)).toEqual([
      "coolbeans",
      "amusoire",
      "ancien",
    ]);
  });

  it("n'apparaît pas deux fois si le client courant n'est pas archivé", () => {
    expect(selectableWorkspaces(avecArchive, amusoire).map((c) => c.slug)).toEqual([
      "coolbeans",
      "amusoire",
    ]);
  });

  it("un client sans champ archive est actif", () => {
    expect(selectableWorkspaces([amusoire], null).map((c) => c.slug)).toEqual(["amusoire"]);
  });
});
