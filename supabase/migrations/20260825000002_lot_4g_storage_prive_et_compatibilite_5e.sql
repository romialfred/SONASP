/*
  LOT 4G - Storage prive, lecture liee au parent et compatibilite 4F/5E.

  Le gateway sensitive-upload est l'unique chemin d'ecriture des cinq buckets
  ci-dessous. Il utilise service_role apres avoir valide session, AAL2,
  capability, parent et tenant, puis persiste une ligne de metadata. Les
  clients authentifies ne recoivent donc aucune policy INSERT/UPDATE/DELETE.

  Une URL signee ne peut etre creee via l'API Storage que si l'objet possede
  une metadata exacte et si le parent est lisible par l'acteur courant. Les
  URLs doivent rester courtes : une URL deja signee est un bearer token et ne
  reconsulte pas RLS a chaque telechargement.

  Cette migration compense egalement l'incompatibilite entre LOT 4F
  (historique strictement immuable) et LOT 5E (ancienne mise a jour de la ligne
  d'historique apres la transition). Les informations 5E sont maintenant
  injectees par le trigger BEFORE INSERT ; aucune UPDATE d'historique n'est
  necessaire.

  Rollback operationnel non destructif : conserver les buckets prives et
  l'absence de DML client. En cas de regression de lecture, corriger la ligne
  de metadata ou le gateway, puis livrer une migration compensatoire. Ne
  jamais restaurer les anciennes policies globales. Les fonctions 5E peuvent
  etre remplacees par une version ulterieure, mais l'immutabilite 4F doit etre
  preservee.
*/

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

DO $preflight$
DECLARE
  v_relation text;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'storage.buckets', 'storage.objects',
    'public.production_documents', 'public.daily_production',
    'public.freight_customs_documents', 'public.freight_customs_operations',
    'public.shipping_documents', 'public.shipping_preparations',
    'public.assay_certificates', 'public.mining_company_documents',
    'public.unified_status_history', 'public.snp_workflow_audit'
  ] LOOP
    IF to_regclass(v_relation) IS NULL THEN
      RAISE EXCEPTION 'LOT 4G: relation requise absente: %.', v_relation
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_session_est_active()') IS NULL
     OR to_regprocedure('public.snp_sec_can_read_company(uuid)') IS NULL
     OR to_regprocedure('public.snp_sec_can_read_shipping(uuid)') IS NULL
     OR to_regprocedure('public.snp_peut_consulter_production(uuid)') IS NULL
     OR to_regprocedure('public.snp_fret_peut_consulter_tenant(uuid)') IS NULL
     OR to_regprocedure('public.snp_transition_daily_production(uuid,text,text,uuid,text)') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'LOT 4G: socle session/tenant/5E incomplet.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.shipping_documents'::regclass
      AND attname = 'document_url' AND attnum > 0 AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.assay_certificates'::regclass
      AND attname = 'file_path' AND attnum > 0 AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.mining_company_documents'::regclass
      AND attname = 'file_path' AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'LOT 4G: colonnes de reference Storage historiques absentes.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

