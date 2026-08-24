BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_shipping()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.shipping_preparations;
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_companies()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.mining_companies;
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_purchases()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.snp_achats_mines;
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_sessions()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_sessions;
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_audit()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.audit_logs;
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_activation_tokens()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_activation_tokens;
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_metadata_counts()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_shipping bigint;
  v_assay bigint;
  v_company bigint;
BEGIN
  SELECT count(*) INTO v_shipping FROM public.shipping_documents;
  SELECT count(*) INTO v_assay FROM public.assay_certificates;
  SELECT count(*) INTO v_company FROM public.mining_company_documents;
  RETURN format('OK:%s,%s,%s', v_shipping, v_assay, v_company);
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_shipping_document(
  p_id uuid,
  p_shipping_id uuid,
  p_uploaded_by uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  INSERT INTO public.shipping_documents (
    id, shipping_preparation_id, title, document_url,
    file_name, mime_type, uploaded_by
  ) VALUES (
    p_id, p_shipping_id, 'Document test',
    p_shipping_id::text || '/document-test.pdf',
    'document-test.pdf', 'application/pdf', p_uploaded_by
  );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_shipping_document(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.shipping_documents
  SET title = 'Document métier modifié'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_assay_content(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.assay_certificates
  SET certificate_number = 'CERT-METADATA-UPDATED'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_approve_assay(
  p_id uuid,
  p_claimed_approver uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.assay_certificates
  SET approval_status = 'approved',
      approved_by = p_claimed_approver,
      approved_at = '2000-01-01T00:00:00Z'::timestamptz,
      approval_notes = 'Contrôle conforme'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_count_shipping_certificates_rpc(
  p_shipping_id uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  v_count := public.count_shipping_certificates(p_shipping_id);
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_certificate_statistics()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT total_certificates INTO v_count
  FROM public.get_certificates_statistics();
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_get_certificate_with_data(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM 1 FROM public.get_certificate_with_data(p_id);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_shipping_update(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.shipping_preparations
  SET notes = 'mise à jour directe interdite'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_shipping_status_update(p_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.shipping_preparations
  SET status = 'approved_by_customs'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_shipping(
  p_id uuid,
  p_company_id uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  INSERT INTO public.shipping_preparations (
    id, expedition_lot_number, mining_company_id
  ) VALUES (p_id, 'P0-MINE-CREATE', p_company_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_transition(
  p_id uuid,
  p_expected public.shipping_preparation_status,
  p_target public.shipping_preparation_status
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_result jsonb;
BEGIN
  v_result := public.snp_transition_shipping_preparation(
    p_id, p_expected, p_target
  );
  RETURN 'OK:' || (v_result ->> 'status');
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_smtp_list()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.snp_configurations_courriel();
  RETURN 'OK:' || v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_smtp_create()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_uid uuid;
BEGIN
  v_uid := public.snp_creer_configuration_courriel(
    'SMTP P0', 'smtp.sonasp.invalid', 587, true,
    'smtp-p0@sonasp.invalid', 'smtp-p0@sonasp.invalid',
    'SONASP P0', 'secret-test-non-production', false
  );
  RETURN 'OK:' || v_uid::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

SELECT plan(84);

-- Contrat structurel ---------------------------------------------------------
SELECT has_function(
  'public', 'snp_transition_shipping_preparation',
  ARRAY['uuid', 'shipping_preparation_status', 'shipping_preparation_status'],
  'la transition Shipping possède une RPC canonique'
);
SELECT has_trigger(
  'public', 'shipping_preparations', 'snp_shipping_status_audit',
  'chaque transition Shipping déclenche un audit canonique'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.shipping_preparations', 'UPDATE'),
  'authenticated ne possède aucun UPDATE table-wide sur une expédition'
);
SELECT ok(
  has_column_privilege(
    'authenticated', 'public.shipping_preparations', 'notes', 'UPDATE'
  ),
  'authenticated peut éditer une colonne métier sous contrôle RLS'
);
SELECT ok(
  NOT has_column_privilege(
    'authenticated', 'public.shipping_preparations', 'status', 'UPDATE'
  ),
  'authenticated ne possède jamais UPDATE sur status'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ),
  'authenticated peut appeler la RPC de transition'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ),
  'anon ne peut pas appeler la RPC de transition'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.snp_transition_shipping_preparation(uuid,public.shipping_preparation_status,public.shipping_preparation_status)',
    'EXECUTE'
  ),
  'la RPC de transition est accordée seulement à authenticated'
);
SELECT is(
  (SELECT count(*)
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'shipping_preparations', 'mining_companies', 'snp_achats_mines',
       'user_sessions', 'audit_logs', 'audit_trail',
       'user_activation_tokens', 'snp_configuration_courriel',
       'shipping_documents', 'assay_certificates',
       'mining_company_documents'
     )
     AND c.relrowsecurity AND c.relforcerowsecurity),
  11::bigint,
  'RLS est activée et forcée sur les onze tables critiques'
);
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN (
       'shipping_preparations', 'mining_companies', 'snp_achats_mines',
       'user_sessions', 'audit_logs', 'audit_trail', 'user_activation_tokens',
       'shipping_documents', 'assay_certificates',
       'mining_company_documents'
     )
     AND ('public' = ANY(roles) OR 'anon' = ANY(roles))),
  0::bigint,
  'aucune policy critique ne vise public ou anon'
);
SELECT is(
  (SELECT count(*)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'create_artisan_sale_to_sonasp', 'release_license_quota',
       'log_security_event', 'log_user_activity', 'generate_activation_token',
       'validate_activation_token', 'auto_allocate_inventory'
     )
     AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon ne peut exécuter aucune RPC SECURITY DEFINER dangereuse'
);
SELECT is(
  (SELECT count(*) FROM storage.buckets
   WHERE id IN (
     'shipping-documents', 'ASSAY-CERTIFICATES', 'mining-company-documents'
   ) AND NOT public),
  3::bigint,
  'les trois buckets sensibles sont privés'
);
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN (
       'snp_shipping_storage_read', 'snp_shipping_storage_insert',
       'snp_shipping_storage_update', 'snp_shipping_storage_delete',
       'snp_assay_storage_read', 'snp_assay_storage_insert',
       'snp_assay_storage_update', 'snp_assay_storage_delete',
       'snp_mining_documents_storage_read',
       'snp_mining_documents_storage_insert',
       'snp_mining_documents_storage_update',
       'snp_mining_documents_storage_delete'
     )),
  12::bigint,
  'les douze policies Storage canoniques sont présentes'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated', 'public.user_activation_tokens', 'SELECT'
  ),
  'authenticated ne peut pas lire les tokens d’activation'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code = 'email.settings.manage' AND sensitive
  ),
  'email.settings.manage est une capability sensible'
);
SELECT is(
  (SELECT array_agg(role ORDER BY role)
   FROM public.snp_role_capabilities
   WHERE capability_code = 'email.settings.manage'),
  ARRAY['admin', 'owner']::text[],
  'email.settings.manage est attribuée par défaut seulement à admin et owner'
);
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'snp_configuration_courriel'),
  0::bigint,
  'la table SMTP reste sans policy navigateur'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated', 'public.snp_configuration_courriel', 'SELECT'
  ),
  'authenticated ne lit jamais directement la table SMTP'
);
SELECT ok(
  has_function_privilege(
    'service_role', 'public.snp_configuration_courriel_active()', 'EXECUTE'
  ),
  'la fonction Edge peut lire la configuration SMTP active'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated', 'public.snp_configuration_courriel_active()', 'EXECUTE'
  ),
  'authenticated ne peut pas récupérer le secret SMTP'
);
SELECT ok(
  has_function_privilege(
    'authenticated', 'public.snp_configurations_courriel()', 'EXECUTE'
  ),
  'la liste SMTP sans secret est exposée à authenticated puis contrôlée en interne'
);
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN (
       'snp_shipping_documents_read_scope',
       'snp_shipping_documents_insert_scope',
       'snp_shipping_documents_update_scope',
       'snp_shipping_documents_delete_scope',
       'snp_assay_certificates_read_scope',
       'snp_assay_certificates_insert_scope',
       'snp_assay_certificates_update_scope',
       'snp_assay_certificates_delete_scope',
       'snp_mining_company_documents_read_scope',
       'snp_mining_company_documents_insert_scope',
       'snp_mining_company_documents_update_scope',
       'snp_mining_company_documents_delete_scope'
     )),
  12::bigint,
  'les douze policies de métadonnées documentaires sont canoniques'
);
SELECT is(
  (SELECT count(*) FROM pg_trigger
   WHERE tgrelid IN (
     'public.shipping_documents'::regclass,
     'public.assay_certificates'::regclass,
     'public.mining_company_documents'::regclass
   )
   AND tgname IN (
     'snp_shipping_document_audit_guard',
     'snp_assay_certificate_audit_guard',
     'snp_mining_company_document_audit_guard'
   )
   AND NOT tgisinternal),
  3::bigint,
  'les trois gardes parent/audit documentaires sont installées'
);
SELECT is(
  (SELECT count(*) FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN (
       'shipping_documents', 'assay_certificates',
       'mining_company_documents'
     )
     AND grantee = 'anon'),
  0::bigint,
  'anon ne possède aucun grant sur les métadonnées documentaires'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
   WHERE p.oid IN (
     'public.count_shipping_certificates(uuid)'::regprocedure,
     'public.get_shipping_assay_certificates(uuid)'::regprocedure,
     'public.get_certificates_statistics()'::regprocedure
   )
   AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon ne contourne pas RLS via les RPC de certificats'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated', 'public.get_certificate_with_data(uuid)', 'EXECUTE'
  ),
  'la RPC historique get_certificate_with_data reste révoquée aux clients'
);

