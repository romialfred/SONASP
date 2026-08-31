BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
-- Droits du harnais de test uniquement ; intégralement annulés en fin de test.
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES('accounts.manage','accounts','Administration','Contrat de continuité Owner',true),
 ('referentials.manage','referentials','Référentiels','Contrat de continuité Owner',true) ON CONFLICT DO NOTHING;

CREATE FUNCTION pg_temp.set_owner_module_claims(p_sub uuid,p_role text,p_aal text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_sub::text,true);
  PERFORM set_config('request.jwt.claim.role',p_role,true);
  PERFORM set_config('request.jwt.claim.aal',p_aal,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,
    'session_id','owner-modules-'||p_sub::text,
    'exp',floor(extract(epoch FROM now()+interval '1 hour'))::bigint
  )::text,true);
END;
$fn$;
GRANT EXECUTE ON FUNCTION pg_temp.set_owner_module_claims(uuid,text,text) TO authenticated;

SELECT plan(26);
SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000001','service_role','aal2');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('85000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-modules@sonasp.invalid','','{}','{}',now(),now()),
  ('85000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-modules@sonasp.invalid','','{}','{}',now(),now());
INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
VALUES
  ('85000000-0000-4000-8000-000000000001','owner-modules@sonasp.invalid','Owner modules de test','owner',true,now()),
  ('85000000-0000-4000-8000-000000000002','admin-modules@sonasp.invalid','Admin modules de test','admin',true,now());
INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active)
SELECT id,extensions.digest('owner-modules-'||id::text,'sha256'),now()+interval '1 hour',true
FROM public.user_profiles WHERE id IN ('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002');

INSERT INTO public.modules(id,name,display_name,is_active,access_domain)
VALUES
  ('85000000-0000-4000-8000-000000000101','owner_scope_contract','Module de test',true,'inventory'),
  ('85000000-0000-4000-8000-000000000102','owner_scope_child','Sous-module de test',true,'inventory'),
  ('85000000-0000-4000-8000-000000000103','owner_scope_future','Module futur désactivé',false,'inventory');
INSERT INTO public.snp_modules(id,code,nom,route,parent_id,ordre,est_actif,est_visible_menu)
VALUES
  ('85000000-0000-4000-8000-000000000201','owner_scope_contract','Module de test','/owner-scope-test',NULL,999,true,true),
  ('85000000-0000-4000-8000-000000000202','owner_scope_child','Sous-module de test','/owner-scope-test/child','85000000-0000-4000-8000-000000000201',1,true,true);

SELECT ok((SELECT can_view AND can_create AND can_edit AND can_delete AND can_approve
  FROM public.user_permissions WHERE user_id='85000000-0000-4000-8000-000000000001'
  AND module_id='85000000-0000-4000-8000-000000000103'),
  'un nouveau module désactivé reçoit immédiatement tous les droits Owner');
SELECT is(public.snp_user_permission_allowed('85000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000103','create'),true,'le plafond Owner ignore la désactivation globale');
SELECT is(public.snp_user_permission_allowed('85000000-0000-4000-8000-000000000002',
  '85000000-0000-4000-8000-000000000103','view'),false,'un Administrateur reste borné par la désactivation');
SELECT is(public.snp_permission_allowed('owner','85000000-0000-4000-8000-000000000103','invented'),false,
  'une action inconnue reste refusée au Owner');

SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(public.snp_actor_can_module_action('owner_scope_contract','view'),'le Owner consulte le module actif');
SELECT ok((SELECT bool_and(public.snp_actor_can_module_action('owner_scope_future',action))
  FROM unnest(ARRAY['view','create','edit','delete','approve']) action),'le Owner accède aux cinq actions du module désactivé');
