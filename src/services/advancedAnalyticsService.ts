import { supabase } from '@/lib/supabase';

/**
 * Advanced Analytics Service - Senior BI Level
 * Provides comprehensive analytics across all modules:
 * - Production analytics with drill-downs
 * - Financial analytics (Revenue, Royalties, Costs)
 * - Sales performance tracking
 * - Mining company comparisons
 * - Budget vs Actual analysis
 */

// ==================== TYPES ====================

export interface ProductionKPIs {
  totalBullionGrams: number;
  totalPureGoldGrams: number;
  totalPureGoldOz: number;
  totalSilverGrams: number;
  avgFinenessPct: number;
  productionCount: number;
  period: string;
}

export interface ProductionByCompany {
  companyId: string;
  companyName: string;
  totalBullionGrams: number;
  totalPureGoldOz: number;
  productionCount: number;
  avgFinenessPct: number;
  percentage: number;
}

export interface ProductionByPeriod {
  period: string; // YYYY-MM or YYYY-QQ
  periodLabel: string; // "Jan 2025" or "Q1 2025"
  totalBullionGrams: number;
  totalPureGoldOz: number;
  productionCount: number;
  budgetOz?: number;
  variance?: number;
  variancePct?: number;
}

export interface FinancialKPIs {
  totalRevenue: number;
  totalRoyalties: number;
  totalRefiningCosts: number;
  totalTransportCosts: number;
  totalFreightCosts: number;
  netProceeds: number;
  avgSalePrice: number;
  totalQuantitySoldOz: number;
}

export interface RevenueByCompany {
  companyId: string;
  companyName: string;
  totalRevenue: number;
  totalRoyalties: number;
  totalQuantityOz: number;
  salesCount: number;
  percentage: number;
}

