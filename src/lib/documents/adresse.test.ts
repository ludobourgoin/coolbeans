import { expect, test } from "vitest";
import { adresseDocument } from "./adresse";

test("l'adresse publique d'un document garde les barres obliques de son id", () => {
  expect(adresseDocument("devis", "cafa/site-web-8791")).toBe("https://coolbeans.cc/devis/cafa/site-web-8791");
  expect(adresseDocument("cadrage", "en-haut")).toBe("https://coolbeans.cc/cadrage/en-haut");
});