-- Fixtures multi-tenant ------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('61000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-mine-a@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-mine-b@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-manager@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-workflow@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-admin@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-8000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-service@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.mining_companies (
  id, code, name, country, company_type, is_active
) VALUES
  ('61000000-0000-4000-8000-000000000101', 'P0-MINE-A', 'Mine A P0', 'Burkina Faso', 'production_mine', true),
  ('61000000-0000-4000-8000-000000000102', 'P0-MINE-B', 'Mine B P0', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id,
  mfa_enrolled_at, must_change_password
) VALUES
  ('61000000-0000-4000-8000-000000000001', 'p0-mine-a@sonasp.invalid', 'Mine A', 'mine', true, '61000000-0000-4000-8000-000000000101', now(), false),
  ('61000000-0000-4000-8000-000000000002', 'p0-mine-b@sonasp.invalid', 'Mine B', 'mine', true, '61000000-0000-4000-8000-000000000102', now(), false),
  ('61000000-0000-4000-8000-000000000003', 'p0-manager@sonasp.invalid', 'Manager', 'manager', true, NULL, now(), false),
  ('61000000-0000-4000-8000-000000000004', 'p0-workflow@sonasp.invalid', 'Workflow', 'management', true, NULL, now(), false),
  ('61000000-0000-4000-8000-000000000005', 'p0-admin@sonasp.invalid', 'Admin', 'admin', true, NULL, now(), false),
  ('61000000-0000-4000-8000-000000000099', 'p0-service@sonasp.invalid', 'Service', 'admin', true, NULL, now(), false);

