import { expect, test } from "vitest";
import { deposerLien, retirerLien, reserverCapture } from "./capture-lien";

test("un jeton réservé capture l'URL et supprime l'envoi", () => {
  const jeton = reserverCapture();
  expect(deposerLien(jeton, "https://my.coolbeans.cc/verify?token=abc")).toBe(true);
  expect(retirerLien(jeton)).toBe("https://my.coolbeans.cc/verify?token=abc");
});

/* LE TEST QUI COMPTE : l'en-tête seul ne doit jamais suffire à empêcher un
   mail de partir. Sans cette condition, un appel non authentifié sur
   /api/auth/sign-in/magic-link supprimerait le mail d'un tiers en posant
   l'en-tête au hasard. */
test("un jeton non réservé ne capture rien, le mail part normalement", () => {
  expect(deposerLien("jeton-invente", "https://exemple/verify")).toBe(false);
  expect(deposerLien(null, "https://exemple/verify")).toBe(false);
  expect(deposerLien(undefined, "https://exemple/verify")).toBe(false);
});

test("un jeton ne sert qu'une fois", () => {
  const jeton = reserverCapture();
  deposerLien(jeton, "https://exemple/verify");
  expect(retirerLien(jeton)).toBe("https://exemple/verify");
  // Deuxième retrait : la réservation est libérée, plus rien à lire.
  expect(retirerLien(jeton)).toBeNull();
  expect(deposerLien(jeton, "https://exemple/autre")).toBe(false);
});

test("un jeton réservé mais jamais déposé rend null", () => {
  // Cas d'une adresse inconnue : disableSignUp coupe avant sendMagicLink.
  const jeton = reserverCapture();
  expect(retirerLien(jeton)).toBeNull();
});

test("deux captures simultanées ne se mélangent pas", () => {
  const a = reserverCapture();
  const b = reserverCapture();
  deposerLien(b, "https://exemple/b");
  deposerLien(a, "https://exemple/a");
  expect(retirerLien(a)).toBe("https://exemple/a");
  expect(retirerLien(b)).toBe("https://exemple/b");
});
