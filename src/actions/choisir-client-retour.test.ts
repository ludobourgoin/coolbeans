// Verrouille la validation du paramètre `retour` de l'Action
// `portail.choisirClient` (src/actions/index.ts) sur les deux choses qu'elle
// doit empêcher : hôte externe et injection d'en-tête / response-splitting.
// Le détail des deux règles est documenté dans src/lib/portail/retour.ts.
//
// Importe le schéma partagé plutôt que de recopier la regex : sans ça, un
// relâchement de la vraie regex (dans retour.ts, utilisée par l'Action)
// laisserait les assertions ci-dessous vertes tant que la copie locale
// n'était pas mise à jour en miroir — c'est exactement ce qui s'est produit
// ici avant l'extraction. Même schéma qu'utilise src/actions/index.ts.
import { describe, expect, it } from "vitest";
import { retourSchema } from "../lib/portail/retour";

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
