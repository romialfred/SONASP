import { supabase } from '@/lib/supabase';

export interface VirtualPayment {
  id: string;
  sale_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  mechanism_type: string;
  virtual_due_date: string;
  auto_credited_at: string;
  status: string;
  reference_number: string;
  notes: string;
  created_at: string;
  sale_number: string;
  sale_status: string;
  customer_name: string;
  customer_email: string;
  payment_urgency: 'overdue' | 'due_today' | 'due_soon' | 'pending';
  days_overdue: number;
}

export interface ConvertToActualPaymentData {
  paymentId: string;
  actualDate: string;
  bankName: string;
  accountNumber: string;
  referenceNumber: string;
  transactionId?: string;
  fxRate?: number;
  proofUrl?: string;
  notes?: string;
  convertedBy: string;
}

/**
 * Récupère tous les paiements virtuels en attente
 */
export async function getVirtualPayments(): Promise<{ success: boolean; data?: VirtualPayment[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('virtual_payments_view')
      .select('*')
      .order('virtual_due_date', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching virtual payments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère un paiement virtuel spécifique
 */
export async function getVirtualPaymentById(paymentId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        sale:sales(
          id,
          sale_number,
          quantity_oz,
          london_am_rate,
          gross_proceeds,
          net_proceeds,
          final_proceeds,
          status,
          mechanism_type
        ),
        customer:customers(
          id,
          name,
          email,
          country,
          phone
        )
      `)
      .eq('id', paymentId)
      .eq('is_virtual', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return { success: false, error: 'Virtual payment not found' };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching virtual payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les paiements virtuels par customer
 */
export async function getVirtualPaymentsByCustomer(customerId: string): Promise<{ success: boolean; data?: VirtualPayment[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('virtual_payments_view')
      .select('*')
      .eq('customer_id', customerId)
      .order('virtual_due_date', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching virtual payments by customer:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les paiements virtuels par sale
 */
export async function getVirtualPaymentBySale(saleId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        customer:customers(name, email)
      `)
      .eq('sale_id', saleId)
      .eq('is_virtual', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching virtual payment by sale:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Convertit un paiement virtuel en paiement réel
 */
export async function convertVirtualToActual(
  convertData: ConvertToActualPaymentData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('convert_virtual_to_actual_payment', {
      p_payment_id: convertData.paymentId,
      p_actual_date: convertData.actualDate,
      p_bank_name: convertData.bankName,
      p_account_number: convertData.accountNumber,
      p_reference_number: convertData.referenceNumber,
      p_transaction_id: convertData.transactionId || null,
      p_fx_rate: convertData.fxRate || null,
      p_proof_url: convertData.proofUrl || null,
      p_notes: convertData.notes || null,
      p_converted_by: convertData.convertedBy
    });

    if (error) {
      throw error;
    }

    // Mettre à jour le statut de la vente associée
    const { data: payment } = await supabase
      .from('payments')
      .select('sale_id')
      .eq('id', convertData.paymentId)
      .maybeSingle();

    if (payment) {
      await supabase
        .from('sales')
        .update({ status: 'payment_received' })
        .eq('id', payment.sale_id);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error converting virtual payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtient les statistiques des paiements virtuels
 */
export async function getVirtualPaymentStats(): Promise<{
  success: boolean;
  data?: {
    total: number;
    overdue: number;
    due_today: number;
    due_soon: number;
    pending: number;
    total_amount: number;
    overdue_amount: number;
  };
  error?: string;
}> {
  try {
    const { data: payments, error } = await supabase
      .from('virtual_payments_view')
      .select('*');

    if (error) {
      throw error;
    }

    const stats = {
      total: payments?.length || 0,
      overdue: payments?.filter(p => p.payment_urgency === 'overdue').length || 0,
      due_today: payments?.filter(p => p.payment_urgency === 'due_today').length || 0,
      due_soon: payments?.filter(p => p.payment_urgency === 'due_soon').length || 0,
      pending: payments?.filter(p => p.payment_urgency === 'pending').length || 0,
      total_amount: payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      overdue_amount: payments?.filter(p => p.payment_urgency === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
    };

    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Error fetching virtual payment stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marque un paiement virtuel comme reçu (sans conversion complète)
 */
export async function markVirtualPaymentReceived(
  paymentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .eq('is_virtual', true);

    if (error) {
      throw error;
    }

    // Update sale status
    const { data: payment } = await supabase
      .from('payments')
      .select('sale_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (payment) {
      await supabase
        .from('sales')
        .update({ status: 'payment_received' })
        .eq('id', payment.sale_id);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error marking virtual payment received:', error);
    return { success: false, error: error.message };
  }
}
