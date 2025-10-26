import { supabase } from '@/lib/supabase';
import { logAuditAction } from '@/lib/auditLog';

export interface CreatePaymentData {
  sale_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  amount_usd?: number;
  expected_date?: string;
  bank_name?: string;
  account_number?: string;
  reference_number?: string;
  proof_url?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  payment_number: string;
  sale_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  amount_usd: number;
  expected_date: string;
  received_date?: string;
  bank_name?: string;
  account_number?: string;
  reference_number?: string;
  proof_url?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FXRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
}

function generatePaymentNumber(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PAY-${year}${month}${day}-${random}`;
}

export async function createPayment(
  paymentData: CreatePaymentData,
  userEmail: string
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  try {
    const paymentNumber = generatePaymentNumber(new Date());
    const amountUsd = paymentData.amount_usd || (paymentData.amount / paymentData.fx_rate);

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        payment_number: paymentNumber,
        sale_id: paymentData.sale_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        fx_rate: paymentData.fx_rate,
        amount_usd: amountUsd,
        expected_date: paymentData.expected_date || new Date().toISOString(),
        bank_name: paymentData.bank_name,
        account_number: paymentData.account_number,
        reference_number: paymentData.reference_number,
        proof_url: paymentData.proof_url,
        status: 'pending_approval',
        notes: paymentData.notes,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      return { success: false, error: paymentError.message };
    }

    await logAuditAction({
      action: 'payment_created',
      table_name: 'payments',
      record_id: payment.id,
      details: {
        payment_number: paymentNumber,
        sale_id: paymentData.sale_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        amount_usd: amountUsd,
      },
      user_email: userEmail,
    });

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
  userEmail: string,
  receivedDate?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (receivedDate) {
      updateData.received_date = receivedDate;
    }

    const { error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'payment_status_updated',
      table_name: 'payments',
      record_id: paymentId,
      details: {
        new_status: status,
        received_date: receivedDate,
        notes,
      },
      user_email: userEmail,
    });

    if (status === 'received') {
      const { data: payment } = await supabase
        .from('payments')
        .select('sale_id')
        .eq('id', paymentId)
        .single();

      if (payment) {
        await supabase
          .from('sales')
          .update({
            status: 'payment_received',
            updated_at: new Date().toISOString(),
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
  userEmail: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  return updatePaymentStatus(paymentId, 'approved', userEmail, undefined, notes);
}

export async function rejectPayment(
  paymentId: string,
  userEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return updatePaymentStatus(paymentId, 'rejected', userEmail, undefined, reason);
}

export async function confirmPaymentReceived(
  paymentId: string,
  userEmail: string,
  receivedDate: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  return updatePaymentStatus(paymentId, 'received', userEmail, receivedDate, notes);
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

export async function getPaymentStatistics(filters?: {
  date_from?: string;
  date_to?: string;
}): Promise<{
  success: boolean;
  data?: {
    total_payments: number;
    total_amount_usd: number;
    pending_approvals: number;
    received_payments: number;
  };
  error?: string;
}> {
  try {
    let query = supabase
      .from('payments')
      .select('amount_usd, status');

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
    const totalAmountUsd = payments.reduce((sum, p) => sum + (p.amount_usd || 0), 0);
    const pendingApprovals = payments.filter(p => p.status === 'pending_approval').length;
    const receivedPayments = payments.filter(p => p.status === 'received').length;

    return {
      success: true,
      data: {
        total_payments: totalPayments,
        total_amount_usd: totalAmountUsd,
        pending_approvals: pendingApprovals,
        received_payments: receivedPayments,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
