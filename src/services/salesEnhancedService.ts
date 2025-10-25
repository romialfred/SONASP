import { supabase } from '@/lib/supabase';
import { logSalesAction } from '@/lib/auditLog';
import { calculateSaleProceeds } from '@/utils/salesUtils';
import type { Database } from '@/types/database';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type SaleLineItem = Database['public']['Tables']['sales_line_items']['Row'];
type SaleLineItemInsert = Database['public']['Tables']['sales_line_items']['Insert'];

export interface CreateSaleWithLineItemsParams {
  customer_id: string;
  salesperson_id?: string;
  contract_id?: string;
  payment_terms?: string;
  payment_schedule_type?: 'full' | 'installment' | 'milestone';
  discount_percentage?: number;
  discount_amount?: number;
  price_adjustment?: number;
  line_items: {
    batch_id?: string;
    metal_type: string;
    quantity_grams: number;
    quantity_oz: number;
    unit_price: number;
    fineness_percentage?: number;
    notes?: string;
  }[];
  internal_notes?: string;
  customer_notes?: string;
  freight_cost?: number;
  other_costs?: number;
}

export interface SaleWithDetails extends Sale {
  line_items?: SaleLineItem[];
  customer?: any;
  salesperson?: any;
  contract?: any;
  approvals?: any[];
  allocations?: any[];
  documents?: any[];
  audit_trail?: any[];
}