INSERT INTO public.shipping_preparations (
  id, expedition_lot_number, mining_company_id, status,
  total_net_weight_grams, total_weight_oz, created_by
) VALUES
  ('61000000-0000-4000-8000-000000000201', 'P0-SHIP-A', '61000000-0000-4000-8000-000000000101', 'waiting_for_customs_approval', 100, 3.21507466, '61000000-0000-4000-8000-000000000099'),
  ('61000000-0000-4000-8000-000000000202', 'P0-SHIP-B', '61000000-0000-4000-8000-000000000102', 'waiting_for_customs_approval', 100, 3.21507466, '61000000-0000-4000-8000-000000000099');

INSERT INTO public.shipping_documents (
  id, shipping_preparation_id, title, document_url,
  file_name, file_size, mime_type, uploaded_by
) VALUES
  ('61000000-0000-4000-8000-000000000601', '61000000-0000-4000-8000-000000000201', 'Document Shipping A', '61000000-0000-4000-8000-000000000201/document-a.pdf', 'document-a.pdf', 100, 'application/pdf', '61000000-0000-4000-8000-000000000099'),
  ('61000000-0000-4000-8000-000000000602', '61000000-0000-4000-8000-000000000202', 'Document Shipping B', '61000000-0000-4000-8000-000000000202/document-b.pdf', 'document-b.pdf', 100, 'application/pdf', '61000000-0000-4000-8000-000000000099');

