import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestReferentialFxRate, getReferentialFxRates } from './fxRateReferential';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  result: { data: null as Record<string, unknown>[] | null, error: null as unknown },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

describe('fxRateReferential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.result = { data: null, error: null };
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      then: (resolve: (value: typeof mocks.result) => unknown) => Promise.resolve(mocks.result).then(resolve),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
  });

  it('inverse USD/XOF pour convertir XOF vers USD', async () => {
    mocks.result = {
      data: [{
        id: 'fx-1',
        currency_pair: 'USD/XOF',
        rate: 600,
        rate_date: '2026-08-24',
        notes: 'BCEAO',
      }],
      error: null,
    };

    const rate = await getLatestReferentialFxRate('XOF', 'USD');
    expect(rate?.rate).toBeCloseTo(1 / 600, 12);
    expect(mocks.from).toHaveBeenCalledWith('fx_rates_daily');
    const query = mocks.from.mock.results[0].value;
    expect(query.in).toHaveBeenCalledWith('currency_pair', ['XOF/USD', 'USD/XOF']);
  });

  it('retourne la parité sans requête réseau pour une même devise', async () => {
    await expect(getReferentialFxRates('USD', 'USD')).resolves.toMatchObject([{ rate: 1 }]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('reste non bloquant quand le référentiel est indisponible', async () => {
    mocks.result = { data: null, error: { code: 'PGRST000' } };
    await expect(getReferentialFxRates('EUR', 'USD')).resolves.toEqual([]);
  });
});
