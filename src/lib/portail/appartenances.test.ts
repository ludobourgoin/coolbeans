import { describe, expect, it } from "vitest";
import { workspacesVisibles } from "./appartenances";
import type { PortalWorkspace } from "./workspaces";
import type { PortalMetadata } from "./metadata";

const w = (slug: string, organisation: string): PortalWorkspace =>
  ({
    slug,
    nom: slug,
    organisation,
    uptimerobot_monitor_ids: [],
    archive: false,
  }) as PortalWorkspace;

const REGISTRE = [
  w("amusoire", "trigger"),
  w("trigger", "trigger"), // une organisation peut etre sa propre cliente
  w("fylgo", "coolbeans"),
  w("coolbeans", "coolbeans"),
];

const meta = (o: Partial<PortalMetadata>): PortalMetadata => ({
  role: "client",
  organisation: null,
  workspace: null,
  ...o,
});

describe("workspacesVisibles", () => {
  it("un admin voit tout le registre", () => {
    expect(workspacesVisibles(REGISTRE, meta({ role: "admin" }))).toHaveLength(4);
  });

  it("un admin voit tout même sans organisation à lui", () => {
    expect(workspacesVisibles(REGISTRE, meta({ role: "admin", organisation: null }))).toHaveLength(4);
  });

  it("un revendeur voit toutes les teams de son organisation, et elles seules", () => {
    const vus = workspacesVisibles(REGISTRE, meta({ role: "revendeur", organisation: "trigger" }));
    expect(vus.map((x) => x.slug).sort()).toEqual(["amusoire", "trigger"]);
  });

  // C'est la raison d'etre des deux niveaux : un client ajoute a Trigger apres
  // l'invitation de Baptiste doit apparaitre sans nouvelle invitation.
  it("un revendeur voit une team ajoutée après son invitation", () => {
    const avec = [...REGISTRE, w("nouveau", "trigger")];
    expect(workspacesVisibles(avec, meta({ role: "revendeur", organisation: "trigger" }))).toHaveLength(3);
  });

  it("un client ne voit que sa team", () => {
    const vus = workspacesVisibles(
      REGISTRE,
      meta({ role: "client", organisation: "trigger", workspace: "amusoire" }),
    );
    expect(vus.map((x) => x.slug)).toEqual(["amusoire"]);
  });

  it("un client ne voit pas la team voisine de sa propre organisation", () => {
    const vus = workspacesVisibles(
      REGISTRE,
      meta({ role: "client", organisation: "trigger", workspace: "amusoire" }),
    );
    expect(vus.map((x) => x.slug)).not.toContain("trigger");
  });

  it("un revendeur sans organisation ne voit rien", () => {
    expect(workspacesVisibles(REGISTRE, meta({ role: "revendeur" }))).toEqual([]);
  });

  it("un client sans organisation ne voit rien, même avec un workspace", () => {
    expect(workspacesVisibles(REGISTRE, meta({ role: "client", workspace: "amusoire" }))).toEqual([]);
  });

  // Appartenance incoherente : le workspace n'est pas dans l'organisation
  // declaree. Ne rien ouvrir vaut mieux qu'ouvrir une team au hasard.
  it("un client dont le workspace ne relève pas de son organisation ne voit rien", () => {
    const vus = workspacesVisibles(
      REGISTRE,
      meta({ role: "client", organisation: "coolbeans", workspace: "amusoire" }),
    );
    expect(vus).toEqual([]);
  });
});
