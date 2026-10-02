-- Registre des pièces comptables Tiime (devis, factures, avoirs) affichées
-- dans la page projet du portail (spec 2026-10-02-devis-et-factures-page-projet-design.md).
--
-- Tiime n'a pas d'API : les lignes arrivent par scripts/importer-pieces.mts,
-- depuis un manifeste rédigé à partir de l'export. Les PDF sont dans R2, sous
-- r2_key. L'admin rattache une pièce à un projet et note les règlements.

CREATE TABLE pieces (
  id             TEXT PRIMARY KEY,               -- 'facture-024624'
  type           TEXT NOT NULL CHECK (type IN ('devis', 'facture', 'avoir')),
  numero         TEXT NOT NULL,                  -- '024624', zéros compris
  categorie      TEXT CHECK (categorie IS NULL OR categorie IN ('acompte', 'intermediaire', 'solde')),
  emise_le       TEXT NOT NULL,                  -- YYYY-MM-DD
  echeance       TEXT,
  ht             INTEGER NOT NULL,               -- centimes, négatifs pour un avoir
  tva            INTEGER NOT NULL,
  ttc            INTEGER NOT NULL,
  statut         TEXT CHECK (statut IS NULL OR statut IN ('a_regler', 'reglee', 'annulee')),
  reglee_le      TEXT,
  client         TEXT,                           -- fiche client
  organisation   TEXT,                           -- fiche revendeur
  projet         TEXT,                           -- slug de la table PROJETS
  raison_sociale TEXT NOT NULL,
  r2_key         TEXT NOT NULL,
  importee_le    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((client IS NULL) <> (organisation IS NULL))
);

CREATE INDEX idx_pieces_client_projet ON pieces (client, projet);
