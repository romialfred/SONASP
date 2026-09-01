import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260901223000_exposer_lots_vente_export_eligibles.sql',
  ),
  'utf8',
);

describe('eligible export-sale lots read model migration', () => {
  it('requires sales view and create rights on an active strong session', () => {
    expect(migration).toContain("snp_actor_can_module_action('sales','view')");
    expect(migration).toContain("snp_actor_can_module_action('sales','create')");
    expect(migration).toContain('NOT public.snp_session_est_active()');
  });

  it('follows the exact purchase-production-freight-inventory path', () => {
    expect(migration).toContain('public.snp_achats_productions allocation');
    expect(migration).toContain('public.freight_shipment_productions shipment_production');
    expect(migration).toContain("shipment.status::text='in_stock'");
    expect(migration).toContain('inventory.freight_shipment_id=shipment_production.freight_shipment_id');
    expect(migration).toContain('inventory.quantity_available_oz');
  });

  it('shares the P0 lock and excludes reserves and untraceable sources', () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('SONASP:exportable-stock'))");
    expect(migration).toContain('public.reserve_allocation_items reserved');
    expect(migration).toContain('excluded_untraceable_source_count');
    expect(migration).not.toMatch(/'source_type','achat_artisan'/);
    expect(migration).not.toMatch(/'source_type','cession_comptoir'/);
  });

  it('fails closed on historical gaps without exposing sale identifiers', () => {
    expect(migration).toContain("'code','historical_physical_backing_gaps'");
    expect(migration).toContain("'lots','[]'::jsonb");
    expect(migration).not.toContain("'sale_number'");
  });

  it('exposes only the allowlisted authenticated RPC', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.snp_lots_vente_export_eligibles\(\)[\s\S]*FROM PUBLIC,anon,authenticated,service_role/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.snp_lots_vente_export_eligibles\(\)[\s\S]*TO authenticated/,
    );
    expect(migration).toContain("'runtime-browser','20260901223000'");
  });
});
