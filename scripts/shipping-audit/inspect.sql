BEGIN READ ONLY;
SELECT table_name, jsonb_agg(column_name ORDER BY ordinal_position) AS columns FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN (
  'shipping_preparations', 'shipping_production_items', 'freight_customs_operations',
  'freight_customs_documents', 'freight_customs_invoice_data', 'mining_companies', 'daily_production'
) GROUP BY table_name ORDER BY table_name;
/* SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent,
  conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype = 'f' AND (
  conrelid IN ('public.shipping_preparations'::regclass, 'public.shipping_production_items'::regclass,
    'public.freight_customs_operations'::regclass, 'public.freight_customs_documents'::regclass,
    'public.freight_customs_invoice_data'::regclass)
) ORDER BY child, conname; */
ROLLBACK;
