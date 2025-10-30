/**
 * FX Rate Aggregation Service
 *
 * Handles real-time FX rates, end-of-day persistence, and monthly aggregation
 * Supports: EUR/USD, USD/XOF, USD/GNF, EUR/GNF, XOF/GNF
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

// FX API configurations with fallback
const FX_API_CONFIG = {
  frankfurter: {
    url: 'https://api.frankfurter.dev/v1/latest',
    free: true,
  },
  exchangerate: {
    url: 'https://api.exchangerate-api.com/v4/latest',
    free: true,
  },
  currencyfreaks: {
    url: 'https://api.currencyfreaks.com/latest',
    apiKey: 'demo', // Free tier
  },
};

// Cache for FX rates (1 minute)
let fxRateCache: Map<string, { data: LiveFxRate; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 1000;

/**
 * Fetch live FX rate for a currency pair
 */
export async function fetchLiveFxRate(currencyPair: string): Promise<LiveFxRate | null> {
  const [base, quote] = currencyPair.split('/');

  // Check cache
  const cached = fxRateCache.get(currencyPair);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Try Frankfurter API first
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`
    );

    if (response.ok) {
      const data = await response.json();
      const rate = data.rates[quote];

      if (rate) {
        const liveRate: LiveFxRate = {
          currencyPair,
          rate,
          timestamp: Date.now(),
          source: 'Frankfurter',
        };

        // Cache it
        fxRateCache.set(currencyPair, {
          data: liveRate,
          timestamp: Date.now(),
        });

        // Record for aggregation
        recordIntradayFxRate(currencyPair, rate);

        return liveRate;
      }
    }

    // Fallback to ExchangeRate-API
    const fallbackResponse = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${base}`
    );

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      const rate = fallbackData.rates[quote];

      if (rate) {
        const liveRate: LiveFxRate = {
          currencyPair,
          rate,
          timestamp: Date.now(),
          source: 'ExchangeRate-API',
        };

        fxRateCache.set(currencyPair, {
          data: liveRate,
          timestamp: Date.now(),
        });

        recordIntradayFxRate(currencyPair, rate);

        return liveRate;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching FX rate for ${currencyPair}:`, error);
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
 * Record intraday FX rate for aggregation
 */
function recordIntradayFxRate(currencyPair: string, rate: number): void {
  let tracking = intradayRates.get(currencyPair);

  if (!tracking) {
    tracking = {
      rates: [],
      high: rate,
      low: rate,
      open: rate,
      close: rate,
    };
    intradayRates.set(currencyPair, tracking);
  }

  tracking.rates.push(rate);
  tracking.high = Math.max(tracking.high, rate);
  tracking.low = Math.min(tracking.low, rate);
  tracking.close = rate;
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
      // Fetch current rate if no tracking
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
 * Generate monthly FX aggregate
 */
export async function generateMonthlyFxAggregate(
  year: number,
  month: number,
  currencyPair: string,
  sourceId: string
): Promise<{ success: boolean; data?: MonthlyFxAggregate; error?: string }> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data: dailyRates, error } = await supabase
      .from('fx_rates_daily')
      .select('*')
      .eq('currency_pair', currencyPair)
      .eq('source_id', sourceId)
      .gte('rate_date', startDate)
      .lt('rate_date', endDate)
      .order('rate_date', { ascending: true });

    if (error || !dailyRates || dailyRates.length === 0) {
      return { success: false, error: 'No daily data available' };
    }

    const rates = dailyRates.map(d => d.avg_rate);
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const minRate = Math.min(...dailyRates.map(d => d.low_rate));
    const maxRate = Math.max(...dailyRates.map(d => d.high_rate));

    // Calculate volatility
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / rates.length;
    const volatility = Math.sqrt(variance);

    const aggregate: MonthlyFxAggregate = {
      year,
      month,
      currency_pair: currencyPair,
      source_id: sourceId,
      avg_rate: parseFloat(avgRate.toFixed(6)),
      min_rate: parseFloat(minRate.toFixed(6)),
      max_rate: parseFloat(maxRate.toFixed(6)),
      opening_rate: dailyRates[0].opening_rate,
      closing_rate: dailyRates[dailyRates.length - 1].closing_rate,
      data_points: dailyRates.length,
      volatility: parseFloat(volatility.toFixed(6)),
    };

    const { error: upsertError } = await supabase
      .from('fx_rates_monthly')
      .upsert(aggregate, { onConflict: 'year,month,currency_pair,source_id' });

    if (upsertError) {
      return { success: false, error: upsertError.message };
    }

    return { success: true, data: aggregate };
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
  const currencyPairs = ['EUR/USD', 'USD/XOF', 'USD/GNF', 'EUR/GNF', 'XOF/GNF'];
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
