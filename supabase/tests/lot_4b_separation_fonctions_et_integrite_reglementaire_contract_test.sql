BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid, p_role text, p_aal text
)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_sub::text,true);
  PERFORM set_config('request.jwt.claim.role',p_role,true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',p_sub,'role',p_role,'aal',p_aal)::text,true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_license_request()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_export_license_requests;
BEGIN
  v:=public.snp_portail_mine_soumettre_demande_licence_export(
    500,CURRENT_DATE+15,'Abidjan, Côte d''Ivoire',
    'Export commercial couvert par le plan annuel','Dossier test 4B'
  );
  RETURN 'OK:'||v.status;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_request_insert(p_company uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.snp_export_license_requests(
    mining_company_id,requested_quantity_grams,desired_export_date,
    destination,reason,submitted_by
  ) VALUES (
    p_company,10,CURRENT_DATE+5,'Lomé','Demande directe interdite par le contrat 4B',auth.uid()
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_license_insert(p_company uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.export_licenses(
    license_number,mining_company_id,request_date,start_date,end_date,
    issuing_institution,authorized_quantity_grams,used_quantity_grams,
    remaining_quantity_grams,status
  ) VALUES (
    '4B-DIRECT-'||left(gen_random_uuid()::text,8),p_company,CURRENT_DATE,
    CURRENT_DATE,CURRENT_DATE+30,'Interdit',10,0,10,'active'
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_license_usage(p_license uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.export_licenses SET used_quantity_grams=used_quantity_grams+1
  WHERE id=p_license;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_license_decision(p_request uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_export_license_requests;
BEGIN
  v:=public.snp_sonasp_decider_demande_licence_export(
    p_request,'approved','LIC-4B-0001',CURRENT_DATE,CURRENT_DATE+60,
    'Autorité nationale des exportations',400,
    'Autorisation conforme après contrôle indépendant','Décision test 4B'
  );
  RETURN 'OK:'||v.status;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_license_modify(p_license uuid,p_status text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_before public.export_licenses; v_after public.export_licenses;
BEGIN
  SELECT * INTO v_before FROM public.export_licenses WHERE id=p_license;
  v_after:=public.snp_sonasp_modifier_licence_export(
    p_license,v_before.updated_at,450,NULL,NULL,p_status,NULL,NULL,NULL,
    'Révision réglementaire contrôlée dans le test 4B'
  );
  RETURN 'OK:'||v_after.status;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_contract_status(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.snp_contrats SET statut='actif' WHERE id=p_id;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_contract_transition(p_id uuid,p_status text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_contrats;
BEGIN
  v:=public.snp_changer_statut_contrat(p_id,p_status,NULL,'Transition test 4B');
  RETURN 'OK:'||v.statut;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_requisition_status(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.snp_requisitions SET statut='autorisee' WHERE id=p_id;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_requisition_transition(p_id uuid,p_status text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_requisitions;
BEGIN
  v:=public.snp_changer_statut_requisition(p_id,p_status,NULL,'Transition test 4B');
  RETURN 'OK:'||v.statut;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_reglement_status(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.snp_reglements_achat SET statut='execute' WHERE id=p_id;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_affect_fifo(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.snp_affecter_fifo(p_id);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_add_payment_proof(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_reglements_preuves;
BEGIN
  v:=public.snp_ajouter_preuve_reglement(
    p_id,'mt103','private/4b-proof.pdf','4b-proof.pdf','application/pdf',1024,
    repeat('a',64),'MT103-4B',CURRENT_DATE,'Banque test','Preuve test 4B'
  );
  RETURN 'OK:'||v.statut_verification;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_review_payment_proof(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_reglements_preuves;
BEGIN
  v:=public.snp_verifier_preuve_reglement(p_id,'verifiee',NULL);
  RETURN 'OK:'||v.statut_verification;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_payment_transition(p_id uuid,p_status text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.snp_changer_statut_reglement(p_id,p_status,NULL);
  RETURN 'OK:'||v.r_statut;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_card_renew(p_artisan uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_cartes_professionnelles;
BEGIN
  v:=public.snp_renouveler_carte_professionnelle(
    p_artisan,CURRENT_DATE+730,'Renouvellement contrôlé 4B'
  );
  RETURN 'OK:'||v.statut;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_card_transition(
  p_card uuid,p_expected text,p_new text,p_reason text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_cartes_professionnelles;
BEGIN
  v:=public.snp_transition_carte_professionnelle(p_card,p_expected,p_new,p_reason);
  RETURN 'OK:'||v.statut;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_card_update(p_card uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.snp_cartes_professionnelles SET statut='validee' WHERE id=p_card;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_payment_method_upsert(
  p_artisan uuid,p_method uuid,p_account text,p_principal boolean
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_artisan_moyens_paiement;
BEGIN
  v:=public.snp_upsert_artisan_moyen_paiement(
    p_artisan,'virement_bancaire','Titulaire Test',p_method,'Compte 4B',NULL,
    'Banque 4B',p_account,'SNPBBFXX',p_principal,true,'Coordonnée test 4B'
  );
  RETURN 'OK:'||v.id::text;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_payment_method_review(p_method uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.snp_artisan_moyens_paiement;
BEGIN
  v:=public.snp_verifier_artisan_moyen_paiement(p_method,true,NULL);
  RETURN 'OK:'||lower((v.verifie_le IS NOT NULL)::text);
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_payment_method_update(p_method uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.snp_artisan_moyens_paiement SET verifie_le=now() WHERE id=p_method;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC,anon,authenticated;

SELECT plan(86);

-- Contrat structurel -------------------------------------------------------
SELECT is((SELECT count(*) FROM public.snp_capability_catalog
  WHERE code IN ('artisan.cards.manage','artisan.payment-methods.manage')),
  2::bigint,'les deux capabilities artisan dédiées existent');
SELECT is((SELECT count(*) FROM public.snp_role_capabilities
  WHERE role='admin' AND capability_code IN ('artisan.cards.manage','artisan.payment-methods.manage')),
  2::bigint,'Admin reçoit les deux capabilities par défaut');
SELECT is((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (
    'snp_contrats','snp_requisitions','snp_reglements_achat',
    'snp_cartes_professionnelles','snp_artisan_moyens_paiement',
    'export_licenses','snp_export_license_requests')
    AND c.relrowsecurity AND c.relforcerowsecurity),
  7::bigint,'FORCE RLS couvre les sept agrégats prioritaires');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_reglements_achat','UPDATE'),
  'authenticated ne met pas à jour directement un règlement');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_cartes_professionnelles','UPDATE'),
  'authenticated ne met pas à jour directement une carte');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_artisan_moyens_paiement','UPDATE'),
  'authenticated ne met pas à jour directement un moyen de paiement');
SELECT ok(NOT has_table_privilege('authenticated','public.export_licenses','UPDATE'),
  'authenticated ne met pas à jour directement une licence');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_export_license_requests','INSERT'),
  'authenticated ne contourne pas la RPC de demande');
SELECT ok(has_column_privilege('authenticated','public.snp_contrats','intitule','UPDATE'),
  'un champ métier de contrat reste éditable sous RLS');
SELECT ok(NOT has_column_privilege('authenticated','public.snp_contrats','statut','UPDATE'),
  'le statut contrat est hors du DML direct');
SELECT ok(NOT has_column_privilege('authenticated','public.snp_requisitions','statut','UPDATE'),
  'le statut réquisition est hors du DML direct');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text)','EXECUTE'),
  'la RPC Mine est exposée à authenticated');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text)','EXECUTE'),
  'anon ne peut soumettre une demande');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_sonasp_decider_demande_licence_export(uuid,text,text,date,date,text,numeric,text,text)','EXECUTE'),
  'la décision SONASP reste exposée derrière sa garde');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_sonasp_decider_demande_licence_export(uuid,text,text,date,date,text,numeric,text,text)','EXECUTE'),
  'anon ne décide aucune demande');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_transition_carte_professionnelle(uuid,text,text,text)','EXECUTE'),
  'la transition de carte est une RPC authentifiée');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_upsert_artisan_moyen_paiement(uuid,text,text,uuid,text,text,text,text,text,boolean,boolean,text)','EXECUTE'),
  'l’écriture d’un moyen de paiement passe par RPC');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_transition_carte_professionnelle(uuid,text,text,text)','EXECUTE'),
  'anon ne change aucune carte');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.snp_changer_statut_contrat_legacy_4b(uuid,text,text,text)','EXECUTE'),
  'le moteur historique contrat est privé');
SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE '%legacy_4b'
    AND has_function_privilege('authenticated',p.oid,'EXECUTE')),
  0::bigint,'aucune implémentation legacy 4B n’est exposée');
SELECT ok(position('snp_societe_utilisateur' IN pg_get_functiondef(
  'public.snp_peut_modifier_licence_export(uuid)'::regprocedure))=0,
  'le helper de modification licence ne contient plus de droit Mine');
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_sonasp_decider_demande_licence_export(uuid,text,text,date,date,text,numeric,text,text)'::regprocedure))>0,
  'la décision réglementaire verrouille la demande');
SELECT ok(position('pg_advisory_xact_lock' IN pg_get_functiondef(
  'public.snp_upsert_artisan_moyen_paiement(uuid,text,text,uuid,text,text,text,text,text,boolean,boolean,text)'::regprocedure))>0,
  'les changements de principal sont sérialisés par artisan');
SELECT ok(EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
  AND tablename='snp_export_license_requests'
  AND indexname='idx_snp_export_license_requests_company_status'),
  'les lectures tenant/statut des demandes sont indexées');
SELECT is((SELECT count(*) FROM pg_trigger WHERE tgrelid='public.shipping_preparations'::regclass
  AND NOT tgisinternal AND tgname IN (
    'snp_shipping_00_canonicalize_quota','snp_shipping_90_sync_quota','snp_shipping_05_release_quota')),
  3::bigint,'les trois triggers quota P0 restent intacts');

-- Fixtures -----------------------------------------------------------------
SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000099','service_role','aal2');

INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
 ('4b000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-mine-a@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-mine-b@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-prepare@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-approve@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-finance@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-reconcile@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-admin-a@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-admin-b@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-manager@sonasp.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000099','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4b-service@sonasp.invalid','','{}','{}',now(),now());

INSERT INTO public.mining_companies(id,code,name,country,company_type,is_active) VALUES
 ('4b000000-0000-4000-8000-000000000101','4B-MINE-A','Mine A 4B','Burkina Faso','production_mine',true),
 ('4b000000-0000-4000-8000-000000000102','4B-MINE-B','Mine B 4B','Burkina Faso','production_mine',true);

INSERT INTO public.user_profiles(
  id,email,full_name,role,is_active,mining_company_id,mfa_enrolled_at,must_change_password
) VALUES
 ('4b000000-0000-4000-8000-000000000001','4b-mine-a@sonasp.invalid','Mine A','mine',true,'4b000000-0000-4000-8000-000000000101',now(),false),
 ('4b000000-0000-4000-8000-000000000002','4b-mine-b@sonasp.invalid','Mine B','mine',true,'4b000000-0000-4000-8000-000000000102',now(),false),
 ('4b000000-0000-4000-8000-000000000003','4b-prepare@sonasp.invalid','Préparateur','management',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000004','4b-approve@sonasp.invalid','Approbateur','management',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000005','4b-finance@sonasp.invalid','Finance','management',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000006','4b-reconcile@sonasp.invalid','Rapprochement','management',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000007','4b-admin-a@sonasp.invalid','Admin A','admin',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000008','4b-admin-b@sonasp.invalid','Admin B','admin',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000009','4b-manager@sonasp.invalid','Manager','manager',true,NULL,now(),false),
 ('4b000000-0000-4000-8000-000000000099','4b-service@sonasp.invalid','Service','admin',true,NULL,now(),false);

-- La Mine A reçoit volontairement les capabilities artisan : le test prouve
-- que la capability seule ne contourne pas le périmètre artisan.
INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,reason,granted_by) VALUES
 ('4b000000-0000-4000-8000-000000000001','artisan.cards.manage',true,
  'Habilitation test sans périmètre artisan associé','4b000000-0000-4000-8000-000000000099'),
 ('4b000000-0000-4000-8000-000000000001','artisan.payment-methods.manage',true,
  'Habilitation test sans périmètre artisan associé','4b000000-0000-4000-8000-000000000099');

INSERT INTO public.snp_artisans_miniers(
  id,type_personne,type_artisan,nom,prenoms,telephone,created_by
) VALUES
 ('4b000000-0000-4000-8000-000000000201','physique','exploitant','Artisan','Alpha','70000001','4b000000-0000-4000-8000-000000000099'),
 ('4b000000-0000-4000-8000-000000000202','physique','exploitant','Artisan','Beta','70000002','4b000000-0000-4000-8000-000000000099');

INSERT INTO public.snp_contrats(
  id,numero_contrat,intitule,partenaire_type,mining_company_id,
  date_debut,date_fin,quantite_totale,statut,created_by,updated_by
) VALUES (
  '4b000000-0000-4000-8000-000000000301','CTR-4B-001','Contrat séparation 4B',
  'mine_industrielle','4b000000-0000-4000-8000-000000000101',
  CURRENT_DATE,CURRENT_DATE+365,100,'brouillon',
  '4b000000-0000-4000-8000-000000000003','4b000000-0000-4000-8000-000000000003'
);

INSERT INTO public.snp_requisitions(
  id,reference,objet,mining_company_id,quantite_oz,regime_juridique,
  autorite_origine,nature_acte,reference_acte,statut,created_by,updated_by
) VALUES (
  '4b000000-0000-4000-8000-000000000401','REQ-4B-001','Réquisition séparation 4B',
  '4b000000-0000-4000-8000-000000000101',10,'accord_requis',
  'SONASP','Décision réglementaire','ACTE-4B-001','brouillon',
  '4b000000-0000-4000-8000-000000000003','4b000000-0000-4000-8000-000000000003'
);

INSERT INTO public.snp_reglements_achat(
  id,reference_reglement,mining_company_id,montant_fcfa,statut,
  prepare_par,soumis_par,valide_par,date_validation,created_by
) VALUES (
  '4b000000-0000-4000-8000-000000000501','REG-4B-001',
  '4b000000-0000-4000-8000-000000000101',100000,'valide',
  '4b000000-0000-4000-8000-000000000003','4b000000-0000-4000-8000-000000000003',
  '4b000000-0000-4000-8000-000000000004',now(),'4b000000-0000-4000-8000-000000000003'
);

-- Licences : anon/AAL1/tenant/capability ----------------------------------
SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000001','anon','aal1');
SET LOCAL ROLE anon;
SELECT is(pg_temp.try_license_request(),'ERR:42501','anon ne soumet aucune demande');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal1');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_license_request(),'ERR:42501','une Mine AAL1 est refusée');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_license_request(),'OK:submitted','Mine A soumet sa demande par RPC');
SELECT is((SELECT count(*) FROM public.snp_export_license_requests),1::bigint,
  'Mine A lit exactement sa demande');
SELECT is(pg_temp.try_direct_request_insert('4b000000-0000-4000-8000-000000000101'),
  'ERR:42501','la Mine ne contourne pas la RPC par INSERT');
SELECT is(pg_temp.try_direct_license_insert('4b000000-0000-4000-8000-000000000101'),
  'ERR:42501','la Mine ne crée aucune licence directement');
RESET ROLE;

SELECT is((SELECT mining_company_id FROM public.snp_export_license_requests LIMIT 1),
  '4b000000-0000-4000-8000-000000000101'::uuid,'le tenant de la demande vient du JWT');
SELECT is((SELECT submitted_by FROM public.snp_export_license_requests LIMIT 1),
  '4b000000-0000-4000-8000-000000000001'::uuid,'l’auteur est dérivé côté serveur');
SELECT is((SELECT status FROM public.snp_export_license_requests LIMIT 1),
  'submitted','le statut initial est imposé');

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000002','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.snp_export_license_requests),0::bigint,
  'Mine B ne lit pas la demande de Mine A');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000009','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_license_decision((SELECT id FROM public.snp_export_license_requests LIMIT 1)),
  'ERR:42501','un Manager lecture seule ne décide pas');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000004','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_direct_license_insert('4b000000-0000-4000-8000-000000000101'),
  'ERR:42501','SONASP ne crée pas non plus une licence par DML direct');
