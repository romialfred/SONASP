import { supabase } from '@/lib/supabase';

export interface DailyProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  bar_reference: string | null;
  notes: string | null;
  site_id: string;
  mining_company_id: string | null;
  status: 'prepared' | 'shipped' | 'refined' | 'sold';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionForecast {
  id: string;
  forecast_date: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  forecast_oz: number | null;
  budget_oz: number | null;
  notes: string | null;
  site_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionSummary {
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_estimated_oz: number;
  avg_fineness_pct: number;
  record_count: number;
  forecast_oz?: number;
  budget_oz?: number;
  variance_vs_forecast?: number;
  variance_vs_budget?: number;
}

export interface ProductionVariance {
  actual_oz: number;
  forecast_oz: number;
  budget_oz: number;
  variance_vs_forecast: number;
  variance_vs_budget: number;
}

class DailyProductionService {
  // Daily Production CRUD Operations
  
  async listProduction(filters: {
    startDate?: string;
    endDate?: string;
    siteId?: string;
  } = {}) {
    let query = supabase
      .from('daily_production')
      .select('*')
      .order('production_date', { ascending: false });

    if (filters.startDate) {
      query = query.gte('production_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('production_date', filters.endDate);
    }
    
    if (filters.siteId) {
      query = query.eq('site_id', filters.siteId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as DailyProduction[];
  }

  async getProductionById(id: string) {
    const { data, error } = await supabase
      .from('daily_production')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as DailyProduction;
  }

  async getProductionByDate(date: string, siteId: string = 'guinea') {
    const { data, error } = await supabase
      .from('daily_production')
      .select('*')
      .eq('production_date', date)
      .eq('site_id', siteId);

    if (error) throw error;
    return data as DailyProduction[];
  }

  async createProduction(production: {
    production_date: string;
    bullion_grams: number;
    estimated_fineness_pct: number;
    bar_reference?: string;
    notes?: string;
    site_id?: string;
  }) {
    const { data, error } = await supabase
      .from('daily_production')
      .insert([production])
      .select()
      .single();

    if (error) throw error;
    return data as DailyProduction;
  }

  async updateProduction(id: string, updates: Partial<DailyProduction>) {
    const { data, error } = await supabase
      .from('daily_production')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DailyProduction;
  }

  async deleteProduction(id: string) {
    const { error } = await supabase
      .from('daily_production')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Forecast CRUD Operations
  
  async listForecasts(filters: {
    startDate?: string;
    endDate?: string;
    periodType?: string;
    siteId?: string;
  } = {}) {
    let query = supabase
      .from('production_forecasts')
      .select('*')
      .order('forecast_date', { ascending: false });

    if (filters.startDate) {
      query = query.gte('forecast_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('forecast_date', filters.endDate);
    }
    
    if (filters.periodType) {
      query = query.eq('period_type', filters.periodType);
    }
    
    if (filters.siteId) {
      query = query.eq('site_id', filters.siteId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as ProductionForecast[];
  }

  async getForecastById(id: string) {
    const { data, error } = await supabase
      .from('production_forecasts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ProductionForecast;
  }

  async createForecast(forecast: {
    forecast_date: string;
    period_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    forecast_oz?: number;
    budget_oz?: number;
    notes?: string;
    site_id?: string;
  }) {
    const { data, error } = await supabase
      .from('production_forecasts')
      .insert([forecast])
      .select()
      .single();

    if (error) throw error;
    return data as ProductionForecast;
  }

  async updateForecast(id: string, updates: Partial<ProductionForecast>) {
    const { data, error } = await supabase
      .from('production_forecasts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ProductionForecast;
  }

  async deleteForecast(id: string) {
    const { error } = await supabase
      .from('production_forecasts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Analytics Functions
  
  async getProductionSummary(
    startDate: string,
    endDate: string,
    siteId: string = 'guinea'
  ): Promise<ProductionSummary> {
    const { data, error } = await supabase.rpc('get_production_summary', {
      start_date: startDate,
      end_date: endDate,
      site: siteId
    });

    if (error) throw error;
    return data[0] as ProductionSummary;
  }

  async getProductionVariance(
    checkDate: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    siteId: string = 'guinea'
  ): Promise<ProductionVariance> {
    const { data, error } = await supabase.rpc('get_production_variance', {
      check_date: checkDate,
      period,
      site: siteId
    });

    if (error) throw error;
    return data[0] as ProductionVariance;
  }

  // Helper function to calculate totals manually if RPC not available
  async calculateWeeklyTotal(weekStartDate: string, siteId: string = 'guinea') {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const productions = await this.listProduction({
      startDate: weekStartDate,
      endDate: weekEnd.toISOString().split('T')[0],
      siteId
    });

    return {
      total_oz: productions.reduce((sum, p) => sum + p.estimated_oz, 0),
      total_grams: productions.reduce((sum, p) => sum + p.bullion_grams, 0),
      count: productions.length
    };
  }

  async calculateMonthlyTotal(year: number, month: number, siteId: string = 'guinea') {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    const productions = await this.listProduction({
      startDate,
      endDate,
      siteId
    });

    return {
      total_oz: productions.reduce((sum, p) => sum + p.estimated_oz, 0),
      total_grams: productions.reduce((sum, p) => sum + p.bullion_grams, 0),
      avg_fineness: productions.length > 0
        ? productions.reduce((sum, p) => sum + p.estimated_fineness_pct, 0) / productions.length
        : 0,
      count: productions.length
    };
  }

  // New methods for WTD and MTD
  async getWTDSummary(
    referenceDate: string = new Date().toISOString().split('T')[0],
    miningCompanyId?: string,
    siteId: string = 'guinea'
  ): Promise<ProductionSummary> {
    const { data, error } = await supabase.rpc('get_wtd_summary', {
      reference_date: referenceDate,
      company_id: miningCompanyId || null,
      site: siteId
    });

    if (error) throw error;
    return data[0] as ProductionSummary;
  }

  async getMTDSummary(
    referenceDate: string = new Date().toISOString().split('T')[0],
    miningCompanyId?: string,
    siteId: string = 'guinea'
  ): Promise<ProductionSummary> {
    const { data, error } = await supabase.rpc('get_mtd_summary', {
      reference_date: referenceDate,
      company_id: miningCompanyId || null,
      site: siteId
    });

    if (error) throw error;
    return data[0] as ProductionSummary;
  }

  async generateBarReference(
    companyName?: string,
    productionDate: string = new Date().toISOString().split('T')[0]
  ): Promise<string> {
    const { data, error } = await supabase.rpc('generate_bar_reference', {
      company_name: companyName || null,
      production_date: productionDate
    });

    if (error) throw error;
    return data as string;
  }
}

export const dailyProductionService = new DailyProductionService();
