-- Réponses aux devis publics (spec 2026-08-17-cockpit-devis-design.md §6).
-- Écrites par api/devis-reponse.ts AVANT l'envoi du mail Resend, lues par le
-- cockpit /espace/devis pour dériver le statut « Répondu ». Append-only : une
-- réponse n'est jamais modifiée ni supprimée par l'application.

CREATE TABLE devis_reponses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,                  -- slug du YAML src/content/devis/<slug>.yaml
  decision TEXT NOT NULL CHECK (decision IN ('validation', 'question')),
  message TEXT,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_devis_reponses_slug ON devis_reponses (slug, created_at DESC);
