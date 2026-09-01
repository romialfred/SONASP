BEGIN;

-- The historical freight_shipments table pre-dates the capability model. This
-- migration keeps its public contract but makes tenant scope and state changes
-- authoritative at database level.
DO $preflight$
BEGIN
  IF to_regclass('public.freight_shipments') IS NULL
     OR to_regclass('public.shipping_preparations') IS NULL
     OR to_regclass('public.gold_inventory') IS NULL THEN
    RAISE EXCEPTION 'Freight shipment preflight failed: required tables are missing.';
  END IF;
  IF to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_require_capability(text)') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regprocedure('public.snp_fret_peut_consulter_tenant(uuid)') IS NULL
     OR to_regprocedure('public.snp_fret_exiger_portee(uuid,text)') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.snp_mfa_satisfaite()') IS NULL
     OR to_regprocedure('public.snp_role_utilisateur()') IS NULL THEN
    RAISE EXCEPTION 'Freight shipment preflight failed: security helpers are missing.';
  END IF;
END;
$preflight$;

-- Repair the tenant snapshot whenever an authoritative preparation is linked.
UPDATE public.freight_shipments f
SET mining_company_id = s.mining_company_id
FROM public.shipping_preparations s
WHERE f.shipping_preparation_id = s.id
  AND s.mining_company_id IS NOT NULL
  AND f.mining_company_id IS DISTINCT FROM s.mining_company_id;

CREATE OR REPLACE FUNCTION public.snp_guard_freight_shipment()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_company_id uuid;
  v_transition_authorised boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.shipping_preparation_id IS NULL THEN
      RAISE EXCEPTION 'A freight shipment must reference a shipment preparation.'
        USING ERRCODE = '23514';
    END IF;
    SELECT mining_company_id INTO v_company_id
    FROM public.shipping_preparations
    WHERE id = NEW.shipping_preparation_id;
    IF NOT FOUND OR v_company_id IS NULL THEN
      RAISE EXCEPTION 'The shipment preparation is missing or has no mining company.'
        USING ERRCODE = '23503';
    END IF;
    NEW.mining_company_id := v_company_id;
    NEW.created_by := auth.uid();
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    NEW.deleted_at := NULL;
    IF NEW.status::text <> 'pending' THEN
      RAISE EXCEPTION 'A freight shipment must start in pending status.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
     OR NEW.shipping_preparation_id IS DISTINCT FROM OLD.shipping_preparation_id
     OR NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Freight identity, tenant, parent and creator are immutable.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'A deleted freight shipment cannot be restored or changed.'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND OLD.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending freight shipment can be withdrawn.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status::text <> 'pending' AND (
    NEW.shipment_date IS DISTINCT FROM OLD.shipment_date
    OR NEW.destination_refinery_id IS DISTINCT FROM OLD.destination_refinery_id
    OR NEW.number_of_boxes IS DISTINCT FROM OLD.number_of_boxes
    OR NEW.box_type IS DISTINCT FROM OLD.box_type
    OR NEW.gold_price_usd_per_oz IS DISTINCT FROM OLD.gold_price_usd_per_oz
    OR NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate
    OR NEW.local_currency IS DISTINCT FROM OLD.local_currency
    OR NEW.expedition_number IS DISTINCT FROM OLD.expedition_number
  ) THEN
    RAISE EXCEPTION 'Freight commercial, logistics and destination data are immutable after approval.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_transition_authorised :=
      coalesce(current_setting('snp.freight_transition_authorised', true), '') = 'on';

    -- The stock-entry RPC inserts the ledger row before closing the shipment.
    -- It remains the only legitimate non-transition-RPC path to in_stock.
    IF NOT v_transition_authorised
       AND NOT (
         OLD.status::text = 'processed'
         AND NEW.status::text = 'in_stock'
         AND EXISTS (
           SELECT 1 FROM public.gold_inventory gi
           WHERE gi.freight_shipment_id = OLD.id
             AND gi.transaction_type::text = 'entry'
         )
       ) THEN
      RAISE EXCEPTION 'Freight status changes must use the secured transition service.'
        USING ERRCODE = '42501';
    END IF;

    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.shipped_at := OLD.shipped_at;
    NEW.shipped_by := OLD.shipped_by;
    NEW.received_at := OLD.received_at;
    NEW.received_by := OLD.received_by;
    NEW.processing_started_at := OLD.processing_started_at;
    NEW.processing_started_by := OLD.processing_started_by;
    NEW.processed_at := OLD.processed_at;
    NEW.processed_by := OLD.processed_by;
    NEW.stocked_at := OLD.stocked_at;
    NEW.stocked_by := OLD.stocked_by;

    CASE NEW.status::text
      WHEN 'approved' THEN
        NEW.approved_at := clock_timestamp(); NEW.approved_by := auth.uid();
      WHEN 'shipped_to_refinery' THEN
        NEW.shipped_at := clock_timestamp(); NEW.shipped_by := auth.uid();
      WHEN 'received_at_refinery' THEN
        NEW.received_at := clock_timestamp(); NEW.received_by := auth.uid();
      WHEN 'processing' THEN
        NEW.processing_started_at := clock_timestamp(); NEW.processing_started_by := auth.uid();
      WHEN 'processed' THEN
        NEW.processed_at := clock_timestamp(); NEW.processed_by := auth.uid();
      WHEN 'in_stock' THEN
        NEW.stocked_at := clock_timestamp(); NEW.stocked_by := auth.uid();
      ELSE NULL;
    END CASE;
  ELSE
    -- Audit fields cannot be forged by an ordinary metadata update.
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    NEW.shipped_at := OLD.shipped_at;
    NEW.shipped_by := OLD.shipped_by;
    NEW.received_at := OLD.received_at;
    NEW.received_by := OLD.received_by;
    NEW.processing_started_at := OLD.processing_started_at;
    NEW.processing_started_by := OLD.processing_started_by;
    NEW.processed_at := OLD.processed_at;
    NEW.processed_by := OLD.processed_by;
    NEW.stocked_at := OLD.stocked_at;
    NEW.stocked_by := OLD.stocked_by;
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trigger_freight_shipment_updated ON public.freight_shipments;
DROP TRIGGER IF EXISTS snp_guard_freight_shipment ON public.freight_shipments;
CREATE TRIGGER snp_guard_freight_shipment
BEFORE INSERT OR UPDATE ON public.freight_shipments
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_freight_shipment();

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_freight_transition_request
  ON public.snp_workflow_audit ((context ->> 'request_id'))
  WHERE aggregate_type = 'freight_shipment'
    AND action = 'status-transition'
    AND context ? 'request_id';