-- Les limites et MIME sont alignes sur les politiques de validation binaire
-- du gateway. ON CONFLICT rend la declaration reapplicable sans publier un
-- bucket existant par accident.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('production-documents', 'production-documents', false, 10485760,
   ARRAY['application/pdf']::text[]),
  ('freight-customs-documents', 'freight-customs-documents', false, 20971520,
   ARRAY['application/pdf','image/jpeg','image/png']::text[]),
  ('shipping-documents', 'shipping-documents', false, 10485760,
   ARRAY['application/pdf','image/jpeg','image/png',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
  ('ASSAY-CERTIFICATES', 'ASSAY-CERTIFICATES', false, 10485760,
   ARRAY['application/pdf']::text[]),
  ('mining-company-documents', 'mining-company-documents', false, 15728640,
   ARRAY['application/pdf','image/jpeg','image/png',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Chaque verification RLS part de (bucket_id,name) et cherche une reference
-- exacte dans la table de metadata. Sans ces index, une simple creation d'URL
-- signee degraderait en scan complet a mesure que les archives grossissent.
CREATE INDEX IF NOT EXISTS idx_4g_production_documents_file_path
  ON public.production_documents(file_path);
CREATE INDEX IF NOT EXISTS idx_4g_freight_documents_file_path
  ON public.freight_customs_documents(file_path);
CREATE INDEX IF NOT EXISTS idx_4g_shipping_documents_url
  ON public.shipping_documents(document_url);
CREATE INDEX IF NOT EXISTS idx_4g_assay_certificates_file_path
  ON public.assay_certificates(file_path);
CREATE INDEX IF NOT EXISTS idx_4g_mining_documents_file_path
  ON public.mining_company_documents(file_path);

-- Accepte les references canoniques brutes, bucket/chemin et les anciennes
-- URLs Supabase stockees en metadata. La comparaison de suffixe reste exacte :
-- aucun LIKE avec joker fourni par l'appelant.
CREATE OR REPLACE FUNCTION public.snp_storage_reference_matches(
  p_reference text,
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
DECLARE
  v_reference text := split_part(coalesce(p_reference, ''), '?', 1);
  v_bucket_path text := coalesce(p_bucket_id, '') || '/' || coalesce(p_object_name, '');
BEGIN
  IF p_reference IS NULL OR p_bucket_id IS NULL OR p_object_name IS NULL
     OR p_bucket_id = '' OR p_object_name = '' THEN
    RETURN false;
  END IF;
  RETURN v_reference = p_object_name
      OR v_reference = v_bucket_path
      OR right(v_reference, length(v_bucket_path) + 1) = '/' || v_bucket_path;
END;
$fn$;

-- Predicate unique de lecture. SECURITY DEFINER permet de verifier la metadata
-- parente sans qu'une policy enfant permissive puisse influencer le resultat.
CREATE OR REPLACE FUNCTION public.snp_storage_can_read_object(
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'storage', 'pg_temp'
AS $fn$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL OR NOT public.snp_session_est_active() THEN
    RETURN false;
  END IF;

  CASE p_bucket_id
    WHEN 'production-documents' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.production_documents d
        WHERE public.snp_storage_reference_matches(
                d.file_path, p_bucket_id, p_object_name)
          AND public.snp_peut_consulter_production(d.production_id)
      );
    WHEN 'freight-customs-documents' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.freight_customs_documents d
        JOIN public.freight_customs_operations o
          ON o.id = d.freight_customs_operation_id
        WHERE public.snp_storage_reference_matches(
                d.file_path, p_bucket_id, p_object_name)
          AND public.snp_fret_peut_consulter_tenant(o.mining_company_id)
      );
    WHEN 'shipping-documents' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.shipping_documents d
        WHERE public.snp_storage_reference_matches(
                d.document_url, p_bucket_id, p_object_name)
          AND public.snp_sec_can_read_shipping(d.shipping_preparation_id)
      );
    WHEN 'ASSAY-CERTIFICATES' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.assay_certificates d
        WHERE public.snp_storage_reference_matches(
                d.file_path, p_bucket_id, p_object_name)
          AND public.snp_sec_can_read_shipping(d.shipping_preparation_id)
      );
    WHEN 'mining-company-documents' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.mining_company_documents d
        WHERE public.snp_storage_reference_matches(
                d.file_path, p_bucket_id, p_object_name)
          AND public.snp_sec_can_read_company(d.mining_company_id)
      );
    ELSE
      RETURN false;
  END CASE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_storage_reference_matches(text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_storage_can_read_object(text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_storage_can_read_object(text,text)
  TO authenticated;

-- Supprime les anciennes policies ciblees ainsi que toute policy permissive
-- client globale (sans predicat bucket_id), car une policy PostgreSQL
-- permissive s'additionne par OR et rouvrirait sinon ces buckets prives.
DO $drop_unsafe_storage_policies$
DECLARE
  v_policy record;
  v_expression text;
BEGIN
  FOR v_policy IN
    SELECT policyname, cmd, roles, permissive,
           coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expression
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
  LOOP
    v_expression := v_policy.expression;
    IF (
      v_policy.roles && ARRAY['public','anon','authenticated']::name[]
      AND v_policy.permissive = 'PERMISSIVE'
      AND (
        v_expression ILIKE ANY (ARRAY[
          '%production-documents%', '%freight-customs-documents%',
          '%shipping-documents%', '%ASSAY-CERTIFICATES%',
          '%assay-certificates%', '%mining-company-documents%'
        ])
        OR v_expression NOT ILIKE '%bucket_id%'
      )
    ) OR v_policy.policyname ILIKE ANY (ARRAY[
      '%production%document%', '%freight%document%', '%shipping%storage%',
      '%assay%storage%', '%mining%document%storage%',
      '%mining_company_docs%', '%portail_mine_documents%'
    ]) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects',
                     v_policy.policyname);
    END IF;
  END LOOP;
END;
$drop_unsafe_storage_policies$;

CREATE POLICY snp_4g_production_documents_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'production-documents'
  AND public.snp_storage_can_read_object(bucket_id, name)
);

CREATE POLICY snp_4g_freight_customs_documents_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'freight-customs-documents'
  AND public.snp_storage_can_read_object(bucket_id, name)
);

