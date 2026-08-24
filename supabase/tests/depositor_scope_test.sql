BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_depositor(p_company_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.depositors (
    mining_company_id, category, full_name, job_title, email,
    telephone, is_primary, is_backup, is_active
  ) VALUES (
    p_company_id, 'bullion_dispatch', 'Contact test', 'Responsable expéditions',
    p_email, '+226 70 00 00 00', true, false, true
  );
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$function$;

SELECT plan(4);

SELECT pg_temp.set_test_claims(
  '24000000-0000-4000-8000-000000000010', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '24000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'depositor-mine-a@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '24000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'depositor-mine-b@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.mining_companies (id, code, name, country, company_type, is_active)
VALUES
  ('24000000-0000-4000-8000-000000000101', 'DEP-A', 'Mine A test dépositaires', 'Burkina Faso', 'production_mine', true),
  ('24000000-0000-4000-8000-000000000102', 'DEP-B', 'Mine B test dépositaires', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  ('24000000-0000-4000-8000-000000000001', 'depositor-mine-a@sonasp.invalid', 'Compte Mine A', 'mine', true, '24000000-0000-4000-8000-000000000101', now()),
  ('24000000-0000-4000-8000-000000000002', 'depositor-mine-b@sonasp.invalid', 'Compte Mine B', 'mine', true, '24000000-0000-4000-8000-000000000102', now());

INSERT INTO public.depositors (
  mining_company_id, category, full_name, job_title, email,
  telephone, is_primary, is_backup, is_active
) VALUES
  ('24000000-0000-4000-8000-000000000101', 'general_management', 'Direction A', 'Direction générale', 'direction-a@test.invalid', '+226 70 00 00 01', true, false, true),
  ('24000000-0000-4000-8000-000000000102', 'general_management', 'Direction B', 'Direction générale', 'direction-b@test.invalid', '+226 70 00 00 02', true, false, true);

SELECT pg_temp.set_test_claims(
  '24000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.depositors),
  1::bigint,
  'une mine ne lit que ses propres dépositaires'
);

SELECT is(
  pg_temp.try_insert_depositor(
    '24000000-0000-4000-8000-000000000101',
    'logistique-a@test.invalid'
  ),
  'ok',
  'une mine peut ajouter un dépositaire dans son périmètre'
);

SELECT is(
  pg_temp.try_insert_depositor(
    '24000000-0000-4000-8000-000000000102',
    'interdit-b@test.invalid'
  ),
  '42501',
  'une mine ne peut pas ajouter un dépositaire à une autre société'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '24000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.depositors),
  0::bigint,
  'sans AAL2, aucun dépositaire n est visible'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
