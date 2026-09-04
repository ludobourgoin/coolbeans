// Ce test protege la REGLE, pas le placement des fichiers : une page rangee
// sous src/pages/espace/admin/ est gardee par construction. Ce qu'il attrape,
// c'est le jour ou quelqu'un retouche le prefixe dans garde-admin.ts et fait
// silencieusement sortir des pages existantes de la garde.
//
// Il ne protege PAS contre une page sensible creee AILLEURS. Cette regle-la
// est editoriale et vit dans la spec : toute donnee financiere sous
// /espace/admin/finances/, sans exception.

import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { estRouteAdmin } from "./garde-admin";

const RACINE = join(process.cwd(), "src", "pages", "espace", "admin");

function fichiersDePage(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fichiersDePage(join(dossier, e.name))
      : e.name.endsWith(".astro")
        ? [join(dossier, e.name)]
        : [],
  );
}

function routeDe(fichier: string): string {
  const rel = relative(RACINE, fichier).split(sep).join("/");
  const sansExt = rel.replace(/\.astro$/, "");
  const sansIndex = sansExt.replace(/(^|\/)index$/, "");
  return `/espace/admin${sansIndex ? `/${sansIndex}` : ""}`;
}

describe("pages sous le prefixe admin", () => {
  const pages = fichiersDePage(RACINE);

  // Un dossier vide rendrait le it.each suivant vacide : il passerait sans
  // rien verifier, ce qui est pire qu'un test absent.
  it("il y a au moins une page sous le prefixe", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("%s tombe sous la garde admin", (fichier) => {
    expect(estRouteAdmin(routeDe(fichier))).toBe(true);
  });
});
