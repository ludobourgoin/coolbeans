import type { Catalogue, Chiffrage, PageLigne } from "./types";

export interface GestionDetail {
  hebdo: number; cms: number; multilingue: number; hebergement: number; domaine: number;
  jours: number; montant: number;
}

export interface CalcResult {
  joursPages: number[];
  joursDev: number[];
  totalJoursProduction: number;
  sousTotal: number;
  ajusteAffinite: number;
  semainesBase: number;
  semainesTotal: number;
  gestion: GestionDetail;
  sousTotalAvantUrgence: number;
  majorationUrgence: number;
  sousTotalAvantMarge: number;
  margeMontant: number;
  sousTotalAvantReduction: number;
  totalSuggere: number;
  prix: number;
  tva: number; ttc: number; net: number;
  tjmVendu: number | null;
  tjmEffectif: number | null;
}

export const joursPage = (p: PageLigne, cat: Catalogue): number => {
  const base = cat.catalog.design[p.niveau];
  const design =
    p.ux && p.ui ? base
    : p.ux ? (base * cat.catalog.design.portee.ux) / 100
    : p.ui ? (base * cat.catalog.design.portee.ui) / 100
    : 0;
  const integ = p.integ ? cat.catalog.integration[p.niveau] : 0;
  return design + integ;
};

export function calculer(c: Chiffrage, cat: Catalogue): CalcResult {
  const { settings, catalog } = cat;
  const libre = c.mode === "libre";

  const joursPages = c.pages.map((p) => joursPage(p, cat));
  const joursDev = c.devLines.map((l) => catalog.dev[l.level]);
  const joursSetup =
    (c.setupCms ? catalog.setup.cms.jours : 0) +
    (c.setupMultilingue ? catalog.setup.multilingue.jours : 0) +
    (c.setupHebergement ? catalog.setup.hebergement.jours : 0) +
    (c.setupDomaine ? catalog.setup.domaine.jours : 0);

  const totalJoursProduction = libre
    ? c.postes.reduce((s, p) => s + (p.jours || 0), 0)
    : joursPages.reduce((s, j) => s + j, 0) +
      joursDev.reduce((s, j) => s + j, 0) +
      joursSetup +
      c.autres.reduce((s, l) => s + (l.jours || 0), 0);

  const sousTotal = totalJoursProduction * settings.tjm;

  /* Le mode libre s'arrête au prix au TJM cible : pas d'affinité, de gestion,
     d'urgence, de marge ni de réduction (remplacés par « remise assumée »). */
  const ajusteAffinite = libre
    ? sousTotal
    : c.affinite === "envie" ? sousTotal * (1 - catalog.affinite.baisse / 100)
    : c.affinite === "pasenvie" ? sousTotal * (1 + catalog.affinite.hausse / 100)
    : sousTotal;

  const semainesBase =
    totalJoursProduction > 0 ? Math.ceil((totalJoursProduction / settings.joursSemaine) * 2) / 2 : 0;
  const semainesTotal = totalJoursProduction > 0 ? semainesBase + settings.semainesMarge : 0;

  const g = catalog.gestion;
  const hebdo = libre ? 0 : semainesTotal * g.coefHebdo;
  const gCms = !libre && c.setupCms ? g.forfaitCMS : 0;
  const gMulti = !libre && c.setupMultilingue ? g.forfaitMultilingue : 0;
  const gHeberg = !libre && c.setupHebergement ? g.forfaitHebergement : 0;
  const gDomaine = !libre && c.setupDomaine ? g.forfaitDomaine : 0;
  const gestionJours = hebdo + gCms + gMulti + gHeberg + gDomaine;
  const gestionActive = !libre && c.gestionProjet;
  const gestion: GestionDetail = {
    hebdo, cms: gCms, multilingue: gMulti, hebergement: gHeberg, domaine: gDomaine,
    jours: gestionActive ? gestionJours : 0,
    montant: gestionActive ? gestionJours * settings.tjm : 0,
  };

  const sousTotalAvantUrgence = ajusteAffinite + gestion.montant;
  const majorationUrgence =
    !libre && c.urgence ? sousTotalAvantUrgence * (g.urgencePct / 100) : 0;
  const sousTotalAvantMarge = sousTotalAvantUrgence + majorationUrgence;
  const margeMontant = libre ? 0 : sousTotalAvantMarge * (c.margePct / 100);
  const sousTotalAvantReduction = sousTotalAvantMarge + margeMontant;
  const totalSuggere = Math.max(0, sousTotalAvantReduction - (libre ? 0 : c.reductionMontant || 0));

  const prix = c.prixRetenu ?? totalSuggere;
  const tva = prix * 0.2;
  const ttc = prix * 1.2;
  const net = prix * (1 - settings.chargesPct / 100);
  const tjmVendu = totalJoursProduction > 0 ? (prix - margeMontant) / totalJoursProduction : null;
  const tjmEffectif = totalJoursProduction > 0 ? prix / totalJoursProduction : null;

  return {
    joursPages, joursDev, totalJoursProduction, sousTotal, ajusteAffinite,
    semainesBase, semainesTotal, gestion,
    sousTotalAvantUrgence, majorationUrgence, sousTotalAvantMarge,
    margeMontant, sousTotalAvantReduction, totalSuggere,
    prix, tva, ttc, net, tjmVendu, tjmEffectif,
  };
}
