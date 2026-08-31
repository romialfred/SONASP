-- Schéma réel, comptes synthétiques, aucune simulation des fonctions d'autorisation.
-- Exécuter uniquement dans la copie isolée créée pour cet audit.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'sonasp_iam_audit_%' AND current_database()<>'sonasp_release_20260830' THEN
    RAISE EXCEPTION 'Ce scénario exige une base IAM isolée.';
  END IF;
END $$;
SET LOCAL search_path=public,extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

INSERT INTO public.snp_access_role_policies(role,portal_code,organization_type,organization_required,can_administer_accounts)
VALUES ('owner','sonasp','sonasp',false,true),('admin','sonasp','sonasp',false,true),
 ('management','sonasp','sonasp',false,false),('customer','client','customer',false,false),
 ('dgi','dgi','dgi',true,false),('dgmg','dgmg','dgmg',true,false),('comptoir','operator','comptoir',true,false)
ON CONFLICT(role) DO NOTHING;
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES ('accounts.manage','accounts','Administration','Test IAM',true),
 ('reports.read','reports','Lecture','Test IAM',false),
 ('sonasp.prepare','sonasp','Préparation','Test IAM',true),
 ('sonasp.approve','sonasp','Approbation','Test IAM',true),
 ('dgi.fiscal.control','dgi','Fiscalité','Test IAM',true),
 ('dgmg.supervise','dgmg','Supervision','Test IAM',true),
 ('comptoir.manage','comptoir','Comptoir','Test IAM',true)
ON CONFLICT(code) DO NOTHING;
INSERT INTO snp_responsibility_catalog(code,capability_code,label,description)
SELECT code,code,code,'Responsabilité de test' FROM unnest(ARRAY['dgi.fiscal.control','dgmg.supervise','comptoir.manage']) code;
INSERT INTO snp_role_responsibility_ceiling(role,responsibility_code,required) VALUES
 ('dgi','dgi.fiscal.control',true),('dgmg','dgmg.supervise',true),('comptoir','comptoir.manage',true);
INSERT INTO public.snp_role_capabilities(role,capability_code)
VALUES ('admin','accounts.manage'),('customer','reports.read') ON CONFLICT DO NOTHING;
INSERT INTO public.snp_role_module_ceilings(role,access_domain,can_view,can_create,can_edit,can_delete,can_approve)
VALUES ('owner','users',true,true,true,true,true),('admin','users',true,true,true,true,false),
 ('customer','reports',true,false,false,false,false),('management','reports',true,false,false,false,false)
ON CONFLICT DO NOTHING;
INSERT INTO public.modules(id,name,display_name,access_domain,is_active) VALUES
 ('30000000-0000-4000-8000-000000000101','iam-test-users','Utilisateurs IAM','users',true),
 ('30000000-0000-4000-8000-000000000102','iam-test-inactive','Module inactif IAM','unknown',false),
 ('30000000-0000-4000-8000-000000000103','iam-test-reports','Rapports IAM','reports',true);

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'iam-'||n||'@example.invalid','','{}','{}',now(),now() FROM generate_series(1,10) n;
INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'iam-'||n||'@example.invalid','Compte IAM '||n,
 CASE n WHEN 1 THEN 'owner' WHEN 2 THEN 'owner' WHEN 3 THEN 'admin' WHEN 4 THEN 'admin'
 WHEN 6 THEN 'management' WHEN 7 THEN 'owner' ELSE 'customer' END,true,
 CASE WHEN n=7 THEN NULL ELSE now() END FROM generate_series(1,10) n;
INSERT INTO public.user_sessions(user_id,expires_at,token_hash)
SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',
 extensions.digest('iam-test-session-'||n,'sha256') FROM generate_series(1,7) n;
INSERT INTO snp_ministries(id,code,name) VALUES('30000000-0000-4000-8000-000000000900','IAM','Tutelle test IAM');
INSERT INTO snp_organizations(id,code,name,organization_type,supervising_ministry_id)
SELECT ('30000000-0000-4000-8000-'||lpad((900+n)::text,12,'0'))::uuid,'IAM-ORG-'||n,'Organisation IAM '||n,
 CASE n WHEN 8 THEN 'dgi' WHEN 9 THEN 'dgmg' ELSE 'comptoir' END,'30000000-0000-4000-8000-000000000900'
FROM generate_series(8,10) n;

CREATE FUNCTION pg_temp.iam_claims(n integer,aal text DEFAULT 'aal2') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object(
  'sub','30000000-0000-4000-8000-'||lpad(n::text,12,'0'), 'role','authenticated','aal',aal,
  'session_id','iam-test-session-'||n,'exp',extract(epoch FROM now()+interval '1 hour')::bigint)::text,true);