SELECT is(pg_temp.try_license_decision((SELECT id FROM public.snp_export_license_requests LIMIT 1)),
  'OK:approved','l’approbateur crée la licence par décision atomique');
SELECT is((SELECT count(*) FROM public.export_licenses WHERE license_number='LIC-4B-0001'),
  1::bigint,'une licence unique est créée');
SELECT is(pg_temp.try_license_decision((SELECT id FROM public.snp_export_license_requests LIMIT 1)),
  'OK:approved','la répétition de la décision est idempotente');
SELECT is((SELECT count(*) FROM public.export_licenses WHERE license_number='LIC-4B-0001'),
  1::bigint,'la répétition ne duplique pas la licence');
SELECT is((SELECT used_quantity_grams FROM public.export_licenses WHERE license_number='LIC-4B-0001'),
  0::numeric,'une décision ne consomme aucun quota');
SELECT is(pg_temp.try_license_modify((SELECT id FROM public.export_licenses WHERE license_number='LIC-4B-0001'),'active'),
  'OK:active','SONASP modifie l’autorisation via RPC optimiste');
SELECT is((SELECT used_quantity_grams FROM public.export_licenses WHERE license_number='LIC-4B-0001'),
  0::numeric,'la RPC réglementaire ne touche pas au consommé');
