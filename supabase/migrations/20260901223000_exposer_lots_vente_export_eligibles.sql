BEGIN;

-- Read model used by the SONASP export-sale form.  The write-side invariant
-- remains owned by 20260901154000; this migration deliberately does not alter
-- its allocator or triggers.  It only simulates the same capacities so the UI
-- never proposes an acquisition source that the deferred guard will reject.
DO $preflight$
BEGIN
  IF to_regclass('public.snp_export_sale_inventory_allocations') IS NULL
     OR to_regclass('public.snp_export_sale_physical_backing_gaps') IS NULL
     OR to_regclass('public.snp_rpc_execution_allowlist') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR to_regprocedure('public.snp_session_est_active()') IS NULL THEN
    RAISE EXCEPTION
      'Eligible export-sale lots preflight failed: the physical backing and IAM contracts are required.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.snp_lots_vente_export_eligibles()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','storage','extensions','pg_temp'
AS $fn$
DECLARE
  v_purchase record;
  v_path record;
  v_source_remaining numeric;
  v_source_initial numeric;
  v_inventory_remaining numeric;
  v_purchase_production_remaining numeric;
  v_freight_production_remaining numeric;
  v_take numeric;
  v_available numeric;
  v_gap_count bigint;
  v_excluded_count bigint;
  v_excluded_quantity numeric;
  v_lots jsonb := '[]'::jsonb;
  v_epsilon constant numeric := 0.000001;
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(auth.role(),'') <> 'authenticated'
     OR NOT public.snp_session_est_active()
     OR NOT public.snp_actor_can_module_action('sales','view')
     OR NOT public.snp_actor_can_module_action('sales','create') THEN
    RAISE EXCEPTION 'Vous n’êtes pas habilité à préparer une vente export.'
      USING ERRCODE='42501';
  END IF;

  -- The write guard serializes on this same key.  A read therefore observes a
  -- coherent physical balance and never races an allocation/reserve transfer.
  PERFORM pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'));

  SELECT count(*) INTO v_gap_count
  FROM public.snp_export_sale_physical_backing_gaps gap
  WHERE gap.resolution='blocked';

  -- Artisan and comptoir acquisitions are intentionally summarized only.
  -- Their identifiers, counterparties and documents are not exposed because
  -- no authoritative production-to-freight provenance exists for them yet.
  SELECT count(*),coalesce(sum(source.available_oz),0)
  INTO v_excluded_count,v_excluded_quantity
  FROM (
    SELECT purchase.id,
      greatest(0,purchase.quantite_grammes/31.1034768-coalesce(used.quantity_oz,0)) AS available_oz
    FROM public.snp_artisan_ventes_or purchase
    LEFT JOIN (
      SELECT lot.artisan_vente_id,sum(lot.quantite_oz) AS quantity_oz
      FROM public.snp_ventes_lots lot
      WHERE lot.released_at IS NULL AND lot.artisan_vente_id IS NOT NULL
      GROUP BY lot.artisan_vente_id
    ) used ON used.artisan_vente_id=purchase.id
    WHERE purchase.statut IN('validee','payee')
      AND purchase.comptoir_organization_id IS NULL
    UNION ALL
    SELECT cession.id,
      greatest(0,cession.quantity_grams/31.1034768-coalesce(used.quantity_oz,0)) AS available_oz
    FROM public.snp_comptoir_ventes_sonasp cession
    LEFT JOIN (
      SELECT lot.comptoir_cession_id,sum(lot.quantite_oz) AS quantity_oz
      FROM public.snp_ventes_lots lot
      WHERE lot.released_at IS NULL AND lot.comptoir_cession_id IS NOT NULL
      GROUP BY lot.comptoir_cession_id
    ) used ON used.comptoir_cession_id=cession.id
    WHERE cession.status IN('accepted','paid')
  ) source
  WHERE source.available_oz>v_epsilon;

  -- Existing unresolved sales make every new sale fail in the P0 guard.  The
  -- RPC mirrors that fail-closed state and returns aggregate diagnostics only.
  IF v_gap_count>0 THEN
    RETURN jsonb_build_object(
      'lots','[]'::jsonb,
      'diagnostic',jsonb_build_object(
        'blocked',true,
        'code','historical_physical_backing_gaps',
        'historical_gap_count',v_gap_count,
        'excluded_untraceable_source_count',v_excluded_count,
        'excluded_untraceable_quantity_oz',round(v_excluded_quantity,6)
      )
    );
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.snp_sale_inventory_capacity(
    inventory_id uuid PRIMARY KEY,
    remaining_oz numeric NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.snp_sale_purchase_production_capacity(
    achat_id uuid NOT NULL,
    production_id uuid NOT NULL,
    remaining_oz numeric NOT NULL,
    PRIMARY KEY(achat_id,production_id)
  ) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.snp_sale_freight_production_capacity(
    inventory_id uuid NOT NULL,
    production_id uuid NOT NULL,
    remaining_oz numeric NOT NULL,
    PRIMARY KEY(inventory_id,production_id)
  ) ON COMMIT DROP;

  TRUNCATE pg_temp.snp_sale_inventory_capacity,
    pg_temp.snp_sale_purchase_production_capacity,
    pg_temp.snp_sale_freight_production_capacity;

  INSERT INTO pg_temp.snp_sale_inventory_capacity(inventory_id,remaining_oz)
  SELECT inventory.id,greatest(0,inventory.quantity_available_oz)
  FROM public.gold_inventory inventory
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
    AND NOT EXISTS(
      SELECT 1 FROM public.reserve_allocation_items reserved
      WHERE reserved.inventory_id=inventory.id AND reserved.released_at IS NULL
    );

  INSERT INTO pg_temp.snp_sale_purchase_production_capacity(
    achat_id,production_id,remaining_oz
  )
  SELECT allocation.achat_id,allocation.production_id,
    greatest(0,allocation.quantite_oz-coalesce(
      sum(used.allocated_quantity_oz) FILTER (WHERE used_lot.id IS NOT NULL),0
    ))
  FROM public.snp_achats_productions allocation
  LEFT JOIN public.snp_export_sale_inventory_allocations used
    ON used.production_id=allocation.production_id
   AND used.state IN('allocated','sold')
  LEFT JOIN public.snp_ventes_lots used_lot
    ON used_lot.id=used.sale_lot_id
   AND used_lot.achat_mine_id=allocation.achat_id
  GROUP BY allocation.achat_id,allocation.production_id,allocation.quantite_oz;

  INSERT INTO pg_temp.snp_sale_freight_production_capacity(
    inventory_id,production_id,remaining_oz
  )
  SELECT inventory.id,shipment_production.production_id,
    greatest(0,shipment_production.pure_gold_oz-coalesce(sum(used.allocated_quantity_oz),0))
  FROM public.freight_shipment_productions shipment_production
  JOIN public.gold_inventory inventory
    ON inventory.freight_shipment_id=shipment_production.freight_shipment_id
  JOIN pg_temp.snp_sale_inventory_capacity inventory_capacity
    ON inventory_capacity.inventory_id=inventory.id
  LEFT JOIN public.snp_export_sale_inventory_allocations used
    ON used.inventory_id=inventory.id
   AND used.production_id=shipment_production.production_id
   AND used.state IN('allocated','sold')
  WHERE shipment_production.pure_gold_oz>0
  GROUP BY inventory.id,shipment_production.production_id,
    shipment_production.pure_gold_oz;

  -- Allocate virtual capacities in the same business FIFO displayed by the
  -- form.  Shared inventory is decremented once, so the sum of returned lots
  -- is itself physically achievable rather than a sum of independent maxima.
  FOR v_purchase IN
    SELECT purchase.id,purchase.numero_achat,purchase.date_achat,
      purchase.mining_company_id,
      purchase.quantite_oz,company.name AS company_name,
      greatest(0,purchase.quantite_oz-coalesce(used.quantity_oz,0)) AS source_remaining
    FROM public.snp_achats_mines purchase
    JOIN public.mining_companies company ON company.id=purchase.mining_company_id
    LEFT JOIN (
      SELECT lot.achat_mine_id,sum(lot.quantite_oz) AS quantity_oz
      FROM public.snp_ventes_lots lot
      WHERE lot.released_at IS NULL AND lot.achat_mine_id IS NOT NULL
      GROUP BY lot.achat_mine_id
    ) used ON used.achat_mine_id=purchase.id
    WHERE purchase.statut IN('validee','payee')
    ORDER BY purchase.date_achat,purchase.numero_achat,purchase.id
  LOOP
    v_source_initial:=v_purchase.source_remaining;
    v_source_remaining:=v_source_initial;

    FOR v_path IN
      SELECT inventory_capacity.inventory_id,allocation.production_id,
        production.production_date,inventory.entry_date
      FROM public.snp_achats_productions allocation
      JOIN public.daily_production production
        ON production.id=allocation.production_id
       AND production.mining_company_id=v_purchase.mining_company_id
       AND production.status::text<>'cancelled'
      JOIN pg_temp.snp_sale_purchase_production_capacity purchase_capacity
        ON purchase_capacity.achat_id=allocation.achat_id
       AND purchase_capacity.production_id=allocation.production_id
       AND purchase_capacity.remaining_oz>v_epsilon
      JOIN pg_temp.snp_sale_freight_production_capacity freight_capacity
        ON freight_capacity.production_id=allocation.production_id
       AND freight_capacity.remaining_oz>v_epsilon
      JOIN pg_temp.snp_sale_inventory_capacity inventory_capacity
        ON inventory_capacity.inventory_id=freight_capacity.inventory_id
       AND inventory_capacity.remaining_oz>v_epsilon
      JOIN public.gold_inventory inventory
        ON inventory.id=inventory_capacity.inventory_id
       AND inventory.mining_company_id=v_purchase.mining_company_id
      WHERE allocation.achat_id=v_purchase.id
      ORDER BY production.production_date,inventory.entry_date,
        allocation.production_id,inventory_capacity.inventory_id
    LOOP
      EXIT WHEN v_source_remaining<=v_epsilon;

      SELECT remaining_oz INTO v_inventory_remaining
      FROM pg_temp.snp_sale_inventory_capacity
      WHERE inventory_id=v_path.inventory_id;
      SELECT remaining_oz INTO v_purchase_production_remaining
      FROM pg_temp.snp_sale_purchase_production_capacity
      WHERE achat_id=v_purchase.id AND production_id=v_path.production_id;
      SELECT remaining_oz INTO v_freight_production_remaining
      FROM pg_temp.snp_sale_freight_production_capacity
      WHERE inventory_id=v_path.inventory_id AND production_id=v_path.production_id;

      v_take:=round(least(
        v_source_remaining,v_inventory_remaining,
        v_purchase_production_remaining,v_freight_production_remaining
      ),6);
      IF v_take<=v_epsilon THEN CONTINUE; END IF;

      UPDATE pg_temp.snp_sale_inventory_capacity
      SET remaining_oz=remaining_oz-v_take
      WHERE inventory_id=v_path.inventory_id;
      UPDATE pg_temp.snp_sale_purchase_production_capacity
      SET remaining_oz=remaining_oz-v_take
      WHERE achat_id=v_purchase.id AND production_id=v_path.production_id;
      UPDATE pg_temp.snp_sale_freight_production_capacity
      SET remaining_oz=remaining_oz-v_take
      WHERE inventory_id=v_path.inventory_id AND production_id=v_path.production_id;
      v_source_remaining:=v_source_remaining-v_take;
    END LOOP;

    v_available:=round(v_source_initial-v_source_remaining,6);
    IF v_available>v_epsilon THEN
      v_lots:=v_lots||jsonb_build_array(jsonb_build_object(
        'source_type','achat_mine',
        'source_id',v_purchase.id,
        'reference',coalesce(nullif(v_purchase.numero_achat,''),'Achat sans numéro'),
        'origine',v_purchase.company_name,
        'date',v_purchase.date_achat,
        'quantite_oz',round(v_purchase.quantite_oz,6),
        'affectee_oz',round(v_purchase.quantite_oz-v_source_initial,6),
        'disponible_oz',v_available
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'lots',v_lots,
    'diagnostic',jsonb_build_object(
      'blocked',false,
      'code',NULL,
      'historical_gap_count',0,
      'excluded_untraceable_source_count',v_excluded_count,
      'excluded_untraceable_quantity_oz',round(v_excluded_quantity,6)
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_lots_vente_export_eligibles()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_lots_vente_export_eligibles()
  TO authenticated;

INSERT INTO public.snp_rpc_execution_allowlist(
  function_signature,function_name,grantee,purpose,migration_version
) VALUES(
  'snp_lots_vente_export_eligibles()','snp_lots_vente_export_eligibles',
  'authenticated','runtime-browser','20260901223000'
)
ON CONFLICT(function_signature,grantee) DO UPDATE SET
  function_name=excluded.function_name,
  purpose=excluded.purpose,
  migration_version=excluded.migration_version;

COMMENT ON FUNCTION public.snp_lots_vente_export_eligibles() IS
  'Returns only mine-purchase lots backed by an exact purchase-production-in-stock-freight-inventory path; diagnostics are aggregate and fail closed.';

DO $postflight$
BEGIN
  IF NOT has_function_privilege(
       'authenticated','public.snp_lots_vente_export_eligibles()','EXECUTE'
     )
     OR has_function_privilege(
       'anon','public.snp_lots_vente_export_eligibles()','EXECUTE'
     )
     OR has_function_privilege(
       'service_role','public.snp_lots_vente_export_eligibles()','EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Eligible export-sale lots postflight failed: RPC grants are unsafe.';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.snp_rpc_execution_allowlist allowlist
    WHERE allowlist.function_signature='snp_lots_vente_export_eligibles()'
      AND allowlist.grantee='authenticated'
      AND allowlist.purpose='runtime-browser'
  ) THEN
    RAISE EXCEPTION 'Eligible export-sale lots postflight failed: RPC is not allowlisted.';
  END IF;
END;
$postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
