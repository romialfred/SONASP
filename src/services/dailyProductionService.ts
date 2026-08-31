import { supabase } from '@/lib/supabase';
import { SITE_NATIONAL } from '@/constants/site';
import type { ProductionStatus } from '@/constants/productionStatuses';
import {
  productionStatusService,
  type ProductionStatusTransitionResult,
} from '@/services/productionStatusService';

export interface DailyProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  estimated_gold_pct?: number | null;
  estimated_silver_pct?: number | null;
  silver_content_grams?: number | null;
  /**
   * `pure_gold_grams` et `estimated_oz` sont calculés après la saisie du lingot :
   * la table les déclare nullables et des enregistrements réels portent `null`.
   * Les typer non nullables rendait le compilateur aveugle aux accès directs
   * (`valeur.toLocaleString()`), qui font tomber l'écran entier au rendu.
   */
  pure_gold_grams: number | null;
  estimated_oz: number | null;
  bar_reference: string | null;
  notes: string | null;
  site_id: string;
  mining_company_id: string | null;
  status: 'prepared' | 'ready_for_customs' | 'shipped' | 'cancelled';
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
    console.log('📊 listProduction called with filters:', filters);

    let query = supabase
      .from('daily_production')
      .select('*')
      .order('production_date', { ascending: false });

    if (filters.startDate) {
      console.log('  ├─ Filtering by startDate >=', filters.startDate);
      query = query.gte('production_date', filters.startDate);
    }

    if (filters.endDate) {
      console.log('  ├─ Filtering by endDate <=', filters.endDate);
      query = query.lte('production_date', filters.endDate);
    }

    if (filters.siteId) {
      console.log('  ├─ Filtering by siteId =', filters.siteId);
      query = query.eq('site_id', filters.siteId);
    }

    console.log('  └─ Executing query...');
    const { data, error } = await query;

    if (error) {
      console.error('❌ Query error:', error);
      throw error;
    }

    console.log(`✅ Query successful: ${data?.length || 0} records found`);
    if (data && data.length > 0) {
      console.log('  📋 Sample record:', {
        id: data[0].id.substring(0, 8) + '...',
        date: data[0].production_date,
        site_id: data[0].site_id,
        mining_company_id: data[0].mining_company_id?.substring(0, 8) + '...',
        bullion_grams: data[0].bullion_grams
      });
    } else {
      console.warn('⚠️  No records returned from query');
      console.warn('  Check:');
      console.warn('  1. RLS policies allow SELECT');
      console.warn('  2. Date range includes existing data');
      console.warn('  3. site_id filter matches data');
    }

    return data as DailyProduction[];
  }

  async getProductionById(id: string): Promise<DailyProduction | null> {
    try {
      const { data, error } = await supabase
        .from('daily_production')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching production by ID:', error);
        throw new Error(`Impossible de charger la production: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return data as DailyProduction;
    } catch (error: any) {
      console.error('Error in getProductionById:', error);
      throw error;
    }
  }

  async getProductionByDate(date: string, siteId: string = SITE_NATIONAL) {
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
    mining_company_id?: string;
    notes?: string;
    site_id?: string;
  }) {
    try {
      console.log('🚀 Creating production with data:', production);

      const { data, error } = await supabase
        .from('daily_production')
        .insert([production])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw new Error(`Erreur d'enregistrement: ${error.message}`);
      }

      console.log('✅ Production created successfully:', data);
      return data as DailyProduction;
    } catch (error: any) {
      console.error('❌ Service error:', error);
      throw new Error(error.message || 'Impossible de créer la production');
    }
  }

  async updateProduction(id: string, updates: Partial<DailyProduction>) {
    const protectedFields: Array<keyof DailyProduction> = [
      'id',
      'status',
      'created_by',
      'created_at',
      'updated_at',
    ];
    const forbiddenField = protectedFields.find((field) =>
      Object.prototype.hasOwnProperty.call(updates, field)
    );
    if (forbiddenField) {
      throw new Error(
        `Le champ ${forbiddenField} est contrôlé par le serveur et ne peut pas être modifié depuis le formulaire.`,
      );
    }

    const mutableUpdates = {
      ...(updates.production_date !== undefined && { production_date: updates.production_date }),
      ...(updates.bullion_grams !== undefined && { bullion_grams: updates.bullion_grams }),
      ...(updates.estimated_fineness_pct !== undefined && { estimated_fineness_pct: updates.estimated_fineness_pct }),
      ...(updates.estimated_gold_pct !== undefined && { estimated_gold_pct: updates.estimated_gold_pct }),
      ...(updates.estimated_silver_pct !== undefined && { estimated_silver_pct: updates.estimated_silver_pct }),
      ...(updates.silver_content_grams !== undefined && { silver_content_grams: updates.silver_content_grams }),
      ...(updates.pure_gold_grams !== undefined && { pure_gold_grams: updates.pure_gold_grams }),
      ...(updates.estimated_oz !== undefined && { estimated_oz: updates.estimated_oz }),
      ...(updates.bar_reference !== undefined && { bar_reference: updates.bar_reference }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.site_id !== undefined && { site_id: updates.site_id }),
      ...(updates.mining_company_id !== undefined && { mining_company_id: updates.mining_company_id }),
    };
    const { data, error } = await supabase
      .from('daily_production')
      .update(mutableUpdates)
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
    siteId: string = SITE_NATIONAL
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
    siteId: string = SITE_NATIONAL
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
  async calculateWeeklyTotal(weekStartDate: string, siteId: string = SITE_NATIONAL) {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const productions = await this.listProduction({
      startDate: weekStartDate,
      endDate: weekEnd.toISOString().split('T')[0],
      siteId
    });

    return {
      total_oz: productions.reduce((sum, p) => sum + (p.estimated_oz ?? 0), 0),
      total_grams: productions.reduce((sum, p) => sum + p.bullion_grams, 0),
      count: productions.length
    };
  }

  async calculateMonthlyTotal(year: number, month: number, siteId: string = SITE_NATIONAL) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    const productions = await this.listProduction({
      startDate,
      endDate,
      siteId
    });

    return {
      total_oz: productions.reduce((sum, p) => sum + (p.estimated_oz ?? 0), 0),
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
    siteId: string = SITE_NATIONAL
  ): Promise<ProductionSummary> {
    const { data, error } = await supabase.rpc('get_wtd_summary', {
      reference_date: referenceDate,
      company_id: miningCompanyId || undefined,
      site: siteId
    });

    if (error) throw error;
    return data[0] as ProductionSummary;
  }

  async getMTDSummary(
    referenceDate: string = new Date().toISOString().split('T')[0],
    miningCompanyId?: string,
    siteId: string = SITE_NATIONAL
  ): Promise<ProductionSummary> {
    const { data, error } = await supabase.rpc('get_mtd_summary', {
      reference_date: referenceDate,
      company_id: miningCompanyId || undefined,
      site: siteId
    });

    if (error) throw error;
    return data[0] as ProductionSummary;
  }

  async getYTDSummary(
    referenceDate: string = new Date().toISOString().split('T')[0],
    miningCompanyId?: string,
    siteId: string = SITE_NATIONAL
  ): Promise<ProductionSummary> {
    const { data, error } = await supabase.rpc('get_ytd_summary', {
      reference_date: referenceDate,
      company_id: miningCompanyId || undefined,
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
      company_name: companyName || undefined,
      production_date: productionDate
    });

    if (error) throw error;
    return data as string;
  }

  // Status management methods
  async updateProductionStatus(
    productionId: string,
    newStatus: ProductionStatus,
    notes?: string,
    options: { expectedStatus?: ProductionStatus; requestId?: string } = {},
  ): Promise<ProductionStatusTransitionResult> {
    return productionStatusService.updateStatus(
      productionId,
      newStatus,
      notes,
      options,
    );
  }

  async getProductionStatusHistory(productionId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_production_status_history', { prod_id: productionId });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching status history:', error);
      return [];
    }
  }

  async getProductionsReadyForCustoms(miningCompanyId?: string) {
    try {
      let query = supabase
        .from('daily_production')
        .select('*')
        .eq('status', 'ready_for_customs')
        .order('production_date', { ascending: false });

      if (miningCompanyId) {
        query = query.eq('mining_company_id', miningCompanyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DailyProduction[];
    } catch (error: any) {
      console.error('Error fetching productions ready for customs:', error);
      throw error;
    }
  }
}

export const dailyProductionService = new DailyProductionService();
