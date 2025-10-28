import { supabase } from '@/lib/supabase';

export interface BatchApproval {
  id: string;
  batch_id: string;
  approval_type: 'factory_transport' | 'airport_receipt' | 'airport_validation' | 'refinery_receipt' | 'refinery_validation' | 'processing_completion';
  approver_id: string;
  approver_name: string;
  approver_role: string;
  status: 'approved' | 'rejected' | 'conditional';
  previous_status?: string;
  new_status: string;
  comments?: string;
  variance_grams?: number;
  variance_percentage?: number;
  variance_within_threshold?: boolean;
  approved_at: string;
}

export interface ApprovalRequest {
  batch_id: string;
  approval_type: BatchApproval['approval_type'];
  new_status: string;
  comments?: string;
  variance_grams?: number;
  variance_percentage?: number;
}

export async function approveBatchForTransport(batchId: string, comments?: string) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const { data: batch } = await supabase
      .from('batches')
      .select('status')
      .eq('id', batchId)
      .maybeSingle();

    if (!batch) throw new Error('Batch not found');

    const approvalData = {
      batch_id: batchId,
      approval_type: 'factory_transport',
      approver_id: user.id,
      approver_name: profile?.full_name || 'Unknown',
      approver_role: profile?.role || 'factory',
      status: 'approved',
      previous_status: batch.status,
      new_status: 'approved_for_transport',
      comments: comments || 'Approved for transport by factory'
    };

    const { data: approval, error: approvalError } = await supabase
      .from('batch_approvals')
      .insert(approvalData)
      .select()
      .single();

    if (approvalError) throw approvalError;

    const { error: updateError } = await supabase
      .from('batches')
      .update({ status: 'approved_for_transport', updated_at: new Date().toISOString() })
      .eq('id', batchId);

    if (updateError) throw updateError;

    const { error: historyError } = await supabase
      .from('batch_status_history')
      .insert({
        batch_id: batchId,
        status: 'approved_for_transport',
        previous_status: batch.status,
        changed_by: user.id,
        comments: comments || 'Approved for transport by factory'
      });

    if (historyError) console.error('Error creating history:', historyError);

    return { success: true, data: approval };
  } catch (error) {
    console.error('Error approving batch for transport:', error);
    return { success: false, error };
  }
}

export async function validateAirportReceipt(
  batchId: string,
  actualWeightGrams: number,
  comments?: string
) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const { data: batch } = await supabase
      .from('batches')
      .select('weight_grams, status')
      .eq('id', batchId)
      .maybeSingle();

    if (!batch) throw new Error('Batch not found');

    const varianceGrams = actualWeightGrams - batch.weight_grams;
    const variancePercentage = (Math.abs(varianceGrams) / batch.weight_grams) * 100;

    const { data: thresholdParam } = await supabase
      .from('system_parameters')
      .select('parameter_value')
      .eq('parameter_key', 'airport_variance_threshold_percentage')
      .maybeSingle();

    const threshold = parseFloat(thresholdParam?.parameter_value || '0.5');
    const withinThreshold = variancePercentage <= threshold;

    const { data: receivingRecord, error: receivingError } = await supabase
      .from('receiving_records')
      .insert({
        batch_id: batchId,
        receiving_site_id: batch.current_site_id,
        expected_weight_grams: batch.weight_grams,
        actual_weight_grams: actualWeightGrams,
        variance_grams: varianceGrams,
        variance_percentage: variancePercentage,
        is_significant_variance: !withinThreshold,
        received_by: user.id,
        reconciliation_comments: comments
      })
      .select()
      .single();

    if (receivingError) throw receivingError;

    const approvalData = {
      batch_id: batchId,
      approval_type: 'airport_validation',
      approver_id: user.id,
      approver_name: profile?.full_name || 'Unknown',
      approver_role: profile?.role || 'airport',
      status: 'approved',
      previous_status: batch.status,
      new_status: 'validated_for_refinery',
      comments,
      variance_grams: varianceGrams,
      variance_percentage: variancePercentage,
      variance_within_threshold: withinThreshold
    };

    const { data: approval, error: approvalError } = await supabase
      .from('batch_approvals')
      .insert(approvalData)
      .select()
      .single();

    if (approvalError) throw approvalError;

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: 'validated_for_refinery',
        weight_grams: actualWeightGrams,
        weight_ounces: actualWeightGrams / 31.1035,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (updateError) throw updateError;

    return {
      success: true,
      data: {
        approval,
        receivingRecord,
        varianceGrams,
        variancePercentage,
        withinThreshold
      }
    };
  } catch (error) {
    console.error('Error validating airport receipt:', error);
    return { success: false, error };
  }
}

export async function validateRefineryReceipt(
  batchId: string,
  actualWeightGrams: number,
  comments?: string
) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const { data: batch } = await supabase
      .from('batches')
      .select('weight_grams, status, current_site_id')
      .eq('id', batchId)
      .maybeSingle();

    if (!batch) throw new Error('Batch not found');

    const varianceGrams = actualWeightGrams - batch.weight_grams;
    const variancePercentage = (Math.abs(varianceGrams) / batch.weight_grams) * 100;

    const { data: thresholdParam } = await supabase
      .from('system_parameters')
      .select('parameter_value')
      .eq('parameter_key', 'refinery_variance_threshold_percentage')
      .maybeSingle();

    const threshold = parseFloat(thresholdParam?.parameter_value || '0.5');
    const withinThreshold = variancePercentage <= threshold;

    const { data: receivingRecord, error: receivingError } = await supabase
      .from('receiving_records')
      .insert({
        batch_id: batchId,
        receiving_site_id: batch.current_site_id,
        expected_weight_grams: batch.weight_grams,
        actual_weight_grams: actualWeightGrams,
        variance_grams: varianceGrams,
        variance_percentage: variancePercentage,
        is_significant_variance: !withinThreshold,
        received_by: user.id,
        reconciliation_comments: comments
      })
      .select()
      .single();

    if (receivingError) throw receivingError;

    const approvalData = {
      batch_id: batchId,
      approval_type: 'refinery_validation',
      approver_id: user.id,
      approver_name: profile?.full_name || 'Unknown',
      approver_role: profile?.role || 'refinery',
      status: 'approved',
      previous_status: batch.status,
      new_status: 'validated_for_processing',
      comments,
      variance_grams: varianceGrams,
      variance_percentage: variancePercentage,
      variance_within_threshold: withinThreshold
    };

    const { data: approval, error: approvalError } = await supabase
      .from('batch_approvals')
      .insert(approvalData)
      .select()
      .single();

    if (approvalError) throw approvalError;

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: 'validated_for_processing',
        weight_grams: actualWeightGrams,
        weight_ounces: actualWeightGrams / 31.1035,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (updateError) throw updateError;

    return {
      success: true,
      data: {
        approval,
        receivingRecord,
        varianceGrams,
        variancePercentage,
        withinThreshold
      }
    };
  } catch (error) {
    console.error('Error validating refinery receipt:', error);
    return { success: false, error };
  }
}

export async function getBatchApprovals(batchId: string) {
  try {
    const { data, error } = await supabase
      .from('batch_approvals')
      .select('*')
      .eq('batch_id', batchId)
      .order('approved_at', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching batch approvals:', error);
    return { success: false, error, data: [] };
  }
}

export async function getSystemParameter(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('system_parameters')
      .select('parameter_value')
      .eq('parameter_key', key)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    return data?.parameter_value || null;
  } catch (error) {
    console.error('Error fetching system parameter:', error);
    return null;
  }
}
