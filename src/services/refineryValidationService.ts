import { supabase } from '@/lib/supabase';

/**
 * Validate refinery reception and move batch to processing status
 */
export async function validateRefineryReceipt(batchId: string, userId: string): Promise<{success: boolean; error?: string}> {
  try {
    // Update batch status to PROCESSING (or VALIDATED_FOR_PROCESSING)
    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: BATCH_STATUSES.PROCESSING,
        refinery_validated_at: new Date().toISOString(),
        refinery_validated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .eq('status', BATCH_STATUSES.RECEIVED_AT_REFINERY); // Only if currently received

    if (updateError) {
      console.error('Error updating batch:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log the validation in batch_history
    const { error: historyError } = await supabase
      .from('batch_history')
      .insert({
        batch_id: batchId,
        status: BATCH_STATUSES.PROCESSING,
        changed_by: userId,
        comments: 'Refinery reception validated. Batch moved to processing.',
      });

    if (historyError) {
      console.error('Error logging history:', historyError);
      // Don't fail the operation if history logging fails
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in validateRefineryReceipt:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start processing a batch that is validated
 */
export async function startBatchProcessing(batchId: string, userId: string): Promise<{success: boolean; error?: string}> {
  try {
    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: BATCH_STATUSES.PROCESSING,
        processing_started_at: new Date().toISOString(),
        processing_started_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .in('status', [BATCH_STATUSES.VALIDATED_FOR_PROCESSING, BATCH_STATUSES.RECEIVED_AT_REFINERY]);

    if (updateError) {
      console.error('Error starting processing:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log in batch_history
    const { error: historyError } = await supabase
      .from('batch_history')
      .insert({
        batch_id: batchId,
        status: BATCH_STATUSES.PROCESSING,
        changed_by: userId,
        comments: 'Batch processing started at refinery.',
      });

    if (historyError) {
      console.error('Error logging history:', historyError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in startBatchProcessing:', error);
    return { success: false, error: error.message };
  }
}
