// Les formulaires et les blocs de réponse des documents parlent au client
// dans son registre (spec 2026-10-02, le pronom de la fiche). Leurs phrases
// au vous vivent dans la branche vous de l'objet `t` (ou du titre) choisi par
// `tutoiement` ; hors de là, un vous ou un impératif en -ez s'afficherait
// aussi à un client tutoyé.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPOSANTS = [
  "src/components/devis/DevisReponse.astro",
  "src/components/devis/DocumentReponses.astro",
  "src/components/cadrage/CadrageFormulaire.astro",
  "src/components/temoignage/TemoignageFormulaire.astro",
  "src/components/temoignage/TemoignageCasClient.astro",
  "src/components/livrable/LivrableReponse.astro",
  "src/components/livrable/LivrableSuite.astro",
];

/** Le source sans la branche vous de `const t = tutoiement ? {…} : {…};` ni le `const titre = tutoiement …;`. */
function horsBrancheVous(source: string): string {
  let s = source;
  const t = s.indexOf("const t = tutoiement");
  if (t >= 0) {
    const debut = s.slice(t).search(/\n\s*:\s*\{/);
    const fin = debut >= 0 ? s.slice(t + debut).search(/\n\s*\};/) : -1;
    if (debut >= 0 && fin >= 0) s = s.slice(0, t + debut) + s.slice(t + debut + fin);
  }
  const titre = s.indexOf("const titre = tutoiement");
  if (titre >= 0) s = s.slice(0, titre) + s.slice(s.indexOf(";", titre) + 1);
  return s;
}

const COMMENTAIRE = /^\s*(\/\/|\/\*|\*|\{\/\*|<!--)/;
const VOUS = /(?<![\p{L}])(vous|votre|vos)(?![\p{L}])/iu;
const EXCEPTIONS_EZ = new Set(["chez", "assez", "nez", "rendez", "rez"]);
const imperatif = (ligne: string) =>
  [...ligne.matchAll(/(?<![\p{L}])(\p{L}+ez)(?![\p{L}])/giu)].some((m) => !EXCEPTIONS_EZ.has(m[1].toLowerCase()));

describe("registre des formulaires de documents", () => {
  it("aucun vous ni impératif vouvoyé hors de la branche vous", () => {
    const fautes = COMPOSANTS.flatMap((f) =>
      horsBrancheVous(readFileSync(join(process.cwd(), f), "utf-8"))
        .split("\n")
        .filter((ligne) => !COMMENTAIRE.test(ligne) && (VOUS.test(ligne) || imperatif(ligne)))
        .map((ligne) => `${f} ${ligne.trim()}`),
    );
    expect(fautes).toEqual([]);
  });
});
