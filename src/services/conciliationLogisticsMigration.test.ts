import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260903190000_resoudre_expeditions_reelles_conciliation.sql',
  ),
  'utf8',
);

describe('conciliation logistics migration', () => {
  it('resolves every shipment through the authoritative physical allocation chain', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.snp_conciliation_expeditions_vente',
    );
    expect(migration).toMatch(
      /snp_export_sale_inventory_allocations allocation[\s\S]*gold_inventory inventory[\s\S]*freight_shipments freight[\s\S]*freight_shipment_productions freight_production[\s\S]*shipping_production_items preparation_item[\s\S]*shipping_preparations preparation/,
    );
    expect(migration).toContain("'physical_backing'::text AS link_source");
  });

  it('allows only direct local sales to omit the export shipment', () => {
    expect(migration).toContain('IF coalesce(v_sale.is_internal_sale,false) THEN');
    expect(migration).toContain(
      'Local direct sales to SONASP do not cross the export/refinery workflow.',
    );
    expect(migration).toContain(
      'abs(v_backed_oz-v_sale.quantity_oz)>0.001',
    );
    expect(migration).toContain('v_invalid_links>0');
  });

  it('requires shipped refinery links and never infers them from the sale reference', () => {
    expect(migration).toContain('v_shipping.shipped_at IS NULL');
    expect(migration).toContain('v_shipping.refinery_id IS NULL');
    expect(migration).toContain('preparation.shipped_at IS NOT NULL');
    expect(migration).toContain('preparation.refinery_id IS NOT NULL');
    expect(migration).not.toMatch(/sale_number\s*(=|like|ilike)/i);
  });

  it('keeps the resolver tenant-scoped and unavailable to anonymous callers', () => {
    expect(migration).toContain('public.snp_peut_consulter_vente(p_sale_id)');
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.snp_conciliation_expeditions_vente\(uuid\)[\s\S]*FROM PUBLIC,anon/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.snp_conciliation_expeditions_vente\(uuid\)[\s\S]*TO authenticated,service_role/,
    );
  });
});