SELECT is(pg_temp.try_direct_license_usage((SELECT id FROM public.export_licenses WHERE license_number='LIC-4B-0001')),
  'ERR:42501','même SONASP ne modifie pas le consommé en direct');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.export_licenses WHERE license_number='LIC-4B-0001'),
  1::bigint,'Mine A consulte sa licence autorisée');
SELECT is(pg_temp.try_license_modify((SELECT id FROM public.export_licenses WHERE license_number='LIC-4B-0001'),'active'),
  'ERR:42501','Mine A ne modifie pas sa licence via RPC SONASP');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000002','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.export_licenses WHERE license_number='LIC-4B-0001'),
  0::bigint,'Mine B ne lit pas la licence de Mine A');
RESET ROLE;

-- Contrats / réquisitions / règlements ------------------------------------
SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000003','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_direct_contract_status('4b000000-0000-4000-8000-000000000301'),
  'ERR:42501','le préparateur ne change pas le statut contrat par DML');
SELECT is(pg_temp.try_contract_transition('4b000000-0000-4000-8000-000000000301','soumis'),
  'OK:soumis','le préparateur soumet par RPC');
SELECT is(pg_temp.try_contract_transition('4b000000-0000-4000-8000-000000000301','revue_juridique'),
  'ERR:42501','le préparateur ne s’auto-approuve pas');
