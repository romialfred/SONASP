BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(
  p_sub uuid, p_role text, p_aal text, p_session_id text
)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub::text,''), true);
  PERFORM set_config('request.jwt.claim.role', coalesce(p_role,''), true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,'session_id',p_session_id,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
  PERFORM set_config('request.headers', jsonb_build_object(
    'x-forwarded-for','198.51.100.47','user-agent','pgTAP LOT 4G'
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_storage(p_bucket text,p_name text)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata)
  VALUES(gen_random_uuid(),p_bucket,p_name,auth.uid()::text,
         '{"size":64,"mimetype":"application/pdf"}'::jsonb);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_storage(p_bucket text,p_name text)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  UPDATE storage.objects SET user_metadata='{"forged":true}'::jsonb
  WHERE bucket_id=p_bucket AND name=p_name;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_delete_storage(p_bucket text,p_name text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  DELETE FROM storage.objects WHERE bucket_id=p_bucket AND name=p_name;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN 'ROWS:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

SELECT plan(49);

-- Catalogue de securite ---------------------------------------------------
SELECT is((SELECT count(*) FROM storage.buckets
  WHERE id IN('production-documents','freight-customs-documents',
    'shipping-documents','ASSAY-CERTIFICATES','mining-company-documents')
    AND public=false),5::bigint,'les cinq buckets gateway sont prives');
SELECT is((SELECT count(*) FROM storage.buckets
  WHERE (id='production-documents' AND file_size_limit=10485760)
     OR (id='freight-customs-documents' AND file_size_limit=20971520)
     OR (id='shipping-documents' AND file_size_limit=10485760)
     OR (id='ASSAY-CERTIFICATES' AND file_size_limit=10485760)
     OR (id='mining-company-documents' AND file_size_limit=15728640)),
  5::bigint,'les limites Storage correspondent au gateway');
SELECT is((SELECT allowed_mime_types FROM storage.buckets
  WHERE id='production-documents'),ARRAY['application/pdf']::text[],
  'Production reste PDF-only');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname LIKE 'snp_4g_%_read' AND cmd='SELECT'
    AND roles && ARRAY['authenticated']::name[]),5::bigint,
  'cinq policies de lecture canoniques sont exposees');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname LIKE 'snp_4g_%'
    AND cmd IN('ALL','INSERT','UPDATE','DELETE')),0::bigint,
  'LOT 4G ne cree aucune policy DML Storage');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND roles && ARRAY['public','anon','authenticated']::name[]
    AND cmd IN('ALL','INSERT','UPDATE','DELETE')
    AND coalesce(qual,'')||' '||coalesce(with_check,'') ILIKE ANY(ARRAY[
      '%production-documents%','%freight-customs-documents%',
      '%shipping-documents%','%ASSAY-CERTIFICATES%',
      '%mining-company-documents%'])),0::bigint,
  'aucune ancienne policy DML ne nomme encore un bucket cible');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND roles && ARRAY['public','anon','authenticated']::name[]
    AND permissive='PERMISSIVE'
    AND coalesce(qual,'')||' '||coalesce(with_check,'') NOT ILIKE '%bucket_id%'),
  0::bigint,'aucune policy client permissive globale ne contourne les buckets');
SELECT ok((SELECT relrowsecurity FROM pg_class
  WHERE oid='storage.objects'::regclass),'RLS Storage reste active');
SELECT ok(has_function_privilege('authenticated',
  'public.snp_storage_can_read_object(text,text)','EXECUTE'),
  'authenticated peut evaluer le predicat utilise par RLS');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_storage_can_read_object(text,text)','EXECUTE'),
  'anon ne peut pas executer le predicat Storage');
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='public.snp_storage_can_read_object(text,text)'::regprocedure),
  'le predicat metadata parent est SECURITY DEFINER');
SELECT is((SELECT proconfig FROM pg_proc
  WHERE oid='public.snp_storage_can_read_object(text,text)'::regprocedure),
  ARRAY['search_path=pg_catalog, public, storage, pg_temp']::text[],
  'le predicat Storage a un search_path fixe');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.snp_storage_reference_matches(text,text,text)','EXECUTE'),
  'le normaliseur de reference reste prive');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'production_documents','le predicat joint la metadata Production');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'freight_customs_documents','le predicat joint la metadata Fret');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'shipping_documents','le predicat joint la metadata Shipping');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'assay_certificates','le predicat joint la metadata certificat');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'mining_company_documents','le predicat joint la metadata societe');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'snp_session_est_active','une session applicative active est obligatoire');
