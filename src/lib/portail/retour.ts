// Schéma du champ `retour` de l'Action portail.choisirWorkspace
// (src/actions/index.ts), extrait ici pour rester testable sous Vitest :
// astro:actions est un module virtuel non résolvable hors du build Astro
// (même contrainte que requireAdmin, voir require-admin.ts). Le paquet
// `zod` est en revanche résolvable des deux côtés — c'est ce qu'astro:schema
// réexporte — d'où l'import direct ici plutôt que astro:schema.
//
// Deux choses à empêcher :
// - un hôte externe : `startsWith("/")` seul laissait passer les URL
//   protocole-relatives ("//evil.example/x", résolue par le navigateur en
//   "https://evil.example/x") et les variantes à antislash
//   ("/\evil.example", que plusieurs navigateurs normalisent en
//   "//evil.example").
// - une injection d'en-tête / response-splitting : sans `$` de fin ni
//   exclusion des caractères de contrôle, une valeur comme
//   "/x\r\nLocation: https://evil.example" passait, le CRLF n'étant contraint
//   nulle part après le premier caractère.
import { z } from "zod";

export const RETOUR_REGEX = /^\/(?![/\\])[^\x00-\x1f\x7f]*$/;

export const retourSchema = z
  .string()
  .regex(RETOUR_REGEX, "Chemin de retour invalide.")
  .default("/");
