import { supabase } from '@/lib/supabase';
import { logAuditAction } from '@/lib/auditLog';
import { SALES_STATUSES } from '@/constants/salesStatuses';

/**
 * Sales Approval Service
 * 
 * Manages the complete sales approval workflow:
 * 1. Create Sale → pending_management_approval
 * 2. Management Approves → pending_for_customer_approval
 * 3. Customer Approves → waiting_for_payment
 * 4. Payment Received → completed
 */

export interface ApprovalData {
  sale_id: string;
  approver_id: string;
  approver_role: 'management' | 'customer';
  notes?: string;
}

export interface PaymentData {
  sale_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method: string;
  payment_proof_url?: string;
  notes?: string;
}

/**
 * Management approves a sale
 * Transitions: pending_management_approval → pending_for_customer_approval
 */
export async function approveSaleByManagement(data: ApprovalData) {
  const { sale_id, approver_id, notes } = data;

  try {
    // 1. Get current sale
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .single();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    // 2. Validate current status
    if (sale.status !== SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL) {
      throw new Error(
        `Cannot approve sale with status "${sale.status}". Expected "${SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL}"`
      );
    }

    // 3. Update sale status
    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL,
        management_approved_by: approver_id,
        management_approved_at: new Date().toISOString(),
        management_approval_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Log audit trail
    await logAuditAction({
      action: 'SALE_APPROVED_BY_MANAGEMENT',
      table_name: 'sales',
      record_id: sale_id,
      changes: {
        from_status: sale.status,
        to_status: SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL,
        approver_id,
        notes
      }
    });

    // 5. TODO: Send email notification to customer
    // await sendCustomerApprovalEmail(updatedSale);

    return { success: true, sale: updatedSale };
  } catch (error: any) {
    console.error('Error approving sale by management:', error);
    throw error;
  }
}

/**
 * Management rejects a sale
 * Transitions: pending_management_approval → management_rejected
 */
export async function rejectSaleByManagement(data: ApprovalData) {
  const { sale_id, approver_id, notes } = data;

  try {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('status')
      .eq('id', sale_id)
      .single();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    if (sale.status !== SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL) {
      throw new Error(
        `Cannot reject sale with status "${sale.status}". Expected "${SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL}"`
      );
    }

    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: SALES_STATUSES.MANAGEMENT_REJECTED,
        management_rejected_by: approver_id,
        management_rejected_at: new Date().toISOString(),
        management_rejection_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logAuditAction({
      action: 'SALE_REJECTED_BY_MANAGEMENT',
      table_name: 'sales',
      record_id: sale_id,
      changes: {
        from_status: sale.status,
        to_status: SALES_STATUSES.MANAGEMENT_REJECTED,
        approver_id,
        notes
      }
    });

    return { success: true, sale: updatedSale };
  } catch (error: any) {
    console.error('Error rejecting sale by management:', error);
    throw error;
  }
}

/**
 * Customer approves a sale
 * Transitions: pending_for_customer_approval → waiting_for_payment
 */
export async function approveSaleByCustomer(data: ApprovalData) {
  const { sale_id, approver_id, notes } = data;

  try {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('status')
      .eq('id', sale_id)
      .single();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    if (sale.status !== SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL) {
      throw new Error(
        `Cannot approve sale with status "${sale.status}". Expected "${SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL}"`
      );
    }

    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: SALES_STATUSES.WAITING_FOR_PAYMENT,
        customer_approved_by: approver_id,
        customer_approved_at: new Date().toISOString(),
        customer_approval_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logAuditAction({
      action: 'SALE_APPROVED_BY_CUSTOMER',
      table_name: 'sales',
      record_id: sale_id,
      changes: {
        from_status: sale.status,
        to_status: SALES_STATUSES.WAITING_FOR_PAYMENT,
        approver_id,
        notes
      }
    });

    return { success: true, sale: updatedSale };
  } catch (error: any) {
    console.error('Error approving sale by customer:', error);
    throw error;
  }
}

/**
 * Customer rejects a sale
 * Transitions: pending_for_customer_approval → customer_rejected
 */
