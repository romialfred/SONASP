BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(5);

SELECT has_index(
  'public',
  'user_profiles',
  'uq_user_profiles_mining_company_account',
  'la contrainte d’un compte par société minière est installée'
);

SELECT ok(
  COALESCE((
    SELECT index_catalogue.indisunique
    FROM pg_catalog.pg_index index_catalogue
    JOIN pg_catalog.pg_class index_classe
      ON index_classe.oid = index_catalogue.indexrelid
    JOIN pg_catalog.pg_class table_classe
      ON table_classe.oid = index_catalogue.indrelid
    JOIN pg_catalog.pg_namespace schema_classe
      ON schema_classe.oid = table_classe.relnamespace
    WHERE schema_classe.nspname = 'public'
      AND table_classe.relname = 'user_profiles'
      AND index_classe.relname = 'uq_user_profiles_mining_company_account'
  ), false),
  'l’index de rattachement minier est unique'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '22000000-0000-4000-8000-000000000001',
    'role', 'service_role',
    'aal', 'aal2'
  )::text,
  true
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '22000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mine-principale-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mine-doublon-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '22000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-rattache-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '22000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'autre-mine-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.mining_companies (id, code, name, country, company_type, is_active)
VALUES
  (
    '22000000-0000-4000-8000-000000000101', 'UNIQUE-A',
    'Mine unique A — test', 'Burkina Faso', 'production_mine', true
  ),
  (
    '22000000-0000-4000-8000-000000000102', 'UNIQUE-B',
    'Mine unique B — test', 'Burkina Faso', 'production_mine', true
  );

-- Un compte désactivé continue de réserver la société minière.
INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES (
  '22000000-0000-4000-8000-000000000001',
  'mine-principale-test@sonasp.invalid', 'Compte minier désactivé', 'mine', false,
  '22000000-0000-4000-8000-000000000101', now()
);

SELECT throws_ok(
  $$
    INSERT INTO public.user_profiles (
      id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
    ) VALUES (
      '22000000-0000-4000-8000-000000000002',
      'mine-doublon-test@sonasp.invalid', 'Second compte interdit', 'mine', true,
      '22000000-0000-4000-8000-000000000101', now()
    )
  $$,
  '23505',
  'Cette société minière possède déjà un compte.',
  'un compte désactivé interdit aussi la création d’un second compte'
);

SELECT throws_ok(
  $$
    INSERT INTO public.user_profiles (
      id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
    ) VALUES (
      '22000000-0000-4000-8000-000000000003',
      'admin-rattache-test@sonasp.invalid', 'Admin mal rattaché', 'admin', true,
      '22000000-0000-4000-8000-000000000102', now()
    )
  $$,
  '23514',
  'Seul un compte Société minière peut recevoir ce rattachement.',
  'un rôle interne ne peut pas contourner la règle de rattachement'
);

SELECT lives_ok(
  $$
    INSERT INTO public.user_profiles (
      id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
    ) VALUES (
      '22000000-0000-4000-8000-000000000004',
      'autre-mine-test@sonasp.invalid', 'Compte autre mine', 'mine', true,
      '22000000-0000-4000-8000-000000000102', now()
    )
  $$,
  'une autre société minière peut recevoir son propre compte'
);

SELECT * FROM finish();

ROLLBACK;
