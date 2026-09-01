import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260901133000_synchroniser_resume_paiements_vente.sql'),
  'utf8',
);

describe('international payment sale summary migration', () => {
  it('derives the legacy sale amount only from live real payments', () => {
    expect(migration).toContain("p.is_virtual IS FALSE");
    expect(migration).toContain("p.status IN ('processing', 'approved')");
    expect(migration).not.toMatch(/status\s+IN\s*\([^)]*'rejected'/i);
    expect(migration).not.toMatch(/status\s+IN\s*\([^)]*'cancelled'/i);
  });

  it('runs after the business transaction and remains internal', () => {
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER snp_payments_99_sync_sale_summary');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.snp_sync_sale_payment_summary(uuid)');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated, service_role');
  });

  it('serializes the parent sale and reconciles existing summaries', () => {
    expect(migration).toMatch(/FROM public\.sales\s+WHERE id = p_sale_id\s+FOR UPDATE/s);
    expect(migration).toMatch(/SELECT id AS sale_id\s+FROM public\.sales/s);
    expect(migration).toContain('PERFORM public.snp_sync_sale_payment_summary(v_sale.sale_id)');
  });
});
