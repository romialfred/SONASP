-- Read-only coverage and constraint audit for the 2024-2026 development fixture.
SET LOCAL search_path = public, extensions, pg_catalog;

WITH target_tables(table_name, date_column, status_column) AS (
  VALUES
    ('daily_production','production_date','status'),
    ('production_forecasts','forecast_date',NULL),
    ('annual_budgets',NULL,NULL),
    ('monthly_budgets',NULL,NULL),
    ('quarterly_forecasts',NULL,NULL),
    ('snp_plans_achat',NULL,'statut'),
    ('snp_demandes_achat','date_soumission','statut'),
    ('snp_achats_mines','date_achat','statut'),
    ('snp_factures_achat','date_emission','statut'),
    ('snp_reglements_achat','date_reglement','statut'),
    ('snp_requisitions','created_at','statut'),
    ('snp_contrats','date_debut','statut'),
    ('shipping_preparations','prepared_at','status'),
    ('freight_shipments','shipment_date','status'),
    ('refining_records','processed_at',NULL),
    ('gold_inventory','entry_date','status'),
    ('reserve_allocations','allocation_date','status'),
    ('sales','sale_date','status'),
    ('payments','payment_date','status'),
    ('snp_conciliations','created_at','statut'),
    ('snp_artisan_ventes_or','date_vente','statut'),
    ('snp_artisan_factures_definitives','date_emission','statut'),
    ('snp_artisan_paiements','date_paiement','statut'),
    ('freight_customs_operations','created_at','status')
)
SELECT jsonb_build_object(
  'indexes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname, 'definition', indexdef)
                     ORDER BY tablename, indexname)
    FROM pg_indexes
    WHERE schemaname='public' AND tablename IN (SELECT table_name FROM target_tables)
  ), '[]'::jsonb),
  'checks', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'name', con.conname,
      'definition', pg_get_constraintdef(con.oid, true)
    ) ORDER BY c.relname, con.conname)
    FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN (SELECT table_name FROM target_tables)
      AND con.contype IN ('c','u','p','f')
  ), '[]'::jsonb),
  'columns', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', cols.table_name,
      'name', cols.column_name,
      'type', cols.data_type,
      'nullable', cols.is_nullable,
      'default', cols.column_default
    ) ORDER BY cols.table_name, cols.ordinal_position)
    FROM information_schema.columns cols
    WHERE cols.table_schema='public' AND cols.table_name IN (SELECT table_name FROM target_tables)
  ), '[]'::jsonb)
) AS structural_coverage;

SELECT 'plan_months' AS section,
       COALESCE(jsonb_agg(jsonb_build_object('year',annee,'month',mois,'status',statut,'number',numero_plan)
                          ORDER BY annee,mois), '[]'::jsonb) AS data
FROM snp_plans_achat
WHERE annee BETWEEN 2024 AND 2026;

SELECT 'status_counts' AS section, jsonb_agg(to_jsonb(x) ORDER BY table_name,status) AS data
FROM (
  SELECT 'daily_production' table_name,status::text,count(*) count FROM daily_production GROUP BY status
  UNION ALL SELECT 'shipping_preparations',status::text,count(*) FROM shipping_preparations GROUP BY status
  UNION ALL SELECT 'freight_shipments',status::text,count(*) FROM freight_shipments GROUP BY status
  UNION ALL SELECT 'reserve_allocations',status::text,count(*) FROM reserve_allocations GROUP BY status
  UNION ALL SELECT 'sales',status::text,count(*) FROM sales GROUP BY status
  UNION ALL SELECT 'payments',status::text,count(*) FROM payments GROUP BY status
  UNION ALL SELECT 'snp_plans_achat',statut::text,count(*) FROM snp_plans_achat GROUP BY statut
  UNION ALL SELECT 'snp_demandes_achat',statut::text,count(*) FROM snp_demandes_achat GROUP BY statut
  UNION ALL SELECT 'snp_achats_mines',statut::text,count(*) FROM snp_achats_mines GROUP BY statut
  UNION ALL SELECT 'snp_factures_achat',statut::text,count(*) FROM snp_factures_achat GROUP BY statut
  UNION ALL SELECT 'snp_reglements_achat',statut::text,count(*) FROM snp_reglements_achat GROUP BY statut
  UNION ALL SELECT 'snp_requisitions',statut::text,count(*) FROM snp_requisitions GROUP BY statut
  UNION ALL SELECT 'snp_contrats',statut::text,count(*) FROM snp_contrats GROUP BY statut
  UNION ALL SELECT 'snp_conciliations',statut::text,count(*) FROM snp_conciliations GROUP BY statut
  UNION ALL SELECT 'snp_artisan_ventes_or',statut::text,count(*) FROM snp_artisan_ventes_or GROUP BY statut
  UNION ALL SELECT 'snp_artisan_factures_definitives',statut::text,count(*) FROM snp_artisan_factures_definitives GROUP BY statut
  UNION ALL SELECT 'snp_artisan_paiements',statut::text,count(*) FROM snp_artisan_paiements GROUP BY statut
  UNION ALL SELECT 'freight_customs_operations',status::text,count(*) FROM freight_customs_operations GROUP BY status
) x;
