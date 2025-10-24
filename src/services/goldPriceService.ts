import { supabase } from '@/lib/supabase';

export interface GoldPrice {
  id: string;
  price_date: string;
  london_am_rate: number;
  london_pm_rate?: number;
  opening_price?: number;
  closing_price?: number;
  high_price?: number;
  low_price?: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PriceTrend {
  date: string;
  price: number;
  change: number;
  change_percentage: number;
}

export const goldPriceService = {
  async getCurrentPrice(): Promise<number | null> {
    try {
      const { data, error } = await supabase.rpc('get_current_gold_price');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching current gold price:', error);
      return null;
    }
  },

  async getPriceHistory(
    startDate: string,
    endDate: string
  ): Promise<GoldPrice[]> {
    try {
      const { data, error } = await supabase
        .from('gold_prices')
        .select('*')
        .gte('price_date', startDate)
        .lte('price_date', endDate)
        .order('price_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching price history:', error);
      return [];
    }
  },

  async getPriceTrend(days: number = 30): Promise<PriceTrend[]> {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const prices = await this.getPriceHistory(startDate, endDate);

      const trends: PriceTrend[] = [];
      for (let i = 1; i < prices.length; i++) {
        const current = prices[i];
        const previous = prices[i - 1];
        const change = current.london_am_rate - previous.london_am_rate;
        const changePercentage = (change / previous.london_am_rate) * 100;

        trends.push({
          date: current.price_date,
          price: current.london_am_rate,
          change,
          change_percentage: changePercentage,
        });
      }

      return trends;
    } catch (error) {
      console.error('Error calculating price trend:', error);
      return [];
    }
  },

  async fetchAlphaVantagePrice(apiKey?: string): Promise<boolean> {
    try {
      if (!apiKey) {
        const { data: config } = await supabase
          .from('api_configurations')
          .select('api_key')
          .eq('api_name', 'alphavantage')
          .single();

        apiKey = config?.api_key;
      }

      if (!apiKey) {
        console.error('No API key configured for Alpha Vantage');
        return false;
      }

      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error('Failed to fetch gold price from Alpha Vantage');
        return false;
      }

      const data = await response.json();

      if (data['Realtime Currency Exchange Rate']) {
        const rate = parseFloat(
          data['Realtime Currency Exchange Rate']['5. Exchange Rate']
        );

        const pricePerOunce = rate;

        const { error } = await supabase.from('gold_prices').upsert(
          [
            {
              price_date: new Date().toISOString().split('T')[0],
              london_am_rate: pricePerOunce,
              source: 'alphavantage',
            },
          ],
          {
            onConflict: 'price_date',
          }
        );

        if (error) throw error;

        await supabase
          .from('api_configurations')
          .update({
            last_success: new Date().toISOString(),
            failure_count: 0,
          })
          .eq('api_name', 'alphavantage');

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error fetching Alpha Vantage price:', error);

      await supabase
        .from('api_configurations')
        .update({
          last_failure: new Date().toISOString(),
        })
        .eq('api_name', 'alphavantage');

      return false;
    }
  },

  async getMovingAverage(days: number = 30): Promise<number | null> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('gold_prices')
        .select('london_am_rate')
        .gte('price_date', startDate)
        .order('price_date', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const sum = data.reduce((acc, price) => acc + price.london_am_rate, 0);
      return sum / data.length;
    } catch (error) {
      console.error('Error calculating moving average:', error);
      return null;
    }
  },

  async getVolatility(days: number = 30): Promise<number | null> {
    try {
      const trends = await this.getPriceTrend(days);
      if (trends.length === 0) return null;

      const changes = trends.map((t) => t.change_percentage);
      const mean =
        changes.reduce((acc, val) => acc + val, 0) / changes.length;
      const variance =
        changes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        changes.length;

      return Math.sqrt(variance);
    } catch (error) {
      console.error('Error calculating volatility:', error);
      return null;
    }
  },

  async checkPriceAlert(threshold: number = 0.05): Promise<boolean> {
    try {
      const trends = await this.getPriceTrend(1);
      if (trends.length === 0) return false;

      const latestChange = Math.abs(trends[trends.length - 1].change_percentage) / 100;
      return latestChange > threshold;
    } catch (error) {
      console.error('Error checking price alert:', error);
      return false;
    }
  },

  async savePrice(price: Partial<GoldPrice>): Promise<boolean> {
    try {
      const { error } = await supabase.from('gold_prices').insert([price]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving price:', error);
      return false;
    }
  },

  async getPriceRange(days: number = 30): Promise<{
    high: number;
    low: number;
    average: number;
  } | null> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('gold_prices')
        .select('london_am_rate')
        .gte('price_date', startDate);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const prices = data.map((p) => p.london_am_rate);
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const average = prices.reduce((acc, val) => acc + val, 0) / prices.length;

      return { high, low, average };
    } catch (error) {
      console.error('Error calculating price range:', error);
      return null;
    }
  },
};
