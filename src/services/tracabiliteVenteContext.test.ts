import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), queries: [] as Array<{ table: string; calls: unknown[][] }>, rows: {} as Record<string, unknown[]>, errors: {} as Record<string, unknown> }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
import { tracabiliteVenteService } from './tracabiliteVenteService';
beforeEach(() => {
  mocks.queries.length = 0; mocks.rows = {}; mocks.errors = {};
  mocks.from.mockImplementation((table: string) => {
    const q = { table, calls: [] as unknown[][] }; mocks.queries.push(q);
    const chain: Record<string, unknown> = { then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: mocks.rows[table] ?? [], error: mocks.errors[table] ?? null }).then(resolve) };
    for (const m of ['select', 'eq', 'is', 'in', 'order']) chain[m] = (...args: unknown[]) => { q.calls.push([m, ...args]); return chain; };
    return chain;
  });
});
describe('compatibilité du contexte des lots', () => {
  it('lit une base sans colonne Comptoir sans demander une relation inexistante', async () => {
    mocks.rows.snp_ventes_lots = [{ source_type: 'achat_mine', achat_mine_id: 'achat', quantite_oz: 12, achat: { numero_achat: 'ACH1', mining_company: { name: 'Mine A' } } }];
    expect(await tracabiliteVenteService.lotsDeVente('sale')).toEqual([expect.objectContaining({ reference: 'ACH1', origine: 'Mine A', quantite_oz: 12 })]);
    expect(mocks.queries).toHaveLength(1);
    expect(String(mocks.queries[0].calls[0][1])).not.toContain('comptoir_cession_id');
    expect(mocks.queries[0].calls).toContainEqual(['is', 'released_at', null]);
  });
  it('hydrate une cession uniquement à partir de l’identifiant réellement présent', async () => {
    mocks.rows.snp_ventes_lots = [{ source_type: 'cession_comptoir', comptoir_cession_id: 'cession', quantite_oz: 8 }];
    mocks.rows.snp_comptoir_ventes_sonasp = [{ id: 'cession', reference_vente: 'CESS1', comptoir: { name: 'Comptoir A' } }];
    expect(await tracabiliteVenteService.lotsDeVente('sale')).toEqual([expect.objectContaining({ reference: 'CESS1', origine: 'Comptoir A' })]);
    expect(mocks.queries[1].calls).toContainEqual(['in', 'id', ['cession']]);
  });
  it('ne masque pas un refus de permission en résultat vide', async () => {
    mocks.errors.snp_ventes_lots = { code: '42501' };
    await expect(tracabiliteVenteService.lotsDeVente('sale')).rejects.toEqual({ code: '42501' });
  });
});
