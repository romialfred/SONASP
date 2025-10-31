import { supabase } from '@/lib/supabase';

export interface CreatePaymentData {
  sale_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  expected_date: string;
  bank_name: string;
  account_number?: string;
  reference_number: string;
  proof_url?: string;
  notes?: string;
}

export interface CreateRealPaymentData {
  sale_id: string;
  customer_bank_id: string;
  seller_bank_id: string;
  payment_currency: string;
  receiving_currency: string;
  received_amount: number;
  reference_number: string;
  fx_rate?: number;
  notes?: string;
}

export interface SaleAwaitingPayment {
  id: string;
  sale_number: string;
  customer_id: string;
  customer_name: string;
  quantity_oz: number;
  sale_date: string;
  mechanism_type?: string;
  gross_proceeds: number;
  net_proceeds: number;
  final_proceeds: number;
  status: string;
}

export interface CustomerBank {
  id: string;
  bank_name: string;
  country: string;
  currency: string;
  account_number: string;
  swift_code?: string;
  is_primary: boolean;
}

export interface SellerBank {
  id: string;
  stakeholder_type: string;
  stakeholder_id: string;
  account_name: string;
  bank_name: string;
  bank_country: string;
  account_currency: string;
  swift_code?: string;
  is_primary: boolean;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  expected_date: string;
  actual_date?: string;
  bank_name: string;
  account_number?: string;
  reference_number: string;
  proof_url?: string;
  status: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface FXRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
}

export async function createPayment(
  paymentData: CreatePaymentData,
  userId: string
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  try {
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        sale_id: paymentData.sale_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        fx_rate: paymentData.fx_rate,
        expected_date: paymentData.expected_date,
        bank_name: paymentData.bank_name,
        account_number: paymentData.account_number,
        reference_number: paymentData.reference_number,
        proof_url: paymentData.proof_url,
        status: 'pending',
        notes: paymentData.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      console.error('Error details:', JSON.stringify(paymentError, null, 2));
      return { success: false, error: paymentError.message };
    }

    // Log audit event
    console.log('Payment created:', payment.id);

    return { success: true, data: payment };
  } catch (error: any) {
    console.error('Error in createPayment:', error);
    return { success: false, error: error.message };
  }
}

