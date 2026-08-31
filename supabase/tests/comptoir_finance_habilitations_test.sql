-- Finance Comptoir : attribution explicite, cloisonnement et compatibilité Admin.
BEGIN;
DO $$ BEGIN IF current_database() NOT LIKE 'sonasp_iam_audit_%' AND current_database()<>'sonasp_release_20260830' THEN
 RAISE EXCEPTION 'Base IAM isolée requise.'; END IF; END $$;
SET LOCAL search_path=public,extensions;
INSERT INTO snp_access_role_policies(role,portal_code,organization_type,organization_required,can_administer_accounts)
VALUES('owner','sonasp','sonasp',false,true),('admin','sonasp','sonasp',false,true),('comptoir','operator','comptoir',true,false)
ON CONFLICT DO NOTHING;
INSERT INTO snp_capability_catalog(code,domain,label,description,sensitive)
SELECT code,'test',code,'Contrat finance',true FROM unnest(ARRAY[
 'accounts.manage','comptoir.manage','comptoir.invoices.issue','comptoir.payments.execute',
 'comptoir.payments.reconcile','comptoir.tax.execute']) code ON CONFLICT DO NOTHING;
INSERT INTO snp_responsibility_catalog(code,capability_code,label,description)
VALUES('comptoir.manage','comptoir.manage','Comptoir','Gestion du comptoir') ON CONFLICT DO NOTHING;
INSERT INTO snp_role_responsibility_ceiling(role,responsibility_code,required)
VALUES('comptoir','comptoir.manage',true) ON CONFLICT DO NOTHING;
INSERT INTO snp_role_capabilities(role,capability_code)
SELECT 'admin',code FROM snp_capability_catalog WHERE code IN(
 'accounts.manage','comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile','comptoir.tax.execute')
ON CONFLICT DO NOTHING;
INSERT INTO snp_role_module_ceilings(role,access_domain,can_view,can_create,can_edit,can_delete,can_approve)
VALUES('comptoir','payments',true,true,true,false,false) ON CONFLICT DO NOTHING;
INSERT INTO modules(id,name,display_name,access_domain,is_active)
VALUES('32000000-0000-4000-8000-000000000100','finance-test-payments','Paiements de test','payments',true);
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'finance-'||n||'@example.invalid','','{}','{}',now(),now() FROM generate_series(1,4) n;
INSERT INTO user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'finance-'||n||'@example.invalid','Finance test '||n,CASE n WHEN 1 THEN 'owner' WHEN 4 THEN 'admin' ELSE 'comptoir' END,
 true,now() FROM generate_series(1,4) n;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',
 extensions.digest('finance-session-'||n||'-0','sha256') FROM generate_series(1,4) n;
INSERT INTO snp_ministries(id,code,name)
VALUES('32000000-0000-4000-8000-000000000900','FINANCE-TEST','Tutelle synthétique');
INSERT INTO snp_organizations(id,code,name,organization_type,supervising_ministry_id)
SELECT ('32000000-0000-4000-8000-'||lpad((900+n)::text,12,'0'))::uuid,'FINANCE-C-'||n,'Comptoir test '||n,'comptoir',
 '32000000-0000-4000-8000-000000000900' FROM generate_series(2,3) n;
CREATE FUNCTION pg_temp.claims(n integer,aal text DEFAULT 'aal2',iteration integer DEFAULT 0) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims',jsonb_build_object(
 'sub','32000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','aal',aal,
 'session_id','finance-session-'||n||'-'||iteration,'exp',extract(epoch FROM now()+interval '1 hour')::bigint)::text,true);
END $$;
CREATE FUNCTION pg_temp.try_sql(statement text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE statement; RETURN 'OK'; EXCEPTION WHEN OTHERS THEN
 RAISE NOTICE 'Finance: % %',SQLSTATE,SQLERRM; RETURN SQLSTATE; END $$;
-- Le helper financier est privé. Ce harnais reproduit uniquement son appel par
-- un RPC SECURITY DEFINER, en conservant le JWT et le périmètre réels de l'acteur.
CREATE FUNCTION pg_temp.finance_scope(organization_id uuid) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.snp_4i_capability_for_scope(organization_id,'comptoir.payments.execute','sonasp.finance.execute');
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT no_plan();
SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(1);
SELECT ok(NOT has_table_privilege('authenticated','public.snp_responsibility_catalog','UPDATE'),
 'le catalogue de responsabilités ne peut pas être altéré directement');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_responsibility_conflicts','DELETE'),
 'les séparations de fonctions ne peuvent pas être effacées directement');
SELECT is(pg_temp.try_sql($s$SELECT snp_configurer_acces_compte(
 '32000000-0000-4000-8000-000000000002','Exécutant',NULL,'comptoir',true,NULL,
 '32000000-0000-4000-8000-000000000902',NULL,
 '{"comptoir.manage":true,"comptoir.invoices.issue":true,"comptoir.payments.execute":true,"comptoir.tax.execute":true}','[]')$s$),
 'OK','Owner attribue les droits financiers à un exécutant Comptoir');
SELECT is(pg_temp.try_sql($s$SELECT snp_configurer_acces_compte(
 '32000000-0000-4000-8000-000000000003','Contrôleur',NULL,'comptoir',true,NULL,
 '32000000-0000-4000-8000-000000000903',NULL,
 '{"comptoir.manage":true,"comptoir.payments.reconcile":true}','[]')$s$),
 'OK','Owner attribue le contrôle à un compte distinct');
