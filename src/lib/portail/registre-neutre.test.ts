// Le portail ne s'adresse à personne en particulier : ses libellés désignent
// le site ou le projet. Un « vous » ou un impératif en -ez s'y glisse, et un
// client tutoyé se fait vouvoyer (spec 2026-10-02, le pronom de la fiche).
// Les mails, eux, passent en double registre : ils ne sont pas visés ici.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINES = ["src/pages/espace", "src/components/portail", "src/pages/api/messagerie"].map((r) =>
  join(process.cwd(), r),
);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fichiers(join(dossier, e.name))
      : /\.(astro|ts)$/.test(e.name) && !e.name.endsWith(".test.ts")
        ? [join(dossier, e.name)]
        : [],
  );
}

const COMMENTAIRE = /^\s*(\/\/|\/\*|\*|\{\/\*|<!--)/;
const VOUS = /\b(vous|votre|vos)\b/i;
// Tout mot en -ez est un impératif ou un présent vouvoyé, sauf cette courte liste.
// Bornes Unicode : `\b` ne connaît que l'ASCII (« écrivez » commence par une lettre accentuée).
const EXCEPTIONS_EZ = new Set(["chez", "assez", "nez", "rendez", "rez"]);
const imperatif = (ligne: string) =>
  [...ligne.matchAll(/(?<![\p{L}])(\p{L}+ez)(?![\p{L}])/giu)].some((m) => !EXCEPTIONS_EZ.has(m[1].toLowerCase())) ||
  /(?<![\p{L}])dites(?![\p{L}])/iu.test(ligne);

describe("registre neutre du portail", () => {
  it("aucun vous ni impératif vouvoyé hors commentaires", () => {
    const fautes = RACINES.flatMap(fichiers).flatMap((f) =>
      readFileSync(f, "utf-8")
        .split("\n")
        .map((ligne, i) => ({ ligne, i }))
        .filter(({ ligne }) => !COMMENTAIRE.test(ligne) && (VOUS.test(ligne) || imperatif(ligne)))
        .map(({ ligne, i }) => `${f.replace(process.cwd() + "/", "")}:${i + 1} ${ligne.trim()}`),
    );
    expect(fautes).toEqual([]);
  });
});
