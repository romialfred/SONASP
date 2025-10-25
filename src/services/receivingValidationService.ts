import { supabase } from '@/lib/supabase';

export async function validateReceiving(batchId: string, actualWeight: number, expectedWeight: number) {
  const variance = ((actualWeight - expectedWeight) / expectedWeight) * 100;

  return {
    isValid: Math.abs(variance) <= 2,
    variance,
    requiresApproval: Math.abs(variance) > 2,
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
}) {
  try {
    const { data: record, error } = await supabase
      .from('receiving_records')
      .insert({
        batch_id: data.batch_id,
        location: data.location,
        expected_weight_grams: data.expected_weight,
        actual_weight_grams: data.actual_weight,
        variance_percentage: data.variance,
        received_by: data.received_by,
        received_at: new Date().toISOString(),
        notes: data.notes,
        status: Math.abs(data.variance) > 2 ? 'pending_approval' : 'approved',
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
    console.error('Error approving receiving:', error);
    return { success: false, error };
  }
}

export async function approveVariance(recordId: string, approvedBy: string, notes?: string) {
  try {
    const { data, error } = await supabase
      .from('receiving_records')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
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
