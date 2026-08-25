/*
  LOT 2L - Preuves bancaires privees des paiements internationaux.

  La preuve n'est jamais une URL libre. Le gateway sensitive-upload valide le
  binaire, construit le chemin canonique puis appelle la RPC acteur ci-dessous.
  La metadata 1:1 rattache l'objet au paiement, a sa vente et a son client tous
  derives sous verrou. Une approbation est refusee si la metadata OU l'objet
  prive exact manque.

  Rollback operationnel non destructif : revoquer la RPC et la policy SELECT,
  conserver bucket/table/audit, puis livrer une migration compensatoire. Ne
  jamais republier le bucket ni restaurer un UPDATE navigateur de proof_url.
*/

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

DO $preflight$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name) INTO v_missing
  FROM (VALUES
    ('public.payments', to_regclass('public.payments') IS NOT NULL),
    ('public.sales', to_regclass('public.sales') IS NOT NULL),
    ('public.mining_companies', to_regclass('public.mining_companies') IS NOT NULL),
    ('storage.buckets', to_regclass('storage.buckets') IS NOT NULL),
    ('storage.objects', to_regclass('storage.objects') IS NOT NULL),
    ('public.snp_require_capability(text)',
      to_regprocedure('public.snp_require_capability(text)') IS NOT NULL),
    ('public.snp_session_est_active()',
      to_regprocedure('public.snp_session_est_active()') IS NOT NULL),
    ('public.snp_actor_has_capability(text)',
      to_regprocedure('public.snp_actor_has_capability(text)') IS NOT NULL),
    ('public.snp_peut_consulter_vente(uuid)',
      to_regprocedure('public.snp_peut_consulter_vente(uuid)') IS NOT NULL),
    ('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)',
      to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NOT NULL)
  ) AS required(name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'LOT 2L preflight - objets requis absents : %', v_missing
      USING ERRCODE = '55000';
  END IF;

  SELECT string_agg(format('%s.%s', table_name, column_name), ', '
                    ORDER BY table_name, column_name)
  INTO v_missing
  FROM (VALUES
    ('payments','id'),('payments','sale_id'),('payments','customer_id'),
    ('payments','status'),('payments','version'),('payments','amount'),
    ('payments','currency'),('payments','reference_number'),
    ('payments','executed_by'),('payments','executed_at'),('payments','proof_url'),
    ('sales','id'),('sales','customer_id'),('sales','seller_id'),
    ('sales','sale_number'),('sales','seller_type'),('sales','status'),
    ('sales','payment_proof_url'),
    ('objects','metadata'),('objects','user_metadata')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = CASE WHEN required.table_name='objects' THEN 'storage' ELSE 'public' END
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'LOT 2L preflight - colonnes requises absentes : %', v_missing
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code = 'sonasp.finance.execute' AND sensitive
  ) OR NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code = 'sonasp.finance.reconcile' AND sensitive
  ) THEN
    RAISE EXCEPTION 'LOT 2L preflight - capabilities finance sensibles absentes.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs', 'payment-proofs', false, 10485760,
  ARRAY['application/pdf','image/jpeg','image/png']::text[]
)
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.snp_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  sha256 text NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  request_fingerprint text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT snp_payment_proofs_size_check
    CHECK (file_size BETWEEN 1 AND 10485760),
  CONSTRAINT snp_payment_proofs_mime_check
    CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  CONSTRAINT snp_payment_proofs_sha256_check
    CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT snp_payment_proofs_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  CONSTRAINT snp_payment_proofs_name_check
    CHECK (
      length(file_name) BETWEEN 3 AND 255
      AND file_name = btrim(file_name)
      AND file_name !~ '[\\/[:cntrl:]]'
    ),
  CONSTRAINT snp_payment_proofs_path_check
    CHECK (
      file_path ~ ('^payment-proofs/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
        || '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](pdf|jpg|jpeg|png)$')
    ),
  CONSTRAINT snp_payment_proofs_extension_mime_check CHECK (
    (mime_type = 'application/pdf' AND lower(file_path) LIKE '%.pdf')
    OR (mime_type = 'image/jpeg' AND lower(file_path) ~ '[.](jpg|jpeg)$')
    OR (mime_type = 'image/png' AND lower(file_path) LIKE '%.png')
  )
);

