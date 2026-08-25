BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(
  p_sub uuid,p_role text,p_aal text,p_session_id text
)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_sub::text,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(p_role,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,'session_id',p_session_id,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
  PERFORM set_config('request.headers',jsonb_build_object(
    'x-forwarded-for','198.51.100.24','user-agent','pgTAP LOT 4F'
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_create_operation(p_shipping uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.freight_customs_operations;
BEGIN
  v:=public.snp_fret_creer_operation(p_shipping);
  RETURN 'OK:'||v.status::text;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_modify_operation(
  p_operation uuid,p_expected timestamptz,p_patch jsonb
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.freight_customs_operations;
BEGIN
  v:=public.snp_fret_modifier_operation(p_operation,p_expected,p_patch);
  RETURN 'OK:'||coalesce(v.notes,'');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_transition(
  p_operation uuid,p_old text,p_new text,p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.freight_customs_operations;
BEGIN
  v:=public.snp_fret_transitionner_operation(p_operation,p_old,p_new,p_details);
  RETURN 'OK:'||v.status::text;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_add_document(p_operation uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.freight_customs_documents;
BEGIN
  v:=public.snp_fret_ajouter_document(
    p_operation,'customs_declaration','Declaration douaniere','Document test',
    'freight-customs/'||p_operation::text||'/declaration.pdf',
    'declaration.pdf',4096,'application/pdf'
  );
  RETURN 'OK:'||v.id;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_delete_document(p_document uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_path text;
BEGIN
  v_path:=public.snp_fret_supprimer_document(p_document);
  RETURN 'OK:'||coalesce(v_path,'');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_save_invoice(p_operation uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v public.freight_customs_invoice_data;
BEGIN
  v:=public.snp_fret_enregistrer_facture(p_operation,jsonb_build_object(
    'recipient_name','Raffinerie test','recipient_country','CH',
    'exchange_rate_fcfa_usd',600,'number_of_boxes',2,
    'total_value_cfa',1000000,'total_value_usd',1666.67
  ));
  RETURN 'OK:'||v.id;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_get_history(p_entity text,p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.get_unified_status_history(p_entity,p_id);
  RETURN 'OK:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_operation_insert(
  p_shipping uuid,p_tenant uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.freight_customs_operations(
    shipping_preparation_id,mining_company_id,reference_number,created_by
  ) VALUES(p_shipping,p_tenant,'FORGED-4F',auth.uid());
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_operation_update(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.freight_customs_operations SET notes='forge' WHERE id=p_id;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_document_insert(p_operation uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.freight_customs_documents(
    freight_customs_operation_id,document_type,title,uploaded_by
  ) VALUES(p_operation,'other','Document forge',auth.uid());
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_invoice_update(p_operation uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.freight_customs_invoice_data
  SET sender_name='Tenant forge' WHERE freight_customs_operation_id=p_operation;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_history_insert(
  p_operation uuid,p_tenant uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.unified_status_history(
    entity_type,entity_id,mining_company_id,new_status,change_context,changed_by
  ) VALUES('freight_customs',p_operation,p_tenant,'forged','system',auth.uid());
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_history_update_as_owner(p_history uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.unified_status_history SET notes='forge' WHERE id=p_history;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.fixture_operation_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT id FROM public.freight_customs_operations
  WHERE shipping_preparation_id='4f000000-0000-4000-8000-000000000201'
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.fixture_document_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT d.id FROM public.freight_customs_documents d
  WHERE d.freight_customs_operation_id=pg_temp.fixture_operation_id()
  LIMIT 1;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

SELECT plan(80);

-- Contrat structurel -------------------------------------------------------
SELECT is((SELECT count(*) FROM pg_class WHERE oid IN(
  'public.freight_customs_operations'::regclass,
  'public.freight_customs_documents'::regclass,
  'public.freight_customs_invoice_data'::regclass,
  'public.unified_status_history'::regclass
) AND relrowsecurity AND relforcerowsecurity),4::bigint,
  'RLS et FORCE RLS couvrent les quatre tables');

SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename IN('freight_customs_operations','freight_customs_documents',
    'freight_customs_invoice_data','unified_status_history')),
  8::bigint,'deux policies canoniques par table');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename IN('freight_customs_operations','freight_customs_documents',
    'freight_customs_invoice_data','unified_status_history')
  AND roles && ARRAY['authenticated'::name]
  AND cmd IN('ALL','INSERT','UPDATE','DELETE')),0::bigint,
  'aucune policy DML authenticated');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename IN('freight_customs_operations','freight_customs_documents',
    'freight_customs_invoice_data','unified_status_history')
  AND replace(coalesce(with_check,''),' ','')='true'),0::bigint,
  'aucun WITH CHECK true ne subsiste');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name IN(
    'freight_customs_operations','freight_customs_documents',
    'freight_customs_invoice_data','unified_status_history')
  AND grantee IN('anon','authenticated')
  AND privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')),
  0::bigint,'aucun grant DML client');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name IN(
    'freight_customs_operations','freight_customs_documents',
    'freight_customs_invoice_data','unified_status_history')
  AND grantee='authenticated' AND privilege_type='SELECT'),4::bigint,
  'authenticated ne recoit que les quatre lectures RLS');

SELECT ok(EXISTS(SELECT 1 FROM pg_attribute
  WHERE attrelid='public.freight_customs_operations'::regclass
    AND attname='mining_company_id' AND attnotnull),
  'le tenant operation est obligatoire');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.freight_customs_operations'::regclass
    AND conname='freight_customs_operations_mining_company_fkey' AND convalidated),
  'le tenant operation reference une mine valide');
SELECT ok(EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
  AND indexname='uq_freight_customs_operation_shipping'),
  'une expedition porte au plus une operation fret');
SELECT ok(EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
  AND indexname='idx_freight_customs_operation_tenant_status'),
  'le parcours tenant/statut est indexe');
SELECT ok(EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
  AND indexname='idx_unified_history_tenant_entity_changed'),
  'la lecture historique tenant/objet est indexee');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.unified_status_history'::regclass
    AND conname='unified_status_history_entity_type_check' AND convalidated),
  'les types historiques sont controles');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.unified_status_history'::regclass
    AND tgname='snp_unified_status_history_immutable' AND NOT tgisinternal),
  'le trigger immuable historique existe');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.freight_customs_operations'::regclass
    AND tgname='snp_fret_status_history' AND NOT tgisinternal),
  'les transitions fret alimentent automatiquement l historique');

