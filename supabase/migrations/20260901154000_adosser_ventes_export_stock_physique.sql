BEGIN;

-- A sale lot proves the acquisition source.  This second ledger proves which
-- physical, refined and stocked asset actually backs that lot.  Counters on
-- gold_inventory remain the materialized balance used by stock/reserve views.
DO $preflight$
BEGIN
  IF to_regclass('public.sales') IS NULL
     OR to_regclass('public.snp_ventes_lots') IS NULL
     OR to_regclass('public.gold_inventory') IS NULL
     OR to_regclass('public.freight_shipments') IS NULL
     OR to_regclass('public.freight_shipment_productions') IS NULL
     OR to_regclass('public.snp_achats_productions') IS NULL
     OR to_regclass('public.daily_production') IS NULL
     OR to_regclass('public.reserve_allocation_items') IS NULL THEN
    RAISE EXCEPTION 'Export physical-stock preflight failed: a required ledger is missing.';
  END IF;
  IF to_regclass('public.snp_export_sale_inventory_allocations') IS NOT NULL
     OR to_regclass('public.snp_export_sale_physical_backing_gaps') IS NOT NULL THEN
    RAISE EXCEPTION 'Export physical-stock migration is already applied; refusing a partial replay.';
  END IF;
END;
$preflight$;

