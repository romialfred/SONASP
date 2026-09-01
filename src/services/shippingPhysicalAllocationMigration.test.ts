import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260901152000_interdire_surallocation_preparations.sql',
  ),
  'utf8',
);

describe('shipping physical allocation migration', () => {
  it('serializes allocation checks on both productions and preparations', () => {
    expect(migration).toMatch(
      /FROM public\.daily_production production[\s\S]*ORDER BY production\.id[\s\S]*FOR UPDATE/,
    );
    expect(migration).toMatch(
      /FROM public\.shipping_preparations preparation[\s\S]*ORDER BY preparation\.id[\s\S]*FOR UPDATE/,
    );
    expect(migration).toContain('snp_shipping_physical_allocation_guard');
  });

  it('rejects cross-tenant, inadmissible and excessive allocations', () => {
    expect(migration).toContain("v_production.status::text <> 'ready_for_customs'");
    expect(migration).toContain(
      'v_preparation.mining_company_id IS DISTINCT FROM v_production.mining_company_id',
    );
    expect(migration).toContain(
      'v_allocated_net + NEW.net_weight_grams > v_production.bullion_grams + 0.0001',
    );
    expect(migration).toContain(
      'v_allocated_pure + NEW.pure_gold_grams > v_available_pure + 0.0001',
    );
  });

  it('makes child rows immutable after the preparation leaves its initial state', () => {
    expect(migration).toContain(
      "v_old_preparation.status::text <> 'waiting_for_customs_approval'",
    );
    expect(migration).toContain(
      "v_preparation.status::text <> 'waiting_for_customs_approval'",
    );
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE');
  });

  it('rebuilds totals from the child source of truth and scopes browser access', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.calculate_shipping_preparation_totals');
    expect(migration).toContain('total_weight_oz = totals.net_weight / 31.1034768');
    expect(migration).toContain('ALTER TABLE public.shipping_production_items FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('public.snp_sec_can_read_shipping(shipping_preparation_id)');
    expect(migration).toContain('public.snp_sec_can_prepare_shipping(shipping_preparation_id)');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public.shipping_production_items');
  });
});
