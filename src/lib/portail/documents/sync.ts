// Enregistrement automatique des pages du repo (spec §4).
//
// Quand Ludo ouvre la page Documents d'un client en vue admin, on compare les
// entrées des collections `cadrage` et `devis` qui appartiennent à ce client
// aux lignes déjà présentes. Les manquantes sont insérées, MASQUÉES.
//
// Idempotent, sans cron ni webhook. La vue client ne déclenche jamais cet
// enregistrement : elle lit, elle n'écrit pas.
//
// Conséquence voulue : une proposition publiée mais pas encore envoyée existe
// dans le registre et reste invisible. C'est arrivé le 2026-09-08 avec le
// cadrage de Nathalie Givois, publié en production et jamais envoyé.

import { clesSourceConnues, insererSiAbsente, type DocumentRow } from "./store";

/* Les pages de devis et de cadrage vivent sur le site public, pas sur le
   portail : elles s'ouvrent dans un nouvel onglet, hors de l'authentification
   du portail, exactement comme quand Ludo en envoie le lien par mail. */
const SITE = "https://coolbeans.cc";

export interface PageDuRepo {
  cleSource: string;
  titre: string;
  url: string;
  date: string;
}

function jour(valeur: Date | string): string {
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(d.getTime()) ? String(valeur).slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * Les pages du repo qui appartiennent à ce client.
 *
 * L'appartenance se lit sur le PREMIER segment de l'identifiant de collection
 * (`cafa/site-web-8791`), et jamais sur un `startsWith` de la chaîne entière :
 * sans ça, le client `osmose` ramasserait les documents d'un futur
 * `osmose-conseil`.
 */
export async function pagesDuRepo(client: string): Promise<PageDuRepo[]> {
  /* Import dynamique et non statique : `astro:content` est un module virtuel,
     indisponible sous Vitest. Le garder en tête de fichier rendrait tout ce
     module intestable, `orphelines` comprise, alors qu'elle est pure. Même
     contrainte que require-admin.ts. */
  const { getCollection } = await import("astro:content");
  const [devis, cadrages] = await Promise.all([getCollection("devis"), getCollection("cadrage")]);

  const pages: PageDuRepo[] = [];
  for (const [prefixe, entrees] of [
    ["devis", devis],
    ["cadrage", cadrages],
  ] as const) {
    for (const entree of entrees) {
      if (entree.id.split("/")[0] !== client) continue;
      pages.push({
        cleSource: `${prefixe}/${entree.id}`,
        /* Écart assumé avec la spec §3, qui dit « le champ `titre` du YAML ».
           Ce champ vaut « <Client> x Coolbeans » sur tous les documents d'un
           même client : une liste de trois propositions porterait trois fois
           le même nom. `objet` est ce qui les distingue. Le `titre` reste le
           filet quand `objet` manque. */
        titre: entree.data.objet || entree.data.titre,
        url: `${SITE}/${prefixe}/${entree.id}`,
        date: jour(entree.data.date),
      });
    }
  }
  return pages;
}

/**
 * Insère les pages du repo encore absentes du registre, masquées.
 *
 * Ne supprime jamais. Une page retirée du repo garde sa ligne : une
 * suppression silencieuse ferait disparaître un document que le client voyait
 * la veille. Elle est signalée comme orpheline en vue admin, cf. `orphelines`.
 */
export async function synchroniserPagesDuRepo(db: D1Database, client: string): Promise<void> {
  const pages = await pagesDuRepo(client);
  if (pages.length === 0) return;

  const connues = await clesSourceConnues(db, client);
  const maintenant = new Date().toISOString();

  for (const page of pages) {
    if (connues.has(page.cleSource)) continue;
    const ligne: DocumentRow = {
      id: crypto.randomUUID(),
      client,
      titre: page.titre,
      source: "page",
      r2_key: null,
      url: page.url,
      mime: null,
      taille: null,
      date_doc: page.date,
      visible: 0, // l'invariant : rien n'est montré sans un geste explicite
      cree_le: maintenant,
      cle_source: page.cleSource,
    };
    await insererSiAbsente(db, ligne);
  }
}

/**
 * Les clés de source qui n'existent plus dans le repo. Sert au seul signalement
 * en vue admin.
 */
export function orphelines(clesEnBase: (string | null)[], pages: PageDuRepo[]): Set<string> {
  const vivantes = new Set(pages.map((p) => p.cleSource));
  const mortes = new Set<string>();
  for (const cle of clesEnBase) {
    if (cle && !vivantes.has(cle)) mortes.add(cle);
  }
  return mortes;
}