SELECT ok(position('UPDATE public.unified_status_history' IN pg_get_functiondef(
  'public.snp_transition_daily_production(uuid,text,text,uuid,text)'::regprocedure))=0,
  'la transition 5E ne reecrit plus l historique 4F');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_transition_daily_production(uuid,text,text,uuid,text)'::regprocedure),
  'snp\.production_transition_request_id','la RPC publie le contexte audit transactionnel');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_unified_history_before_insert()'::regprocedure),
  'production_transition_request_id','le trigger enrichit audit a INSERT');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.unified_status_history'::regclass
    AND tgname='snp_unified_status_history_immutable' AND NOT tgisinternal),
  'le trigger d immutabilite 4F est conserve');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname LIKE 'snp_4g_%_read'
    AND qual ILIKE '%snp_storage_can_read_object%'),5::bigint,
  'chaque lecture Storage appelle le predicat metadata parent');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND roles && ARRAY['anon']::name[]
    AND coalesce(qual,'') ILIKE ANY(ARRAY[
      '%production-documents%','%freight-customs-documents%',
      '%shipping-documents%','%ASSAY-CERTIFICATES%',
      '%mining-company-documents%'])),0::bigint,
  'aucune policy de bucket cible n est accordee a anon');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'snp_peut_consulter_production','Production reutilise sa garde parent');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'snp_fret_peut_consulter_tenant','Fret reutilise sa garde tenant 4F');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'snp_sec_can_read_shipping','Shipping et Assay reutilisent la garde parent');
SELECT matches((SELECT prosrc FROM pg_proc WHERE oid=
  'public.snp_storage_can_read_object(text,text)'::regprocedure),
  'snp_sec_can_read_company','documents Mine reutilisent la garde tenant');
SELECT ok(NOT has_function_privilege('anon',
  'public.snp_transition_daily_production(uuid,text,text,uuid,text)','EXECUTE'),
  'la compensation 5E ne reouvre pas la RPC a anon');
SELECT is((SELECT count(*) FROM pg_indexes WHERE schemaname='public'
  AND indexname IN('idx_4g_production_documents_file_path',
    'idx_4g_freight_documents_file_path','idx_4g_shipping_documents_url',
    'idx_4g_assay_certificates_file_path','idx_4g_mining_documents_file_path')),
  5::bigint,'les cinq recherches metadata Storage sont indexees');

-- Fixtures parents, metadata et objets -----------------------------------
SELECT pg_temp.set_claims(
  '47000000-0000-4000-8000-000000000099','service_role','aal2','47-session-099'
);
INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
 ('47000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','47-mine-a@invalid.test','','{}','{}',now(),now()),
 ('47000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','47-mine-b@invalid.test','','{}','{}',now(),now()),
 ('47000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','47-management@invalid.test','','{}','{}',now(),now()),
 ('47000000-0000-4000-8000-000000000099','00000000-0000-0000-0000-000000000000','authenticated','authenticated','47-service@invalid.test','','{}','{}',now(),now());

INSERT INTO public.mining_companies(id,code,name,country,company_type,is_active)
VALUES
 ('47000000-0000-4000-8000-000000000101','47-MINE-A','Mine A 4G','Burkina Faso','production_mine',true),
 ('47000000-0000-4000-8000-000000000102','47-MINE-B','Mine B 4G','Burkina Faso','production_mine',true);

INSERT INTO public.user_profiles(
  id,email,full_name,role,is_active,mining_company_id,mfa_enrolled_at,must_change_password
) VALUES
 ('47000000-0000-4000-8000-000000000001','47-mine-a@invalid.test','Mine A','mine',true,'47000000-0000-4000-8000-000000000101',now(),false),
 ('47000000-0000-4000-8000-000000000002','47-mine-b@invalid.test','Mine B','mine',true,'47000000-0000-4000-8000-000000000102',now(),false),
 ('47000000-0000-4000-8000-000000000003','47-management@invalid.test','SONASP','management',true,NULL,now(),false),
 ('47000000-0000-4000-8000-000000000099','47-service@invalid.test','Service','admin',true,NULL,now(),false);

INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active)
SELECT id,extensions.digest('47-session-'||right(id::text,3),'sha256'),
       now()+interval '1 hour',true
FROM public.user_profiles
WHERE id IN('47000000-0000-4000-8000-000000000001',
            '47000000-0000-4000-8000-000000000002',
            '47000000-0000-4000-8000-000000000003');

