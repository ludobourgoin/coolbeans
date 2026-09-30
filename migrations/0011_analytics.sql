-- Mesures d'audience des sites clients (COO-16, spec
-- 2026-09-29-portail-analytics-design.md §3.3).
--
-- Cloudflare Web Analytics ne rend des chiffres exacts que pour un jour isolé
-- des sept derniers jours. Le cron les relit chaque nuit et les stocke ici :
-- cette base devient l'historique exact, que Cloudflare ne garde pas.
--
-- Un jour s'écrit d'un bloc (efface puis réécrit) : une page qui n'a plus de
-- visite ce jour-là disparaît aussi de la base.

CREATE TABLE analytics_jours (
  site_tag    TEXT NOT NULL,              -- identifiant du site chez Cloudflare
  jour        TEXT NOT NULL,              -- AAAA-MM-JJ, UTC
  visites     INTEGER NOT NULL,
  pages_vues  INTEGER NOT NULL,
  echantillon INTEGER NOT NULL DEFAULT 1, -- 1 = exact, 10 = une mesure sur dix
  PRIMARY KEY (site_tag, jour)
);

-- `jour` est en deuxième position de la clé primaire, donc `DELETE ... WHERE
-- jour = ?` (la réécriture nocturne) ne s'en sert pas et parcourt toute la
-- table. D1 Free compte chaque ligne lue : sans l'index, cette lecture grossit
-- avec l'historique.
CREATE INDEX analytics_jours_jour ON analytics_jours (jour);

CREATE TABLE analytics_repartitions (
  site_tag   TEXT NOT NULL,
  jour       TEXT NOT NULL,
  dimension  TEXT NOT NULL CHECK (dimension IN ('page', 'provenance', 'appareil')),
  valeur     TEXT NOT NULL,               -- chemin, host d'origine ('' = accès direct), type d'appareil
  visites    INTEGER NOT NULL,
  pages_vues INTEGER NOT NULL,
  PRIMARY KEY (site_tag, jour, dimension, valeur)
);

-- Même raison que analytics_jours_jour ci-dessus.
CREATE INDEX analytics_repartitions_jour ON analytics_repartitions (jour);

-- Jours effectivement collectés, tous sites confondus. Distingue un jour sans
-- trafic (collecté, aucune ligne) d'un jour jamais collecté (absent). C'est
-- aussi la preuve que le cron tourne : ses journaux ne sont pas consultables.
CREATE TABLE analytics_collectes (
  jour        TEXT PRIMARY KEY,
  collecte_le TEXT NOT NULL               -- ISO 8601
);
