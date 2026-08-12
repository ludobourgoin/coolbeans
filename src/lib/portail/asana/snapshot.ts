// Assemblage du snapshot d'une team, et son empreinte.
//
// Le snapshot est un MIROIR, pas un outil : il ne contient que ce que le
// client doit voir. Le brief §5 interdit explicitement d'y faire entrer les
// assignees, les commentaires, les custom fields et les memberships d'autres
// projets — `assignee` sert de filtre de visibilité et s'arrête là.

import { isVisibleProject, projectStatus, sortProjects, sortTasks, toTaskSnapshot } from "./rules";
import type {
  AsanaProject,
  AsanaTask,
  LogFn,
  ProjectSnapshot,
  TeamSnapshotBody,
} from "./types";

const LIMITE_DESCRIPTION = 300;

/**
 * Corrections §4, option A (le défaut).
 *
 * La description d'un projet Asana est un champ de TRAVAIL : notes de chantier,
 * identifiants de staging, commentaires sur le client. L'exposer brut est une
 * fuite par inadvertance, pas un risque théorique. Deux régimes :
 *
 * - avec un séparateur (une ligne valant exactement `---`) : seule la portion
 *   qui le précède est publique, tout ce qui suit est interne et n'entre jamais
 *   dans le snapshot ;
 * - sans séparateur : seule la première ligne non vide.
 *
 * ÉCART ASSUMÉ À §4 : le plafond de 300 caractères s'applique aux DEUX
 * branches, alors que la spec ne le prévoit que pour la seconde. Motif constaté
 * sur les données réelles : dans les boards existants, `---` sert de simple
 * séparateur visuel avant une note de bas de page, et non de frontière
 * public/privé — la portion « publique » de « 🎭 Refonte site » est ainsi une
 * pile de liens Google Docs et Drive internes. Exposer strictement moins que la
 * règle ne contredit pas une règle de confidentialité.
 *
 * La valeur n'est jamais injectée en HTML brut côté rendu : Astro échappe les
 * expressions `{}` par défaut, et aucun `set:html` ne doit apparaître.
 */
export function publicDescription(notes: string | null | undefined): string {
  if (!notes) return "";
  const lignes = notes.split(/\r?\n/);
  const iSep = lignes.findIndex((l) => l.trim() === "---");

  const publique =
    iSep !== -1
      ? lignes.slice(0, iSep).join("\n").trim()
      : (lignes.map((l) => l.trim()).find((l) => l !== "") ?? "");

  return publique.length > LIMITE_DESCRIPTION
    ? `${publique.slice(0, LIMITE_DESCRIPTION)}…`
    : publique;
}

export interface ProjectInput {
  project: AsanaProject;
  /** Toutes les tâches du projet, dans l'ordre du board. Ne pas re-trier. */
  tasks: AsanaTask[];
}

/**
 * Construit le corps du snapshot — SANS `synced_at`. C'est cette forme-là qui
 * est hachée (corrections §3) ; l'horodatage est ajouté au moment de l'écriture
 * KV, et seulement quand il y a vraiment eu changement.
 */
export function buildTeamSnapshot(
  teamGid: string,
  inputs: ProjectInput[],
  log: LogFn,
): TeamSnapshotBody {
  const projects: ProjectSnapshot[] = [];

  for (const { project, tasks } of inputs) {
    if (!isVisibleProject(project)) continue;

    const visibles = tasks
      .map((t) => toTaskSnapshot(t, project.gid, log))
      .filter((t): t is NonNullable<typeof t> => t !== null);

    projects.push({
      gid: project.gid,
      name: project.name.trim(),
      description: publicDescription(project.notes),
      due_on: project.due_on ?? null,
      status: projectStatus(project, visibles),
      tasks: sortTasks(visibles),
    });
  }

  return { schema_version: 1, team_gid: teamGid, projects: sortProjects(projects) };
}

/**
 * JSON à ordre de clés déterministe. Le builder ci-dessus produit déjà toujours
 * le même ordre, mais un simple réordonnancement de champ dans le code ferait
 * alors bouger tous les hachages d'un coup. Trier ici rend l'empreinte
 * dépendante du seul contenu — huit lignes contre une classe de faux positifs.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 hexadécimal. `crypto.subtle` est disponible dans les Workers et sous Node ≥ 19. */
export async function hashSnapshot(body: TeamSnapshotBody): Promise<string> {
  const octets = new TextEncoder().encode(stableStringify(body));
  const digest = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
