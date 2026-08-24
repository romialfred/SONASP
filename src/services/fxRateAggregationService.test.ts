import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFxRateCache, fetchLiveFxRate } from './fxRateAggregationService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

function mockReferential(result: { data: Record<string, unknown> | null; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: mocks.maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue(result);
  mocks.from.mockReturnValue(query);
}

describe('fxRateAggregationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFxRateCache();
  });

  it('lit le dernier taux du référentiel sans requête réseau tierce', async () => {
    mockReferential({
      data: {
        currency_pair: 'USD/XOF',
        rate: 601.25,
        rate_date: '2026-08-24',
        bid_rate: 600.8,
        ask_rate: 601.7,
        spread: 0.9,
        updated_at: '2026-08-24T08:15:00.000Z',
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn());

    await expect(fetchLiveFxRate('USD/XOF')).resolves.toMatchObject({
      currencyPair: 'USD/XOF',
      rate: 601.25,
      source: 'Référentiel SONASP',
    });
    expect(mocks.from).toHaveBeenCalledWith('fx_rates_daily');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retourne null plutôt que de fabriquer un taux', async () => {
    mockReferential({ data: null, error: { code: 'PGRST000' } });
    vi.stubGlobal('fetch', vi.fn());

    await expect(fetchLiveFxRate('EUR/USD')).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
