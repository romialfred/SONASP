import { supabase } from '@/lib/supabase';
import { GOLD_ROYALTY_RATE } from '@/constants/goldConstants';
import { SALES_STATUSES } from '@/constants/salesStatuses';

export interface SaleCalculations {
  gross_proceeds: number;
  freight_cost: number;
  other_costs: number;
  net_proceeds: number;
  royalty_rate: number;
  royalty_amount: number;
  final_proceeds: number;
}

export interface Sale {
  id: string;
  sale_number: string;
  customer_id: string;
  quantity_oz: number;
  london_am_rate: number;
  gross_proceeds: number;
  freight_cost: number;
  other_costs: number;
  net_proceeds: number;
  royalty_amount: number;
  final_proceeds: number;
  status: string;
  sale_date: string;
  created_at: string;
  updated_at: string;
}

// Source de vérité unique — cf. src/constants/goldConstants.ts (audit F4/Q3).
export const ROYALTY_RATE = GOLD_ROYALTY_RATE;

export function calculateSaleProceeds(
  quantityOz: number,
  londonAMRate: number,
  freightCost: number = 0,
  otherCosts: number = 0
): SaleCalculations {
  const grossProceeds = quantityOz * londonAMRate;
  const netProceeds = grossProceeds - freightCost - otherCosts;
  const royaltyAmount = netProceeds * ROYALTY_RATE;
  const finalProceeds = netProceeds - royaltyAmount;

  return {
    gross_proceeds: grossProceeds,
    freight_cost: freightCost,
    other_costs: otherCosts,
    net_proceeds: netProceeds,
    royalty_rate: ROYALTY_RATE,
    royalty_amount: royaltyAmount,
    final_proceeds: finalProceeds,
  };
}

export async function getSaleById(
  saleId: string
): Promise<{ success: boolean; data?: Sale; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers(id, name, email, country, phone)
      `)
      .eq('id', saleId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSales(filters?: {
  status?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ success: boolean; data?: Sale[]; error?: string }> {
  try {
    let query = supabase
      .from('sales')
      .select(`
        *,
        customer:customers(id, name, email, country)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    if (filters?.date_from) {
      query = query.gte('sale_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('sale_date', filters.date_to);
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

export async function getAvailableInventory(): Promise<{
  success: boolean;
  data?: {
    total_weight_oz: number;
    batches: Array<{
      id: string;
      batch_number: string;
      weight_oz: number;
      metal_type: string;
      status: string;
    }>;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('batches')
      .select('id, batch_number, weight_ounces, metal_type, status')
      .eq('status', 'ready_for_sale')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const totalWeight = (data || []).reduce((sum, batch) => sum + ((batch as any).weight_ounces || 0), 0);

    return {
      success: true,
      data: {
        total_weight_oz: totalWeight,
        batches: (data || []).map(b => ({
          ...b,
          weight_oz: (b as any).weight_ounces
        })),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSaleStatistics(filters?: {
  date_from?: string;
  date_to?: string;
}): Promise<{
  success: boolean;
  data?: {
    total_sales: number;
    total_quantity_oz: number;
    total_revenue: number;
    avg_price_per_oz: number;
    pending_approvals: number;
  };
  error?: string;
}> {
  try {
    let query = supabase
      .from('sales')
      .select('quantity_oz, final_proceeds, status');

    if (filters?.date_from) {
      query = query.gte('sale_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('sale_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const sales = data || [];
    const totalSales = sales.length;
    const totalQuantityOz = sales.reduce((sum, s) => sum + (s.quantity_oz || 0), 0);
    const totalRevenue = sales.reduce((sum, s) => sum + (s.final_proceeds || 0), 0);
    const avgPricePerOz = totalQuantityOz > 0 ? totalRevenue / totalQuantityOz : 0;
    const pendingApprovals = sales.filter(s => s.status === SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL).length;

    return {
      success: true,
      data: {
        total_sales: totalSales,
        total_quantity_oz: totalQuantityOz,
        total_revenue: totalRevenue,
        avg_price_per_oz: avgPricePerOz,
        pending_approvals: pendingApprovals,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
