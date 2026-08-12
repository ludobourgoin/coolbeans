// Verrouille la validation du paramètre `retour` de l'Action
// `portail.choisirClient` (src/actions/index.ts) sur les deux choses qu'elle
// doit empêcher :
// - un hôte externe : `startsWith("/")` seul laissait passer les URL
//   protocole-relatives ("//evil.example/x", résolue par le navigateur en
//   "https://evil.example/x") et les variantes à antislash
//   ("/\evil.example", que plusieurs navigateurs normalisent en
//   "//evil.example").
// - une injection d'en-tête / response-splitting : sans `$` de fin ni
//   exclusion des caractères de contrôle, une valeur comme
//   "/x\r\nLocation: https://evil.example" passait la validation, le CRLF
//   n'étant contraint nulle part après le premier caractère.
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
  .regex(/^\/(?![/\\])[^\x00-\x1f\x7f]*$/, "Chemin de retour invalide.")
  .default("/");

describe("retour (portail.choisirClient)", () => {
  it.each(["/", "/projets", "/espace/projets", "/espace/projets?q=%C3%A9"])(
    "accepte %s",
    (valeur) => {
      expect(retourSchema.safeParse(valeur).success).toBe(true);
    },
  );

  it.each([
    "//evil.example/x",
    "/\\evil.example/x",
    "https://evil.example",
    "evil.example",
    "",
    "/\r\nLocation: https://evil.example",
    "/x\ny",
    "/x\ty",
    "/x\x00y",
  ])("refuse %s", (valeur) => {
    expect(retourSchema.safeParse(valeur).success).toBe(false);
  });
});
