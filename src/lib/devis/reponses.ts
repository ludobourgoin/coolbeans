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
}

export type ReponseDevis = NouvelleReponse & { id: number; createdAt: string };

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
  "INSERT INTO devis_reponses (slug, decision, message, prenom, nom, email) VALUES (?, ?, ?, ?, ?, ?)";

/* Une seule ligne par slug — la plus récente (MAX(id) : en GROUP BY, SQLite
   prend les colonnes nues sur la ligne du MAX). La table est append-only et
   grossit sans borne : le cockpit n'a besoin que du dernier état de chaque
   devis, jamais de l'historique complet. */
const SQL_LISTE =
  "SELECT MAX(id) AS id, slug, decision, message, prenom, nom, email, created_at AS createdAt " +
  "FROM devis_reponses GROUP BY slug ORDER BY createdAt DESC";

export async function enregistrerReponse(
  r: NouvelleReponse,
  d1: D1Like = db(),
): Promise<void> {
  await d1.prepare(SQL_INSERT).bind(r.slug, r.decision, r.message, r.prenom, r.nom, r.email).run();
}

/* Dernière réponse de chaque devis, de la plus récente à la plus ancienne. */
export async function listerReponses(d1: D1Like = db()): Promise<ReponseDevis[]> {
  const { results } = await d1.prepare(SQL_LISTE).all<ReponseDevis>();
  return results;
}
