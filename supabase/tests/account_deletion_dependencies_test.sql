-- Tests exclusivement dans la copie locale isolée, toujours annulés.
BEGIN;
DO $$ BEGIN
 IF current_database() NOT IN ('sonasp_seed_validation_live_20260830','sonasp_iam_audit_20260830','sonasp_release_20260830','sonasp_iam_audit_full_release_20260830') THEN
   RAISE EXCEPTION 'Base locale isolée obligatoire.';
 END IF;
END $$;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
SELECT lives_ok('SELECT public.snp_2m_assert_dependency_registry_complete()','registre complet');

INSERT INTO auth.users(id,email) VALUES
 ('4dec0000-0000-4000-8000-000000000001','deletion-test@example.invalid'),
 ('4dec0000-0000-4000-8000-000000000002','deletion-other@example.invalid');
INSERT INTO public.user_profiles(id,email,full_name,role,is_active) VALUES
 -- Ce scénario isole les journaux de session : un Admin recevrait en plus
 -- des attributions de modules automatiques, hors de l'objet de ce test.
 ('4dec0000-0000-4000-8000-000000000001','deletion-test@example.invalid','Suppression test','customer',true),
 ('4dec0000-0000-4000-8000-000000000002','deletion-other@example.invalid','Autre compte','customer',true);
INSERT INTO public.user_sessions(id,user_id,expires_at,token_hash) VALUES
 ('4dec0000-0000-4000-8000-000000000101','4dec0000-0000-4000-8000-000000000001',now()+interval '1 hour',extensions.digest('test-delete-1','sha256')),
 ('4dec0000-0000-4000-8000-000000000102','4dec0000-0000-4000-8000-000000000002',now()+interval '1 hour',extensions.digest('test-delete-2','sha256'));
INSERT INTO public.snp_workflow_audit(aggregate_type,aggregate_id,action,actor_id,capability_code) VALUES
 ('user-session','4dec0000-0000-4000-8000-000000000101','revoked','4dec0000-0000-4000-8000-000000000001','session.self'),
 ('user-sessions','4dec0000-0000-4000-8000-000000000001','bulk-revoked','4dec0000-0000-4000-8000-000000000001','session.self');
SELECT is(public.snp_2m_account_business_activity('4dec0000-0000-4000-8000-000000000001'),'[]'::jsonb,'déconnexions personnelles non bloquantes');
SAVEPOINT business;
INSERT INTO public.snp_workflow_audit(aggregate_type,action,actor_id,capability_code) VALUES
 ('sale','approved','4dec0000-0000-4000-8000-000000000001','sonasp.approve');
SELECT ok(jsonb_array_length(public.snp_2m_account_business_activity('4dec0000-0000-4000-8000-000000000001'))>0,'audit métier reste bloquant');
ROLLBACK TO business;
INSERT INTO public.snp_workflow_audit(aggregate_type,aggregate_id,action,actor_id,capability_code) VALUES
 ('user-session','4dec0000-0000-4000-8000-000000000102','revoked','4dec0000-0000-4000-8000-000000000001','session.self');
SELECT ok(jsonb_array_length(public.snp_2m_account_business_activity('4dec0000-0000-4000-8000-000000000001'))>0,'action sur session d’un autre compte bloquante');
ROLLBACK TO business;
INSERT INTO public.snp_workflow_audit(aggregate_type,action,actor_id) VALUES
 ('user-session','revoked','4dec0000-0000-4000-8000-000000000001');
SELECT ok(jsonb_array_length(public.snp_2m_account_business_activity('4dec0000-0000-4000-8000-000000000001'))>0,'audit incomplet reste bloquant');
ROLLBACK TO business;
CREATE TABLE public.account_deletion_unknown_test(id uuid,created_by uuid);
SELECT throws_ok('SELECT public.snp_2m_assert_dependency_registry_complete()','55000',NULL,'future dépendance inconnue bloque');
ROLLBACK TO business;
SELECT lives_ok($$UPDATE public.user_profiles SET is_active=false WHERE id='4dec0000-0000-4000-8000-000000000001'$$,'désactivation auditée sans erreur de colonne');
SELECT is((SELECT count(*) FROM public.audit_trail WHERE record_id='4dec0000-0000-4000-8000-000000000001' AND action='account_deactivated'),1::bigint,'trace de désactivation conservée');
SELECT ok(NOT has_function_privilege('service_role','public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)','EXECUTE'),'service ne contourne pas préparation authentifiée');
SELECT ok(NOT has_function_privilege('anon','public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)','EXECUTE'),'anonyme ne supprime pas');
SELECT lives_ok($$DELETE FROM auth.users WHERE id='4dec0000-0000-4000-8000-000000000001'$$,'cascade Auth locale conserve les journaux');
SELECT is((SELECT count(*) FROM public.user_profiles WHERE id='4dec0000-0000-4000-8000-000000000001'),0::bigint,'profil supprimé');
SELECT is((SELECT count(*) FROM public.user_sessions WHERE user_id='4dec0000-0000-4000-8000-000000000001'),0::bigint,'sessions supprimées');
SELECT is((SELECT count(*) FROM public.snp_workflow_audit WHERE aggregate_id IN ('4dec0000-0000-4000-8000-000000000001','4dec0000-0000-4000-8000-000000000101')),2::bigint,'journaux de session conservés');
SELECT is((SELECT count(*) FROM auth.users WHERE id='4dec0000-0000-4000-8000-000000000002'),1::bigint,'autre compte intact');
SELECT * FROM finish();
ROLLBACK;