SELECT is(pg_temp.try_direct_requisition_status('4b000000-0000-4000-8000-000000000401'),
  'ERR:42501','le préparateur ne change pas le statut réquisition par DML');
SELECT is(pg_temp.try_requisition_transition('4b000000-0000-4000-8000-000000000401','verification_juridique'),
  'OK:verification_juridique','le préparateur engage la vérification par RPC');
SELECT is(pg_temp.try_requisition_transition('4b000000-0000-4000-8000-000000000401','validation_metier'),
  'ERR:42501','le préparateur ne valide pas sa réquisition');
SELECT is(pg_temp.try_direct_reglement_status('4b000000-0000-4000-8000-000000000501'),
  'ERR:42501','le règlement est RPC-only');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000004','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_contract_transition('4b000000-0000-4000-8000-000000000301','revue_juridique'),
  'OK:revue_juridique','un acteur distinct poursuit la revue contrat');
SELECT is(pg_temp.try_requisition_transition('4b000000-0000-4000-8000-000000000401','validation_metier'),
  'OK:validation_metier','un acteur distinct poursuit la validation réquisition');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000003','authenticated','aal1');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_affect_fifo('4b000000-0000-4000-8000-000000000501'),
  'ERR:42501','AAL1 ne manipule pas les affectations');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000005','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_add_payment_proof('4b000000-0000-4000-8000-000000000501'),
  'OK:a_verifier','Finance ajoute une preuve avec acteur serveur');
