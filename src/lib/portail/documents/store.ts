// Accès D1 des documents. Une fonction = une requête. Le binding est passé en
// argument (patron de messagerie/store.ts) : testable sans Cloudflare.

export interface DocumentRow {
  id: string;
  client: string;
  titre: string;
  source: "fichier" | "page" | "lien";
  r2_key: string | null;
  url: string | null;
  mime: string | null;
  taille: number | null;
  date_doc: string;
  /** 1 = montré au client. 0 par défaut, cf. migration 0008. */
  visible: number;
  cree_le: string;
  /** Chemin du YAML dans le repo pour une page, `null` sinon. */
  cle_source: string | null;
}

/**
 * Vue ADMIN : toutes les lignes du client, masquées comprises.
 *
 * Ne jamais appeler pour un rôle client. Le filtre de visibilité vit dans la
 * requête et pas dans le rendu : une ligne masquée ne doit pas atteindre le
 * navigateur d'un client, même cachée en CSS.
 */
export async function documentsDuClientAdmin(
  db: D1Database,
  client: string,
): Promise<DocumentRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM documents WHERE client = ? ORDER BY date_doc DESC, cree_le DESC`)
    .bind(client)
    .all<DocumentRow>();
  return results;
}

/** Vue CLIENT et REVENDEUR : les lignes visibles, filtrées en SQL. */
export async function documentsVisibles(db: D1Database, client: string): Promise<DocumentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM documents WHERE client = ? AND visible = 1 ORDER BY date_doc DESC, cree_le DESC`,
    )
    .bind(client)
    .all<DocumentRow>();
  return results;
}

export async function documentParId(db: D1Database, id: string): Promise<DocumentRow | null> {
  return await db.prepare(`SELECT * FROM documents WHERE id = ?`).bind(id).first<DocumentRow>();
}

export async function creerDocument(db: D1Database, d: DocumentRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO documents (id, client, titre, source, r2_key, url, mime, taille,
         date_doc, visible, cree_le, cle_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      d.id, d.client, d.titre, d.source, d.r2_key, d.url, d.mime, d.taille,
      d.date_doc, d.visible, d.cree_le, d.cle_source,
    )
    .run();
}

/**
 * Insère une page du repo si elle n'est pas déjà connue, et ne fait rien
 * sinon. L'idempotence est portée par l'index unique partiel de la migration
 * plutôt que par un SELECT préalable : deux rendus concurrents de la vue admin
 * ne peuvent pas créer de doublon.
 */
export async function insererSiAbsente(db: D1Database, d: DocumentRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO documents (id, client, titre, source, r2_key, url, mime, taille,
         date_doc, visible, cree_le, cle_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (client, cle_source) DO NOTHING`,
    )
    .bind(
      d.id, d.client, d.titre, d.source, d.r2_key, d.url, d.mime, d.taille,
      d.date_doc, d.visible, d.cree_le, d.cle_source,
    )
    .run();
}

/** Les clés de source déjà enregistrées pour ce client. */
export async function clesSourceConnues(db: D1Database, client: string): Promise<Set<string>> {
  const { results } = await db
    .prepare(`SELECT cle_source FROM documents WHERE client = ? AND cle_source IS NOT NULL`)
    .bind(client)
    .all<{ cle_source: string }>();
  return new Set(results.map((r) => r.cle_source));
}

/**
 * Bascule la visibilité. Le `client` est passé en plus de l'id et entre dans
 * le WHERE : sans lui, un identifiant deviné suffirait à démasquer le document
 * d'un autre client, alors même que la route vérifie déjà le rôle admin.
 */
export async function basculerVisibilite(
  db: D1Database,
  id: string,
  client: string,
  visible: boolean,
): Promise<boolean> {
  const { meta } = await db
    .prepare(`UPDATE documents SET visible = ? WHERE id = ? AND client = ?`)
    .bind(visible ? 1 : 0, id, client)
    .run();
  return (meta.changes ?? 0) > 0;
}
