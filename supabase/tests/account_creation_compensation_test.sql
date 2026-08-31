-- Exact profile/RPC/compensation sequence used by create-user, with real triggers.
-- Synthetic Auth identities only; no external Auth/SMTP API. Always rolled back.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'sonasp_iam_audit_%' AND current_database()<>'sonasp_release_20260830' THEN
    RAISE EXCEPTION 'Base IAM isolée requise.';
  END IF;
END $$;
SET LOCAL search_path=public,extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated,service_role;
INSERT INTO snp_capability_catalog(code,domain,label,description,sensitive)
VALUES('accounts.manage','accounts','Comptes','Test création',true) ON CONFLICT DO NOTHING;
INSERT INTO snp_access_role_policies(role,portal_code,organization_type,organization_required,can_administer_accounts)
VALUES('owner','sonasp','sonasp',false,true),('admin','sonasp','sonasp',false,true)
ON CONFLICT DO NOTHING;
INSERT INTO modules(id,name,display_name,access_domain,is_active) VALUES
 ('41000000-0000-4000-8000-000000000101','creation-sales','Ventes test','sales',true),
 ('41000000-0000-4000-8000-000000000102','creation-inactive','Module inactif test','unknown',false);
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('41000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'creation-'||n||'@example.invalid','','{}','{}',now(),now() FROM generate_series(1,3) n;
INSERT INTO user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
VALUES('41000000-0000-4000-8000-000000000001','creation-1@example.invalid','Owner acteur','owner',true,now());
INSERT INTO user_sessions(user_id,expires_at,token_hash)
VALUES('41000000-0000-4000-8000-000000000001',now()+interval '1 hour',extensions.digest('creation-test-session','sha256'));
SELECT no_plan();

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT lives_ok($$INSERT INTO user_profiles(id,email,full_name,phone,role,mining_company_id,is_active,
 two_factor_enabled,mfa_enrolled_at,must_change_password,password_changed_at)
VALUES('41000000-0000-4000-8000-000000000002','creation-2@example.invalid','Admin créé',NULL,'admin',NULL,true,false,NULL,true,NULL)$$,
 'le service insère exactement le profil Admin de create-user');
SELECT lives_ok($$INSERT INTO user_profiles(id,email,full_name,phone,role,mining_company_id,is_active,
 two_factor_enabled,mfa_enrolled_at,must_change_password,password_changed_at)
VALUES('41000000-0000-4000-8000-000000000003','creation-3@example.invalid','Owner créé',NULL,'customer',NULL,false,false,NULL,true,NULL)$$,
 'le futur Owner est inséré inactif et sans privilège Owner');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','41000000-0000-4000-8000-000000000001',
 'role','authenticated','aal','aal2','session_id','creation-test-session',
 'exp',extract(epoch FROM now()+interval '1 hour')::bigint)::text,true);
SELECT lives_ok($$SELECT snp_remplacer_habilitations_compte('41000000-0000-4000-8000-000000000002',
 '[{"module_id":"41000000-0000-4000-8000-000000000101","can_view":true,"can_create":true,"can_edit":true,"can_delete":true,"can_approve":true}]')$$,
 'Owner attribue les cinq droits au nouvel Admin non encore enrôlé');
SELECT lives_ok($$SELECT snp_configurer_acces_compte('41000000-0000-4000-8000-000000000003',
 'Owner créé',NULL,'owner',true,NULL,NULL,NULL,'{}','[]')$$,
 'promotion Owner autorisée par le JWT de l’acteur, pas par la clé de service');
SELECT is((SELECT role FROM user_profiles WHERE id='41000000-0000-4000-8000-000000000003'),'owner','rôle effectivement persisté');
SELECT is((SELECT count(*) FROM user_permissions WHERE user_id='41000000-0000-4000-8000-000000000003'
 AND module_id IN ('41000000-0000-4000-8000-000000000101','41000000-0000-4000-8000-000000000102')
 AND can_view AND can_create AND can_edit AND can_delete AND can_approve),2::bigint,'Owner reçoit aussi le module inactif');
SELECT ok((SELECT must_change_password AND mfa_enrolled_at IS NULL FROM user_profiles
 WHERE id='41000000-0000-4000-8000-000000000003'),'activation et MFA restent obligatoires pour le nouveau compte');

-- Compensating deletion after a failed welcome email, as performed by the Edge.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DELETE FROM snp_collector_accounts WHERE user_id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
DELETE FROM snp_user_organization_memberships WHERE user_id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
DELETE FROM snp_user_responsibilities WHERE user_id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
DELETE FROM snp_user_capabilities WHERE user_id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
DELETE FROM user_permissions WHERE user_id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
SELECT lives_ok($$DELETE FROM user_profiles WHERE id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003')$$,
 'les nouveaux profils Admin et Owner sont supprimables après compensation');
RESET ROLE;
-- GoTrue's admin.deleteUser executes the Auth deletion under its own DB role.
SELECT lives_ok($$DELETE FROM auth.users WHERE id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003')$$,
 'les identités Auth sans activité métier sont supprimables');
SELECT is((SELECT count(*) FROM user_profiles WHERE id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003')),0::bigint,'aucun profil incomplet conservé');
SELECT is((SELECT count(*) FROM auth.users WHERE id IN('41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003')),0::bigint,'aucune identité Auth incomplète conservée');
SELECT ok(EXISTS(SELECT 1 FROM snp_account_admin_audit WHERE target_id='41000000-0000-4000-8000-000000000003'
 AND action='access_configuration'),'la trace administrative est conservée');
SELECT ok(EXISTS(SELECT 1 FROM user_profiles WHERE id='41000000-0000-4000-8000-000000000001'
 AND role='owner' AND is_active),'le compte acteur est inchangé');
SELECT * FROM finish();
ROLLBACK;