INSERT INTO public.assay_certificates (
  id, shipping_preparation_id, file_path, file_name,
  file_size, mime_type, uploaded_by
) VALUES
  ('61000000-0000-4000-8000-000000000611', '61000000-0000-4000-8000-000000000201', '61000000-0000-4000-8000-000000000201/assay-a.pdf', 'assay-a.pdf', 100, 'application/pdf', '61000000-0000-4000-8000-000000000099'),
  ('61000000-0000-4000-8000-000000000612', '61000000-0000-4000-8000-000000000202', '61000000-0000-4000-8000-000000000202/assay-b.pdf', 'assay-b.pdf', 100, 'application/pdf', '61000000-0000-4000-8000-000000000099');

INSERT INTO public.mining_company_documents (
  id, mining_company_id, doc_type, file_name,
  file_path, file_size, mime_type, uploaded_by
) VALUES
  ('61000000-0000-4000-8000-000000000621', '61000000-0000-4000-8000-000000000101', 'autorisation', 'mine-a.pdf', '61000000-0000-4000-8000-000000000101/mine-a.pdf', 100, 'application/pdf', '61000000-0000-4000-8000-000000000099'),
  ('61000000-0000-4000-8000-000000000622', '61000000-0000-4000-8000-000000000102', 'autorisation', 'mine-b.pdf', '61000000-0000-4000-8000-000000000102/mine-b.pdf', 100, 'application/pdf', '61000000-0000-4000-8000-000000000099');

INSERT INTO public.snp_achats_mines (
  id, numero_achat, mining_company_id, periode_debut, periode_fin,
  date_achat, quantite_oz, prix_once_fcfa, created_by, updated_by
) VALUES
  ('61000000-0000-4000-8000-000000000301', 'P0-ACHAT-A', '61000000-0000-4000-8000-000000000101', current_date - 1, current_date, current_date, 2, 1000000, '61000000-0000-4000-8000-000000000099', '61000000-0000-4000-8000-000000000099'),
  ('61000000-0000-4000-8000-000000000302', 'P0-ACHAT-B', '61000000-0000-4000-8000-000000000102', current_date - 1, current_date, current_date, 2, 1000000, '61000000-0000-4000-8000-000000000099', '61000000-0000-4000-8000-000000000099');

INSERT INTO public.user_sessions (
  id, user_id, session_token, expires_at
) VALUES
  ('61000000-0000-4000-8000-000000000401', '61000000-0000-4000-8000-000000000001', 'p0-session-a', now() + interval '1 hour'),
  ('61000000-0000-4000-8000-000000000402', '61000000-0000-4000-8000-000000000002', 'p0-session-b', now() + interval '1 hour');

INSERT INTO public.audit_logs (
  id, user_id, action, module, details
) VALUES (
  '61000000-0000-4000-8000-000000000501',
  '61000000-0000-4000-8000-000000000001',
  'P0_TEST', 'security', 'fixture audit P0'
);

