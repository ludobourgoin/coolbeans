/* Les sections de projet de la barre latérale du portail (spec 2026-09-30,
 * sous-projet 1) : une section par projet du workspace courant, une entrée par
 * document que le compte lit, libellée par son étape et dans l'ordre de la
 * frise. Le projet au document le plus récent vient en tête.
 */
import { cheminPortail } from "./acces";
import { definitionEtape } from "./etapes";
import { clientDuProjet } from "./nomenclature";
import type { DocumentProjet } from "./projet";

export interface EntreeProjet {
  label: string;
  /** Chemin sous /espace, à passer par portalHref. */
  chemin: string;
}

export interface SectionProjet {
  projet: string;
  titre: string;
  entrees: EntreeProjet[];
}

export function sectionsProjets(
  documents: DocumentProjet[],
  cle: string,
  lisible: (d: DocumentProjet) => boolean,
): SectionProjet[] {
  const parProjet = new Map<string, DocumentProjet[]>();
  for (const d of documents) {
    if (d.versionDe || !d.projet || clientDuProjet(d.projet) !== cle || !lisible(d)) continue;
    parProjet.set(d.projet, [...(parProjet.get(d.projet) ?? []), d]);
  }
  const plusRecent = (docs: DocumentProjet[]) => Math.max(...docs.map((d) => d.date?.getTime() ?? 0));
  return [...parProjet.entries()]
    .sort(([, a], [, b]) => plusRecent(b) - plusRecent(a))
    .map(([projet, docs]) => ({
      projet,
      titre: docs[0].titreProjet ?? projet,
      entrees: docs
        .map((d) => ({ d, def: definitionEtape(d.etape) }))
        .sort((a, b) => a.def.numero - b.def.numero)
        .map(({ d, def }) => ({ label: `${def.numero} · ${def.libelle}`, chemin: cheminPortail(d) })),
    }));
}