export interface SalesPerformance {
  period: string;
  periodLabel: string;
  revenue: number;
  quantityOz: number;
  salesCount: number;
  avgPrice: number;
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface BudgetVsActual {
  period: string;
  periodLabel: string;
  budgetOz: number;
  actualOz: number;
  variance: number;
  variancePct: number;
  forecastOz?: number;
}

// ==================== PRODUCTION ANALYTICS ====================

export class AdvancedAnalyticsService {
  /**
   * Get global production KPIs for a date range
   */
  static async getGlobalProductionKPIs(
    startDate: string,
    endDate: string,
    miningCompanyId?: string
  ): Promise<ProductionKPIs> {
    try {
      let query = supabase
        .from('daily_production')
        .select('bullion_grams, pure_gold_grams, estimated_oz, silver_content_grams, estimated_fineness_pct')
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .neq('status', 'cancelled');

      if (miningCompanyId) {
        query = query.eq('mining_company_id', miningCompanyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching production KPIs:', error);
        throw error;
      }

      const totals = (data || []).reduce(
        (acc, prod) => ({
          totalBullionGrams: acc.totalBullionGrams + (prod.bullion_grams || 0),
          totalPureGoldGrams: acc.totalPureGoldGrams + (prod.pure_gold_grams || 0),
          totalPureGoldOz: acc.totalPureGoldOz + (prod.estimated_oz || 0),
          totalSilverGrams: acc.totalSilverGrams + (prod.silver_content_grams || 0),
          avgFinenessPct: acc.avgFinenessPct + (prod.estimated_fineness_pct || 0),
          productionCount: acc.productionCount + 1,
        }),
        {
          totalBullionGrams: 0,
          totalPureGoldGrams: 0,
          totalPureGoldOz: 0,
          totalSilverGrams: 0,
          avgFinenessPct: 0,
          productionCount: 0,
        }
      );

      return {
        ...totals,
        avgFinenessPct: totals.productionCount > 0 ? totals.avgFinenessPct / totals.productionCount : 0,
        period: `${startDate} to ${endDate}`,
      };
    } catch (error) {
      console.error('Error in getGlobalProductionKPIs:', error);
      return {
        totalBullionGrams: 0,
        totalPureGoldGrams: 0,
        totalPureGoldOz: 0,
        totalSilverGrams: 0,
        avgFinenessPct: 0,
        productionCount: 0,
        period: `${startDate} to ${endDate}`,
      };
    }
  }

  /**
   * Get production breakdown by mining company
   */
  static async getProductionByCompany(
    startDate: string,
    endDate: string
  ): Promise<ProductionByCompany[]> {
    try {
      const { data: productions, error: prodError } = await supabase
        .from('daily_production')
        .select('mining_company_id, bullion_grams, estimated_oz, estimated_fineness_pct')
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .neq('status', 'cancelled');

      if (prodError) {
        console.error('Error fetching production by company:', prodError);
        return [];
      }

      const { data: companies, error: compError } = await supabase
        .from('mining_companies')
        .select('id, name');

      if (compError) {
        console.error('Error fetching mining companies:', compError);
        return [];
      }

      const companyMap = new Map(companies?.map((c) => [c.id, c.name]) || []);

      const companyTotals = (productions || []).reduce((acc, prod) => {
        const companyId = prod.mining_company_id || 'unknown';
        if (!acc[companyId]) {
          acc[companyId] = {
            totalBullionGrams: 0,
            totalPureGoldOz: 0,
            productionCount: 0,
            avgFinenessPct: 0,
          };
        }
        acc[companyId].totalBullionGrams += prod.bullion_grams || 0;
        acc[companyId].totalPureGoldOz += prod.estimated_oz || 0;
        acc[companyId].productionCount += 1;
        acc[companyId].avgFinenessPct += prod.estimated_fineness_pct || 0;
        return acc;
      }, {} as Record<string, any>);

      const totalOz = Object.values(companyTotals).reduce(
        (sum: number, c: any) => sum + c.totalPureGoldOz,
        0
      );

      return Object.entries(companyTotals).map(([companyId, totals]: [string, any]) => ({
        companyId,
        companyName: companyMap.get(companyId) || 'Unknown',
        totalBullionGrams: totals.totalBullionGrams,
        totalPureGoldOz: totals.totalPureGoldOz,
        productionCount: totals.productionCount,
        avgFinenessPct: totals.productionCount > 0 ? totals.avgFinenessPct / totals.productionCount : 0,
        percentage: totalOz > 0 ? (totals.totalPureGoldOz / totalOz) * 100 : 0,
      }));
    } catch (error) {
      console.error('Error in getProductionByCompany:', error);
      return [];
    }
  }

  /**
   * Get production trend by period (monthly or quarterly)
   */
  static async getProductionByPeriod(
    startDate: string,
    endDate: string,
    periodType: 'month' | 'quarter' = 'month',
    miningCompanyId?: string
  ): Promise<ProductionByPeriod[]> {
    try {
      let query = supabase
        .from('daily_production')
        .select('production_date, bullion_grams, estimated_oz')
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .neq('status', 'cancelled')
        .order('production_date', { ascending: true });

      if (miningCompanyId) {
        query = query.eq('mining_company_id', miningCompanyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching production by period:', error);
        return [];
      }

      const periodTotals: Record<string, ProductionByPeriod> = {};

      (data || []).forEach((prod) => {
        const date = new Date(prod.production_date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const quarter = Math.ceil(month / 3);

        const period = periodType === 'month'
          ? `${year}-${String(month).padStart(2, '0')}`
          : `${year}-Q${quarter}`;

        const periodLabel = periodType === 'month'
          ? date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
          : `Q${quarter} ${year}`;

        if (!periodTotals[period]) {
          periodTotals[period] = {
            period,
            periodLabel,
            totalBullionGrams: 0,
            totalPureGoldOz: 0,
            productionCount: 0,
          };
        }

        periodTotals[period].totalBullionGrams += prod.bullion_grams || 0;
        periodTotals[period].totalPureGoldOz += prod.estimated_oz || 0;
        periodTotals[period].productionCount += 1;
      });

      return Object.values(periodTotals).sort((a, b) => a.period.localeCompare(b.period));
    } catch (error) {
      console.error('Error in getProductionByPeriod:', error);
      return [];
    }
  }

  // ==================== FINANCIAL ANALYTICS ====================

  /**
   * Get comprehensive financial KPIs
   */
  static async getFinancialKPIs(
    startDate: string,
    endDate: string
  ): Promise<FinancialKPIs> {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('quantity_oz, london_am_rate, gross_proceeds, final_proceeds, royalty_amount, freight_cost, other_costs')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .in('status', ['completed', 'payment_received']);

      if (error) {
        console.error('Error fetching financial KPIs:', error);
        throw error;
      }

      const totals = (sales || []).reduce(
        (acc, sale) => ({
          totalRevenue: acc.totalRevenue + (sale.gross_proceeds || 0),
          totalRoyalties: acc.totalRoyalties + (sale.royalty_amount || 0),
          totalRefiningCosts: acc.totalRefiningCosts + 0, // Refining costs are in other_costs
          totalTransportCosts: acc.totalTransportCosts + (sale.freight_cost || 0),
          totalFreightCosts: acc.totalFreightCosts + (sale.freight_cost || 0),
          netProceeds: acc.netProceeds + (sale.final_proceeds || 0),
          totalQuantitySoldOz: acc.totalQuantitySoldOz + (sale.quantity_oz || 0),
          salesCount: acc.salesCount + 1,
        }),
        {
          totalRevenue: 0,
          totalRoyalties: 0,
          totalRefiningCosts: 0,
          totalTransportCosts: 0,
          totalFreightCosts: 0,
          netProceeds: 0,
          totalQuantitySoldOz: 0,
          salesCount: 0,
        }
      );

      return {
        ...totals,
        avgSalePrice: totals.totalQuantitySoldOz > 0
          ? totals.totalRevenue / totals.totalQuantitySoldOz
          : 0,
      };
    } catch (error) {
      console.error('Error in getFinancialKPIs:', error);
      return {
        totalRevenue: 0,
        totalRoyalties: 0,
        totalRefiningCosts: 0,
        totalTransportCosts: 0,
        totalFreightCosts: 0,
        netProceeds: 0,
        totalQuantitySoldOz: 0,
        avgSalePrice: 0,
      };
    }
  }

  /**
   * Get revenue distribution by mining company
   */
  static async getRevenueByCompany(
    startDate: string,
    endDate: string
  ): Promise<RevenueByCompany[]> {
    try {
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('seller_id, seller_type, quantity_oz, gross_proceeds, royalty_amount')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .in('status', ['completed', 'payment_received'])
        .in('seller_type', ['mining_company', 'sonasp']);

      if (salesError) {
        console.error('Error fetching revenue by company:', salesError);
        return [];
      }

      const { data: companies, error: compError } = await supabase
        .from('mining_companies')
        .select('id, name');

      if (compError) {
        console.error('Error fetching mining companies:', compError);
        return [];
      }

      const companyMap = new Map(companies?.map((c) => [c.id, c.name]) || []);

      const companyRevenue: Record<string, any> = {};

      (sales || []).forEach((sale) => {
        const companyId = sale.seller_id || 'unknown';
        if (!companyRevenue[companyId]) {
          companyRevenue[companyId] = {
            totalRevenue: 0,
            totalRoyalties: 0,
            totalQuantityOz: 0,
            salesCount: 0,
          };
        }
        companyRevenue[companyId].totalRevenue += sale.gross_proceeds || 0;
        companyRevenue[companyId].totalRoyalties += sale.royalty_amount || 0;
        companyRevenue[companyId].totalQuantityOz += sale.quantity_oz || 0;
        companyRevenue[companyId].salesCount += 1;
      });

      const totalRevenue = Object.values(companyRevenue).reduce(
        (sum: number, c: any) => sum + c.totalRevenue,
        0
      );

      return Object.entries(companyRevenue).map(([companyId, totals]: [string, any]) => ({
        companyId,
        companyName: companyMap.get(companyId) || 'Inconnu',
        totalRevenue: totals.totalRevenue,
        totalRoyalties: totals.totalRoyalties,
        totalQuantityOz: totals.totalQuantityOz,
        salesCount: totals.salesCount,
        percentage: totalRevenue > 0 ? (totals.totalRevenue / totalRevenue) * 100 : 0,
      }));
    } catch (error) {
      console.error('Error in getRevenueByCompany:', error);
      return [];
    }
  }

  /**
   * Get sales performance by period
   */
  static async getSalesPerformance(
    startDate: string,
    endDate: string,
    periodType: 'month' | 'quarter' = 'month'
  ): Promise<SalesPerformance[]> {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, quantity_oz, gross_proceeds, london_am_rate')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .in('status', ['completed', 'payment_received'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sales performance:', error);
        return [];
      }

      const periodTotals: Record<string, SalesPerformance> = {};

      (data || []).forEach((sale) => {
        if (!sale.created_at) return;
        const date = new Date(sale.created_at);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const quarter = Math.ceil(month / 3);

        const period = periodType === 'month'
          ? `${year}-${String(month).padStart(2, '0')}`
          : `${year}-Q${quarter}`;

        const periodLabel = periodType === 'month'
          ? date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
          : `Q${quarter} ${year}`;

        if (!periodTotals[period]) {
          periodTotals[period] = {
            period,
            periodLabel,
            revenue: 0,
            quantityOz: 0,
            salesCount: 0,
            avgPrice: 0,
          };
        }

        periodTotals[period].revenue += sale.gross_proceeds || 0;
        periodTotals[period].quantityOz += sale.quantity_oz || 0;
        periodTotals[period].salesCount += 1;
      });

      return Object.values(periodTotals).map((p: any) => ({
        ...p,
        avgPrice: p.quantityOz > 0 ? p.revenue / p.quantityOz : 0,
      }));
    } catch (error) {
      console.error('Error in getSalesPerformance:', error);
      return [];
    }
  }

