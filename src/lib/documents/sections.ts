/* Les sections que la nav d'un document liste, dans l'ordre où la page les
 * affiche. Chaque fonction suit les conditions de rendu de son gabarit : un
 * lien vers une section absente ne mènerait nulle part. Les ancres viennent
 * d'`ancreSection`, celle que les composants posent en `id`.
 */
import { ancreSection } from "../devis";

export interface SectionNav {
  titre: string;
  ancre: string;
}

const section = (titre: string, version?: number): SectionNav => ({ titre, ancre: ancreSection(titre, version) });

/** Proposition : `version` n'est passée que s'il y a plusieurs versions, comme à DevisCorps. */
export const sectionsDevis = (d: { sections: { titre: string }[] }, version?: number): SectionNav[] =>
  d.sections.map((s) => section(s.titre, version));

export const sectionsCadrage = (d: {
  intro: { titre: string }[];
  comparatif?: { titre: string; simulateur?: { titre: string } };
}): SectionNav[] => [
  ...d.intro.map((s) => section(s.titre)),
  ...(d.comparatif ? [section(d.comparatif.titre)] : []),
  ...(d.comparatif?.simulateur ? [section(d.comparatif.simulateur.titre)] : []),
];

export const sectionsLivrable = (d: {
  sections: { titre: string }[];
  parcours: unknown[];
  parcoursTitre: string;
  message?: { titre: string };
  aVerifier: unknown[];
  aVerifierTitre: string;
  suite: unknown[];
  suiteTitre: string;
}): SectionNav[] => [
  ...d.sections.map((s) => section(s.titre)),
  ...(d.parcours.length > 0 ? [section(d.parcoursTitre)] : []),
  ...(d.message ? [section(d.message.titre)] : []),
  ...(d.aVerifier.length > 0 ? [section(d.aVerifierTitre)] : []),
  ...(d.suite.length > 0 ? [section(d.suiteTitre)] : []),
];

export const sectionsTemoignage = (d: { intro: { titre: string }[]; casClient?: { titre: string } }): SectionNav[] => [
  ...d.intro.map((s) => section(s.titre)),
  ...(d.casClient ? [section(d.casClient.titre)] : []),
];