-- anon et AAL1 ---------------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000001', 'anon', 'aal1'
);
SET LOCAL ROLE anon;
SELECT is(pg_temp.try_count_shipping(), 'ERR:42501', 'anon ne lit pas Shipping');
SELECT is(
  pg_temp.try_metadata_counts(), 'ERR:42501',
  'anon ne lit aucune métadonnée documentaire'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_count_shipping(), 'OK:0', 'une mine AAL1 ne lit aucune expédition');
SELECT is(
  pg_temp.try_metadata_counts(), 'OK:0,0,0',
  'une mine AAL1 ne lit aucune métadonnée documentaire'
);
SELECT is(
  pg_temp.try_insert_shipping_document(
    '61000000-0000-4000-8000-000000000603',
    '61000000-0000-4000-8000-000000000201',
    '61000000-0000-4000-8000-000000000002'
  ),
  'ERR:42501', 'une mine AAL1 ne crée aucune métadonnée documentaire'
);
SELECT is(
  pg_temp.try_direct_shipping_update('61000000-0000-4000-8000-000000000201'),
  'OK:0', 'une mine AAL1 ne peut atteindre aucune ligne en édition'
);
RESET ROLE;

-- Mine A AAL2 ----------------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_count_shipping(), 'OK:1', 'la Mine A ne lit que son expédition');
SELECT is(pg_temp.try_count_companies(), 'OK:1', 'la Mine A ne lit que sa société');
SELECT is(pg_temp.try_count_purchases(), 'OK:1', 'la Mine A ne lit que son achat');
SELECT is(pg_temp.try_count_sessions(), 'OK:1', 'la Mine A ne lit que sa session');
SELECT is(pg_temp.try_count_audit(), 'OK:0', 'une mine ne lit pas le journal interne');
SELECT is(
  pg_temp.try_metadata_counts(), 'OK:1,1,1',
  'la Mine A ne lit que les trois métadonnées de son tenant'
);
SELECT is(
  pg_temp.try_update_shipping_document('61000000-0000-4000-8000-000000000601'),
  'OK:1', 'la Mine A modifie une métadonnée Shipping de son tenant'
);
SELECT is(
  pg_temp.try_update_assay_content('61000000-0000-4000-8000-000000000611'),
  'OK:1', 'la Mine A enrichit le certificat encore en attente'
);
SELECT is(
  pg_temp.try_insert_shipping_document(
    '61000000-0000-4000-8000-000000000603',
    '61000000-0000-4000-8000-000000000201',
    '61000000-0000-4000-8000-000000000002'
  ),
  'OK:1', 'la Mine A crée une métadonnée pour sa propre expédition'
);
SELECT is(
  pg_temp.try_insert_shipping_document(
    '61000000-0000-4000-8000-000000000604',
    '61000000-0000-4000-8000-000000000202',
    '61000000-0000-4000-8000-000000000001'
  ),
  'ERR:42501', 'la Mine A ne crée pas de métadonnée pour la Mine B'
);
SELECT is(
  pg_temp.try_approve_assay(
    '61000000-0000-4000-8000-000000000611',
    '61000000-0000-4000-8000-000000000001'
  ),
  'ERR:42501', 'mine.operate ne permet pas d’approuver un certificat'
);
SELECT is(
  pg_temp.try_count_shipping_certificates_rpc(
    '61000000-0000-4000-8000-000000000201'
  ),
  'OK:1', 'la RPC certificats respecte le parent de la Mine A'
);
SELECT is(
  pg_temp.try_direct_shipping_update('61000000-0000-4000-8000-000000000201'),
  'OK:1', 'la Mine A AAL2 modifie un champ métier de sa propre expédition'
);
SELECT is(
  pg_temp.try_insert_shipping(
    '61000000-0000-4000-8000-000000000203',
    '61000000-0000-4000-8000-000000000101'
  ),
  'OK:1', 'la Mine A AAL2 crée une préparation dans son tenant'
);
SELECT is(
  pg_temp.try_insert_shipping(
    '61000000-0000-4000-8000-000000000204',
    '61000000-0000-4000-8000-000000000102'
  ),
  'ERR:42501', 'la Mine A ne crée pas de préparation dans le tenant B'
);
SELECT ok(
  public.snp_sec_can_access_shipping_storage(
    'shipping-documents',
    '61000000-0000-4000-8000-000000000201/document.pdf', false
  ),
  'la Mine A lit le document de son expédition'
);
SELECT ok(
  NOT public.snp_sec_can_access_shipping_storage(
    'ASSAY-CERTIFICATES',
    '61000000-0000-4000-8000-000000000202/certificat.pdf', false
  ),
  'la Mine A ne lit pas le certificat de la Mine B'
);
SELECT ok(
  public.snp_sec_can_access_shipping_storage(
    'shipping-documents',
    '61000000-0000-4000-8000-000000000201/nouveau.pdf', true
  ),
  'mine.operate permet aussi l’écriture Storage dans son expédition'
);
RESET ROLE;

