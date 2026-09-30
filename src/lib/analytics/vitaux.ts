// Note des Core Web Vitals (spec 2026-09-30-portail-core-web-vitals-design.md §4).
//
// Fonctions pures. Les compteurs s'additionnent sur toute période, les
// percentiles non : la note se calcule donc à partir des compteurs. « Au moins
// 75 % de mesures bonnes » équivaut à « p75 sous le seuil bon », c'est la
// règle de Google.

import {
  METRIQUES,
  type Appareil,
  type Compteurs,
  type Metrique,
  type VitauxAppareil,
} from "./types";

/** Sous ce nombre de mesures sur la période, aucune note n'est donnée. */
export const MESURES_MIN = 20;

export type Note = "bon" | "moyen" | "mauvais";

export interface Evaluation {
  /** null sous MESURES_MIN mesures. */
  note: Note | null;
  mesures: number;
  /** Part des mesures bonnes, entre 0 et 1 (0 sans mesure). */
  partBonne: number;
}

export interface VitesseMetrique {
  global: Evaluation;
  mobile: Evaluation;
  ordinateur: Evaluation;
}

export type Vitesse = Record<Metrique, VitesseMetrique>;

export function noter(c: Compteurs): Evaluation {
  const mesures = c.bon + c.moyen + c.mauvais;
  const partBonne = mesures === 0 ? 0 : c.bon / mesures;
  if (mesures < MESURES_MIN) return { note: null, mesures, partBonne };
  // En entiers : 15 sur 20 font exactement 75 %, sans arrondi flottant.
  const note: Note =
    c.bon * 4 >= mesures * 3 ? "bon" : (c.bon + c.moyen) * 4 >= mesures * 3 ? "moyen" : "mauvais";
  return { note, mesures, partBonne };
}

function sommer(lignes: VitauxAppareil[], m: Metrique): Compteurs {
  return lignes.reduce(
    (total, l) => ({
      bon: total.bon + l[m].bon,
      moyen: total.moyen + l[m].moyen,
      mauvais: total.mauvais + l[m].mauvais,
    }),
    { bon: 0, moyen: 0, mauvais: 0 },
  );
}

/**
 * Le global somme tous les appareils. Mobile et ordinateur se notent à part,
 * comme chez Google. Tablette et « autre » ne comptent que dans le global.
 */
export function construireVitesse(lignes: VitauxAppareil[]): Vitesse | null {
  const de = (appareil: Appareil) => lignes.filter((l) => l.appareil === appareil);
  const vitesse = {} as Vitesse;
  let mesures = 0;
  for (const m of METRIQUES) {
    const global = noter(sommer(lignes, m));
    mesures += global.mesures;
    vitesse[m] = {
      global,
      mobile: noter(sommer(de("mobile"), m)),
      ordinateur: noter(sommer(de("desktop"), m)),
    };
  }
  return mesures === 0 ? null : vitesse;
}
