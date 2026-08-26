-- Restaure la vue de comparaison des taux de change, appelee par un onglet
-- reellement affiche et absente de la base.
--
-- CONSTAT
-- src/components/fx/FxRateComparison.tsx interroge fx_rate_comparison, puis fait
-- remonter l'erreur. Le composant est monte : FxRatesPage l'affiche sous
-- l'onglet « comparison ». L'onglet est donc hors service, non degrade.
--
-- POURQUOI CELLE-CI EST RECREEE
-- Sa definition se deduit sans ambiguite. Le composant declare les colonnes
-- qu'il attend ; chacune se rapporte soit a un releve de taux, soit a sa source,
-- soit a une comparaison entre les sources d'une meme date et d'un meme couple
-- de devises. Les deux tables sources existent : fx_rates_daily et
-- fx_rate_sources.
--
-- C'est ce qui la distingue de shipping_status_history, dont le code reference
-- la contrainte shipping_status_history_changed_by_fkey : c'etait une table, et
-- la reconstituer supposerait d'inventer ce qu'elle consignait.
--
-- ECART ENTRE COURS ACHETEUR ET VENDEUR
-- fx_rates_daily porte deja une colonne `spread`. Elle est retenue lorsqu'elle
-- est renseignee ; a defaut, l'ecart se deduit des cours acheteur et vendeur.
-- Si l'un des deux manque, l'ecart reste nul plutot que faux.
--
-- POSITION DU TAUX
-- Un taux est dit le plus bas ou le plus haut lorsqu'il l'est parmi les sources
-- ayant publie ce jour-la, pour ce couple. Avec une source unique, il est a la
-- fois l'un et l'autre : il est alors declare median, faute de comparaison
-- possible.
--
-- SECURITY INVOKER : la vue respecte les politiques des tables sources.
--
-- RETOUR ARRIERE
--   DROP VIEW public.fx_rate_comparison;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.fx_rates_daily') IS NULL
     OR to_regclass('public.fx_rate_sources') IS NULL THEN
    RAISE EXCEPTION 'Preflight : une source de la comparaison de taux est absente.';
  END IF;
END;
$$;

DROP VIEW IF EXISTS public.fx_rate_comparison;

CREATE VIEW public.fx_rate_comparison
WITH (security_invoker = true) AS
WITH releves AS (
  SELECT
    d.id,
    d.rate_date,
    d.currency_pair,
    d.source_id,
    s.name AS source_name,
    s.code AS source_code,
    s.country AS source_country,
    d.rate,
    d.bid_rate,
    d.ask_rate,
    -- L'ecart publie prime ; a defaut on le deduit, et jamais a moitie.
    CASE
      WHEN d.spread IS NOT NULL THEN d.spread
      WHEN d.ask_rate IS NOT NULL AND d.bid_rate IS NOT NULL THEN d.ask_rate - d.bid_rate
      ELSE NULL
    END AS bid_ask_spread,
    d.notes,
    avg(d.rate) OVER fenetre AS avg_rate,
    min(d.rate) OVER fenetre AS min_rate,
    max(d.rate) OVER fenetre AS max_rate,
    count(*) OVER fenetre AS source_count
  FROM public.fx_rates_daily d
  LEFT JOIN public.fx_rate_sources s ON s.id = d.source_id
  WINDOW fenetre AS (PARTITION BY d.rate_date, d.currency_pair)
)
SELECT
  r.id,
  r.rate_date,
  r.currency_pair,
  r.source_id,
  r.source_name,
  r.source_code,
  r.source_country,
  r.rate,
  r.bid_rate,
  r.ask_rate,
  round(r.bid_ask_spread, 6) AS bid_ask_spread,
  round(r.avg_rate, 6) AS avg_rate,
  r.min_rate,
  r.max_rate,
  round(r.max_rate - r.min_rate, 6) AS market_spread,
  r.source_count::integer AS source_count,
  CASE
    WHEN r.avg_rate IS NULL OR r.avg_rate = 0 THEN NULL
    ELSE round((r.rate - r.avg_rate) / r.avg_rate * 100, 4)
  END AS deviation_from_avg_pct,
  CASE
    -- Une source seule ne se compare a rien.
    WHEN r.source_count <= 1 THEN 'MIDDLE'
    WHEN r.rate = r.min_rate THEN 'LOWEST'
    WHEN r.rate = r.max_rate THEN 'HIGHEST'
    ELSE 'MIDDLE'
  END AS rate_position,
  r.notes
FROM releves r;

COMMENT ON VIEW public.fx_rate_comparison IS
  'Comparaison des taux publies par chaque source, pour une date et un couple de devises. security_invoker : respecte les politiques de fx_rates_daily.';

GRANT SELECT ON public.fx_rate_comparison TO authenticated;
REVOKE ALL ON public.fx_rate_comparison FROM anon;

DO $$
DECLARE
  v_invoker boolean;
BEGIN
  IF to_regclass('public.fx_rate_comparison') IS NULL THEN
    RAISE EXCEPTION 'Postflight : la vue est absente.';
  END IF;

  SELECT coalesce(
    (SELECT option_value::boolean
       FROM pg_options_to_table(c.reloptions)
      WHERE option_name = 'security_invoker'),
    false)
  INTO v_invoker
  FROM pg_class c
  WHERE c.oid = 'public.fx_rate_comparison'::regclass;

  IF NOT v_invoker THEN
    RAISE EXCEPTION 'Postflight : la vue ne respecte pas les droits de l''appelant.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'fx_rate_comparison'
      AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'Postflight : la vue est lisible sans authentification.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
