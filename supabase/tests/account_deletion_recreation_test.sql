-- Exécution uniquement dans une copie locale isolée ; toutes les écritures sont annulées.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT IN (
    'sonasp_seed_validation_live_20260830',
    'sonasp_iam_audit_20260830',
    'sonasp_release_20260830',
    'sonasp_iam_audit_full_release_20260830'
  ) THEN
    RAISE EXCEPTION 'Base locale isolée obligatoire.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(8);

INSERT INTO auth.users(id,email) VALUES
  ('4def0000-0000-4000-8000-000000000001','recreation-compte@example.invalid');
INSERT INTO public.user_profiles(id,email,full_name,role,is_active) VALUES
  ('4def0000-0000-4000-8000-000000000001','recreation-compte@example.invalid',
   'Compte à recréer','customer',false);
INSERT INTO public.snp_account_creation_operations(
  actor_id,idempotency_key,auth_user_id,request_payload,result_payload,status
) VALUES(
  '4def0000-0000-4000-8000-000000000099','snp:test-recreation-email',
  '4def0000-0000-4000-8000-000000000001','{}','{}','db_completed'
);
INSERT INTO public.snp_account_lifecycle_audit(
  idempotency_key,actor_id,target_id,action,status,request_payload,payload_hash,
  reason,previous_version,result_version,previous_active,result_active,db_completed_at
) VALUES(
  '4def0000-0000-4000-8000-000000000101',
  '4def0000-0000-4000-8000-000000000099',
  '4def0000-0000-4000-8000-000000000001',
  'delete','db_completed','{}',extensions.digest(convert_to('{}','UTF8'),'sha256'),
  'Suppression définitive pour test de recréation',0,0,false,false,clock_timestamp()
);

SELECT lives_ok(
  $$DELETE FROM auth.users WHERE id='4def0000-0000-4000-8000-000000000001'$$,
  'la suppression Auth dure aboutit'
);
SELECT is((SELECT count(*) FROM public.user_profiles
  WHERE id='4def0000-0000-4000-8000-000000000001'),0::bigint,
  'le profil est supprimé en cascade');
SELECT is((SELECT count(*) FROM public.snp_account_creation_operations
  WHERE auth_user_id='4def0000-0000-4000-8000-000000000001'),0::bigint,
  'l’idempotence de création est supprimée en cascade');

SELECT set_config('request.jwt.claim.role','service_role',true);
SET LOCAL ROLE service_role;
SELECT is(
  (public.snp_admin_compte_finaliser_suppression(
    '4def0000-0000-4000-8000-000000000101',
    'recreation-compte@example.invalid'
  )->>'email_reusable')::boolean,
  true,
  'la finalisation certifie que l’adresse est réutilisable'
);
RESET ROLE;

SELECT is((SELECT status FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key='4def0000-0000-4000-8000-000000000101'),
  'completed','l’audit immuable de suppression est conservé et finalisé');

SELECT lives_ok($sql$
  INSERT INTO auth.users(id,email) VALUES
    ('4def0000-0000-4000-8000-000000000002','recreation-compte@example.invalid')
$sql$,'la même adresse peut créer une nouvelle identité Auth');
SELECT lives_ok($sql$
  INSERT INTO public.user_profiles(id,email,full_name,role,is_active) VALUES
    ('4def0000-0000-4000-8000-000000000002','recreation-compte@example.invalid',
     'Compte recréé','customer',true)
$sql$,'la même adresse peut créer un nouveau profil');
SELECT is((SELECT id FROM public.user_profiles
  WHERE email='recreation-compte@example.invalid'),
  '4def0000-0000-4000-8000-000000000002'::uuid,
  'la recréation produit une nouvelle identité indépendante');

SELECT * FROM finish();
ROLLBACK;
