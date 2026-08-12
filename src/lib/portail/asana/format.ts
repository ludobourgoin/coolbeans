// Mise en forme côté client. Pur, donc testable — et surtout : aucun libellé
// en dur dans les composants, pour que « En attente de votre validation » ne
// se fasse pas raccourcir au fil des retouches.

import type { ProjectStatus, TaskStatus } from "./types";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * `due_on` est une DATE, pas un instant : « 2026-08-06 ». La passer par `Date`
 * puis la reformater ferait entrer le fuseau dans l'équation pour rien, avec
 * le décalage d'un jour au bout. Découpage de chaîne, donc.
 */
export function formatDueOn(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, annee, mois, jour] = m;
  return `${Number(jour)} ${MOIS[Number(mois) - 1]} ${annee}`;
}

/**
 * `synced_at` est un INSTANT : il se convertit en heure de Paris (brief §7).
 * Intl s'en charge — les Workers embarquent l'ICU complet.
 *
 * Ce libellé désigne la date du dernier CHANGEMENT, pas de la dernière
 * vérification : c'est la conséquence assumée de l'écriture conditionnelle
 * (corrections §3), et la sémantique la plus juste pour le client.
 */
export function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  }).format(d);
  return `${date} à ${heure}`;
}

/** §6. « En attente de votre validation » : seul statut appelant une action. */
export const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  to_validate: "En attente de votre validation",
  done: "Terminé",
};

/** Variantes du composant Badge existant — pas de nouveau composant de badge. */
export const PROJECT_STATUS: Record<
  ProjectStatus,
  { label: string; variant: "gray" | "blue" | "amber" }
> = {
  ready: { label: "Prêt à démarrer", variant: "blue" },
  in_progress: { label: "En cours", variant: "amber" },
  done: { label: "Terminé", variant: "gray" },
};
