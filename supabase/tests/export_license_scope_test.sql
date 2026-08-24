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

CREATE OR REPLACE FUNCTION pg_temp.update_foreign_license(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.export_licenses SET comments = 'tentative inter-société' WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_foreign_license()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.export_licenses (
    id, license_number, mining_company_id, request_date, start_date, end_date,
    issuing_institution, authorized_quantity_grams, used_quantity_grams, status
  ) VALUES (
    '21000000-0000-4000-8000-000000000299', 'EXP-TST-B-INTERDIT',
    '21000000-0000-4000-8000-000000000102', current_date, current_date,
    current_date + 30, 'Institution test', 1000, 0, 'active'
  );
  RETURN 'aucune_erreur';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

SELECT plan(6);

SELECT pg_temp.set_test_claims(
  '21000000-0000-4000-8000-000000000010', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '21000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mine-a-licence-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mine-b-licence-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.mining_companies (id, code, name, country, company_type, is_active)
VALUES
  (
    '21000000-0000-4000-8000-000000000101', 'LIC-A',
    'Mine A — test licences', 'Burkina Faso', 'production_mine', true
  ),
  (
    '21000000-0000-4000-8000-000000000102', 'LIC-B',
    'Mine B — test licences', 'Burkina Faso', 'production_mine', true
  );

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  (
    '21000000-0000-4000-8000-000000000001',
    'mine-a-licence-test@sonasp.invalid', 'Compte Mine A', 'mine', true,
    '21000000-0000-4000-8000-000000000101', now()
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    'mine-b-licence-test@sonasp.invalid', 'Compte Mine B', 'mine', true,
    '21000000-0000-4000-8000-000000000102', now()
  );

INSERT INTO public.export_licenses (
  id, license_number, mining_company_id, request_date, start_date, end_date,
  issuing_institution, authorized_quantity_grams, used_quantity_grams, status
) VALUES
  (
    '21000000-0000-4000-8000-000000000201', 'EXP-LIC-A-2026',
    '21000000-0000-4000-8000-000000000101', current_date, current_date,
    current_date + 30, 'Institution test', 1000, 0, 'active'
  ),
  (
    '21000000-0000-4000-8000-000000000202', 'EXP-LIC-B-2026',
    '21000000-0000-4000-8000-000000000102', current_date, current_date,
    current_date + 30, 'Institution test', 1000, 0, 'active'
  );

INSERT INTO public.export_license_documents (
  id, license_id, document_name, document_type
) VALUES
  (
    '21000000-0000-4000-8000-000000000301',
    '21000000-0000-4000-8000-000000000201', 'Licence A.pdf', 'license_copy'
  ),
  (
    '21000000-0000-4000-8000-000000000302',
    '21000000-0000-4000-8000-000000000202', 'Licence B.pdf', 'license_copy'
  );

SELECT pg_temp.set_test_claims(
  '21000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.export_licenses),
  1::bigint,
  'la Mine A ne lit que sa licence'
);

SELECT is(
  (SELECT license_number FROM public.export_licenses),
  'EXP-LIC-A-2026',
  'la licence visible appartient à la Mine A'
);

SELECT is(
  (SELECT count(*) FROM public.export_license_documents),
  1::bigint,
  'la Mine A ne lit que les documents de sa licence'
);

SELECT is(
  pg_temp.update_foreign_license('21000000-0000-4000-8000-000000000202'),
  0,
  'la Mine A ne modifie pas la licence de la Mine B'
);

SELECT is(
  pg_temp.try_insert_foreign_license(),
  '42501',
  'la Mine A ne crée pas de licence pour la Mine B'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '21000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.export_licenses),
  0::bigint,
  'sans AAL2, la mine ne lit aucune licence'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
