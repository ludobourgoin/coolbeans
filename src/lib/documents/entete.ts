/* Ce que l'en-tête et les volets d'un document affichent, calculé hors des
 * routes pour être testé. Les trois routes à versions dupliquaient le
 * regroupement et la date courte ; elles lisent désormais ce module.
 */
import { dateLongue } from "../devis";

export const dateCourte = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export interface VersionAffichee {
  date: Date;
  version: number;
  onglet?: string;
}

/** Le libellé d'un onglet : son nom s'il en a un, sinon sa version et sa date. */
export const libelleOnglet = (v: VersionAffichee) => v.onglet ?? `V${v.version} · ${dateCourte(v.date)}`;

/**
 * La ligne de date sous le titre d'un volet. La version n'est mentionnée que
 * s'il y en a plusieurs et qu'elles ne sont pas des chapitres nommés (spec §7).
 */
export function ligneDate(v: VersionAffichee, plusieurs: boolean, nature: string): string {
  const jour = dateLongue(v.date);
  return plusieurs && !v.onglet ? `Version ${v.version} du ${jour}` : `${nature} du ${jour}`;
}

/** Le h1 : le nom du projet Linear, ou le titre du document hors nomenclature. */
export function titreEntete(d: { titre: string; projet?: string; linear?: { projet?: string } }): string {
  return d.projet && d.linear?.projet ? d.linear.projet : d.titre;
}

/** Les racines et leurs versions, chaque groupe trié de la V1 à la dernière. */
export function grouperVersions<T extends { id: string; data: { version: number; versionDe?: string } }>(
  entrees: T[],
): T[][] {
  return entrees
    .filter((e) => !e.data.versionDe)
    .map((racine) =>
      [racine, ...entrees.filter((e) => e.data.versionDe === racine.id)].sort((a, b) => a.data.version - b.data.version),
    );
}