SELECT is((SELECT count(*) FROM public.snp_capability_catalog WHERE code IN(
  'freight.read','freight.prepare','freight.customs.approve',
  'freight.transport.dispatch','freight.invoice.manage','workflow.history.read'
)),6::bigint,'les six capabilities dediees existent');
SELECT is((SELECT count(*) FROM public.snp_capability_catalog WHERE code IN(
  'freight.read','freight.prepare','freight.customs.approve',
  'freight.transport.dispatch','freight.invoice.manage','workflow.history.read'
) AND sensitive),6::bigint,'toutes les capabilities 4F imposent AAL2');
SELECT ok(EXISTS(SELECT 1 FROM public.snp_role_capabilities
  WHERE role='airport' AND capability_code='freight.transport.dispatch'),
  'Airport conserve le parcours expedition');
SELECT ok(EXISTS(SELECT 1 FROM public.snp_role_capabilities
  WHERE role='factory' AND capability_code='freight.invoice.manage'),
  'Factory conserve la preparation de facture');
SELECT ok(EXISTS(SELECT 1 FROM public.snp_role_capabilities
  WHERE role='refinery' AND capability_code='freight.read'),
  'Refinery conserve la consultation');
SELECT ok(EXISTS(SELECT 1 FROM public.snp_role_capabilities
  WHERE role='management' AND capability_code='freight.customs.approve'),
  'SONASP management conserve l approbation explicite');

