-- Canal par lequel une réponse est arrivée (spec
-- 2026-09-29-reponses-dans-les-documents-design.md, section « Décisions prises
-- par mail »).
--
-- `origine` dit comment la ligne est entrée en base (par le formulaire, ou
-- reprise après coup). `canal` dit comment le client a répondu. Les deux ne se
-- recouvrent pas : une réponse envoyée par le formulaire avant la table 0009
-- est une reprise, mais elle a bien été donnée par le formulaire, case de
-- consentement comprise. Une décision prise par mail, elle, n'a jamais coché
-- cette case, et la page ne doit pas l'afficher.
--
-- Additive : les lignes existantes prennent 'formulaire', ce qu'elles sont
-- toutes, sauf la validation de la V2 CAFA, corrigée par la reprise.

ALTER TABLE document_reponses ADD COLUMN canal TEXT NOT NULL DEFAULT 'formulaire'
  CHECK (canal IN ('formulaire', 'mail'));

ALTER TABLE devis_reponses ADD COLUMN canal TEXT NOT NULL DEFAULT 'formulaire'
  CHECK (canal IN ('formulaire', 'mail'));
