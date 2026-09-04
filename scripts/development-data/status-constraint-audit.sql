-- Read-only status domains and editability guards for seeded workflows.
WITH target(table_name) AS (VALUES
  ('daily_production'),('production_forecasts'),('annual_budgets'),('monthly_budgets'),('quarterly_forecasts'),
  ('snp_plans_achat'),('snp_demandes_achat'),('snp_achats_mines'),('snp_factures_achat'),
  ('snp_reglements_achat'),('snp_requisitions'),('snp_contrats'),('shipping_preparations'),
  ('freight_shipments'),('freight_customs_operations'),('refining_records'),('gold_inventory'),
  ('reserve_allocations'),('sales'),('payments'),('snp_conciliations'),('snp_artisan_ventes_or'),
  ('snp_artisan_factures_definitives'),('snp_artisan_paiements')
)
SELECT jsonb_build_object(
  'status_columns', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', c.table_name,
      'column', c.column_name,
      'type', c.udt_name,
      'default', c.column_default,
      'nullable', c.is_nullable
    ) ORDER BY c.table_name,c.ordinal_position)
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name IN (SELECT table_name FROM target)
      AND (c.column_name ILIKE '%status%' OR c.column_name ILIKE '%statut%')
  ), '[]'::jsonb),
  'checks', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('table',cl.relname,'name',con.conname,
      'definition',pg_get_constraintdef(con.oid,true)) ORDER BY cl.relname,con.conname)
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=cl.relnamespace
    WHERE n.nspname='public' AND cl.relname IN (SELECT table_name FROM target)
      AND con.contype='c'
  ), '[]'::jsonb),
  'guard_triggers', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('table',cl.relname,'name',tg.tgname,
      'definition',pg_get_triggerdef(tg.oid,true)) ORDER BY cl.relname,tg.tgname)
    FROM pg_trigger tg
    JOIN pg_class cl ON cl.oid=tg.tgrelid
    JOIN pg_namespace n ON n.oid=cl.relnamespace
    WHERE n.nspname='public' AND cl.relname IN (SELECT table_name FROM target)
      AND NOT tg.tgisinternal
      AND (tg.tgname ILIKE '%guard%' OR tg.tgname ILIKE '%proteg%' OR tg.tgname ILIKE '%rpc_only%' OR tg.tgname ILIKE '%immuab%')
  ), '[]'::jsonb)
) AS status_audit;
