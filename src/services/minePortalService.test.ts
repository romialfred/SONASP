import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minePortalService } from './minePortalService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
  responses: {} as Record<string, { data: unknown; error: unknown }>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

function builder(table: string) {
  const response = () => mocks.responses[table] || { data: [], error: null };
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn((column: string, value: unknown) => {
    mocks.filters.push({ table, column, value });
    return query;
  });
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => response());
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response()).then(resolve);
  return query;
}

describe('minePortalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filters = [];
    mocks.responses = {
      mining_companies: { data: { id: 'mine-1', name: 'Mine A', code: 'M-A', is_active: true }, error: null },
      snp_contrats: { data: [{ id: 'c1', numero_contrat: 'CTR-1', intitule: 'Contrat', statut: 'actif', date_fin: '2026-12-31', quantite_totale: 100, unite: 'oz', mining_company_id: 'mine-1' }], error: null },
      snp_demandes_achat: { data: [], error: null },
      snp_factures_achat: { data: [], error: null },
      snp_reglements_achat: { data: [], error: null },
      snp_analyses_teneur: { data: [
        { id: 'a1', reference: 'ANA-1', statut: 'analysee', date_prelevement: null, teneur_declaree_pct: 90, teneur_retenue_pct: null, mining_company_id: 'mine-1' },
        { id: 'a2', reference: 'ANA-AUTRE', statut: 'analysee', date_prelevement: null, teneur_declaree_pct: 91, teneur_retenue_pct: null, mining_company_id: 'mine-2' },
      ], error: null },
      snp_requisitions: { data: [], error: null },
    };
    mocks.from.mockImplementation((table: string) => builder(table));
    mocks.rpc.mockImplementation(() => ({
      maybeSingle: vi.fn(async () => ({ data: { reste_du: 250_000 }, error: null })),
    }));
  });

  it('porte le filtre de société sur chaque source et élimine toute ligne inattendue', async () => {
    const snapshot = await minePortalService.load('mine-1');

    const scopedTables = ['snp_contrats', 'snp_demandes_achat', 'snp_factures_achat', 'snp_reglements_achat', 'snp_analyses_teneur', 'snp_requisitions'];
    scopedTables.forEach((table) => {
      expect(mocks.filters).toContainEqual({ table, column: 'mining_company_id', value: 'mine-1' });
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_situation_societe', { p_mining_company_id: 'mine-1' });
    expect(snapshot.analyses.map((item) => item.reference)).toEqual(['ANA-1']);
    expect(snapshot.company.name).toBe('Mine A');
  });

  it('échoue proprement si une source du périmètre est indisponible', async () => {
    mocks.responses.snp_factures_achat = { data: null, error: { message: 'offline' } };
    await expect(minePortalService.load('mine-1')).rejects.toThrow('Impossible de charger les factures.');
  });
});
