import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260901220000_figer_valorisation_et_activation_reserve.sql'),
  'utf8',
);

describe('reserve valuation and activation migration', () => {
  it('uses only the XOF referential and records source/date evidence', () => {
    expect(migration).toContain("='USD/XOF'");
    expect(migration).toContain("='EUR/XOF'");
    expect(migration).not.toMatch(/IN\s*\(\s*'USD\/XOF'\s*,\s*'USD\/XAF'/);
    expect(migration).toContain('gold_price_date');
    expect(migration).toContain('usd_xof_rate_source');
    expect(migration).toContain('valuation_frozen_at');
  });

  it('removes ACTIVE from the generic RPC and requires a dedicated capability', () => {
    expect(migration).toContain("reserve.allocations.activate");
    expect(migration).toMatch(/snp_transition_reserve_allocation\([\s\S]*p_target_status[\s\S]*='ACTIVE'[\s\S]*RAISE EXCEPTION/);
    expect(migration).toContain("snp_actor_can_module_action('national_reserve','approve')");
    expect(migration).toContain('snp_activate_reserve_allocation');
  });

  it('serializes retries and records one activation result per allocation', () => {
    expect(migration).toContain('snp_reserve_activation_requests');
    expect(migration).toContain('allocation_id uuid NOT NULL UNIQUE');
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('SONASP:reserve-activation:'");
    expect(migration).toContain('request.request_key=p_request_key');
  });

  it('fails closed for incomplete valuations before regulated transitions', () => {
    expect(migration).toContain('Cours or USD et USD/XOF dates et sources requis avant soumission.');
    expect(migration).toContain('Valorisation historique incomplete : regularisation requise avant transition.');
    expect(migration).toContain('snp_reserve_valuation_gaps');
  });
});
