/**
 * Gold Price Aggregation Service
 *
 * Handles end-of-day data persistence and monthly aggregation
 * of live gold price data from APIs into database
 */

import { supabase } from '@/lib/supabase';
import { fetchLiveGoldPrice } from './liveGoldPriceService';

export interface DailyGoldPriceSnapshot {
  price_date: string;
  opening_price: number;
  closing_price: number;
  high_price: number;
  low_price: number;
  london_am_rate: number;
  london_pm_rate: number;
  spot_price: number;
  average_price: number;
  source: string;
  currency: string;
  data_points: number;
}

export interface MonthlyGoldPriceAggregate {
  year: number;
  month: number;
  average_price: number;
  high_price: number;
  low_price: number;
  opening_price: number;
  closing_price: number;
  total_days: number;
  volatility: number;
}

// Track intraday prices for end-of-day aggregation
let intradayPrices: number[] = [];
let dayHighPrice: number = 0;
let dayLowPrice: number = Infinity;
let dayOpenPrice: number = 0;
let lastClosePrice: number = 0;

/**
 * Record intraday price for later aggregation
 */
export function recordIntradayPrice(price: number): void {
  if (intradayPrices.length === 0) {
    dayOpenPrice = price;
  }

  intradayPrices.push(price);
  dayHighPrice = Math.max(dayHighPrice, price);
  dayLowPrice = Math.min(dayLowPrice, price);
  lastClosePrice = price;
}

/**
 * Save end-of-day gold price snapshot to database
 */
export async function saveEndOfDaySnapshot(): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch current live price
    const livePrice = await fetchLiveGoldPrice();

    if (!livePrice) {
      return { success: false, error: 'No live price data available' };
    }

    // Calculate daily statistics
    const openingPrice = dayOpenPrice || livePrice.price;
    const closingPrice = lastClosePrice || livePrice.price;
    const highPrice = dayHighPrice > 0 ? dayHighPrice : (livePrice.high24h || livePrice.price * 1.008);
    const lowPrice = dayLowPrice < Infinity ? dayLowPrice : (livePrice.low24h || livePrice.price * 0.992);
    const averagePrice = intradayPrices.length > 0
      ? intradayPrices.reduce((sum, p) => sum + p, 0) / intradayPrices.length
      : livePrice.price;

    const snapshot: DailyGoldPriceSnapshot = {
      price_date: today,
      opening_price: openingPrice,
      closing_price: closingPrice,
      high_price: highPrice,
      low_price: lowPrice,
      london_am_rate: livePrice.price * 0.998, // Approximate AM fix
      london_pm_rate: livePrice.price * 1.002, // Approximate PM fix
      spot_price: livePrice.price,
      average_price: averagePrice,
      source: livePrice.source,
      currency: livePrice.currency,
      data_points: intradayPrices.length || 1,
    };

    // Upsert into database
    const { error } = await supabase
      .from('gold_prices_daily')
      .upsert(snapshot, {
        onConflict: 'price_date',
      });

    if (error) {
      console.error('Error saving daily snapshot:', error);
      return { success: false, error: error.message };
    }

    // Reset intraday tracking
    intradayPrices = [];
    dayHighPrice = 0;
    dayLowPrice = Infinity;
    dayOpenPrice = 0;

    return { success: true };
  } catch (error: any) {
    console.error('Error in saveEndOfDaySnapshot:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate monthly aggregate from daily data
 */
export async function generateMonthlyAggregate(
  year: number,
  month: number
): Promise<{ success: boolean; data?: MonthlyGoldPriceAggregate; error?: string }> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Fetch all daily prices for the month
    const { data: dailyPrices, error } = await supabase
      .from('gold_prices_daily')
      .select('*')
      .gte('price_date', startDate)
      .lt('price_date', endDate)
      .order('price_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!dailyPrices || dailyPrices.length === 0) {
      return { success: false, error: 'No daily data available for aggregation' };
    }

    // Calculate aggregates
    const prices = dailyPrices.map(d => d.average_price);
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const highPrice = Math.max(...dailyPrices.map(d => d.high_price));
    const lowPrice = Math.min(...dailyPrices.map(d => d.low_price));
    const openingPrice = dailyPrices[0].opening_price;
    const closingPrice = dailyPrices[dailyPrices.length - 1].closing_price;

    // Calculate volatility (standard deviation)
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - averagePrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    const aggregate: MonthlyGoldPriceAggregate = {
      year,
      month,
      average_price: parseFloat(averagePrice.toFixed(2)),
      high_price: parseFloat(highPrice.toFixed(2)),
      low_price: parseFloat(lowPrice.toFixed(2)),
      opening_price: parseFloat(openingPrice.toFixed(2)),
      closing_price: parseFloat(closingPrice.toFixed(2)),
      total_days: dailyPrices.length,
      volatility: parseFloat(volatility.toFixed(2)),
    };

    // Upsert into monthly table
    const { error: upsertError } = await supabase
      .from('gold_prices_monthly')
      .upsert(aggregate, {
        onConflict: 'year,month',
      });

    if (upsertError) {
      return { success: false, error: upsertError.message };
    }

    return { success: true, data: aggregate };
  } catch (error: any) {
    console.error('Error generating monthly aggregate:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-aggregate for current month (called at month end)
 */
export async function autoAggregateCurrentMonth(): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScript months are 0-indexed

  return await generateMonthlyAggregate(year, month);
}

/**
 * Backfill monthly aggregates for a year
 */
export async function backfillMonthlyAggregates(
  year: number
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const results = {
    success: true,
    processed: 0,
    errors: [] as string[],
  };

  for (let month = 1; month <= 12; month++) {
    const result = await generateMonthlyAggregate(year, month);

    if (result.success) {
      results.processed++;
    } else {
      results.errors.push(`Month ${month}: ${result.error}`);
    }
  }

  results.success = results.errors.length === 0;
  return results;
}

/**
 * Get daily price statistics for a date range
 */
export async function getDailyPriceStatistics(
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  data?: {
    average: number;
    high: number;
    low: number;
    volatility: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    days: number;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('gold_prices_daily')
      .select('average_price, high_price, low_price, closing_price')
      .gte('price_date', startDate)
      .lte('price_date', endDate)
      .order('price_date', { ascending: true });

    if (error || !data || data.length === 0) {
      return { success: false, error: 'No data available' };
    }

    const prices = data.map(d => d.average_price);
    const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const high = Math.max(...data.map(d => d.high_price));
    const low = Math.min(...data.map(d => d.low_price));

    // Calculate volatility
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    // Determine trend
    const firstPrice = data[0].closing_price;
    const lastPrice = data[data.length - 1].closing_price;
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (priceChange > 1) trend = 'bullish';
    else if (priceChange < -1) trend = 'bearish';

    return {
      success: true,
      data: {
        average: parseFloat(average.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2)),
        trend,
        days: data.length,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Schedule end-of-day snapshot (to be called by cron/scheduler)
 */
export function scheduleEndOfDaySnapshot(): NodeJS.Timeout {
  // Calculate milliseconds until end of day (23:59:59)
  const now = new Date();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  const timeUntilEndOfDay = endOfDay.getTime() - now.getTime();

  // Schedule snapshot
  return setTimeout(async () => {
    await saveEndOfDaySnapshot();

    // If it's the last day of the month, generate aggregate
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (tomorrow.getDate() === 1) {
      await autoAggregateCurrentMonth();
    }

    // Reschedule for next day
    scheduleEndOfDaySnapshot();
  }, timeUntilEndOfDay);
}
