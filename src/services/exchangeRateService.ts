import { supabase } from '@/lib/supabase';
import { getLatestReferentialFxRate, getReferentialFxRates } from '@/services/fxRateReferential';

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
}

export interface ECBRatesResponse {
  rates: {
    [currency: string]: number;
  };
  base: string;
  date: string;
}

const ECB_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const FALLBACK_ECB_URL = 'https://open.er-api.com/v6/latest/USD';

async function fetchECBRates(): Promise<{ success: boolean; data?: ECBRatesResponse; error?: string }> {
  try {
    let response = await fetch(ECB_API_URL);

    if (!response.ok) {
      response = await fetch(FALLBACK_ECB_URL);
    }

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch exchange rates from both APIs' };
    }

    const data = await response.json();

    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching ECB rates:', error);
    return { success: false, error: error.message };
  }
}

export async function updateExchangeRates(): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    const result = await fetchECBRates();

    if (!result.success || !result.data) {
      return { success: false, updated: 0, error: result.error };
    }

    const { rates, date } = result.data;
    const records = [
      rates.XOF ? { currency_pair: 'USD/XOF', rate: rates.XOF } : null,
      rates.EUR ? { currency_pair: 'EUR/USD', rate: 1 / rates.EUR } : null,
      rates.EUR && rates.XOF ? { currency_pair: 'EUR/XOF', rate: rates.XOF / rates.EUR } : null,
    ].filter((row): row is { currency_pair: string; rate: number } => Boolean(row));

    let updatedCount = 0;
    for (const record of records) {
      const { error } = await supabase.from('fx_rates_daily').insert({
        ...record,
        rate_date: date,
        notes: 'Import quotidien du référentiel de change',
      });
      if (!error || error.code === '23505') updatedCount++;
    }

    return { success: true, updated: updatedCount };
  } catch (error: any) {
    console.error('Error updating exchange rates:', error);
    return { success: false, updated: 0, error: error.message };
  }
}

export async function getLatestRate(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{ success: boolean; data?: ExchangeRate; error?: string }> {
  try {
    const data = await getLatestReferentialFxRate(fromCurrency, toCurrency);
    return data
      ? { success: true, data }
      : { success: false, error: 'Rate not found' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getRateHistory(
  fromCurrency: string,
  toCurrency: string = 'USD',
  days: number = 30
): Promise<{ success: boolean; data?: ExchangeRate[]; error?: string }> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const data = (await getReferentialFxRates(fromCurrency, toCurrency, Math.max(days, 2)))
      .filter((rate) => rate.rate_date >= startDate.toISOString().split('T')[0])
      .reverse();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{ success: boolean; amount?: number; rate?: number; error?: string }> {
  try {
    const rateResult = await getLatestRate(fromCurrency, toCurrency);

    if (!rateResult.success || !rateResult.data) {
      return { success: false, error: 'Rate not found' };
    }

    const convertedAmount = amount * rateResult.data.rate;

    return {
      success: true,
      amount: convertedAmount,
      rate: rateResult.data.rate,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function compareRates(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{
  success: boolean;
  data?: {
    current: number;
    previous: number;
    change: number;
    change_percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  error?: string;
}> {
  try {
    const data = await getReferentialFxRates(fromCurrency, toCurrency, 2);
    if (data.length < 2) {
      return { success: false, error: 'Insufficient data for comparison' };
    }

    const current = data[0].rate;
    const previous = data[1].rate;
    const change = current - previous;
    const changePercentage = (change / previous) * 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercentage > 0.1) {
      trend = 'up';
    } else if (changePercentage < -0.1) {
      trend = 'down';
    }

    return {
      success: true,
      data: {
        current,
        previous,
        change,
        change_percentage: changePercentage,
        trend,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMultiCurrencyRates(
  currencies: string[],
  toCurrency: string = 'USD'
): Promise<{
  success: boolean;
  data?: Array<{
    currency: string;
    rate: number;
    rate_date: string;
  }>;
  error?: string;
}> {
  try {
    const rates = await Promise.all(
      currencies.map(async (currency) => {
        const result = await getLatestRate(currency, toCurrency);
        if (result.success && result.data) {
          return {
            currency,
            rate: result.data.rate,
            rate_date: result.data.rate_date,
          };
        }
        return null;
      })
    );

    const validRates = rates.filter(r => r !== null) as Array<{
      currency: string;
      rate: number;
      rate_date: string;
    }>;

    return { success: true, data: validRates };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function calculateFXSpread(
  fromCurrency: string,
  toCurrency: string = 'USD',
  marginPercentage: number = 2
): Promise<{
  success: boolean;
  data?: {
    market_rate: number;
    buy_rate: number;
    sell_rate: number;
    spread: number;
  };
  error?: string;
}> {
  try {
    const rateResult = await getLatestRate(fromCurrency, toCurrency);

    if (!rateResult.success || !rateResult.data) {
      return { success: false, error: 'Rate not found' };
    }

    const marketRate = rateResult.data.rate;
    const spreadAmount = marketRate * (marginPercentage / 100);
    const buyRate = marketRate - spreadAmount;
    const sellRate = marketRate + spreadAmount;

    return {
      success: true,
      data: {
        market_rate: marketRate,
        buy_rate: buyRate,
        sell_rate: sellRate,
        spread: spreadAmount * 2,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency === 'XOF' ? 'USD' : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function getRateAlerts(
  threshold: number = 5
): Promise<{
  success: boolean;
  data?: Array<{
    currency: string;
    current_rate: number;
    change_percentage: number;
    alert_type: 'increase' | 'decrease';
  }>;
  error?: string;
}> {
  try {
    const currencies = ['XOF', 'EUR'];
    const alerts = [];

    for (const currency of currencies) {
      const comparison = await compareRates(currency, 'USD');
      if (comparison.success && comparison.data) {
        const { current, change_percentage } = comparison.data;
        if (Math.abs(change_percentage) > threshold) {
          alerts.push({
            currency,
            current_rate: current,
            change_percentage,
            alert_type: change_percentage > 0 ? 'increase' : 'decrease',
          });
        }
      }
    }

    return { success: true, data: alerts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
