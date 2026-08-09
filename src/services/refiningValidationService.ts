import { supabase } from '@/lib/supabase';
import { getBusinessRuleValue } from './businessRulesService';

export interface RefiningData {
  batch_id: string;
  pre_melting_weight: number;
  post_melting_weight: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  processed_by: string;
  notes?: string;
}

/**
 * Validate refining loss against configurable threshold
 */
export async function validateRefiningLoss(
  preMeltingWeight: number,
  postMeltingWeight: number
): Promise<{
  isValid: boolean;
  lossPercentage: number;
  threshold: number;
  requiresApproval: boolean;
}> {
  const lossPercentage = ((preMeltingWeight - postMeltingWeight) / preMeltingWeight) * 100;

  // Get configurable threshold
  let threshold = 5.0; // Default fallback
  try {
    const value = await getBusinessRuleValue('var_threshold_refining_loss');
    threshold = value ?? 5.0;
  } catch (error) {
    console.error('Error fetching refining loss threshold:', error);
  }

  return {
    isValid: lossPercentage <= threshold,
    lossPercentage,
    threshold,
    requiresApproval: lossPercentage > threshold,
  };
}

export async function createRefiningRecord(data: RefiningData) {
  try {
    const finalFine = calculateFinalFine(
      data.post_melting_weight,
      data.fineness_percentage,
      data.metal_retained_percentage
    );

    const { data: record, error } = await supabase
      .from('refining_records')
      .insert({
        batch_id: data.batch_id,
        pre_melting_weight_grams: data.pre_melting_weight,
        post_melting_weight_grams: data.post_melting_weight,
        fineness_percentage: data.fineness_percentage,
        metal_retained_percentage: data.metal_retained_percentage,
        final_fine_grams: finalFine,
        final_fine_oz: finalFine / 31.1034768,
        processed_by: data.processed_by,
        processed_at: new Date().toISOString(),
        notes: data.notes,
        status: 'pending_approval',
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: record };
  } catch (error) {
    console.error('Error creating refining record:', error);
    return { success: false, error };
  }
}

export async function approveRefining(recordId: string, approvedBy: string) {
  try {
    const { data, error } = await supabase
      .from('refining_records')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error approving refining:', error);
    return { success: false, error };
  }
}

export async function getRefiningRecord(batchId: string) {
  try {
    const { data, error } = await supabase
      .from('refining_records')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching refining record:', error);
    return { success: false, error };
  }
}
