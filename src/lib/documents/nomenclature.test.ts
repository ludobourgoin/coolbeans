import { expect, test } from "vitest";
import {
  CLIENTS,
  FORME_PROJET,
  HORS_NOMENCLATURE,
  PROJETS,
  clientDuProjet,
  linearDuProjet,
  projetDuLinear,
  verifierCles,
  verifierLiensLinear,
  workspaceDuLinear,
  workspaceDuProjet,
} from "./nomenclature";

test("chaque projet a la forme nom-court-123", () => {
  for (const projet of Object.keys(PROJETS)) expect(projet).toMatch(FORME_PROJET);
});

test("chaque projet appartient à un client de la table", () => {
  for (const { client } of Object.values(PROJETS)) expect(Object.keys(CLIENTS)).toContain(client);
});

test("chaque clé client fait trois lettres minuscules, comme la clé de team Linear", () => {
  for (const cle of Object.keys(CLIENTS)) expect(cle).toMatch(/^[a-z]{3}$/);
});

test("aucun client de la table n'est sans projet", () => {
  const servis = new Set(Object.values(PROJETS).map((p) => p.client));
  for (const cle of Object.keys(CLIENTS)) expect(servis.has(cle as never)).toBe(true);
});

test("le client d'un projet se lit dans la table, jamais dans un nom de dossier", () => {
  expect(clientDuProjet("site-web-879")).toBe("caf");
  expect(clientDuProjet("osmose-281")).toBe("set");
  expect(clientDuProjet("serial-generations-618")).toBe("uni");
});

test("un projet inconnu n'a pas de client, même s'il porte un nom de propriété d'objet", () => {
  expect(clientDuProjet("inconnu-000")).toBeUndefined();
  expect(clientDuProjet("toString")).toBeUndefined();
  expect(clientDuProjet("__proto__")).toBeUndefined();
});

test("les documents hors nomenclature se désignent par collection et id", () => {
  for (const cle of HORS_NOMENCLATURE) expect(cle).toMatch(/^(cadrage|devis|livrable|temoignage)\//);
});

test("la clé d'une fiche client doit exister dans la nomenclature", () => {
  expect(verifierCles([{ slug: "cafa", cle: "caf" }])).toEqual([]);
  expect(verifierCles([{ slug: "inconnu", cle: "zzz" }])).toEqual([
    "clients/inconnu : clé « zzz » absente de la nomenclature",
  ]);
});

test("une clé ne sert qu'un workspace", () => {
  expect(verifierCles([{ slug: "cafa", cle: "caf" }, { slug: "cafa-bis", cle: "caf" }])).toEqual([
    "clé « caf » portée par deux workspaces (cafa, cafa-bis)",
  ]);
});

test("un workspace sans clé n'est pas une erreur", () => {
  expect(verifierCles([{ slug: "coolbeans" }, { slug: "spinoza" }])).toEqual([]);
});

test("le workspace d'un projet se trouve par la clé de son client", () => {
  const ws = [{ slug: "cafa", cle: "caf" }, { slug: "coolbeans" }];
  expect(workspaceDuProjet(ws, "site-web-879")?.slug).toBe("cafa");
  // unl existe dans la nomenclature, mais aucun workspace de ce jeu ne porte sa clé.
  expect(workspaceDuProjet(ws, "plateforme-327")).toBeUndefined();
  expect(workspaceDuProjet(ws, "inconnu-000")).toBeUndefined();
});

test("chaque projet de la table est relié à un projet Linear distinct", () => {
  expect(verifierLiensLinear()).toEqual([]);
});

test("un identifiant Linear mal formé arrête le build", () => {
  expect(verifierLiensLinear({ "a-001": { client: "caf", linear: "E6C1" } })).toEqual([
    "projet a-001 : identifiant Linear « E6C1 » mal formé",
  ]);
});

test("un identifiant Linear partagé par deux projets arrête le build", () => {
  expect(
    verifierLiensLinear({
      "a-001": { client: "caf", linear: "e6c1e495a56f" },
      "b-002": { client: "caf", linear: "e6c1e495a56f" },
    }),
  ).toEqual(["identifiant Linear « e6c1e495a56f » porté par deux projets (a-001, b-002)"]);
});

test("un projet se retrouve par son identifiant Linear, et l'inverse", () => {
  expect(linearDuProjet("salon-533")).toBe("e6c1e495a56f");
  expect(projetDuLinear("e6c1e495a56f")).toBe("salon-533");
  expect(projetDuLinear("000000000000")).toBeUndefined();
  expect(linearDuProjet("toString")).toBeUndefined();
});

test("le workspace d'un projet Linear se trouve par la table", () => {
  const ws = [{ slug: "revolutions-douces", cle: "rev" }, { slug: "coolbeans" }];
  expect(workspaceDuLinear(ws, "e6c1e495a56f")?.slug).toBe("revolutions-douces");
  // Le site de l'association n'a aucun document : il n'est pas dans la table.
  expect(workspaceDuLinear(ws, "9a42140d4288")).toBeUndefined();
});
