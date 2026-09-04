import type { ModificateursProjet, Reglages } from "./types";

export interface CalcDevis {
  heures: number;
  jours: number;
  plancher: number; // jours × tjm — plancher interne, jamais le prix
  ajusteAffinite: number;
  gestionMontant: number;
  urgenceMontant: number; // exposé : affiché sur la proposition en valeur absolue
  margeMontant: number;
  sousTotalAvantReduction: number;
  reductionMontant: number;
  totalSuggere: number;
  prix: number; // prixRetenu ?? totalSuggere
  tva: number;
  ttc: number;
  net: number;
  tjmEffectif: number | null;
  semaines: number;
}

export function calculerDevis(
  heures: number,
  mods: ModificateursProjet,
  r: Reglages,
): CalcDevis {
  const jours = heures / r.heuresJour;
  const plancher = jours * r.tjm;

  const ajusteAffinite =
    mods.affinite === "envie" ? plancher * (1 - r.affinite.baisse / 100)
    : mods.affinite === "pasenvie" ? plancher * (1 + r.affinite.hausse / 100)
    : plancher;

  const gestionMontant = mods.gestionProjet ? ajusteAffinite * (r.gestionPct / 100) : 0;
  const avantUrgence = ajusteAffinite + gestionMontant;
  const urgenceMontant = mods.urgence ? avantUrgence * (r.urgencePct / 100) : 0;
  const avantMarge = avantUrgence + urgenceMontant;
  const margeMontant = avantMarge * (mods.margePct / 100);
  const sousTotalAvantReduction = avantMarge + margeMontant;

  const reductionMontant = !mods.reduction
    ? 0
    : (mods.reduction.montant ??
      sousTotalAvantReduction * ((mods.reduction.pct ?? 0) / 100));
  const totalSuggere = Math.max(0, sousTotalAvantReduction - reductionMontant);

  const prix = mods.prixRetenu ?? totalSuggere;
  const semaines =
    jours > 0 ? Math.ceil((jours / r.joursSemaine) * 2) / 2 + r.semainesMarge : 0;

  return {
    heures, jours, plancher, ajusteAffinite, gestionMontant, urgenceMontant,
    margeMontant, sousTotalAvantReduction, reductionMontant, totalSuggere,
    prix, tva: prix * 0.2, ttc: prix * 1.2, net: prix * (1 - r.chargesPct / 100),
    tjmEffectif: jours > 0 ? prix / jours : null, semaines,
  };
}
