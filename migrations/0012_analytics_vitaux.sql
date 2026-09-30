-- Core Web Vitals des sites clients (COO-302, spec
-- 2026-09-30-portail-core-web-vitals-design.md §3.4).
--
-- Même source et même collecte que 0011 : le cron relit chaque nuit J-7 à J-1
-- et réécrit chaque jour d'un bloc. On garde des compteurs, pas des
-- percentiles : les compteurs s'additionnent d'un jour à l'autre, ce qui donne
-- la note de Google sur n'importe quelle période.

CREATE TABLE analytics_vitaux (
  site_tag     TEXT NOT NULL,             -- identifiant du site chez Cloudflare
  jour         TEXT NOT NULL,             -- AAAA-MM-JJ, UTC
  -- Plafond de lignes : 4 appareils au plus, donc 4 lignes au plus par site et par jour.
  appareil     TEXT NOT NULL CHECK (appareil IN ('mobile', 'desktop', 'tablet', 'autre')),
  lcp_bon      INTEGER NOT NULL,
  lcp_moyen    INTEGER NOT NULL,          -- « needs improvement » chez Cloudflare
  lcp_mauvais  INTEGER NOT NULL,
  inp_bon      INTEGER NOT NULL,
  inp_moyen    INTEGER NOT NULL,
  inp_mauvais  INTEGER NOT NULL,
  cls_bon      INTEGER NOT NULL,
  cls_moyen    INTEGER NOT NULL,
  cls_mauvais  INTEGER NOT NULL,
  PRIMARY KEY (site_tag, jour, appareil)
);

-- `jour` est en deuxième position de la clé primaire : sans cet index, la
-- suppression par jour de la réécriture nocturne parcourt toute la table, et
-- D1 Free compte chaque ligne lue.
CREATE INDEX analytics_vitaux_jour ON analytics_vitaux (jour);
