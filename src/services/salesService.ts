import { supabase } from '@/lib/supabase';
import { sendSaleApprovedNotification } from './notificationService';

export interface CreateSaleData {
  customer_id: string;
  quantity_oz: number;
  london_am_rate: number;
  freight_cost?: number;
  other_costs?: number;
  batch_id?: string;
  sale_date?: string;
  notes?: string;
}

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

export const ROYALTY_RATE = 0.03;

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

function generateSaleNumber(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SL-${year}${month}-${random}`;
}

export async function createSale(
  saleData: CreateSaleData,
  userEmail: string
): Promise<{ success: boolean; data?: Sale; error?: string }> {
  try {
    const calculations = calculateSaleProceeds(
      saleData.quantity_oz,
      saleData.london_am_rate,
      saleData.freight_cost || 0,
      saleData.other_costs || 0
    );

    const saleNumber = generateSaleNumber(new Date(saleData.sale_date || new Date()));

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_number: saleNumber,
        customer_id: saleData.customer_id,
        quantity_oz: saleData.quantity_oz,
        london_am_rate: saleData.london_am_rate,
        gross_proceeds: calculations.gross_proceeds,
        freight_cost: calculations.freight_cost,
        other_costs: calculations.other_costs,
        net_proceeds: calculations.net_proceeds,
        royalty_amount: calculations.royalty_amount,
        final_proceeds: calculations.final_proceeds,
        sale_date: saleData.sale_date || new Date().toISOString(),
        status: 'pending_approval',
        notes: saleData.notes,
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return { success: false, error: saleError.message };
    }

    await logAuditAction({
      action: 'sale_created',
      table_name: 'sales',
      record_id: sale.id,
      details: {
        sale_number: saleNumber,
        customer_id: saleData.customer_id,
        quantity_oz: saleData.quantity_oz,
        final_proceeds: calculations.final_proceeds,
      },
      user_email: userEmail,
    });

    return { success: true, data: sale };
  } catch (error: any) {
    console.error('Error in createSale:', error);
    return { success: false, error: error.message };
  }
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

export async function updateSaleStatus(
  saleId: string,
  status: string,
  userEmail: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('sales')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'sale_status_updated',
      table_name: 'sales',
      record_id: saleId,
      details: {
        new_status: status,
        notes,
      },
      user_email: userEmail,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveSale(
  saleId: string,
  userEmail: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await updateSaleStatus(saleId, 'approved', userEmail, notes);

    if (result.success) {
      const { data: sale } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name, email)
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (sale && sale.customer) {
        await sendSaleApprovedNotification(
          sale.sale_number,
          sale.customer.email,
          sale.customer.name,
          sale.quantity_oz,
          sale.london_am_rate,
          sale.final_proceeds,
          sale.id,
          sale.mechanism_type
        );
      }
    }

    return result;
  } catch (error: any) {
    console.error('Error in approveSale:', error);
    return { success: false, error: error.message };
  }
}

export async function rejectSale(
  saleId: string,
  userEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return updateSaleStatus(saleId, 'rejected', userEmail, reason);
}

export async function customerApproveSale(
  saleId: string,
  customerEmail: string
): Promise<{ success: boolean; error?: string; paymentId?: string }> {
  try {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, customer:customers(id, name, email)')
      .eq('id', saleId)
      .maybeSingle();

    if (saleError || !sale) {
      return { success: false, error: saleError?.message || 'Sale not found' };
    }

    const mechanism = sale.mechanism_type?.toLowerCase() || 'spot';

    // TOUJOURS créer un paiement virtuel automatique
    // Status de la vente → 'waiting_for_payment'
    const newStatus = 'waiting_for_payment';

    // 1. Créer le paiement virtuel en utilisant la fonction DB
    const { data: virtualPaymentId, error: paymentError } = await supabase
      .rpc('create_virtual_payment', {
        p_sale_id: saleId,
        p_customer_id: sale.customer?.id,
        p_amount: sale.final_proceeds,
        p_currency: 'USD',
        p_mechanism_type: mechanism,
        p_approved_date: new Date().toISOString()
      });

    if (paymentError) {
      console.error('Error creating virtual payment:', paymentError);
      return { success: false, error: 'Failed to create virtual payment: ' + paymentError.message };
    }

    // 2. Log audit action
    await logAuditAction({
      action: 'customer_approved_with_virtual_payment',
      table_name: 'sales',
      record_id: saleId,
      details: {
        customer_email: customerEmail,
        mechanism_type: mechanism,
        virtual_payment_id: virtualPaymentId,
        note: `Customer approved sale. Virtual payment created (${mechanism} terms). Status: waiting_for_payment`,
        approved_at: new Date().toISOString()
      },
      user_email: customerEmail,
    });

    // 3. Update sale status to waiting_for_payment
    const statusResult = await updateSaleStatus(
      saleId,
      newStatus,
      customerEmail,
      `Customer approved sale - Virtual payment created (${mechanism} terms). Payment ID: ${virtualPaymentId}`
    );

    if (!statusResult.success) {
      return statusResult;
    }

    return {
      success: true,
      paymentId: virtualPaymentId
    };
  } catch (error: any) {
    console.error('Error in customerApproveSale:', error);
    return { success: false, error: error.message };
  }
}

export async function customerRejectSale(
  saleId: string,
  customerEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return updateSaleStatus(saleId, 'customer_rejected', customerEmail, reason);
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
      .select('id, batch_number, weight_oz, metal_type, status')
      .eq('status', 'ready_for_sale')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const totalWeight = (data || []).reduce((sum, batch) => sum + (batch.weight_oz || 0), 0);

    return {
      success: true,
      data: {
        total_weight_oz: totalWeight,
        batches: data || [],
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
    const pendingApprovals = sales.filter(s => s.status === 'pending_approval').length;

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