export const salesEnhancedService = {
  /**
   * Create a sale with multiple line items (multi-batch support)
   */
  async createSaleWithLineItems(
    params: CreateSaleWithLineItemsParams,
    userId: string,
    userEmail: string
  ): Promise<SaleWithDetails> {
    const totalQuantity = params.line_items.reduce((sum, item) => sum + item.quantity_oz, 0);
    const totalValue = params.line_items.reduce(
      (sum, item) => sum + item.quantity_oz * item.unit_price,
      0
    );

    const calculations = calculateSaleProceeds(
      totalQuantity,
      totalValue / totalQuantity,
      params.freight_cost || 0,
      params.other_costs || 0
    );

    const netProceeds = calculations.netProceeds - (params.discount_amount || 0);
    const finalProceeds = netProceeds - calculations.royalties;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_number: `SAL-${Date.now()}`,
        customer_id: params.customer_id,
        quantity_oz: totalQuantity,
        london_am_rate: totalValue / totalQuantity,
        freight_cost: params.freight_cost || 0,
        other_costs: params.other_costs || 0,
        gross_proceeds: calculations.grossProceeds,
        net_proceeds: netProceeds,
        royalties: calculations.royalties,
        final_proceeds: finalProceeds,
        status: 'pending',
        salesperson_id: params.salesperson_id,
        contract_id: params.contract_id,
        payment_terms: params.payment_terms || 'net_30',
        payment_schedule_type: params.payment_schedule_type || 'full',
        discount_percentage: params.discount_percentage || 0,
        discount_amount: params.discount_amount || 0,
        price_adjustment: params.price_adjustment || 0,
        internal_notes: params.internal_notes,
        customer_notes: params.customer_notes,
        created_by: userId,
      })
      .select()
      .maybeSingle();

    if (saleError) throw saleError;
    if (!sale) throw new Error('Failed to create sale');

    const lineItemsData: SaleLineItemInsert[] = params.line_items.map((item, index) => ({
      sale_id: sale.id,
      batch_id: item.batch_id,
      line_number: index + 1,
      metal_type: item.metal_type,
      quantity_grams: item.quantity_grams,
      quantity_oz: item.quantity_oz,
      unit_price: item.unit_price,
      fineness_percentage: item.fineness_percentage,
      fine_weight_oz: item.fineness_percentage
        ? (item.quantity_oz * item.fineness_percentage) / 100
        : item.quantity_oz,
      line_total: item.quantity_oz * item.unit_price,
      notes: item.notes,
    }));

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('sales_line_items')
      .insert(lineItemsData)
      .select();

    if (lineItemsError) throw lineItemsError;

    await this.autoAllocateInventory(sale.id, totalQuantity);

    await logSalesAction(userId, userEmail, 'CREATE', sale.sale_number, 'Multi-item sale created');

    return {
      ...sale,
      line_items: lineItems || [],
    };
  },

  /**
   * Automatically allocate inventory from refined batches
   */
  async autoAllocateInventory(saleId: string, quantityOz: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('auto_allocate_inventory', {
      p_sale_id: saleId,
      p_quantity_oz: quantityOz,
    });

    if (error) {
      console.error('Auto allocation error:', error);
      return false;
    }

    return data || false;
  },

  /**
   * Check if inventory is available for a given quantity
   */
  async checkInventoryAvailability(quantityOz: number, metalType: string = 'gold'): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_inventory_available', {
      p_quantity_oz: quantityOz,
      p_metal_type: metalType,
    });

    if (error) {
      console.error('Inventory check error:', error);
      return false;
    }

    return data || false;
  },

  /**
   * Get sale with complete details including line items, approvals, etc.
   */
  async getSaleWithDetails(saleId: string): Promise<SaleWithDetails | null> {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        line_items:sales_line_items(*),
        customer:customers(*),
        salesperson:user_profiles!salesperson_id(*),
        contract:customer_contracts(*),
        approvals:sales_approvals(*),
        allocations:sales_allocations(*),
        documents:sales_documents(*),
        audit_trail:sales_audit_trail(*)
      `)
      .eq('id', saleId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * List sales with filters and pagination
   */
  async listSalesEnhanced(filters?: {
    status?: string;
    customer_id?: string;
    salesperson_id?: string;
    from_date?: string;
    to_date?: string;
    min_value?: number;
    max_value?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('sales')
      .select(`
        *,
        customer:customers(id, name, email, country),
        salesperson:user_profiles!salesperson_id(id, full_name, email),
        line_items:sales_line_items(count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.salesperson_id) {
      query = query.eq('salesperson_id', filters.salesperson_id);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }
    if (filters?.min_value) {
      query = query.gte('final_proceeds', filters.min_value);
    }
    if (filters?.max_value) {
      query = query.lte('final_proceeds', filters.max_value);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      sales: data || [],
      total: count || 0,
    };
  },

  /**
   * Update sale with new information
   */
  async updateSale(
    saleId: string,
    updates: Partial<SaleInsert>,
    userId: string,
    userEmail: string,
    changeReason?: string
  ): Promise<Sale> {
    const { data: currentSale } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', saleId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Sale not found');

    Object.keys(updates).forEach(async (key) => {
      if (currentSale && currentSale[key] !== updates[key]) {
        await supabase.from('sales_audit_trail').insert({
          sale_id: saleId,
          action: 'update',
          actor_id: userId,
          actor_name: userEmail,
          field_changed: key,
          old_value: String(currentSale[key] || ''),
          new_value: String(updates[key] || ''),
          change_reason: changeReason,
        });
      }
    });

    await logSalesAction(userId, userEmail, 'UPDATE', data.sale_number, `Sale updated: ${changeReason || 'No reason provided'}`);

    return data;
  },

  /**
   * Cancel a sale and release allocated inventory
   */
  async cancelSale(
    saleId: string,
    reason: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const { data: sale } = await supabase
      .from('sales')
      .select('sale_number')
      .eq('id', saleId)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    await supabase
      .from('sales_allocations')
      .update({
        allocation_status: 'released',
        released_at: new Date().toISOString(),
        release_reason: reason,
      })
      .eq('sale_id', saleId)
      .eq('allocation_status', 'reserved');

    await supabase
      .from('sales')
      .update({
        status: 'cancelled',
        rejected_at: new Date().toISOString(),
        rejected_by: userId,
        rejection_reason: reason,
      })
      .eq('id', saleId);

    await logSalesAction(userId, userEmail, 'CANCEL', sale.sale_number, `Sale cancelled: ${reason}`);
  },

  /**
   * Complete a sale after payment received
   */
  async completeSale(
    saleId: string,
    userId: string,
    userEmail: string
  ): Promise<void> {
    const { data: sale } = await supabase
      .from('sales')
      .select('sale_number')
      .eq('id', saleId)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    await supabase
      .from('sales_allocations')
      .update({
        allocation_status: 'delivered',
        confirmed_at: new Date().toISOString(),
      })
      .eq('sale_id', saleId);

    await supabase
      .from('sales')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', saleId);

    await logSalesAction(userId, userEmail, 'COMPLETE', sale.sale_number, 'Sale completed');
  },

  /**
   * Get sales summary with aggregated metrics
   */
  async getSalesSummary(filters?: {
    from_date?: string;
    to_date?: string;
    customer_id?: string;
    salesperson_id?: string;
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
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.salesperson_id) {
      query = query.eq('salesperson_id', filters.salesperson_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const summary = {
      total_sales: data.length,
      total_quantity_oz: data.reduce((sum, s) => sum + Number(s.quantity_oz), 0),
      total_revenue: data.reduce((sum, s) => sum + Number(s.final_proceeds), 0),
      total_discounts: data.reduce((sum, s) => sum + Number(s.discount_amount), 0),
      avg_sale_value: data.length > 0
        ? data.reduce((sum, s) => sum + Number(s.final_proceeds), 0) / data.length
        : 0,
      pending_count: data.filter(s => s.status === 'pending').length,
      approved_count: data.filter(s => s.status === 'approved').length,
      completed_count: data.filter(s => s.status === 'completed').length,
      cancelled_count: data.filter(s => s.status === 'cancelled').length,
      pending_value: data
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + Number(s.final_proceeds), 0),
      approved_value: data
        .filter(s => s.status === 'approved')
        .reduce((sum, s) => sum + Number(s.final_proceeds), 0),
    };

    return summary;
  },

  /**
   * Get available inventory summary
   */
  async getAvailableInventory() {
    const { data: refined, error: refinedError } = await supabase
      .from('refining_records')
      .select('final_fine_ounces')
      .not('approved_at', 'is', null);

    if (refinedError) throw refinedError;

    const { data: allocated, error: allocatedError } = await supabase
      .from('sales_allocations')
      .select('allocated_quantity_oz')
      .in('allocation_status', ['reserved', 'confirmed']);

    if (allocatedError) throw allocatedError;

    const totalRefined = refined?.reduce((sum, r) => sum + Number(r.final_fine_ounces), 0) || 0;
    const totalAllocated = allocated?.reduce((sum, a) => sum + Number(a.allocated_quantity_oz), 0) || 0;

    return {
      total_refined_oz: totalRefined,
      total_allocated_oz: totalAllocated,
      available_oz: totalRefined - totalAllocated,
      allocation_percentage: totalRefined > 0 ? (totalAllocated / totalRefined) * 100 : 0,
    };
  },
};
