import { supabase } from '@/lib/supabase';
import { logBatchAction } from '@/lib/auditLog';

export interface StatusTransitionValidation {
  valid: boolean;
  error?: string;
  requires_approval_request?: boolean;
  required_roles?: string[];
  transition_id?: string;
  hold_reason?: string;
}

export interface ApprovalRequest {
  batch_id: string;
  approval_type: 'status_change' | 'variance' | 'quality' | 'sale' | 'split' | 'merge' | 'hold_release' | 'custom';
  approval_level?: number;
  required_role: string;
  request_description: string;
  request_data?: Record<string, any>;
  requested_by: string;
}

export interface WorkflowInstance {
  id: string;
  batch_id: string;
  workflow_definition_id: string;
  current_step: string;
  workflow_data: Record<string, any>;
  status: 'active' | 'completed' | 'cancelled' | 'failed' | 'paused';
}

export const batchWorkflowService = {
  async validateStatusTransition(
    batchId: string,
    fromStatus: string,
    toStatus: string,
    userId: string
  ): Promise<StatusTransitionValidation> {
    const { data, error } = await supabase.rpc('validate_status_transition', {
      p_batch_id: batchId,
      p_from_status: fromStatus,
      p_to_status: toStatus,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error validating status transition:', error);
      return { valid: false, error: error.message };
    }

    return data as StatusTransitionValidation;
  },

  async requestApproval(request: ApprovalRequest, userEmail: string) {
    const { data, error } = await supabase
      .from('batch_approvals')
      .insert({
        batch_id: request.batch_id,
        approval_type: request.approval_type,
        approval_level: request.approval_level || 1,
        required_role: request.required_role,
        request_description: request.request_description,
        request_data: request.request_data,
        requested_by: request.requested_by,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    await logBatchAction(
      request.requested_by,
      userEmail,
      'REQUEST_APPROVAL',
      request.batch_id,
      `Approval requested: ${request.request_description}`
    );

    return data;
  },

  async approveRequest(
    approvalId: string,
    approverId: string,
    approverEmail: string,
    comments?: string
  ) {
    const { data: approval, error: fetchError } = await supabase
      .from('batch_approvals')
      .select('batch_id, approval_type, request_description')
      .eq('id', approvalId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Approval request not found');

    const { error } = await supabase
      .from('batch_approvals')
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        comments,
      })
      .eq('id', approvalId);

    if (error) throw error;

    await logBatchAction(
      approverId,
      approverEmail,
      'APPROVE',
      approval.batch_id,
      `Approved: ${approval.request_description}`
    );

    return true;
  },

  async rejectRequest(
    approvalId: string,
    approverId: string,
    approverEmail: string,
    rejectionReason: string
  ) {
    const { data: approval, error: fetchError } = await supabase
      .from('batch_approvals')
      .select('batch_id, approval_type, request_description')
      .eq('id', approvalId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Approval request not found');

    const { error } = await supabase
      .from('batch_approvals')
      .update({
        status: 'rejected',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('id', approvalId);

    if (error) throw error;

    await logBatchAction(
      approverId,
      approverEmail,
      'REJECT',
      approval.batch_id,
      `Rejected: ${approval.request_description} - ${rejectionReason}`
    );

    return true;
  },

  async getPendingApprovals(userId?: string, role?: string) {
    let query = supabase
      .from('batch_approvals')
      .select(`
        *,
        batch:batches(batch_number, status),
        requested_by_user:user_profiles!batch_approvals_requested_by_fkey(full_name, email)
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (role) {
      query = query.eq('required_role', role);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async escalateApproval(
    approvalId: string,
    escalatedTo: string,
    escalationReason: string,
    userId: string,
    userEmail: string
  ) {
    const { data: approval, error: fetchError } = await supabase
      .from('batch_approvals')
      .select('batch_id')
      .eq('id', approvalId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!approval) throw new Error('Approval request not found');

    const { error: updateError } = await supabase
      .from('batch_approvals')
      .update({
        status: 'escalated',
        escalated_to: escalatedTo,
        escalated_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    if (updateError) throw updateError;

    const { error: escalationError } = await supabase
      .from('batch_escalations')
      .insert({
        batch_id: approval.batch_id,
        approval_id: approvalId,
        escalation_type: 'approval_delay',
        severity: 'high',
        escalated_from: userId,
        escalated_to: escalatedTo,
        escalation_reason: escalationReason,
      });

    if (escalationError) throw escalationError;

    await logBatchAction(
      userId,
      userEmail,
      'ESCALATE',
      approval.batch_id,
      `Approval escalated: ${escalationReason}`
    );

    return true;
  },

  async createWorkflowInstance(
    batchId: string,
    workflowDefinitionId: string,
    initialData?: Record<string, any>
  ) {
    const { data, error } = await supabase
      .from('batch_workflow_instances')
      .insert({
        batch_id: batchId,
        workflow_definition_id: workflowDefinitionId,
        current_step: 'initialized',
        workflow_data: initialData || {},
        status: 'active',
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as WorkflowInstance;
  },

  async updateWorkflowStep(
    instanceId: string,
    newStep: string,
    stepData?: Record<string, any>
  ) {
    const { data: instance, error: fetchError } = await supabase
      .from('batch_workflow_instances')
      .select('workflow_data, step_history')
      .eq('id', instanceId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!instance) throw new Error('Workflow instance not found');

    const updatedData = { ...instance.workflow_data, ...stepData };
    const history = instance.step_history || [];
    history.push({
      step: newStep,
      timestamp: new Date().toISOString(),
      data: stepData,
    });

    const { error } = await supabase
      .from('batch_workflow_instances')
      .update({
        current_step: newStep,
        workflow_data: updatedData,
        step_history: history,
      })
      .eq('id', instanceId);

    if (error) throw error;
    return true;
  },

  async completeWorkflow(instanceId: string) {
    const { error } = await supabase
      .from('batch_workflow_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', instanceId);

    if (error) throw error;
    return true;
  },

  async checkApprovalEscalations() {
    const { error } = await supabase.rpc('check_approval_escalations');
    if (error) {
      console.error('Error checking escalations:', error);
      throw error;
    }
    return true;
  },

  async getApprovalHistory(batchId: string) {
    const { data, error } = await supabase
      .from('batch_approvals')
      .select(`
        *,
        requested_by_user:user_profiles!batch_approvals_requested_by_fkey(full_name, email),
        approved_by_user:user_profiles!batch_approvals_approved_by_fkey(full_name, email)
      `)
      .eq('batch_id', batchId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getEscalations(batchId?: string, status?: 'pending' | 'resolved') {
    let query = supabase
      .from('batch_escalations')
      .select(`
        *,
        batch:batches(batch_number, status),
        escalated_from_user:user_profiles!batch_escalations_escalated_from_fkey(full_name, email),
        escalated_to_user:user_profiles!batch_escalations_escalated_to_fkey(full_name, email)
      `)
      .order('escalated_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (status === 'pending') {
      query = query.is('resolved_at', null);
    } else if (status === 'resolved') {
      query = query.not('resolved_at', 'is', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async resolveEscalation(
    escalationId: string,
    resolution: string,
    resolutionData?: Record<string, any>
  ) {
    const { error } = await supabase
      .from('batch_escalations')
      .update({
        resolved_at: new Date().toISOString(),
        resolution,
        resolution_data: resolutionData,
      })
      .eq('id', escalationId);

    if (error) throw error;
    return true;
  },
};