SELECT ok(has_function_privilege('authenticated',
  'public.snp_fret_creer_operation(uuid)','EXECUTE'),
  'la creation RPC est allowlistee authenticated');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_fret_transitionner_operation(uuid,text,text,jsonb)','EXECUTE'),
  'la transition RPC est allowlistee authenticated');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_fret_enregistrer_facture(uuid,jsonb)','EXECUTE'),
  'la facture RPC est allowlistee authenticated');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_fret_creer_operation(uuid)','EXECUTE'),
  'anon ne peut creer de dossier fret');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.generate_freight_reference()','EXECUTE'),
  'le generateur de reference est prive');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.snp_fret_exiger_portee(uuid,text)','EXECUTE'),
  'la garde de portee est privee');
SELECT ok(position('search_path' IN pg_get_functiondef(
  'public.snp_fret_transitionner_operation(uuid,text,text,jsonb)'::regprocedure))>0,
  'la transition a un search_path fixe');
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_fret_transitionner_operation(uuid,text,text,jsonb)'::regprocedure))>0,
  'la transition verrouille la ligne');
SELECT ok(position('snp_fret_exiger_portee' IN pg_get_functiondef(
  'public.snp_fret_transitionner_operation(uuid,text,text,jsonb)'::regprocedure))>0,
  'la transition applique capability et tenant');

-- Fixtures ----------------------------------------------------------------
SELECT pg_temp.set_claims(
  '4f000000-0000-4000-8000-000000000099','service_role','aal2','4f-service'
);
INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
 ('4f000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-mine-a@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-mine-b@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-airport-a@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-airport-b@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-factory@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-refinery@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-management@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-manager@invalid.test','','{}','{}',now(),now()),
 ('4f000000-0000-4000-8000-000000000099','00000000-0000-0000-0000-000000000000','authenticated','authenticated','4f-service@invalid.test','','{}','{}',now(),now());

INSERT INTO public.mining_companies(
  id,code,name,country,company_type,is_active,address,city,tax_id
) VALUES
 ('4f000000-0000-4000-8000-000000000101','4F-MINE-A','Mine Alpha 4F','Burkina Faso','production_mine',true,'Adresse A','Ouagadougou','NIF-A'),
 ('4f000000-0000-4000-8000-000000000102','4F-MINE-B','Mine Beta 4F','Burkina Faso','production_mine',true,'Adresse B','Bobo-Dioulasso','NIF-B');

INSERT INTO public.user_profiles(
  id,email,full_name,role,is_active,mining_company_id,mfa_enrolled_at,must_change_password
) VALUES
 ('4f000000-0000-4000-8000-000000000001','4f-mine-a@invalid.test','Mine A','mine',true,'4f000000-0000-4000-8000-000000000101',now(),false),
 ('4f000000-0000-4000-8000-000000000002','4f-mine-b@invalid.test','Mine B','mine',true,'4f000000-0000-4000-8000-000000000102',now(),false),
 ('4f000000-0000-4000-8000-000000000003','4f-airport-a@invalid.test','Airport A','airport',true,NULL,now(),false),
 ('4f000000-0000-4000-8000-000000000004','4f-airport-b@invalid.test','Airport B','airport',true,NULL,now(),false),
 ('4f000000-0000-4000-8000-000000000005','4f-factory@invalid.test','Factory','factory',true,NULL,now(),false),
 ('4f000000-0000-4000-8000-000000000006','4f-refinery@invalid.test','Refinery','refinery',true,NULL,now(),false),
 ('4f000000-0000-4000-8000-000000000007','4f-management@invalid.test','SONASP','management',true,NULL,now(),false),
 ('4f000000-0000-4000-8000-000000000008','4f-manager@invalid.test','Manager lecture','manager',true,NULL,now(),false),
 ('4f000000-0000-4000-8000-000000000099','4f-service@invalid.test','Service','admin',true,NULL,now(),false);