END $$;
CREATE FUNCTION pg_temp.iam_try(statement text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE statement; RETURN 'OK'; EXCEPTION WHEN OTHERS THEN
 IF SQLSTATE NOT IN('42501','22023') THEN RAISE NOTICE 'IAM diagnostic: % %',SQLSTATE,SQLERRM; END IF;
 RETURN SQLSTATE; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT no_plan();

SET LOCAL ROLE authenticated;
SELECT pg_temp.iam_claims(1);
SELECT ok(public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000002'),'Owner peut administrer un autre Owner');
SELECT ok(NOT public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000001'),'Owner ne peut pas auto-administrer ses droits');
SELECT is(pg_temp.iam_try($$SELECT snp_configurer_acces_compte('30000000-0000-4000-8000-000000000008',
 'Compte DGI',NULL,'dgi',true,NULL,'30000000-0000-4000-8000-000000000908',NULL,'{"dgi.fiscal.control":true}','[]')$$),
 'OK','le rôle DGI et son rattachement sont acceptés par le schéma réel');
SELECT is(pg_temp.iam_try($$SELECT snp_configurer_acces_compte('30000000-0000-4000-8000-000000000009',
 'Compte DGMG',NULL,'dgmg',true,NULL,'30000000-0000-4000-8000-000000000909',NULL,'{"dgmg.supervise":true}','[]')$$),
 'OK','le rôle DGMG et son rattachement sont acceptés');
SELECT is(pg_temp.iam_try($$SELECT snp_configurer_acces_compte('30000000-0000-4000-8000-000000000010',
 'Compte Comptoir',NULL,'comptoir',true,NULL,'30000000-0000-4000-8000-000000000910',NULL,'{"comptoir.manage":true}','[]')$$),
 'OK','le rôle Comptoir et son rattachement sont acceptés');
SELECT is(pg_temp.iam_try($$SELECT snp_configurer_acces_compte('30000000-0000-4000-8000-000000000008',
 'Compte DGI',NULL,'dgi',true,NULL,'30000000-0000-4000-8000-000000000910',NULL,'{"dgi.fiscal.control":true}','[]')$$),
 '42501','une organisation Comptoir ne peut pas représenter la DGI');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000001','Auto',NULL,'admin',true,NULL,NULL,NULL,'{}','[]')$$),
 '42501','auto-déclassement Owner refusé');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000002','Owner corrigé',NULL,'owner',true,NULL,NULL,NULL,'{}','[]')$$),
 'OK','édition complète d’un autre Owner via RPC');
SELECT is((SELECT full_name FROM user_profiles WHERE id='30000000-0000-4000-8000-000000000002'),
 'Owner corrigé','identité réellement persistée');
SELECT is((SELECT count(*) FROM user_permissions WHERE user_id='30000000-0000-4000-8000-000000000002'
 AND can_view AND can_create AND can_edit AND can_delete AND can_approve),3::bigint,'Owner conserve les trois modules dont l’inactif');
SELECT is(pg_temp.iam_try($$SELECT public.snp_remplacer_habilitations_compte(
 '30000000-0000-4000-8000-000000000002','[{"module_id":"30000000-0000-4000-8000-000000000101","can_view":false}]')$$),
 '42501','réduction individuelle des droits Owner refusée');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000005','Nouveau Owner',NULL,'owner',true,NULL,NULL,NULL,'{}','[]')$$),
 'OK','promotion d’un nouveau compte vers Owner autorisée');
SELECT is((SELECT role FROM user_profiles WHERE id='30000000-0000-4000-8000-000000000005'),'owner','promotion effectivement persistée');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000004','Admin désactivé',NULL,'admin',false,NULL,NULL,NULL,'{}','[]')$$),
 'OK','le formulaire peut désactiver un autre compte par le chemin canonique');
SELECT is((SELECT is_active FROM user_profiles WHERE id='30000000-0000-4000-8000-000000000004'),false,'désactivation persistée');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000004','Owner activé',NULL,'owner',true,NULL,NULL,NULL,'{}','[]')$$),
 'OK','promotion et activation atomiques d’un compte initialement inactif');
SELECT is((SELECT role FROM user_profiles WHERE id='30000000-0000-4000-8000-000000000004'),'owner','rôle Owner activé persisté');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000004','Admin désactivé',NULL,'admin',false,NULL,NULL,NULL,'{}','[]')$$),
 'OK','Owner peut rétrograder un autre Owner sans perdre ses propres droits');