CREATE OR REPLACE FUNCTION public.snp_transition_freight_shipment(
  p_shipment_id uuid,
  p_expected_status public.freight_shipment_status,
  p_new_status public.freight_shipment_status,
  p_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS public.freight_shipments
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_row public.freight_shipments%ROWTYPE;
  v_existing public.snp_workflow_audit%ROWTYPE;
  v_capability text;
BEGIN
  IF auth.uid() IS NULL OR p_shipment_id IS NULL OR p_expected_status IS NULL
     OR p_new_status IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Authentication, shipment, statuses and request identifier are required.'
      USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_notes, '')) > 5000 THEN
    RAISE EXCEPTION 'Transition notes are too long.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));

  SELECT * INTO v_row FROM public.freight_shipments
  WHERE id = p_shipment_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight shipment not found.' USING ERRCODE = 'P0002';
  END IF;
  v_capability := CASE
    WHEN p_expected_status::text = 'pending' AND p_new_status::text = 'approved'
      THEN 'freight.customs.approve'
    WHEN p_expected_status::text = 'approved' AND p_new_status::text = 'shipped_to_refinery'
      THEN 'freight.transport.dispatch'
    WHEN p_expected_status::text = 'shipped_to_refinery' AND p_new_status::text = 'received_at_refinery'
      THEN 'refining.supervise'
    WHEN p_expected_status::text = 'received_at_refinery' AND p_new_status::text = 'processing'
      THEN 'refining.supervise'
    WHEN p_expected_status::text = 'processing' AND p_new_status::text = 'processed'
      THEN 'refining.supervise'
    ELSE NULL
  END;
  IF v_capability IS NULL THEN
    RAISE EXCEPTION 'This freight status transition is not allowed.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT public.snp_actor_can_module_action('shipping', CASE
    WHEN p_new_status::text = 'approved' THEN 'approve'
    ELSE 'edit'
  END) THEN
    RAISE EXCEPTION 'The effective Shipping module permission does not allow this transition.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Strong authentication is required for this transition.'
      USING ERRCODE = '42501';
  END IF;
  IF v_row.mining_company_id IS NULL THEN
    IF public.snp_role_utilisateur() NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'A legacy shipment without tenant can only be handled by an authorised administrator.'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.snp_require_capability(v_capability);
  ELSE
    PERFORM public.snp_fret_exiger_portee(v_row.mining_company_id, v_capability);
  END IF;

  SELECT * INTO v_existing
  FROM public.snp_workflow_audit audit
  WHERE audit.aggregate_type = 'freight_shipment'
    AND audit.action = 'status-transition'
    AND audit.context ->> 'request_id' = p_request_id::text
  ORDER BY audit.id DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.actor_id IS DISTINCT FROM auth.uid()
       OR v_existing.aggregate_id IS DISTINCT FROM p_shipment_id
       OR v_existing.status_before IS DISTINCT FROM p_expected_status::text
       OR v_existing.status_after IS DISTINCT FROM p_new_status::text THEN
      RAISE EXCEPTION 'The request identifier is already bound to another freight transition.'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_row;
  END IF;

  IF v_row.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'The freight shipment changed. Reload it before continuing.'
      USING ERRCODE = '40001';
  END IF;
  IF p_new_status::text = 'approved' AND v_row.created_by IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The creator of a freight shipment cannot approve it.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('snp.freight_transition_authorised', 'on', true);
  UPDATE public.freight_shipments
  SET status = p_new_status,
      refining_notes = CASE
        WHEN nullif(trim(coalesce(p_notes, '')), '') IS NULL THEN refining_notes
        ELSE concat_ws(E'\n', nullif(trim(coalesce(refining_notes, '')), ''), trim(p_notes))
      END
  WHERE id = p_shipment_id
  RETURNING * INTO v_row;

  PERFORM public.snp_record_workflow_event(
    'freight_shipment', p_shipment_id, 'status-transition',
    p_expected_status::text, p_new_status::text, v_capability,
    nullif(trim(coalesce(p_notes, '')), ''),
    jsonb_build_object(
      'request_id', p_request_id,
      'mining_company_id', v_row.mining_company_id
    )
  );
  RETURN v_row;
