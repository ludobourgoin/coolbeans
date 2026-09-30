/* La table de nomenclature client et projet (spec 2026-09-22 §6 et §11, COO-234).
 *
 * Elle fait autorité. Le champ `projet` d'un document doit y figurer, et c'est
 * elle qui dit à quel client il appartient : le dossier du fichier n'arbitre
 * rien, `osmose` et `serial-generations` ne sont pas des clients.
 *
 * Clé client : la clé de la team Linear, en minuscules. Vérifiée le 2026-09-29.
 * Projet : un nom court suivi de trois chiffres. Les trois chiffres reprennent
 * le début de la référence à quatre chiffres de la première proposition du
 * projet, à défaut de son premier document (`reservation-513` vient du cadrage
 * 5138). Une référence par projet, pas par document.
 */

export const CLIENTS = {
  amu: "Amusoire",
  caf: "CAFA",
  fyl: "Fylgo",
  lit: "Little Box",
  mal: "Aurélie Malbec",
  mat: "Mathilde Chevalier",
  mih: "Miharu",
  oid: "Oïde",
  rev: "Revolutions Douces",
  set: "Setencorpsmieux",
  uni: "Université de Montpellier",
  unl: "UnlockBreath",
  vic: "Vice Versa",
} as const;

export type CleClient = keyof typeof CLIENTS;

/** Segment d'URL du projet, référence comprise, vers la clé de son client. */
export const PROJETS: Readonly<Record<string, CleClient>> = {
  "refonte-432": "amu",
  "site-web-879": "caf",
  "boutique-shopify-390": "fyl",
  "site-vitrine-471": "lit",
  "precommande-livre-412": "mal",
  "site-vitrine-618": "mal",
  "refonte-207": "mat",
  "formulaire-brochures-831": "mih",
  "plaquette-agen-723": "mih",
  "boutique-624": "oid",
  "salon-533": "rev",
  "refonte-740": "set",
  "osmose-281": "set",
  "reservation-513": "set",
  "serial-generations-618": "uni",
  "plateforme-327": "unl",
  "page-vitrine-561": "vic",
};

/** Documents sans projet, par choix. Désignés par `collection/id`. */
export const HORS_NOMENCLATURE: readonly string[] = [
  // Pas une cliente (arbitrage du 2026-09-22).
  "cadrage/veronique-berthet/manuscrit-bb-4812",
  "livrable/veronique-berthet/manuscrit-bb-4812",
  // Proposition du projet Linear annulé « Refonte du site En Haut ».
  // L'affaire est rouverte le 2026-09-29 sur un nouveau projet, qui aura sa
  // propre proposition et sa propre référence.
  "devis/en-haut",
];

export const FORME_PROJET = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/;

export function clientDuProjet(projet: string): CleClient | undefined {
  return Object.hasOwn(PROJETS, projet) ? PROJETS[projet] : undefined;
}

/** Les incohérences entre les fiches client du portail et la nomenclature. */
export function verifierCles(workspaces: readonly { slug: string; cle?: string }[]): string[] {
  const erreurs: string[] = [];
  const vues = new Map<string, string>();
  for (const w of workspaces) {
    if (!w.cle) continue;
    if (!Object.hasOwn(CLIENTS, w.cle)) {
      erreurs.push(`clients/${w.slug} : clé « ${w.cle} » absente de la nomenclature`);
    }
    const deja = vues.get(w.cle);
    if (deja) erreurs.push(`clé « ${w.cle} » portée par deux workspaces (${deja}, ${w.slug})`);
    else vues.set(w.cle, w.slug);
  }
  return erreurs;
}

/** Le workspace d'un projet : celui qui porte la clé du client du projet. */
export function workspaceDuProjet<W extends { cle?: string }>(
  workspaces: readonly W[],
  projet: string,
): W | undefined {
  const cle = clientDuProjet(projet);
  return cle ? workspaces.find((w) => w.cle === cle) : undefined;
}
