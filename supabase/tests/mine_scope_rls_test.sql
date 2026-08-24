BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.update_inventory_note(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.gold_inventory SET notes = 'tentative inter-société' WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.delete_inventory(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.gold_inventory WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_foreign_inventory()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.gold_inventory (
    created_by, entry_date, final_fine_grams, final_fine_oz,
    fineness_percentage, metal_retained_percentage, mining_company_id,
    quantity_available_oz, transaction_type,
    weight_after_melting_grams, weight_before_melting_grams
  ) VALUES (
    '20000000-0000-4000-8000-000000000001', current_date,
    31.1034768, 1, 99, 0,
    '20000000-0000-4000-8000-000000000102', 1, 'production',
    31.1034768, 31.1034768
  );
  RETURN 'aucune_erreur';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

SELECT plan(9);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gold_inventory'
      AND policyname = 'snp_stock_lecture_perimetre'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'SELECT'
  ),
  'la lecture du stock possède une politique restrictive de périmètre'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gold_inventory'
      AND policyname = 'snp_stock_insertion_interne'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'INSERT'
  ),
  'l’insertion de stock possède une politique restrictive serveur'
);

SELECT pg_temp.set_test_claims(
  '20000000-0000-4000-8000-000000000010', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mine-a-scope-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mine-b-scope-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-scope-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.mining_companies (
  id, code, name, country, company_type, is_active
) VALUES
  (
    '20000000-0000-4000-8000-000000000101',
    'TST-A', 'Mine A — test de périmètre', 'Burkina Faso', 'production_mine', true
  ),
  (
    '20000000-0000-4000-8000-000000000102',
    'TST-B', 'Mine B — test de périmètre', 'Burkina Faso', 'production_mine', true
  );

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'mine-a-scope-test@sonasp.invalid', 'Compte Mine A', 'mine', true,
    '20000000-0000-4000-8000-000000000101', now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'mine-b-scope-test@sonasp.invalid', 'Compte Mine B', 'mine', true,
    '20000000-0000-4000-8000-000000000102', now()
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    'admin-scope-test@sonasp.invalid', 'Administrateur SONASP', 'admin', true,
    NULL, now()
  );

INSERT INTO public.gold_inventory (
  id, created_by, entry_date, final_fine_grams, final_fine_oz,
  fineness_percentage, metal_retained_percentage, mining_company_id,
  quantity_available_oz, transaction_type,
  weight_after_melting_grams, weight_before_melting_grams
) VALUES
  (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000001', current_date,
    31.1034768, 1, 99, 0,
    '20000000-0000-4000-8000-000000000101', 1, 'production',
    31.1034768, 31.1034768
  ),
  (
    '20000000-0000-4000-8000-000000000202',
    '20000000-0000-4000-8000-000000000002', current_date,
    31.1034768, 1, 99, 0,
    '20000000-0000-4000-8000-000000000102', 1, 'production',
    31.1034768, 31.1034768
  );

SELECT pg_temp.set_test_claims(
  '20000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.gold_inventory WHERE id = '20000000-0000-4000-8000-000000000201'),
  1::bigint,
  'la Mine A lit son propre stock'
);

SELECT is(
  (SELECT count(*) FROM public.gold_inventory WHERE id = '20000000-0000-4000-8000-000000000202'),
  0::bigint,
  'la Mine A ne lit pas le stock de la Mine B'
);

SELECT is(
  pg_temp.update_inventory_note('20000000-0000-4000-8000-000000000202'),
  0,
  'la Mine A ne modifie pas le stock de la Mine B'
);

SELECT is(
  pg_temp.delete_inventory('20000000-0000-4000-8000-000000000202'),
  0,
  'la Mine A ne supprime pas le stock de la Mine B'
);

SELECT is(
  pg_temp.try_insert_foreign_inventory(),
  '42501',
  'la Mine A ne crée pas de stock dans le périmètre de la Mine B'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '20000000-0000-4000-8000-000000000010', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.gold_inventory WHERE id IN (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000202'
  )),
  2::bigint,
  'un agent SONASP AAL2 conserve la vue nationale du stock'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '20000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.gold_inventory),
  0::bigint,
  'sans AAL2, la Mine A ne lit aucun stock'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