END;
$fn$;

ALTER TABLE public.freight_shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view freight shipments" ON public.freight_shipments;
DROP POLICY IF EXISTS "Users can create freight shipments" ON public.freight_shipments;
DROP POLICY IF EXISTS "Users can update freight shipments" ON public.freight_shipments;
DROP POLICY IF EXISTS "Users can delete freight shipments" ON public.freight_shipments;
DROP POLICY IF EXISTS snp_freight_shipments_read ON public.freight_shipments;
DROP POLICY IF EXISTS snp_freight_shipments_insert ON public.freight_shipments;
DROP POLICY IF EXISTS snp_freight_shipments_update ON public.freight_shipments;
DROP POLICY IF EXISTS snp_freight_shipments_service ON public.freight_shipments;

CREATE POLICY snp_freight_shipments_read ON public.freight_shipments
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND public.snp_actor_can_module_action('shipping','view')
  AND (
    public.snp_fret_peut_consulter_tenant(mining_company_id)
    OR (mining_company_id IS NULL AND public.snp_role_utilisateur() IN ('owner','admin'))
  )
);

CREATE POLICY snp_freight_shipments_insert ON public.freight_shipments
FOR INSERT TO authenticated
WITH CHECK (
  deleted_at IS NULL
  AND created_by = auth.uid()
  AND mining_company_id IS NOT NULL
  AND public.snp_actor_has_capability('freight.prepare')
  AND public.snp_actor_can_module_action('shipping','create')
  AND public.snp_fret_peut_consulter_tenant(mining_company_id)
);