export async function getPaymentById(
  paymentId: string
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        sale:sales(
          id,
          sale_number,
          customer_id,
          quantity_oz,
          final_proceeds,
          customer:customers(id, name, email, country)
        )
      `)
      .eq('id', paymentId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPaymentsBySale(
  saleId: string
): Promise<{ success: boolean; data?: Payment[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updatePaymentStatus(
  paymentId: string,
  status: string,
  userId: string,
  actualDate?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      status,
    };

    if (actualDate) {
      updateData.actual_date = actualDate;
    }

    if (status === 'approved') {
      updateData.approved_by = userId;
      updateData.approved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log audit event
    console.log('Payment status updated:', paymentId, status);

    if (status === 'approved') {
      const { data: payment } = await supabase
        .from('payments')
        .select('sale_id')
        .eq('id', paymentId)
        .maybeSingle();

      if (payment) {
        await supabase
          .from('sales')
          .update({
            status: 'payment_received',
          })
          .eq('id', payment.sale_id);
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approvePayment(
  paymentId: string,
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  return updatePaymentStatus(paymentId, 'approved', userId, undefined, notes);
}

export async function rejectPayment(
  paymentId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return updatePaymentStatus(paymentId, 'rejected', userId, undefined, reason);
}

export async function uploadPaymentProof(
  file: File,
  paymentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${paymentId}-${Date.now()}.${fileExt}`;
    const filePath = `payment-proofs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('payments')
      .update({ proof_url: publicUrl })
      .eq('id', paymentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, url: publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCurrentFXRate(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{ success: boolean; data?: FXRate; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFXRateHistory(
  fromCurrency: string,
  toCurrency: string = 'USD',
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; data?: FXRate[]; error?: string }> {
  try {
    let query = supabase
      .from('fx_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('rate_date', { ascending: false });

    if (dateFrom) {
      query = query.gte('rate_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('rate_date', dateTo);
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

export async function compareFXRates(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{
  success: boolean;
  data?: {
    current_rate: number;
    previous_rate: number;
    change_percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('fx_rates')
      .select('rate, rate_date')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('rate_date', { ascending: false })
      .limit(2);

    if (error || !data || data.length < 2) {
      return { success: false, error: 'Insufficient data for comparison' };
    }

    const currentRate = data[0].rate;
    const previousRate = data[1].rate;
    const changePercentage = ((currentRate - previousRate) / previousRate) * 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercentage > 0.1) trend = 'up';
    else if (changePercentage < -0.1) trend = 'down';

    return {
      success: true,
      data: {
        current_rate: currentRate,
        previous_rate: previousRate,
        change_percentage: changePercentage,
        trend,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSalesAwaitingPayment(): Promise<{
  success: boolean;
  data?: SaleAwaitingPayment[];
  error?: string;
}> {
  try {
    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        customer_id,
        quantity_oz,
        sale_date,
        mechanism_type,
        gross_proceeds,
        net_proceeds,
        final_proceeds,
        status,
        customers(id, name)
      `)
      .eq('status', 'waiting_for_payment')
      .order('sale_date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const formattedSales: SaleAwaitingPayment[] = (sales || []).map((sale: any) => ({
      id: sale.id,
      sale_number: sale.sale_number,
      customer_id: sale.customer_id,
      customer_name: sale.customers?.name || 'Unknown',
      quantity_oz: sale.quantity_oz,
      sale_date: sale.sale_date,
      mechanism_type: sale.mechanism_type,
      gross_proceeds: sale.gross_proceeds,
      net_proceeds: sale.net_proceeds,
      final_proceeds: sale.final_proceeds,
      status: sale.status,
    }));

    return { success: true, data: formattedSales };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCustomerBanks(
  customerId: string
): Promise<{ success: boolean; data?: CustomerBank[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('customer_banks')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSellerBanks(
  stakeholderType: string = 'mining_company'
): Promise<{ success: boolean; data?: SellerBank[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('stakeholder_bank_accounts')
      .select('*')
      .eq('stakeholder_type', stakeholderType)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createRealPayment(
  paymentData: CreateRealPaymentData,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, status, gross_proceeds, final_proceeds')
      .eq('id', paymentData.sale_id)
      .maybeSingle();

    if (saleError || !sale) {
      return { success: false, error: 'Sale not found' };
    }

    if (sale.status !== 'waiting_for_payment' && sale.status !== 'virtual_payment') {
      return {
        success: false,
        error: `Cannot record payment for sale with status: ${sale.status}`,
      };
    }

    const { data: existingRealPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('sale_id', paymentData.sale_id)
      .eq('payment_type', 'real')
      .maybeSingle();

    if (existingRealPayment) {
      return {
        success: false,
        error: 'A real payment already exists for this sale',
      };
    }

    const fxRate = paymentData.fx_rate || 1.0;
    const expectedAmount = sale.final_proceeds || sale.gross_proceeds;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        sale_id: paymentData.sale_id,
        amount: paymentData.received_amount,
        currency: paymentData.receiving_currency,
        payment_type: 'real',
        is_virtual: false,
        customer_bank_id: paymentData.customer_bank_id,
        seller_bank_id: paymentData.seller_bank_id,
        payment_currency: paymentData.payment_currency,
        receiving_currency: paymentData.receiving_currency,
        received_amount: paymentData.received_amount,
        fx_rate: fxRate,
        expected_date: new Date().toISOString().split('T')[0],
        actual_date: new Date().toISOString().split('T')[0],
        reference_number: paymentData.reference_number,
        status: 'approved',
        notes: paymentData.notes,
        created_by: userId,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating real payment:', paymentError);
      return { success: false, error: paymentError.message };
    }

    console.log('Real payment created successfully:', payment.id);
    return { success: true, data: payment };
  } catch (error: any) {
    console.error('Error in createRealPayment:', error);
    return { success: false, error: error.message };
  }
}

export async function getPaymentStatistics(filters?: {
  date_from?: string;
  date_to?: string;
}): Promise<{
  success: boolean;
  data?: {
    total_payments: number;
    total_amount: number;
    pending_approvals: number;
    approved_payments: number;
  };
  error?: string;
}> {
  try {
    let query = supabase
      .from('payments')
      .select('amount, currency, fx_rate, status');

    if (filters?.date_from) {
      query = query.gte('expected_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('expected_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const payments = data || [];
    const totalPayments = payments.length;

    const totalAmount = payments.reduce((sum, p) => {
      const amountInUsd = p.currency === 'USD' ? p.amount : (p.amount / (p.fx_rate || 1));
      return sum + amountInUsd;
    }, 0);

    const pendingApprovals = payments.filter(p => p.status === 'pending').length;
    const approvedPayments = payments.filter(p => p.status === 'approved').length;

    return {
      success: true,
      data: {
        total_payments: totalPayments,
        total_amount: totalAmount,
        pending_approvals: pendingApprovals,
        approved_payments: approvedPayments,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
