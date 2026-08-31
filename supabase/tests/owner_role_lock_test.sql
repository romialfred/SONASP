BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES('accounts.manage','accounts','Administration','Contrôle de hiérarchie',true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Les images Supabase récentes lisent request.jwt.claims ; certaines images
  -- locales conservent les GUC historiques request.jwt.claim.*.
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal,
      'session_id','role-lock-'||p_sub::text,'exp',extract(epoch FROM now()+interval '1 hour')::bigint)::text,
    true
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION pg_temp.set_test_claims(uuid,text,text) TO authenticated;

SELECT plan(10);

SELECT has_function(
  'public',
  'snp_verrouiller_owner_interactif',
  ARRAY[]::text[],
  'le verrou serveur du rôle Propriétaire est installé'
);

-- Les UUID sont réservés à ce test et toutes les écritures sont annulées par
-- le ROLLBACK final. Le service_role prépare les comptes de caractérisation.
SELECT pg_temp.set_test_claims(
  '10000000-0000-4000-8000-000000000001', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-lock-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-lock-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'candidate-lock-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.user_profiles (id, email, full_name, role, is_active, mfa_enrolled_at)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'owner-lock-test@sonasp.invalid', 'Owner de test', 'owner', true, now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'admin-lock-test@sonasp.invalid', 'Admin de test', 'admin', true, now()
  );

INSERT INTO public.user_sessions(user_id,token_hash,expires_at)
SELECT id,extensions.digest('role-lock-'||id::text,'sha256'),now()+interval '1 hour'
FROM public.user_profiles WHERE id IN('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT pg_temp.set_test_claims(
  '10000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);

SELECT ok(
  public.snp_peut_administrer_compte('10000000-0000-4000-8000-000000000002'),
  'un Owner AAL2 peut administrer un compte inférieur'
);

SELECT is(
  public.snp_peut_administrer_compte('10000000-0000-4000-8000-000000000001'),
  false,
  'un Owner ne peut pas administrer son propre compte'
);

SELECT throws_ok(
  $$
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    VALUES (
      '10000000-0000-4000-8000-000000000003',
      'candidate-lock-test@sonasp.invalid', 'Candidat Owner', 'owner', true
    )
  $$,
  '42501',
  NULL,
  'une session authentifiée ne peut pas créer un Owner par INSERT direct'
);

SELECT throws_ok(
  $$
    UPDATE public.user_profiles
    SET role = 'owner'
    WHERE id = '10000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  NULL,
  'une session authentifiée ne peut pas promouvoir un compte par UPDATE direct'
);

SELECT throws_ok(
  $$
    UPDATE public.user_profiles
    SET role = 'admin'
    WHERE id = '10000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'une session authentifiée ne peut pas rétrograder un Owner'
);

SELECT throws_ok(
  $$
    UPDATE public.user_profiles
    SET is_active = false
    WHERE id = '10000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'une session authentifiée ne peut pas désactiver un Owner'
);

SELECT pg_temp.set_test_claims(
  '10000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);

SELECT is(
  public.snp_peut_administrer_compte('10000000-0000-4000-8000-000000000002'),
  false,
  'AAL2 reste obligatoire pour administrer un compte'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '10000000-0000-4000-8000-000000000001', 'service_role', 'aal2'
);

SELECT lives_ok(
  $$
    UPDATE public.user_profiles
    SET role = 'owner'
    WHERE id = '10000000-0000-4000-8000-000000000002'
  $$,
  'le service_role contrôlé peut promouvoir un compte vers Owner'
);

SELECT lives_ok(
  $$
    UPDATE public.user_profiles
    SET role = 'admin'
    WHERE id = '10000000-0000-4000-8000-000000000002'
  $$,
  'le service_role contrôlé peut restaurer le rôle précédent'
);

SELECT * FROM finish();

ROLLBACK;
