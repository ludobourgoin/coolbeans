import { describe, expect, it } from "vitest";
import { numeroAffaire, trouverEtat, type EtatCrm } from "./linear-crm";

describe("numeroAffaire", () => {
  it("accepte l'identifiant court des premiers devis", () => {
    expect(numeroAffaire("CRM-9")).toBe(9);
    expect(numeroAffaire("CRM-74")).toBe(74);
  });

  it("accepte l'URL complète, la forme collée depuis Linear aujourd'hui", () => {
    expect(numeroAffaire("https://linear.app/coolbeans-hq/issue/CRM-26")).toBe(26);
    /* Linear ajoute parfois un slug de titre après l'identifiant. */
    expect(numeroAffaire("https://linear.app/coolbeans-hq/issue/CRM-46/site-du-salon")).toBe(46);
  });

  it("rend null sur ce qui n'est pas une affaire du pipeline", () => {
    expect(numeroAffaire(undefined)).toBeNull();
    expect(numeroAffaire(null)).toBeNull();
    expect(numeroAffaire("")).toBeNull();
    expect(numeroAffaire("à créer")).toBeNull();
    /* Une issue d'une team client n'est pas une affaire CRM : c'est une
       erreur de saisie, et l'afficher comme un statut de pipeline serait pire
       que de ne rien afficher. */
    expect(numeroAffaire("https://linear.app/coolbeans-hq/issue/AMU-3")).toBeNull();
    expect(numeroAffaire("CRM-0")).toBeNull();
  });
});

describe("trouverEtat", () => {
  const etats: EtatCrm[] = [
    { id: "a", name: "📥 Triage lead", type: "backlog", position: 0 },
    { id: "b", name: "📝 Devis envoyé", type: "started", position: 1000 },
    { id: "c", name: "Todo", type: "unstarted", position: 2000 },
    { id: "d", name: "🏆 Signée", type: "started", position: 5500 },
  ];

  it("ignore l'emoji et les accents : c'est le mot qui identifie l'état", () => {
    expect(trouverEtat(etats, "Signée")?.id).toBe("d");
    expect(trouverEtat(etats, "signee")?.id).toBe("d");
    expect(trouverEtat(etats, "Todo")?.id).toBe("c");
    expect(trouverEtat(etats, "Devis envoyé")?.id).toBe("b");
  });

  it("rend undefined si l'état n'existe plus dans le pipeline", () => {
    /* Le pipeline a déjà été refondu une fois (17 états ramenés à 13). Un
       renommage doit se voir comme un état introuvable, pas comme un faux
       positif sur l'état voisin. */
    expect(trouverEtat(etats, "Gagnée")).toBeUndefined();
  });
});