CREATE TABLE public.snp_export_sale_inventory_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  sale_lot_id uuid NOT NULL REFERENCES public.snp_ventes_lots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  inventory_id uuid NOT NULL REFERENCES public.gold_inventory(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  production_id uuid NOT NULL REFERENCES public.daily_production(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  allocated_quantity_oz numeric(18,6) NOT NULL CHECK (allocated_quantity_oz > 0),
  state text NOT NULL DEFAULT 'allocated' CHECK (state IN ('allocated','sold','released')),
  allocated_by uuid REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  allocated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sold_at timestamptz,
  released_at timestamptz,
  release_reason text,
  CONSTRAINT snp_export_sale_inventory_state_check CHECK (
    (state='allocated' AND sold_at IS NULL AND released_at IS NULL)
    OR (state='sold' AND sold_at IS NOT NULL AND released_at IS NULL)
    OR (state='released' AND sold_at IS NULL AND released_at IS NOT NULL)
  )
);

CREATE INDEX idx_snp_export_sale_inventory_lot_asset_active
  ON public.snp_export_sale_inventory_allocations(sale_lot_id,inventory_id)
  WHERE state IN ('allocated','sold');
CREATE INDEX idx_snp_export_sale_inventory_sale_state
  ON public.snp_export_sale_inventory_allocations(sale_id,state,inventory_id);
CREATE INDEX idx_snp_export_sale_inventory_asset_state
  ON public.snp_export_sale_inventory_allocations(inventory_id,state,sale_id);
CREATE INDEX idx_snp_export_sale_inventory_production_state
  ON public.snp_export_sale_inventory_allocations(production_id,state,sale_id);

ALTER TABLE public.snp_export_sale_inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_export_sale_inventory_allocations FORCE ROW LEVEL SECURITY;

CREATE POLICY snp_export_sale_inventory_read
ON public.snp_export_sale_inventory_allocations
FOR SELECT TO authenticated
USING (public.snp_peut_consulter_vente(sale_id));

REVOKE ALL ON TABLE public.snp_export_sale_inventory_allocations
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.snp_export_sale_inventory_allocations TO authenticated;

COMMENT ON TABLE public.snp_export_sale_inventory_allocations IS
  'Append-only material allocation ledger linking an export sale acquisition lot to refined gold received through freight.';

-- Existing sales are never guessed onto a physical asset.  They are recorded
-- as fail-closed remediation items and must be backed through the same exact
-- provenance path before new sales or reserve allocations can proceed.
CREATE TABLE public.snp_export_sale_physical_backing_gaps (
  sale_id uuid PRIMARY KEY REFERENCES public.sales(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  sale_number text NOT NULL,
  status_snapshot text NOT NULL,
  quantity_oz numeric(18,6) NOT NULL CHECK (quantity_oz>0),
  resolution text NOT NULL DEFAULT 'blocked' CHECK (resolution IN ('blocked','backed')),
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  reason text NOT NULL,
  CONSTRAINT snp_export_sale_physical_gap_resolution_check CHECK (
    (resolution='blocked' AND resolved_at IS NULL)
    OR (resolution='backed' AND resolved_at IS NOT NULL)
  )
);
ALTER TABLE public.snp_export_sale_physical_backing_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_export_sale_physical_backing_gaps FORCE ROW LEVEL SECURITY;
CREATE POLICY snp_export_sale_physical_gaps_read
ON public.snp_export_sale_physical_backing_gaps
FOR SELECT TO authenticated
USING (public.snp_peut_consulter_vente(sale_id));
REVOKE ALL ON TABLE public.snp_export_sale_physical_backing_gaps
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.snp_export_sale_physical_backing_gaps TO authenticated;

INSERT INTO public.snp_export_sale_physical_backing_gaps(
  sale_id,sale_number,status_snapshot,quantity_oz,reason
)
SELECT sale.id,sale.sale_number,sale.status::text,sale.quantity_oz,
  'Historical SONASP export sale created before exact purchase-production-freight-inventory backing was enforced.'
FROM public.sales sale
WHERE sale.seller_type='sonasp'
  AND NOT coalesce(sale.is_internal_sale,false)
  AND sale.status::text NOT IN ('management_rejected','customer_rejected','cancelled');

-- Internal allocator.  The national stock advisory lock is shared with sale
-- lot and reserve workflows; the inventory row lock is the final authority.
CREATE OR REPLACE FUNCTION public.snp_ensure_export_sale_physical_backing(
  p_sale_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_lot record;
  v_inventory record;
  v_lots_total numeric;
  v_lot_backed numeric;
  v_total_backed numeric;
  v_needed numeric;
  v_take numeric;
  v_source_company_id uuid;
  v_inventory_available numeric;
  v_purchase_production_remaining numeric;
  v_freight_production_remaining numeric;
  v_epsilon constant numeric := 0.000001;
BEGIN
  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'A sale identifier is required.' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id=p_sale_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Export sale not found.' USING ERRCODE='P0002';
  END IF;

  -- Mine-portal direct sales use a separate mine-owned stock workflow.  This
  -- invariant protects SONASP export sales backed by the national inventory.
  IF v_sale.seller_type IS DISTINCT FROM 'sonasp'
     OR coalesce(v_sale.is_internal_sale,false) THEN
    RETURN 0;
  END IF;
  IF v_sale.status::text IN ('management_rejected','customer_rejected','cancelled') THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS(
       SELECT 1 FROM public.snp_export_sale_physical_backing_gaps gap
       WHERE gap.sale_id=v_sale.id AND gap.resolution='blocked'
     )
     AND EXISTS(
       SELECT 1 FROM public.snp_export_sale_physical_backing_gaps gap
       WHERE gap.resolution='blocked'
     ) THEN
    RAISE EXCEPTION
      'Historical export sales require physical-backing reconciliation before a new export sale.'
      USING ERRCODE='55000';
  END IF;

  SELECT coalesce(sum(lot.quantite_oz),0)
  INTO v_lots_total
  FROM public.snp_ventes_lots lot
  WHERE lot.sale_id=v_sale.id AND lot.released_at IS NULL;
  IF abs(v_lots_total-v_sale.quantity_oz)>0.001 THEN
    RAISE EXCEPTION 'The export sale is not fully covered by active acquisition lots.'
      USING ERRCODE='23514';
  END IF;

  FOR v_lot IN
    SELECT lot.id,lot.source_type,lot.achat_mine_id,lot.quantite_oz
    FROM public.snp_ventes_lots lot
    WHERE lot.sale_id=v_sale.id AND lot.released_at IS NULL
    ORDER BY CASE WHEN lot.source_type='achat_mine' THEN 0 ELSE 1 END,lot.id
  LOOP
    SELECT coalesce(sum(allocation.allocated_quantity_oz),0)
    INTO v_lot_backed
    FROM public.snp_export_sale_inventory_allocations allocation
    WHERE allocation.sale_lot_id=v_lot.id
      AND allocation.state IN ('allocated','sold');

    IF v_lot_backed>v_lot.quantite_oz+v_epsilon THEN
      RAISE EXCEPTION 'A sale lot has more physical backing than its quantity.'
        USING ERRCODE='23514';
    END IF;
    v_needed:=v_lot.quantite_oz-v_lot_backed;
    IF v_needed<=v_epsilon THEN
      CONTINUE;
    END IF;

    v_source_company_id:=NULL;
    IF v_lot.source_type<>'achat_mine' THEN
      RAISE EXCEPTION
        'This acquisition source has no authoritative production-to-freight provenance and cannot back an export sale.'
        USING ERRCODE='23514';
    END IF;
    SELECT purchase.mining_company_id
    INTO v_source_company_id
    FROM public.snp_achats_mines purchase
    WHERE purchase.id=v_lot.achat_mine_id
      AND purchase.statut IN ('validee','payee');
    IF v_source_company_id IS NULL THEN
      RAISE EXCEPTION 'The mine purchase source is no longer eligible.'
        USING ERRCODE='23514';
    END IF;

    FOR v_inventory IN
      SELECT inventory.id,allocation.production_id,
        allocation.quantite_oz AS purchase_production_oz,
        shipment_production.pure_gold_oz AS freight_production_oz,
        production.production_date
      FROM public.snp_achats_productions allocation
      JOIN public.daily_production production
        ON production.id=allocation.production_id
       AND production.mining_company_id=v_source_company_id
       AND production.status::text<>'cancelled'
      JOIN public.freight_shipment_productions shipment_production
        ON shipment_production.production_id=allocation.production_id
       AND shipment_production.pure_gold_oz>0
      JOIN public.gold_inventory inventory
        ON inventory.freight_shipment_id=shipment_production.freight_shipment_id
      JOIN public.freight_shipments shipment
        ON shipment.id=inventory.freight_shipment_id
       AND shipment.deleted_at IS NULL
       AND shipment.status::text='in_stock'
       AND shipment.mining_company_id IS NOT DISTINCT FROM inventory.mining_company_id
      WHERE inventory.transaction_type::text='entry'
        AND inventory.sale_id IS NULL
        AND inventory.final_fine_oz>0
        AND inventory.quantity_available_oz>v_epsilon
        AND coalesce(inventory.quantity_national_reserve_oz,0)<=v_epsilon
        AND inventory.mining_company_id=v_source_company_id
        AND allocation.achat_id=v_lot.achat_mine_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.reserve_allocation_items reserved
          WHERE reserved.inventory_id=inventory.id
            AND reserved.released_at IS NULL
        )
      ORDER BY production.production_date,inventory.entry_date,
        allocation.production_id,inventory.id
      FOR UPDATE OF inventory
    LOOP
      SELECT inventory.quantity_available_oz
      INTO v_inventory_available
      FROM public.gold_inventory inventory
      WHERE inventory.id=v_inventory.id
      FOR UPDATE;

      SELECT v_inventory.purchase_production_oz-coalesce(sum(used.allocated_quantity_oz),0)
      INTO v_purchase_production_remaining
      FROM public.snp_export_sale_inventory_allocations used
      JOIN public.snp_ventes_lots used_lot ON used_lot.id=used.sale_lot_id
      WHERE used_lot.achat_mine_id=v_lot.achat_mine_id
        AND used.production_id=v_inventory.production_id
        AND used.state IN ('allocated','sold');

      SELECT v_inventory.freight_production_oz-coalesce(sum(used.allocated_quantity_oz),0)
      INTO v_freight_production_remaining
      FROM public.snp_export_sale_inventory_allocations used
      WHERE used.inventory_id=v_inventory.id
        AND used.production_id=v_inventory.production_id
        AND used.state IN ('allocated','sold');

      v_take:=round(least(
        v_needed,v_inventory_available,
        v_purchase_production_remaining,v_freight_production_remaining
      ),6);
      IF v_take<=v_epsilon THEN
        CONTINUE;
      END IF;

      INSERT INTO public.snp_export_sale_inventory_allocations(
        sale_id,sale_lot_id,inventory_id,production_id,
        allocated_quantity_oz,allocated_by
      ) VALUES(
        v_sale.id,v_lot.id,v_inventory.id,v_inventory.production_id,
        v_take,auth.uid()
      );

      UPDATE public.gold_inventory
      SET quantity_available_oz=quantity_available_oz-v_take,
          quantity_allocated_oz=coalesce(quantity_allocated_oz,0)+v_take,
          updated_at=clock_timestamp()
      WHERE id=v_inventory.id;

      v_needed:=v_needed-v_take;
      EXIT WHEN v_needed<=v_epsilon;
    END LOOP;

    IF v_needed>v_epsilon THEN
      RAISE EXCEPTION
        'Insufficient physical refined stock received through freight for export sale % (missing % oz).',
        v_sale.sale_number,round(v_needed,6)
        USING ERRCODE='23514';
    END IF;
  END LOOP;

  SELECT coalesce(sum(allocation.allocated_quantity_oz),0)
  INTO v_total_backed
  FROM public.snp_export_sale_inventory_allocations allocation
  WHERE allocation.sale_id=v_sale.id
    AND allocation.state IN ('allocated','sold');
  IF abs(v_total_backed-v_sale.quantity_oz)>0.001 THEN
    RAISE EXCEPTION 'The export sale physical backing is incomplete.'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.snp_export_sale_physical_backing_gaps
  SET resolution='backed',resolved_at=clock_timestamp()
  WHERE sale_id=v_sale.id AND resolution='blocked';
  RETURN v_total_backed;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_ensure_export_sale_physical_backing(uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_release_export_sale_physical_backing(
  p_sale_id uuid,
  p_reason text
)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_asset record;
  v_released numeric:=0;
  v_current_allocated numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));

  IF EXISTS(
    SELECT 1 FROM public.snp_export_sale_inventory_allocations allocation
    WHERE allocation.sale_id=p_sale_id AND allocation.state='sold'
  ) THEN
    RAISE EXCEPTION 'Physical gold already sold cannot be released.' USING ERRCODE='23514';
  END IF;

  FOR v_asset IN
    SELECT allocation.inventory_id,sum(allocation.allocated_quantity_oz) AS quantity_oz
    FROM public.snp_export_sale_inventory_allocations allocation
    WHERE allocation.sale_id=p_sale_id AND allocation.state='allocated'
    GROUP BY allocation.inventory_id
    ORDER BY allocation.inventory_id
  LOOP
    SELECT coalesce(inventory.quantity_allocated_oz,0)
    INTO v_current_allocated
    FROM public.gold_inventory inventory
    WHERE inventory.id=v_asset.inventory_id
    FOR UPDATE;
    IF NOT FOUND OR v_current_allocated+0.000001<v_asset.quantity_oz THEN
      RAISE EXCEPTION 'Physical allocation ledger and inventory counters diverge.'
        USING ERRCODE='23514';
    END IF;

    UPDATE public.gold_inventory
    SET quantity_available_oz=quantity_available_oz+v_asset.quantity_oz,
        quantity_allocated_oz=greatest(0,coalesce(quantity_allocated_oz,0)-v_asset.quantity_oz),
        updated_at=clock_timestamp()
    WHERE id=v_asset.inventory_id;
    v_released:=v_released+v_asset.quantity_oz;
  END LOOP;

  UPDATE public.snp_export_sale_inventory_allocations
  SET state='released',released_at=clock_timestamp(),
      release_reason=left(coalesce(nullif(btrim(p_reason),''),'sale lifecycle release'),1000)
  WHERE sale_id=p_sale_id AND state='allocated';
  RETURN v_released;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_release_export_sale_physical_backing(uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_mark_export_sale_physical_backing_sold(
  p_sale_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_asset record;
  v_sold numeric:=0;
  v_current_allocated numeric;
BEGIN
  PERFORM public.snp_ensure_export_sale_physical_backing(p_sale_id);
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));

  FOR v_asset IN
    SELECT allocation.inventory_id,sum(allocation.allocated_quantity_oz) AS quantity_oz
    FROM public.snp_export_sale_inventory_allocations allocation
    WHERE allocation.sale_id=p_sale_id AND allocation.state='allocated'
    GROUP BY allocation.inventory_id
    ORDER BY allocation.inventory_id
  LOOP
    SELECT coalesce(inventory.quantity_allocated_oz,0)
    INTO v_current_allocated
    FROM public.gold_inventory inventory
    WHERE inventory.id=v_asset.inventory_id
    FOR UPDATE;
    IF NOT FOUND OR v_current_allocated+0.000001<v_asset.quantity_oz THEN
      RAISE EXCEPTION 'Physical allocation ledger and inventory counters diverge.'
        USING ERRCODE='23514';
    END IF;

    UPDATE public.gold_inventory
    SET quantity_allocated_oz=greatest(0,coalesce(quantity_allocated_oz,0)-v_asset.quantity_oz),
        quantity_sold_oz=coalesce(quantity_sold_oz,0)+v_asset.quantity_oz,
        updated_at=clock_timestamp()
    WHERE id=v_asset.inventory_id;
    v_sold:=v_sold+v_asset.quantity_oz;
  END LOOP;

  UPDATE public.snp_export_sale_inventory_allocations
  SET state='sold',sold_at=clock_timestamp()
  WHERE sale_id=p_sale_id AND state='allocated';

  RETURN v_sold;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_mark_export_sale_physical_backing_sold(uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_sync_export_sale_physical_backing()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_sale_id uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  v_sale_id:=NEW.id;
  IF NEW.seller_type IS DISTINCT FROM 'sonasp'
     OR coalesce(NEW.is_internal_sale,false) THEN
    RETURN NEW;
  END IF;

  -- Les ventes historiques ont été enregistrées avant que la provenance
  -- achat-production-fret-stock soit obligatoire. Leur anomalie reste
  -- explicitement bloquée dans le registre dédié, mais une synchronisation
  -- financière ne doit pas rendre impossible le déploiement ni la tenue des
  -- paiements. Toute modification de quantité ou de nature de vente continue
  -- en revanche à exiger le rapprochement physique exact.
  IF TG_OP='UPDATE'
     AND NEW.seller_type IS NOT DISTINCT FROM OLD.seller_type
     AND NEW.is_internal_sale IS NOT DISTINCT FROM OLD.is_internal_sale
     AND NEW.quantity_oz IS NOT DISTINCT FROM OLD.quantity_oz
     AND EXISTS(
       SELECT 1
       FROM public.snp_export_sale_physical_backing_gaps gap
       WHERE gap.sale_id=v_sale_id AND gap.resolution='blocked'
     ) THEN
    UPDATE public.snp_export_sale_physical_backing_gaps
    SET status_snapshot=NEW.status::text
    WHERE sale_id=v_sale_id AND resolution='blocked';
    RETURN NEW;
  END IF;

  IF NEW.status::text IN ('management_rejected','customer_rejected','cancelled') THEN
    PERFORM public.snp_release_export_sale_physical_backing(
      v_sale_id,'sale status changed to '||NEW.status::text
    );
  ELSIF NEW.status::text IN ('payment_received','completed','sold','paid') THEN
    PERFORM public.snp_mark_export_sale_physical_backing_sold(v_sale_id);
  ELSE
    PERFORM public.snp_ensure_export_sale_physical_backing(v_sale_id);
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_sync_export_sale_physical_backing()
  FROM PUBLIC,anon,authenticated,service_role;

-- Creation is checked at transaction end because the canonical RPC inserts the
-- sale first and its acquisition lots immediately afterwards.
CREATE CONSTRAINT TRIGGER snp_export_sale_physical_backing_deferred
AFTER INSERT OR UPDATE
ON public.sales
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.snp_sync_export_sale_physical_backing();

CREATE OR REPLACE FUNCTION public.snp_sync_export_sale_lot_physical_backing()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_sale_id uuid:=CASE WHEN TG_OP='DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id=v_sale_id;
  IF NOT FOUND OR v_sale.seller_type IS DISTINCT FROM 'sonasp'
     OR coalesce(v_sale.is_internal_sale,false) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF v_sale.status::text IN ('management_rejected','customer_rejected','cancelled') THEN
    PERFORM public.snp_release_export_sale_physical_backing(
      v_sale.id,'acquisition lots released with sale status '||v_sale.status::text
    );
  ELSIF v_sale.status::text IN ('payment_received','completed','sold','paid') THEN
    PERFORM public.snp_mark_export_sale_physical_backing_sold(v_sale.id);
  ELSE
    PERFORM public.snp_ensure_export_sale_physical_backing(v_sale.id);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_sync_export_sale_lot_physical_backing()
  FROM PUBLIC,anon,authenticated,service_role;

-- The trigger function must exist before its trigger.  Recreate the constraint
-- trigger after defining the function (the DROP also keeps the migration safe
-- if an interrupted development database is resumed).
DROP TRIGGER IF EXISTS snp_export_sale_lot_physical_backing_deferred
  ON public.snp_ventes_lots;
CREATE CONSTRAINT TRIGGER snp_export_sale_lot_physical_backing_deferred
AFTER INSERT OR UPDATE OR DELETE
ON public.snp_ventes_lots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.snp_sync_export_sale_lot_physical_backing();

CREATE TRIGGER snp_export_sale_physical_status_sync
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.snp_sync_export_sale_physical_backing();

-- Reserve draft creation and sale allocation now acquire the same advisory
-- lock before inspecting an asset.  This closes the snapshot race where both
-- transactions could otherwise pass their row checks concurrently.
CREATE OR REPLACE FUNCTION public.snp_guard_reserve_allocation_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE v_inventory public.gold_inventory%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));
  IF EXISTS(
    SELECT 1 FROM public.snp_export_sale_physical_backing_gaps gap
    WHERE gap.resolution='blocked'
  ) THEN
    RAISE EXCEPTION
      'Les ventes export historiques doivent être rapprochées du stock physique avant toute nouvelle affectation à la réserve.'
      USING ERRCODE='55000';
  END IF;
  SELECT * INTO v_inventory FROM public.gold_inventory
  WHERE id=NEW.inventory_id FOR UPDATE;
  IF NOT FOUND OR v_inventory.transaction_type<>'entry' OR v_inventory.sale_id IS NOT NULL
     OR v_inventory.final_fine_grams<=0
     OR coalesce(v_inventory.quantity_allocated_oz,0)>0.000001
     OR coalesce(v_inventory.quantity_sold_oz,0)>0.000001
     OR coalesce(v_inventory.quantity_national_reserve_oz,0)>0.000001
     OR v_inventory.quantity_available_oz+0.000001<v_inventory.final_fine_oz THEN
    RAISE EXCEPTION 'Le lingot doit être entièrement libre pour être affecté à la réserve.'
      USING ERRCODE='23514';
  END IF;
  NEW.lot_reference:=coalesce(nullif(v_inventory.certificate_number,''),'LOT-'||upper(left(v_inventory.id::text,8)));
  NEW.ingot_count:=1;
  NEW.gross_weight_grams:=v_inventory.weight_after_melting_grams;
  NEW.fine_weight_grams:=v_inventory.final_fine_grams;
  NEW.fineness_percentage:=v_inventory.fineness_percentage;
  NEW.certificate_number:=v_inventory.certificate_number;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_reserve_allocation_item_guard
  ON public.reserve_allocation_items;
