import { beforeEach, describe, expect, it, vi } from 'vitest';
import { managerPortalService } from './managerPortalService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  responses: {} as Record<string, { data: unknown; error: unknown }>,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function builder(table: string) {
  const response = () => mocks.responses[table] || { data: [], error: null };
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response()).then(resolve);
  return query;
}

describe('managerPortalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.responses = {
      mining_companies: { data: [{ id: 'mine-1', name: 'Mine A', abbreviation: 'MA', code: 'M-A' }], error: null },
      daily_production: { data: [{ id: 'p1', mining_company_id: 'mine-1', production_date: '2026-08-20', estimated_oz: 42, estimated_fineness_pct: 91, status: 'prepared' }], error: null },
    };
    mocks.from.mockImplementation((table: string) => builder(table));
  });

  it('consolide uniquement les sources opérationnelles réelles', async () => {
    const snapshot = await managerPortalService.load();
    expect(snapshot.companies).toHaveLength(1);
    expect(snapshot.productions[0].estimated_oz).toBe(42);
    expect(mocks.from).toHaveBeenCalledWith('snp_factures_achat');
    expect(mocks.from).toHaveBeenCalledWith('snp_analyses_teneur');
  });

  it('ne duplique pas les requêtes quand deux montages demandent la même synthèse', async () => {
    const [first, second] = await Promise.all([
      managerPortalService.load(),
      managerPortalService.load(),
    ]);

    expect(first.companies).toHaveLength(1);
    expect(second.companies).toHaveLength(1);
    expect(mocks.from.mock.calls.filter(([table]) => table === 'daily_production')).toHaveLength(1);
  });

  it('échoue sans inventer de valeurs lorsqu’une source est refusée', async () => {
    mocks.responses.snp_contrats = { data: null, error: { message: 'forbidden' } };
    await expect(managerPortalService.load()).rejects.toThrow('Impossible de charger les contrats.');
  });
});
