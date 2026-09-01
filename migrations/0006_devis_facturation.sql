-- Informations de facturation et tâche Linear des devis validés
-- (spec 2026-09-01-cockpit-devis-tableau-crm-design.md).
--
-- Le formulaire de la page publique collecte déjà adresse, raison sociale,
-- SIREN et TVA quand le client valide une proposition, mais ces champs ne
-- vivaient que dans le corps du mail de notification : impossible de facturer
-- depuis le portail sans rouvrir sa boîte mail. Ils rejoignent la table.
--
-- Toutes les colonnes sont nullables : les lignes déjà en base n'ont pas ces
-- valeurs, et un client qui répond en tant que particulier n'a ni raison
-- sociale ni SIREN. Seule l'adresse est exigée par l'API, et seulement sur une
-- validation.
--
-- `linear_task_id` porte l'identifiant de la sous-issue de facturation créée
-- dans Linear à la validation. C'est le garde-fou d'idempotence : une seconde
-- soumission du même devis ne doit pas créer une deuxième tâche.
ALTER TABLE devis_reponses ADD COLUMN raison_sociale TEXT;
ALTER TABLE devis_reponses ADD COLUMN siren TEXT;
ALTER TABLE devis_reponses ADD COLUMN adresse TEXT;
ALTER TABLE devis_reponses ADD COLUMN tva TEXT;
ALTER TABLE devis_reponses ADD COLUMN linear_task_id TEXT;
