BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;

SELECT plan(24);

SELECT has_table(
  'public','snp_export_sale_inventory_allocations',
  'the material allocation ledger exists'
);
SELECT has_table(
  'public','snp_export_sale_physical_backing_gaps',
  'historical gaps are explicitly recorded'
);
SELECT has_column(
  'public','snp_export_sale_inventory_allocations','production_id',
  'the exact production is retained in every physical allocation'
);
SELECT col_not_null(
  'public','snp_export_sale_inventory_allocations','production_id',
  'a physical allocation cannot omit its production provenance'
);
SELECT has_index(
  'public','snp_export_sale_inventory_allocations',
  'idx_snp_export_sale_inventory_asset_state',
  'active use of each physical asset is indexed'
);
SELECT has_index(
  'public','snp_export_sale_inventory_allocations',
  'idx_snp_export_sale_inventory_production_state',
  'active use of each production is indexed'
);
SELECT has_function(
  'public','snp_ensure_export_sale_physical_backing',ARRAY['uuid'],
  'the atomic physical allocator exists'
);
SELECT has_function(
  'public','snp_release_export_sale_physical_backing',ARRAY['uuid','text'],
  'rejected sales have an atomic material release path'
);
SELECT has_function(
  'public','snp_mark_export_sale_physical_backing_sold',ARRAY['uuid'],
  'paid sales have an atomic sold path'
);
SELECT has_trigger(
  'public','sales','snp_export_sale_physical_backing_deferred',
  'sale creation is guarded after its lots are written'
);
SELECT has_trigger(
  'public','snp_ventes_lots','snp_export_sale_lot_physical_backing_deferred',
  'sale-lot mutation is guarded after the complete transaction'
);
SELECT has_trigger(
  'public','sales','snp_export_sale_physical_status_sync',
  'sale status changes synchronize material compartments'
);
SELECT has_trigger(
  'public','reserve_allocation_items','snp_reserve_allocation_item_guard',
  'reserve allocation writes are protected by the shared stock guard'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.sales'::regclass
      AND tgname='snp_export_sale_physical_backing_deferred'
      AND tgdeferrable AND tginitdeferred
  ),
  'the creation guard is initially deferred and rolls the whole transaction back on failure'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated','public.snp_export_sale_inventory_allocations','INSERT'
  ) AND NOT has_table_privilege(
    'authenticated','public.snp_export_sale_inventory_allocations','UPDATE'
  ) AND NOT has_table_privilege(
    'authenticated','public.snp_export_sale_inventory_allocations','DELETE'
  ),
  'browser sessions cannot forge material allocations'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated','public.snp_ensure_export_sale_physical_backing(uuid)','EXECUTE'
  ) AND NOT has_function_privilege(
    'service_role','public.snp_ensure_export_sale_physical_backing(uuid)','EXECUTE'
  ),
  'the allocator is reachable only from database triggers'
);
SELECT ok(
  position('public.snp_achats_productions allocation' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0,
  'the allocator starts from the purchase-production allocation'
);
SELECT ok(
  position('shipment_production.production_id=allocation.production_id' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0,
  'the same production must be present in freight'
);
SELECT ok(
  position('inventory.freight_shipment_id=shipment_production.freight_shipment_id' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0,
  'the selected inventory must be the freight output carrying that production'
);
SELECT ok(
  position('shipment.status::text=''in_stock''' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0,
  'only freight completed into physical stock is eligible'
);
SELECT ok(
  position('FOR UPDATE OF inventory' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0,
  'the selected physical inventory rows are locked'
);
SELECT ok(
  position('SONASP:exportable-stock' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0
  AND position('SONASP:exportable-stock' IN pg_get_functiondef(
    'public.snp_guard_reserve_allocation_item()'::regprocedure
  ))>0,
  'sale and reserve contenders share one transaction-level lock'
);
SELECT ok(
  position('quantity_available_oz=quantity_available_oz-v_take' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0
  AND position('quantity_allocated_oz=coalesce(quantity_allocated_oz,0)+v_take' IN pg_get_functiondef(
    'public.snp_ensure_export_sale_physical_backing(uuid)'::regprocedure
  ))>0,
  'allocation conserves quantity between available and allocated compartments'
);
SELECT ok(
  NOT EXISTS(
    SELECT 1
    FROM public.sales sale
    LEFT JOIN public.snp_export_sale_physical_backing_gaps gap ON gap.sale_id=sale.id
    WHERE sale.seller_type='sonasp'
      AND NOT coalesce(sale.is_internal_sale,false)
      AND sale.status::text NOT IN ('management_rejected','customer_rejected','cancelled')
      AND gap.sale_id IS NULL
      AND coalesce((
        SELECT sum(material.allocated_quantity_oz)
        FROM public.snp_export_sale_inventory_allocations material
        WHERE material.sale_id=sale.id
          AND material.state IN ('allocated','sold')
      ),0)<>sale.quantity_oz
  ),
  'every active SONASP export sale is explicitly fail-closed or exactly backed'
);

SELECT * FROM finish();
ROLLBACK;
