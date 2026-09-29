import { expect, test } from "vitest";
import { familleDocument } from "./familles";

test("un fichier se range par son MIME", () => {
  expect(familleDocument("application/pdf")).toBe("pdf");
  expect(familleDocument("image/png")).toBe("image");
  expect(familleDocument("IMAGE/JPEG")).toBe("image");
});

test("un fichier au MIME inconnu ou absent reste un fichier", () => {
  // Le picto doit promettre ce qui va se passer au clic : ce fichier se
  // télécharge, il ne s'ouvre pas.
  expect(familleDocument("application/zip")).toBe("archive");
  expect(familleDocument("application/x-chose")).toBe("archive");
  expect(familleDocument(null)).toBe("archive");
  expect(familleDocument(undefined)).toBe("archive");
});
