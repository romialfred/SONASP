import { supabase } from '@/lib/supabase';
import { logSalesAction } from '@/lib/auditLog';
import type { Database } from '@/types/database';

type Payment = Database['public']['Tables']['payments']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

export interface CreatePaymentParams {
  sale_id: string;
  expected_date: string;
  amount: number;
  currency: string;
  fx_rate?: number;
  bank_name: string;
  account_number?: string;
  reference_number: string;
  proof_url?: string;
  notes?: string;
}

export const paymentService = {
  async createPayment(params: CreatePaymentParams, userId: string, userEmail: string) {
    const { data: sale } = await supabase
      .from('sales')
      .select('sale_number')
      .eq('id', params.sale_id)
      .maybeSingle();

    if (!sale) throw new Error('Sale not found');

    const { data, error } = await supabase
      .from('payments')
      .insert({
        ...params,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create payment');

    await supabase
      .from('sales')
      .update({ status: 'payment_received' })
      .eq('id', params.sale_id);

    await logSalesAction(
      userId,
      userEmail,
      'SUBMIT_PAYMENT',
      sale.sale_number,
      `Payment submitted: ${params.amount} ${params.currency}`
    );

    return data;
  },

  async approvePayment(paymentId: string, userId: string, userEmail: string) {
    const { data: payment } = await supabase
      .from('payments')
      .select('sale_id, amount, currency, sale:sales(sale_number)')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) throw new Error('Payment not found');

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        actual_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', paymentId);

    if (error) throw error;

    await supabase
      .from('sales')
      .update({ status: 'completed' })
      .eq('id', payment.sale_id);

    await logSalesAction(
      userId,
      userEmail,
      'APPROVE_PAYMENT',
      payment.sale.sale_number,
      `Payment approved: ${payment.amount} ${payment.currency}`
    );

    return true;
  },

  async rejectPayment(paymentId: string, userId: string, userEmail: string, reason: string) {
    const { data: payment } = await supabase
      .from('payments')
      .select('sale_id, sale:sales(sale_number)')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) throw new Error('Payment not found');

    const { error } = await supabase
      .from('payments')
      .update({ status: 'rejected' })
      .eq('id', paymentId);

    if (error) throw error;

    await supabase
      .from('sales')
      .update({ status: 'customer_approved' })
      .eq('id', payment.sale_id);

    await logSalesAction(
      userId,
      userEmail,
      'REJECT_PAYMENT',
      payment.sale.sale_number,
      `Payment rejected: ${reason}`
    );

    return true;
  },

  async getPendingPayments() {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        sale:sales(sale_number, customer:customers(name, email))
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getPaymentsBySale(saleId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false});

    if (error) throw error;
    return data;
  },

  async getPaymentHistory(filters?: {
    from_date?: string;
    to_date?: string;
    currency?: string;
    status?: string;
  }) {
    let query = supabase
      .from('payments')
      .select(`
        *,
        sale:sales(sale_number, customer:customers(name))
      `)
      .order('created_at', { ascending: false });

    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }
    if (filters?.currency) {
      query = query.eq('currency', filters.currency);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};
