import { supabase } from '@/lib/supabase';

export interface AnalyticsCacheEntry {
  cache_key: string;
  cache_type: string;
  data: any;
  expires_at: string;
}

export interface SalesAnalytics {
  month: string;
  total_sales: number;
  total_quantity_oz: number;
  total_gross_proceeds: number;
  total_net_proceeds: number;
  avg_gold_price: number;
  unique_customers: number;
}

export interface CustomerAnalytics {
  customer_id: string;
  customer_name: string;
  total_purchases: number;
  total_spent: number;
  average_order_value: number;
  last_purchase_date: string;
}

export interface OperationalMetrics {
  total_batches: number;
  batches_in_transit: number;
  batches_at_refinery: number;
  average_processing_time: number;
  variance_incidents: number;
}

export const analyticsService = {
  async getCachedData(cacheKey: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('analytics_cache')
        .select('data, expires_at')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data?.data;
    } catch (error) {
      console.error('Error fetching cached data:', error);
      return null;
    }
  },

  async setCachedData(
    cacheKey: string,
    cacheType: string,
    data: any,
    ttlMinutes: number = 60
  ): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      const { error } = await supabase.from('analytics_cache').upsert(
        [
          {
            cache_key: cacheKey,
            cache_type: cacheType,
            data,
            expires_at: expiresAt,
          },
        ],
        {
          onConflict: 'cache_key',
        }
      );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting cached data:', error);
      return false;
    }
  },

  async invalidateCache(cacheKey?: string): Promise<boolean> {
    try {
      let query = supabase.from('analytics_cache').delete();

      if (cacheKey) {
        query = query.eq('cache_key', cacheKey);
      } else {
        query = query.lt('expires_at', new Date().toISOString());
      }

      const { error } = await query;

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return false;
    }
  },

  async getSalesAnalytics(
    startDate?: string,
    endDate?: string
  ): Promise<SalesAnalytics[]> {
    try {
      const cacheKey = `sales_analytics_${startDate}_${endDate}`;
      const cached = await this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }

      const { data, error } = await supabase
        .from('sales_analytics')
        .select('*')
        .order('month', { ascending: false });

      if (error) throw error;

      const analytics = data || [];

      await this.setCachedData(cacheKey, 'sales_analytics', analytics, 30);

      return analytics;
    } catch (error) {
      console.error('Error fetching sales analytics:', error);
      return [];
    }
  },

  async getCustomerAnalytics(): Promise<CustomerAnalytics[]> {
    try {
      const cacheKey = 'customer_analytics';
      const cached = await this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }

      const { data, error } = await supabase
        .from('sales')
        .select(
          `
          customer_id,
          customers!inner(name),
          quantity_oz,
          final_proceeds,
          created_at
        `
        )
        .eq('status', 'completed');

      if (error) throw error;

      const customerMap = new Map<string, CustomerAnalytics>();

      data?.forEach((sale: any) => {
        const customerId = sale.customer_id;

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer_id: customerId,
            customer_name: sale.customers.name,
            total_purchases: 0,
            total_spent: 0,
            average_order_value: 0,
            last_purchase_date: sale.created_at,
          });
        }

        const customer = customerMap.get(customerId)!;
        customer.total_purchases += 1;
        customer.total_spent += sale.final_proceeds;

        if (
          new Date(sale.created_at) > new Date(customer.last_purchase_date)
        ) {
          customer.last_purchase_date = sale.created_at;
        }
      });

      const analytics = Array.from(customerMap.values()).map((customer) => ({
        ...customer,
        average_order_value: customer.total_spent / customer.total_purchases,
      }));

      await this.setCachedData(cacheKey, 'customer_analytics', analytics, 60);

      return analytics;
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      return [];
    }
  },

  async getOperationalMetrics(): Promise<OperationalMetrics | null> {
    try {
      const cacheKey = 'operational_metrics';
      const cached = await this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }

      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('status, created_at, updated_at');

      if (batchError) throw batchError;

      const metrics: OperationalMetrics = {
        total_batches: batchData?.length || 0,
        batches_in_transit: 0,
        batches_at_refinery: 0,
        average_processing_time: 0,
        variance_incidents: 0,
      };

      let totalProcessingTime = 0;
      let processedBatches = 0;

      batchData?.forEach((batch) => {
        if (batch.status === 'in_transit' || batch.status === 'shipped') {
          metrics.batches_in_transit += 1;
        }

        if (
          batch.status === 'at_refinery' ||
          batch.status === 'processing'
        ) {
          metrics.batches_at_refinery += 1;
        }

        if (batch.status === 'completed') {
          const processingTime =
            new Date(batch.updated_at).getTime() -
            new Date(batch.created_at).getTime();
          totalProcessingTime += processingTime;
          processedBatches += 1;
        }
      });

      if (processedBatches > 0) {
        metrics.average_processing_time =
          totalProcessingTime / processedBatches / (1000 * 60 * 60 * 24);
      }

      await this.setCachedData(cacheKey, 'operational_metrics', metrics, 15);

      return metrics;
    } catch (error) {
      console.error('Error fetching operational metrics:', error);
      return null;
    }
  },

  async getDashboardMetrics(): Promise<{
    totalRevenue: number;
    totalSales: number;
    activeCustomers: number;
    averageSaleValue: number;
    revenueGrowth: number;
    salesGrowth: number;
  }> {
    try {
      const cacheKey = 'dashboard_metrics';
      const cached = await this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      const { data: currentYearSales, error: currentError } = await supabase
        .from('sales')
        .select('final_proceeds, customer_id')
        .gte('created_at', `${currentYear}-01-01`)
        .eq('status', 'completed');

      if (currentError) throw currentError;

      const { data: lastYearSales, error: lastError } = await supabase
        .from('sales')
        .select('final_proceeds')
        .gte('created_at', `${lastYear}-01-01`)
        .lt('created_at', `${currentYear}-01-01`)
        .eq('status', 'completed');

      if (lastError) throw lastError;

      const currentRevenue = currentYearSales?.reduce(
        (sum, sale) => sum + sale.final_proceeds,
        0
      ) || 0;

      const lastRevenue = lastYearSales?.reduce(
        (sum, sale) => sum + sale.final_proceeds,
        0
      ) || 0;

      const uniqueCustomers = new Set(
        currentYearSales?.map((s) => s.customer_id) || []
      ).size;

      const metrics = {
        totalRevenue: currentRevenue,
        totalSales: currentYearSales?.length || 0,
        activeCustomers: uniqueCustomers,
        averageSaleValue:
          currentYearSales && currentYearSales.length > 0
            ? currentRevenue / currentYearSales.length
            : 0,
        revenueGrowth:
          lastRevenue > 0
            ? ((currentRevenue - lastRevenue) / lastRevenue) * 100
            : 0,
        salesGrowth:
          lastYearSales && lastYearSales.length > 0
            ? ((currentYearSales.length - lastYearSales.length) /
                lastYearSales.length) *
              100
            : 0,
      };

      await this.setCachedData(cacheKey, 'dashboard_metrics', metrics, 30);

      return metrics;
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return {
        totalRevenue: 0,
        totalSales: 0,
        activeCustomers: 0,
        averageSaleValue: 0,
        revenueGrowth: 0,
        salesGrowth: 0,
      };
    }
  },

  async refreshMaterializedViews(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('refresh_sales_analytics');

      if (error) throw error;

      await this.invalidateCache();

      return true;
    } catch (error) {
      console.error('Error refreshing materialized views:', error);
      return false;
    }
  },

  async getPriceCorrelation(days: number = 90): Promise<{
    correlation: number;
    priceData: Array<{ date: string; gold_price: number; sales_volume: number }>;
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data: goldPrices, error: priceError } = await supabase
        .from('gold_prices')
        .select('price_date, london_am_rate')
        .gte('price_date', startDate)
        .order('price_date', { ascending: true });

      if (priceError) throw priceError;

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('created_at, quantity_oz')
        .gte('created_at', startDate)
        .eq('status', 'completed');

      if (salesError) throw salesError;

      const priceData = goldPrices?.map((price) => {
        const dateStr = price.price_date;
        const salesOnDate = sales?.filter(
          (s) => s.created_at.split('T')[0] === dateStr
        );
        const volume = salesOnDate?.reduce(
          (sum, s) => sum + s.quantity_oz,
          0
        ) || 0;

        return {
          date: dateStr,
          gold_price: price.london_am_rate,
          sales_volume: volume,
        };
      }) || [];

      const correlation = this.calculateCorrelation(
        priceData.map((d) => d.gold_price),
        priceData.map((d) => d.sales_volume)
      );

      return { correlation, priceData };
    } catch (error) {
      console.error('Error calculating price correlation:', error);
      return { correlation: 0, priceData: [] };
    }
  },

  calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  },

  async exportAnalyticsData(
    analyticsType: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    try {
      let data: any;

      switch (analyticsType) {
        case 'sales':
          data = await this.getSalesAnalytics();
          break;
        case 'customers':
          data = await this.getCustomerAnalytics();
          break;
        case 'operational':
          data = await this.getOperationalMetrics();
          break;
        default:
          throw new Error('Invalid analytics type');
      }

      if (format === 'csv') {
        return this.convertToCSV(data);
      }

      return data;
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      return null;
    }
  },

  convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  },
};
