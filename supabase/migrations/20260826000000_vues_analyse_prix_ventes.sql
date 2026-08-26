-- Restaure les deux vues d'analyse des prix de vente, appelees par l'ecran des
-- cours et absentes de la base.
--
-- CONSTAT
-- src/pages/prices/GoldPricesPage.tsx interroge v_sales_price_analysis et
-- v_monthly_sales_vs_market, puis fait remonter l'erreur : `if (salesError)
-- throw salesError`. Ces deux vues n'existant pas, l'ecran entier tombe. Il ne
-- s'agit donc pas d'un affichage degrade mais d'une page hors service.
--
-- POURQUOI CELLES-CI SONT RECREEES, QUAND D'AUTRES NE LE SONT PAS
-- Leur definition se deduit sans ambiguite : l'ecran declare les colonnes qu'il
-- attend, et chacune se rapporte a une source unique et existante. Le prix de
-- vente est celui deja porte par la vente, le prix de marche vient du cours du
-- jour, l'ecart s'en deduit. Rien n'est suppose.
--
-- C'est ce qui les distingue de user_mining_company_access, table metier dont
-- les regles d'attribution devraient etre inventees, et de user_login_history,
-- que le backend a deliberement remplacee par une procedure.
--
-- CHOIX DU COURS DE REFERENCE
-- london_am_rate, le meme champ que celui retenu par les ventes elles-memes
-- (sales.london_am_rate) et par snp_creer_vente_export. Comparer une vente a un
-- autre cours que celui qui a servi a l'etablir n'aurait pas de sens.
--
-- Le cours retenu est celui de la date de vente. A defaut — jour ferie, cours
-- non publie — le dernier cours anterieur connu est utilise, et jamais un cours
-- posterieur : une vente ne se juge pas a l'aune d'un prix qui n'existait pas
-- encore.
--
-- SECURITY INVOKER
-- Les deux vues respectent les politiques de `sales`. Sans cela, elles
-- s'executeraient avec les droits de leur proprietaire et exposeraient les
-- ventes de toutes les societes.
--
-- RETOUR ARRIERE
--   DROP VIEW public.v_monthly_sales_vs_market;
--   DROP VIEW public.v_sales_price_analysis;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL
     OR to_regclass('public.gold_prices_daily') IS NULL
     OR to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'Preflight : une source des vues d''analyse est absente.';
  END IF;
END;
$$;

DROP VIEW IF EXISTS public.v_monthly_sales_vs_market;
DROP VIEW IF EXISTS public.v_sales_price_analysis;

CREATE VIEW public.v_sales_price_analysis
WITH (security_invoker = true) AS
SELECT
  s.id AS sale_id,
  s.sale_number,
  s.sale_date,
  extract(year FROM s.sale_date)::integer AS year,
  extract(month FROM s.sale_date)::integer AS month,
  s.quantity_oz,
  s.london_am_rate AS sale_price_per_oz,
  cours.london_am_rate AS market_price_per_oz,
  -- L'ecart n'a de sens que si le cours du jour est connu.
  CASE
    WHEN cours.london_am_rate IS NULL THEN NULL
    ELSE round((s.london_am_rate - cours.london_am_rate) * s.quantity_oz, 2)
  END AS variance_usd,
  CASE
    WHEN cours.london_am_rate IS NULL OR cours.london_am_rate = 0 THEN NULL
    ELSE round(
      (s.london_am_rate - cours.london_am_rate) / cours.london_am_rate * 100,
      4
    )
  END AS variance_percent,
  c.name AS customer_name
FROM public.sales s
LEFT JOIN public.customers c ON c.id = s.customer_id
LEFT JOIN LATERAL (
  -- Le cours du jour de la vente, ou le dernier connu avant elle.
  SELECT g.london_am_rate
  FROM public.gold_prices_daily g
  WHERE g.price_date <= s.sale_date
    AND g.london_am_rate IS NOT NULL
  ORDER BY g.price_date DESC
  LIMIT 1
) cours ON true;

COMMENT ON VIEW public.v_sales_price_analysis IS
  'Ecart entre le prix retenu par chaque vente et le cours de reference du jour. security_invoker : respecte les politiques de sales.';

CREATE VIEW public.v_monthly_sales_vs_market
WITH (security_invoker = true) AS
SELECT
  a.year,
  a.month,
  count(*)::integer AS total_sales,
  round(sum(a.quantity_oz), 4) AS total_quantity_oz,
  round(avg(a.sale_price_per_oz), 2) AS avg_sale_price,
  round(avg(a.market_price_per_oz), 2) AS avg_market_price,
  round(avg(a.variance_usd), 2) AS avg_variance_usd,
  round(avg(a.variance_percent), 4) AS avg_variance_percent,
  round(sum(a.variance_usd), 2) AS total_variance_usd
FROM public.v_sales_price_analysis a
GROUP BY a.year, a.month;

COMMENT ON VIEW public.v_monthly_sales_vs_market IS
  'Synthese mensuelle de v_sales_price_analysis. security_invoker par heritage de la vue source.';

GRANT SELECT ON public.v_sales_price_analysis TO authenticated;
GRANT SELECT ON public.v_monthly_sales_vs_market TO authenticated;
REVOKE ALL ON public.v_sales_price_analysis FROM anon;
REVOKE ALL ON public.v_monthly_sales_vs_market FROM anon;

DO $$
DECLARE
  v_vue text;
  v_invoker boolean;
BEGIN
  FOREACH v_vue IN ARRAY ARRAY['v_sales_price_analysis', 'v_monthly_sales_vs_market'] LOOP
    IF to_regclass('public.' || v_vue) IS NULL THEN
      RAISE EXCEPTION 'Postflight : la vue % est absente.', v_vue;
    END IF;

    SELECT coalesce(
      (SELECT option_value::boolean
         FROM pg_options_to_table(c.reloptions)
        WHERE option_name = 'security_invoker'),
      false)
    INTO v_invoker
    FROM pg_class c
    WHERE c.oid = ('public.' || v_vue)::regclass;

    IF NOT v_invoker THEN
      RAISE EXCEPTION
        'Postflight : la vue % ne respecte pas les droits de l''appelant.', v_vue;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = v_vue AND grantee = 'anon'
    ) THEN
      RAISE EXCEPTION 'Postflight : la vue % est lisible sans authentification.', v_vue;
    END IF;
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