SELECT is(public.snp_actor_can_module_action('module_inconnu','view'),false,'un module inconnu reste fermé');
SELECT is(public.snp_actor_can_module_action('owner_scope_contract','invented'),false,'une action inconnue ne bénéficie pas de l’exception');
SELECT lives_ok($$SELECT public.snp_update_module_catalog(
  '85000000-0000-4000-8000-000000000201',p_est_actif=>false)$$,
  'la désactivation est atomique et son audit ne viole plus la contrainte');
SELECT ok((SELECT bool_and(NOT est_actif) FROM public.snp_modules
  WHERE id IN ('85000000-0000-4000-8000-000000000201','85000000-0000-4000-8000-000000000202')),
  'la désactivation du parent se propage aux sous-modules');
SELECT ok((SELECT bool_and(NOT is_active) FROM public.modules
  WHERE name IN ('owner_scope_contract','owner_scope_child')),'les deux catalogues restent synchronisés');
SELECT is((SELECT count(*) FROM public.snp_account_admin_audit WHERE actor_id='85000000-0000-4000-8000-000000000001'
  AND action='module_catalog_update'),1::bigint,'une seule trace d’audit documente la bascule');
SELECT ok(public.snp_actor_can_module_action('owner_scope_contract','edit')
  AND public.snp_actor_can_module_action('owner_scope_child','view'),
  'le Owner ne perd ni le parent ni son sous-module après désactivation');
SELECT is((SELECT count(*) FROM public.get_user_modules('85000000-0000-4000-8000-000000000001')
  WHERE code IN ('owner_scope_contract','owner_scope_child')),2::bigint,
  'l’API de catalogue conserve les modules désactivés du Owner');

SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000002','authenticated','aal2');
SELECT is(public.snp_actor_can_module_action('owner_scope_contract','view'),false,
  'l’Administrateur perd bien la consultation d’un module désactivé');
SELECT is(public.snp_actor_can_module_action('owner_scope_child','edit'),false,
  'l’Administrateur ne contourne pas la désactivation du sous-module');
SELECT is((SELECT count(*) FROM public.get_user_modules('85000000-0000-4000-8000-000000000002')
  WHERE code IN ('owner_scope_contract','owner_scope_child')),0::bigint,
  'l’API de catalogue masque les modules désactivés aux autres comptes');

SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000001','authenticated','aal2');
SELECT lives_ok($$SELECT public.snp_update_module_catalog(
  '85000000-0000-4000-8000-000000000201',p_est_actif=>true,p_est_visible_menu=>false)$$,
  'la réactivation et le masquage sont enregistrés sans perdre l’audit');
SELECT is((SELECT count(*) FROM public.snp_account_admin_audit WHERE actor_id='85000000-0000-4000-8000-000000000001'
  AND action='module_catalog_update'),2::bigint,'les deux opérations sont auditées');
SELECT ok(public.snp_actor_can_module_action('owner_scope_contract','view'),'un masquage n’enlève pas l’accès Owner');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_account_admin_audit','INSERT'),
  'le navigateur ne peut pas fabriquer de journal d’audit');
SELECT ok(NOT has_function_privilege('anon','public.snp_actor_can_module_action(text,text)','EXECUTE'),
  'le contrôle de permission ne devient pas exécutable anonymement');

SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000001','authenticated','aal1');
SELECT is(public.snp_actor_can_module_action('owner_scope_contract','edit'),false,
  'la MFA reste obligatoire pour les mutations Owner');

RESET ROLE;
SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000001','service_role','aal2');
SELECT lives_ok($$INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action)
  VALUES('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','access_configuration')$$,
  'l’action canonique de configuration des accès est aussi acceptée');
SELECT throws_ok($$INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action)
  VALUES('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','invented')$$,
  '23514',NULL,'la contrainte continue de refuser une action d’audit inconnue');
UPDATE public.user_sessions SET is_active=false WHERE user_id='85000000-0000-4000-8000-000000000001';
SELECT pg_temp.set_owner_module_claims('85000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(public.snp_actor_can_module_action('owner_scope_contract','view'),false,
  'une session Owner révoquée ne bénéficie pas de l’accès de continuité');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
