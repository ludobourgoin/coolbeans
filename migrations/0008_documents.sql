-- Documents du workspace client (spec 2026-09-08-documents-workspace-design.md).
--
-- D1 est le registre de TOUT, quelle que soit la nature du document. Le
-- contenu n'est jamais dupliqué : une ligne 'page' ou 'lien' ne stocke qu'une
-- URL. Ce que la base stocke, c'est la décision de montrer.
--
-- La visibilité n'est pas dérivée du contenu (une date d'envoi lue dans un
-- YAML, par exemple) : basculer un document demanderait alors un commit et un
-- déploiement, alors qu'il faut un clic. Et une date d'envoi est une
-- déduction, pas une décision.

CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  client       TEXT NOT NULL,           -- slug du registre src/content/clients/
  titre        TEXT NOT NULL,           -- champ `titre` du YAML, ou nom du fichier déposé
  source       TEXT NOT NULL CHECK (source IN ('fichier', 'page', 'lien')),
  r2_key       TEXT,                    -- source 'fichier' uniquement
  url          TEXT,                    -- sources 'page' et 'lien'
  mime         TEXT,                    -- source 'fichier' uniquement
  taille       INTEGER,                 -- octets, source 'fichier'
  date_doc     TEXT NOT NULL,           -- date affichée et clé de tri
  -- L'invariant central : rien n'est montré sans un geste explicite.
  visible      INTEGER NOT NULL DEFAULT 0,
  cree_le      TEXT NOT NULL,
  -- Identité stable d'une page du repo, ex. `devis/cafa/site-web-8791`. Porte
  -- l'idempotence de l'enregistrement automatique.
  cle_source   TEXT
);

CREATE INDEX documents_client_date ON documents (client, date_doc DESC);

-- Index unique PARTIEL : une page du repo ne produit jamais deux lignes, même
-- si l'enregistrement tourne cent fois. Les fichiers et les liens, eux, n'ont
-- pas de clé de source et peuvent coexister autant de fois que voulu.
CREATE UNIQUE INDEX documents_cle_source ON documents (client, cle_source)
  WHERE cle_source IS NOT NULL;

-- La famille de picto n'est volontairement PAS stockée : elle se calcule au
-- rendu depuis le MIME ou l'hôte de l'URL. Une colonne l'aurait figée le jour
-- où la fonction apprend un nouveau service.
