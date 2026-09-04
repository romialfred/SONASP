-- Read-only bank account columns used by payment fixtures.
SELECT jsonb_agg(jsonb_build_object(
  'table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default
) ORDER BY table_name,ordinal_position) AS bank_columns
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('customer_banks','stakeholder_bank_accounts');
