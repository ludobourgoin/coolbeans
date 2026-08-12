// Formes échangées par le sync du module Projets.
//
// Deux familles à ne pas confondre :
// - `Asana*` : ce que renvoie l'API, donc tout est optionnel. Les opt_fields
//   demandés peuvent manquer d'une réponse à l'autre, et une forme inattendue
//   ne doit jamais faire planter le sync (brief §5, « Robustesse »).
// - `*Snapshot` : ce qu'on écrit dans KV, donc tout est garanti. `due_on` d'une
//   tâche y est une string non nulle : le filtre de visibilité du §6 écarte
//   déjà les tâches sans deadline.

export type TaskStatus = "todo" | "in_progress" | "to_validate" | "done";
export type ProjectStatus = "ready" | "in_progress" | "done";

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string | null;
  due_on?: string | null;
  completed?: boolean;
  archived?: boolean;
}

export interface AsanaMembership {
  project?: { gid?: string } | null;
  section?: { name?: string } | null;
}

export interface AsanaTask {
  gid: string;
  name: string;
  due_on?: string | null;
  completed?: boolean;
  assignee?: { gid: string } | null;
  memberships?: AsanaMembership[];
}

export interface TaskSnapshot {
  gid: string;
  name: string;
  due_on: string;
  status: TaskStatus;
}

export interface ProjectSnapshot {
  gid: string;
  name: string;
  /** Portion publique de `notes` (corrections §4, option A). `""` si rien d'exposable. */
  description: string;
  due_on: string | null;
  status: ProjectStatus;
  tasks: TaskSnapshot[];
}

/**
 * Le snapshot SANS `synced_at` : c'est cette forme-là qui est hachée
 * (corrections §3, étape 1). Y inclure l'horodatage rendrait tout hash
 * différent à chaque passage, ce qui annulerait l'écriture conditionnelle.
 */
export interface TeamSnapshotBody {
  schema_version: 1;
  team_gid: string;
  projects: ProjectSnapshot[];
}

/** Ce qui est réellement écrit sous `team:{gid}`. */
export interface TeamSnapshot extends TeamSnapshotBody {
  synced_at: string;
}

/** Écrit sous `meta:last_sync`. JAMAIS exposé au client (corrections §3). */
export interface SyncReport {
  at: string;
  teams: number;
  teams_ok: number;
  teams_failed: number;
  projects: number;
  tasks: number;
  snapshots_written: number;
  /** Le compteur qui dit quand découper en tranches : cf. le plan, seuil 120. */
  asana_requests: number;
  subrequests: number;
  duration_ms: number;
  errors: { team_gid: string; message: string }[];
}

/** Journalisation structurée. `console.log` suffit (brief §5). */
export type LogFn = (entry: Record<string, unknown>) => void;
