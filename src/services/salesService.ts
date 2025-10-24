import { supabase } from '@/lib/supabase';
import { logSalesAction } from '@/lib/auditLog';
import { calculateSaleProceeds } from '@/utils/salesUtils';
import type { Database } from '@/types/database';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];

export interface CreateSaleParams {
  customer_id: string;
  batch_id?: string;
  quantity_oz: number;
  london_am_rate: number;
  freight_cost?: number;
  other_costs?: number;
}

export const salesService = {
  async createSale(params: CreateSaleParams, userId: string, userEmail: string) {
    const calculations = calculateSaleProceeds(
      params.quantity_oz,
      params.london_am_rate,
      params.freight_cost || 0,
      params.other_costs || 0
    );

    const { data, error } = await supabase
      .from('sales')
      .insert({
        sale_number: '',
        customer_id: params.customer_id,
        batch_id: params.batch_id || null,
        quantity_oz: params.quantity_oz,
        london_am_rate: params.london_am_rate,
        freight_cost: params.freight_cost || 0,
        other_costs: params.other_costs || 0,
        gross_proceeds: calculations.grossProceeds,
        net_proceeds: calculations.netProceeds,
        royalties: calculations.royalties,
        final_proceeds: calculations.finalProceeds,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create sale');

    await logSalesAction(userId, userEmail, 'CREATE', data.sale_number, 'Sale created');

    return data;
  },

  async getSaleById(id: string) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers(*),
        batch:batches(batch_number, weight_ounces),
        payments(*),
        email_logs(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listSales(filters?: {
    status?: string;
    customer_id?: string;
    from_date?: string;
    to_date?: string;
  }) {
    let query = supabase
      .from('sales')
      .select(`
        *,
        customer:customers(name, email),
        batch:batches(batch_number)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async approveSale(saleId: string, userId: string, userEmail: string) {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('sale_number')
      .eq('id', saleId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    const { error } = await supabase
      .from('sales')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', saleId);

    if (error) throw error;

    await logSalesAction(userId, userEmail, 'APPROVE', sale.sale_number, 'Sale approved by management');

    return true;
  },

  async rejectSale(saleId: string, userId: string, userEmail: string, reason: string) {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('sale_number')
      .eq('id', saleId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    const { error } = await supabase
      .from('sales')
      .update({ status: 'rejected' })
      .eq('id', saleId);

    if (error) throw error;

    await logSalesAction(userId, userEmail, 'REJECT', sale.sale_number, `Sale rejected: ${reason}`);

    return true;
  },

  async getSalesSummary(filters?: {
    from_date?: string;
    to_date?: string;
  }) {
    let query = supabase
      .from('sales')
      .select('*');

    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error } = await query;
    if (error) throw error;

    const summary = {
      total_sales: data.length,
      total_quantity_oz: data.reduce((sum, s) => sum + Number(s.quantity_oz), 0),
      total_revenue: data.reduce((sum, s) => sum + Number(s.final_proceeds), 0),
      pending_count: data.filter(s => s.status === 'pending').length,
      completed_count: data.filter(s => s.status === 'completed').length,
    };

    return summary;
  },
};
