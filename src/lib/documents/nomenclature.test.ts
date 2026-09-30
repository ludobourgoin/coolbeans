import { expect, test } from "vitest";
import { CLIENTS, FORME_PROJET, HORS_NOMENCLATURE, PROJETS, clientDuProjet } from "./nomenclature";

test("chaque projet a la forme nom-court-123", () => {
  for (const projet of Object.keys(PROJETS)) expect(projet).toMatch(FORME_PROJET);
});

test("chaque projet appartient à un client de la table", () => {
  for (const cle of Object.values(PROJETS)) expect(Object.keys(CLIENTS)).toContain(cle);
});

test("chaque clé client fait trois lettres minuscules, comme la clé de team Linear", () => {
  for (const cle of Object.keys(CLIENTS)) expect(cle).toMatch(/^[a-z]{3}$/);
});

test("aucun client de la table n'est sans projet", () => {
  const servis = new Set(Object.values(PROJETS));
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
