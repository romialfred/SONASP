import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const freight = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260831223000_durcir_workflow_freight_shipments.sql',
), 'utf8');
const sales = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260901130000_interdire_suppression_directe_ventes.sql',
), 'utf8');
const conciliationFinance = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260901213000_synchroniser_conciliation_vente_paiements_avoirs.sql',
), 'utf8');

describe('regulated workflow migrations', () => {
  it('makes freight transitions permission-aware, separated, idempotent and audited', () => {
    expect(freight).toContain("snp_actor_can_module_action('shipping'");
    expect(freight).toContain('created_by IS NOT DISTINCT FROM auth.uid()');
    expect(freight).toContain("context ->> 'request_id'");
    expect(freight).toContain('snp_record_workflow_event(');
    expect(freight).toContain("parent.status::text=''pending''");
    expect(freight).toContain('Freight commercial, logistics and destination data are immutable after approval.');
  });

  it('removes browser-side physical deletion of regulated sales', () => {
    expect(sales).toMatch(/cmd='DELETE'/);
    expect(sales).toContain('REVOKE DELETE ON TABLE public.sales FROM PUBLIC, anon, authenticated');
    expect(sales).not.toContain('TO authenticated USING');
  });

  it('repairs only an unambiguous legacy final currency before ledger normalization', () => {
    expect(conciliationFinance).toContain('conciliation.devise_finale IS NULL');
    expect(conciliationFinance).toContain(
      "upper(btrim(sale.currency)) = upper(btrim(conciliation.devise_initiale))",
    );
    expect(conciliationFinance).toContain(
      "entry.type_mouvement = 'ajustement_conciliation'",
    );
    expect(conciliationFinance).toMatch(/^BEGIN;/m);
    expect(conciliationFinance).toMatch(/^COMMIT;/m);
  });
});