SELECT is(
  (SELECT uploaded_by FROM public.shipping_documents
   WHERE id = '61000000-0000-4000-8000-000000000603'),
  '61000000-0000-4000-8000-000000000001'::uuid,
  'uploaded_by est dérivé du JWT malgré une valeur client usurpée'
);

-- Nettoyage de la fixture créée par la Mine A sous le rôle propriétaire test.
DELETE FROM public.shipping_preparations
WHERE id = '61000000-0000-4000-8000-000000000203';

-- Mine B et manager ----------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_metadata_counts(), 'OK:1,1,1',
  'la Mine B ne lit que les trois métadonnées de son tenant'
);
SELECT is(
  pg_temp.try_update_shipping_document('61000000-0000-4000-8000-000000000601'),
  'OK:0', 'la Mine B ne modifie pas la métadonnée Shipping de la Mine A'
);
SELECT is(
  pg_temp.try_count_shipping_certificates_rpc(
    '61000000-0000-4000-8000-000000000201'
  ),
  'ERR:42501', 'la RPC ne révèle pas les certificats de la Mine A à la Mine B'
);
SELECT is(
  pg_temp.try_get_certificate_with_data(
    '61000000-0000-4000-8000-000000000611'
  ),
  'ERR:42501',
  'la Mine B ne peut pas appeler la RPC historique de certificat révoquée'
);
SELECT is(
  pg_temp.try_direct_shipping_update('61000000-0000-4000-8000-000000000201'),
  'OK:0', 'la Mine B ne peut atteindre aucune ligne Shipping de la Mine A'
);
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 'approved_by_customs'
  ),
  'ERR:42501', 'la Mine B ne transitionne pas l’expédition de la Mine A'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_count_shipping(), 'OK:2', 'le manager AAL2 lit le workflow global');
SELECT is(
  pg_temp.try_metadata_counts(), 'OK:3,2,2',
  'le manager interne lit les métadonnées documentaires globales'
);
SELECT is(
  pg_temp.try_certificate_statistics(), 'OK:2',
  'les statistiques certificats sont réservées au lecteur interne'
);
SELECT ok(
  public.snp_sec_can_access_shipping_storage(
    'shipping-documents',
    '61000000-0000-4000-8000-000000000201/document.pdf', false
  ),
  'le manager AAL2 lit les pièces du workflow'
);
SELECT ok(
  NOT public.snp_sec_can_access_shipping_storage(
    'shipping-documents',
    '61000000-0000-4000-8000-000000000201/document.pdf', true
  ),
  'le manager ne modifie pas les pièces Shipping'
);
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 'approved_by_customs'
  ),
  'ERR:42501', 'le manager sans capability d’approbation ne transitionne pas'
);
SELECT is(pg_temp.try_smtp_list(), 'ERR:42501', 'le manager ne lit pas la configuration SMTP');
RESET ROLE;

