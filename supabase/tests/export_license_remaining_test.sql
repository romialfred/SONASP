BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(3);

SELECT ok(
  (SELECT is_generated <> 'NEVER'
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'export_licenses'
     AND column_name = 'remaining_quantity_grams')
  OR EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.export_licenses'::regclass
      AND tgname = 'snp_sync_export_license_remaining'
      AND NOT tgisinternal
  ),
  'le reliquat est maintenu par la base'
);

INSERT INTO public.mining_companies (id, code, name, country, company_type, is_active)
VALUES (
  '24000000-0000-4000-8000-000000000101',
  'QUOTA-TST', 'Mine test reliquat', 'Burkina Faso', 'production_mine', true
);

INSERT INTO public.export_licenses (
  id, license_number, mining_company_id, request_date, start_date, end_date,
  issuing_institution, authorized_quantity_grams, status
) VALUES (
  '24000000-0000-4000-8000-000000000201', 'EXP-QUOTA-TST-2026',
  '24000000-0000-4000-8000-000000000101', current_date, current_date,
  current_date + 30, 'Institution test', 1000, 'active'
);

SELECT is(
  (SELECT remaining_quantity_grams FROM public.export_licenses
   WHERE id = '24000000-0000-4000-8000-000000000201'),
  1000::numeric,
  'une nouvelle licence expose tout son volume autorisé'
);

UPDATE public.export_licenses
SET used_quantity_grams = 325
WHERE id = '24000000-0000-4000-8000-000000000201';

SELECT is(
  (SELECT remaining_quantity_grams FROM public.export_licenses
   WHERE id = '24000000-0000-4000-8000-000000000201'),
  675::numeric,
  'le reliquat suit chaque consommation'
);

SELECT * FROM finish();

ROLLBACK;