SELECT is(pg_temp.try_sql($s$SELECT snp_configurer_acces_compte(
 '32000000-0000-4000-8000-000000000002','Cumul interdit',NULL,'comptoir',true,NULL,
 '32000000-0000-4000-8000-000000000902',NULL,
 '{"comptoir.manage":true,"comptoir.payments.execute":true,"comptoir.payments.reconcile":true}','[]')$s$),
 '42501','le serveur refuse le cumul exécution et rapprochement');
SELECT is((SELECT full_name FROM user_profiles WHERE id='32000000-0000-4000-8000-000000000002'),
 'Exécutant','le refus ne modifie ni le profil ni sa configuration');
SELECT is(pg_temp.try_sql($s$SELECT snp_validate_responsibilities('mine','{"comptoir.payments.execute":true}')$s$),
 '42501','les droits financiers Comptoir ne sont pas attribuables à Mine');
SELECT pg_temp.claims(4);
SELECT ok(snp_actor_has_capability('comptoir.invoices.issue'),'la capacité administrative historique reste effective');
SELECT pg_temp.claims(1);
SELECT is(pg_temp.try_sql($s$SELECT snp_configurer_acces_compte(
 '32000000-0000-4000-8000-000000000004','Admin modifié',NULL,'admin',true,NULL,NULL,NULL,'{}','[]')$s$),
 'OK','modifier les coordonnées Admin reste possible');
RESET ROLE;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',
 extensions.digest('finance-session-'||n||'-1','sha256') FROM generate_series(2,4) n;
SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(4,'aal2',1);
SELECT ok(snp_actor_has_capability('comptoir.invoices.issue'),'édition Admin ne révoque pas implicitement ses droits financiers historiques');
SELECT pg_temp.claims(2,'aal2',1);
SELECT ok(snp_actor_has_capability('comptoir.invoices.issue'),'exécutant peut facturer');
SELECT ok(snp_actor_has_capability('comptoir.payments.execute'),'exécutant peut payer');
SELECT ok(snp_actor_has_capability('comptoir.tax.execute'),'exécutant peut transmettre les reversements');
SELECT ok(NOT snp_actor_has_capability('comptoir.payments.reconcile'),'exécutant ne peut pas rapprocher');
SELECT ok(snp_user_permission_allowed(auth.uid(),'32000000-0000-4000-8000-000000000100','create'),'plafond Paiements autorise la création explicite');
SELECT ok(NOT snp_user_permission_allowed(auth.uid(),'32000000-0000-4000-8000-000000000100','approve'),'plafond Paiements interdit le contrôle par exécutant');
SELECT is(pg_temp.try_sql($s$SELECT pg_temp.finance_scope('32000000-0000-4000-8000-000000000902')$s$),
 'OK','la garde financière accepte le comptoir rattaché');
SELECT is(pg_temp.try_sql($s$SELECT pg_temp.finance_scope('32000000-0000-4000-8000-000000000903')$s$),
 '42501','la garde financière refuse un autre comptoir');
SELECT is(pg_temp.try_sql($s$SELECT snp_configurer_acces_compte(
 '32000000-0000-4000-8000-000000000002','Auto modification',NULL,'comptoir',true,NULL,
 '32000000-0000-4000-8000-000000000902',NULL,'{"comptoir.manage":true}','[]')$s$),
 '42501','un Comptoir ne modifie pas ses propres responsabilités');
SELECT pg_temp.claims(2,'aal1',1);
SELECT ok(NOT snp_actor_has_capability('comptoir.payments.execute'),'les paiements exigent AAL2');
SELECT pg_temp.claims(3,'aal2',1);
SELECT ok(snp_actor_has_capability('comptoir.payments.reconcile'),'le contrôleur peut rapprocher');
SELECT ok(NOT snp_actor_has_capability('comptoir.payments.execute'),'le contrôleur ne peut pas exécuter');
SELECT ok(snp_user_permission_allowed(auth.uid(),'32000000-0000-4000-8000-000000000100','approve'),'plafond Paiements autorise le contrôle explicite');
SELECT pg_temp.claims(1);
SELECT is(pg_temp.try_sql($s$SELECT snp_definir_capacite_utilisateur(
 '32000000-0000-4000-8000-000000000004','comptoir.invoices.issue',false,'Retrait administratif explicite',NULL)$s$),
 'OK','Owner conserve la révocation explicite de la capacité historique Admin');
SELECT is(pg_temp.try_sql($s$SELECT snp_configurer_acces_compte(
 '32000000-0000-4000-8000-000000000002','Exécutant retiré',NULL,'comptoir',true,NULL,
 '32000000-0000-4000-8000-000000000902',NULL,'{"comptoir.manage":true}','[]')$s$),
 'OK','Owner peut retirer les responsabilités financières');
SELECT pg_temp.claims(2,'aal2',1);
SELECT ok(NOT snp_actor_has_capability('comptoir.payments.execute'),'la session et la capacité retirées ne restent pas utilisables');
RESET ROLE;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',
 extensions.digest('finance-session-'||n||'-2','sha256') FROM unnest(ARRAY[2,4]) n;
SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(2,'aal2',2);
SELECT ok(NOT snp_actor_has_capability('comptoir.payments.execute'),'même après reconnexion, aucune finance implicite pour Comptoir');
SELECT pg_temp.claims(4,'aal2',2);
SELECT ok(NOT snp_actor_has_capability('comptoir.invoices.issue'),'le refus explicite administratif historique est respecté');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
