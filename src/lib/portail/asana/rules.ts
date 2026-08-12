// Règles métier du module Projets. Tout est pur : aucune dépendance au réseau,
// à KV ou à Astro. C'est ce qui rend les critères d'acceptation 3, 9, 10, 13,
// 15, 16, 17 et 18 testables directement.

import { COLUMN_ORDER, isHiddenName, mapSection } from "./sections";
import type {
  AsanaProject,
  AsanaTask,
  LogFn,
  ProjectSnapshot,
  ProjectStatus,
  TaskSnapshot,
} from "./types";

/**
 * Nom de la section de la tâche DANS LE PROJET COURANT.
 *
 * Une tâche peut être multi-homée : présente à la fois dans le board client et
 * dans un board interne. Prendre `memberships[0]` exposerait au client le nom
 * d'une colonne interne. On retient donc la membership dont le projet
 * correspond, ce qui règle d'un coup le filtrage réclamé par corrections §2.
 */
export function sectionNameFor(task: AsanaTask, projectGid: string): string | null {
  const m = (task.memberships ?? []).find((m) => m.project?.gid === projectGid);
  return m?.section?.name ?? null;
}

/**
 * Convertit une tâche Asana en entrée de snapshot, ou `null` si elle ne doit
 * pas être exposée. Quatre motifs d'exclusion, dans cet ordre :
 *
 * 1. nom préfixé « . » (§6) — chore interne qui a besoin d'un assigné et d'une
 *    deadline dans Asana sans être montrée au client ;
 * 2. pas d'assigné ou pas de deadline (§6) — les items de backlog non dégrossis
 *    ne remontent jamais ;
 * 3. aucune membership sur le projet courant — anomalie, loggée ;
 * 4. colonne Inbox (§6) — du brouillon, jamais montré.
 *
 * `completed === true` l'emporte sur la colonne (brief §5) : cocher une tâche
 * sans la déplacer suffit à l'afficher « Terminé » (critère 3).
 */
export function toTaskSnapshot(
  task: AsanaTask,
  projectGid: string,
  log: LogFn,
): TaskSnapshot | null {
  if (isHiddenName(task.name)) return null;
  if (!task.assignee?.gid) return null;
  if (!task.due_on) return null;

  const sectionName = sectionNameFor(task, projectGid);
  if (sectionName === null) {
    log({ event: "portal_sync_warning", reason: "task_without_membership", task: task.gid, project: projectGid });
    return null;
  }

  const mapping = mapSection(sectionName);
  if (mapping.kind === "excluded") return null;

  if (mapping.kind === "unknown") {
    log({ event: "portal_sync_warning", reason: "unknown_section", section: sectionName, project: projectGid });
  }

  // Section inconnue → in_progress par défaut, jamais une erreur (brief §5).
  const fromSection = mapping.kind === "status" ? mapping.status : "in_progress";

  return {
    gid: task.gid,
    name: task.name.trim(),
    due_on: task.due_on,
    status: task.completed === true ? "done" : fromSection,
  };
}

/** Un projet archivé ou préfixé « . » ne rentre pas dans le snapshot. */
export function isVisibleProject(project: AsanaProject): boolean {
  return project.archived !== true && !isHiddenName(project.name);
}

/**
 * Statut d'un projet (corrections §1, qui corrige un bug de vacuité du brief).
 *
 * La règle d'origine — « si toutes les tâches non cochées sont en todo → ready »
 * — est vraie par vacuité quand il n'y a aucune tâche non cochée. Elle affichait
 * « Prêt à démarrer » sur un projet entièrement fait, et sur un projet vide.
 * D'où la clause explicite : `restantes` vide → in_progress. On n'annonce jamais
 * « Prêt à démarrer » sur un projet dont on ne peut rien déduire.
 */
export function projectStatus(project: AsanaProject, tasks: TaskSnapshot[]): ProjectStatus {
  if (project.completed === true) return "done";
  const restantes = tasks.filter((t) => t.status !== "done");
  if (restantes.length === 0) return "in_progress";
  return restantes.every((t) => t.status === "todo") ? "ready" : "in_progress";
}

/**
 * Groupe par colonne dans l'ordre d'affichage, en préservant l'ordre du board
 * à l'intérieur de chaque groupe.
 *
 * On groupe par STATUT et non par section : une tâche cochée dans « En cours »
 * a le statut done, elle doit donc apparaître sous « Terminé ». Un tri par
 * comparateur sur l'index de colonne fonctionnerait aussi (Array.sort est
 * stable depuis ES2019), mais le partitionnement dit l'intention sans dépendre
 * de cette garantie.
 */
export function sortTasks(tasks: TaskSnapshot[]): TaskSnapshot[] {
  return COLUMN_ORDER.flatMap((status) => tasks.filter((t) => t.status === status));
}

/**
 * Non terminés d'abord, par `due_on` croissant avec les sans-date en dernier ;
 * les terminés ensuite, selon la même règle (brief §6). Les dates Asana sont
 * en `YYYY-MM-DD` : l'ordre lexicographique est l'ordre chronologique, pas
 * besoin de construire des Date.
 */
export function sortProjects(projects: ProjectSnapshot[]): ProjectSnapshot[] {
  const rang = (p: ProjectSnapshot) => (p.status === "done" ? 1 : 0);
  return [...projects].sort((a, b) => {
    if (rang(a) !== rang(b)) return rang(a) - rang(b);
    if (a.due_on === b.due_on) return 0;
    if (a.due_on === null) return 1;
    if (b.due_on === null) return -1;
    return a.due_on < b.due_on ? -1 : 1;
  });
}
