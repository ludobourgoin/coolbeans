import { describe, expect, it } from "vitest";
import { parseBlocChiffrage } from "./blocChiffrage";

const BLOC = `Description du projet…

## Chiffrage
- Contact : Suzanne Salerno <salerno@ms-associes.com> (copie : anja@booxdesign.com)
- Segment : association
- Affinité : envie
- Gestion de projet : non
- Urgence : oui
- Marge : 10
- Réduction : Tarif association · 20%
- Prix cible / budget lead : ~2000 € (annoncé à l'oral)
- Échéancier : 30/40/30
- Validité : 30 jours
- Notes : bilingue en option
`;

describe("parseBlocChiffrage", () => {
  it("parse un bloc complet", () => {
    const b = parseBlocChiffrage(BLOC);
    expect(b.present).toBe(true);
    expect(b.contact).toEqual({
      nom: "Suzanne Salerno",
      email: "salerno@ms-associes.com",
      copies: ["anja@booxdesign.com"],
    });
    expect(b.mods.segment).toBe("association");
    expect(b.mods.affinite).toBe("envie");
    expect(b.mods.gestionProjet).toBe(false);
    expect(b.mods.urgence).toBe(true);
    expect(b.mods.margePct).toBe(10);
    expect(b.mods.reduction).toEqual({ nom: "Tarif association", pct: 20 });
    expect(b.prixCible).toBe("~2000 € (annoncé à l'oral)");
  });
  it("réduction en euros", () => {
    const b = parseBlocChiffrage("## Chiffrage\n- Réduction : Geste commercial · 150 €");
    expect(b.mods.reduction).toEqual({ nom: "Geste commercial", montant: 150 });
  });
  it("bloc absent → present false et défauts", () => {
    const b = parseBlocChiffrage("Un projet sans bloc.");
    expect(b.present).toBe(false);
    expect(b.mods.affinite).toBe("neutre");
    expect(b.contact.email).toBeNull();
  });
  it("puces `*` (resérialisation markdown de Linear) parsées comme les `-`", () => {
    const b = parseBlocChiffrage(BLOC.replace(/^- /gm, "* "));
    expect(b.present).toBe(true);
    expect(b.mods.affinite).toBe("envie");
    expect(b.mods.reduction).toEqual({ nom: "Tarif association", pct: 20 });
    expect(b.contact.email).toBe("salerno@ms-associes.com");
  });

  it("fins de ligne CRLF (Windows/Outlook) parsées comme LF", () => {
    const b = parseBlocChiffrage(BLOC.replace(/\n/g, "\r\n"));
    expect(b.present).toBe(true);
    expect(b.mods.affinite).toBe("envie");
    expect(b.mods.margePct).toBe(10);
    expect(b.contact.email).toBe("salerno@ms-associes.com");
  });

  it("champs vides tolérés", () => {
    const b = parseBlocChiffrage("## Chiffrage\n- Segment :\n- Marge : ");
    expect(b.present).toBe(true);
    expect(b.mods.segment).toBe("tpe");
    expect(b.mods.margePct).toBe(0);
  });
});
