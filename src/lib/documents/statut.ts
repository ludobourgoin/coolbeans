/* Les trois états d'un document client (spec 2026-09-22 §10).
 *
 * La décision de construire vit ici et pas dans les routes : `astro:content`
 * est un module virtuel indisponible sous Vitest, donc une règle laissée dans
 * un `getStaticPaths` est une règle non testée. Or c'est celle qui sert, ou
 * non, un document non relu à une cliente.
 *
 * `dev` est un paramètre et non une lecture de `import.meta.env.DEV` à
 * l'intérieur : c'est ce qui rend les deux branches testables.
 */

export type StatutDocument = "trame" | "brouillon" | "publie";

/** Ce que le filtre lit d'une entrée de collection, et rien de plus. */
export interface EntreeStatut {
  data: { statut: StatutDocument };
}

/**
 * Les entrées qui sortent du build.
 *
 * En développement, toutes : masquer un document ne doit pas revenir à le
 * perdre, et c'est en local que Ludo le relit. En production, les seules
 * publiées. Pas de détection de la préproduction : ces pages sont générées à
 * la compilation, où le nom d'hôte vaut toujours celui de la production.
 */
export function construitesEnProduction<T extends EntreeStatut>(entrees: T[], dev: boolean): T[] {
  if (dev) return entrees;
  return entrees.filter((e) => e.data.statut === "publie");
}
