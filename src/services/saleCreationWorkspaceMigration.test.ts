import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260904143000_refonte_creation_vente_internationale.sql'),
  'utf8',
);

describe('refonte transactionnelle de la création de vente internationale', () => {
  it('isole les brouillons afin qu’ils ne réservent aucun stock', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.snp_ventes_export_brouillons');
    expect(migration).toContain("status IN ('draft', 'submitted', 'cancelled')");
    expect(migration).not.toMatch(/INSERT INTO public\.sales[\s\S]*snp_enregistrer_brouillon_vente_export/u);
  });

  it('protège les modifications concurrentes par version et verrou', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('p_expected_version <> v_existing.version');
    expect(migration).toContain("USING ERRCODE = '40001'");
  });

  it('réutilise les RPC métier existantes lors de la soumission', () => {
    expect(migration).toContain('public.snp_creer_vente_export_idempotent');
    expect(migration).toContain('public.snp_creer_vente_export_mine');
    expect(migration).toContain('p_lots');
  });

  it('revalide le client, le contrat et la quantité avant création', () => {
    expect(migration).toContain('customer.is_active IS DISTINCT FROM false');
    expect(migration).toContain('contract.valid_until < current_date');
    expect(migration).toContain('v_contract.maximum_order_oz');
  });

  it('fige le contexte commercial et financier dans la vente et l’audit', () => {
    expect(migration).toContain("'context_snapshot', v_draft.context_snapshot");
    expect(migration).toContain('UPDATE public.snp_ventes_evenements_audit');
    expect(migration).toContain("'customer_contract_id', v_draft.customer_contract_id");
  });

  it('n’expose que la lecture et les deux points d’entrée sécurisés', () => {
    expect(migration).toContain('REVOKE ALL ON public.snp_ventes_export_brouillons');
    expect(migration).toContain("snp_actor_can_module_action('sales', 'create')");
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.snp_soumettre_brouillon_vente_export[\s\S]*TO authenticated/u);
  });
});
