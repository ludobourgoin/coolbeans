// Collecte quotidienne des mesures d'audience (spec 2026-09-29-portail-analytics-design.md §3.2).
//
// Chaque nuit, relit J-1 à J-7 un jour à la fois et les réécrit dans D1.
// Relire la semaine entière rattrape les mesures arrivées en retard et une
// panne de moins de sept jours. Au-delà, Cloudflare n'a plus que des chiffres
// estimés, qui écraseraient nos chiffres exacts : on n'y touche jamais.

import { ecrireJour, lireCollectes, type D1Analytics } from "./store";
import type { SourceAnalytics } from "./types";

/** Jours que Cloudflare garde exacts, donc relus à chaque passage. */
export const JOURS_EXACTS = 7;

/**
 * La collecte prend le second passage du cron de 04:00 UTC (04:05 à 04:09).
 * Le premier passage de chaque heure appartient à la synchronisation
 * Livraisons (src/worker.ts) : les séparer tient chacune loin du plafond de
 * 50 appels par exécution.
 */
export function estHeureDeCollecte(date: Date): boolean {
  const minutes = date.getUTCMinutes();
  return date.getUTCHours() === 4 && minutes >= 5 && minutes < 10;
}

/** J-1 à J-7 (UTC) par rapport à `maintenant`, du plus récent au plus ancien. */
export function joursACollecter(maintenant: Date): string[] {
  const jours: string[] = [];
  for (let i = 1; i <= JOURS_EXACTS; i++) {
    const jour = new Date(
      Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - i),
    );
    jours.push(jour.toISOString().slice(0, 10));
  }
  return jours;
}

export interface ResultatCollecte {
  collectes: string[];
  echecs: Array<{ jour: string; message: string }>;
}

export async function collecterAnalytics(o: {
  db: D1Analytics;
  source: SourceAnalytics;
  maintenant: Date;
}): Promise<ResultatCollecte> {
  const resultat: ResultatCollecte = { collectes: [], echecs: [] };
  const collecteLe = o.maintenant.toISOString();
  // Un jour après l'autre : un échec reste confiné à son jour, et on ne
  // sollicite jamais plus d'une connexion D1 à la fois. Du plus ancien (J-7)
  // au plus récent (J-1) : J-7 sort de la fenêtre au passage suivant et ne
  // sera jamais retenté, donc c'est lui qui doit passer en premier si une
  // interruption coupe la boucle avant la fin.
  for (const jour of [...joursACollecter(o.maintenant)].reverse()) {
    try {
      const sites = (await o.source(jour)).filter((s) => s.jour === jour);
      // Une lecture échantillonnée est une estimation. L'écrire sur un jour
      // encore jamais collecté vaut mieux que rien (elle sera affichée avec
      // sa note « estimé »). L'écrire sur un jour déjà exact l'écraserait
      // par une estimation, ce que l'invariant de la collecte interdit.
      if (sites.some((s) => s.echantillon > 1) && (await lireCollectes(o.db, jour, jour)).length > 0) {
        resultat.echecs.push({
          jour,
          message: "lecture échantillonnée, chiffres précédents conservés",
        });
        continue;
      }
      await ecrireJour(o.db, jour, sites, collecteLe);
      resultat.collectes.push(jour);
    } catch (erreur) {
      resultat.echecs.push({
        jour,
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
  }
  return resultat;
}
