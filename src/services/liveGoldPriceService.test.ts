import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPriceCache, fetchLiveGoldPrice } from './liveGoldPriceService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

function mockReferentialResult(result: { data: Record<string, unknown> | null; error: unknown }) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: mocks.maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue(result);
  mocks.from.mockReturnValue(query);
  return query;
}

describe('liveGoldPriceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPriceCache();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('retourne null plutôt que de fabriquer un cours lorsque toutes les sources échouent', async () => {
    mockReferentialResult({ data: null, error: { code: 'NETWORK_ERROR' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(fetchLiveGoldPrice()).resolves.toBeNull();
    expect(mocks.from).toHaveBeenCalledWith('gold_prices_daily');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('utilise le référentiel SONASP sans appel direct à une origine CORS tierce', async () => {
    mockReferentialResult({
      data: {
        price_date: '2026-08-24',
        spot_price: 3_125.5,
        london_pm_rate: null,
        london_am_rate: 3_120,
        average_price: 3_110,
        high_price: null,
        low_price: null,
        source: 'LBMA',
        currency: 'USD',
        updated_at: '2026-08-24T08:15:00.000Z',
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn());

    const cours = await fetchLiveGoldPrice();

    expect(cours).toMatchObject({ price: 3_125.5, source: 'Référentiel SONASP · LBMA' });
    expect(cours?.high24h).toBeUndefined();
    expect(cours?.low24h).toBeUndefined();
    expect(cours?.change24h).toBeUndefined();
    expect(cours?.openPrice).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bascule sur Coinbase si le référentiel est temporairement indisponible', async () => {
    mockReferentialResult({ data: null, error: { code: 'PGRST000' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { amount: '3111.25' } }),
    }));

    await expect(fetchLiveGoldPrice()).resolves.toMatchObject({
      price: 3111.25,
      source: 'Coinbase (PAXG)',
    });
  });
});
