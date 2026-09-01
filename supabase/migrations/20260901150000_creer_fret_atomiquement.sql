BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- La creation historique du fret etait composee de plusieurs appels REST :
-- parent, productions, signataires puis documents. Cette migration introduit
-- un unique point d'ecriture transactionnel. Les enfants sont derives des
-- preparations verrouillees et ne sont jamais acceptes depuis le navigateur.
DO $preflight$
DECLARE
  v_relation text;
  v_column text;
  v_duplicate uuid;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'public.freight_shipments',
    'public.freight_shipment_productions',
    'public.freight_shipment_signatories',
    'public.shipping_preparations',
    'public.shipping_production_items',
    'public.shipping_signatories',
    'public.shipping_documents',
    'public.daily_production',
    'public.refineries',
    'public.mining_companies',
    'public.snp_workflow_audit'
  ] LOOP
    IF to_regclass(v_relation) IS NULL THEN
      RAISE EXCEPTION 'Atomic freight creation preflight failed: missing relation %.',
        v_relation;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_mfa_satisfaite()') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regprocedure('public.snp_require_capability(text)') IS NULL
     OR to_regprocedure('public.snp_fret_exiger_portee(uuid,text)') IS NULL
     OR to_regprocedure(
       'public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)'
     ) IS NULL THEN
    RAISE EXCEPTION
      'Atomic freight creation preflight failed: security or audit helpers are missing.';
  END IF;

  FOREACH v_column IN ARRAY ARRAY[
    'shipping_preparation_id', 'mining_company_id', 'expedition_number',
    'packing_list_pdf_path'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'freight_shipments'
        AND column_name = v_column
    ) THEN
      RAISE EXCEPTION
        'Atomic freight creation preflight failed: freight_shipments.% is missing.',
        v_column;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'shipping_preparation_status'
      AND e.enumlabel = 'ready_for_expedition'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'production_status_v2'
      AND e.enumlabel = 'ready_for_customs'
  ) THEN
    RAISE EXCEPTION
      'Atomic freight creation preflight failed: canonical shipping statuses are missing.';
  END IF;

  -- Une preparation deja rattachee deux fois ne peut pas etre rendue unique
  -- silencieusement. La migration s'arrete et exige une reconciliation.
  SELECT f.shipping_preparation_id
  INTO v_duplicate
  FROM public.freight_shipments f
  WHERE f.shipping_preparation_id IS NOT NULL
  GROUP BY f.shipping_preparation_id
  HAVING count(*) > 1
  LIMIT 1;

  IF v_duplicate IS NOT NULL THEN
    RAISE EXCEPTION
      'Atomic freight creation preflight failed: preparation % is linked to several freight shipments.',
      v_duplicate;
  END IF;
END;
$preflight$;

-- Association exhaustive des preparations d'un fret. La colonne historique
-- freight_shipments.shipping_preparation_id reste le parent primaire pour les
-- consommateurs existants ; cette table porte la cardinalite reelle N:1.
CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_shipments_id_company
  ON public.freight_shipments(id, mining_company_id);

CREATE TABLE public.freight_shipment_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_shipment_id uuid NOT NULL,
  shipping_preparation_id uuid NOT NULL,
  mining_company_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT freight_shipment_preparations_freight_company_fkey
    FOREIGN KEY (freight_shipment_id, mining_company_id)
    REFERENCES public.freight_shipments(id, mining_company_id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT freight_shipment_preparations_shipping_company_fkey
    FOREIGN KEY (shipping_preparation_id, mining_company_id)
    REFERENCES public.shipping_preparations(id, mining_company_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT freight_shipment_preparations_freight_preparation_key
    UNIQUE (freight_shipment_id, shipping_preparation_id),
  CONSTRAINT freight_shipment_preparations_shipping_key
    UNIQUE (shipping_preparation_id)
);

CREATE INDEX idx_freight_shipment_preparations_freight
  ON public.freight_shipment_preparations(freight_shipment_id);
CREATE INDEX idx_freight_shipment_preparations_company
  ON public.freight_shipment_preparations(mining_company_id, freight_shipment_id);

-- Instantane immuable des documents de chaque preparation. Le chemin et les
-- metadonnees sont conserves meme si la preparation source evolue ensuite.
CREATE TABLE public.freight_shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_shipment_id uuid NOT NULL
    REFERENCES public.freight_shipments(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  source_shipping_document_id uuid NOT NULL
    REFERENCES public.shipping_documents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  document_url text NOT NULL CHECK (length(trim(document_url)) BETWEEN 1 AND 2048),
  file_name text NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 255),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  mime_type text CHECK (mime_type IS NULL OR length(trim(mime_type)) BETWEEN 1 AND 255),
  source_uploaded_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  copied_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  copied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT freight_shipment_documents_source_key
    UNIQUE (source_shipping_document_id)
);