export async function rejectSaleByCustomer(data: ApprovalData) {
  const { sale_id, approver_id, notes } = data;

  try {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('status')
      .eq('id', sale_id)
      .single();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    if (sale.status !== SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL) {
      throw new Error(
        `Cannot reject sale with status "${sale.status}". Expected "${SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL}"`
      );
    }

    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: SALES_STATUSES.CUSTOMER_REJECTED,
        customer_rejected_by: approver_id,
        customer_rejected_at: new Date().toISOString(),
        customer_rejection_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logAuditAction({
      action: 'SALE_REJECTED_BY_CUSTOMER',
      table_name: 'sales',
      record_id: sale_id,
      changes: {
        from_status: sale.status,
        to_status: SALES_STATUSES.CUSTOMER_REJECTED,
        approver_id,
        notes
      }
    });

    return { success: true, sale: updatedSale };
  } catch (error: any) {
    console.error('Error rejecting sale by customer:', error);
    throw error;
  }
}

/**
 * Record payment received for a sale
 * Transitions: waiting_for_payment → payment_received → completed
 */
export async function recordPayment(data: PaymentData) {
  const { sale_id, payment_amount, payment_date, payment_method, payment_proof_url, notes } = data;

  try {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('status, total_amount')
      .eq('id', sale_id)
      .single();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    if (sale.status !== SALES_STATUSES.WAITING_FOR_PAYMENT) {
      throw new Error(
        `Cannot record payment for sale with status "${sale.status}". Expected "${SALES_STATUSES.WAITING_FOR_PAYMENT}"`
      );
    }

    // Validate payment amount
    if (payment_amount !== sale.total_amount) {
      console.warn(
        `Payment amount (${payment_amount}) does not match sale total (${sale.total_amount})`
      );
    }

    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: SALES_STATUSES.PAYMENT_RECEIVED,
        payment_amount,
        payment_date,
        payment_method,
        payment_proof_url,
        payment_notes: notes,
        payment_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logAuditAction({
      action: 'PAYMENT_RECORDED',
      table_name: 'sales',
      record_id: sale_id,
      changes: {
        from_status: sale.status,
        to_status: SALES_STATUSES.PAYMENT_RECEIVED,
        payment_amount,
        payment_date,
        payment_method
      }
    });

    // Automatically complete the sale after payment
    await completeSale(sale_id);

    return { success: true, sale: updatedSale };
  } catch (error: any) {
    console.error('Error recording payment:', error);
    throw error;
  }
}

/**
 * Complete a sale after payment is received
 * Transitions: payment_received → completed
 */
export async function completeSale(sale_id: string) {
  try {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('status')
      .eq('id', sale_id)
      .single();

    if (fetchError) throw fetchError;
    if (!sale) throw new Error('Sale not found');

    if (sale.status !== SALES_STATUSES.PAYMENT_RECEIVED) {
      throw new Error(
        `Cannot complete sale with status "${sale.status}". Expected "${SALES_STATUSES.PAYMENT_RECEIVED}"`
      );
    }

    const { data: updatedSale, error: updateError } = await supabase
      .from('sales')
      .update({
        status: SALES_STATUSES.COMPLETED,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sale_id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logAuditAction({
      action: 'SALE_COMPLETED',
      table_name: 'sales',
      record_id: sale_id,
      changes: {
        from_status: sale.status,
        to_status: SALES_STATUSES.COMPLETED
      }
    });

    return { success: true, sale: updatedSale };
  } catch (error: any) {
    console.error('Error completing sale:', error);
    throw error;
  }
}

/**
 * Get sales pending management approval
 */
export async function getSalesPendingManagementApproval() {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('status', SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get sales pending customer approval
 */
export async function getSalesPendingCustomerApproval(customer_id?: string) {
  let query = supabase
    .from('sales')
    .select('*')
    .eq('status', SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL);

  if (customer_id) {
    query = query.eq('customer_id', customer_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get sales waiting for payment
 */
export async function getSalesWaitingForPayment(customer_id?: string) {
  let query = supabase
    .from('sales')
    .select('*')
    .eq('status', SALES_STATUSES.WAITING_FOR_PAYMENT);

  if (customer_id) {
    query = query.eq('customer_id', customer_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