CREATE POLICY snp_freight_shipments_update ON public.freight_shipments
FOR UPDATE TO authenticated
USING (
  deleted_at IS NULL
  AND public.snp_actor_has_capability('freight.prepare')
  AND public.snp_actor_can_module_action('shipping','edit')
  AND (
    public.snp_fret_peut_consulter_tenant(mining_company_id)
    OR (mining_company_id IS NULL AND public.snp_role_utilisateur() IN ('owner','admin'))
  )
)
WITH CHECK (
  public.snp_actor_has_capability('freight.prepare')
  AND public.snp_actor_can_module_action('shipping','edit')
  AND (
    public.snp_fret_peut_consulter_tenant(mining_company_id)
    OR (mining_company_id IS NULL AND public.snp_role_utilisateur() IN ('owner','admin'))
  )
);

CREATE POLICY snp_freight_shipments_service ON public.freight_shipments
FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $children$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['freight_shipment_productions','freight_shipment_signatories'] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'Freight child table missing: %', v_table;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY snp_%1$s_read ON public.%1$I FOR SELECT TO authenticated USING (' ||
      'EXISTS (SELECT 1 FROM public.freight_shipments parent WHERE parent.id=freight_shipment_id ' ||
      'AND parent.deleted_at IS NULL AND public.snp_actor_can_module_action(''shipping'',''view'') ' ||
      'AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id)))', v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_%1$s_insert_pending ON public.%1$I FOR INSERT TO authenticated WITH CHECK (' ||
      'EXISTS (SELECT 1 FROM public.freight_shipments parent WHERE parent.id=freight_shipment_id ' ||
      'AND parent.deleted_at IS NULL AND parent.status::text=''pending'' ' ||
      'AND public.snp_actor_has_capability(''freight.prepare'') ' ||
      'AND public.snp_actor_can_module_action(''shipping'',''edit'') ' ||
      'AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id)))', v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_%1$s_update_pending ON public.%1$I FOR UPDATE TO authenticated USING (' ||
      'EXISTS (SELECT 1 FROM public.freight_shipments parent WHERE parent.id=freight_shipment_id ' ||
      'AND parent.deleted_at IS NULL AND parent.status::text=''pending'' ' ||
      'AND public.snp_actor_has_capability(''freight.prepare'') ' ||
      'AND public.snp_actor_can_module_action(''shipping'',''edit'') ' ||
      'AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id))) WITH CHECK (' ||
      'EXISTS (SELECT 1 FROM public.freight_shipments parent WHERE parent.id=freight_shipment_id ' ||
      'AND parent.deleted_at IS NULL AND parent.status::text=''pending'' ' ||
      'AND public.snp_actor_has_capability(''freight.prepare'') ' ||
      'AND public.snp_actor_can_module_action(''shipping'',''edit'') ' ||
      'AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id)))', v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_%1$s_delete_pending ON public.%1$I FOR DELETE TO authenticated USING (' ||
      'EXISTS (SELECT 1 FROM public.freight_shipments parent WHERE parent.id=freight_shipment_id ' ||
      'AND parent.deleted_at IS NULL AND parent.status::text=''pending'' ' ||
      'AND public.snp_actor_has_capability(''freight.prepare'') ' ||
      'AND public.snp_actor_can_module_action(''shipping'',''edit'') ' ||
      'AND public.snp_fret_peut_consulter_tenant(parent.mining_company_id)))', v_table
    );
    EXECUTE format(
      'CREATE POLICY snp_%1$s_service ON public.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      v_table
    );
  END LOOP;
END;
$children$;

REVOKE ALL ON FUNCTION public.snp_guard_freight_shipment() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_transition_freight_shipment(
  uuid,public.freight_shipment_status,public.freight_shipment_status,uuid,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_transition_freight_shipment(
  uuid,public.freight_shipment_status,public.freight_shipment_status,uuid,text
) TO authenticated,service_role;

COMMIT;
