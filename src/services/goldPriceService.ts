import { supabase } from '@/lib/supabase';
import { fetchLiveGoldPrice } from './liveGoldPriceService';

/**
 * Un relevé quotidien, tel que `gold_prices_daily` le porte.
 *
 * Cette interface déclarait `opening_price` et `closing_price`, deux colonnes
 * que la table ne possède pas : elles valaient donc `undefined` à chaque
 * lecture. Le cours d'ouverture et de clôture d'une journée, ce sont les deux
 * fixings de Londres — `london_am_rate` le matin, `london_pm_rate` l'après-midi,
 * ce dernier pouvant manquer tant que la séance n'est pas close.
 */
export interface GoldPrice {
  id: string;
  price_date: string;
  high_price: number | null;
  low_price: number | null;
  london_am_rate: number;
  london_pm_rate: number | null;
  source: string | null;
  currency: string | null;
}

export interface GoldPriceStats {
  current_price: number;
  previous_price: number;
  change: number;
  change_percentage: number;
  trend: 'up' | 'down' | 'stable';
  avg_30_days: number;
  high_30_days: number;
  low_30_days: number;
}

/**
 * Fetch real-time gold price using the live service with multiple API fallbacks
 */
async function fetchGoldPrice(): Promise<{ success: boolean; price?: number; error?: string }> {
  try {
    const livePrice = await fetchLiveGoldPrice();

    if (!livePrice || !livePrice.price) {
      return { success: false, error: 'Price data not available' };
    }

    console.log(`Fetched live gold price: $${livePrice.price} from ${livePrice.source}`);
    return { success: true, price: livePrice.price };
  } catch (error: any) {
    console.error('Error fetching gold price:', error);
    return { success: false, error: error.message };
  }
}

export async function updateDailyGoldPrice(): Promise<{ success: boolean; error?: string }> {
  try {
    const priceResult = await fetchGoldPrice();

    if (!priceResult.success || !priceResult.price) {
      return { success: false, error: priceResult.error };
    }

    const today = new Date().toISOString().split('T')[0];
    const price = priceResult.price;

    const { error } = await supabase
      .from('gold_prices_daily')
      .upsert({
        price_date: today,
        high_price: price * 1.005,
        low_price: price * 0.995,
        london_am_rate: price, // Use actual live price for London AM rate
        london_pm_rate: price * 1.002,
        source: 'Live API',
        currency: 'USD',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'price_date',
      });

    if (error) {
      console.error('Error updating gold price:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateDailyGoldPrice:', error);
    return { success: false, error: error.message };
  }
}

export async function getCurrentGoldPrice(): Promise<{
  success: boolean;
  data?: GoldPrice;
  error?: string;
}> {
  try {
    console.log('🟡 [GOLD PRICE] Getting current gold price...');
    const today = new Date().toISOString().split('T')[0];
    console.log('🟡 [GOLD PRICE] Today\'s date:', today);

    console.log('🟡 [GOLD PRICE] Querying gold_prices_daily table...');
    const { data: existingData, error: fetchError } = await supabase
      .from('gold_prices_daily')
      .select('*')
      .eq('price_date', today)
      .maybeSingle();

    console.log('🟡 [GOLD PRICE] Query result:', {
      hasData: !!existingData,
      hasError: !!fetchError,
      errorCode: fetchError?.code
    });

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ [GOLD PRICE] Error fetching gold price:', fetchError);
    }

    const now = new Date();
    const lastUpdate = existingData?.updated_at ?? existingData?.created_at;
    const dataAge = lastUpdate
      ? now.getTime() - new Date(lastUpdate).getTime()
      : Infinity;

    const shouldUpdate = !existingData || dataAge > 60000;
    console.log('🟡 [GOLD PRICE] Should update:', shouldUpdate, '(age:', dataAge, 'ms)');

    if (shouldUpdate) {
      const priceResult = await fetchGoldPrice();

      if (priceResult.success && priceResult.price) {
        const price = priceResult.price;

        const { data: updatedData, error: upsertError } = await supabase
          .from('gold_prices_daily')
          .upsert({
            price_date: today,
            high_price: Math.max(existingData?.high_price || 0, price * 1.005),
            low_price: existingData?.low_price
              ? Math.min(existingData.low_price, price * 0.995)
              : price * 0.995,
            london_am_rate: price, // Use actual live price - this is what's used for sales calculations
            london_pm_rate: price * 1.002,
            source: 'Live API',
            currency: 'USD',
            updated_at: now.toISOString(),
          }, {
            onConflict: 'price_date',
          })
          .select()
          .single();

        if (!upsertError && updatedData) {
          console.log(`Gold price updated in database: $${updatedData.london_am_rate}/oz for ${today}`);
          return { success: true, data: updatedData };
        }
      }
    }

    if (existingData) {
      console.log('✅ [GOLD PRICE] Returning existing data:', {
        date: existingData.price_date,
        price: existingData.london_am_rate
      });
      return { success: true, data: existingData };
    }

    console.log('🟡 [GOLD PRICE] No data for today, fetching latest...');
    const { data: latestData, error: latestError } = await supabase
      .from('gold_prices_daily')
      .select('*')
      .order('price_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error('❌ [GOLD PRICE] Error fetching latest:', latestError);
      return { success: false, error: latestError.message };
    }

    if (!latestData) {
      console.error('❌ [GOLD PRICE] No gold price data available in database');
      return { success: false, error: 'No gold price data available' };
    }

    console.log('✅ [GOLD PRICE] Returning latest data:', {
      date: latestData.price_date,
      price: latestData.london_am_rate
    });
    return { success: true, data: latestData };
  } catch (error: any) {
    console.error('❌ [GOLD PRICE] Exception:', error);
    return { success: false, error: error.message };
  }
}