CREATE TRIGGER snp_reserve_allocation_item_guard
BEFORE INSERT OR UPDATE OF
  inventory_id,gross_weight_grams,fine_weight_grams,fineness_percentage,ingot_count
ON public.reserve_allocation_items
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_reserve_allocation_item();

REVOKE ALL ON FUNCTION public.snp_guard_reserve_allocation_item()
  FROM PUBLIC,anon,authenticated,service_role;

DO $postflight$
DECLARE
  v_gap_count bigint;
BEGIN
  IF NOT EXISTS(
       SELECT 1 FROM pg_trigger
       WHERE tgrelid='public.sales'::regclass
         AND tgname='snp_export_sale_physical_backing_deferred'
         AND tgdeferrable AND tginitdeferred AND NOT tgisinternal
     )
     OR NOT EXISTS(
       SELECT 1 FROM pg_trigger
       WHERE tgrelid='public.sales'::regclass
         AND tgname='snp_export_sale_physical_status_sync'
         AND NOT tgisinternal
     )
     OR NOT EXISTS(
       SELECT 1 FROM pg_trigger
       WHERE tgrelid='public.reserve_allocation_items'::regclass
         AND tgname='snp_reserve_allocation_item_guard'
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Export physical-stock postflight failed: sale guards are missing.';
  END IF;
  IF has_function_privilege(
       'authenticated','public.snp_ensure_export_sale_physical_backing(uuid)','EXECUTE'
     )
     OR has_function_privilege(
       'service_role','public.snp_ensure_export_sale_physical_backing(uuid)','EXECUTE'
     )
     OR has_table_privilege(
       'authenticated','public.snp_export_sale_inventory_allocations','INSERT'
     ) THEN
    RAISE EXCEPTION 'Export physical-stock postflight failed: an internal write path is exposed.';
  END IF;
  IF EXISTS(
    SELECT 1
    FROM public.sales sale
    LEFT JOIN public.snp_export_sale_physical_backing_gaps gap ON gap.sale_id=sale.id
    WHERE sale.seller_type='sonasp'
      AND NOT coalesce(sale.is_internal_sale,false)
      AND sale.status::text NOT IN ('management_rejected','customer_rejected','cancelled')
      AND gap.sale_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Export physical-stock postflight failed: an historical sale is not fail-closed.';
  END IF;
  SELECT count(*) INTO v_gap_count
  FROM public.snp_export_sale_physical_backing_gaps
  WHERE resolution='blocked';
  RAISE NOTICE '% historical SONASP export sale(s) require exact physical-backing reconciliation.',v_gap_count;
END;
$postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
