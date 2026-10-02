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
 *
 * Chaque projet porte l'identifiant court de son projet Linear (`slugId`, les
 * douze caractères qui terminent son adresse Linear), relevé le 2026-09-30 :
 * c'est lui qui range un document sous son projet dans le portail (spec
 * 2026-09-30, barre par workspace, §4.3).
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

/** Un projet de la table : son client, et l'identifiant court de son projet Linear. */
export interface EntreeProjet {
  client: CleClient;
  /** `slugId` du projet Linear : les douze caractères qui terminent son adresse. */
  linear: string;
}

/** Segment du projet, référence comprise, vers son client et son projet Linear. */
export const PROJETS: Readonly<Record<string, EntreeProjet>> = {
  "refonte-432": { client: "amu", linear: "9a553e01b917" },
  "pack-heures-973": { client: "amu", linear: "8947ac98efef" },
  "site-web-879": { client: "caf", linear: "2361b9acfd1a" },
  "boutique-shopify-390": { client: "fyl", linear: "42d0fb9d1281" },
  "site-vitrine-471": { client: "lit", linear: "e181c8e92c1f" },
  "precommande-livre-412": { client: "mal", linear: "7218ca9539af" },
  "site-vitrine-618": { client: "mal", linear: "691bb92bf3db" },
  "refonte-207": { client: "mat", linear: "27aa43992fe6" },
  "formulaire-brochures-831": { client: "mih", linear: "603b24fea5d1" },
  "plaquette-agen-723": { client: "mih", linear: "c8ce3f2521bd" },
  "boutique-624": { client: "oid", linear: "728faac06981" },
  "salon-533": { client: "rev", linear: "e6c1e495a56f" },
  "refonte-740": { client: "set", linear: "5d401d0da735" },
  "osmose-281": { client: "set", linear: "d796ba98b140" },
  "reservation-513": { client: "set", linear: "ccd25271ada6" },
  "serial-generations-618": { client: "uni", linear: "fff0a01f2a8c" },
  "plateforme-327": { client: "unl", linear: "03dc21021720" },
  "page-vitrine-561": { client: "vic", linear: "52f28a6e9424" },
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

/** Le `slugId` d'un projet Linear : douze caractères hexadécimaux. */
export const FORME_LINEAR = /^[0-9a-f]{12}$/;

export function clientDuProjet(projet: string): CleClient | undefined {
  return Object.hasOwn(PROJETS, projet) ? PROJETS[projet].client : undefined;
}

export function linearDuProjet(projet: string): string | undefined {
  return Object.hasOwn(PROJETS, projet) ? PROJETS[projet].linear : undefined;
}

/** Le projet de la table relié à ce projet Linear. */
export function projetDuLinear(slugId: string): string | undefined {
  return Object.keys(PROJETS).find((p) => PROJETS[p].linear === slugId);
}

/** Les liens vers Linear mal formés ou partagés. Une liste vide veut dire cohérent. */
export function verifierLiensLinear(projets: Readonly<Record<string, EntreeProjet>> = PROJETS): string[] {
  const erreurs: string[] = [];
  const vus = new Map<string, string>();
  for (const [projet, { linear }] of Object.entries(projets)) {
    if (!FORME_LINEAR.test(linear)) {
      erreurs.push(`projet ${projet} : identifiant Linear « ${linear} » mal formé`);
      continue;
    }
    const deja = vus.get(linear);
    if (deja) erreurs.push(`identifiant Linear « ${linear} » porté par deux projets (${deja}, ${projet})`);
    else vus.set(linear, projet);
  }
  return erreurs;
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

/** Le workspace relié à un projet Linear par la table, s'il y en a un. */
export function workspaceDuLinear<W extends { cle?: string }>(
  workspaces: readonly W[],
  slugId: string,
): W | undefined {
  const projet = projetDuLinear(slugId);
  return projet ? workspaceDuProjet(workspaces, projet) : undefined;
}