-- SMTP admin et AAL2 ---------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000005', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_smtp_list(), 'ERR:42501', 'un admin AAL1 ne lit pas SMTP');
SELECT is(
  pg_temp.try_smtp_create(), 'ERR:42501',
  'un admin AAL1 ne modifie pas SMTP'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000005', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT ok(
  public.snp_actor_has_capability('email.settings.manage'),
  'un admin AAL2 possède email.settings.manage'
);
SELECT ok(
  pg_temp.try_smtp_create() LIKE 'OK:%',
  'un admin AAL2 crée une configuration SMTP via la RPC auditée'
);
SELECT ok(
  pg_temp.try_smtp_list() LIKE 'OK:%',
  'un admin AAL2 lit la vue SMTP sans secret'
);
RESET ROLE;

-- Transition canonique ------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000004', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 'approved_by_customs'
  ),
  'ERR:42501', 'AAL1 est refusé même pour un rôle métier'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000004', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_direct_shipping_update('61000000-0000-4000-8000-000000000201'),
  'OK:1', 'le rôle workflow modifie les champs métier autorisés'
);
SELECT is(
  pg_temp.try_approve_assay(
    '61000000-0000-4000-8000-000000000611',
    '61000000-0000-4000-8000-000000000002'
  ),
  'OK:1', 'sonasp.approve statue le certificat via la garde SQL'
);
SELECT is(
  pg_temp.try_direct_shipping_status_update('61000000-0000-4000-8000-000000000201'),
  'ERR:42501', 'le rôle workflow ne peut pas contourner la RPC pour status'
);
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 'approved_by_customs'
  ),
  'OK:approved_by_customs', 'la transition douane valide réussit'
);
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 'approved_by_customs'
  ),
  'ERR:40001', 'un statut attendu obsolète produit un conflit optimiste'
);
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'approved_by_customs', 'waiting_for_customs_approval'
  ),
  'ERR:23514', 'un retour arrière hors graphe est refusé'
);
SELECT is(
  pg_temp.try_transition(
    '61000000-0000-4000-8000-000000000201',
    'approved_by_customs', 'ready_for_expedition'
  ),
  'OK:ready_for_expedition', 'la transition finale valide réussit'
);
SELECT ok(
  (SELECT shipped_at IS NOT NULL FROM public.shipping_preparations
   WHERE id = '61000000-0000-4000-8000-000000000201'),
  'la transition finale horodate shipped_at'
);
RESET ROLE;

SELECT is(
  (SELECT approved_by FROM public.assay_certificates
   WHERE id = '61000000-0000-4000-8000-000000000611'),
  '61000000-0000-4000-8000-000000000004'::uuid,
  'approved_by est dérivé du JWT et non de la valeur client'
);

SELECT is(
  (SELECT count(*) FROM public.snp_workflow_audit
   WHERE aggregate_type = 'shipping_preparation'
     AND aggregate_id = '61000000-0000-4000-8000-000000000201'
     AND action = 'status.transition'),
  2::bigint,
  'les deux transitions réussies ont exactement deux audits'
);

SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_count_activation_tokens(), 'ERR:42501', 'authenticated ne lit pas les tokens');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '61000000-0000-4000-8000-000000000001', 'anon', 'aal1'
);
SET LOCAL ROLE anon;
SELECT is(pg_temp.try_count_activation_tokens(), 'ERR:42501', 'anon ne lit pas les tokens');
RESET ROLE;

SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_activation_tokens'),
  0::bigint,
  'user_activation_tokens est fail-closed sans policy'
);
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN (
       'shipping_preparations', 'mining_companies', 'snp_achats_mines',
       'user_sessions', 'audit_logs', 'audit_trail', 'user_activation_tokens',
       'shipping_documents', 'assay_certificates',
       'mining_company_documents'
     )
     AND (lower(coalesce(qual, '')) = 'true'
          OR lower(coalesce(with_check, '')) = 'true')),
  0::bigint,
  'aucune policy critique ne repose sur un prédicat global TRUE'
);

SELECT * FROM finish();
ROLLBACK;