-- Une habilitation fret explicite accordee a Mine B ne doit jamais la rendre
-- transversale sur le tenant A.
INSERT INTO public.snp_user_capabilities(
  user_id,capability_code,allowed,reason,granted_by
) VALUES(
  '4f000000-0000-4000-8000-000000000002','freight.prepare',true,
  'Test de non contournement tenant LOT 4F','4f000000-0000-4000-8000-000000000099'
);

INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active)
SELECT id,extensions.digest('4f-session-'||right(id::text,3),'sha256'),
       now()+interval '1 hour',true
FROM public.user_profiles WHERE id::text LIKE '4f000000-%'
  AND id<>'4f000000-0000-4000-8000-000000000099';

INSERT INTO public.shipping_preparations(
  id,mining_company_id,status,created_by,expedition_lot_number
) VALUES
 ('4f000000-0000-4000-8000-000000000201','4f000000-0000-4000-8000-000000000101','ready_for_expedition','4f000000-0000-4000-8000-000000000001','LOT-4F-A'),
 ('4f000000-0000-4000-8000-000000000202','4f000000-0000-4000-8000-000000000102','ready_for_expedition','4f000000-0000-4000-8000-000000000002','LOT-4F-B');

-- Anon, AAL1, capability et tenant ---------------------------------------
SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000003','anon','aal1','4f-session-003');
SET LOCAL ROLE anon;
SELECT is(pg_temp.try_create_operation('4f000000-0000-4000-8000-000000000201'),
  'ERR:42501','anon ne cree aucune operation');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000003','authenticated','aal1','4f-session-003');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_operation('4f000000-0000-4000-8000-000000000201'),
  'ERR:42501','Airport AAL1 est refuse');
SELECT is((SELECT count(*) FROM public.freight_customs_operations),0::bigint,
  'AAL1 ne lit aucun dossier sensible');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000008','authenticated','aal2','4f-session-008');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_operation('4f000000-0000-4000-8000-000000000201'),
  'ERR:42501','manager lecture seule ne cree rien');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000002','authenticated','aal2','4f-session-002');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_operation('4f000000-0000-4000-8000-000000000201'),
  'ERR:42501','Mine B habilitee reste bornee hors tenant A');
SELECT is(pg_temp.try_direct_operation_insert(
  '4f000000-0000-4000-8000-000000000201','4f000000-0000-4000-8000-000000000102'),
  'ERR:42501','Mine B ne forge pas le tenant par INSERT direct');
RESET ROLE;

-- Creation, facture/documents et audit derives ----------------------------
SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000003','authenticated','aal2','4f-session-003');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_operation('4f000000-0000-4000-8000-000000000201'),
  'OK:customs_pending','Airport cree le dossier Mine A par RPC');
SELECT is(pg_temp.try_create_operation('4f000000-0000-4000-8000-000000000201'),
  'ERR:23505','la creation concurrente/idempotence est protegee par unicite');
SELECT is(pg_temp.try_direct_operation_update((SELECT id FROM public.freight_customs_operations LIMIT 1)),
  'ERR:42501','meme Airport ne modifie pas directement la table');
SELECT is(pg_temp.try_modify_operation(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    (SELECT updated_at-interval '1 second' FROM public.freight_customs_operations LIMIT 1),
    '{"notes":"conflit"}'::jsonb),
  'ERR:40001','la modification detecte une version stale');
SELECT ok(pg_temp.try_modify_operation(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    (SELECT updated_at FROM public.freight_customs_operations LIMIT 1),
    '{"notes":"Dossier prepare cote serveur"}'::jsonb)
  LIKE 'OK:Dossier prepare%','la modification optimiste reussit par RPC');