SELECT pg_temp.iam_claims(3);
SELECT ok(NOT public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000001'),'Admin ne gère pas Owner');
SELECT ok(NOT public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000004'),'Admin ne gère pas un pair même inactif');
SELECT is(pg_temp.iam_try($$SELECT public.snp_sessions_revoquer_toutes('30000000-0000-4000-8000-000000000001',false,'Tentative administrateur')$$),
 '42501','Admin ne peut pas révoquer les sessions Owner par un RPC direct');
SELECT is(pg_temp.iam_try($$SELECT public.snp_definir_capacite_utilisateur(
 '30000000-0000-4000-8000-000000000004','reports.read',false,'Tentative sur un pair')$$),
 '42501','ancien RPC de capacités ne permet pas de toucher un pair');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000006','Escalade',NULL,'owner',true,NULL,NULL,NULL,'{}','[]')$$),
 '42501','Admin ne peut pas promouvoir une cible vers Owner');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_acces_compte(
 '30000000-0000-4000-8000-000000000006','Escalade',NULL,'admin',true,NULL,NULL,NULL,'{}','[]')$$),
 '42501','Admin ne peut pas créer un pair par promotion');
SELECT is(pg_temp.iam_try($$SELECT public.snp_configurer_compte_portail(
 '30000000-0000-4000-8000-000000000004','Ancien appel',NULL,'admin',true,NULL)$$),
 '42501','ancien configurateur de portail ne contourne pas la hiérarchie');
SELECT is(pg_temp.iam_try($$SELECT public.snp_assign_user_organization(
 '30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000901','manager','Tentative inter-compte',true)$$),
 '42501','ancien rattachement d’organisation ne contourne pas la hiérarchie');

SELECT pg_temp.iam_claims(6);
SELECT is(pg_temp.iam_try($$DELETE FROM user_permissions WHERE user_id='30000000-0000-4000-8000-000000000001'$$),
 '42501','Direction ne peut pas supprimer les habilitations Owner');
SELECT is(pg_temp.iam_try($$INSERT INTO user_permissions(user_id,module_id,can_view) VALUES(
 '30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000103',true)$$),
 '42501','Direction ne peut pas s’attribuer une habilitation directement');
SELECT is(pg_temp.iam_try($$UPDATE user_profiles SET mfa_enrolled_at=NULL WHERE id='30000000-0000-4000-8000-000000000006'$$),
 '42501','retirer soi-même la preuve MFA est interdit');
SELECT is(pg_temp.iam_try($$UPDATE user_profiles SET is_sales_approver=true WHERE id='30000000-0000-4000-8000-000000000006'$$),
 '42501','auto-attribution du drapeau approbateur interdite');
SELECT is(pg_temp.iam_try($$UPDATE user_profiles SET full_name='Coordonnées modifiées',language='fr'
 WHERE id='30000000-0000-4000-8000-000000000006'$$),'OK','les préférences personnelles restent modifiables');
SELECT is(pg_temp.iam_try($$DELETE FROM user_profiles WHERE id='30000000-0000-4000-8000-000000000001'$$),
 '42501','suppression directe d’un compte refusée');
SELECT is(pg_temp.iam_try($$SELECT public.snp_link_collector_account(
 '30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000901',
 '30000000-0000-4000-8000-000000000902','Auto-attribution collecteur')$$),
 '42501','ancien rattachement collecteur ne permet pas l’auto-attribution');

SELECT pg_temp.iam_claims(7,'aal1');
SELECT ok(NOT public.snp_mfa_satisfaite(),'un compte non enrôlé ne satisfait pas la MFA');
SELECT ok(NOT public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000003'),'Owner non enrôlé ne peut pas administrer');
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
VALUES(gen_random_uuid(),'30000000-0000-4000-8000-000000000007','totp','verified',now(),now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.iam_claims(7);
SELECT is(pg_temp.iam_try($$SELECT public.snp_confirmer_enrolement_mfa()$$),'OK','confirmation MFA personnelle toujours fonctionnelle');
SELECT ok(public.snp_mfa_satisfaite(),'facteur vérifié et AAL2 ouvrent les accès après enrôlement');
SELECT pg_temp.iam_claims(1,'aal1');
SELECT ok(NOT public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000003'),'AAL1 refuse l’administration même au Owner enrôlé');
SELECT pg_temp.iam_claims(2);
SELECT ok(NOT public.snp_peut_administrer_compte('30000000-0000-4000-8000-000000000003'),'la session révoquée après édition est inutilisable');

RESET ROLE;
SELECT ok(EXISTS(SELECT 1 FROM snp_account_admin_audit WHERE target_id='30000000-0000-4000-8000-000000000005'
 AND action='access_configuration' AND new_values->>'role'='owner'),'promotion Owner journalisée');
SELECT ok(NOT EXISTS(SELECT 1 FROM user_sessions WHERE user_id='30000000-0000-4000-8000-000000000004' AND is_active),
 'désactivation révoque les sessions de la cible');
SELECT ok(EXISTS(SELECT 1 FROM audit_trail WHERE record_id='30000000-0000-4000-8000-000000000004'
 AND action='account_deactivated' AND details->'old_values'->>'is_active'='true'),
 'le changement de statut conserve une trace d’audit exploitable');
SELECT * FROM finish();
ROLLBACK;
