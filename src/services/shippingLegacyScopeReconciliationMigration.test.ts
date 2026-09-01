import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20260901151000_reconcilier_affectations_expedition_heritees.sql',
  'utf8',
);

describe('réconciliation des affectations Shipping héritées', () => {
  it('reste atomique et refuse les préparations déjà engagées dans le fret', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).toContain('JOIN public.freight_shipments shipment');
    expect(sql).toContain('est déjà engagée dans le fret');
  });

  it('exige un périmètre de production unique et une licence active suffisante', () => {
    expect(sql).toContain('count(DISTINCT production.mining_company_id) <> 1');
    expect(sql).toContain("license.status = 'active'");
    expect(sql).toContain('current_date BETWEEN license.start_date AND license.end_date');
    expect(sql).toContain('license.remaining_quantity_grams');
  });

  it('réaligne ensemble le tenant et les deux colonnes de licence', () => {
    expect(sql).toContain('SET mining_company_id = v_preparation.mining_company_id');
    expect(sql).toContain('export_license_id = v_license_id');
    expect(sql).toContain('license_id = v_license_id');
  });
});
