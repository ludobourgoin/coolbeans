// Accès D1 de la messagerie. Une fonction = une requête. Le binding est passé
// en argument (pattern *In de clients.ts) : testable sans Cloudflare.

export interface TicketRow {
  id: string;
  client: string;
  linear_issue_uuid: string | null;
  linear_issue_url: string | null;
  author_clerk_id: string;
  author_prenom: string;
  author_email: string;
  created_via: "portail" | "admin";
  objet: string;
  created_at: string;
  last_message_at: string;
  /** 1 = fil retiré du portail (label « Support » enlevé côté Linear). */
  masque: number;
  /** 1 = fil ouvert depuis Linear, pas depuis un formulaire du portail. */
  ouvert_depuis_linear: number;
}

/** Ligne de la file d'attente des ouvertures (migration 0003). */
export interface OuvertureRow {
  linear_issue_uuid: string;
  client: string;
  destinataire_clerk_id: string;
  destinataire_prenom: string;
  destinataire_email: string;
  publish_after: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  ticket_id: string;
  direction: "client" | "coolbeans";
  body: string;
  linear_comment_id: string | null;
  email_status: "none" | "sent" | "failed";
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  r2_key: string;
  filename: string;
  size: number;
  mime: string;
}

export async function creerTicket(db: D1Database, t: TicketRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tickets (id, client, linear_issue_uuid, linear_issue_url, author_clerk_id,
         author_prenom, author_email, created_via, objet, created_at, last_message_at,
         masque, ouvert_depuis_linear)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      t.id, t.client, t.linear_issue_uuid, t.linear_issue_url, t.author_clerk_id,
      t.author_prenom, t.author_email, t.created_via, t.objet, t.created_at, t.last_message_at,
      t.masque, t.ouvert_depuis_linear,
    )
    .run();
}

/** Fils visibles par le client : les masqués n'en font pas partie. */
export async function ticketsDuClient(db: D1Database, client: string): Promise<TicketRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM tickets WHERE client = ? AND masque = 0 ORDER BY last_message_at DESC`,
    )
    .bind(client)
    .all<TicketRow>();
  return results;
}

/**
 * Masque ou démasque un fil. Appelé quand le label « Support » est retiré de
 * l'issue (ou reposé) : le fil sort du portail sans que rien ne soit détruit,
 * parce que le mail de notification, lui, est déjà parti chez le client.
 */
export async function masquerTicket(
  db: D1Database,
  issueUuid: string,
  masque: boolean,
): Promise<void> {
  await db
    .prepare(`UPDATE tickets SET masque = ? WHERE linear_issue_uuid = ?`)
    .bind(masque ? 1 : 0, issueUuid)
    .run();
}

export async function ticketParId(db: D1Database, id: string): Promise<TicketRow | null> {
  return db.prepare(`SELECT * FROM tickets WHERE id = ?`).bind(id).first<TicketRow>();
}

export async function ticketParIssueUuid(db: D1Database, uuid: string): Promise<TicketRow | null> {
  return db
    .prepare(`SELECT * FROM tickets WHERE linear_issue_uuid = ?`)
    .bind(uuid)
    .first<TicketRow>();
}

export async function majIssue(
  db: D1Database, ticketId: string, issueUuid: string, issueUrl: string,
): Promise<void> {
  await db
    .prepare(`UPDATE tickets SET linear_issue_uuid = ?, linear_issue_url = ? WHERE id = ?`)
    .bind(issueUuid, issueUrl, ticketId)
    .run();
}

/** false = commentaire déjà publié (webhook rejoué) : ne rien renvoyer deux fois. */
export async function ajouterMessage(db: D1Database, m: MessageRow): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO messages (id, ticket_id, direction, body, linear_comment_id, email_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(m.id, m.ticket_id, m.direction, m.body, m.linear_comment_id, m.email_status, m.created_at)
    .run();
  const insere = res.meta.changes > 0;
  if (insere) {
    await db
      .prepare(`UPDATE tickets SET last_message_at = ? WHERE id = ?`)
      .bind(m.created_at, m.ticket_id)
      .run();
  }
  return insere;
}

export async function messageParId(db: D1Database, id: string): Promise<MessageRow | null> {
  return db.prepare(`SELECT * FROM messages WHERE id = ?`).bind(id).first<MessageRow>();
}

export async function messagesDuTicket(db: D1Database, ticketId: string): Promise<MessageRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at`)
    .bind(ticketId)
    .all<MessageRow>();
  return results;
}

