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
  PERFORM set_config('request.jwt.claim.aal', p_aal, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_define_capability(
  p_user_id uuid,
  p_code text,
  p_allowed boolean,
  p_reason text
)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM public.snp_definir_capacite_utilisateur(
    p_user_id, p_code, p_allowed, p_reason, NULL
  );
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_mutate_audit(p_id bigint)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.snp_workflow_audit
  SET reason = 'altération interdite'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

SELECT plan(26);

SELECT has_table('public', 'snp_capability_catalog', 'le catalogue des capacités existe');
SELECT has_table('public', 'snp_user_capabilities', 'les overrides individuels existent');
SELECT has_table('public', 'snp_workflow_audit', 'le journal de workflow existe');
SELECT has_function(
  'public', 'snp_actor_has_capability', ARRAY['text'],
  'la résolution serveur des capacités existe'
);
SELECT has_function(
  'public', 'snp_actor_capabilities', ARRAY[]::text[],
  'le frontend peut lire la liste autoritative de ses capacités'
);

SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000001', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-capability-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'manager-capability-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'management-capability-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-capability-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delegate-capability-test@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    'admin-capability-test@sonasp.invalid', 'Administrateur capacités',
    'admin', true, NULL, now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'manager-capability-test@sonasp.invalid', 'Lecteur capacités',
    'manager', true, NULL, now()
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'management-capability-test@sonasp.invalid', 'Direction capacités',
    'management', true, NULL, now()
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'owner-capability-test@sonasp.invalid', 'Propriétaire capacités',
    'owner', true, NULL, now()
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'delegate-capability-test@sonasp.invalid', 'Délégué capacités',
    'customer', true, NULL, now()
  );

SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.snp_actor_has_capability('reports.read'),
  'Manager conserve la lecture des rapports'
);
SELECT is(
  public.snp_actor_has_capability('sonasp.prepare'), false,
  'Manager ne peut préparer aucune opération'
);
SELECT is(
  ARRAY(SELECT capability_code FROM public.snp_actor_capabilities()),
  ARRAY['reports.read', 'sonasp.workflow.read']::text[],
  'la liste autoritative du Manager ne contient que les lectures prévues'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.snp_actor_has_capability('accounts.manage'),
  'Admin conserve uniquement l’administration autorisée'
);
SELECT is(
  public.snp_actor_has_capability('sonasp.approve'), false,
  'Admin n’est plus approbateur métier par défaut'
);
SELECT is(
  public.snp_actor_has_capability('capability.unknown'), false,
  'une capacité inconnue est refusée par défaut'
);
SELECT is(
  pg_temp.try_define_capability(
    '30000000-0000-4000-8000-000000000001',
    'sonasp.approve', true, 'tentative sur son propre compte'
  ),
  '42501',
  'Admin ne modifie pas ses propres capacités'
);
SELECT is(
  pg_temp.try_define_capability(
    '30000000-0000-4000-8000-000000000004',
    'sonasp.approve', true, 'tentative sur le compte propriétaire'
  ),
  '42501',
  'les capacités Owner restent hors interface'
);
SELECT is(
  pg_temp.try_define_capability(
    '30000000-0000-4000-8000-000000000002',
    'sonasp.approve', true, 'habilitation temporaire pour le contrôle'
  ),
  '42501',
  'le profil Manager reste strictement en lecture seule'
);
SELECT is(
  pg_temp.try_define_capability(
    '30000000-0000-4000-8000-000000000005',
    'sonasp.approve', true, 'habilitation temporaire pour le contrôle'
  ),
  'ok',
  'Admin peut habiliter un autre compte avec justification'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000005', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.snp_actor_has_capability('sonasp.approve'),
  'l’override positif devient effectif côté serveur'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_define_capability(
    '30000000-0000-4000-8000-000000000002',
    'sonasp.approve', false, 'retrait temporaire de la capacité de contrôle'
  ),
  'ok',
  'Admin peut expliciter un refus métier sur le profil Manager'
);
SELECT is(
  pg_temp.try_define_capability(
    '30000000-0000-4000-8000-000000000005',
    'sonasp.approve', false, 'retrait temporaire de la capacité de contrôle'
  ),
  'ok',
  'Admin peut retirer explicitement une habilitation'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_audit
   WHERE aggregate_type = 'account-capability'
     AND aggregate_id = '30000000-0000-4000-8000-000000000005'),
  2::bigint,
  'chaque décision d’habilitation est auditée'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000005', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.snp_actor_has_capability('sonasp.approve'), false,
  'l’override négatif prime sur toute habilitation'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_mutate_audit((SELECT min(id) FROM public.snp_workflow_audit)),
  '0',
  'un utilisateur ne peut pas altérer le journal'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.snp_actor_has_capability('sonasp.prepare'),
  'Management conserve temporairement la préparation'
);
SELECT ok(
  public.snp_actor_has_capability('sonasp.approve'),
  'Management conserve temporairement l’approbation sous garde par dossier'
);
SELECT ok(
  public.snp_actor_has_capability('sonasp.finance.execute'),
  'Management conserve temporairement l’exécution sous garde par dossier'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '30000000-0000-4000-8000-000000000003', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.snp_actor_has_capability('sonasp.prepare'), false,
  'une capacité sensible est refusée sans AAL2'
);
SELECT ok(
  public.snp_actor_has_capability('reports.read'),
  'une lecture non sensible reste disponible après authentification'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