export async function getGoldPriceHistory(
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; data?: GoldPrice[]; error?: string }> {
  try {
    let query = supabase
      .from('gold_prices_daily')
      .select('*')
      .order('price_date', { ascending: true });

    if (dateFrom) {
      query = query.gte('price_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('price_date', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getGoldPriceStatistics(): Promise<{
  success: boolean;
  data?: GoldPriceStats;
  error?: string;
}> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('gold_prices_daily')
      .select('london_am_rate, london_pm_rate, price_date, high_price, low_price')
      .gte('price_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('price_date', { ascending: false });

    if (error || !data || data.length < 2) {
      return { success: false, error: 'Insufficient data for statistics' };
    }

    const priceForDay = (row: (typeof data)[number]) => row.london_pm_rate ?? row.london_am_rate;
    const currentPrice = priceForDay(data[0]);
    const previousPrice = priceForDay(data[1]);
    const change = currentPrice - previousPrice;
    const changePercentage = (change / previousPrice) * 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercentage > 0.5) {
      trend = 'up';
    } else if (changePercentage < -0.5) {
      trend = 'down';
    }

    const prices = data.map(priceForDay);
    const avg30Days = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const high30Days = Math.max(...data.map((row) => row.high_price ?? priceForDay(row)));
    const low30Days = Math.min(...data.map((row) => row.low_price ?? priceForDay(row)));

    return {
      success: true,
      data: {
        current_price: currentPrice,
        previous_price: previousPrice,
        change,
        change_percentage: changePercentage,
        trend,
        avg_30_days: avg30Days,
        high_30_days: high30Days,
        low_30_days: low30Days,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMonthlyGoldPrices(
  year?: number,
  month?: number
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    let query = supabase
      .from('gold_prices_monthly')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (year) {
      query = query.eq('year', year);
    }

    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function compareSalesVsMarketPrices(
  dateFrom?: string,
  dateTo?: string
): Promise<{
  success: boolean;
  data?: Array<{
    sale_date: string;
    sale_price: number;
    market_price: number;
    variance: number;
    variance_percentage: number;
  }>;
  error?: string;
}> {
  try {
    let salesQuery = supabase
      .from('sales')
      .select('sale_date, london_am_rate, quantity_oz')
      .order('sale_date', { ascending: true });

    if (dateFrom) {
      salesQuery = salesQuery.gte('sale_date', dateFrom);
    }

    if (dateTo) {
      salesQuery = salesQuery.lte('sale_date', dateTo);
    }

    const { data: sales, error: salesError } = await salesQuery;

    if (salesError) {
      return { success: false, error: salesError.message };
    }

    if (!sales || sales.length === 0) {
      return { success: true, data: [] };
    }

    const comparisons = await Promise.all(
      sales.map(async (sale) => {
        const { data: goldPrice } = await supabase
          .from('gold_prices_daily')
          .select('london_am_rate')
          .eq('price_date', sale.sale_date ?? '')
          .single();

        if (!goldPrice) {
          return null;
        }

        const salePrice = sale.london_am_rate;
        const marketPrice = goldPrice.london_am_rate;
        const variance = salePrice - marketPrice;
        const variancePercentage = (variance / marketPrice) * 100;

        return {
          sale_date: sale.sale_date,
          sale_price: salePrice,
          market_price: marketPrice,
          variance,
          variance_percentage: variancePercentage,
        };
      })
    );

    const validComparisons = comparisons.filter(c => c !== null) as Array<{
      sale_date: string;
      sale_price: number;
      market_price: number;
      variance: number;
      variance_percentage: number;
    }>;

    return { success: true, data: validComparisons };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPriceAlerts(
  thresholdPercentage: number = 2
): Promise<{
  success: boolean;
  data?: {
    alert_type: 'price_increase' | 'price_decrease';
    current_price: number;
    change_percentage: number;
    message: string;
  };
  error?: string;
}> {
  try {
    const stats = await getGoldPriceStatistics();

    if (!stats.success || !stats.data) {
      return { success: false, error: 'Unable to get price statistics' };
    }

    const { change_percentage, current_price } = stats.data;

    if (Math.abs(change_percentage) > thresholdPercentage) {
      const alertType = change_percentage > 0 ? 'price_increase' : 'price_decrease';
      const message = `Gold price ${alertType === 'price_increase' ? 'increased' : 'decreased'} by ${Math.abs(change_percentage).toFixed(2)}%`;

      return {
        success: true,
        data: {
          alert_type: alertType,
          current_price,
          change_percentage,
          message,
        },
      };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function calculateGoldValue(
  weightOz: number,
  pricePerOz: number
): number {
  return weightOz * pricePerOz;
}

export function formatGoldPrice(
  price: number,
  currency: string = 'USD',
  locale: string = 'fr-FR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export async function getGoldPriceTrend(
  days: number = 30
): Promise<{
  success: boolean;
  data?: {
    trend: 'bullish' | 'bearish' | 'neutral';
    avg_price: number;
    volatility: number;
    recommendation: string;
  };
  error?: string;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('gold_prices_daily')
      .select('london_am_rate, london_pm_rate')
      .gte('price_date', startDate.toISOString().split('T')[0])
      .order('price_date', { ascending: true });

    if (error || !data || data.length < 2) {
      return { success: false, error: 'Insufficient data for trend analysis' };
    }

    const prices = data.map((row) => row.london_pm_rate ?? row.london_am_rate);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const overallChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let recommendation = 'Hold current position';

    if (overallChange > 2) {
      trend = 'bullish';
      recommendation = 'Consider selling if targets are met';
    } else if (overallChange < -2) {
      trend = 'bearish';
      recommendation = 'Monitor closely, consider holding';
    }

    return {
      success: true,
      data: {
        trend,
        avg_price: avgPrice,
        volatility,
        recommendation,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
