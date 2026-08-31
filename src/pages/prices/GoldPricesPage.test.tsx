import { describe, expect, it } from 'vitest';
import { buildDailyRows, buildMonthlyRows, formatPriceDate } from './GoldPricesPage';

describe('GoldPricesPage presentation helpers', () => {
  it('calcule la variation sur la chronologie avant de présenter les lignes récentes en premier', () => {
    const rows = buildDailyRows([
      {
        price_date: '2026-08-27', london_am_rate: 2400, london_pm_rate: 2405,
        spot_price: 2402, average_price: 2402.5, high_price: 2410, low_price: 2390,
      },
      {
        price_date: '2026-08-28', london_am_rate: 2412, london_pm_rate: 2415,
        spot_price: 2414, average_price: 2413.5, high_price: 2420, low_price: 2400,
      },
    ]);

    expect(rows.map((row) => row.price_date)).toEqual(['2026-08-28', '2026-08-27']);
    expect(rows[0].change).toBe(12);
    expect(rows[1].change).toBeNull();
  });

  it('ne fabrique pas de variation mensuelle lorsque la clôture source est absente', () => {
    const rows = buildMonthlyRows([
      {
        year: 2026, month: 1, average_price: 2300, high_price: 2350, low_price: 2250,
        opening_price: 2280, closing_price: null, total_days: 21,
      },
      {
        year: 2026, month: 2, average_price: 2400, high_price: 2450, low_price: 2350,
        opening_price: 2360, closing_price: 2420, total_days: 20,
      },
    ]);

    expect(rows[0].change).toBeNull();
    expect(rows[0].changePercent).toBeNull();
  });

  it('formate les dates de cotation en français sans décalage de fuseau', () => {
    expect(formatPriceDate('2026-08-29')).toBe('29/08/2026');
    expect(formatPriceDate('date-invalide')).toBe('—');
  });
});
