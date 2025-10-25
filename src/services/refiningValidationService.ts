import { supabase } from '@/lib/supabase';

export interface RefiningData {
  batch_id: string;
  pre_melting_weight_grams: number;
  post_melting_weight_grams: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  processing_notes?: string;
}

export async function getBatchesForRefining() {
  const { data, error } = await supabase
    .from('batches')
    .select(`
      *,
      origin_site:sites!batches_origin_site_id_fkey(name, country),
      current_site:sites!batches_current_site_id_fkey(name, country)
    `)
    .in('status', ['received_refinery'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching batches:', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data || [] };
}

export async function processRefining(data: RefiningData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const finalFineGrams =
      data.post_melting_weight_grams *
      (data.fineness_percentage / 100) *
      (data.metal_retained_percentage / 100);

    const finalFineOunces = finalFineGrams / 31.1035;

    const refiningRecord = {
      batch_id: data.batch_id,
      pre_melting_weight_grams: data.pre_melting_weight_grams,
      post_melting_weight_grams: data.post_melting_weight_grams,
      fineness_percentage: data.fineness_percentage,
      metal_retained_percentage: data.metal_retained_percentage,
      final_fine_grams: finalFineGrams,
      final_fine_ounces: finalFineOunces,
      processing_notes: data.processing_notes || null,
      processed_by: user.id,
    };

    const { data: refining, error: refiningError } = await supabase
      .from('refining_records')
      .insert([refiningRecord])
      .select()
      .single();

    if (refiningError) {
      return { success: false, error: refiningError.message };
    }

    const { error: approvalError } = await supabase
      .from('approval_requests')
      .insert([{
        request_type: 'refining_process',
        entity_id: data.batch_id,
        entity_type: 'batch',
        requested_by: user.id,
        approver_role: 'management',
        status: 'pending',
        comments: `Refining completed - Final fine: ${finalFineGrams.toFixed(2)}g`,
      }]);

    if (approvalError) {
      console.error('Error creating approval request:', approvalError);
    }

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.batch_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await supabase.from('batch_status_history').insert([{
      batch_id: data.batch_id,
      status: 'processing',
      changed_by: user.id,
      comments: 'Refining process completed, awaiting approval',
    }]);

    return {
      success: true,
      requiresApproval: true,
      calculations: {
        finalFineGrams,
        finalFineOunces,
      },
      data: refining,
    };
  } catch (error: any) {
    console.error('Error in processRefining:', error);
    return { success: false, error: error.message };
  }
}

export async function approveRefining(refiningId: string, batchId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error: updateError } = await supabase
      .from('refining_records')
      .update({
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', refiningId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    const { error: batchError } = await supabase
      .from('batches')
      .update({
        status: 'ready_for_sale',
      })
      .eq('id', batchId);

    if (batchError) {
      return { success: false, error: batchError.message };
    }

    await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('entity_id', batchId)
      .eq('request_type', 'refining_process')
      .eq('status', 'pending');

    await supabase.from('batch_status_history').insert([{
      batch_id: batchId,
      status: 'ready_for_sale',
      changed_by: user.id,
      comments: 'Refining approved - batch ready for sale',
    }]);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
