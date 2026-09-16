/* ============================================================================
   COOLBEANS · Document de livrable

   Troisième membre de la famille proposition / cadrage : la page qui présente
   un travail livré (le plus souvent un site) au client, explique la logique
   de conception, les choix esthétiques et techniques, et se termine par un
   formulaire où le client valide ou dépose ses retours.

   Ce module ne porte que ce qui est partagé entre la page et l'endpoint de
   soumission : le vocabulaire des réponses possibles.
   ========================================================================== */

export const REPONSES_LIVRABLE = {
  validation: "Je valide ce livrable",
  retours: "J'ai des retours",
} as const;

export type ReponseLivrable = keyof typeof REPONSES_LIVRABLE;

export const estReponseLivrable = (v: unknown): v is ReponseLivrable =>
  typeof v === "string" && v in REPONSES_LIVRABLE;
