import { supabase } from '@/lib/supabase';
import { annualBudgetService, MonthlyBudget, QuarterlyForecast } from './annualBudgetService';
import { SITE_NATIONAL } from '@/constants/site';

export interface PerformanceData {
  wtd: {
    forecast: number;
    budget: number;
    actual: number;
  };
  mtd: {
    forecast: number;
    budget: number;
    actual: number;
  };
  ytd: {
    forecast: number;
    budget: number;
    actual: number;
  };
}

class PerformanceService {
  async getPerformanceData(
    siteId: string = SITE_NATIONAL,
    startDate?: string,
    endDate?: string
  ): Promise<PerformanceData> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(currentYear, now.getMonth(), 1);
    const startOfYear = new Date(currentYear, 0, 1);

    const { budget, monthlyBudgets, quarterlyForecasts } =
      await annualBudgetService.getMonthlyBudgetWithForecasts(currentYear, siteId);

    let actualStartDate = startDate;
    let actualEndDate = endDate;

    if (!actualStartDate || !actualEndDate) {
      actualEndDate = now.toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      actualStartDate = thirtyDaysAgo.toISOString().split('T')[0];
    }

    const { data: productions, error: prodError } = await supabase
      .from('daily_production')
      .select('production_date, estimated_oz')
      .gte('production_date', startOfYear.toISOString().split('T')[0])
      .lte('production_date', actualEndDate)
      .order('production_date', { ascending: false });

    if (prodError) {
      console.error('Error loading productions:', prodError);
    }

    const productionData = productions || [];

    const wtdData = productionData.filter(p =>
      new Date(p.production_date) >= startOfWeek
    );
    const mtdData = productionData.filter(p =>
      new Date(p.production_date) >= startOfMonth
    );
    const ytdData = productionData.filter(p =>
      new Date(p.production_date) >= startOfYear
    );

    const wtdActual = wtdData.reduce((sum, p) => sum + p.estimated_oz, 0);
    const mtdActual = mtdData.reduce((sum, p) => sum + p.estimated_oz, 0);
    const ytdActual = ytdData.reduce((sum, p) => sum + p.estimated_oz, 0);

    const wtdBudget = this.calculateWeeklyBudget(monthlyBudgets, currentMonth, now);
    const mtdBudget = this.getMonthlyBudget(monthlyBudgets, currentMonth);
    const ytdBudget = this.getYearToDateBudget(monthlyBudgets, currentMonth);

    const wtdForecast = this.calculateWeeklyForecast(
      quarterlyForecasts,
      monthlyBudgets,
      currentMonth,
      currentQuarter,
      now
    );
    const mtdForecast = this.getMonthlyForecast(
      quarterlyForecasts,
      monthlyBudgets,
      currentMonth,
      currentQuarter
    );
    const ytdForecast = this.getYearToDateForecast(
      quarterlyForecasts,
      monthlyBudgets,
      currentMonth,
      currentQuarter
    );

    return {
      wtd: {
        forecast: wtdForecast,
        budget: wtdBudget,
        actual: wtdActual
      },
      mtd: {
        forecast: mtdForecast,
        budget: mtdBudget,
        actual: mtdActual
      },
      ytd: {
        forecast: ytdForecast,
        budget: ytdBudget,
        actual: ytdActual
      }
    };
  }

  private calculateWeeklyBudget(
    monthlyBudgets: MonthlyBudget[],
    currentMonth: number,
    now: Date
  ): number {
    const currentMonthBudget = monthlyBudgets.find(b => b.month === currentMonth);
    if (!currentMonthBudget) return 0;

    const daysInWeek = now.getDay() + 1;
    return currentMonthBudget.daily_budget_oz * daysInWeek;
  }

  private getMonthlyBudget(monthlyBudgets: MonthlyBudget[], currentMonth: number): number {
    const currentMonthBudget = monthlyBudgets.find(b => b.month === currentMonth);
    return currentMonthBudget?.budget_oz || 0;
  }

  private getYearToDateBudget(monthlyBudgets: MonthlyBudget[], currentMonth: number): number {
    return monthlyBudgets
      .filter(b => b.month <= currentMonth)
      .reduce((sum, b) => sum + b.budget_oz, 0);
  }

  private calculateWeeklyForecast(
    quarterlyForecasts: QuarterlyForecast[],
    monthlyBudgets: MonthlyBudget[],
    currentMonth: number,
    currentQuarter: number,
    now: Date
  ): number {
    const currentMonthForecast = quarterlyForecasts.find(
      f => f.quarter === currentQuarter && f.month === currentMonth
    );

    if (currentMonthForecast) {
      const daysInWeek = now.getDay() + 1;
      return currentMonthForecast.daily_forecast_oz * daysInWeek;
    }

    return this.calculateWeeklyBudget(monthlyBudgets, currentMonth, now);
  }

  private getMonthlyForecast(
    quarterlyForecasts: QuarterlyForecast[],
    monthlyBudgets: MonthlyBudget[],
    currentMonth: number,
    currentQuarter: number
  ): number {
    const currentMonthForecast = quarterlyForecasts.find(
      f => f.quarter === currentQuarter && f.month === currentMonth
    );

    if (currentMonthForecast) {
      return currentMonthForecast.forecast_oz;
    }

    return this.getMonthlyBudget(monthlyBudgets, currentMonth);
  }

  private getYearToDateForecast(
    quarterlyForecasts: QuarterlyForecast[],
    monthlyBudgets: MonthlyBudget[],
    currentMonth: number,
    currentQuarter: number
  ): number {
    let total = 0;

    for (let month = 1; month <= currentMonth; month++) {
      const quarter = Math.ceil(month / 3);
      const forecast = quarterlyForecasts.find(
        f => f.quarter === quarter && f.month === month
      );

      if (forecast) {
        total += forecast.forecast_oz;
      } else {
        const budget = monthlyBudgets.find(b => b.month === month);
        total += budget?.budget_oz || 0;
      }
    }

    return total;
  }
}

export const performanceService = new PerformanceService();
