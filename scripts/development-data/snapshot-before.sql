-- Instantané de reprise ciblé, exécuté en lecture seule avant tout COMMIT.
-- Il ne contient ni secret, ni mot de passe, ni donnée d'authentification.
WITH table_counts AS (
  SELECT * FROM (VALUES
    ('daily_production', (SELECT count(*) FROM public.daily_production)),
    ('production_forecasts', (SELECT count(*) FROM public.production_forecasts)),
    ('snp_achats_mines', (SELECT count(*) FROM public.snp_achats_mines)),
    ('shipping_preparations', (SELECT count(*) FROM public.shipping_preparations)),
    ('freight_shipments', (SELECT count(*) FROM public.freight_shipments)),
    ('refining_records', (SELECT count(*) FROM public.refining_records)),
    ('gold_inventory', (SELECT count(*) FROM public.gold_inventory)),
    ('sales', (SELECT count(*) FROM public.sales)),
    ('snp_conciliations', (SELECT count(*) FROM public.snp_conciliations)),
    ('reserve_allocations', (SELECT count(*) FROM public.reserve_allocations)),
    ('snp_artisan_ventes_or', (SELECT count(*) FROM public.snp_artisan_ventes_or))
  ) AS c(table_name,row_count)
), legacy_sales AS (
  SELECT s.id,s.sale_number,s.status,s.updated_at,
         g.resolution AS physical_backing_gap
  FROM public.sales s
  JOIN public.snp_export_sale_physical_backing_gaps g ON g.sale_id=s.id
  ORDER BY s.sale_number
), seed_collisions AS (
  SELECT 'mining_companies' AS table_name,count(*) AS row_count
  FROM public.mining_companies WHERE id::text LIKE 'd8302026-%'
  UNION ALL
  SELECT 'sales',count(*) FROM public.sales WHERE id::text LIKE 'd8302026-%'
  UNION ALL
  SELECT 'reserve_allocations',count(*) FROM public.reserve_allocations WHERE id::text LIKE 'd8302026-%'
)
SELECT jsonb_build_object(
  'captured_at',clock_timestamp(),
  'batch','HIST-2024-2026',
  'table_counts',(SELECT jsonb_object_agg(table_name,row_count) FROM table_counts),
  'legacy_sales_to_repair',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM legacy_sales l),'[]'::jsonb),
  'seed_id_collisions',(SELECT jsonb_object_agg(table_name,row_count) FROM seed_collisions),
  'existing_profiles',jsonb_build_object(
    'count',(SELECT count(*) FROM public.user_profiles),
    'fingerprint',(SELECT md5(string_agg(id::text||':'||coalesce(role,'')||':'||coalesce(is_active::text,''),'|' ORDER BY id)) FROM public.user_profiles)
  )
) AS pre_commit_snapshot;