INSERT INTO public.daily_production(
  id,production_date,bullion_grams,estimated_fineness_pct,
  estimated_gold_pct,mining_company_id,bar_reference,status,created_by
) VALUES(
  '47000000-0000-4000-8000-000000000201',current_date,100,90,90,
  '47000000-0000-4000-8000-000000000101','47-BAR-A','prepared',
  '47000000-0000-4000-8000-000000000001'
);

INSERT INTO public.shipping_preparations(
  id,mining_company_id,status,created_by,expedition_lot_number
) VALUES(
  '47000000-0000-4000-8000-000000000301',
  '47000000-0000-4000-8000-000000000101','ready_for_expedition',
  '47000000-0000-4000-8000-000000000001','LOT-47-A'
);

INSERT INTO public.freight_customs_operations(
  id,shipping_preparation_id,mining_company_id,reference_number,status,created_by
) VALUES(
  '47000000-0000-4000-8000-000000000401',
  '47000000-0000-4000-8000-000000000301',
  '47000000-0000-4000-8000-000000000101','FRET-47-A','customs_pending',
  '47000000-0000-4000-8000-000000000099'
);

INSERT INTO public.production_documents(
  id,production_id,document_name,file_name,file_path,file_size,file_type,uploaded_by
) VALUES(
  '47000000-0000-4000-8000-000000000501',
  '47000000-0000-4000-8000-000000000201','Rapport production','production.pdf',
  '47000000-0000-4000-8000-000000000201/format-validated/2026/08/production.pdf',
  100,'application/pdf','47000000-0000-4000-8000-000000000099'
);
INSERT INTO public.freight_customs_documents(
  id,freight_customs_operation_id,document_type,title,file_path,file_name,file_size,mime_type,uploaded_by
) VALUES(
  '47000000-0000-4000-8000-000000000502',
  '47000000-0000-4000-8000-000000000401','customs_declaration','Declaration',
  'freight-customs/47000000-0000-4000-8000-000000000401/declaration.pdf',
  'declaration.pdf',100,'application/pdf','47000000-0000-4000-8000-000000000099'
);
INSERT INTO public.shipping_documents(
  id,shipping_preparation_id,title,document_url,file_name,file_size,mime_type,uploaded_by
) VALUES(
  '47000000-0000-4000-8000-000000000503',
  '47000000-0000-4000-8000-000000000301','Document Shipping',
  '47000000-0000-4000-8000-000000000301/format-validated/2026/08/shipping.pdf',
  'shipping.pdf',100,'application/pdf','47000000-0000-4000-8000-000000000099'
);
INSERT INTO public.assay_certificates(
  id,shipping_preparation_id,file_path,file_name,file_size,mime_type,uploaded_by
) VALUES(
  '47000000-0000-4000-8000-000000000504',
  '47000000-0000-4000-8000-000000000301',
  '47000000-0000-4000-8000-000000000301/format-validated/2026/08/assay.pdf',
  'assay.pdf',100,'application/pdf','47000000-0000-4000-8000-000000000099'
);
INSERT INTO public.mining_company_documents(
  id,mining_company_id,doc_type,file_name,file_path,file_size,mime_type,uploaded_by
) VALUES(
  '47000000-0000-4000-8000-000000000505',
  '47000000-0000-4000-8000-000000000101','autorisation','company.pdf',
  '47000000-0000-4000-8000-000000000101/format-validated/2026/08/company.pdf',
  100,'application/pdf','47000000-0000-4000-8000-000000000099'
);

INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata) VALUES
 (gen_random_uuid(),'production-documents','47000000-0000-4000-8000-000000000201/format-validated/2026/08/production.pdf','47000000-0000-4000-8000-000000000099','{"size":100,"mimetype":"application/pdf"}'),
 (gen_random_uuid(),'freight-customs-documents','freight-customs/47000000-0000-4000-8000-000000000401/declaration.pdf','47000000-0000-4000-8000-000000000099','{"size":100,"mimetype":"application/pdf"}'),
 (gen_random_uuid(),'shipping-documents','47000000-0000-4000-8000-000000000301/format-validated/2026/08/shipping.pdf','47000000-0000-4000-8000-000000000099','{"size":100,"mimetype":"application/pdf"}'),
 (gen_random_uuid(),'ASSAY-CERTIFICATES','47000000-0000-4000-8000-000000000301/format-validated/2026/08/assay.pdf','47000000-0000-4000-8000-000000000099','{"size":100,"mimetype":"application/pdf"}'),
 (gen_random_uuid(),'mining-company-documents','47000000-0000-4000-8000-000000000101/format-validated/2026/08/company.pdf','47000000-0000-4000-8000-000000000099','{"size":100,"mimetype":"application/pdf"}'),
 (gen_random_uuid(),'production-documents','47000000-0000-4000-8000-000000000201/format-validated/2026/08/orphan.pdf','47000000-0000-4000-8000-000000000099','{"size":100,"mimetype":"application/pdf"}');