CREATE POLICY snp_4g_shipping_documents_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'shipping-documents'
  AND public.snp_storage_can_read_object(bucket_id, name)
);

CREATE POLICY snp_4g_assay_certificates_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND public.snp_storage_can_read_object(bucket_id, name)
);

CREATE POLICY snp_4g_mining_company_documents_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mining-company-documents'
  AND public.snp_storage_can_read_object(bucket_id, name)
);

-- -------------------------------------------------------------------------
-- Compatibilite LOT 4F / LOT 5E : enrichissement a l'INSERT immuable.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_unified_history_before_insert()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_tenant uuid;
  v_status text;
  v_headers jsonb;
  v_request_id text;
  v_capability text;
  v_notes text;
BEGIN
  CASE NEW.entity_type
    WHEN 'shipping' THEN
      SELECT mining_company_id,status::text INTO v_tenant,v_status
      FROM public.shipping_preparations WHERE id=NEW.entity_id;
    WHEN 'production' THEN
      SELECT mining_company_id,status::text INTO v_tenant,v_status
      FROM public.daily_production WHERE id=NEW.entity_id;
    WHEN 'freight_customs' THEN
      SELECT mining_company_id,status::text INTO v_tenant,v_status
      FROM public.freight_customs_operations WHERE id=NEW.entity_id;
    ELSE
      RAISE EXCEPTION 'Type historique non autorise: %',NEW.entity_type
        USING ERRCODE='23514';
  END CASE;
  IF v_tenant IS NULL OR v_status IS NULL THEN
    RAISE EXCEPTION 'Objet historique absent ou sans tenant.' USING ERRCODE='23503';
  END IF;

  NEW.mining_company_id:=v_tenant;
  NEW.new_status:=v_status;
  NEW.changed_by:=auth.uid();
  NEW.changed_at:=clock_timestamp();
  NEW.created_at:=NEW.changed_at;
  BEGIN
    v_headers:=nullif(current_setting('request.headers',true),'')::jsonb;
    NEW.user_agent:=left(v_headers->>'user-agent',1024);
    NEW.ip_address:=public.snp_session_request_ip();
  EXCEPTION WHEN OTHERS THEN
    NEW.user_agent:=NULL;
    NEW.ip_address:=NULL;
  END;
  NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)
    || jsonb_build_object('recorded_server_side',true);

  IF NEW.entity_type = 'production' THEN
    v_request_id := nullif(current_setting(
      'snp.production_transition_request_id', true), '');
    v_capability := nullif(current_setting(
      'snp.production_transition_capability', true), '');
    v_notes := nullif(trim(coalesce(current_setting(
      'snp.production_transition_notes', true), '')), '');
    IF v_request_id IS NOT NULL THEN
      IF v_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR v_capability NOT IN ('mine.operate', 'sonasp.approve') THEN
        RAISE EXCEPTION 'Contexte de transition Production invalide.'
          USING ERRCODE='22023';
      END IF;
      NEW.notes := v_notes;
      NEW.metadata := NEW.metadata || jsonb_build_object(
        'request_id', v_request_id::uuid,
        'capability', v_capability
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_transition_daily_production(
  p_production_id uuid,
  p_expected_status text,
  p_new_status text,
  p_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_company uuid;
  v_capability text;
  v_production public.daily_production%ROWTYPE;
  v_existing public.snp_workflow_audit%ROWTYPE;
  v_audit_id bigint;
  v_history_count integer;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Authentification et identifiant de requete obligatoires.'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.mining_company_id INTO v_actor_company
  FROM public.user_profiles p
  WHERE p.id = v_actor AND p.is_active;

  IF v_actor_company IS NOT NULL
     AND public.snp_actor_has_capability('mine.operate') THEN
    v_actor_company := public.snp_societe_compte_mine();
    v_capability := 'mine.operate';
  ELSIF public.snp_actor_has_capability('sonasp.approve') THEN
    v_actor_company := NULL;
    v_capability := 'sonasp.approve';
  ELSE
    RAISE EXCEPTION 'Capability mine.operate ou sonasp.approve avec AAL2 requise.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));

  SELECT * INTO v_existing
  FROM public.snp_workflow_audit a
  WHERE a.aggregate_type = 'daily_production'
    AND a.action = 'status-transition'
    AND a.context ->> 'request_id' = p_request_id::text
  ORDER BY a.id DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.actor_id IS DISTINCT FROM v_actor
       OR v_existing.aggregate_id IS DISTINCT FROM p_production_id
       OR v_existing.status_before IS DISTINCT FROM p_expected_status
       OR v_existing.status_after IS DISTINCT FROM p_new_status
       OR (
         v_actor_company IS NOT NULL
         AND v_existing.context ->> 'mining_company_id'
             IS DISTINCT FROM v_actor_company::text
       ) THEN
      RAISE EXCEPTION 'La cle d''idempotence est deja liee a une autre transition.'
        USING ERRCODE = '22023';
    END IF;
    RETURN COALESCE(v_existing.context -> 'result', '{}'::jsonb)
      || jsonb_build_object(
        'audit_id', v_existing.id,
        'idempotent_replay', true
      );
  END IF;

  IF p_expected_status IS NULL OR p_new_status IS NULL THEN
    RAISE EXCEPTION 'Les statuts attendu et cible sont obligatoires.'
      USING ERRCODE = '22023';
  END IF;
  IF p_new_status <> 'ready_for_customs' THEN
    RAISE EXCEPTION 'Seule la validation vers ready_for_customs est autorisee par cette RPC.'
      USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND length(trim(p_notes)) > 2000 THEN
    RAISE EXCEPTION 'Les notes de validation depassent 2000 caracteres.'
      USING ERRCODE = '22023';
  END IF;

  SELECT dp.* INTO v_production
  FROM public.daily_production dp
  WHERE dp.id = p_production_id
    AND (v_actor_company IS NULL OR dp.mining_company_id = v_actor_company)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production introuvable dans votre perimetre.'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_production.created_by IS NULL OR v_production.created_by = v_actor THEN
    RAISE EXCEPTION 'Le validateur doit etre distinct du createur identifie de la production.'
      USING ERRCODE = '42501';
  END IF;
  IF v_production.status::text IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'Conflit optimiste : la production est desormais au statut %.',
      v_production.status::text USING ERRCODE = '40001';
  END IF;
  IF p_expected_status <> 'prepared' THEN
    RAISE EXCEPTION 'Transition invalide : % vers %.', p_expected_status, p_new_status
      USING ERRCODE = '22023';
  END IF;

  -- Ces valeurs sont transaction-locales et ne sont consommables que par le
  -- trigger d'historique pendant l'UPDATE ci-dessous.
  PERFORM set_config('snp.production_transition_request_id',p_request_id::text,true);
  PERFORM set_config('snp.production_transition_capability',v_capability,true);
  PERFORM set_config('snp.production_transition_notes',coalesce(p_notes,''),true);

  UPDATE public.daily_production
  SET status = 'ready_for_customs'::public.production_status_v2,
      updated_at = now()
  WHERE id = p_production_id;

  PERFORM set_config('snp.production_transition_request_id','',true);
  PERFORM set_config('snp.production_transition_capability','',true);
  PERFORM set_config('snp.production_transition_notes','',true);

  SELECT count(*) INTO v_history_count
  FROM public.unified_status_history h
  WHERE h.entity_type = 'production'
    AND h.entity_id = p_production_id
    AND h.old_status = p_expected_status
    AND h.new_status = p_new_status
    AND h.changed_by = v_actor
    AND h.metadata ->> 'request_id' = p_request_id::text
    AND h.metadata ->> 'capability' = v_capability
    AND h.notes IS NOT DISTINCT FROM nullif(trim(p_notes), '');
  IF v_history_count <> 1 THEN
    RAISE EXCEPTION 'La transition a ete annulee car son historique reglementaire n''a pas ete cree.'
      USING ERRCODE = 'P0001';
  END IF;

  v_result := jsonb_build_object(
    'production_id', p_production_id,
    'previous_status', p_expected_status,
    'status', p_new_status,
    'request_id', p_request_id,
    'idempotent_replay', false
  );

  v_audit_id := public.snp_record_workflow_event(
    'daily_production', p_production_id, 'status-transition',
    p_expected_status, p_new_status, v_capability,
    NULLIF(trim(p_notes), ''),
    jsonb_build_object(
      'request_id', p_request_id,
      'mining_company_id', v_production.mining_company_id,
      'result', v_result
    )
  );

  RETURN v_result || jsonb_build_object('audit_id', v_audit_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_transition_daily_production(uuid,text,text,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_transition_daily_production(uuid,text,text,uuid,text)
  TO authenticated;

COMMENT ON FUNCTION public.snp_transition_daily_production(uuid,text,text,uuid,text) IS
  'Transition Production atomique 5E compatible historique immuable 4F : enrichissement audit a l''INSERT, tenant/AAL2/capability/SoD/verrou/idempotence.';

DO $postcheck$
BEGIN
  IF (SELECT count(*) FROM storage.buckets
      WHERE id IN ('production-documents','freight-customs-documents',
                   'shipping-documents','ASSAY-CERTIFICATES',
                   'mining-company-documents') AND public = false) <> 5 THEN
    RAISE EXCEPTION 'LOT 4G: un bucket documentaire reste public.'
      USING ERRCODE='55000';
  END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND policyname LIKE 'snp_4g_%_read'
        AND cmd='SELECT' AND roles && ARRAY['authenticated']::name[]) <> 5 THEN
    RAISE EXCEPTION 'LOT 4G: allowlist de lecture Storage incomplete.'
      USING ERRCODE='55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND roles && ARRAY['public','anon','authenticated']::name[]
      AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
      AND (
        coalesce(qual,'') || ' ' || coalesce(with_check,'') ILIKE ANY (ARRAY[
          '%production-documents%', '%freight-customs-documents%',
          '%shipping-documents%', '%ASSAY-CERTIFICATES%',
          '%assay-certificates%', '%mining-company-documents%'
        ])
        OR (
          permissive='PERMISSIVE'
          AND coalesce(qual,'') || ' ' || coalesce(with_check,'') NOT ILIKE '%bucket_id%'
        )
      )
  ) THEN
    RAISE EXCEPTION 'LOT 4G: une policy DML client peut encore ouvrir les buckets cibles.'
      USING ERRCODE='55000';
  END IF;
END;
$postcheck$;

COMMIT;
