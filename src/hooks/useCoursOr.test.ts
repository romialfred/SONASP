import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GRAMMES_PAR_ONCE,
  chargerDernierTauxUsdXof,
  ecartAuCours,
  prixGrammeDepuisOnce,
} from './useCoursOr';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/services/liveGoldPriceService', () => ({
  clearPriceCache: vi.fn(),
  fetchLiveGoldPrice: vi.fn(),
}));

describe('chargerDernierTauxUsdXof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.from.mockReturnValue(query);
  });

  it('lit le couple USD/XOF dans le vrai référentiel de change', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { rate: 600.25 }, error: null });

    await expect(chargerDernierTauxUsdXof()).resolves.toBe(600.25);
    expect(mocks.from).toHaveBeenCalledWith('fx_rates_daily');
    const query = mocks.from.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith('currency_pair', 'USD/XOF');
    expect(query.order).toHaveBeenCalledWith('rate_date', { ascending: false });
  });

  it('reste non bloquant si le référentiel ne répond pas', async () => {
    mocks.maybeSingle.mockRejectedValue(new TypeError('offline'));
    await expect(chargerDernierTauxUsdXof()).resolves.toBeNull();
  });
});

describe('prixGrammeDepuisOnce', () => {
  it('convertit l’once en gramme au taux du référentiel', () => {
    // 4 448,88 USD/oz à 600 FCFA/USD → 2 669 328 FCFA/oz → 85 821 FCFA/g
    const prix = prixGrammeDepuisOnce(4_448.88, 600);
    expect(prix).not.toBeNull();
    expect(Math.round(prix as number)).toBe(Math.round((4_448.88 * 600) / GRAMMES_PAR_ONCE));
  });

  it('ne convertit rien sans cours ou sans taux', () => {
    // Une conversion approximative vaut moins que pas de conversion du tout.
    expect(prixGrammeDepuisOnce(null, 600)).toBeNull();
    expect(prixGrammeDepuisOnce(4_448.88, null)).toBeNull();
    expect(prixGrammeDepuisOnce(0, 600)).toBeNull();
    expect(prixGrammeDepuisOnce(4_448.88, 0)).toBeNull();
  });
});

describe('ecartAuCours', () => {
  it('mesure la prime et la décote', () => {
    expect(ecartAuCours(110, 100)).toBeCloseTo(10, 6);
    expect(ecartAuCours(90, 100)).toBeCloseTo(-10, 6);
    expect(ecartAuCours(100, 100)).toBe(0);
  });

  it('n’annonce aucun écart sans référence ni sans prix', () => {
    expect(ecartAuCours(100, null)).toBeNull();
    expect(ecartAuCours(0, 100)).toBeNull();
    expect(ecartAuCours(100, 0)).toBeNull();
  });
});
