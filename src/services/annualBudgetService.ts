import { supabase } from '../lib/supabase';
import { SITE_NATIONAL } from '@/constants/site';

export interface AnnualBudget {
  id: string;
  year: number;
  site_id: string;
  mining_company_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MonthlyBudget {
  id: string;
  annual_budget_id: string;
  month: number;
  budget_oz: number;
  days_in_month: number;
  daily_budget_oz: number | null;
  mining_company_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface QuarterlyForecast {
  id: string;
  annual_budget_id: string;
  quarter: number;
  revision_date: string;
  month: number;
  forecast_oz: number;
  days_in_month: number;
  daily_forecast_oz: number | null;
  notes: string | null;
  mining_company_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MonthlyBudgetInput {
  month: number;
  budget_oz: number;
}

export interface QuarterlyForecastInput {
  quarter: number;
  month: number;
  forecast_oz: number;
  notes?: string;
}

export interface DailyTarget {
  budget_oz: number;
  forecast_oz: number;
  daily_budget_oz: number;
  daily_forecast_oz: number;
  source: string;
}

class AnnualBudgetService {
  async getAnnualBudget(
    year: number,
    siteId: string = SITE_NATIONAL,
    miningCompanyId?: string | null
  ): Promise<AnnualBudget | null> {
    let query = supabase
      .from('annual_budgets')
      .select('*')
      .eq('year', year)
      .eq('site_id', siteId);

    // Always filter on mining_company_id to respect unique constraint
    if (miningCompanyId) {
      query = query.eq('mining_company_id', miningCompanyId);
    } else {
      // If null or undefined, filter for NULL values
      query = query.is('mining_company_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data;
  }

  async createAnnualBudget(
    year: number,
    siteId: string = SITE_NATIONAL,
    miningCompanyId?: string | null
  ): Promise<AnnualBudget> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Normalize: undefined or null becomes explicit null for DB
    const normalizedCompanyId = miningCompanyId || null;

    const { data, error } = await supabase
      .from('annual_budgets')
      .insert({
        year,
        site_id: siteId,
        mining_company_id: normalizedCompanyId,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getOrCreateAnnualBudget(
    year: number,
    siteId: string = SITE_NATIONAL,
    miningCompanyId?: string | null
  ): Promise<AnnualBudget> {
    let budget = await this.getAnnualBudget(year, siteId, miningCompanyId);

    if (!budget) {
      budget = await this.createAnnualBudget(year, siteId, miningCompanyId);
    }

    return budget;
  }

  async getMonthlyBudgets(annualBudgetId: string): Promise<MonthlyBudget[]> {
    const { data, error } = await supabase
      .from('monthly_budgets')
      .select('*')
      .eq('annual_budget_id', annualBudgetId)
      .order('month', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async upsertMonthlyBudgets(
    annualBudgetId: string,
    budgets: MonthlyBudgetInput[],
    miningCompanyId?: string | null
  ): Promise<MonthlyBudget[]> {
    // Année autoritative du budget parent : indispensable pour le nombre de jours
    // (février bissextile). L'ancien `new Date().getFullYear()` datait mal toute
    // saisie faite pour une autre année que l'année courante.
    const { data: annuel } = await supabase
      .from('annual_budgets')
      .select('year')
      .eq('id', annualBudgetId)
      .maybeSingle();
    const year = annuel?.year ?? new Date().getFullYear();

    const records = budgets.map(b => {
      const daysInMonth = this.getDaysInMonth(b.month, year);

      return {
        annual_budget_id: annualBudgetId,
        month: b.month,
        budget_oz: b.budget_oz,
        days_in_month: daysInMonth,
        mining_company_id: miningCompanyId || null
        // NOTE: daily_budget_oz is GENERATED column - do NOT insert it
      };
    });

    const { data, error } = await supabase
      .from('monthly_budgets')
      .upsert(records, {
        onConflict: 'annual_budget_id,month',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return data || [];
  }

  async getQuarterlyForecasts(annualBudgetId: string, quarter?: number): Promise<QuarterlyForecast[]> {
    let query = supabase
      .from('quarterly_forecasts')
      .select('*')
      .eq('annual_budget_id', annualBudgetId);

    if (quarter) {
      query = query.eq('quarter', quarter);
    }

    const { data, error } = await query.order('quarter', { ascending: true }).order('month', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async upsertQuarterlyForecasts(
    annualBudgetId: string,
    quarter: number,
    revisionDate: string,
    forecasts: QuarterlyForecastInput[],
    miningCompanyId?: string | null
  ): Promise<QuarterlyForecast[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Année autoritative du budget parent (février bissextile).
    const { data: annuel } = await supabase
      .from('annual_budgets')
      .select('year')
      .eq('id', annualBudgetId)
      .maybeSingle();
    const year = annuel?.year ?? new Date().getFullYear();

    const records = forecasts.map(f => {
      const daysInMonth = this.getDaysInMonth(f.month, year);

      return {
        annual_budget_id: annualBudgetId,
        quarter,
        revision_date: revisionDate,
        month: f.month,
        forecast_oz: f.forecast_oz,
        days_in_month: daysInMonth,
        notes: f.notes || null,
        mining_company_id: miningCompanyId || null,
        created_by: user.id
        // NOTE: daily_forecast_oz is GENERATED column - do NOT insert it
      };
    });

    const { data, error } = await supabase
      .from('quarterly_forecasts')
      .upsert(records, {
        onConflict: 'annual_budget_id,quarter,month',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return data || [];
  }

  async getDailyTarget(date: Date, siteId: string = SITE_NATIONAL): Promise<DailyTarget> {
    const dateString = date.toISOString().split('T')[0];

    const { data, error } = await supabase
      .rpc('get_daily_target', {
        target_date: dateString,
        site: siteId
      });

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        budget_oz: 0,
        forecast_oz: 0,
        daily_budget_oz: 0,
        daily_forecast_oz: 0,
        source: 'none'
      };
    }

    return data[0];
  }

  async getMonthlyBudgetWithForecasts(
    year: number,
    siteId: string = SITE_NATIONAL,
    miningCompanyId?: string | null
  ): Promise<{
    budget: AnnualBudget | null;
    monthlyBudgets: MonthlyBudget[];
    quarterlyForecasts: QuarterlyForecast[];
  }> {
    const budget = await this.getAnnualBudget(year, siteId, miningCompanyId);

    if (!budget) {
      return {
        budget: null,
        monthlyBudgets: [],
        quarterlyForecasts: []
      };
    }

    const [monthlyBudgets, quarterlyForecasts] = await Promise.all([
      this.getMonthlyBudgets(budget.id),
      this.getQuarterlyForecasts(budget.id)
    ]);

    return {
      budget,
      monthlyBudgets,
      quarterlyForecasts
    };
  }

  getDaysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate();
  }

  async getMonthlyActualProduction(
    year: number,
    miningCompanyId: string | null,
    siteId: string = SITE_NATIONAL
  ): Promise<Record<number, number>> {
    try {
      console.log('📊 [ACTUAL] Parametres:', { year, miningCompanyId, siteId });

      // Build query with correct columns (bullion_grams, not total_weight_oz)
      let query = supabase
        .from('daily_production')
        .select('production_date, bullion_grams, estimated_gold_pct, estimated_fineness_pct, mining_company_id, site_id')
        .gte('production_date', `${year}-01-01`)
        .lte('production_date', `${year}-12-31`);

      // Only filter by site if it's provided and not empty
      if (siteId && siteId !== '') {
        query = query.eq('site_id', siteId);
      }

      if (miningCompanyId && miningCompanyId !== 'ALL') {
        query = query.eq('mining_company_id', miningCompanyId);
      }

      const { data, error } = await query;

      console.log('📦 [ACTUAL] Query result:', {
        count: data?.length || 0,
        error: error?.message,
        sampleRecord: data?.[0]
      });

      if (error) {
        console.error('❌ [ACTUAL] Error:', error);
        return {};
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ [ACTUAL] NO DATA found');
        return {};
      }

      const monthlyTotals: Record<number, number> = {};

      data.forEach(record => {
        const date = new Date(record.production_date);
        const month = date.getMonth() + 1;

        // Calculate fine gold in ounces
        // Formula: (bullion_grams * fineness_pct / 100) / 31.1034768
        const bullionGrams = Number(record.bullion_grams) || 0;
        const fineness = Number(record.estimated_gold_pct || record.estimated_fineness_pct) || 0;
        const fineGoldGrams = (bullionGrams * fineness) / 100;
        const fineGoldOz = fineGoldGrams / 31.1034768;

        console.log(`  📅 ${record.production_date}: ${bullionGrams}g × ${fineness}% = ${fineGoldOz.toFixed(2)} oz (month ${month})`);

        if (!monthlyTotals[month]) {
          monthlyTotals[month] = 0;
        }
        monthlyTotals[month] += fineGoldOz;
      });

      // Round to 2 decimals
      Object.keys(monthlyTotals).forEach(month => {
        monthlyTotals[Number(month)] = Math.round(monthlyTotals[Number(month)] * 100) / 100;
      });

      console.log('✅ [ACTUAL] Monthly totals:', monthlyTotals);

      return monthlyTotals;
    } catch (error) {
      console.error('❌ [ACTUAL] Exception:', error);
      return {};
    }
  }

  getQuarterFromMonth(month: number): number {
    return Math.ceil(month / 3);
  }

  getQuarterMonths(quarter: number): number[] {
    const startMonth = (quarter - 1) * 3 + 1;
    return [startMonth, startMonth + 1, startMonth + 2];
  }

  getRevisionMonth(quarter: number): number {
    const lastMonthOfQuarter = quarter * 3;
    return lastMonthOfQuarter - 2;
  }

  canReviseQuarter(quarter: number, currentMonth: number): boolean {
    const revisionMonth = this.getRevisionMonth(quarter);
    return currentMonth >= revisionMonth;
  }

  getMonthName(month: number, locale: string = 'fr'): string {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long' });
  }

  getQuarterName(quarter: number, locale: string = 'fr'): string {
    return locale === 'fr' ? `T${quarter}` : `Q${quarter}`;
  }

  async getAllCompaniesTotals(
    year: number,
    siteId: string = SITE_NATIONAL
  ): Promise<{
    companies: Array<{
      id: string;
      name: string;
      budget: AnnualBudget | null;
      monthlyBudgets: MonthlyBudget[];
      quarterlyForecasts: QuarterlyForecast[];
      totalBudget: number;
      totalForecast: number;
    }>;
    groupTotal: number;
    groupForecastTotal: number;
  }> {
    const { data: companies, error } = await supabase
      .from('mining_companies')
      .select('id, name')
      .order('name');

    if (error) throw error;

    const companyData = await Promise.all(
      (companies || []).map(async (company) => {
        const data = await this.getMonthlyBudgetWithForecasts(year, siteId, company.id);
        const totalBudget = data.monthlyBudgets.reduce((sum, mb) => sum + Number(mb.budget_oz || 0), 0);
        const totalForecast = data.quarterlyForecasts.reduce((sum, qf) => sum + Number(qf.forecast_oz || 0), 0);

        return {
          id: company.id,
          name: company.name,
          budget: data.budget,
          monthlyBudgets: data.monthlyBudgets,
          quarterlyForecasts: data.quarterlyForecasts,
          totalBudget,
          totalForecast
        };
      })
    );

    const groupTotal = companyData.reduce((sum, c) => sum + c.totalBudget, 0);
    const groupForecastTotal = companyData.reduce((sum, c) => sum + c.totalForecast, 0);

    return {
      companies: companyData,
      groupTotal,
      groupForecastTotal
    };
  }
}

export const annualBudgetService = new AnnualBudgetService();
