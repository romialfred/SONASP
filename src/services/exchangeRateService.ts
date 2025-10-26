import { supabase } from '@/lib/supabase';

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
    const targetCurrencies = ['XOF', 'GNF', 'EUR', 'GBP', 'CHF'];
    let updatedCount = 0;

    for (const currency of targetCurrencies) {
      if (rates[currency]) {
        const { error } = await supabase
          .from('fx_rates')
          .upsert({
            from_currency: currency,
            to_currency: 'USD',
            rate: 1 / rates[currency],
            rate_date: date,
            source: 'ECB',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'from_currency,to_currency,rate_date',
          });

        if (!error) {
          updatedCount++;
        } else {
          console.error(`Error updating ${currency} rate:`, error);
        }
      }
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
    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
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

    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .gte('rate_date', startDate.toISOString().split('T')[0])
      .order('rate_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
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
    const { data, error } = await supabase
      .from('fx_rates')
      .select('rate, rate_date')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('rate_date', { ascending: false })
      .limit(2);

    if (error || !data || data.length < 2) {
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
    currency: currency === 'XOF' || currency === 'GNF' ? 'USD' : currency,
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
    const currencies = ['XOF', 'GNF', 'EUR'];
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