SELECT is(pg_temp.try_review_payment_proof((SELECT id FROM public.snp_reglements_preuves
  WHERE reglement_id='4b000000-0000-4000-8000-000000000501' LIMIT 1)),
  'ERR:42501','l’ajout et la vérification de preuve sont séparés');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000006','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_review_payment_proof((SELECT id FROM public.snp_reglements_preuves
  WHERE reglement_id='4b000000-0000-4000-8000-000000000501' LIMIT 1)),
  'OK:verifiee','un second acteur vérifie la preuve');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000005','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_payment_transition('4b000000-0000-4000-8000-000000000501','en_execution'),
  'OK:en_execution','Finance engage l’exécution après validation');
SELECT is(pg_temp.try_payment_transition('4b000000-0000-4000-8000-000000000501','execute'),
  'OK:execute','une preuve vérifiée permet l’exécution');
RESET ROLE;
SELECT is((SELECT ajoute_par FROM public.snp_reglements_preuves
  WHERE reglement_id='4b000000-0000-4000-8000-000000000501' LIMIT 1),
  '4b000000-0000-4000-8000-000000000005'::uuid,'l’acteur d’ajout de preuve est serveur');
SELECT is((SELECT verifiee_par FROM public.snp_reglements_preuves
  WHERE reglement_id='4b000000-0000-4000-8000-000000000501' LIMIT 1),
  '4b000000-0000-4000-8000-000000000006'::uuid,'l’acteur de vérification est distinct et serveur');

