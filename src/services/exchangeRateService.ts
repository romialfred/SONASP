import { supabase } from '@/lib/supabase';

export interface ExchangeRate {
  id: string;
  rate_date: string;
  base_currency: string;
  target_currency: string;
  rate: number;
  open_rate?: number;
  close_rate?: number;
  high_rate?: number;
  low_rate?: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface RateChange {
  current_rate: number;
  previous_rate: number;
  change_amount: number;
  change_percentage: number;
}

export interface FetchRatesParams {
  currencies: string[];
  source?: string;
}

const ECB_API_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.';

export const exchangeRateService = {
  async getCurrentRate(currency: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_current_exchange_rate', { p_target_currency: currency });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching current rate:', error);
      return null;
    }
  },

  async getRateHistory(
    currency: string,
    startDate: string,
    endDate: string
  ): Promise<ExchangeRate[]> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('target_currency', currency)
        .gte('rate_date', startDate)
        .lte('rate_date', endDate)
        .order('rate_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching rate history:', error);
      return [];
    }
  },

  async getRateChange(
    currency: string,
    days: number = 30
  ): Promise<RateChange | null> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_rate_change', {
          p_currency: currency,
          p_days: days,
        })
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error calculating rate change:', error);
      return null;
    }
  },

  async fetchECBRates(currencies: string[]): Promise<boolean> {
    try {
      const rates: Partial<ExchangeRate>[] = [];

      for (const currency of currencies) {
        const currencyCode = currency === 'XOF' ? 'XOF' : 'GNF';
        const url = `${ECB_API_URL}${currencyCode}.EUR.SP00.A?format=jsondata&detail=dataonly&lastNObservations=1`;

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch ECB rate for ${currency}`);
          continue;
        }

        const data = await response.json();

        if (data.dataSets && data.dataSets[0]?.series) {
          const series = Object.values(data.dataSets[0].series)[0] as any;
          const observations = series?.observations;

          if (observations) {
            const latestKey = Object.keys(observations).pop();
            if (latestKey) {
              const rateValue = observations[latestKey][0];

              rates.push({
                rate_date: new Date().toISOString().split('T')[0],
                base_currency: 'USD',
                target_currency: currency,
                rate: parseFloat(rateValue),
                source: 'ecb',
              });
            }
          }
        }
      }

      if (rates.length > 0) {
        const { error } = await supabase
          .from('exchange_rates')
          .upsert(rates, {
            onConflict: 'rate_date,base_currency,target_currency',
          });

        if (error) throw error;

        await supabase
          .from('api_configurations')
          .update({
            last_success: new Date().toISOString(),
            failure_count: 0,
            calls_today: supabase.rpc('increment_api_calls', { api_name: 'ecb' }),
          })
          .eq('api_name', 'ecb');

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error fetching ECB rates:', error);

      await supabase
        .from('api_configurations')
        .update({
          last_failure: new Date().toISOString(),
          failure_count: supabase.rpc('increment', { column: 'failure_count' }),
        })
        .eq('api_name', 'ecb');

      return false;
    }
  },

  async getLatestRates(): Promise<Record<string, ExchangeRate>> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .in('target_currency', ['XOF', 'GNF'])
        .order('rate_date', { ascending: false })
        .limit(2);

      if (error) throw error;

      const ratesMap: Record<string, ExchangeRate> = {};
      data?.forEach((rate) => {
        ratesMap[rate.target_currency] = rate;
      });

      return ratesMap;
    } catch (error) {
      console.error('Error fetching latest rates:', error);
      return {};
    }
  },

  async getRateSpread(rate1: number, rate2: number): Promise<number> {
    return Math.abs(rate1 - rate2) / rate1;
  },

  async saveRate(rate: Partial<ExchangeRate>): Promise<boolean> {
    try {
      const { error } = await supabase.from('exchange_rates').insert([rate]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving rate:', error);
      return false;
    }
  },

  async checkRateAlert(
    currency: string,
    threshold: number = 0.05
  ): Promise<boolean> {
    try {
      const change = await this.getRateChange(currency, 1);
      if (!change) return false;

      const changePercent = Math.abs(change.change_percentage) / 100;
      return changePercent > threshold;
    } catch (error) {
      console.error('Error checking rate alert:', error);
      return false;
    }
  },
};
