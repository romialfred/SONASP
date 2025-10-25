import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { nanoid } from 'nanoid';

type SalesApproval = Database['public']['Tables']['sales_approvals']['Row'];
type SalesApprovalInsert = Database['public']['Tables']['sales_approvals']['Insert'];

export interface ApprovalWorkflowConfig {
  sale_id: string;
  levels: {
    level: number;
    approval_type: 'management' | 'customer' | 'finance' | 'compliance' | 'executive';
    required_approver_role?: string;
    required_approver_id?: string;
  }[];
}

export const approvalService = {
  /**
   * Create multi-level approval workflow for a sale
   */
  async createApprovalWorkflow(config: ApprovalWorkflowConfig): Promise<SalesApproval[]> {
    const approvals: SalesApprovalInsert[] = config.levels.map((level) => ({
      sale_id: config.sale_id,
      approval_level: level.level,
      approval_type: level.approval_type,
      required_approver_role: level.required_approver_role,
      required_approver_id: level.required_approver_id,
      status: 'pending',
      approval_token: level.approval_type === 'customer' ? nanoid(32) : null,
      token_expires_at: level.approval_type === 'customer'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    }));

    const { data, error } = await supabase
      .from('sales_approvals')
      .insert(approvals)
      .select();

    if (error) throw error;
    return data || [];
  },

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string) {
    const { data, error } = await supabase
      .from('sales_approvals')
      .select(`
        *,
        sale:sales(
          sale_number,
          quantity_oz,
          final_proceeds,
          customer:customers(name, email, country)
        )
      `)
      .eq('status', 'pending')
      .or(`required_approver_id.eq.${userId},approver_id.is.null`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all approvals for a sale
   */
  async getSaleApprovals(saleId: string): Promise<SalesApproval[]> {
    const { data, error } = await supabase
      .from('sales_approvals')
      .select('*')
      .eq('sale_id', saleId)
      .order('approval_level', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Approve a sale at a specific level
   */
  async approveSale(
    approvalId: string,
    approverId: string,
    approverName: string,
    notes?: string
  ): Promise<SalesApproval> {
    const { data: approval, error: fetchError } = await supabase
      .from('sales_approvals')
      .select('*')
      .eq('id', approvalId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Approval not found');
    if (approval.status !== 'pending') {
      throw new Error('Approval has already been processed');
    }

    const { data, error } = await supabase
      .from('sales_approvals')
      .update({
        status: 'approved',
        approver_id: approverId,
        approver_name: approverName,
        approved_at: new Date().toISOString(),
        decision_notes: notes,
      })
      .eq('id', approvalId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to approve');

    await this.checkAndUpdateSaleStatus(approval.sale_id);

    await supabase.from('sales_notifications_log').insert({
      sale_id: approval.sale_id,
      notification_type: 'in_app',
      event_type: 'approved',
      recipient_type: 'management',
      message: `${approval.approval_type} approval granted by ${approverName}`,
      delivery_status: 'sent',
    });

    return data;
  },

  /**
   * Reject a sale at a specific level
   */
  async rejectSale(
    approvalId: string,
    approverId: string,
    approverName: string,
    reason: string
  ): Promise<SalesApproval> {
    const { data: approval, error: fetchError } = await supabase
      .from('sales_approvals')
      .select('*')
      .eq('id', approvalId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Approval not found');

    const { data, error } = await supabase
      .from('sales_approvals')
      .update({
        status: 'rejected',
        approver_id: approverId,
        approver_name: approverName,
        approved_at: new Date().toISOString(),
        decision_notes: reason,
      })
      .eq('id', approvalId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to reject');

    await supabase
      .from('sales')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: approverId,
        rejection_reason: reason,
      })
      .eq('id', approval.sale_id);

    await supabase.from('sales_notifications_log').insert({
      sale_id: approval.sale_id,
      notification_type: 'in_app',
      event_type: 'rejected',
      recipient_type: 'management',
      message: `${approval.approval_type} approval rejected by ${approverName}: ${reason}`,
      delivery_status: 'sent',
    });

    return data;
  },

  /**
   * Approve with conditions
   */
  async conditionalApproval(
    approvalId: string,
    approverId: string,
    approverName: string,
    conditions: string
  ): Promise<SalesApproval> {
    const { data, error } = await supabase
      .from('sales_approvals')
      .update({
        status: 'conditional',
        approver_id: approverId,
        approver_name: approverName,
        approved_at: new Date().toISOString(),
        conditions: conditions,
      })
      .eq('id', approvalId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to set conditional approval');

    return data;
  },

  /**
   * Customer approval via token
   */
  async approveByToken(
    token: string,
    customerName: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SalesApproval> {
    const { data: approval, error: fetchError } = await supabase
      .from('sales_approvals')
      .select('*')
      .eq('approval_token', token)
      .eq('approval_type', 'customer')
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Invalid approval token');

    if (approval.status !== 'pending') {
      throw new Error('This approval has already been processed');
    }

    if (approval.token_expires_at && new Date(approval.token_expires_at) < new Date()) {
      await supabase
        .from('sales_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id);
      throw new Error('This approval token has expired');
    }

    const { data, error } = await supabase
      .from('sales_approvals')
      .update({
        status: 'approved',
        approver_name: customerName,
        approved_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .eq('id', approval.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to approve');

    await supabase
      .from('sales')
      .update({
        customer_approved_at: new Date().toISOString(),
        customer_approved_by: customerName,
      })
      .eq('id', approval.sale_id);

    await this.checkAndUpdateSaleStatus(approval.sale_id);

    return data;
  },

  /**
   * Reject via customer token
   */
  async rejectByToken(
    token: string,
    customerName: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SalesApproval> {
    const { data: approval, error: fetchError } = await supabase
      .from('sales_approvals')
      .select('*')
      .eq('approval_token', token)
      .eq('approval_type', 'customer')
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Invalid approval token');

    const { data, error } = await supabase
      .from('sales_approvals')
      .update({
        status: 'rejected',
        approver_name: customerName,
        approved_at: new Date().toISOString(),
        decision_notes: reason,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .eq('id', approval.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to reject');

    await supabase
      .from('sales')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', approval.sale_id);

    return data;
  },

  /**
   * Check if all approvals are complete and update sale status
   */
  async checkAndUpdateSaleStatus(saleId: string): Promise<void> {
    const { data: approvals, error } = await supabase
      .from('sales_approvals')
      .select('*')
      .eq('sale_id', saleId);

    if (error) throw error;
    if (!approvals) return;

    const allApproved = approvals.every(a => a.status === 'approved');
    const anyRejected = approvals.some(a => a.status === 'rejected');

    if (allApproved) {
      await supabase
        .from('sales')
        .update({ status: 'approved' })
        .eq('id', saleId);
    } else if (anyRejected) {
      await supabase
        .from('sales')
        .update({ status: 'rejected' })
        .eq('id', saleId);
    }
  },

  /**
   * Send reminder for pending approval
   */
  async sendApprovalReminder(approvalId: string): Promise<void> {
    const { data: approval, error: fetchError } = await supabase
      .from('sales_approvals')
      .select(`
        *,
        sale:sales(sale_number, customer:customers(name, email))
      `)
      .eq('id', approvalId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Approval not found');

    await supabase
      .from('sales_approvals')
      .update({
        reminder_count: (approval.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    await supabase.from('sales_notifications_log').insert({
      sale_id: approval.sale_id,
      notification_type: 'email',
      event_type: 'approval_reminder',
      recipient_type: approval.approval_type === 'customer' ? 'customer' : 'approver',
      recipient_id: approval.required_approver_id,
      message: `Reminder: Approval pending for sale ${approval.sale?.sale_number}`,
      delivery_status: 'pending',
    });
  },

  /**
   * Get approval workflow status for a sale
   */
  async getWorkflowStatus(saleId: string) {
    const approvals = await this.getSaleApprovals(saleId);

    const totalLevels = approvals.length;
    const completedLevels = approvals.filter(
      a => a.status === 'approved' || a.status === 'rejected'
    ).length;
    const currentLevel = approvals.find(a => a.status === 'pending');

    return {
      total_levels: totalLevels,
      completed_levels: completedLevels,
      progress_percentage: totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0,
      current_level: currentLevel,
      all_approved: approvals.every(a => a.status === 'approved'),
      any_rejected: approvals.some(a => a.status === 'rejected'),
      approvals: approvals,
    };
  },
};
