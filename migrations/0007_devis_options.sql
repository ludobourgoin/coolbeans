-- Périmètre composé par le client au moment où il répond.
--
-- `devis_reponses` n'enregistrait que l'identité et la décision : sur un devis
-- à options, elle ne disait donc pas ce qui avait été acheté. Constaté sur
-- CAFA le 2026-09-01 — deux options validées par mail (250 € + 480 €) pour un
-- devis dont le montant enregistré n'en portait aucune, soit 730 € qui ne
-- reposaient que sur un fil de discussion.
--
-- `options_retenues` : tableau JSON des index de lignes cochées, tel que reçu.
-- `montant_retenu`   : total recalculé CÔTÉ SERVEUR depuis le YAML, remises en
--                      cascade comprises. Jamais la valeur envoyée par le
--                      navigateur — elle est modifiable par qui ouvre la page.
--
-- Colonnes nullables : les réponses déjà en base n'en ont pas, et un devis
-- sans aucune ligne optionnelle n'en produit pas davantage.
ALTER TABLE devis_reponses ADD COLUMN options_retenues TEXT;
ALTER TABLE devis_reponses ADD COLUMN montant_retenu REAL;
