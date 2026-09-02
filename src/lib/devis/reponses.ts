import { env } from "cloudflare:workers";

/* Réponses aux devis publics, persistées en D1 (table devis_reponses,
   migration 0002) avant la notification mail : le cockpit /espace/devis en
   dérive le statut « Répondu ». */

export interface NouvelleReponse {
  slug: string;
  decision: "validation" | "question";
  message: string | null;
  prenom: string;
  nom: string;
  email: string;
  /* Coordonnées de facturation, saisies au moment d'une validation. Elles ne
     vivaient que dans le corps du mail de notification, ce qui obligeait à
     rouvrir sa boîte mail pour facturer (migration 0006). Toutes nullables :
     un client qui répond en tant que particulier n'a ni raison sociale ni
     SIREN, et une simple question n'en fournit aucune. */
  raisonSociale?: string | null;
  siren?: string | null;
  adresse?: string | null;
  tva?: string | null;
  /* Périmètre composé par le client sur un devis à options (migration 0007).
     `optionsRetenues` est le JSON des index cochés ; `montantRetenu` le total
     recalculé côté serveur depuis le YAML — jamais celui qu'a envoyé le
     navigateur. Nuls sur un devis sans ligne optionnelle. */
  optionsRetenues?: string | null;
  montantRetenu?: number | null;
}

export type ReponseDevis = NouvelleReponse & {
  id: number;
  createdAt: string;
  /* Sous-issue Linear de facturation créée à la validation. Sa présence dit
     que le déclenchement a déjà eu lieu : c'est le garde-fou contre une
     seconde soumission du même devis. */
  linearTaskId?: string | null;
};

/* Typage structurel du binding D1 : évite de dépendre de
   @cloudflare/workers-types et permet le mock mémoire dans les tests,
   même logique que KVLike dans ../chiffrage/store.ts. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T>(): Promise<{ results: T[] }>;
    };
    all<T>(): Promise<{ results: T[] }>;
  };
}

export const db = (): D1Like => (env as unknown as { PORTAL_DB: D1Like }).PORTAL_DB;

const SQL_INSERT =
  "INSERT INTO devis_reponses " +
  "(slug, decision, message, prenom, nom, email, raison_sociale, siren, adresse, tva, " +
  "options_retenues, montant_retenu) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/* Colonnes communes aux trois SELECT : elles doivent rester alignées, une
   colonne ajoutée ici et oubliée là produit un champ silencieusement absent
   du cockpit plutôt qu'une erreur. */
const COLONNES =
  "slug, decision, message, prenom, nom, email, raison_sociale AS raisonSociale, " +
  "siren, adresse, tva, options_retenues AS optionsRetenues, " +
  "montant_retenu AS montantRetenu, linear_task_id AS linearTaskId, created_at AS createdAt";

/* L'INSERT ne rend pas l'id sous D1Like : on relit la dernière ligne du slug
   pour connaître la réponse qu'on vient d'écrire, et pouvoir y accrocher
   l'identifiant de la tâche Linear. */
const SQL_DERNIERE =
  `SELECT id, ${COLONNES} ` + "FROM devis_reponses WHERE slug = ? ORDER BY id DESC LIMIT 1";

const SQL_MARQUER_TACHE = "UPDATE devis_reponses SET linear_task_id = ? WHERE id = ?";

/* Idempotence : une tâche de facturation déjà accrochée à N'IMPORTE quelle
   réponse du devis interdit d'en créer une seconde. Un client qui soumet deux
   fois le formulaire — double-clic, retour arrière, relance — ne doit pas
   produire deux tâches ni repasser l'affaire en « Proposition validée » à
   chaque fois. */
const SQL_TACHE_EXISTANTE =
  "SELECT linear_task_id AS linearTaskId FROM devis_reponses " +
  "WHERE slug = ? AND linear_task_id IS NOT NULL LIMIT 1";

/* Une seule ligne par slug — la plus récente (MAX(id) : en GROUP BY, SQLite
   prend les colonnes nues sur la ligne du MAX). La table est append-only et
   grossit sans borne : le cockpit n'a besoin que du dernier état de chaque
   devis, jamais de l'historique complet. */
const SQL_LISTE =
  `SELECT MAX(id) AS id, ${COLONNES} ` +
  "FROM devis_reponses GROUP BY slug ORDER BY createdAt DESC";

export async function enregistrerReponse(r: NouvelleReponse, d1: D1Like = db()): Promise<void> {
  await d1
    .prepare(SQL_INSERT)
    .bind(
      r.slug,
      r.decision,
      r.message,
      r.prenom,
      r.nom,
      r.email,
      r.raisonSociale ?? null,
      r.siren ?? null,
      r.adresse ?? null,
      r.tva ?? null,
      r.optionsRetenues ?? null,
      r.montantRetenu ?? null,
    )
    .run();
}

/** Dernière réponse enregistrée pour un devis, ou undefined s'il n'y en a pas. */
export async function derniereReponse(
  slug: string,
  d1: D1Like = db(),
): Promise<ReponseDevis | undefined> {
  const { results } = await d1.prepare(SQL_DERNIERE).bind(slug).all<ReponseDevis>();
  return results[0];
}

/** Identifiant de la tâche de facturation déjà créée pour ce devis, s'il y en a une. */
export async function tacheExistante(slug: string, d1: D1Like = db()): Promise<string | null> {
  const { results } = await d1
    .prepare(SQL_TACHE_EXISTANTE)
    .bind(slug)
    .all<{ linearTaskId: string }>();
  return results[0]?.linearTaskId ?? null;
}

/** Accroche la sous-issue Linear de facturation à la réponse qui l'a déclenchée. */
export async function marquerTacheLinear(
  id: number,
  taskId: string,
  d1: D1Like = db(),
): Promise<void> {
  await d1.prepare(SQL_MARQUER_TACHE).bind(taskId, id).run();
}

/* Dernière réponse de chaque devis, de la plus récente à la plus ancienne. */
export async function listerReponses(d1: D1Like = db()): Promise<ReponseDevis[]> {
  const { results } = await d1.prepare(SQL_LISTE).all<ReponseDevis>();
  return results;
}
