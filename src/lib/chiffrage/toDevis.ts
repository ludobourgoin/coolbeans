import type { Catalogue, Chiffrage } from "./types";
import type { CalcResult } from "./calc";
import { fmtJ } from "./format";

export interface SnapshotBudget { lignes: { label: string; prix?: number }[]; mention?: string; reglement?: string }
export interface SnapshotSection { titre: string; texte?: string; liste?: string[]; budget?: SnapshotBudget }
export interface DevisSnapshotData {
  titre: string;
  objet: string;
  date: string;
  sections: SnapshotSection[];
  notes: never[];
}

const lignesDe = (bloc: string) => bloc.split("\n").map((s) => s.trim()).filter(Boolean);

/* Construit le snapshot client au format de la collection `devis` (rendu par
   DevisCorps). Règles non négociables : aucun jour, aucun prix par ligne,
   sections vides omises, langage orienté résultat client. */
export function toDevis(c: Chiffrage, cat: Catalogue, calc: CalcResult, publishedAt: string): DevisSnapshotData {
  if (c.mode !== "configurateur") throw new Error("Seul le mode configurateur est publiable.");
  if (c.prixRetenu == null) throw new Error("Prix retenu manquant.");

  const t = cat.catalog.devisTexts;
  const sections: SnapshotSection[] = [];

  const pagesLabels = c.pages
    .filter((_, i) => calc.joursPages[i] > 0)
    .map((p) => p.label.trim() || "Page sans nom");
  if (pagesLabels.length) sections.push({ titre: "Pages", liste: pagesLabels });

  const fonctions = [
    ...c.devLines.map((l) => l.label.trim() || "Développement sans nom"),
    ...c.autres.filter((l) => l.jours > 0).map((l) => l.label.trim() || "Ligne sans nom"),
  ];
  if (fonctions.length) sections.push({ titre: "Fonctionnalités", liste: fonctions });

  if (pagesLabels.length && t.stackTechnique.trim())
    sections.push({ titre: "Stack technique", texte: t.stackTechnique });

  sections.push({
    titre: "Budget",
    budget: {
      lignes: [{ label: "Forfait global de la prestation", prix: c.prixRetenu }],
      mention: "HT",
      reglement: t.conditionsReglement,
    },
  });

  const comprend = [
    ...lignesDe(t.ceQueCaComprend),
    ...(c.setupCms ? [cat.catalog.setup.cms.clientLabel] : []),
    ...(c.setupMultilingue ? [cat.catalog.setup.multilingue.clientLabel] : []),
    ...(c.setupHebergement ? [cat.catalog.setup.hebergement.clientLabel] : []),
    ...(c.setupDomaine ? [cat.catalog.setup.domaine.clientLabel] : []),
    ...(c.gestionProjet
      ? ["Suivi de projet : points hebdomadaires jusqu'à la livraison, comptes-rendus, planning à jour"]
      : []),
  ];
  if (comprend.length) sections.push({ titre: "Ce que ça comprend", liste: comprend });

  if (calc.totalJoursProduction > 0)
    sections.push({
      titre: "Planning",
      texte: `Livraison estimée à ${fmtJ(calc.semainesTotal)} semaines à réception de l'acompte.`,
    });

  const hors = [
    ...lignesDe(t.horsPerimetre),
    ...c.pages.flatMap((p, i) => {
      if (calc.joursPages[i] <= 0) return [];
      const label = p.label.trim() || "cette page";
      if (p.ux && !p.ui) return [`Le design UI de la page « ${label} » (fourni par un tiers)`];
      if (p.ui && !p.ux) return [`Les wireframes de la page « ${label} » (fournis par un tiers)`];
      return [];
    }),
  ];
  if (hors.length) sections.push({ titre: "Hors périmètre", liste: hors });

  return { titre: c.nom, objet: c.objectif, date: publishedAt, sections, notes: [] };
}
