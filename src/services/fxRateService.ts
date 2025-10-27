import { supabase } from '@/lib/supabase';

interface ECBResponse {
  rates: {
    [key: string]: number;
  };
  base: string;
  date: string;
}

export const fetchECBRates = async (): Promise<ECBResponse | null> => {
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=EUR');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching ECB rates:', error);
    return null;
  }
};

export const saveDailyRates = async (
  rates: { [key: string]: number },
  date: string,
  sourceCode: string = 'ECB'
) => {
  try {
    const { data: source } = await supabase
      .from('fx_rate_sources')
      .select('id')
      .eq('code', sourceCode)
      .single();

    if (!source) {
      console.error('Source not found:', sourceCode);
      return { success: false, error: 'Source not found' };
    }

    const ratesToInsert = [];

    if (rates.USD) {
      ratesToInsert.push({
        rate_date: date,
        currency_pair: 'EUR/USD',
        source_id: source.id,
        rate: rates.USD,
      });
    }

    if (rates.XOF) {
      const usdToXof = rates.XOF / rates.USD;
      ratesToInsert.push({
        rate_date: date,
        currency_pair: 'USD/XOF',
        source_id: source.id,
        rate: usdToXof,
      });
    }

    if (rates.GNF) {
      const usdToGnf = rates.GNF / rates.USD;
      ratesToInsert.push({
        rate_date: date,
        currency_pair: 'USD/GNF',
        source_id: source.id,
        rate: usdToGnf,
      });

      ratesToInsert.push({
        rate_date: date,
        currency_pair: 'EUR/GNF',
        source_id: source.id,
        rate: rates.GNF,
      });
    }

    if (rates.XOF && rates.GNF) {
      const xofToGnf = rates.GNF / rates.XOF;
      ratesToInsert.push({
        rate_date: date,
        currency_pair: 'XOF/GNF',
        source_id: source.id,
        rate: xofToGnf,
      });
    }

    const { error } = await supabase
      .from('fx_rates_daily')
      .upsert(ratesToInsert, {
        onConflict: 'rate_date,currency_pair,source_id',
      });

    if (error) throw error;

    return { success: true, inserted: ratesToInsert.length };
  } catch (error: any) {
    console.error('Error saving daily rates:', error);
    return { success: false, error: error.message };
  }
};

export const calculateMonthlyAggregates = async (year: number, month: number) => {
  try {
    const { data, error } = await supabase.rpc('calculate_monthly_fx_aggregates', {
      p_year: year,
      p_month: month,
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error('Error calculating monthly aggregates:', error);
    return { success: false, error: error.message };
  }
};

export const getLatestRates = async (currencyPair?: string) => {
  try {
    let query = supabase
      .from('fx_rates_daily')
      .select(`
        *,
        fx_rate_sources(name, code)
      `)
      .order('rate_date', { ascending: false })
      .limit(10);

    if (currencyPair) {
      query = query.eq('currency_pair', currencyPair);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching latest rates:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getRateComparison = async (currencyPair: string, date: string) => {
  try {
    const { data, error } = await supabase
      .from('fx_rates_daily')
      .select(`
        *,
        fx_rate_sources(name, code)
      `)
      .eq('currency_pair', currencyPair)
      .eq('rate_date', date);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching rate comparison:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getCustomerRateHistory = async (customerId: string) => {
  try {
    const { data, error } = await supabase
      .from('customer_fx_rates')
      .select('*')
      .eq('customer_id', customerId)
      .order('transaction_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching customer rate history:', error);
    return { success: false, error: error.message, data: [] };
  }
};
