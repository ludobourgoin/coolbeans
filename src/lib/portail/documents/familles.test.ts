import { expect, test } from "vitest";
import { familleDocument } from "./familles";

test("un fichier se range par son MIME", () => {
  expect(familleDocument({ source: "fichier", mime: "application/pdf" })).toBe("pdf");
  expect(familleDocument({ source: "fichier", mime: "image/png" })).toBe("image");
  expect(familleDocument({ source: "fichier", mime: "IMAGE/JPEG" })).toBe("image");
  expect(familleDocument({ source: "fichier", mime: "application/zip" })).toBe("archive");
});

test("un fichier au MIME inconnu reste un fichier, jamais un lien", () => {
  // Le picto de lien promettrait une page qui s'ouvre : ce fichier se
  // télécharge.
  expect(familleDocument({ source: "fichier", mime: "application/x-chose" })).toBe("archive");
  expect(familleDocument({ source: "fichier", mime: null })).toBe("archive");
});

test("une page du repo est une page, quelle que soit son URL", () => {
  expect(familleDocument({ source: "page", url: "https://coolbeans.cc/devis/cafa/x-1" })).toBe(
    "page",
  );
});

test("un lien se range par son hôte", () => {
  expect(familleDocument({ source: "lien", url: "https://docs.google.com/document/d/abc" })).toBe(
    "google-docs",
  );
  expect(familleDocument({ source: "lien", url: "https://drive.google.com/file/d/abc" })).toBe(
    "google-docs",
  );
  expect(familleDocument({ source: "lien", url: "https://notes.granola.ai/d/abc" })).toBe(
    "granola",
  );
  expect(familleDocument({ source: "lien", url: "https://coolbeans.cc/cadrage/x/y-1" })).toBe(
    "page",
  );
  expect(familleDocument({ source: "lien", url: "https://exemple.org/truc" })).toBe("lien");
});

test("un hôte qui imite un domaine connu ne passe pas", () => {
  // `endsWith` sur le domaine complet, et pas une inclusion de chaîne.
  expect(familleDocument({ source: "lien", url: "https://docs.google.com.pirate.net/x" })).toBe(
    "lien",
  );
});

test("une URL invalide retombe sur le picto neutre, sans lever", () => {
  expect(familleDocument({ source: "lien", url: "pas une url" })).toBe("lien");
  expect(familleDocument({ source: "lien", url: null })).toBe("lien");
});
