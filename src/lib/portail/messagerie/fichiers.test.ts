import { describe, expect, test } from "vitest";
import { cleR2, validerFichiers } from "./fichiers";

const fichier = (name: string, size: number) =>
  new File([new Uint8Array(size)], name, { type: "image/png" });

describe("validerFichiers", () => {
  test("accepte 0 à 3 fichiers de 10 Mo max", () => {
    expect(validerFichiers([])).toBeNull();
    expect(validerFichiers([fichier("a.png", 1024)])).toBeNull();
  });
  test("refuse plus de 3 fichiers", () => {
    const quatre = [1, 2, 3, 4].map((i) => fichier(`${i}.png`, 10));
    expect(validerFichiers(quatre)).toMatch(/3 fichiers/);
  });
  test("refuse un fichier de plus de 10 Mo", () => {
    expect(validerFichiers([fichier("gros.png", 10 * 1024 * 1024 + 1)])).toMatch(/10 Mo/);
  });
});

describe("cleR2", () => {
  test("préfixe par client et ticket, garde l'extension, neutralise le nom", () => {
    const cle = cleR2("amusoire", "t1", "Ma capture (1).PNG");
    expect(cle).toMatch(/^messagerie\/amusoire\/t1\/[0-9a-f-]{36}\.png$/);
  });
});