CREATE INDEX idx_freight_shipment_documents_freight
  ON public.freight_shipment_documents(freight_shipment_id, copied_at);

-- La filiation d'un signataire est necessaire pour garantir qu'une reprise
-- idempotente ne duplique jamais son instantane.
ALTER TABLE public.freight_shipment_signatories
  ADD COLUMN IF NOT EXISTS source_shipping_signatory_id uuid;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.freight_shipment_signatories'::regclass
      AND conname = 'freight_signatories_source_shipping_fkey'
  ) THEN
    ALTER TABLE public.freight_shipment_signatories
      ADD CONSTRAINT freight_signatories_source_shipping_fkey
      FOREIGN KEY (source_shipping_signatory_id)
      REFERENCES public.shipping_signatories(id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END;
$constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_signatories_source_shipping
  ON public.freight_shipment_signatories(source_shipping_signatory_id)
  WHERE source_shipping_signatory_id IS NOT NULL;

-- Reprise limitee au parent primaire historique. Aucun parent ou tenant n'est
-- invente ; le preflight precedent a deja exclu les rattachements ambigus.
INSERT INTO public.freight_shipment_preparations(
  freight_shipment_id, shipping_preparation_id, mining_company_id,
  created_by, created_at
)
SELECT f.id, f.shipping_preparation_id, f.mining_company_id,
       f.created_by, coalesce(f.created_at, clock_timestamp())
FROM public.freight_shipments f
WHERE f.shipping_preparation_id IS NOT NULL
  AND f.mining_company_id IS NOT NULL;

-- Journal prive des requetes de creation. Une cle est liee a un acteur, un
-- tenant et une empreinte canonique ; la reponse terminee est immuable.
CREATE TABLE public.snp_freight_create_operations (
  idempotency_key uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  mining_company_id uuid NOT NULL
    REFERENCES public.mining_companies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  request_fingerprint text NOT NULL
    CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  freight_shipment_id uuid
    REFERENCES public.freight_shipments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT snp_freight_create_operations_completion_check CHECK (
    (freight_shipment_id IS NULL AND response IS NULL AND completed_at IS NULL)
    OR
    (freight_shipment_id IS NOT NULL AND response IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX idx_snp_freight_create_operations_tenant_created
  ON public.snp_freight_create_operations(mining_company_id, created_at DESC);

ALTER TABLE public.freight_shipment_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_shipment_preparations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.freight_shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_shipment_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.snp_freight_create_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_freight_create_operations FORCE ROW LEVEL SECURITY;

CREATE POLICY snp_freight_shipment_preparations_read
ON public.freight_shipment_preparations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.freight_shipments parent
    WHERE parent.id = freight_shipment_id
      AND parent.deleted_at IS NULL
      AND public.snp_actor_can_module_action('shipping', 'view')
      AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id)
  )
);
CREATE POLICY snp_freight_shipment_preparations_service
ON public.freight_shipment_preparations
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY snp_freight_shipment_documents_read
ON public.freight_shipment_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.freight_shipments parent
    WHERE parent.id = freight_shipment_id
      AND parent.deleted_at IS NULL
      AND public.snp_actor_can_module_action('shipping', 'view')
      AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id)
  )
);
CREATE POLICY snp_freight_shipment_documents_service
ON public.freight_shipment_documents
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY snp_freight_create_operations_service
ON public.snp_freight_create_operations
FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.freight_shipment_preparations,
  public.freight_shipment_documents,
  public.snp_freight_create_operations
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.freight_shipment_preparations,
  public.freight_shipment_documents TO authenticated;
GRANT ALL ON TABLE public.freight_shipment_preparations,
  public.freight_shipment_documents,
  public.snp_freight_create_operations TO service_role;

