import { supabase } from '@/lib/supabase';

export interface ReferentialFxRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
}

/**
 * Charge les taux du référentiel quotidien, dans le sens demandé.
 *
 * Le schéma autoritatif stocke une paire (`USD/XOF`) plutôt que deux colonnes
 * historiques (`from_currency`, `to_currency`). Si seule la paire inverse est
 * disponible, le taux est inversé de manière explicite.
 */
export async function getReferentialFxRates(
  fromCurrency: string,
  toCurrency: string,
  limit = 30,
): Promise<ReferentialFxRate[]> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) return [];
  if (from === to) {
    return [{
      id: `${from}-${to}`,
      from_currency: from,
      to_currency: to,
      rate: 1,
      rate_date: new Date().toISOString().slice(0, 10),
      source: 'Parité',
    }];
  }

  const directPair = `${from}/${to}`;
  const inversePair = `${to}/${from}`;
  try {
    const { data, error } = await supabase
      .from('fx_rates_daily')
      .select('id, currency_pair, rate, rate_date, notes')
      .in('currency_pair', [directPair, inversePair])
      .order('rate_date', { ascending: false })
      .limit(Math.max(1, limit));

    if (error || !data) return [];

    return data.flatMap((row) => {
      const rawRate = Number(row.rate);
      if (!Number.isFinite(rawRate) || rawRate <= 0) return [];
      const rate = row.currency_pair === directPair ? rawRate : 1 / rawRate;
      return [{
        id: row.id,
        from_currency: from,
        to_currency: to,
        rate,
        rate_date: row.rate_date,
        source: row.notes || 'Référentiel SONASP',
      }];
    });
  } catch {
    return [];
  }
}

export async function getLatestReferentialFxRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<ReferentialFxRate | null> {
  const rates = await getReferentialFxRates(fromCurrency, toCurrency, 1);
  return rates[0] ?? null;
}
