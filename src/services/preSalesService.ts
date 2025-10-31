import { supabase } from '@/lib/supabase';
import { logAuditAction } from '@/lib/auditLog';

export interface CreatePreSaleData {
  customer_id: string;
  batch_id: string;
  quantity_oz: number;
  london_am_rate: number;
  freight_cost?: number;
  other_costs?: number;
  expected_arrival_date?: string;
  sale_date?: string;
  notes?: string;
  seller_id?: string;
  seller_type?: 'mining_company' | 'mansa';
  payment_type?: 'bank_transfer' | 'cash' | 'check' | 'virtual';
  customer_bank_id?: string;
  fx_rate?: number;
}

export interface PreSale {
  id: string;
  pre_sale_number: string;
  customer_id: string;
  batch_id: string;
  quantity_oz: number;
  london_am_rate: number;
  gross_proceeds: number;
  freight_cost: number;
  other_costs: number;
  net_proceeds: number;
  royalty_rate: number;
  royalty_amount: number;
  final_proceeds: number;
  status: string;
  expected_arrival_date?: string;
  actual_arrival_date?: string;
  is_converted: boolean;
  converted_sale_id?: string;
  sale_date: string;
  created_at: string;
  updated_at: string;
}

export interface PreSaleSummary extends PreSale {
  customer_name: string;
  batch_number: string;
  batch_status: string;
  converted_sale_number?: string;
  match_status?: string;
  variance_oz?: number;
  variance_percentage?: number;
}

export interface CustomerAccountBalance {
  customer_id: string;
  customer_name: string;
  balance: number;
  pending_pre_sales: number;
  completed_pre_sales: number;
  last_transaction_date?: string;
}

export const ROYALTY_RATE = 0.03;

/**
 * Calculate pre-sale amounts (same as regular sales)
 */
export function calculatePreSaleAmounts(
  quantity_oz: number,
  london_am_rate: number,
  freight_cost: number = 0,
  other_costs: number = 0,
  royalty_rate: number = ROYALTY_RATE
) {
  const gross_proceeds = quantity_oz * london_am_rate;
  const net_proceeds = gross_proceeds - freight_cost - other_costs;
  const royalty_amount = net_proceeds * royalty_rate;
  const final_proceeds = net_proceeds - royalty_amount;

  return {
    gross_proceeds: Number(gross_proceeds.toFixed(2)),
    net_proceeds: Number(net_proceeds.toFixed(2)),
    royalty_amount: Number(royalty_amount.toFixed(2)),
    final_proceeds: Number(final_proceeds.toFixed(2)),
  };
}

/**
 * Get all pre-sales with filtering
 */
