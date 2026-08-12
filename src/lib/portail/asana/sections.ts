// Colonnes canoniques du board Asana et matching tolérant (corrections §6).
//
// Six colonnes relevées sur le projet pilote « Site web Coolbeans »
// (GID 1217361878516618) : 📥 Inbox · 🧱 Backlog · 🚀 Sprint · 🚧 En cours ·
// ☝️ Pour validation · ✅ Terminé.
//
// Le matching ignore les emojis, la casse, les accents et les espaces. Backlog
// et Sprint fusionnent sous « À faire » : ce sont des colonnes de travail
// internes, mais leurs tâches sont publiques — la mécanique agile est masquée,
// pas les tâches.

import type { TaskStatus } from "./types";

/**
 * Ce qu'on retire : les pictogrammes (\p{Extended_Pictographic}), le sélecteur
 * de variation U+FE0F, le joineur de largeur nulle U+200D et les modificateurs
 * de teinte.
 *
 * PIÈGE : ne pas utiliser \p{Emoji}. Cette propriété couvre les chiffres 0-9,
 * # et * — « Sprint 2 » deviendrait « sprint », sans le moindre signal.
 */
const PICTOGRAMMES = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;
const DIACRITIQUES = /\p{Diacritic}/gu;

export function normalizeSectionName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(PICTOGRAMMES, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Table de correspondance du §6. Clés déjà normalisées. */
const TABLE: Record<string, TaskStatus> = {
  backlog: "todo",
  "next sprint": "todo",
  sprint: "todo",
  "a faire": "todo",
  "en cours": "in_progress",
  "pour validation": "to_validate",
  "a valider": "to_validate",
  termine: "done",
};

const EXCLUES = new Set(["inbox"]);

export type SectionMapping =
  | { kind: "status"; status: TaskStatus }
  | { kind: "excluded" }
  | { kind: "unknown" };

/**
 * Trois issues, jamais une exception : une section inattendue est une anomalie
 * à logger, pas une raison de faire tomber le sync d'une team entière.
 * L'appelant décide quoi faire de `unknown` (règle du brief : in_progress + warning).
 */
export function mapSection(rawName: string): SectionMapping {
  const nom = normalizeSectionName(rawName);
  if (EXCLUES.has(nom)) return { kind: "excluded" };
  const status = TABLE[nom];
  return status ? { kind: "status", status } : { kind: "unknown" };
}

/**
 * Marqueur d'exclusion du §6 : un nom qui commence par « . » ne rentre pas
 * dans le snapshot, tâche comme projet. Remplace le préfixe 🔒 du brief et
 * toute sa normalisation Unicode.
 *
 * `trim()` suffit pour le critère 17 : la définition ECMAScript de l'espace
 * blanc inclut l'espace insécable U+00A0 et les espaces typographiques.
 */
export function isHiddenName(raw: string): boolean {
  return raw.trim().startsWith(".");
}

/** Ordre d'affichage des colonnes côté client (brief §6). */
export const COLUMN_ORDER = ["todo", "in_progress", "to_validate", "done"] as const satisfies readonly TaskStatus[];