SELECT ok(pg_temp.try_add_document((SELECT id FROM public.freight_customs_operations LIMIT 1))
  LIKE 'OK:%','Airport ajoute les metadonnees document par RPC');
SELECT is(pg_temp.try_direct_document_insert((SELECT id FROM public.freight_customs_operations LIMIT 1)),
  'ERR:42501','aucun INSERT document direct');
RESET ROLE;

SELECT is((SELECT mining_company_id FROM public.freight_customs_operations LIMIT 1),
  '4f000000-0000-4000-8000-000000000101'::uuid,
  'le tenant operation vient de l expedition');
SELECT is((SELECT created_by FROM public.freight_customs_operations LIMIT 1),
  '4f000000-0000-4000-8000-000000000003'::uuid,
  'le createur operation vient du JWT');
SELECT is((SELECT uploaded_by FROM public.freight_customs_documents LIMIT 1),
  '4f000000-0000-4000-8000-000000000003'::uuid,
  'uploader document vient du JWT');
SELECT ok((SELECT d.file_path=
  'freight-customs/'||d.freight_customs_operation_id::text||'/declaration.pdf'
  FROM public.freight_customs_documents d LIMIT 1),
  'le chemin document est lie a l operation parente');

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000005','authenticated','aal2','4f-session-005');
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.try_save_invoice((SELECT id FROM public.freight_customs_operations LIMIT 1))
  LIKE 'OK:%','Factory enregistre la facture par RPC');
SELECT is(pg_temp.try_direct_invoice_update((SELECT id FROM public.freight_customs_operations LIMIT 1)),
  'ERR:42501','Factory ne forge pas la facture par UPDATE direct');
RESET ROLE;
SELECT is((SELECT sender_name FROM public.freight_customs_invoice_data LIMIT 1),
  'Mine Alpha 4F','l expediteur facture est derive du tenant');
SELECT is((SELECT sender_nif FROM public.freight_customs_invoice_data LIMIT 1),
  'NIF-A','le NIF facture est derive du referentiel');
SELECT is((SELECT created_by FROM public.freight_customs_invoice_data LIMIT 1),
  '4f000000-0000-4000-8000-000000000005'::uuid,
  'l acteur facture est derive du JWT');

-- SoD et transitions -------------------------------------------------------
SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000003','authenticated','aal2','4f-session-003');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    'customs_pending','customs_approved','{"customs_reference_number":"REF-4F"}'),
  'ERR:42501','le preparateur ne s auto-approuve pas');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000004','authenticated','aal2','4f-session-004');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    'customs_pending','customs_approved','{"customs_reference_number":"REF-4F"}'),
  'OK:customs_approved','un second Airport approuve');
SELECT is(pg_temp.try_transition(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    'customs_approved','shipped_to_refinery','{}'),
  'ERR:23514','un saut de transition est refuse');
RESET ROLE;
SELECT is((SELECT customs_approved_by FROM public.freight_customs_operations LIMIT 1),
  '4f000000-0000-4000-8000-000000000004'::uuid,
  'l approbateur est derive du JWT');
SELECT ok((SELECT customs_approval_date IS NOT NULL
  FROM public.freight_customs_operations LIMIT 1),
  'la date approbation est serveur');

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000003','authenticated','aal2','4f-session-003');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    'customs_approved','ready_for_transport','{}'),
  'OK:ready_for_transport','le preparateur distinct prepare le transport');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000004','authenticated','aal2','4f-session-004');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    'ready_for_transport','shipped_to_refinery','{}'),
  'ERR:42501','l approbateur ne constate pas sa propre expedition');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000003','authenticated','aal2','4f-session-003');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_transition(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    'ready_for_transport','shipped_to_refinery','{"tracking_number":"TRACK-4F"}'),
  'OK:shipped_to_refinery','l acteur transport distinct expedie');
