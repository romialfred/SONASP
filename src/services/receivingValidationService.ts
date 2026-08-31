import { supabase } from '@/lib/supabase';
import { getBusinessRuleValue } from './businessRulesService';

export async function validateReceiving(
  _batchId: string,
  actualWeight: number,
  expectedWeight: number,
  location: 'airport' | 'refinery' = 'airport'
) {
  const variance = ((actualWeight - expectedWeight) / expectedWeight) * 100;

  // Get configurable threshold based on location
  let threshold = 2.0; // Default fallback

  try {
    if (location === 'airport') {
      const value = await getBusinessRuleValue('var_threshold_mine_airport');
      threshold = value ?? 2.0;
    } else if (location === 'refinery') {
      const value = await getBusinessRuleValue('var_threshold_airport_refinery');
      threshold = value ?? 1.5;
    }
  } catch (error) {
    console.error('Error fetching variance threshold:', error);
    // Use default threshold on error
  }

  return {
    isValid: Math.abs(variance) <= threshold,
    variance,
    requiresApproval: Math.abs(variance) > threshold,
    threshold,
  };
}

export async function createReceivingRecord(data: {
  batch_id: string;
  location: string;
  expected_weight: number;
  actual_weight: number;
  variance: number;
  received_by: string;
  notes?: string;
  threshold?: number;
}) {
  try {
    // Get threshold if not provided
    let threshold = data.threshold;
    if (!threshold) {
      const locationKey = data.location.toLowerCase().includes('refinery') ? 'refinery' : 'airport';
      if (locationKey === 'airport') {
        threshold = (await getBusinessRuleValue('var_threshold_mine_airport')) ?? 2.0;
      } else {
        threshold = (await getBusinessRuleValue('var_threshold_airport_refinery')) ?? 1.5;
      }
    }

    const { data: record, error } = await supabase
      .from('receiving_records')
      .insert({
        expected_weight_grams: data.expected_weight,
        actual_weight_grams: data.actual_weight,
        variance_grams: data.actual_weight - data.expected_weight,
        variance_percentage: data.variance,
        received_by: data.received_by,
        received_at: new Date().toISOString(),
        is_significant_variance: Math.abs(data.variance) > threshold,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: record };
  } catch (error) {
    console.error('Error creating receiving record:', error);
    return { success: false, error };
  }
}

export async function approveReceiving(recordId: string, approvedBy: string) {
  try {
    const { data, error } = await supabase
      .from('receiving_records')
      .update({
        reconciliation_approved_by: approvedBy,
        reconciliation_approved_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error approving receiving:', error);
    return { success: false, error };
  }
}

export async function approveVariance(recordId: string, approvedBy: string, notes?: string) {
  try {
    const { data, error } = await supabase
      .from('receiving_records')
      .update({
        reconciliation_approved_by: approvedBy,
        reconciliation_approved_at: new Date().toISOString(),
        reconciliation_comments: notes,
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error approving variance:', error);
    return { success: false, error };
  }
}