CREATE OR REPLACE FUNCTION public.snp_create_freight_shipment_atomic(
  p_idempotency_key uuid,
  p_shipping_preparation_ids uuid[],
  p_shipment_date timestamptz,
  p_destination_refinery_id uuid,
  p_number_of_boxes integer,
  p_box_type text,
  p_gold_price_usd_per_oz numeric,
  p_exchange_rate numeric,
  p_local_currency text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_preparation_ids uuid[];
  v_preparation public.shipping_preparations%ROWTYPE;
  v_existing public.snp_freight_create_operations%ROWTYPE;
  v_shipment public.freight_shipments%ROWTYPE;
  v_company_id uuid;
  v_first_preparation_id uuid;
  v_conflict_id uuid;
  v_preparation_count integer := 0;
  v_item_count integer := 0;
  v_expected_boxes integer := 0;
  v_production_count integer := 0;
  v_signatory_count integer := 0;
  v_document_count integer := 0;
  v_reference_year integer;
  v_reference_sequence integer;
  v_reference text;
  v_expedition_number text;
  v_packing_list_path text;
  v_fingerprint text;
  v_response jsonb;
BEGIN
  IF v_actor IS NULL OR p_idempotency_key IS NULL
     OR p_shipping_preparation_ids IS NULL
     OR cardinality(p_shipping_preparation_ids) = 0
     OR p_shipment_date IS NULL OR p_destination_refinery_id IS NULL THEN
    RAISE EXCEPTION
      'Authentication, idempotency key, preparations, shipment date and refinery are required.'
      USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_shipping_preparation_ids) > 100 THEN
    RAISE EXCEPTION 'A freight shipment cannot contain more than 100 preparations.'
      USING ERRCODE = '22023';
  END IF;
  IF p_number_of_boxes IS NULL OR p_number_of_boxes <= 0
     OR length(trim(coalesce(p_box_type, ''))) NOT BETWEEN 1 AND 100
     OR p_gold_price_usd_per_oz IS NULL OR p_gold_price_usd_per_oz <= 0
     OR p_gold_price_usd_per_oz::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_exchange_rate IS NULL OR p_exchange_rate <= 0
     OR p_exchange_rate::text IN ('NaN', 'Infinity', '-Infinity')
     OR upper(trim(coalesce(p_local_currency, ''))) !~ '^[A-Z]{3}$'
     OR length(coalesce(p_notes, '')) > 5000 THEN
    RAISE EXCEPTION 'Invalid freight commercial or logistics values.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Strong authentication is required to create a freight shipment.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_can_module_action('shipping', 'create') THEN
    RAISE EXCEPTION 'The effective Shipping permission does not allow creation.'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.snp_require_capability('freight.prepare');

  SELECT array_agg(source_id ORDER BY source_id)
  INTO v_preparation_ids
  FROM (
    SELECT DISTINCT source_id
    FROM unnest(p_shipping_preparation_ids) AS requested(source_id)
    WHERE source_id IS NOT NULL
  ) canonical;

  IF v_preparation_ids IS NULL
     OR cardinality(v_preparation_ids) <> cardinality(p_shipping_preparation_ids) THEN
    RAISE EXCEPTION 'Preparation identifiers must be non-null and unique.'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := md5(jsonb_build_object(
    'preparation_ids', to_jsonb(v_preparation_ids),
    'shipment_date_utc', to_char(
      p_shipment_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'
    ),
    'destination_refinery_id', p_destination_refinery_id,
    'number_of_boxes', p_number_of_boxes,
    'box_type', trim(p_box_type),
    'gold_price_usd_per_oz', p_gold_price_usd_per_oz,
    'exchange_rate', p_exchange_rate,
    'local_currency', upper(trim(p_local_currency)),
    'notes', nullif(trim(coalesce(p_notes, '')), '')
  )::text);

  -- Serialise strictement deux appels concurrents portant la meme cle.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('snp-freight-create:' || p_idempotency_key::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.snp_freight_create_operations operation
  WHERE operation.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.actor_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'This idempotency key belongs to another actor.'
        USING ERRCODE = '42501';
    END IF;
    IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'This idempotency key is already bound to another request.'
        USING ERRCODE = '23505';
    END IF;
    PERFORM public.snp_fret_exiger_portee(
      v_existing.mining_company_id, 'freight.prepare'
    );
    IF v_existing.response IS NULL OR v_existing.completed_at IS NULL THEN
      RAISE EXCEPTION 'The idempotent freight operation is incomplete; retry.'
        USING ERRCODE = '40001';
    END IF;
    RETURN v_existing.response || jsonb_build_object('replayed', true);
  END IF;

  PERFORM 1
  FROM public.refineries refinery
  WHERE refinery.id = p_destination_refinery_id
    AND coalesce(refinery.is_active, true)
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The destination refinery is missing or inactive.'
      USING ERRCODE = '23503';
  END IF;

  -- Ordre UUID stable : deux transactions sur les memes lots prennent les
  -- verrous dans le meme ordre et ne peuvent ni se doubler ni s'interbloquer.
  FOR v_preparation IN
    SELECT preparation.*
    FROM public.shipping_preparations preparation
    WHERE preparation.id = ANY(v_preparation_ids)
    ORDER BY preparation.id
    FOR UPDATE
  LOOP
    v_preparation_count := v_preparation_count + 1;
    IF v_preparation.status::text <> 'ready_for_expedition' THEN
      RAISE EXCEPTION 'Preparation % is not ready for freight.', v_preparation.id
        USING ERRCODE = '23514';
    END IF;
    IF v_preparation.mining_company_id IS NULL THEN
      RAISE EXCEPTION 'Preparation % has no mining company.', v_preparation.id
        USING ERRCODE = '23514';
    END IF;
    IF v_company_id IS NULL THEN
      v_company_id := v_preparation.mining_company_id;
      v_first_preparation_id := v_preparation.id;
    ELSIF v_preparation.mining_company_id IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'All freight preparations must belong to the same mining company.'
        USING ERRCODE = '42501';
    END IF;
    IF v_preparation.refinery_id IS NOT NULL
       AND v_preparation.refinery_id IS DISTINCT FROM p_destination_refinery_id THEN
      RAISE EXCEPTION 'Preparation % targets another refinery.', v_preparation.id
        USING ERRCODE = '23514';
    END IF;
    IF length(trim(coalesce(v_preparation.expedition_lot_number, ''))) = 0 THEN
      RAISE EXCEPTION 'Preparation % has no expedition lot number.', v_preparation.id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  IF v_preparation_count <> cardinality(v_preparation_ids) THEN
    RAISE EXCEPTION 'At least one freight preparation does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.snp_fret_exiger_portee(v_company_id, 'freight.prepare');

  SELECT association.shipping_preparation_id
  INTO v_conflict_id
  FROM public.freight_shipment_preparations association
  WHERE association.shipping_preparation_id = ANY(v_preparation_ids)
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Preparation % already belongs to a freight shipment.', v_conflict_id
      USING ERRCODE = '23505';
  END IF;

  -- Verrouille les instantanes source avant tout controle de quantite.
  PERFORM item.id
  FROM public.shipping_production_items item
  WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
  ORDER BY item.id
  FOR UPDATE;
  GET DIAGNOSTICS v_item_count = ROW_COUNT;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'A freight shipment requires at least one production item.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM production.id
  FROM public.daily_production production
  WHERE production.id IN (
    SELECT item.daily_production_id
    FROM public.shipping_production_items item
    WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
  )
  ORDER BY production.id
  FOR UPDATE;

  -- Si une production a ete repartie entre plusieurs preparations, elles
  -- doivent toutes etre selectionnees dans le meme fret. Sinon la contrainte
  -- globale production -> fret laisserait un reliquat impossible a expedier.
  SELECT sibling.shipping_preparation_id
  INTO v_conflict_id
  FROM public.shipping_production_items selected
  JOIN public.shipping_production_items sibling
    ON sibling.daily_production_id = selected.daily_production_id
  WHERE selected.shipping_preparation_id = ANY(v_preparation_ids)
    AND NOT (sibling.shipping_preparation_id = ANY(v_preparation_ids))
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION
      'All preparations sharing a selected production must be included (missing preparation %).',
      v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  SELECT item.id
  INTO v_conflict_id
  FROM public.shipping_production_items item
  WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
    AND (
      item.net_weight_grams <= 0
      OR item.gross_weight_grams < item.net_weight_grams
      OR item.fineness_pct <= 0 OR item.fineness_pct > 100
      OR item.pure_gold_grams <= 0
      OR item.pure_gold_grams > item.net_weight_grams
      OR abs(
        item.pure_gold_grams
        - item.net_weight_grams * item.fineness_pct / 100
      ) > greatest(0.01::numeric, item.net_weight_grams * 0.001::numeric)
    )
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Production item % contains inconsistent quantities.', v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  SELECT source.production_id
  INTO v_conflict_id
  FROM (
    SELECT item.daily_production_id AS production_id,
           sum(item.net_weight_grams) AS net_grams,
           sum(item.pure_gold_grams) AS pure_grams
    FROM public.shipping_production_items item
    WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
    GROUP BY item.daily_production_id
  ) source
  JOIN public.daily_production production ON production.id = source.production_id
  WHERE production.mining_company_id IS DISTINCT FROM v_company_id
     OR production.status::text <> 'ready_for_customs'
     OR source.net_grams > production.bullion_grams + 0.01::numeric
     OR source.pure_grams > coalesce(
       production.pure_gold_grams,
       production.bullion_grams * production.estimated_fineness_pct / 100
     ) + 0.01::numeric
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Production % is out of scope, not ready, or exceeds its authoritative quantity.',
      v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  SELECT linked.production_id
  INTO v_conflict_id
  FROM public.freight_shipment_productions linked
  WHERE linked.production_id IN (
    SELECT item.daily_production_id
    FROM public.shipping_production_items item
    WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
  )
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Production % already belongs to a freight shipment.', v_conflict_id
      USING ERRCODE = '23505';
  END IF;

  -- Les totaux de preparation doivent concorder avec le detail verrouille.
  SELECT preparation.id
  INTO v_conflict_id
  FROM public.shipping_preparations preparation
  JOIN (
    SELECT item.shipping_preparation_id,
           sum(item.net_weight_grams) AS net_grams,
           sum(item.gross_weight_grams) AS gross_grams,
           count(DISTINCT item.ingot_box_number)::integer AS boxes
    FROM public.shipping_production_items item
    WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
    GROUP BY item.shipping_preparation_id
  ) detail ON detail.shipping_preparation_id = preparation.id
  WHERE preparation.total_net_weight_grams IS NULL
     OR preparation.total_gross_weight_grams IS NULL
     OR preparation.total_boxes IS NULL
     OR abs(preparation.total_net_weight_grams - detail.net_grams) > 0.01::numeric
     OR abs(preparation.total_gross_weight_grams - detail.gross_grams) > 0.01::numeric
     OR preparation.total_boxes <> detail.boxes
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Preparation % totals do not match its production items.', v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  SELECT count(DISTINCT (item.shipping_preparation_id, item.ingot_box_number))::integer
  INTO v_expected_boxes
  FROM public.shipping_production_items item
  WHERE item.shipping_preparation_id = ANY(v_preparation_ids);
  IF p_number_of_boxes <> v_expected_boxes THEN
    RAISE EXCEPTION 'The freight box count must equal the % authoritative boxes.',
      v_expected_boxes USING ERRCODE = '23514';
  END IF;

  SELECT preparation.id
  INTO v_conflict_id
  FROM public.shipping_preparations preparation
  WHERE preparation.id = ANY(v_preparation_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.shipping_signatories signatory
      WHERE signatory.shipping_preparation_id = preparation.id
    )
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Preparation % has no signatory.', v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  SELECT signatory.id
  INTO v_conflict_id
  FROM public.shipping_signatories signatory
  WHERE signatory.shipping_preparation_id = ANY(v_preparation_ids)
    AND (
      length(trim(coalesce(signatory.position, ''))) NOT BETWEEN 1 AND 300
      OR length(trim(coalesce(signatory.name, ''))) NOT BETWEEN 1 AND 300
    )
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Signatory % is incomplete.', v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  SELECT document.id
  INTO v_conflict_id
  FROM public.shipping_documents document
  WHERE document.shipping_preparation_id = ANY(v_preparation_ids)
    AND (
      length(trim(coalesce(document.title, ''))) NOT BETWEEN 1 AND 300
      OR length(trim(coalesce(document.document_url, ''))) NOT BETWEEN 1 AND 2048
      OR length(trim(coalesce(document.file_name, ''))) NOT BETWEEN 1 AND 255
      OR document.file_size < 0
    )
  LIMIT 1;
  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Shipping document % contains invalid metadata.', v_conflict_id
      USING ERRCODE = '23514';
  END IF;

  PERFORM signatory.id
  FROM public.shipping_signatories signatory
  WHERE signatory.shipping_preparation_id = ANY(v_preparation_ids)
  ORDER BY signatory.id
  FOR SHARE;
  PERFORM document.id
  FROM public.shipping_documents document
  WHERE document.shipping_preparation_id = ANY(v_preparation_ids)
  ORDER BY document.id
  FOR SHARE;

  INSERT INTO public.snp_freight_create_operations(
    idempotency_key, actor_id, mining_company_id, request_fingerprint
  ) VALUES (
    p_idempotency_key, v_actor, v_company_id, v_fingerprint
  );

  v_reference_year := extract(year FROM p_shipment_date AT TIME ZONE 'UTC')::integer;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('snp-freight-reference:' || v_reference_year::text, 0)
  );
  SELECT coalesce(max((substring(
           shipment.reference_number
           FROM '^HUM-SMK-([0-9]+)/'
         ))::integer), 0) + 1
  INTO v_reference_sequence
  FROM public.freight_shipments shipment
  WHERE shipment.reference_number ~ (
    '^HUM-SMK-[0-9]+/' || v_reference_year::text || '$'
  );
  v_reference := 'HUM-SMK-' || lpad(v_reference_sequence::text, 3, '0')
    || '/' || v_reference_year::text;

  SELECT string_agg(preparation.expedition_lot_number, ', ' ORDER BY preparation.id)
  INTO v_expedition_number
  FROM public.shipping_preparations preparation
  WHERE preparation.id = ANY(v_preparation_ids);
  SELECT preparation.packing_list_url
  INTO v_packing_list_path
  FROM public.shipping_preparations preparation
  WHERE preparation.id = v_first_preparation_id;

  INSERT INTO public.freight_shipments(
    reference_number, status, shipment_date, destination_refinery_id,
    number_of_boxes, box_type, gold_price_usd_per_oz, exchange_rate,
    local_currency, notes, shipping_preparation_id, mining_company_id,
    expedition_number, packing_list_pdf_path, created_by
  ) VALUES (
    v_reference, 'pending'::public.freight_shipment_status, p_shipment_date,
    p_destination_refinery_id, p_number_of_boxes, trim(p_box_type),
    p_gold_price_usd_per_oz, p_exchange_rate, upper(trim(p_local_currency)),
    nullif(trim(coalesce(p_notes, '')), ''), v_first_preparation_id,
    v_company_id, v_expedition_number, v_packing_list_path, v_actor
  ) RETURNING * INTO v_shipment;

  INSERT INTO public.freight_shipment_preparations(
    freight_shipment_id, shipping_preparation_id, mining_company_id, created_by
  )
  SELECT v_shipment.id, preparation_id, v_company_id, v_actor
  FROM unnest(v_preparation_ids) AS selected(preparation_id);

  INSERT INTO public.freight_shipment_productions(
    freight_shipment_id, production_id, production_date, bar_reference,
    bullion_grams, estimated_fineness_pct, estimated_silver_pct,
    pure_gold_grams, pure_gold_oz, silver_content_grams, added_by
  )
  SELECT v_shipment.id, source.production_id, production.production_date,
         production.bar_reference, round(source.net_grams, 3),
         round(source.pure_grams / source.net_grams * 100, 2),
         production.estimated_silver_pct, round(source.pure_grams, 3),
         round(source.pure_grams / 31.1034768, 6),
         round(
           source.net_grams * coalesce(production.estimated_silver_pct, 0) / 100,
           3
         ),
         v_actor
  FROM (
    SELECT item.daily_production_id AS production_id,
           sum(item.net_weight_grams) AS net_grams,
           sum(item.pure_gold_grams) AS pure_grams
    FROM public.shipping_production_items item
    WHERE item.shipping_preparation_id = ANY(v_preparation_ids)
    GROUP BY item.daily_production_id
  ) source
  JOIN public.daily_production production ON production.id = source.production_id
  ORDER BY source.production_id;
  GET DIAGNOSTICS v_production_count = ROW_COUNT;

  INSERT INTO public.freight_shipment_signatories(
    freight_shipment_id, position, full_name, display_order,
    signature_data, signed_at, source_shipping_signatory_id
  )
  SELECT v_shipment.id, trim(signatory.position), trim(signatory.name),
         (row_number() OVER (
           ORDER BY array_position(v_preparation_ids, signatory.shipping_preparation_id),
                    coalesce(signatory.order_index, 0), signatory.id
         ) - 1)::integer,
         signatory.signature_data, signatory.signed_at, signatory.id
  FROM public.shipping_signatories signatory
  WHERE signatory.shipping_preparation_id = ANY(v_preparation_ids);
  GET DIAGNOSTICS v_signatory_count = ROW_COUNT;

  INSERT INTO public.freight_shipment_documents(
    freight_shipment_id, source_shipping_document_id, title, document_url,
    file_name, file_size, mime_type, source_uploaded_by, copied_by
  )
  SELECT v_shipment.id, document.id, trim(document.title),
         trim(document.document_url), trim(document.file_name),
         document.file_size, nullif(trim(coalesce(document.mime_type, '')), ''),
         document.uploaded_by, v_actor
  FROM public.shipping_documents document
  WHERE document.shipping_preparation_id = ANY(v_preparation_ids)
  ORDER BY array_position(v_preparation_ids, document.shipping_preparation_id),
           document.created_at, document.id;
  GET DIAGNOSTICS v_document_count = ROW_COUNT;

  IF v_production_count = 0 OR v_signatory_count = 0 THEN
    RAISE EXCEPTION 'Atomic freight creation produced incomplete children.'
      USING ERRCODE = '23514';
  END IF;

  -- Le trigger historique de totalisation a fini de recalculer le parent.
  SELECT * INTO v_shipment
  FROM public.freight_shipments shipment
  WHERE shipment.id = v_shipment.id;

  IF v_shipment.production_count IS DISTINCT FROM v_production_count THEN
    RAISE EXCEPTION 'Freight totals were not calculated consistently.'
      USING ERRCODE = '23514';
  END IF;

  v_response := jsonb_build_object(
    'id', v_shipment.id,
    'reference_number', v_shipment.reference_number,
    'status', v_shipment.status,
    'mining_company_id', v_shipment.mining_company_id,
    'preparation_count', v_preparation_count,
    'production_count', v_production_count,
    'signatory_count', v_signatory_count,
    'document_count', v_document_count,
    'total_bullion_grams', v_shipment.total_bullion_grams,
    'total_pure_gold_grams', v_shipment.total_pure_gold_grams,
    'total_value_usd', v_shipment.total_value_usd,
    'total_value_local', v_shipment.total_value_local,
    'idempotency_key', p_idempotency_key,
    'replayed', false
  );

  PERFORM public.snp_record_workflow_event(
    'freight_shipment', v_shipment.id, 'create-atomic', NULL,
    v_shipment.status::text, 'freight.prepare',
    nullif(trim(coalesce(p_notes, '')), ''),
    jsonb_build_object(
      'request_id', p_idempotency_key,
      'mining_company_id', v_company_id,
      'preparation_ids', to_jsonb(v_preparation_ids),
      'preparation_count', v_preparation_count,
      'production_count', v_production_count,
      'signatory_count', v_signatory_count,
      'document_count', v_document_count,
      'total_bullion_grams', v_shipment.total_bullion_grams,
      'total_pure_gold_grams', v_shipment.total_pure_gold_grams
    )
  );

  UPDATE public.snp_freight_create_operations operation
  SET freight_shipment_id = v_shipment.id,
      response = v_response,
      completed_at = clock_timestamp()
  WHERE operation.idempotency_key = p_idempotency_key;

  RETURN v_response;
