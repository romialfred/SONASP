/**
 * FX Rate Aggregation Service
 *
 * Handles real-time FX rates, end-of-day persistence, and monthly aggregation
 * Supports: EUR/USD, USD/XOF and EUR/XOF.
 */

import { supabase } from '@/lib/supabase';

export interface LiveFxRate {
  currencyPair: string;
  rate: number;
  bidRate?: number;
  askRate?: number;
  spread?: number;
  timestamp: number;
  source: string;
  change24h?: number;
  changePercent24h?: number;
}

export interface DailyFxSnapshot {
  rate_date: string;
  currency_pair: string;
  source_id: string;
  rate: number;
  bid_rate: number | null;
  ask_rate: number | null;
  spread: number | null;
  opening_rate: number;
  closing_rate: number;
  high_rate: number;
  low_rate: number;
  avg_rate: number;
  data_points: number;
}

export interface MonthlyFxAggregate {
  year: number;
  month: number;
  currency_pair: string;
  source_id: string;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
  opening_rate: number;
  closing_rate: number;
  data_points: number;
  volatility: number;
}

// Track intraday rates for each currency pair
const intradayRates: Map<string, {
  rates: number[];
  high: number;
  low: number;
  open: number;
  close: number;
}> = new Map();

// Cache for FX rates (1 minute)
let fxRateCache: Map<string, { data: LiveFxRate; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 1000;

/**
 * Lit le dernier taux publié dans le référentiel SONASP.
 *
 * Les API de marché sont interrogées par la tâche Edge planifiée. Les appeler
 * depuis le navigateur provoquait des erreurs CORS et créait plusieurs valeurs
 * concurrentes sur un même écran.
 */
export async function fetchLiveFxRate(currencyPair: string): Promise<LiveFxRate | null> {
  // Check cache
  const cached = fxRateCache.get(currencyPair);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('fx_rates_daily')
      .select('currency_pair, rate, rate_date, bid_rate, ask_rate, spread, updated_at')
      .eq('currency_pair', currencyPair)
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const rate = Number(data.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;

    const parsedTimestamp = Date.parse(data.updated_at ?? data.rate_date);
    const liveRate: LiveFxRate = {
      currencyPair,
      rate,
      bidRate: data.bid_rate === null ? undefined : Number(data.bid_rate),
      askRate: data.ask_rate === null ? undefined : Number(data.ask_rate),
      spread: data.spread === null ? undefined : Number(data.spread),
      timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
      source: 'Référentiel SONASP',
    };

    fxRateCache.set(currencyPair, { data: liveRate, timestamp: Date.now() });
    return liveRate;
  } catch (error) {
    console.error(`Erreur de lecture du taux ${currencyPair}:`, error);
    return null;
  }
}

/**
 * Fetch multiple currency pairs at once
 */
export async function fetchMultipleFxRates(
  currencyPairs: string[]
): Promise<Map<string, LiveFxRate>> {
  const results = new Map<string, LiveFxRate>();

  await Promise.all(
    currencyPairs.map(async (pair) => {
      const rate = await fetchLiveFxRate(pair);
      if (rate) {
        results.set(pair, rate);
      }
    })
  );

  return results;
}
/**
 * Save end-of-day FX rate snapshot
 */
export async function saveEndOfDayFxSnapshot(
  currencyPair: string,
  sourceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tracking = intradayRates.get(currencyPair);

    if (!tracking || tracking.rates.length === 0) {
      // Aucun releve intrajournalier n'est enregistre : la fonction qui
      // alimentait `intradayRates` n'etait appelee de nulle part et a ete
      // retiree. Ce chemin est donc le seul emprunte, et l'instantane
      // quotidien porte un point unique — ouverture, plus haut, plus bas et
      // cloture y sont egaux.
      const liveRate = await fetchLiveFxRate(currencyPair);
      if (!liveRate) {
        return { success: false, error: 'No rate data available' };
      }

      const snapshot: DailyFxSnapshot = {
        rate_date: today,
        currency_pair: currencyPair,
        source_id: sourceId,
        rate: liveRate.rate,
        bid_rate: liveRate.bidRate || null,
        ask_rate: liveRate.askRate || null,
        spread: liveRate.spread || null,
        opening_rate: liveRate.rate,
        closing_rate: liveRate.rate,
        high_rate: liveRate.rate,
        low_rate: liveRate.rate,
        avg_rate: liveRate.rate,
        data_points: 1,
      };

      const { error } = await supabase
        .from('fx_rates_daily')
        .upsert(snapshot, { onConflict: 'rate_date,currency_pair,source_id' });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    }

    // Calculate daily statistics
    const avgRate = tracking.rates.reduce((sum, r) => sum + r, 0) / tracking.rates.length;

    const snapshot: DailyFxSnapshot = {
      rate_date: today,
      currency_pair: currencyPair,
      source_id: sourceId,
      rate: tracking.close,
      bid_rate: null,
      ask_rate: null,
      spread: null,
      opening_rate: tracking.open,
      closing_rate: tracking.close,
      high_rate: tracking.high,
      low_rate: tracking.low,
      avg_rate: parseFloat(avgRate.toFixed(6)),
      data_points: tracking.rates.length,
    };

    const { error } = await supabase
      .from('fx_rates_daily')
      .upsert(snapshot, { onConflict: 'rate_date,currency_pair,source_id' });

    if (error) {
      return { success: false, error: error.message };
    }

    // Reset tracking
    intradayRates.delete(currencyPair);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
/**
 * Save all end-of-day snapshots for configured pairs
 */
export async function saveAllEndOfDaySnapshots(
  sourceId: string
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const currencyPairs = ['EUR/USD', 'USD/XOF', 'EUR/XOF'];
  const results = {
    success: true,
    processed: 0,
    errors: [] as string[],
  };

  for (const pair of currencyPairs) {
    const result = await saveEndOfDayFxSnapshot(pair, sourceId);
    if (result.success) {
      results.processed++;
    } else {
      results.errors.push(`${pair}: ${result.error}`);
    }
  }

  results.success = results.errors.length === 0;
  return results;
}

/**
 * Clear FX rate cache
 */
export function clearFxRateCache(): void {
  fxRateCache.clear();
}

/**
 * Format FX rate for display
 */
export function formatFxRate(rate: number, decimals: number = 6): string {
  return rate.toFixed(decimals);
}