export async function majEmailStatus(
  db: D1Database, messageId: string, status: "sent" | "failed",
): Promise<void> {
  await db.prepare(`UPDATE messages SET email_status = ? WHERE id = ?`).bind(status, messageId).run();
}

/* ---- File d'attente des ouvertures depuis Linear (migration 0003) ------ */

/** Idempotent : un label reposé pendant le délai ne duplique pas la ligne. */
export async function enfilerOuverture(db: D1Database, o: OuvertureRow): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO pending_ouvertures (linear_issue_uuid, client,
         destinataire_clerk_id, destinataire_prenom, destinataire_email,
         publish_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      o.linear_issue_uuid, o.client, o.destinataire_clerk_id, o.destinataire_prenom,
      o.destinataire_email, o.publish_after, o.created_at,
    )
    .run();
}

export async function ouverturesDues(db: D1Database, maintenant: string): Promise<OuvertureRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM pending_ouvertures WHERE publish_after <= ? ORDER BY publish_after`)
    .bind(maintenant)
    .all<OuvertureRow>();
  return results;
}

export async function supprimerOuverture(db: D1Database, issueUuid: string): Promise<void> {
  await db
    .prepare(`DELETE FROM pending_ouvertures WHERE linear_issue_uuid = ?`)
    .bind(issueUuid)
    .run();
}

/** Même borne que les publications : un due empoisonné ne se retente pas sans fin. */
export async function purgerOuverturesAbandonnees(
  db: D1Database,
  avant: string,
): Promise<number> {
  const { meta } = await db
    .prepare(`DELETE FROM pending_ouvertures WHERE created_at < ?`)
    .bind(avant)
    .run();
  return meta.changes ?? 0;
}

export async function ajouterPieceJointe(db: D1Database, a: AttachmentRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO attachments (id, message_id, r2_key, filename, size, mime) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(a.id, a.message_id, a.r2_key, a.filename, a.size, a.mime)
    .run();
}

export async function piecesJointesDuTicket(
  db: D1Database, ticketId: string,
): Promise<AttachmentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.* FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.ticket_id = ?`,
    )
    .bind(ticketId)
    .all<AttachmentRow>();
  return results;
}

export async function pieceJointeParId(db: D1Database, id: string): Promise<AttachmentRow | null> {
  return db.prepare(`SELECT * FROM attachments WHERE id = ?`).bind(id).first<AttachmentRow>();
}

export async function enfilerPublication(
  db: D1Database,
  p: { linear_comment_id: string; ticket_id: string; publish_after: string; created_at: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO pending_publications (linear_comment_id, ticket_id, publish_after, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(p.linear_comment_id, p.ticket_id, p.publish_after, p.created_at)
    .run();
}

export async function publicationsDues(
  db: D1Database, maintenant: string,
): Promise<Array<{ linear_comment_id: string; ticket_id: string }>> {
  const { results } = await db
    .prepare(`SELECT linear_comment_id, ticket_id FROM pending_publications WHERE publish_after <= ?`)
    .bind(maintenant)
    .all<{ linear_comment_id: string; ticket_id: string }>();
  return results;
}

export async function supprimerPublication(db: D1Database, linearCommentId: string): Promise<void> {
  await db
    .prepare(`DELETE FROM pending_publications WHERE linear_comment_id = ?`)
    .bind(linearCommentId)
    .run();
}

/**
 * Purge les pending encore là après `avant` : borne le retry infini d'un due
 * empoisonné (fetchComment qui échoue systématiquement, ticket disparu...) —
 * sans ça une ligne pending peut retenter toutes les 5 min indéfiniment.
 * Retourne le nombre de lignes supprimées.
 */
export async function purgerPublicationsAbandonnees(db: D1Database, avant: string): Promise<number> {
  const res = await db
    .prepare(`DELETE FROM pending_publications WHERE created_at < ?`)
    .bind(avant)
    .run();
  return res.meta.changes;
}