CREATE INDEX IF NOT EXISTS idx_2l_payment_proofs_sale
  ON public.snp_payment_proofs(sale_id);
CREATE INDEX IF NOT EXISTS idx_2l_payment_proofs_customer
  ON public.snp_payment_proofs(customer_id);

CREATE OR REPLACE FUNCTION public.snp_2l_guard_payment_proof_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp'
AS $fn$
BEGIN
  IF current_setting('sonasp.payment_proof_2l_rpc', true) = '1' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Les preuves bancaires passent exclusivement par le gateway prive.'
    USING ERRCODE = '42501';
END;
$fn$;

DROP TRIGGER IF EXISTS snp_2l_payment_proof_rpc_only ON public.snp_payment_proofs;
CREATE TRIGGER snp_2l_payment_proof_rpc_only
BEFORE INSERT OR UPDATE OR DELETE ON public.snp_payment_proofs
FOR EACH ROW EXECUTE FUNCTION public.snp_2l_guard_payment_proof_row();

CREATE OR REPLACE FUNCTION public.snp_2l_can_read_payment_proof(
  p_payment_id uuid,
  p_sale_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_session_est_active() THEN
    RETURN false;
  END IF;
  IF NOT (
    public.snp_actor_has_capability('sonasp.finance.execute')
    OR public.snp_actor_has_capability('sonasp.finance.reconcile')
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.sales s ON s.id = p.sale_id
    JOIN public.mining_companies seller
      ON seller.id = s.seller_id AND seller.is_active
      AND upper(coalesce(seller.code,'')) = 'SONASP'
    WHERE p.id = p_payment_id
      AND p.sale_id = p_sale_id
      AND s.seller_type = 'sonasp'
      AND public.snp_peut_consulter_vente(s.id)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_2l_can_read_payment_proof_object(
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_session_est_active() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.snp_payment_proofs proof
    JOIN public.payments p ON p.id = proof.payment_id
    JOIN public.sales s ON s.id = p.sale_id AND s.id = proof.sale_id
    WHERE proof.file_path = 'payment-proofs/' || p_object_name
      AND proof.customer_id = s.customer_id
      AND public.snp_2l_can_read_payment_proof(proof.payment_id, proof.sale_id)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_2l_payment_proof_object_matches(
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_sha256 text,
  p_payment_id uuid,
  p_idempotency_key uuid,
  p_uploaded_by uuid
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','storage','pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'payment-proofs'
      AND 'payment-proofs/' || o.name = p_file_path
      AND coalesce(o.metadata->>'mimetype','') = p_mime_type
      AND CASE WHEN coalesce(o.metadata->>'size','') ~ '^[0-9]+$'
        THEN (o.metadata->>'size')::bigint ELSE NULL END = p_file_size
      AND coalesce(o.user_metadata->>'sha256','') = p_sha256
      AND coalesce(o.user_metadata->>'safe_file_name','') = p_file_name
      AND coalesce(o.user_metadata->>'payment_id','') = p_payment_id::text
      AND coalesce(o.user_metadata->>'idempotency_key','') = p_idempotency_key::text
      AND coalesce(o.user_metadata->>'uploaded_by','') = p_uploaded_by::text
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_paiement_preuve_rattacher(
  p_payment_id uuid,
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_sha256 text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','storage','pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_proof public.snp_payment_proofs%ROWTYPE;
  v_extension text := lower(regexp_replace(coalesce(p_file_path,''), '^.*[.]', ''));
  v_expected_path text;
  v_fingerprint text;
  v_result jsonb;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE = '42501';
  END IF;
  IF p_payment_id IS NULL OR p_idempotency_key IS NULL
     OR p_file_size IS NULL OR p_file_size NOT BETWEEN 1 AND 10485760
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png')
     OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR p_file_name IS NULL OR length(p_file_name) NOT BETWEEN 3 AND 255
     OR p_file_name <> btrim(p_file_name) OR p_file_name ~ '[\\/[:cntrl:]]'
     OR v_extension NOT IN ('pdf','jpg','jpeg','png')
     OR (p_mime_type = 'application/pdf' AND v_extension <> 'pdf')
     OR (p_mime_type = 'image/jpeg' AND v_extension NOT IN ('jpg','jpeg'))
     OR (p_mime_type = 'image/png' AND v_extension <> 'png') THEN
    RAISE EXCEPTION 'Metadonnees de preuve bancaire invalides.' USING ERRCODE = '22023';
  END IF;

  v_expected_path := 'payment-proofs/' || p_payment_id::text || '/'
    || p_idempotency_key::text || '.' || v_extension;
  IF p_file_path IS DISTINCT FROM v_expected_path THEN
    RAISE EXCEPTION 'Chemin de preuve bancaire non canonique.' USING ERRCODE = '22023';
  END IF;
  v_fingerprint := md5(jsonb_build_object(
    'payment_id', p_payment_id, 'file_path', p_file_path,
    'file_name', p_file_name, 'file_size', p_file_size,
    'mime_type', p_mime_type, 'sha256', p_sha256
  )::text);

  -- Serialise a la fois le paiement et la cle : deux requetes concurrentes
  -- identiques rejouent la meme ligne, deux contenus differents echouent sans
  -- exposer une violation UNIQUE brute ni doubler l'audit.
  PERFORM pg_advisory_xact_lock(hashtextextended('2l-payment:' || p_payment_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('2l-proof-key:' || p_idempotency_key::text, 0));

  SELECT * INTO v_proof
  FROM public.snp_payment_proofs
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_proof.request_fingerprint <> v_fingerprint
       OR v_proof.payment_id <> p_payment_id OR v_proof.uploaded_by <> v_actor
       OR NOT public.snp_2l_payment_proof_object_matches(
         v_proof.file_path,v_proof.file_name,v_proof.file_size,v_proof.mime_type,
         v_proof.sha256,v_proof.payment_id,v_proof.idempotency_key,v_proof.uploaded_by
       ) THEN
      RAISE EXCEPTION 'Cle d''idempotence deja utilisee avec un autre contenu.'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'id',v_proof.id,'payment_id',v_proof.payment_id,'sale_id',v_proof.sale_id,
      'customer_id',v_proof.customer_id,'file_path',v_proof.file_path,
      'file_name',v_proof.file_name,'file_size',v_proof.file_size,
      'mime_type',v_proof.mime_type,'sha256',v_proof.sha256,
      'idempotency_key',v_proof.idempotency_key,'uploaded_by',v_proof.uploaded_by,
      'created_at',v_proof.created_at,'replayed',true
    );
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.status <> 'processing' OR v_payment.executed_by IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Le paiement n''est pas rattachable par cet acteur.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = v_payment.sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v_sale.status::text <> 'virtual_payment'
     OR v_payment.customer_id IS DISTINCT FROM v_sale.customer_id
     OR v_sale.seller_type IS DISTINCT FROM 'sonasp'
     OR NOT public.snp_peut_consulter_vente(v_sale.id)
     OR NOT EXISTS (
       SELECT 1 FROM public.mining_companies mc
       WHERE mc.id = v_sale.seller_id AND upper(coalesce(mc.code,'')) = 'SONASP'
         AND mc.is_active
     ) THEN
    RAISE EXCEPTION 'Vente parente hors perimetre de paiement international.'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.snp_payment_proofs WHERE payment_id = p_payment_id) THEN
    RAISE EXCEPTION 'Une preuve bancaire est deja rattachee a ce paiement.'
      USING ERRCODE = '23505';
  END IF;
  IF NOT public.snp_2l_payment_proof_object_matches(
    p_file_path,p_file_name,p_file_size,p_mime_type,p_sha256,
    p_payment_id,p_idempotency_key,v_actor
  ) THEN
    RAISE EXCEPTION 'Objet prive de preuve bancaire introuvable.' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('sonasp.payment_proof_2l_rpc','1',true);
  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    INSERT INTO public.snp_payment_proofs(
      payment_id,sale_id,customer_id,file_path,file_name,file_size,mime_type,
      sha256,idempotency_key,request_fingerprint,uploaded_by
    ) VALUES (
      p_payment_id,v_sale.id,v_sale.customer_id,p_file_path,p_file_name,p_file_size,
      p_mime_type,p_sha256,p_idempotency_key,v_fingerprint,v_actor
    ) RETURNING * INTO v_proof;

    UPDATE public.payments SET proof_url = p_file_path WHERE id = p_payment_id;
    UPDATE public.sales SET payment_proof_url = p_file_path,
      updated_at = clock_timestamp() WHERE id = v_sale.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    PERFORM set_config('sonasp.payment_proof_2l_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);
  PERFORM set_config('sonasp.payment_proof_2l_rpc','0',true);

  PERFORM public.snp_record_workflow_event(
    'international-payment',p_payment_id,'private-proof-attached','processing','processing',
    'sonasp.finance.execute',NULL,
    jsonb_build_object('sale_id',v_sale.id,'proof_id',v_proof.id,
      'idempotency_key',p_idempotency_key,'mime_type',p_mime_type,
      'file_size',p_file_size,'sha256',p_sha256)
  );
  v_result := jsonb_build_object(
    'id',v_proof.id,'payment_id',v_proof.payment_id,'sale_id',v_proof.sale_id,
    'customer_id',v_proof.customer_id,'file_path',v_proof.file_path,
    'file_name',v_proof.file_name,'file_size',v_proof.file_size,
    'mime_type',v_proof.mime_type,'sha256',v_proof.sha256,
    'idempotency_key',v_proof.idempotency_key,'uploaded_by',v_proof.uploaded_by,
    'created_at',v_proof.created_at,'replayed',false
  );
  RETURN v_result;
END;
$fn$;

-- Reprise apres coupure navigateur : aucun payment_id/acteur n'est fourni.
-- Seuls les paiements encore processing, executes par le JWT courant, dont la
-- preuve metadata-backed est absente ou dont l'objet exact manque sont rendus.
CREATE OR REPLACE FUNCTION public.snp_paiements_preuve_reprise_lister()
RETURNS SETOF jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','storage','pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'payment_id',p.id,
    'sale_id',s.id,
    'sale_number',s.sale_number,
    'customer_id',s.customer_id,
    'amount',p.amount,
    'currency',p.currency,
    'payment_version',p.version,
    'reference_number',p.reference_number,
    'executed_at',p.executed_at,
    'proof_path',proof.file_path,
    'proof_idempotency_key',proof.idempotency_key,
    'proof_file_name',proof.file_name
  )
  FROM public.payments p
  JOIN public.sales s ON s.id = p.sale_id
  JOIN public.mining_companies seller
    ON seller.id = s.seller_id AND seller.is_active
    AND upper(coalesce(seller.code,'')) = 'SONASP'
  LEFT JOIN public.snp_payment_proofs proof ON proof.payment_id = p.id
  WHERE p.status = 'processing'
    AND p.executed_by = v_actor
    AND s.status::text = 'virtual_payment'
    AND s.seller_type = 'sonasp'
    AND p.customer_id = s.customer_id
    AND public.snp_peut_consulter_vente(s.id)
    AND (
      proof.id IS NULL
      OR proof.sale_id <> s.id
      OR proof.customer_id <> s.customer_id
      OR p.proof_url IS DISTINCT FROM proof.file_path
      OR s.payment_proof_url IS DISTINCT FROM proof.file_path
      OR NOT public.snp_2l_payment_proof_object_matches(
        proof.file_path,proof.file_name,proof.file_size,proof.mime_type,
        proof.sha256,proof.payment_id,proof.idempotency_key,proof.uploaded_by
      )
    )
  ORDER BY p.executed_at ASC, p.id ASC;
END;
$fn$;

-- Defense en profondeur : meme si une autre routine positionne le GUC 4H, le
-- passage a approved exige la metadata 1:1 et l'objet prive exact.
CREATE OR REPLACE FUNCTION public.snp_2l_require_private_proof_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','storage','pg_temp'
AS $fn$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NOT EXISTS (
    SELECT 1
    FROM public.snp_payment_proofs proof
    JOIN public.sales s ON s.id = proof.sale_id
    JOIN public.mining_companies seller
      ON seller.id = s.seller_id AND seller.is_active
      AND upper(coalesce(seller.code,'')) = 'SONASP'
    WHERE proof.payment_id = NEW.id
      AND proof.payment_id = OLD.id
      AND proof.sale_id = NEW.sale_id
      AND proof.customer_id = NEW.customer_id
      AND proof.customer_id = s.customer_id
      AND s.seller_type = 'sonasp'
      AND NEW.proof_url = proof.file_path
      AND s.payment_proof_url = proof.file_path
      AND public.snp_2l_payment_proof_object_matches(
        proof.file_path,proof.file_name,proof.file_size,proof.mime_type,
        proof.sha256,proof.payment_id,proof.idempotency_key,proof.uploaded_by
      )
  ) THEN
    RAISE EXCEPTION 'Une preuve bancaire privee metadata-backed est requise avant approbation.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_2l_require_private_proof_on_approval ON public.payments;
CREATE TRIGGER snp_2l_require_private_proof_on_approval
BEFORE UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.snp_2l_require_private_proof_on_approval();

ALTER TABLE public.snp_payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_payment_proofs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_2l_payment_proofs_select ON public.snp_payment_proofs;
CREATE POLICY snp_2l_payment_proofs_select
ON public.snp_payment_proofs FOR SELECT TO authenticated
USING (public.snp_2l_can_read_payment_proof(payment_id, sale_id));

DO $drop_payment_storage_policies$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND coalesce(qual,'') || ' ' || coalesce(with_check,'') ILIKE '%payment-proofs%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END;
$drop_payment_storage_policies$;

CREATE POLICY snp_2l_payment_proofs_storage_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.snp_2l_can_read_payment_proof_object(name)
);

-- Les policies restrictives restent effectives meme si une ancienne ou future
-- policy permissive generique (`USING (true)`) vise storage.objects.
CREATE POLICY snp_2l_payment_proofs_storage_select_guard
ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
USING (
  bucket_id <> 'payment-proofs'
  OR public.snp_2l_can_read_payment_proof_object(name)
);
CREATE POLICY snp_2l_payment_proofs_storage_insert_guard
ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
WITH CHECK (bucket_id <> 'payment-proofs');
CREATE POLICY snp_2l_payment_proofs_storage_update_guard
ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
USING (bucket_id <> 'payment-proofs')
WITH CHECK (bucket_id <> 'payment-proofs');
CREATE POLICY snp_2l_payment_proofs_storage_delete_guard
ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
USING (bucket_id <> 'payment-proofs');

REVOKE ALL ON TABLE public.snp_payment_proofs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.snp_payment_proofs TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_2l_guard_payment_proof_row()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_2l_require_private_proof_on_approval()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_2l_can_read_payment_proof(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_2l_can_read_payment_proof_object(text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_2l_payment_proof_object_matches(text,text,bigint,text,text,uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_paiements_preuve_reprise_lister()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_2l_can_read_payment_proof(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_2l_can_read_payment_proof_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_paiements_preuve_reprise_lister()
  TO authenticated;

COMMENT ON TABLE public.snp_payment_proofs IS
  'Metadata autoritative 1:1 des preuves bancaires privees; aucune URL publique ni DML client.';
COMMENT ON FUNCTION public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid) IS
  'Rattache idempotemment une preuve binaire validee au paiement international execute par l acteur JWT.';
COMMENT ON FUNCTION public.snp_paiements_preuve_reprise_lister() IS
  'Liste sans parametre acteur les paiements processing du JWT dont la preuve privee doit etre reprise.';

DO $postflight$
BEGIN
  IF (SELECT public FROM storage.buckets WHERE id = 'payment-proofs') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LOT 2L postflight - bucket payment-proofs non prive.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'snp_payment_proofs'
      AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) THEN
    RAISE EXCEPTION 'LOT 2L postflight - DML client sur metadata preuve.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND roles && ARRAY['public','anon','authenticated']::name[]
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
      AND permissive <> 'RESTRICTIVE'
      AND coalesce(qual,'') || ' ' || coalesce(with_check,'') ILIKE '%payment-proofs%'
  ) THEN
    RAISE EXCEPTION 'LOT 2L postflight - ecriture Storage client exposee.';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND policyname IN (
          'snp_2l_payment_proofs_storage_select_guard',
          'snp_2l_payment_proofs_storage_insert_guard',
          'snp_2l_payment_proofs_storage_update_guard',
          'snp_2l_payment_proofs_storage_delete_guard'
        )
        AND permissive='RESTRICTIVE'
        AND roles && ARRAY['anon','authenticated']::name[]) <> 4 THEN
    RAISE EXCEPTION 'LOT 2L postflight - gardes Storage restrictives incompletes.';
  END IF;
END;
$postflight$;

COMMIT;
