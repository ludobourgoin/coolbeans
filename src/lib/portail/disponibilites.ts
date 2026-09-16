/**
 * Planning de disponibilités du portail (COO-11, page /espace/disponibilites).
 *
 * Trois mois glissants, du lundi au vendredi, avec deux sources :
 * - les jours fériés français, calculés ici (fixes + mobiles depuis Pâques) ;
 * - les plages d'indisponibilité de Coolbeans, lues dans la collection
 *   `indisponibilites` (YAML édité à la main, commun à tous les workspaces).
 *
 * Tout se manipule en chaînes ISO `YYYY-MM-DD` : le portail tourne sur un
 * Worker en UTC et le client lit en heure de Paris, une Date locale ferait
 * glisser un jour à minuit. Les seules Date construites le sont en UTC.
 */

export interface Plage {
  /** Premier jour, inclus. */
  du: string;
  /** Dernier jour, inclus. */
  au: string;
  /** Court, lu par le client : « Vacances », « Déplacement ». */
  motif?: string;
}

export interface Mois {
  annee: number;
  /** 1 à 12. */
  mois: number;
}

export type EtatJour = "ouvre" | "ferie" | "indispo";

export interface Cellule {
  iso: string;
  jour: number;
  etat: EtatJour;
  /** Nom du férié ou motif de la plage, absent pour un jour ouvré. */
  libelle?: string;
  aujourdhui: boolean;
  passe: boolean;
}

export interface Grille {
  mois: Mois;
  titre: string;
  /** Lignes de cinq cases lundi → vendredi ; `null` hors du mois. */
  semaines: (Cellule | null)[][];
}

const iso = (annee: number, mois: number, jour: number): string =>
  `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;

const decale = (date: string, jours: number): string => {
  const [a, m, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + jours));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Dimanche de Pâques, algorithme de Meeus (grégorien). */
export function paques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(annee, mois, jour);
}

/** Les onze jours fériés nationaux, date ISO → nom. */
export function feriesFrance(annee: number): Map<string, string> {
  const p = paques(annee);
  return new Map([
    [iso(annee, 1, 1), "Jour de l'an"],
    [decale(p, 1), "Lundi de Pâques"],
    [iso(annee, 5, 1), "Fête du Travail"],
    [iso(annee, 5, 8), "Victoire 1945"],
    [decale(p, 39), "Ascension"],
    [decale(p, 50), "Lundi de Pentecôte"],
    [iso(annee, 7, 14), "Fête nationale"],
    [iso(annee, 8, 15), "Assomption"],
    [iso(annee, 11, 1), "Toussaint"],
    [iso(annee, 11, 11), "Armistice 1918"],
    [iso(annee, 12, 25), "Noël"],
  ]);
}

/** Le mois courant et les deux suivants. */
export function moisGlissants(aujourdhui: string, nombre = 3): Mois[] {
  const [annee, mois] = aujourdhui.split("-").map(Number);
  return Array.from({ length: nombre }, (_, i) => {
    const total = mois - 1 + i;
    return { annee: annee + Math.floor(total / 12), mois: (total % 12) + 1 };
  });
}

const titreMois = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const plageDe = (date: string, plages: Plage[]): Plage | undefined =>
  plages.find((p) => p.du <= date && date <= p.au);

export function grilleMois(
  mois: Mois,
  ctx: { aujourdhui: string; plages: Plage[] },
): Grille {
  const feries = feriesFrance(mois.annee);
  const nbJours = new Date(Date.UTC(mois.annee, mois.mois, 0)).getUTCDate();
  const semaines: (Cellule | null)[][] = [];
  let semaine: (Cellule | null)[] = [];

  /* Colonne du 1er : lundi = 0 … dimanche = 6. */
  const premier = (new Date(Date.UTC(mois.annee, mois.mois - 1, 1)).getUTCDay() + 6) % 7;
  for (let i = 0; i < Math.min(premier, 5); i++) semaine.push(null);

  for (let jour = 1; jour <= nbJours; jour++) {
    const col = (premier + jour - 1) % 7;
    if (col >= 5) {
      /* Dimanche clôt la semaine ; une semaine ne contenant que du week-end
         (un mois qui commence un samedi) ne produit aucune ligne. */
      if (col === 6 && semaine.length) {
        semaines.push(semaine);
        semaine = [];
      }
      continue;
    }
    const date = iso(mois.annee, mois.mois, jour);
    const ferie = feries.get(date);
    const plage = ferie ? undefined : plageDe(date, ctx.plages);
    semaine.push({
      iso: date,
      jour,
      etat: ferie ? "ferie" : plage ? "indispo" : "ouvre",
      libelle: ferie ?? plage?.motif,
      aujourdhui: date === ctx.aujourdhui,
      passe: date < ctx.aujourdhui,
    });
    if (col === 4) {
      semaines.push(semaine);
      semaine = [];
    }
  }
  if (semaine.length) {
    while (semaine.length < 5) semaine.push(null);
    semaines.push(semaine);
  }

  const titre = majuscule(titreMois.format(new Date(Date.UTC(mois.annee, mois.mois - 1, 1))));
  return { mois, titre, semaines };
}

/** Les plages qui touchent la fenêtre affichée, par date de début. */
export function plagesAffichees(plages: Plage[], fenetre: Mois[]): Plage[] {
  const debut = iso(fenetre[0].annee, fenetre[0].mois, 1);
  const dernier = fenetre[fenetre.length - 1];
  const fin = iso(
    dernier.annee,
    dernier.mois,
    new Date(Date.UTC(dernier.annee, dernier.mois, 0)).getUTCDate(),
  );
  return plages
    .filter((p) => p.au >= debut && p.du <= fin)
    .sort((a, b) => a.du.localeCompare(b.du));
}

const jourLong = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const dateDe = (date: string): Date => {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
};

/* « 1 novembre » est ce que rend Intl ; en français on écrit « 1er ». */
const jourLisible = (date: string): string =>
  jourLong.format(dateDe(date)).replace(/^1 /, "1er ");

/** « du 26 octobre au 1er novembre », ou « le 16 septembre » pour un seul jour. */
export function periodeLisible(plage: Plage): string {
  if (plage.du === plage.au) return `le ${jourLisible(plage.du)}`;
  return `du ${jourLisible(plage.du)} au ${jourLisible(plage.au)}`;
}

/** Date du jour en heure de Paris, en ISO : le Worker tourne en UTC. */
export function aujourdhuiParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(maintenant);
}
