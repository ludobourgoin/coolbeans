import { expect, test } from "vitest";
import { LONGUEUR_MIN, validerNouveauMotDePasse } from "./mot-de-passe";

test("un mot de passe assez long et confirmé passe", () => {
  expect(validerNouveauMotDePasse("correct-horse", "correct-horse")).toBeNull();
});

test("un mot de passe vide est refusé avant tout le reste", () => {
  expect(validerNouveauMotDePasse("", "")).toBe("Choisissez un mot de passe.");
});

test("le plancher de longueur est celui du serveur", () => {
  const court = "a".repeat(LONGUEUR_MIN - 1);
  expect(validerNouveauMotDePasse(court, court)).toContain(String(LONGUEUR_MIN));
  const pile = "a".repeat(LONGUEUR_MIN);
  expect(validerNouveauMotDePasse(pile, pile)).toBeNull();
});

test("deux saisies différentes sont refusées", () => {
  expect(validerNouveauMotDePasse("correct-horse", "correct-hors")).toBe(
    "Les deux mots de passe ne correspondent pas.",
  );
});

test("une confirmation oubliée dit que les deux diffèrent", () => {
  // Et non « confirmez votre mot de passe », qui laisserait croire à une
  // étape supplémentaire alors que le champ est juste vide.
  expect(validerNouveauMotDePasse("correct-horse", "")).toBe(
    "Les deux mots de passe ne correspondent pas.",
  );
});
