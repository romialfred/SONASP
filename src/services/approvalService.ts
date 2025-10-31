import { supabase } from '@/lib/supabase';
import { logAuditAction } from '@/lib/auditLog';
import { sendSaleApprovalRequest, sendPaymentConfirmationRequest } from './notificationService';

export interface ApprovalRequest {
  id: string;
  approval_type: 'sale' | 'payment' | 'batch' | 'refining';
  entity_id: string;
  entity_type: string;
  current_level: number;
  max_levels: number;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  requested_by: string;
  requested_at: string;
  completed_at?: string;
}

export interface ApprovalStep {
  id: string;
  approval_request_id: string;
  level: number;
  approver_email: string;
  approver_role: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approved_at?: string;
  comments?: string;
}

export interface ApprovalWorkflowConfig {
  approval_type: string;
  levels: Array<{
    level: number;
    role: string;
    required: boolean;
    timeout_hours?: number;
  }>;
}

const DEFAULT_APPROVAL_CONFIGS: ApprovalWorkflowConfig[] = [
  {
    approval_type: 'sale',
    levels: [
      { level: 1, role: 'sales_manager', required: true, timeout_hours: 24 },
      { level: 2, role: 'management', required: true, timeout_hours: 48 },
    ],
  },
  {
    approval_type: 'payment',
    levels: [
      { level: 1, role: 'finance_manager', required: true, timeout_hours: 12 },
      { level: 2, role: 'management', required: true, timeout_hours: 24 },
    ],
  },
  {
    approval_type: 'batch',
    levels: [
      { level: 1, role: 'supervisor', required: true, timeout_hours: 6 },
    ],
  },
  {
    approval_type: 'refining',
    levels: [
      { level: 1, role: 'refinery_supervisor', required: true, timeout_hours: 12 },
      { level: 2, role: 'management', required: false, timeout_hours: 24 },
    ],
  },
];

