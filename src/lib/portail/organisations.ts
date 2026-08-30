// Registre des organisations, c'est-a-dire des revendeurs (spec 2026-08-19 §3.1).
//
// Une organisation regroupe les workspaces qu'un meme revendeur nous achete :
// une agence, un freelance, ou `coolbeans` pour un client direct. C'est le
// niveau au-dessus du workspace client, et celui auquel un compte revendeur
// est rattache — d'ou sa portee sur toutes les teams de son organisation.
//
// Le registre YAML est la source de verite ; D1 porte les memes slugs, poses
// par scripts/amorcer-organisations.mjs. Le jour ou les deux divergent, c'est
// le script qui echoue, pas le portail qui devine.
//
// Comme pour les workspaces, la fonction `*In` prend la liste en argument :
// c'est ce qui la rend testable sans `astro:content`, indisponible sous Vitest.

export interface PortalOrganisation {
  /** Nom du fichier YAML, sans extension. MEME slug qu'en D1. */
  slug: string;
  nom: string;
}

/** Tri alphabetique sur le nom : l'ordre d'un selecteur ne depend pas du disque. */
export function sortOrganisations(organisations: PortalOrganisation[]): PortalOrganisation[] {
  return [...organisations].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export function getOrganisationIn(
  organisations: PortalOrganisation[],
  slug: string | null | undefined,
): PortalOrganisation | null {
  if (!slug) return null;
  return organisations.find((o) => o.slug === slug) ?? null;
}

export async function listOrganisations(): Promise<PortalOrganisation[]> {
  const { getCollection } = await import("astro:content");
  const entries = await getCollection("organisations");
  return sortOrganisations(entries.map((e) => ({ slug: e.id, ...e.data })));
}