END;
$fn$;

-- L'ancien chemin multi-requetes n'a plus le droit de creer un parent ou des
-- enfants. Les mises a jour d'un fret pending restent gouvernees par le lot
-- workflow precedent ; seule la creation devient exclusivement RPC.
REVOKE INSERT ON TABLE public.freight_shipments,
  public.freight_shipment_productions,
  public.freight_shipment_signatories
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_freight_shipment_reference()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.snp_create_freight_shipment_atomic(
  uuid, uuid[], timestamptz, uuid, integer, text, numeric, numeric, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_create_freight_shipment_atomic(
  uuid, uuid[], timestamptz, uuid, integer, text, numeric, numeric, text, text
) TO authenticated;

COMMENT ON FUNCTION public.snp_create_freight_shipment_atomic(
  uuid, uuid[], timestamptz, uuid, integer, text, numeric, numeric, text, text
) IS
  'Creates one freight shipment and immutable preparation, production, signatory and document snapshots in one idempotent, tenant-scoped transaction.';
COMMENT ON TABLE public.freight_shipment_preparations IS
  'Authoritative list of all shipping preparations consumed by one freight shipment.';
COMMENT ON TABLE public.freight_shipment_documents IS
  'Immutable metadata snapshots of the shipping documents consumed during atomic freight creation.';
COMMENT ON TABLE public.snp_freight_create_operations IS
  'Private idempotency ledger for atomic freight creation requests.';

NOTIFY pgrst, 'reload schema';

COMMIT;
