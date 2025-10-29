import { supabase } from '@/lib/supabase';
import { BATCH_STATUSES } from '@/constants/batchStatuses';

export interface TransitionMetadata {
  comments?: string;
  weightGrams?: number;
  variance?: number;
  variancePercentage?: number;
  documents?: string[];
  transportCompanyId?: string;
  receivedBy?: string;
  [key: string]: any;
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Validate if a status transition is allowed
 */
async function validateTransition(
  currentStatus: string,
  newStatus: string,
  batchId: string
): Promise<{ valid: boolean; reason?: string }> {
  // Check if transition exists in batch_status_transitions table
  const { data: transition, error } = await supabase
    .from('batch_status_transitions')
    .select('*')
    .eq('from_status', currentStatus)
    .eq('to_status', newStatus)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error checking transition:', error);
    return { valid: false, reason: 'Database error checking transition' };
  }

  if (!transition) {
    return {
      valid: false,
      reason: `Transition from ${currentStatus} to ${newStatus} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Main function to transition a batch to a new status
 */
export async function transitionBatchStatus(
  batchId: string,
  newStatus: string,
  metadata?: TransitionMetadata
): Promise<TransitionResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    // Get current batch status
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('status, batch_number')
      .eq('id', batchId)
      .maybeSingle();

    if (batchError || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    const currentStatus = batch.status;

    // Validate transition
    const validation = await validateTransition(currentStatus, newStatus, batchId);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Add metadata to update if provided
    if (metadata?.weightGrams) {
      updateData.weight_grams = metadata.weightGrams;
      updateData.weight_ounces = metadata.weightGrams / 31.1035;
    }

    // Update batch status
    const { error: updateError } = await supabase
      .from('batches')
      .update(updateData)
      .eq('id', batchId);

    if (updateError) {
      console.error('Error updating batch:', updateError);
      return { success: false, error: 'Failed to update batch status' };
    }

    // Create status history entry
    const historyData = {
      batch_id: batchId,
      status: newStatus,
      previous_status: currentStatus,
      changed_by: user.id,
      comments: metadata?.comments || `Status changed to ${newStatus}`,
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    const { error: historyError } = await supabase
      .from('batch_status_history')
      .insert(historyData);

    if (historyError) {
      console.error('Error creating status history:', historyError);
      // Don't fail the transition if history creation fails
    }

    console.log(`✅ Batch ${batch.batch_number} transitioned: ${currentStatus} → ${newStatus}`);

    return {
      success: true,
      data: {
        batchId,
        batchNumber: batch.batch_number,
        previousStatus: currentStatus,
        newStatus,
        changedBy: profile?.full_name || 'Unknown',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('Error in transitionBatchStatus:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error occurred',
    };
  }
}

/**
 * Specific transition: Approve batch for transport
 */
export async function approveBatchForTransport(
  batchId: string,
  comments?: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.APPROVED_FOR_TRANSPORT,
    { comments: comments || 'Approved for transport by factory manager' }
  );
}

/**
 * Specific transition: Confirm shipment (approved_for_transport → waiting_airport_receipt)
 */
export async function confirmShipment(
  batchId: string,
  transportCompanyId?: string,
  comments?: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.WAITING_AIRPORT_RECEIPT,
    {
      comments: comments || 'Shipment confirmed, en route to airport',
      transportCompanyId,
    }
  );
}

/**
 * Specific transition: Confirm receipt at airport
 */
export async function confirmAirportReceipt(
  batchId: string,
  actualWeightGrams: number,
  comments?: string
): Promise<TransitionResult> {
  const result = await transitionBatchStatus(
    batchId,
    BATCH_STATUSES.RECEIVED_AT_AIRPORT,
    {
      comments: comments || 'Received at airport',
      weightGrams: actualWeightGrams,
    }
  );

  return result;
}

/**
 * Specific transition: Validate airport receipt
 */
export async function validateAirportReceipt(
  batchId: string,
  actualWeightGrams: number,
  varianceGrams: number,
  variancePercentage: number,
  comments?: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.VALIDATED_FOR_REFINERY,
    {
      comments: comments || 'Receipt validated at airport',
      weightGrams: actualWeightGrams,
      variance: varianceGrams,
      variancePercentage,
    }
  );
}

/**
 * Specific transition: Confirm receipt at refinery
 */
export async function confirmRefineryReceipt(
  batchId: string,
  actualWeightGrams: number,
  comments?: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.RECEIVED_AT_REFINERY,
    {
      comments: comments || 'Received at refinery',
      weightGrams: actualWeightGrams,
    }
  );
}

/**
 * Specific transition: Start processing at refinery
 */
export async function startProcessing(
  batchId: string,
  comments?: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.PROCESSING,
    { comments: comments || 'Processing started' }
  );
}

/**
 * Specific transition: Cancel batch
 */
export async function cancelBatch(
  batchId: string,
  reason: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.CANCELLED,
    { comments: `Batch cancelled: ${reason}` }
  );
}

/**
 * Get all possible next statuses for a given status
 */
export async function getNextPossibleStatuses(
  currentStatus: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('batch_status_transitions')
      .select('to_status')
      .eq('from_status', currentStatus)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching next statuses:', error);
      return [];
    }

    return (data || []).map(t => t.to_status);
  } catch (error) {
    console.error('Error in getNextPossibleStatuses:', error);
    return [];
  }
}

/**
 * Get status transition history for a batch
 */
export async function getBatchStatusHistory(batchId: string) {
  try {
    const { data, error } = await supabase
      .from('batch_status_history')
      .select(`
        *,
        user:user_profiles!batch_status_history_changed_by_fkey(full_name, role)
      `)
      .eq('batch_id', batchId)
      .order('changed_at', { ascending: true });

    if (error) {
      console.error('Error fetching batch history:', error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error in getBatchStatusHistory:', error);
    return { success: false, error: error?.message || 'Unknown error', data: [] };
  }
}
