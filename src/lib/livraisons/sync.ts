// Orchestration de la synchronisation Linear vers le calendrier Livraisons.
//
// Les dependances sont injectees pour que le diff se teste sans reseau.
// Un echec sur un evenement isole est compte et n'interrompt pas le reste :
// une milestone au nom pathologique ne doit pas geler tout le calendrier.

import {
  ecrireEvenement,
  idEvenement,
  jetonAcces,
  listerIdsLivraisons,
  supprimerEvenement,
} from "./google-calendar";
import { lireLivraisons, type Livraison } from "./linear-milestones";

export interface ResultatSync {
  crees: number;
  maj: number;
  supprimes: number;
  echecs: number;
}

export interface DepsSync {
  lireLivraisons: () => Promise<Livraison[]>;
  listerIds: () => Promise<string[]>;
  ecrire: (l: Livraison) => Promise<"cree" | "maj">;
  supprimer: (id: string) => Promise<void>;
}

export async function reconcilier(deps: DepsSync): Promise<ResultatSync> {
  const [livraisons, idsExistants] = await Promise.all([deps.lireLivraisons(), deps.listerIds()]);
  const resultat: ResultatSync = { crees: 0, maj: 0, supprimes: 0, echecs: 0 };

  const cibles = new Set<string>();
  for (const l of livraisons) {
    cibles.add(idEvenement(l.milestoneId));
    try {
      const issue = await deps.ecrire(l);
      if (issue === "cree") resultat.crees += 1;
      else resultat.maj += 1;
    } catch {
      resultat.echecs += 1;
    }
  }

  for (const id of idsExistants) {
    if (cibles.has(id)) continue;
    try {
      await deps.supprimer(id);
      resultat.supprimes += 1;
    } catch {
      resultat.echecs += 1;
    }
  }

  return resultat;
}

export async function synchroniserLivraisons(o: {
  apiKey: string;
  email: string;
  clePriveeBase64: string;
  calendarId: string;
}): Promise<ResultatSync> {
  const jeton = await jetonAcces(o.email, o.clePriveeBase64);
  return reconcilier({
    lireLivraisons: () => lireLivraisons(o.apiKey),
    listerIds: () => listerIdsLivraisons(jeton, o.calendarId),
    ecrire: (l) => ecrireEvenement(jeton, o.calendarId, l),
    supprimer: (id) => supprimerEvenement(jeton, o.calendarId, id),
  });
}
