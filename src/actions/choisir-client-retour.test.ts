// Verrouille la validation du paramètre `retour` de l'Action
// `portail.choisirClient` (src/actions/index.ts) contre la redirection
// ouverte : `startsWith("/")` seul laissait passer les URL
// protocole-relatives ("//evil.example/x", résolue par le navigateur en
// "https://evil.example/x") et les variantes à antislash ("/\evil.example",
// que plusieurs navigateurs normalisent en "//evil.example"). La règle
// retenue exige une barre initiale NON suivie d'une seconde barre ni d'un
// antislash.
//
// Reconstruit le schéma ici plutôt que de l'importer depuis
// src/actions/index.ts : ce fichier importe `astro:actions`, un module
// virtuel non résolvable sous Vitest (même contrainte que `astro:content`,
// déjà rencontrée sur cette tâche pour `requireAdmin`, cf. task-5-report.md).
// Cette regex doit rester identique à celle de src/actions/index.ts.
import { describe, expect, it } from "vitest";
import { z } from "zod";

const retourSchema = z
  .string()
  .regex(/^\/(?![/\\])/, "Chemin de retour invalide.")
  .default("/");

describe("retour (portail.choisirClient)", () => {
  it.each(["/", "/projets", "/espace/projets"])("accepte %s", (valeur) => {
    expect(retourSchema.safeParse(valeur).success).toBe(true);
  });

  it.each(["//evil.example/x", "/\\evil.example/x", "https://evil.example", "evil.example", ""])(
    "refuse %s",
    (valeur) => {
      expect(retourSchema.safeParse(valeur).success).toBe(false);
    },
  );
});