-- Lecture Mine A, non-fuite et absence de DML client ----------------------
SELECT pg_temp.set_claims('47000000-0000-4000-8000-000000000001',
  'authenticated','aal2','47-session-001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id IN(
  'production-documents','freight-customs-documents','shipping-documents',
  'ASSAY-CERTIFICATES','mining-company-documents')),5::bigint,
  'Mine A lit exactement ses cinq objets avec metadata');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='production-documents'),
  1::bigint,'Mine A lit son document Production');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='freight-customs-documents'),
  1::bigint,'Mine A lit son document Fret');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='shipping-documents'),
  1::bigint,'Mine A lit son document Shipping');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='ASSAY-CERTIFICATES'),
  1::bigint,'Mine A lit son certificat');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='mining-company-documents'),
  1::bigint,'Mine A lit son document societe');
SELECT is((SELECT count(*) FROM storage.objects WHERE name LIKE '%orphan.pdf'),
  0::bigint,'un objet sans metadata parente reste invisible');
SELECT is(pg_temp.try_insert_storage('production-documents',
  '47000000-0000-4000-8000-000000000201/forged.pdf'),'ERR:42501',
  'Mine A ne peut pas INSERT directement dans Storage');
SELECT is(pg_temp.try_update_storage('production-documents',
  '47000000-0000-4000-8000-000000000201/format-validated/2026/08/production.pdf'),
  0,'Mine A ne peut pas UPDATE son objet Storage');
SELECT is(pg_temp.try_delete_storage('production-documents',
  '47000000-0000-4000-8000-000000000201/format-validated/2026/08/production.pdf'),
  'ERR:42501','Mine A ne peut pas DELETE son objet Storage');
RESET ROLE;

SELECT pg_temp.set_claims('47000000-0000-4000-8000-000000000002',
  'authenticated','aal2','47-session-002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id IN(
  'production-documents','freight-customs-documents','shipping-documents',
  'ASSAY-CERTIFICATES','mining-company-documents')),0::bigint,
  'Mine B ne lit aucun objet du tenant A');
RESET ROLE;

SELECT pg_temp.set_claims('47000000-0000-4000-8000-000000000001',
  'authenticated','aal1','47-session-001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id IN(
  'production-documents','freight-customs-documents','shipping-documents',
  'ASSAY-CERTIFICATES','mining-company-documents')),0::bigint,
  'AAL1 ne lit aucun objet sensible');
RESET ROLE;

SELECT pg_temp.set_claims('47000000-0000-4000-8000-000000000001',
  'anon','aal1','47-session-001');
SET LOCAL ROLE anon;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id IN(
  'production-documents','freight-customs-documents','shipping-documents',
  'ASSAY-CERTIFICATES','mining-company-documents')),0::bigint,
  'anon ne lit aucun objet sensible');
RESET ROLE;

SELECT pg_temp.set_claims('47000000-0000-4000-8000-000000000003',
  'authenticated','aal2','47-session-003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id IN(
  'production-documents','freight-customs-documents','shipping-documents',
  'ASSAY-CERTIFICATES','mining-company-documents')),5::bigint,
  'lecteur SONASP habilite lit les cinq objets parents');
RESET ROLE;

-- Normalisation exacte des references ------------------------------------
SELECT ok(public.snp_storage_reference_matches(
  'parent/file.pdf','bucket','parent/file.pdf'),'reference brute acceptee');
SELECT ok(public.snp_storage_reference_matches(
  'bucket/parent/file.pdf','bucket','parent/file.pdf'),'reference bucket acceptee');
SELECT ok(public.snp_storage_reference_matches(
  'https://example.supabase.co/storage/v1/object/public/bucket/parent/file.pdf?x=1',
  'bucket','parent/file.pdf'),'ancienne URL exacte acceptee');
SELECT ok(NOT public.snp_storage_reference_matches(
  'other-parent/file.pdf','bucket','parent/file.pdf'),
  'un suffixe collisionnel non exact est refuse');

SELECT * FROM finish();
ROLLBACK;
