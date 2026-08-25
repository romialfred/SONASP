import { supabase } from '@/lib/supabase';
import {
  decideInternationalPayment,
  executeInternationalPayment,
  type DecideInternationalPaymentData,
  type ExecuteInternationalPaymentData,
  type InternationalPaymentMutationResult,
} from '@/services/paymentService';

export interface VirtualPayment {
  id: string;
  sale_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  mechanism_type: string;
  virtual_due_date: string;
  auto_credited_at: string | null;
  status: string;
  version: number;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  sale_number: string;
  sale_status: string;
  customer_name: string;
  customer_email: string;
  payment_urgency: 'overdue' | 'due_today' | 'due_soon' | 'pending';
  days_overdue: number;
}

interface PendingVirtualPaymentRow {
  id: string;
  sale_id: string;
  customer_id: string | null;
  amount: number;
  currency: string;
  mechanism_type: string | null;
  virtual_due_date: string | null;
  auto_credited_at: string | null;
  status: string | null;
  version: number;
  reference_number: string | null;
  notes: string | null;
  created_at: string | null;
  sale: {
    sale_number: string;
    status: string;
    seller_type: string;
    customer: { name: string; email: string } | null;
  } | null;
}

function toVirtualPayment(row: PendingVirtualPaymentRow): VirtualPayment {
  const due = row.virtual_due_date || row.created_at || new Date().toISOString();
  const dueDate = new Date(`${due.slice(0, 10)}T00:00:00Z`);
  const currentDate = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const daysUntilDue = Math.round((dueDate.getTime() - currentDate.getTime()) / 86_400_000);
  const paymentUrgency: VirtualPayment['payment_urgency'] = daysUntilDue < 0
    ? 'overdue'
    : daysUntilDue === 0
      ? 'due_today'
      : daysUntilDue <= 3
        ? 'due_soon'
        : 'pending';

  return {
    id: row.id,
    sale_id: row.sale_id,
    customer_id: row.customer_id || '',
    amount: Number(row.amount || 0),
    currency: row.currency || 'USD',
    mechanism_type: row.mechanism_type || 'spot',
    virtual_due_date: due,
    auto_credited_at: row.auto_credited_at,
    status: row.status || 'pending',
    version: Number(row.version || 0),
    reference_number: row.reference_number,
    notes: row.notes,
    created_at: row.created_at || due,
    sale_number: row.sale?.sale_number || '—',
    sale_status: row.sale?.status || '—',
    customer_name: row.sale?.customer?.name || 'Client non renseigné',
    customer_email: row.sale?.customer?.email || '',
    payment_urgency: paymentUrgency,
    days_overdue: Math.max(0, -daysUntilDue),
  };
}

export interface ProcessingInternationalPayment {
  id: string;
  sale_id: string;
  customer_id: string | null;
  amount: number;
  currency: string;
  status: 'processing';
  version: number;
  reference_number: string | null;
  executed_by: string;
  executed_at: string;
  proof_url: string | null;
  sale: {
    id: string;
    sale_number: string;
    status: string;
    seller_type: string;
    customer: { id: string; name: string; email: string } | null;
  } | null;
}

/**
 * Récupère tous les paiements virtuels en attente
 */
export async function getVirtualPayments(): Promise<{ success: boolean; data?: VirtualPayment[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        sale_id,
        customer_id,
        amount,
        currency,
        mechanism_type,
        virtual_due_date,
        auto_credited_at,
        status,
        version,
        reference_number,
        notes,
        created_at,
        sale:sales!inner(
          sale_number,
          status,
          seller_type,
          customer:customers(name, email)
        )
      `)
      .eq('is_virtual', true)
      .eq('status', 'pending')
      .eq('sale.seller_type', 'sonasp')
      .order('virtual_due_date', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: ((data || []) as unknown as PendingVirtualPaymentRow[]).map(toVirtualPayment),
    };
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
      .from('payments')
      .select(`
        id, sale_id, customer_id, amount, currency, mechanism_type,
        virtual_due_date, auto_credited_at, status, version,
        reference_number, notes, created_at,
        sale:sales!inner(sale_number, status, seller_type, customer:customers(name, email))
      `)
      .eq('is_virtual', true)
      .eq('status', 'pending')
      .eq('sale.seller_type', 'sonasp')
      .eq('customer_id', customerId)
      .order('virtual_due_date', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: ((data || []) as unknown as PendingVirtualPaymentRow[]).map(toVirtualPayment),
    };
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

export async function getProcessingInternationalPayments(): Promise<{
  success: boolean;
  data?: ProcessingInternationalPayment[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        sale_id,
        customer_id,
        amount,
        currency,
        status,
        version,
        reference_number,
        executed_by,
        executed_at,
        proof_url,
        sale:sales!inner(
          id,
          sale_number,
          status,
          seller_type,
          customer:customers(id, name, email)
        )
      `)
      .eq('status', 'processing')
      .eq('sale.seller_type', 'sonasp')
      .order('executed_at', { ascending: true });
    if (error) throw error;
    return { success: true, data: (data || []) as unknown as ProcessingInternationalPayment[] };
  } catch (error: any) {
    console.error('Error fetching payments pending reconciliation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Adaptateur 4H conservé dans ce service pour les écrans historiques.
 * Aucun acteur, statut, horodatage, taux FX ou chemin de preuve n'est accepté.
 */
export async function convertVirtualToActual(
  convertData: ExecuteInternationalPaymentData,
): Promise<{ success: boolean; data?: InternationalPaymentMutationResult; error?: string }> {
  try {
    const data = await executeInternationalPayment(convertData);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Le paiement a été refusé.' };
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
    const result = await getVirtualPayments();
    if (!result.success) throw new Error(result.error || 'Paiements virtuels indisponibles.');
    const payments = result.data || [];

    const stats = {
      total: payments.length,
      overdue: payments.filter(p => p.payment_urgency === 'overdue').length,
      due_today: payments.filter(p => p.payment_urgency === 'due_today').length,
      due_soon: payments.filter(p => p.payment_urgency === 'due_soon').length,
      pending: payments.filter(p => p.payment_urgency === 'pending').length,
      total_amount: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      overdue_amount: payments.filter(p => p.payment_urgency === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0),
    };

    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Error fetching virtual payment stats:', error);
    return { success: false, error: error.message };
  }
}

export async function reconcileInternationalPayment(
  decisionData: DecideInternationalPaymentData,
): Promise<{ success: boolean; data?: InternationalPaymentMutationResult; error?: string }> {
  try {
    const data = await decideInternationalPayment(decisionData);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Le rapprochement a été refusé.' };
  }
}