  /**
   * Get cost breakdown by category
   */
  static async getCostBreakdown(
    startDate: string,
    endDate: string
  ): Promise<CostBreakdown[]> {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('freight_cost, other_costs, royalty_amount')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .in('status', ['completed', 'payment_received']);

      if (error) {
        console.error('Error fetching cost breakdown:', error);
        return [];
      }

      const costs = (sales || []).reduce(
        (acc, sale) => ({
          freightCosts: acc.freightCosts + (sale.freight_cost || 0),
          otherCosts: acc.otherCosts + (sale.other_costs || 0),
          royalties: acc.royalties + (sale.royalty_amount || 0),
          freightCount: acc.freightCount + (sale.freight_cost ? 1 : 0),
          otherCount: acc.otherCount + (sale.other_costs ? 1 : 0),
          royaltyCount: acc.royaltyCount + (sale.royalty_amount ? 1 : 0),
        }),
        {
          freightCosts: 0,
          otherCosts: 0,
          royalties: 0,
          freightCount: 0,
          otherCount: 0,
          royaltyCount: 0,
        }
      );

      const totalCosts = costs.freightCosts + costs.otherCosts + costs.royalties;

      return [
        {
          category: 'Freight & Transport',
          amount: costs.freightCosts,
          percentage: totalCosts > 0 ? (costs.freightCosts / totalCosts) * 100 : 0,
          count: costs.freightCount,
        },
        {
          category: 'Royalties (3%)',
          amount: costs.royalties,
          percentage: totalCosts > 0 ? (costs.royalties / totalCosts) * 100 : 0,
          count: costs.royaltyCount,
        },
        {
          category: 'Other Costs',
          amount: costs.otherCosts,
          percentage: totalCosts > 0 ? (costs.otherCosts / totalCosts) * 100 : 0,
          count: costs.otherCount,
        },
      ];
    } catch (error) {
      console.error('Error in getCostBreakdown:', error);
      return [];
    }
  }

  // ==================== BUDGET VS ACTUAL ====================

  /**
   * Get budget vs actual comparison by period
   */
  static async getBudgetVsActual(
    year: number,
    miningCompanyId?: string
  ): Promise<BudgetVsActual[]> {
    try {
      // First, get the annual budget for the specified year
      let annualBudgetQuery = supabase
        .from('annual_budgets')
        .select('id, year, mining_company_id')
        .eq('year', year);

      if (miningCompanyId) {
        annualBudgetQuery = annualBudgetQuery.eq('mining_company_id', miningCompanyId);
      }

      const { data: annualBudgets, error: annualError } = await annualBudgetQuery;

      if (annualError) {
        console.error('Error fetching annual budgets:', annualError);
        return [];
      }

      if (!annualBudgets || annualBudgets.length === 0) {
        // No budget data available, return empty array
        return [];
      }

      // Get all monthly budgets for the annual budget(s)
      const annualBudgetIds = annualBudgets.map(b => b.id);

      const { data: budgets, error: budgetError } = await supabase
        .from('monthly_budgets')
        .select('month, budget_oz, annual_budget_id, mining_company_id')
        .in('annual_budget_id', annualBudgetIds);

      if (budgetError) {
        console.error('Error fetching monthly budgets:', budgetError);
        return [];
      }

      // Get actual production data
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      let prodQuery = supabase
        .from('daily_production')
        .select('production_date, estimated_oz')
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .neq('status', 'cancelled');

      if (miningCompanyId) {
        prodQuery = prodQuery.eq('mining_company_id', miningCompanyId);
      }

      const { data: productions, error: prodError } = await prodQuery;

      if (prodError) {
        console.error('Error fetching production data:', prodError);
        return [];
      }

      // Aggregate actual by month
      const actualByMonth: Record<number, number> = {};
      (productions || []).forEach((prod) => {
        const date = new Date(prod.production_date);
        const month = date.getMonth() + 1;
        actualByMonth[month] = (actualByMonth[month] || 0) + (prod.estimated_oz || 0);
      });

      // Combine budget and actual
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      return (budgets || []).map((budget) => {
        const month = budget.month;
        const budgetOz = budget.budget_oz || 0;
        const actualOz = actualByMonth[month] || 0;
        const variance = actualOz - budgetOz;
        const variancePct = budgetOz > 0 ? (variance / budgetOz) * 100 : 0;

        return {
          period: `${year}-${String(month).padStart(2, '0')}`,
          periodLabel: `${monthNames[month - 1]} ${year}`,
          budgetOz,
          actualOz,
          variance,
          variancePct,
        };
      }).sort((a, b) => a.period.localeCompare(b.period));
    } catch (error) {
      console.error('Error in getBudgetVsActual:', error);
      return [];
    }
  }

  // ==================== EXPORT FUNCTIONALITY ====================

  /**
   * Export analytics data to CSV format
   */
  static exportToCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(val =>
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
