import { describe, expect, it } from "vitest";
import { calculerDevis } from "./calc";
import { MODIFICATEURS_DEFAUT, REGLAGES_DEFAUT } from "./defaults";

const r = REGLAGES_DEFAUT; // tjm 600, heuresJour 7
const base = (over = {}) => ({ ...MODIFICATEURS_DEFAUT, ...over });

describe("calculerDevis", () => {
  it("plancher = heures/7 × tjm", () => {
    const c = calculerDevis(35, base(), r); // 5 jours
    expect(c.jours).toBe(5);
    expect(c.plancher).toBe(3000);
    expect(c.totalSuggere).toBe(3000);
  });
  it("affinité envie −20 %, pasenvie +20 %", () => {
    expect(calculerDevis(35, base({ affinite: "envie" }), r).totalSuggere).toBe(2400);
    expect(calculerDevis(35, base({ affinite: "pasenvie" }), r).totalSuggere).toBe(3600);
  });
  it("gestion de projet : +15 % du total, pas hebdo", () => {
    const c = calculerDevis(35, base({ gestionProjet: true }), r);
    expect(c.gestionMontant).toBe(450); // 3000 × 15 %
    expect(c.totalSuggere).toBe(3450);
  });
  it("urgence : +20 % exposé en valeur absolue", () => {
    const c = calculerDevis(35, base({ urgence: true }), r);
    expect(c.urgenceMontant).toBe(600);
    expect(c.totalSuggere).toBe(3600);
  });
  it("ordre : affinité → gestion → urgence → marge → réduction", () => {
    const c = calculerDevis(
      35,
      base({ affinite: "envie", gestionProjet: true, urgence: true, margePct: 10,
        reduction: { nom: "Tarif association", pct: 20 } }),
      r,
    );
    // 3000 → 2400 → +360 gestion → +552 urgence → 3312 → +331.2 marge
    // → 3643.2 → −728.64 réduction → 2914.56
    expect(c.totalSuggere).toBeCloseTo(2914.56, 2);
  });
  it("réduction en € prioritaire sur le %", () => {
    const c = calculerDevis(35, base({ reduction: { nom: "Geste", montant: 500, pct: 99 } }), r);
    expect(c.reductionMontant).toBe(500);
  });
  it("prixRetenu écrase le total suggéré", () => {
    expect(calculerDevis(35, base({ prixRetenu: 2800 }), r).prix).toBe(2800);
  });
  it("semaines de planning : jours/joursSemaine arrondi au demi + marge", () => {
    expect(calculerDevis(35, base(), r).semaines).toBe(3); // ceil(5/3×2)/2=2 +1
  });
});
