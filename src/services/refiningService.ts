import { supabase } from '@/lib/supabase';
import { logBatchAction } from '@/lib/auditLog';
import type { Database } from '@/types/database';

type RefiningRecord = Database['public']['Tables']['refining_records']['Row'];
type RefiningInsert = Database['public']['Tables']['refining_records']['Insert'];

export interface ProcessRefiningParams {
  batch_id: string;
  pre_melting_weight_grams: number;
  post_melting_weight_grams: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  processing_notes?: string;
}

export const refiningService = {
  async processRefining(params: ProcessRefiningParams, userId: string, userEmail: string) {
    const { data: batch } = await supabase
      .from('batches')
      .select('batch_number')
      .eq('id', params.batch_id)
      .maybeSingle();

    if (!batch) throw new Error('Batch not found');

    const { data, error } = await supabase
      .from('refining_records')
      .insert({
        batch_id: params.batch_id,
        pre_melting_weight_grams: params.pre_melting_weight_grams,
        post_melting_weight_grams: params.post_melting_weight_grams,
        fineness_percentage: params.fineness_percentage,
        metal_retained_percentage: params.metal_retained_percentage,
        final_fine_grams: 0,
        final_fine_ounces: 0,
        processing_notes: params.processing_notes,
        processed_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create refining record');

    await supabase
      .from('batches')
      .update({ status: 'processed' })
      .eq('id', params.batch_id);

    await logBatchAction(
      userId,
      userEmail,
      'PROCESS_REFINING',
      batch.batch_number,
      `Refining processed. Final fine: ${data.final_fine_ounces} oz`
    );

    return data;
  },

  async approveRefining(recordId: string, userId: string, userEmail: string) {
    const { data: record } = await supabase
      .from('refining_records')
      .select('batch_id, batch:batches(batch_number)')
      .eq('id', recordId)
      .maybeSingle();

    if (!record) throw new Error('Refining record not found');

    const { error } = await supabase
      .from('refining_records')
      .update({
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (error) throw error;

    await supabase
      .from('batches')
      .update({ status: 'ready_for_sale' })
      .eq('id', record.batch_id);

    await logBatchAction(
      userId,
      userEmail,
      'APPROVE_REFINING',
      record.batch.batch_number,
      'Refining approved, batch ready for sale'
    );

    return true;
  },

  async getPendingProcessing(siteId?: string) {
    let query = supabase
      .from('batches')
      .select(`
        *,
        current_site:sites!batches_current_site_id_fkey(name, id)
      `)
      .in('status', ['received_refinery', 'processing'])
      .order('updated_at', { ascending: true });

    if (siteId) {
      query = query.eq('current_site_id', siteId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getPendingApprovals(siteId?: string) {
    let query = supabase
      .from('refining_records')
      .select(`
        *,
        batch:batches(batch_number, current_site_id, current_site:sites(name))
      `)
      .is('approved_at', null)
      .order('processed_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    if (siteId) {
      return data?.filter(r => r.batch?.current_site_id === siteId) || [];
    }

    return data;
  },

  async getRefiningHistory(siteId?: string, limit: number = 50) {
    let query = supabase
      .from('refining_records')
      .select(`
        *,
        batch:batches(batch_number, current_site_id, current_site:sites(name)),
        processed_by_user:user_profiles!refining_records_processed_by_fkey(email, full_name)
      `)
      .order('processed_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    if (siteId) {
      return data?.filter(r => r.batch?.current_site_id === siteId) || [];
    }

    return data;
  },

  async getMonthlyAggregation(year: number, month: number, siteId?: string) {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    let query = supabase
      .from('refining_records')
      .select(`
        *,
        batch:batches(current_site_id)
      `)
      .gte('processed_at', startDate)
      .lte('processed_at', endDate)
      .not('approved_at', 'is', null);

    const { data, error } = await query;
    if (error) throw error;

    let records = data || [];
    if (siteId) {
      records = records.filter(r => r.batch?.current_site_id === siteId);
    }

    const aggregation = {
      total_batches: records.length,
      total_pre_melting_grams: records.reduce((sum, r) => sum + Number(r.pre_melting_weight_grams), 0),
      total_post_melting_grams: records.reduce((sum, r) => sum + Number(r.post_melting_weight_grams), 0),
      total_final_fine_ounces: records.reduce((sum, r) => sum + Number(r.final_fine_ounces), 0),
      average_fineness: records.reduce((sum, r) => sum + Number(r.fineness_percentage), 0) / records.length || 0,
      average_retention: records.reduce((sum, r) => sum + Number(r.metal_retained_percentage), 0) / records.length || 0,
    };

    return aggregation;
  },
};