export async function createApprovalRequest(
  approvalType: 'sale' | 'payment' | 'batch' | 'refining',
  entityId: string,
  entityType: string,
  requestedBy: string,
  entityData?: Record<string, any>
): Promise<{ success: boolean; data?: ApprovalRequest; error?: string }> {
  try {
    const config = DEFAULT_APPROVAL_CONFIGS.find(c => c.approval_type === approvalType);

    if (!config) {
      return { success: false, error: 'Invalid approval type' };
    }

    const { data: approvalRequest, error: requestError } = await supabase
      .from('approval_requests')
      .insert({
        approval_type: approvalType,
        entity_id: entityId,
        entity_type: entityType,
        current_level: 1,
        max_levels: config.levels.length,
        status: 'pending',
        requested_by: requestedBy,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (requestError) {
      return { success: false, error: requestError.message };
    }

    for (const level of config.levels) {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('role', level.role)
        .eq('is_active', true)
        .limit(1);

      if (!users || users.length === 0) {
        console.warn(`No active user found for role: ${level.role}`);
        continue;
      }

      await supabase
        .from('approval_steps')
        .insert({
          approval_request_id: approvalRequest.id,
          level: level.level,
          approver_email: users[0].email,
          approver_role: level.role,
          status: level.level === 1 ? 'pending' : 'pending',
        });
    }

    const firstLevelApprover = await getApproverForLevel(approvalRequest.id, 1);

    if (firstLevelApprover && approvalType === 'sale' && entityData) {
      await sendSaleApprovalRequest(
        entityId,
        entityData.saleNumber,
        entityData.customerName,
        entityData.quantityOz,
        entityData.finalProceeds,
        firstLevelApprover.approver_email
      );
    } else if (firstLevelApprover && approvalType === 'payment' && entityData) {
      await sendPaymentConfirmationRequest(
        entityData.paymentNumber,
        entityData.saleNumber,
        entityData.amount,
        entityData.currency,
        firstLevelApprover.approver_email,
        entityId
      );
    }

    await logAuditAction({
      action: 'approval_request_created',
      table_name: 'approval_requests',
      record_id: approvalRequest.id,
      details: {
        approval_type: approvalType,
        entity_id: entityId,
        entity_type: entityType,
      },
      user_email: requestedBy,
    });

    return { success: true, data: approvalRequest };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function getApproverForLevel(
  approvalRequestId: string,
  level: number
): Promise<ApprovalStep | null> {
  const { data } = await supabase
    .from('approval_steps')
    .select('*')
    .eq('approval_request_id', approvalRequestId)
    .eq('level', level)
    .single();

  return data;
}

export async function approveRequest(
  approvalRequestId: string,
  approverEmail: string,
  comments?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: approvalRequest } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', approvalRequestId)
      .single();

    if (!approvalRequest) {
      return { success: false, error: 'Approval request not found' };
    }

    const { data: currentStep } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('approval_request_id', approvalRequestId)
      .eq('level', approvalRequest.current_level)
      .eq('approver_email', approverEmail)
      .single();

    if (!currentStep) {
      return { success: false, error: 'You are not authorized to approve this request' };
    }

    await supabase
      .from('approval_steps')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        comments,
      })
      .eq('id', currentStep.id);

    if (approvalRequest.current_level < approvalRequest.max_levels) {
      await supabase
        .from('approval_requests')
        .update({
          current_level: approvalRequest.current_level + 1,
        })
        .eq('id', approvalRequestId);

      const nextLevelApprover = await getApproverForLevel(
        approvalRequestId,
        approvalRequest.current_level + 1
      );

      if (nextLevelApprover) {
        await supabase
          .from('approval_steps')
          .update({
            status: 'pending',
          })
          .eq('id', nextLevelApprover.id);
      }
    } else {
      await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          completed_at: new Date().toISOString(),
        })
        .eq('id', approvalRequestId);

      // Update entity status based on approval type
      if (approvalRequest.approval_type === 'sale') {
        // For sales, after management approval, move to customer_approved
        // This triggers customer notification to approve for payment
        await supabase
          .from('sales')
          .update({
            status: 'customer_approved',
            management_approved_at: new Date().toISOString(),
            management_approved_by: approverEmail
          })
          .eq('id', approvalRequest.entity_id);

        // Send email to customer for approval
        const { data: saleData } = await supabase
          .from('sales')
          .select('sale_number, customer:customers(name, email), quantity_oz, final_proceeds')
          .eq('id', approvalRequest.entity_id)
          .single();

        if (saleData && saleData.customer) {
          await sendSaleApprovalRequest(
            approvalRequest.entity_id,
            saleData.sale_number,
            saleData.customer.name,
            saleData.quantity_oz,
            saleData.final_proceeds,
            saleData.customer.email
          );
        }
      } else if (approvalRequest.approval_type === 'payment') {
        await supabase
          .from('payments')
          .update({ status: 'approved' })
          .eq('id', approvalRequest.entity_id);
      }
    }

    await logAuditAction({
      action: 'approval_step_approved',
      table_name: 'approval_steps',
      record_id: currentStep.id,
      details: {
        approval_request_id: approvalRequestId,
        level: approvalRequest.current_level,
        comments,
      },
      user_email: approverEmail,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectRequest(
  approvalRequestId: string,
  approverEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: approvalRequest } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', approvalRequestId)
      .single();

    if (!approvalRequest) {
      return { success: false, error: 'Approval request not found' };
    }

    const { data: currentStep } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('approval_request_id', approvalRequestId)
      .eq('level', approvalRequest.current_level)
      .eq('approver_email', approverEmail)
      .single();

    if (!currentStep) {
      return { success: false, error: 'You are not authorized to reject this request' };
    }

    await supabase
      .from('approval_steps')
      .update({
        status: 'rejected',
        approved_at: new Date().toISOString(),
        comments: reason,
      })
      .eq('id', currentStep.id);

    await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        completed_at: new Date().toISOString(),
      })
      .eq('id', approvalRequestId);

    if (approvalRequest.approval_type === 'sale') {
      // For sales, rejection means customer_rejected status
      await supabase
        .from('sales')
        .update({
          status: 'customer_rejected',
          management_rejected_at: new Date().toISOString(),
          management_rejected_by: approverEmail,
          rejection_reason: reason
        })
        .eq('id', approvalRequest.entity_id);
    } else if (approvalRequest.approval_type === 'payment') {
      await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', approvalRequest.entity_id);
    }

    await logAuditAction({
      action: 'approval_step_rejected',
      table_name: 'approval_steps',
      record_id: currentStep.id,
      details: {
        approval_request_id: approvalRequestId,
        level: approvalRequest.current_level,
        reason,
      },
      user_email: approverEmail,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getApprovalRequestsByEntity(
  entityId: string,
  entityType: string
): Promise<{ success: boolean; data?: ApprovalRequest[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('approval_requests')
      .select(`
        *,
        approval_steps(*)
      `)
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('requested_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPendingApprovals(
  approverEmail: string
): Promise<{ success: boolean; data?: ApprovalRequest[]; error?: string }> {
  try {
    const { data: pendingSteps } = await supabase
      .from('approval_steps')
      .select('approval_request_id')
      .eq('approver_email', approverEmail)
      .eq('status', 'pending');

    if (!pendingSteps || pendingSteps.length === 0) {
      return { success: true, data: [] };
    }

    const requestIds = pendingSteps.map(s => s.approval_request_id);

    const { data, error } = await supabase
      .from('approval_requests')
      .select(`
        *,
        approval_steps(*)
      `)
      .in('id', requestIds)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function escalateDelayedApprovals(): Promise<{ success: boolean; escalated: number; error?: string }> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: delayedRequests } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('status', 'pending')
      .lt('requested_at', twentyFourHoursAgo);

    if (!delayedRequests || delayedRequests.length === 0) {
      return { success: true, escalated: 0 };
    }

    for (const request of delayedRequests) {
      await supabase
        .from('approval_requests')
        .update({ status: 'escalated' })
        .eq('id', request.id);
    }

    return { success: true, escalated: delayedRequests.length };
  } catch (error: any) {
    return { success: false, escalated: 0, error: error.message };
  }
}

export async function getApprovalStatistics(approverEmail?: string): Promise<{
  success: boolean;
  data?: {
    total_pending: number;
    total_approved: number;
    total_rejected: number;
    avg_approval_time_hours: number;
  };
  error?: string;
}> {
  try {
    let query = supabase.from('approval_requests').select('*');

    if (approverEmail) {
      const { data: steps } = await supabase
        .from('approval_steps')
        .select('approval_request_id')
        .eq('approver_email', approverEmail);

      if (steps) {
        const requestIds = steps.map(s => s.approval_request_id);
        query = query.in('id', requestIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const requests = data || [];
    const totalPending = requests.filter(r => r.status === 'pending').length;
    const totalApproved = requests.filter(r => r.status === 'approved').length;
    const totalRejected = requests.filter(r => r.status === 'rejected').length;

    const completedRequests = requests.filter(r => r.completed_at);
    const avgApprovalTimeMs = completedRequests.length > 0
      ? completedRequests.reduce((sum, r) => {
          const start = new Date(r.requested_at).getTime();
          const end = new Date(r.completed_at).getTime();
          return sum + (end - start);
        }, 0) / completedRequests.length
      : 0;

    const avgApprovalTimeHours = avgApprovalTimeMs / (1000 * 60 * 60);

    return {
      success: true,
      data: {
        total_pending: totalPending,
        total_approved: totalApproved,
        total_rejected: totalRejected,
        avg_approval_time_hours: avgApprovalTimeHours,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
