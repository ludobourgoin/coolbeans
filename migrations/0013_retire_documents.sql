-- Retire le registre des fichiers déposés (COO-305, spec
-- 2026-09-30-barre-portail-par-workspace-design.md §7.2). Plus aucun code ne
-- le lit depuis la mise en prod du 2026-10-02.
--
-- Vérifié avant suppression, le 2026-10-02 : la table était vide en prod et en
-- staging, et aucun objet R2 ne restait sous le préfixe `documents/`. Les
-- index partent avec la table.

DROP TABLE IF EXISTS documents;
