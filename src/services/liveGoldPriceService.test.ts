import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPriceCache, fetchLiveGoldPrice } from './liveGoldPriceService';

describe('liveGoldPriceService', () => {
  beforeEach(() => {
    clearPriceCache();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('retourne null plutôt que de fabriquer un cours lorsque toutes les sources échouent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(fetchLiveGoldPrice()).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ne fabrique ni haut, ni bas, ni variation absents de la réponse source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ curr: 'XAU', xauPrice: 3_125.5 }] }),
    }));

    const cours = await fetchLiveGoldPrice();

    expect(cours).toMatchObject({ price: 3_125.5, source: 'GoldPrice.org' });
    expect(cours?.high24h).toBeUndefined();
    expect(cours?.low24h).toBeUndefined();
    expect(cours?.change24h).toBeUndefined();
    expect(cours?.openPrice).toBeUndefined();
  });
});
