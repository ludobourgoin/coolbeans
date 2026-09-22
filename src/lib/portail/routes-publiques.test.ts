import { expect, test } from "vitest";
import { CHEMINS_PUBLICS_PORTAIL, estServiTelQuel } from "./routes-publiques";

test("le parcours d'accès complet est servi tel quel", () => {
  // Les trois pages qu'on atteint sans session. En oublier une la renvoie
  // sous /espace, donc derrière le middleware, donc vers la connexion : la
  // page de récupération devient inatteignable pour qui en a besoin.
  for (const chemin of ["/connexion", "/mot-de-passe-oublie", "/reinitialiser"]) {
    expect(estServiTelQuel(chemin), chemin).toBe(true);
  }
});

test("la barre finale est tolérée sur chaque chemin public", () => {
  for (const chemin of CHEMINS_PUBLICS_PORTAIL) {
    expect(estServiTelQuel(`${chemin}/`), chemin).toBe(true);
  }
});

test("les préfixes techniques passent", () => {
  expect(estServiTelQuel("/_astro/index.css")).toBe(true);
  // Les pages de récupération appellent /api/auth/* : les réécrire casserait
  // la demande de lien et l'enregistrement du mot de passe.
  expect(estServiTelQuel("/api/auth/request-password-reset")).toBe(true);
  expect(estServiTelQuel("/docs")).toBe(true);
  expect(estServiTelQuel("/docs/amusoire/01-vue-densemble")).toBe(true);
});

test("le reste part sous /espace", () => {
  expect(estServiTelQuel("/")).toBe(false);
  expect(estServiTelQuel("/messagerie")).toBe(false);
  expect(estServiTelQuel("/projets/documents")).toBe(false);
});

test("un chemin qui commence comme un chemin public ne passe pas", () => {
  // `/connexion-admin` n'est pas `/connexion` : une comparaison par préfixe
  // ouvrirait le portail à tout ce qui commence pareil.
  expect(estServiTelQuel("/connexion-admin")).toBe(false);
  expect(estServiTelQuel("/reinitialiser-tout")).toBe(false);
});
