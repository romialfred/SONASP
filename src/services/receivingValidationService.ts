import { supabase } from '@/lib/supabase';

export interface ReceivingData {
  batch_id: string;
  receiving_site_id: string;
  actual_weight_grams: number;
  reconciliation_comments?: string;
}

const VARIANCE_THRESHOLD = 2.0;

export async function getBatchesForReceiving(siteType: 'airport' | 'refinery') {
  const statuses = siteType === 'airport'
    ? ['created', 'shipped']
    : ['received_airport', 'shipped_refinery'];

  const { data, error } = await supabase
    .from('batches')
    .select(`
      *,
      origin_site:sites!batches_origin_site_id_fkey(name, country),
      current_site:sites!batches_current_site_id_fkey(name, country)
    `)
    .in('status', statuses)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching batches:', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data || [] };
}

export async function confirmReceipt(data: ReceivingData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data: batch } = await supabase
      .from('batches')
      .select('weight_grams, status')
      .eq('id', data.batch_id)
      .single();

    if (!batch) {
      return { success: false, error: 'Batch not found' };
    }

    const expectedWeight = parseFloat(batch.weight_grams as any);
    const varianceGrams = data.actual_weight_grams - expectedWeight;
    const variancePercentage = (Math.abs(varianceGrams) / expectedWeight) * 100;
    const isSignificantVariance = variancePercentage > VARIANCE_THRESHOLD;

    const receivingRecord = {
      batch_id: data.batch_id,
      receiving_site_id: data.receiving_site_id,
      expected_weight_grams: expectedWeight,
      actual_weight_grams: data.actual_weight_grams,
      variance_grams: varianceGrams,
      variance_percentage: variancePercentage,
      is_significant_variance: isSignificantVariance,
      received_by: user.id,
      reconciliation_comments: data.reconciliation_comments || null,
    };

    const { data: receiving, error: receivingError } = await supabase
      .from('receiving_records')
      .insert([receivingRecord])
      .select()
      .single();

    if (receivingError) {
      return { success: false, error: receivingError.message };
    }

    if (isSignificantVariance) {
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .insert([{
          request_type: 'batch_receipt',
          entity_id: data.batch_id,
          entity_type: 'batch',
          requested_by: user.id,
          approver_role: 'management',
          status: 'pending',
          comments: `Significant variance detected: ${variancePercentage.toFixed(2)}% (${varianceGrams.toFixed(2)}g)`,
        }]);

      if (approvalError) {
        console.error('Error creating approval request:', approvalError);
      }

      return {
        success: true,
        requiresApproval: true,
        variance: {
          grams: varianceGrams,
          percentage: variancePercentage,
        },
        data: receiving,
      };
    }

    const newStatus = batch.status === 'shipped' || batch.status === 'created'
      ? 'received_airport'
      : 'received_refinery';

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: newStatus,
        current_site_id: data.receiving_site_id,
        weight_grams: data.actual_weight_grams,
        weight_ounces: data.actual_weight_grams / 31.1035,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.batch_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await supabase.from('batch_status_history').insert([{
      batch_id: data.batch_id,
      status: newStatus,
      changed_by: user.id,
      comments: `Received at ${newStatus === 'received_airport' ? 'airport' : 'refinery'}`,
    }]);

    return {
      success: true,
      requiresApproval: false,
      variance: {
        grams: varianceGrams,
        percentage: variancePercentage,
      },
      data: receiving,
    };
  } catch (error: any) {
    console.error('Error in confirmReceipt:', error);
    return { success: false, error: error.message };
  }
}

export async function approveVariance(receivingId: string, batchId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data: receiving } = await supabase
      .from('receiving_records')
      .select('actual_weight_grams')
      .eq('id', receivingId)
      .single();

    if (!receiving) {
      return { success: false, error: 'Receiving record not found' };
    }

    const { data: batch } = await supabase
      .from('batches')
      .select('status')
      .eq('id', batchId)
      .single();

    const newStatus = batch?.status === 'shipped' || batch?.status === 'created'
      ? 'received_airport'
      : 'received_refinery';

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: newStatus,
        weight_grams: receiving.actual_weight_grams,
        weight_ounces: receiving.actual_weight_grams / 31.1035,
      })
      .eq('id', batchId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await supabase
      .from('receiving_records')
      .update({
        reconciliation_approved_by: user.id,
        reconciliation_approved_at: new Date().toISOString(),
      })
      .eq('id', receivingId);

    await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('entity_id', batchId)
      .eq('request_type', 'batch_receipt')
      .eq('status', 'pending');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