RESET ROLE;
SELECT is((SELECT dispatched_by FROM public.freight_customs_operations LIMIT 1),
  '4f000000-0000-4000-8000-000000000003'::uuid,
  'l expediteur est derive du JWT');
SELECT ok((SELECT actual_departure_date IS NOT NULL
  FROM public.freight_customs_operations LIMIT 1),
  'le depart reel est horodate serveur');
SELECT is((SELECT count(*) FROM public.unified_status_history
  WHERE entity_type='freight_customs'),4::bigint,
  'creation et trois transitions ont quatre traces');
SELECT ok((SELECT bool_and(mining_company_id='4f000000-0000-4000-8000-000000000101')
  FROM public.unified_status_history WHERE entity_type='freight_customs'),
  'le tenant historique est derive du parent');
SELECT ok((SELECT bool_and((metadata->>'recorded_server_side')::boolean)
  FROM public.unified_status_history WHERE entity_type='freight_customs'),
  'chaque trace est normalisee serveur');

-- Cloisonnement lecture et historique non forgeable -----------------------
SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000001','authenticated','aal2','4f-session-001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.freight_customs_operations),1::bigint,
  'Mine A lit son operation');
SELECT is((SELECT count(*) FROM public.freight_customs_documents),1::bigint,
  'Mine A lit son document');
SELECT is((SELECT count(*) FROM public.freight_customs_invoice_data),1::bigint,
  'Mine A lit sa facture');
SELECT is((SELECT count(*) FROM public.unified_status_history
  WHERE entity_type='freight_customs'),4::bigint,
  'Mine A lit son historique');
SELECT is(pg_temp.try_get_history('freight_customs',
    (SELECT id FROM public.freight_customs_operations LIMIT 1)),
  'OK:4','Mine A utilise aussi le RPC historique');
SELECT is(pg_temp.try_direct_history_insert(
    (SELECT id FROM public.freight_customs_operations LIMIT 1),
    '4f000000-0000-4000-8000-000000000101'),
  'ERR:42501','Mine A ne forge aucune trace');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000002','authenticated','aal2','4f-session-002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.freight_customs_operations),0::bigint,
  'Mine B ne lit aucune operation Mine A');
SELECT is((SELECT count(*) FROM public.freight_customs_documents),0::bigint,
  'Mine B ne lit aucun document Mine A');
SELECT is((SELECT count(*) FROM public.freight_customs_invoice_data),0::bigint,
  'Mine B ne lit aucune facture Mine A');
SELECT is((SELECT count(*) FROM public.unified_status_history
  WHERE entity_type='freight_customs'),0::bigint,
  'Mine B ne lit aucune trace Mine A');
SELECT is(pg_temp.try_get_history('freight_customs',
    pg_temp.fixture_operation_id()),
  'ERR:42501','le RPC historique refuse explicitement Mine B');
SELECT is(pg_temp.try_delete_document(
    pg_temp.fixture_document_id()),
  'ERR:42501','Mine B habilitee ne supprime aucun document Mine A');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000006','authenticated','aal2','4f-session-006');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.freight_customs_operations),1::bigint,
  'Refinery consulte le dossier via freight.read');
SELECT is((SELECT count(*) FROM public.freight_customs_documents),1::bigint,
  'Refinery consulte les documents via freight.read');
RESET ROLE;

SELECT pg_temp.set_claims('4f000000-0000-4000-8000-000000000007','authenticated','aal2','4f-session-007');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_get_history('freight_customs',
    (SELECT id FROM public.freight_customs_operations LIMIT 1)),
  'OK:4','SONASP consulte l historique par capability explicite');
RESET ROLE;

-- Meme le proprietaire de table ne peut reecrire une trace existante.
SELECT is(pg_temp.try_history_update_as_owner(
    (SELECT id FROM public.unified_status_history WHERE entity_type='freight_customs' LIMIT 1)),
  'ERR:55000','le trigger bloque la mutation historique y compris owner');

SELECT * FROM finish();
ROLLBACK;
