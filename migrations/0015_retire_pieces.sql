-- Retire le registre des pièces Tiime (migration 0014). Les devis et factures
-- d'un projet sont désormais les PDF de son dossier R2,
-- pieces/<workspace>/<projet Linear>/ : plus aucun code ne lit cette table.
--
-- Simplification décidée par Ludo le 2026-10-03 : ni statut, ni montant, ni
-- page admin. Les 23 lignes importées le 2026-10-03 ne portaient rien que les
-- PDF ne disent déjà. L'index part avec la table.

DROP TABLE IF EXISTS pieces;
