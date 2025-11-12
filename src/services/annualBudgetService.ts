import { supabase } from '../lib/supabase';

export interface AnnualBudget {
  id: string;
  year: number;
  site_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBudget {
  id: string;
  annual_budget_id: string;
  month: number;
  budget_oz: number;
  days_in_month: number;
  daily_budget_oz: number;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyForecast {
  id: string;
  annual_budget_id: string;
  quarter: number;
  revision_date: string;
  month: number;
  forecast_oz: number;
  days_in_month: number;
  daily_forecast_oz: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
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
  source: 'budget' | 'forecast' | 'none';
}

class AnnualBudgetService {
  async getAnnualBudget(year: number, siteId: string = 'guinea'): Promise<AnnualBudget | null> {
    const { data, error } = await supabase
      .from('annual_budgets')
      .select('*')
      .eq('year', year)
      .eq('site_id', siteId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createAnnualBudget(year: number, siteId: string = 'guinea'): Promise<AnnualBudget> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('annual_budgets')
      .insert({
        year,
        site_id: siteId,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getOrCreateAnnualBudget(year: number, siteId: string = 'guinea'): Promise<AnnualBudget> {
    let budget = await this.getAnnualBudget(year, siteId);

    if (!budget) {
      budget = await this.createAnnualBudget(year, siteId);
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
    budgets: MonthlyBudgetInput[]
  ): Promise<MonthlyBudget[]> {
    const records = budgets.map(b => ({
      annual_budget_id: annualBudgetId,
      month: b.month,
      budget_oz: b.budget_oz,
      days_in_month: this.getDaysInMonth(b.month, parseInt(annualBudgetId.substring(0, 4)))
    }));

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
    forecasts: QuarterlyForecastInput[]
  ): Promise<QuarterlyForecast[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const records = forecasts.map(f => ({
      annual_budget_id: annualBudgetId,
      quarter,
      revision_date: revisionDate,
      month: f.month,
      forecast_oz: f.forecast_oz,
      days_in_month: this.getDaysInMonth(f.month, parseInt(annualBudgetId.substring(0, 4))),
      notes: f.notes || null,
      created_by: user.id
    }));

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

  async getDailyTarget(date: Date, siteId: string = 'guinea'): Promise<DailyTarget> {
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
    siteId: string = 'guinea'
  ): Promise<{
    budget: AnnualBudget | null;
    monthlyBudgets: MonthlyBudget[];
    quarterlyForecasts: QuarterlyForecast[];
  }> {
    const budget = await this.getAnnualBudget(year, siteId);

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
}

export const annualBudgetService = new AnnualBudgetService();
