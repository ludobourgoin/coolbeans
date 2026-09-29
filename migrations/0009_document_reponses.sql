-- Réponses aux documents de cadrage, de livrable et de témoignage
-- (spec 2026-09-29-reponses-dans-les-documents-design.md).
--
-- Jusqu'ici, le mail de notification était la seule trace : le supprimer,
-- c'était perdre la réponse. Le choix datait du 2026-09-05 et visait à éviter
-- cette migration. Elle se fait une fois ; un mail perdu l'est pour de bon.
--
-- Les propositions gardent leur table (`devis_reponses`), que le cockpit lit.
--
-- Append-only, comme `devis_reponses` : une réponse n'est jamais modifiée ni
-- supprimée par l'application. C'est aussi ce que la page publique affiche à
-- la place du formulaire.

CREATE TABLE document_reponses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL CHECK (type IN ('cadrage', 'livrable', 'temoignage')),
  slug       TEXT NOT NULL,          -- id de l'entrée de collection, version comprise
  -- Livrable seulement : 'validation' ou 'retours'. Nul pour les deux autres,
  -- dont toute réponse est définitive.
  decision   TEXT CHECK (decision IS NULL OR decision IN ('validation', 'retours')),
  -- Instantané lisible, JSON [{ question, reponse, decisif }] : les libellés
  -- tels que le client les a lus. Un YAML corrigé après coup ne réécrit pas
  -- une réponse déjà donnée. Nul pour le livrable, qui n'a pas de questions.
  reponses   TEXT,
  message    TEXT,
  prenom     TEXT NOT NULL,
  nom        TEXT NOT NULL,
  email      TEXT NOT NULL,
  photo_r2   TEXT,                   -- témoignage : clé R2 de la photo déposée
  -- 'reprise' : réponse recopiée depuis un mail de notification antérieur à
  -- cette table, avec sa date d'origine dans created_at.
  origine    TEXT NOT NULL DEFAULT 'formulaire' CHECK (origine IN ('formulaire', 'reprise')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_document_reponses_slug ON document_reponses (type, slug, id);

-- Même distinction côté propositions : les validations antérieures à la
-- table 0002 seront reprises depuis leurs mails.
ALTER TABLE devis_reponses ADD COLUMN origine TEXT NOT NULL DEFAULT 'formulaire'
  CHECK (origine IN ('formulaire', 'reprise'));