-- Cartes professionnelles --------------------------------------------------
SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000007','authenticated','aal1');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_card_renew('4b000000-0000-4000-8000-000000000201'),
  'ERR:42501','Admin AAL1 ne renouvelle pas une carte');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_card_renew('4b000000-0000-4000-8000-000000000201'),
  'ERR:42501','une capability sans périmètre artisan reste refusée');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000007','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_card_renew('4b000000-0000-4000-8000-000000000201'),
  'OK:en_cours','Admin renouvelle la carte par RPC');
SELECT is(pg_temp.try_direct_card_update((SELECT id FROM public.snp_cartes_professionnelles
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201')),
  'ERR:42501','la carte ne se valide pas par UPDATE direct');
SELECT is(pg_temp.try_card_transition((SELECT id FROM public.snp_cartes_professionnelles
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201'),'en_cours','validee'),
  'ERR:42501','le renouveleur ne valide pas sa carte');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000008','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_card_transition((SELECT id FROM public.snp_cartes_professionnelles
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201'),'en_cours','validee'),
  'OK:validee','un second Admin valide la carte');
SELECT is(pg_temp.try_card_transition((SELECT id FROM public.snp_cartes_professionnelles
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201'),'validee','expiree'),
  'ERR:22023','une transition de carte invalide est refusée');
RESET ROLE;
SELECT is((SELECT validee_par FROM public.snp_cartes_professionnelles
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201'),
  '4b000000-0000-4000-8000-000000000008'::uuid,'le valideur carte est dérivé serveur');

-- Moyens de paiement -------------------------------------------------------
SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_payment_method_upsert(
  '4b000000-0000-4000-8000-000000000201',NULL,'BF420001',true),
  'ERR:42501','capability sans périmètre ne modifie pas une coordonnée');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000007','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_payment_method_upsert(
  '4b000000-0000-4000-8000-000000000201',NULL,'BF420001',true) LIKE 'OK:%',
  'Admin crée une coordonnée par RPC');
SELECT is(pg_temp.try_direct_payment_method_update((SELECT id FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' LIMIT 1)),
  'ERR:42501','la vérification ne se forge pas par UPDATE direct');
SELECT is(pg_temp.try_payment_method_review((SELECT id FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' LIMIT 1)),
  'ERR:42501','le saisissant ne vérifie pas sa coordonnée');
RESET ROLE;

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000008','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_payment_method_review((SELECT id FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' LIMIT 1)),
  'OK:true','un second Admin vérifie la coordonnée');
RESET ROLE;
SELECT is((SELECT verifie_par FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' LIMIT 1),
  '4b000000-0000-4000-8000-000000000008'::uuid,'le vérificateur est dérivé serveur');

SELECT pg_temp.set_test_claims('4b000000-0000-4000-8000-000000000007','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_payment_method_upsert(
  '4b000000-0000-4000-8000-000000000201',
  (SELECT id FROM public.snp_artisan_moyens_paiement WHERE artisan_id='4b000000-0000-4000-8000-000000000201' LIMIT 1),
  'BF420002',true) LIKE 'OK:%','une modification sensible passe par RPC');
SELECT ok(pg_temp.try_payment_method_upsert(
  '4b000000-0000-4000-8000-000000000201',NULL,'BF420003',true) LIKE 'OK:%',
  'un second principal est créé sous verrou');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' AND est_principal AND actif),
  1::bigint,'un seul moyen principal subsiste');
SELECT is((SELECT count(*) FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' AND verifie_le IS NOT NULL),
  0::bigint,'une modification sensible réinitialise la vérification');
SELECT is((SELECT created_by FROM public.snp_artisan_moyens_paiement
  WHERE artisan_id='4b000000-0000-4000-8000-000000000201' ORDER BY created_at LIMIT 1),
  '4b000000-0000-4000-8000-000000000007'::uuid,'le créateur du moyen est dérivé serveur');
SELECT is((SELECT count(*) FROM public.snp_workflow_audit
  WHERE aggregate_type IN ('artisan-card','artisan-payment-method','export-license-request')),
  8::bigint,'les opérations sensibles alimentent le journal immuable');
SELECT ok(NOT EXISTS(
  SELECT 1 FROM public.snp_workflow_audit
  WHERE aggregate_type='artisan-payment-method'
    AND context::text LIKE '%BF42000%'
),'l’audit ne contient jamais le numéro de compte complet');

SELECT * FROM finish();
ROLLBACK;
