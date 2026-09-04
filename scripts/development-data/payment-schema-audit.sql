-- Read-only schema inventory for end-to-end payment fixtures.
WITH target(table_name) AS (VALUES
  ('customer_banks'),('stakeholder_bank_accounts'),('payments'),('snp_payment_proofs'),
  ('snp_artisan_moyens_paiement'),('snp_artisan_factures_definitives'),('snp_artisan_paiements'),
  ('snp_reglements_achat'),('snp_reglements_affectations'),('snp_reglements_preuves')
)
SELECT jsonb_build_object(
  'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default
    ) ORDER BY table_name,ordinal_position)
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN (SELECT table_name FROM target)),'[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'table',cl.relname,'name',con.conname,'type',con.contype,'definition',pg_get_constraintdef(con.oid,true)
    ) ORDER BY cl.relname,con.conname)
    FROM pg_constraint con JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
    WHERE n.nspname='public' AND cl.relname IN (SELECT table_name FROM target)),'[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)
    ) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (
      p.proname LIKE 'snp_paiement_international_%' OR p.proname LIKE 'snp_artisan_%paiement%'
      OR p.proname LIKE 'snp_%reglement%'
    )),'[]'::jsonb)
) AS payment_schema;
