import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260901154000_adosser_ventes_export_stock_physique.sql',
  ),
  'utf8',
);

describe('export sale physical-backing migration', () => {
  it('links every mine purchase allocation through the exact production and freight path', () => {
    expect(migration).toContain('public.snp_achats_productions allocation');
    expect(migration).toContain(
      'shipment_production.production_id=allocation.production_id',
    );
    expect(migration).toContain(
      'inventory.freight_shipment_id=shipment_production.freight_shipment_id',
    );
    expect(migration).toContain("shipment.status::text='in_stock'");
    expect(migration).toContain('production_id uuid NOT NULL REFERENCES public.daily_production');
    expect(migration).toContain(
      'This acquisition source has no authoritative production-to-freight provenance',
    );
  });

  it('moves the same quantity between available, allocated and sold compartments', () => {
    expect(migration).toContain(
      'quantity_available_oz=quantity_available_oz-v_take',
    );
    expect(migration).toContain(
      'quantity_allocated_oz=coalesce(quantity_allocated_oz,0)+v_take',
    );
    expect(migration).toContain(
      'quantity_available_oz=quantity_available_oz+v_asset.quantity_oz',
    );
    expect(migration).toContain(
      'quantity_sold_oz=coalesce(quantity_sold_oz,0)+v_asset.quantity_oz',
    );
  });

  it('serializes sales and reserve allocations on the same national lock and inventory rows', () => {
    const lockUses = migration.match(
      /pg_advisory_xact_lock\(hashtext\('SONASP:exportable-stock'\)\)/g,
    );
    expect(lockUses?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('FOR UPDATE OF inventory');
    expect(migration).toMatch(
      /snp_guard_reserve_allocation_item\(\)[\s\S]*SONASP:exportable-stock[\s\S]*WHERE id=NEW\.inventory_id FOR UPDATE/,
    );
    expect(migration).toContain('FROM public.reserve_allocation_items reserved');
  });

  it('fails closed for existing unbacked sales and defers creation checks until lots exist', () => {
    expect(migration).toContain('snp_export_sale_physical_backing_gaps');
    expect(migration).toContain("resolution text NOT NULL DEFAULT 'blocked'");
    expect(migration).toContain(
      'Historical export sales require physical-backing reconciliation before a new export sale.',
    );
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER snp_export_sale_physical_backing_deferred[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER snp_export_sale_lot_physical_backing_deferred[\s\S]*DEFERRABLE INITIALLY DEFERRED/,
    );
  });

  it('keeps all material mutation helpers private and performs postflight checks', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.snp_ensure_export_sale_physical_backing\(uuid\)[\s\S]*FROM PUBLIC,anon,authenticated,service_role/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.snp_export_sale_inventory_allocations[\s\S]*FROM PUBLIC,anon,authenticated,service_role/,
    );
    expect(migration).toContain('DO $postflight$');
    expect(migration).toContain('an historical sale is not fail-closed');
  });
});
