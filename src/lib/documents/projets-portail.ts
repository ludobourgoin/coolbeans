/* Les projets du portail et les onglets d'une page projet (spec 2026-09-30,
 * barre par workspace, §4 et §5).
 */
import { versionsDuPortail, type Bandeau, type Lecture } from "./acces";
import { DEFINITIONS, type Etape, type Teinte } from "./etapes";
import { clientDuProjet, linearDuProjet, projetDuLinear } from "./nomenclature";
import type { DocumentProjet } from "./projet";
import { trierProjets, type ProjetLinear, type StatutLinear } from "../portail/projets-linear";

/* ---- Projets Linear (spec 2026-09-30, barre par workspace, §4 et §5) ------ */

/** Un projet tel que la barre et sa page l'affichent. */
export interface ProjetPortail {
  slugId: string;
  /** Segment d'adresse : `/projets/<segment>`. */
  segment: string;
  titre: string;
  resume: string | null;
  /** `null` quand Linear n'a pas répondu. */
  statut: StatutLinear | null;
  debut: string | null;
  fin: string | null;
  /** Le projet de la nomenclature, qui porte les documents. `null` : aucun document. */
  nomenclature: string | null;
  /** UUID du projet Linear. `null` quand Linear n'a pas répondu. */
  idLinear: string | null;
  /** Projet vendu en heures : la page montre les heures restantes. */
  pack: boolean;
}

/**
 * Les projets d'un workspace. `linear` : les projets de sa sous-team, ou `null`
 * quand Linear n'a pas répondu. Dans ce cas, repli sur les projets de la table
 * qui ont un document lisible, sans résumé, statut ni dates (spec §4.4).
 */
export function projetsDuWorkspace(
  linear: ProjetLinear[] | null,
  documents: DocumentProjet[],
  cle: string | undefined,
  lisible: (d: DocumentProjet) => boolean,
): ProjetPortail[] {
  /* Le projet Linear de la table n'est retenu que s'il appartient au CLIENT
     de ce workspace : un projet Linear d'une autre sous-team peut, par
     erreur ou coïncidence de slugId, être relié à un projet de la table qui
     appartient à un autre client. Sans ce garde, ses documents (dont une
     proposition au prix d'un autre client) seraient servis sous ce workspace
     (spec 2026-09-30, barre par workspace, §4.3). */
  const nomenclatureDuClient = (slugId: string) => {
    const projet = projetDuLinear(slugId);
    return projet && clientDuProjet(projet) === cle ? projet : null;
  };
  if (linear) {
    return trierProjets(linear).map((p) => ({
      slugId: p.slugId,
      segment: p.segment,
      titre: p.nom,
      resume: p.resume || null,
      statut: p.statut,
      debut: p.debut,
      fin: p.fin,
      nomenclature: nomenclatureDuClient(p.slugId),
      idLinear: p.id,
      pack: p.pack,
    }));
  }
  if (!cle) return [];
  const parProjet = new Map<string, DocumentProjet[]>();
  for (const d of documents) {
    if (d.versionDe || !d.projet || clientDuProjet(d.projet) !== cle || !lisible(d)) continue;
    parProjet.set(d.projet, [...(parProjet.get(d.projet) ?? []), d]);
  }
  const plusRecent = (docs: DocumentProjet[]) => Math.max(...docs.map((d) => d.date?.getTime() ?? 0));
  return [...parProjet.entries()]
    .sort(([, a], [, b]) => plusRecent(b) - plusRecent(a))
    .map(([projet, docs]) => {
      // La table garantit l'identifiant : le build échoue sans lui.
      const slugId = linearDuProjet(projet) as string;
      return {
        slugId,
        segment: slugId,
        titre: docs[0].titreProjet ?? projet,
        resume: null,
        statut: null,
        debut: null,
        fin: null,
        nomenclature: projet,
        idLinear: null,
        pack: false,
      };
    });
}

/** Le chemin d'un projet sous /espace. Toujours passer le résultat à portalHref. */
export const cheminProjet = (p: Pick<ProjetPortail, "segment">) => `/projets/${p.segment}`;

/** Le slugId Linear qui termine un segment d'adresse, ou `null`. */
export function slugIdDe(segment: string): string | null {
  const m = /(?:^|-)([0-9a-f]{12})$/.exec(segment);
  return m ? m[1] : null;
}

/** Un onglet d'étape de la page projet. */
export interface OngletEtape {
  etape: Etape;
  /** « 2 · Proposition » */
  libelle: string;
  teinte: Teinte;
  /** La racine de l'étape. `null` : l'onglet est grisé. */
  racine: DocumentProjet | null;
  /** Les versions que le compte lit, racine comprise. */
  ids: string[];
  bandeaux: Record<string, Bandeau>;
  /** Date du document lisible le plus récent de l'étape, en ms. 0 sans document. */
  recent: number;
}

/**
 * Les onglets d'un projet, dans l'ordre de la frise. Une étape sans document
 * lisible par le compte garde son onglet, grisé : un brouillon que le client
 * ne lit pas compte comme absent. L'audit n'a d'onglet que s'il existe.
 */
export function ongletsDuProjet(
  documents: DocumentProjet[],
  nomenclature: string | null,
  lire: (d: DocumentProjet) => Lecture,
): OngletEtape[] {
  const onglets: OngletEtape[] = [];
  for (const def of DEFINITIONS) {
    const candidate = nomenclature
      ? documents.find((d) => !d.versionDe && d.projet === nomenclature && d.etape === def.etape)
      : undefined;
    const lues = candidate ? versionsDuPortail(documents, candidate, lire) : { ids: [], bandeaux: {} };
    const racine = candidate && lues.ids.length > 0 ? candidate : null;
    if (def.etape === "audit" && !racine) continue;
    const dates = documents
      .filter((d) => racine && d.collection === racine.collection && lues.ids.includes(d.id))
      .map((d) => d.date?.getTime() ?? 0);
    onglets.push({
      etape: def.etape,
      libelle: `${def.numero} · ${def.libelle}`,
      teinte: def.teinte,
      racine,
      ids: racine ? lues.ids : [],
      bandeaux: racine ? lues.bandeaux : {},
      recent: Math.max(0, ...dates),
    });
  }
  return onglets;
}

/**
 * L'étape ouverte à l'arrivée : celle que l'adresse demande si elle a un
 * document, sinon celle du document le plus récent. À égalité, la plus
 * avancée. `null` quand toutes sont grisées.
 */
export function ongletOuvert(onglets: OngletEtape[], demande: string | null): Etape | null {
  const disponibles = onglets.filter((o) => o.racine);
  const voulu = disponibles.find((o) => o.etape === demande);
  if (voulu) return voulu.etape;
  if (disponibles.length === 0) return null;
  return disponibles.reduce((a, b) => (b.recent >= a.recent ? b : a)).etape;
}

/**
 * Le pack d'heures où se rangent les nouvelles demandes du workspace : le
 * premier pack planifié ou en cours, dans l'ordre de la barre. Un pack pas
 * encore payé (Proposal) ou terminé n'en reçoit pas. `undefined` : aucune
 * demande ne se rattache à un pack.
 */
export function packActif(projets: ProjetPortail[]): ProjetPortail | undefined {
  return projets.find(
    (p) => p.pack && p.idLinear && (p.statut?.type === "planned" || p.statut?.type === "started"),
  );
}
