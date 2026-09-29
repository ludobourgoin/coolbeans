// Accès D1 des documents. Une fonction = une requête. Le binding est passé en
// argument (patron de messagerie/store.ts) : testable sans Cloudflare.

export interface DocumentRow {
  id: string;
  client: string;
  titre: string;
  /* Toujours "fichier" depuis le 2026-09-22. La colonne survit en base,
     avec sa contrainte CHECK d'origine, parce qu'aucune ligne n'a jamais
     été écrite en production : la reprise de la table revient au lot
     Facturation, qui lui ajoutera son statut de règlement. */
  source: "fichier";
  r2_key: string | null;
  url: string | null;
  mime: string | null;
  taille: number | null;
  date_doc: string;
  /** 1 = montré au client. 0 par défaut, cf. migration 0008. */
  visible: number;
  cree_le: string;
  /* Portait l'idempotence de l'enregistrement automatique des pages du
     repo, retiré le 2026-09-22. Toujours `null` désormais ; la colonne et
     son index unique partiel restent en base, inertes. */
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
