-- Ouverture d'un fil depuis Linear : Ludo pose le label « Support » sur une
-- issue et le client voit apparaître le fil dans sa messagerie. C'est la
-- deuxième porte d'entrée, symétrique du formulaire du portail, et elle
-- réutilise le même délai de grâce : le webhook enfile, le cron re-fetche et
-- décide. Le re-fetch reste LE mécanisme d'annulation — retirer le « >> » de
-- la description pendant le délai annule l'ouverture.

-- Un fil masqué disparaît du portail sans rien perdre. C'est ce qui se passe
-- quand le label est retiré : le mail de notification, lui, est déjà parti, et
-- détruire la ligne rendrait le portail menteur vis-à-vis de ce mail. Reposer
-- le label démasque le fil.
ALTER TABLE tickets ADD COLUMN masque INTEGER NOT NULL DEFAULT 0;

-- Un ticket ouvert depuis Linear garde created_via = 'admin' (Ludo en est bien
-- à l'origine) : le CHECK de la table ne se change pas sans la reconstruire,
-- et le jeu ne vaut pas la chandelle pour une valeur d'énumération. Ce drapeau
-- porte la distinction utile — d'où vient le fil, pas qui l'a écrit.
ALTER TABLE tickets ADD COLUMN ouvert_depuis_linear INTEGER NOT NULL DEFAULT 0;

-- File du délai de grâce des ouvertures, jumelle de pending_publications. Le
-- destinataire est résolu ici, par le webhook qui a un contexte Astro donc un
-- accès Clerk : le cron n'a plus qu'à écrire et envoyer.
CREATE TABLE pending_ouvertures (
  linear_issue_uuid TEXT PRIMARY KEY,
  client TEXT NOT NULL,                -- slug du registre src/content/clients/
  destinataire_clerk_id TEXT NOT NULL,
  destinataire_prenom TEXT NOT NULL,
  destinataire_email TEXT NOT NULL,
  publish_after TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_pending_ouvertures_due ON pending_ouvertures(publish_after);
