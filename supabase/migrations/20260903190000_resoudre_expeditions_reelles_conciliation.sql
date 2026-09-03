-- Conciliation : resolve the real logistics chain of an export sale.
--
-- A sale can be backed by several refined inventory allocations. In that case
-- sales.shipping_preparation_id is intentionally NULL: the authoritative path
-- is sale -> allocation -> inventory -> freight -> production -> preparation.
-- Treating the nullable legacy shortcut as the only relationship produced a
-- false "shipment missing" warning and hid approved refinery results.
--
-- Rollback: supabase/rollback/20260903190000_resoudre_expeditions_reelles_conciliation.sql

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.sales') IS NULL
     OR to_regclass('public.shipping_preparations') IS NULL
     OR to_regclass('public.shipping_production_items') IS NULL
     OR to_regclass('public.freight_shipments') IS NULL
     OR to_regclass('public.freight_shipment_productions') IS NULL
     OR to_regclass('public.freight_shipment_preparations') IS NULL
     OR to_regclass('public.gold_inventory') IS NULL
     OR to_regclass('public.snp_export_sale_inventory_allocations') IS NULL
     OR to_regclass('public.refining_records') IS NULL
     OR to_regclass('public.refineries') IS NULL
     OR to_regprocedure('public.snp_can_read_reconciliation_scope(uuid)') IS NULL
     OR to_regprocedure('public.snp_peut_consulter_vente(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Conciliation logistics preflight failed: a required relation or security helper is missing.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.snp_conciliation_expeditions_vente(
  p_sale_id uuid
)
RETURNS TABLE (
  shipping_preparation_id uuid,
  expedition_lot_number text,
  prepared_at timestamptz,
  shipped_at timestamptz,
  preparation_status text,
  refinery_id uuid,
  refinery_name text,
  refinery_country text,
  shipped_to_company text,
  shipped_to_country text,
  total_gross_weight_grams numeric,
  total_net_weight_grams numeric,
  total_weight_oz numeric,
  link_source text,
  freight_shipment_id uuid,
  freight_reference text,
  freight_status text,
  received_at timestamptz,
  inventory_id uuid,
  allocated_quantity_oz numeric,
  certificate_number text,
  refining_record_id uuid,
  pre_melting_weight_grams numeric,
  post_melting_weight_grams numeric,
  fineness_percentage numeric,
  metal_retained_percentage numeric,
  final_fine_grams numeric,
  final_fine_ounces numeric,
  processed_at timestamptz,
  refining_approved_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','pg_temp'
AS $function$
DECLARE
  v_sale public.sales%ROWTYPE;
BEGIN
  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'La vente est obligatoire.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id=p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable.' USING ERRCODE='P0002';
  END IF;
  IF coalesce(auth.role(),'') <> 'service_role'
     AND NOT public.snp_peut_consulter_vente(p_sale_id) THEN
    RAISE EXCEPTION 'Cette vente ne relève pas de votre périmètre.' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH active_allocations AS (
    SELECT allocation.inventory_id, allocation.production_id,
      sum(allocation.allocated_quantity_oz)::numeric AS allocated_quantity_oz
    FROM public.snp_export_sale_inventory_allocations allocation
    WHERE allocation.sale_id=p_sale_id
      AND allocation.state IN ('allocated','sold')
    GROUP BY allocation.inventory_id,allocation.production_id
  ),
  physical_rows AS (
    SELECT
      preparation.id AS shipping_preparation_id,
      preparation.expedition_lot_number,
      preparation.prepared_at,
      preparation.shipped_at,
      preparation.status::text AS preparation_status,
      preparation.refinery_id,
      refinery.name AS refinery_name,
      refinery.country AS refinery_country,
      preparation.shipped_to_company,
      preparation.shipped_to_country,
      preparation.total_gross_weight_grams,
      preparation.total_net_weight_grams,
      preparation.total_weight_oz,
      'physical_backing'::text AS link_source,
      freight.id AS freight_shipment_id,
      coalesce(freight.expedition_number,freight.reference_number) AS freight_reference,
      freight.status::text AS freight_status,
      freight.received_at,
      inventory.id AS inventory_id,
      allocation.allocated_quantity_oz,
      inventory.certificate_number,
      record.id AS refining_record_id,
      coalesce(record.pre_melting_weight_grams,inventory.weight_before_melting_grams) AS pre_melting_weight_grams,
      coalesce(record.post_melting_weight_grams,inventory.weight_after_melting_grams) AS post_melting_weight_grams,
      coalesce(record.fineness_percentage,inventory.fineness_percentage) AS fineness_percentage,
      coalesce(record.metal_retained_percentage,inventory.metal_retained_percentage) AS metal_retained_percentage,
      coalesce(record.final_fine_grams,inventory.final_fine_grams) AS final_fine_grams,
      coalesce(record.final_fine_ounces,inventory.final_fine_oz) AS final_fine_ounces,
      record.processed_at,
      record.approved_at AS refining_approved_at
    FROM active_allocations allocation
    JOIN public.gold_inventory inventory ON inventory.id=allocation.inventory_id
    JOIN public.freight_shipments freight
      ON freight.id=inventory.freight_shipment_id AND freight.deleted_at IS NULL
    JOIN public.freight_shipment_productions freight_production
      ON freight_production.freight_shipment_id=freight.id
     AND freight_production.production_id=allocation.production_id
    -- A production may be physically split between several preparations. The
    -- freight remains the shipment unit for conciliation, so select one stable
    -- representative preparation instead of multiplying the sale allocation.
    JOIN LATERAL (
      SELECT candidate.*
      FROM public.shipping_production_items preparation_item
      JOIN public.shipping_preparations candidate
        ON candidate.id=preparation_item.shipping_preparation_id
      WHERE preparation_item.daily_production_id=allocation.production_id
        AND (
          freight.shipping_preparation_id=candidate.id
          OR EXISTS (
            SELECT 1 FROM public.freight_shipment_preparations association
            WHERE association.freight_shipment_id=freight.id
              AND association.shipping_preparation_id=candidate.id
          )
        )
      ORDER BY
        CASE WHEN freight.shipping_preparation_id=candidate.id THEN 0 ELSE 1 END,
        candidate.prepared_at NULLS LAST,candidate.id
      LIMIT 1
    ) preparation ON true
    LEFT JOIN public.refineries refinery ON refinery.id=preparation.refinery_id
    LEFT JOIN public.refining_records record ON record.id=inventory.refining_record_id
  ),
  direct_rows AS (
    SELECT
      preparation.id AS shipping_preparation_id,
      preparation.expedition_lot_number,
      preparation.prepared_at,
      preparation.shipped_at,
      preparation.status::text AS preparation_status,
      preparation.refinery_id,
      refinery.name AS refinery_name,
      refinery.country AS refinery_country,
      preparation.shipped_to_company,
      preparation.shipped_to_country,
      preparation.total_gross_weight_grams,
      preparation.total_net_weight_grams,
      preparation.total_weight_oz,
      'direct'::text AS link_source,
      freight.id AS freight_shipment_id,
      coalesce(freight.expedition_number,freight.reference_number) AS freight_reference,
      freight.status::text AS freight_status,
      freight.received_at,
      inventory.id AS inventory_id,
      allocation.allocated_quantity_oz,
      inventory.certificate_number,
      record.id AS refining_record_id,
      coalesce(record.pre_melting_weight_grams,inventory.weight_before_melting_grams) AS pre_melting_weight_grams,
      coalesce(record.post_melting_weight_grams,inventory.weight_after_melting_grams) AS post_melting_weight_grams,
      coalesce(record.fineness_percentage,inventory.fineness_percentage) AS fineness_percentage,
      coalesce(record.metal_retained_percentage,inventory.metal_retained_percentage) AS metal_retained_percentage,
      coalesce(record.final_fine_grams,inventory.final_fine_grams) AS final_fine_grams,
      coalesce(record.final_fine_ounces,inventory.final_fine_oz) AS final_fine_ounces,
      record.processed_at,
      record.approved_at AS refining_approved_at
    FROM public.shipping_preparations preparation
    LEFT JOIN public.refineries refinery ON refinery.id=preparation.refinery_id
    LEFT JOIN public.freight_shipments freight
      ON freight.shipping_preparation_id=preparation.id AND freight.deleted_at IS NULL
    LEFT JOIN public.gold_inventory inventory ON inventory.freight_shipment_id=freight.id
    LEFT JOIN active_allocations allocation ON allocation.inventory_id=inventory.id
    LEFT JOIN public.refining_records record ON record.id=inventory.refining_record_id
    WHERE preparation.id=v_sale.shipping_preparation_id
  ),
  combined AS (
    SELECT * FROM physical_rows
    UNION ALL
    SELECT direct.* FROM direct_rows direct
    WHERE NOT EXISTS (
      SELECT 1 FROM physical_rows physical
      WHERE physical.shipping_preparation_id=direct.shipping_preparation_id
        AND physical.inventory_id IS NOT DISTINCT FROM direct.inventory_id
    )
  )
  SELECT combined.*
  FROM combined
  ORDER BY combined.shipped_at NULLS LAST,
    combined.expedition_lot_number,combined.inventory_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_conciliation_expeditions_vente(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_expeditions_vente(uuid)
  TO authenticated,service_role;

COMMENT ON FUNCTION public.snp_conciliation_expeditions_vente(uuid) IS
  'Resolves every real shipment and approved/refining inventory result backing a sale without guessing from its business number.';

-- The eligibility guard uses the same authoritative paths as the page. A
-- direct local sale is the only accepted no-shipment branch.
CREATE OR REPLACE FUNCTION public.snp_guard_conciliation_shipped_lot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $function$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_shipping public.shipping_preparations%ROWTYPE;
  v_backed_oz numeric:=0;
  v_invalid_links integer:=0;
  v_initial_weight numeric;
BEGIN
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id=NEW.sale_id
    AND status::text NOT IN ('cancelled','canceled','rejected','management_rejected','customer_rejected');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La conciliation exige une vente active.' USING ERRCODE='23514';
  END IF;

  IF coalesce(v_sale.is_internal_sale,false) THEN
    -- Local direct sales to SONASP do not cross the export/refinery workflow.
    NULL;
  ELSIF v_sale.shipping_preparation_id IS NOT NULL THEN
    SELECT * INTO v_shipping
    FROM public.shipping_preparations
    WHERE id=v_sale.shipping_preparation_id;
    IF NOT FOUND OR v_shipping.shipped_at IS NULL OR v_shipping.refinery_id IS NULL THEN
      RAISE EXCEPTION 'La conciliation exige une expédition effectivement envoyée à une raffinerie.' USING ERRCODE='23514';
    END IF;
    v_initial_weight:=v_shipping.total_net_weight_grams;
  ELSE
    SELECT coalesce(sum(allocation.allocated_quantity_oz),0),
      count(*) FILTER (
        WHERE inventory.id IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM public.freight_shipments freight
             JOIN public.freight_shipment_productions freight_production
               ON freight_production.freight_shipment_id=freight.id
              AND freight_production.production_id=allocation.production_id
             JOIN public.shipping_production_items preparation_item
               ON preparation_item.daily_production_id=allocation.production_id
             JOIN public.shipping_preparations preparation
               ON preparation.id=preparation_item.shipping_preparation_id
             WHERE freight.id=inventory.freight_shipment_id
               AND freight.deleted_at IS NULL
               AND preparation.shipped_at IS NOT NULL
               AND preparation.refinery_id IS NOT NULL
               AND (
                 freight.shipping_preparation_id=preparation.id
                 OR EXISTS (
                   SELECT 1
                   FROM public.freight_shipment_preparations association
                   WHERE association.freight_shipment_id=freight.id
                     AND association.shipping_preparation_id=preparation.id
                 )
               )
           )
      ),
      sum(
        allocation.allocated_quantity_oz*31.1034768
        / CASE WHEN coalesce(inventory.fineness_percentage,0)>0
               THEN inventory.fineness_percentage/100 ELSE 1 END
      )
    INTO v_backed_oz,v_invalid_links,v_initial_weight
    FROM public.snp_export_sale_inventory_allocations allocation
    LEFT JOIN public.gold_inventory inventory ON inventory.id=allocation.inventory_id
    WHERE allocation.sale_id=v_sale.id
      AND allocation.state IN ('allocated','sold');

    IF v_backed_oz<=0
       OR abs(v_backed_oz-v_sale.quantity_oz)>0.001
       OR v_invalid_links>0 THEN
      RAISE EXCEPTION 'La conciliation exige une chaîne physique complète vente, stock raffiné et expédition à la raffinerie.' USING ERRCODE='23514';
    END IF;
  END IF;

  IF NOT public.snp_can_read_reconciliation_scope(NEW.mining_company_id) THEN
    RAISE EXCEPTION 'Dossier hors de votre périmètre.' USING ERRCODE='42501';
  END IF;

  IF TG_OP='INSERT' AND NOT coalesce(v_sale.is_internal_sale,false) THEN
    NEW.poids_initial_g:=v_initial_weight;
    NEW.teneur_initiale_pct:=CASE
      WHEN v_initial_weight>0
       AND NEW.or_fin_initial_g BETWEEN 0 AND v_initial_weight
      THEN round(NEW.or_fin_initial_g/v_initial_weight*100,4)
    END;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_guard_conciliation_shipped_lot()
  FROM PUBLIC,anon,authenticated;

DO $postflight$
BEGIN
  IF to_regprocedure('public.snp_conciliation_expeditions_vente(uuid)') IS NULL
     OR has_function_privilege('anon','public.snp_conciliation_expeditions_vente(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.snp_conciliation_expeditions_vente(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Conciliation logistics postflight failed.';
  END IF;
END;
$postflight$;

COMMIT;
NOTIFY pgrst, 'reload schema';
