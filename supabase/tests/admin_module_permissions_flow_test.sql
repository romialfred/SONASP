-- Tests avec fonctions réelles, comptes fictifs et transaction toujours annulée.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'sonasp_iam_audit_%'
     AND current_database() NOT IN ('sonasp_seed_validation_live_20260830','sonasp_release_20260830') THEN
    RAISE EXCEPTION 'Base isolée requise pour les tests Admin.';
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

INSERT INTO snp_capability_catalog(code,domain,label,description,sensitive)
VALUES('accounts.manage','accounts','Comptes','Test Admin',true) ON CONFLICT DO NOTHING;
INSERT INTO snp_role_capabilities(role,capability_code)
VALUES('admin','accounts.manage') ON CONFLICT DO NOTHING;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('a8302026-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'admin-module-'||n||'@example.invalid','','{}','{}',now(),now() FROM generate_series(1,3) n;
INSERT INTO user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
SELECT ('a8302026-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'admin-module-'||n||'@example.invalid','Test Admin '||n,CASE WHEN n=1 THEN 'owner' ELSE 'admin' END,true,now()
FROM generate_series(1,3) n;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
SELECT ('a8302026-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',
 extensions.digest('admin-module-session-'||n,'sha256') FROM generate_series(1,3) n;
INSERT INTO modules(id,name,display_name,access_domain,is_active) VALUES
 ('a8302026-0000-4000-8000-000000000101','admin_test_refining','Raffinage test','refining',true),
 ('a8302026-0000-4000-8000-000000000102','admin_test_reserve','Réserve test','inventory',false),
 ('a8302026-0000-4000-8000-000000000103','admin_test_unknown','Inconnu test','unknown',true);

CREATE FUNCTION pg_temp.admin_claims(n integer,aal text DEFAULT 'aal2',suffix text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object(
  'sub','a8302026-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','aal',aal,
  'session_id','admin-module-session-'||n||suffix,'exp',extract(epoch FROM now()+interval '1 hour')::bigint)::text,true);
END $$;
CREATE FUNCTION pg_temp.admin_try(statement text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE statement; RETURN 'OK'; EXCEPTION WHEN OTHERS THEN
 RAISE NOTICE 'SQL: % %',SQLSTATE,SQLERRM; RETURN SQLSTATE; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT no_plan();

SELECT ok((SELECT bool_and(snp_user_permission_allowed('a8302026-0000-4000-8000-000000000002',
 'a8302026-0000-4000-8000-000000000101',action)) FROM unnest(ARRAY['view','create','edit','delete','approve']) action),
 'les cinq droits Admin sont attribuables');
SELECT is((SELECT can_create FROM user_permissions WHERE user_id='a8302026-0000-4000-8000-000000000002'
 AND module_id='a8302026-0000-4000-8000-000000000101'),false,'le plafond ne donne pas automatiquement les écritures');
SELECT ok(NOT snp_user_permission_allowed('a8302026-0000-4000-8000-000000000002',
 'a8302026-0000-4000-8000-000000000102','view'),'module désactivé fermé à Admin');
SELECT ok(NOT snp_user_permission_allowed('a8302026-0000-4000-8000-000000000002',
 'a8302026-0000-4000-8000-000000000103','view'),'domaine inconnu fermé à Admin');

SET LOCAL ROLE authenticated;
SELECT pg_temp.admin_claims(1);
SELECT is(pg_temp.admin_try($$SELECT snp_remplacer_habilitations_compte('a8302026-0000-4000-8000-000000000002',
 '[{"module_id":"a8302026-0000-4000-8000-000000000101","can_view":true,"can_create":true,"can_edit":true,"can_delete":true,"can_approve":true}]')$$),
 'OK','Owner attribue les cinq droits à Admin par RPC réel');
SELECT is((SELECT count(*) FROM snp_account_admin_audit WHERE target_id='a8302026-0000-4000-8000-000000000002'
 AND action='permissions_replace'),1::bigint,'attribution auditée');
SELECT lives_ok($$SELECT snp_configurer_acces_compte(
 'a8302026-0000-4000-8000-000000000002','Administrateur corrigé',NULL,'admin',true,NULL,NULL,NULL,'{}',
 '[{"module_id":"a8302026-0000-4000-8000-000000000101","can_view":true,"can_create":true,"can_edit":true,"can_delete":true,"can_approve":true}]')$$,
 'le formulaire complet modifie Admin et conserve ses cinq droits métier');
-- Reconnexion synthétique après attribution : le socle IAM révoque les sessions
-- de la cible, et le test ne doit pas contourner cette protection.
RESET ROLE;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
VALUES('a8302026-0000-4000-8000-000000000002',now()+interval '1 hour',
 extensions.digest('admin-module-session-2-renewed','sha256'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.admin_claims(2,'aal2','-renewed');
SELECT ok((SELECT bool_and(snp_actor_can_module_action('admin_test_refining',action))
 FROM unnest(ARRAY['view','create','edit','delete','approve']) action),'Admin exerce seulement les droits explicitement attribués');
SELECT is(pg_temp.admin_try($$SELECT snp_remplacer_habilitations_compte('a8302026-0000-4000-8000-000000000002','[]')$$),
 '42501','Admin ne modifie pas ses droits');
SELECT is(pg_temp.admin_try($$SELECT snp_remplacer_habilitations_compte('a8302026-0000-4000-8000-000000000001','[]')$$),
 '42501','Admin ne modifie pas Owner');
SELECT is(pg_temp.admin_try($$SELECT snp_remplacer_habilitations_compte('a8302026-0000-4000-8000-000000000003','[]')$$),
 '42501','Admin ne modifie pas un pair');
SELECT is(pg_temp.admin_try($$UPDATE user_permissions SET can_edit=true WHERE user_id='a8302026-0000-4000-8000-000000000002'$$),
 '42501','écriture directe des permissions interdite');
SELECT pg_temp.admin_claims(2,'aal1','-renewed');
SELECT ok(NOT snp_actor_can_module_action('admin_test_refining','edit'),'MFA requise pour écrire');
SELECT pg_temp.admin_claims(1);
SELECT lives_ok($$SELECT snp_remplacer_habilitations_compte('a8302026-0000-4000-8000-000000000002','[]')$$,
 'Owner retire les habilitations Admin');
SELECT pg_temp.admin_claims(2,'aal2','-renewed');
SELECT ok(NOT snp_actor_can_module_action('admin_test_refining','view'),'révocation effective sans exception Admin');

RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
UPDATE modules SET is_active=true WHERE id='a8302026-0000-4000-8000-000000000101';
UPDATE user_profiles SET role='admin',is_active=true WHERE id='a8302026-0000-4000-8000-000000000002';
SELECT is((SELECT count(*) FROM user_permissions WHERE user_id='a8302026-0000-4000-8000-000000000002'),
 0::bigint,'mises à jour catalogue/profil ne rétablissent pas les droits retirés');
SELECT ok((SELECT can_view AND can_create AND can_edit AND can_delete AND can_approve FROM user_permissions
 WHERE user_id='a8302026-0000-4000-8000-000000000001' AND module_id='a8302026-0000-4000-8000-000000000102'),
 'Owner conserve tous ses droits y compris sur les modules inactifs');
SELECT is((SELECT can_edit FROM user_permissions WHERE user_id='a8302026-0000-4000-8000-000000000003'
 AND module_id='a8302026-0000-4000-8000-000000000101'),false,'les droits de l’autre Admin ne sont pas élargis');
SELECT * FROM finish();
ROLLBACK;