export async function getPreSales(filters?: {
  status?: string;
  customer_id?: string;
  is_converted?: boolean;
  batch_id?: string;
}) {
  try {
    let query = supabase
      .from('pre_sales_summary')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.is_converted !== undefined) {
      query = query.eq('is_converted', filters.is_converted);
    }
    if (filters?.batch_id) {
      query = query.eq('batch_id', filters.batch_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: data as PreSaleSummary[] };
  } catch (error: any) {
    console.error('Error fetching pre-sales:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pre-sale by ID
 */
export async function getPreSaleById(id: string) {
  try {
    const { data, error } = await supabase
      .from('pre_sales_summary')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { success: false, error: 'Pre-sale not found' };
    }

    return { success: true, data: data as PreSaleSummary };
  } catch (error: any) {
    console.error('Error fetching pre-sale:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new pre-sale
 */
export async function createPreSale(data: CreatePreSaleData) {
  try {
    // Validate batch status (must be validated_for_transport)
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, batch_number, status, final_weight_oz')
      .eq('id', data.batch_id)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) {
      return { success: false, error: 'Batch not found' };
    }

    if (batch.status !== 'validated_for_transport') {
      return {
        success: false,
        error: `Batch must be validated for transport. Current status: ${batch.status}`,
      };
    }

    // Check if batch already has a pre-sale
    const { data: existingPreSale, error: existingError } = await supabase
      .from('pre_sales')
      .select('id, pre_sale_number')
      .eq('batch_id', data.batch_id)
      .eq('is_converted', false)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existingPreSale) {
      return {
        success: false,
        error: `Batch already has active pre-sale: ${existingPreSale.pre_sale_number}`,
      };
    }

    // Calculate amounts
    const calculations = calculatePreSaleAmounts(
      data.quantity_oz,
      data.london_am_rate,
      data.freight_cost || 0,
      data.other_costs || 0
    );

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Create pre-sale
    const { data: preSale, error: createError } = await supabase
      .from('pre_sales')
      .insert({
        customer_id: data.customer_id,
        batch_id: data.batch_id,
        quantity_oz: data.quantity_oz,
        london_am_rate: data.london_am_rate,
        freight_cost: data.freight_cost || 0,
        other_costs: data.other_costs || 0,
        ...calculations,
        royalty_rate: ROYALTY_RATE,
        expected_arrival_date: data.expected_arrival_date,
        sale_date: data.sale_date || new Date().toISOString().split('T')[0],
        notes: data.notes,
        seller_id: data.seller_id,
        seller_type: data.seller_type || 'mansa',
        is_internal_sale: false,
        payment_type: data.payment_type,
        customer_bank_id: data.customer_bank_id,
        fx_rate: data.fx_rate,
        status: 'pending_management_approval',
        created_by: user?.id,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Log audit action
    await logAuditAction({
      action: 'create',
      table_name: 'pre_sales',
      record_id: preSale.id,
      details: { pre_sale: preSale },
      user_email: 'system@mansa.com'
    });

    return { success: true, data: preSale };
  } catch (error: any) {
    console.error('Error creating pre-sale:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update pre-sale status (follow same workflow as sales)
 */
export async function updatePreSaleStatus(
  preSaleId: string,
  newStatus: string,
  notes?: string
) {
  try {
    const { data: preSale, error: fetchError } = await supabase
      .from('pre_sales')
      .select('*')
      .eq('id', preSaleId)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('pre_sales')
      .update({
        status: newStatus,
        notes: notes || preSale.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', preSaleId)
      .select()
      .single();

    if (error) throw error;

    await logAuditAction({
      action: 'update',
      table_name: 'pre_sales',
      record_id: preSaleId,
      details: { old_status: preSale.status, new_status: newStatus },
      user_email: 'system@mansa.com'
    });

    return { success: true, data };
  } catch (error: any) {
    console.error('Error updating pre-sale status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Approve pre-sale (management approval)
 */
export async function approvePreSale(preSaleId: string, notes?: string) {
  return updatePreSaleStatus(preSaleId, 'management_approved', notes);
}

/**
 * Reject pre-sale (management rejection)
 */
export async function rejectPreSale(preSaleId: string, notes?: string) {
  return updatePreSaleStatus(preSaleId, 'management_rejected', notes);
}

/**
 * Customer approves pre-sale
 */
export async function customerApprovePreSale(preSaleId: string) {
  return updatePreSaleStatus(preSaleId, 'customer_approved');
}

/**
 * Customer rejects pre-sale
 */
export async function customerRejectPreSale(preSaleId: string, reason?: string) {
  return updatePreSaleStatus(preSaleId, 'customer_rejected', reason);
}

/**
 * Get customer account balance
 */
export async function getCustomerAccountBalance(customerId: string) {
  try {
    // Call database function
    const { data, error } = await supabase
      .rpc('get_customer_account_balance', { p_customer_id: customerId });

    if (error) throw error;

    return { success: true, balance: data || 0 };
  } catch (error: any) {
    console.error('Error fetching customer balance:', error);
    return { success: false, error: error.message, balance: 0 };
  }
}

/**
 * Get customer accounts receivable summary
 */
export async function getCustomerAccountsReceivable() {
  try {
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('status', 'active')
      .order('name');

    if (customersError) throw customersError;

    const summaries: CustomerAccountBalance[] = [];

    for (const customer of customers || []) {
      const balanceResult = await getCustomerAccountBalance(customer.id);

      // Get pre-sales counts
      const { data: preSales, error: preSalesError } = await supabase
        .from('pre_sales')
        .select('status, final_proceeds')
        .eq('customer_id', customer.id);

      if (preSalesError) {
        console.error('Error fetching pre-sales for customer:', preSalesError);
        continue;
      }

      const pending = preSales?.filter(
        (ps) =>
          ps.status === 'customer_approved' ||
          ps.status === 'waiting_for_payment' ||
          ps.status === 'payment_received'
      ).length || 0;

      const completed = preSales?.filter(
        (ps) => ps.status === 'converted_to_sale' || ps.status === 'completed'
      ).length || 0;

      // Get last transaction date
      const { data: lastTransaction } = await supabase
        .from('customer_accounts_receivable')
        .select('transaction_date')
        .eq('customer_id', customer.id)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceResult.balance !== 0 || pending > 0 || completed > 0) {
        summaries.push({
          customer_id: customer.id,
          customer_name: customer.name,
          balance: balanceResult.balance,
          pending_pre_sales: pending,
          completed_pre_sales: completed,
          last_transaction_date: lastTransaction?.transaction_date,
        });
      }
    }

    return { success: true, data: summaries };
  } catch (error: any) {
    console.error('Error fetching accounts receivable:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get customer account transactions
 */
export async function getCustomerAccountTransactions(customerId: string) {
  try {
    const { data, error } = await supabase
      .from('customer_accounts_receivable')
      .select(`
        *,
        pre_sales:pre_sale_id(pre_sale_number),
        sales:sale_id(sale_number)
      `)
      .eq('customer_id', customerId)
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching account transactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get batches available for pre-sale (validated_for_transport status)
 */
export async function getBatchesForPreSale() {
  try {
    const { data, error } = await supabase
      .from('batches')
      .select(`
        id,
        batch_number,
        status,
        final_weight_oz,
        created_at,
        mining_companies:mining_company_id(name)
      `)
      .eq('status', 'validated_for_transport')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter out batches that already have active pre-sales
    const batchesWithPreSales = await supabase
      .from('pre_sales')
      .select('batch_id')
      .eq('is_converted', false);

    const usedBatchIds = new Set(
      batchesWithPreSales.data?.map((ps) => ps.batch_id) || []
    );

    const availableBatches = data?.filter((batch) => !usedBatchIds.has(batch.id));

    return { success: true, data: availableBatches };
  } catch (error: any) {
    console.error('Error fetching batches for pre-sale:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pre-sale statistics for dashboard
 */
export async function getPreSalesStatistics() {
  try {
    const { data, error } = await supabase
      .from('pre_sales')
      .select('status, final_proceeds, is_converted');

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      pending_approval: data?.filter((ps) => ps.status === 'pending_management_approval').length || 0,
      approved: data?.filter((ps) => ps.status === 'customer_approved').length || 0,
      awaiting_inventory: data?.filter((ps) => ps.status === 'customer_approved' && !ps.is_converted).length || 0,
      converted: data?.filter((ps) => ps.is_converted).length || 0,
      total_value: data?.reduce((sum, ps) => sum + (ps.final_proceeds || 0), 0) || 0,
      pending_value: data
        ?.filter((ps) => ps.status === 'customer_approved' && !ps.is_converted)
        .reduce((sum, ps) => sum + (ps.final_proceeds || 0), 0) || 0,
    };

    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Error fetching pre-sales statistics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get inventory matches for a pre-sale
 */
export async function getPreSaleInventoryMatch(preSaleId: string) {
  try {
    const { data, error } = await supabase
      .from('pre_sales_inventory_matches')
      .select(`
        *,
        batch:batch_id(batch_number, status),
        sale:sale_id(sale_number, status)
      `)
      .eq('pre_sale_id', preSaleId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching inventory match:', error);
    return { success: false, error: error.message };
  }
}
