-- Messagerie du portail (spec 2026-08-15-messagerie-portail-design.md §4).
-- D1 = registre des tickets + journal publié APPEND-ONLY : messages ne
-- contient que du contenu publié, jamais de brouillon. La file d'attente du
-- délai de grâce vit dans pending_publications, purgée après publication.

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,                -- slug du registre src/content/clients/
  linear_issue_uuid TEXT,              -- UUID interne Linear (jamais AMU-36) ; NULL si création Linear en échec, ré-appairable
  linear_issue_url TEXT,
  author_clerk_id TEXT NOT NULL,
  author_prenom TEXT NOT NULL,         -- copié à la création : le board n'appelle pas Clerk
  author_email TEXT NOT NULL,          -- destinataire des notifications du fil
  created_via TEXT NOT NULL DEFAULT 'portail' CHECK (created_via IN ('portail', 'admin')),
  objet TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);
CREATE INDEX idx_tickets_client ON tickets(client, last_message_at DESC);
CREATE UNIQUE INDEX idx_tickets_issue ON tickets(linear_issue_uuid);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  direction TEXT NOT NULL CHECK (direction IN ('client', 'coolbeans')),
  body TEXT NOT NULL,                  -- markdown, figé à la publication
  linear_comment_id TEXT UNIQUE,       -- idempotence webhook ; NULL pour les messages client
  email_status TEXT NOT NULL DEFAULT 'none' CHECK (email_status IN ('none', 'sent', 'failed')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_ticket ON messages(ticket_id, created_at);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL
);
CREATE INDEX idx_attachments_message ON attachments(message_id);

-- File du délai de grâce : une ligne par commentaire ">>" détecté par le
-- webhook, consommée par le cron une fois publish_after dépassé.
CREATE TABLE pending_publications (
  linear_comment_id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  publish_after TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_pending_due ON pending_publications(publish_after);
