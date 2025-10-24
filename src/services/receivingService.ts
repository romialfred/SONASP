import { supabase } from '@/lib/supabase';
import { logBatchAction } from '@/lib/auditLog';
import type { Database } from '@/types/database';

type ReceivingRecord = Database['public']['Tables']['receiving_records']['Row'];
type ReceivingInsert = Database['public']['Tables']['receiving_records']['Insert'];

export interface ConfirmReceiptParams {
  batch_id: string;
  receiving_site_id: string;
  expected_weight_grams: number;
  actual_weight_grams: number;
  reconciliation_comments?: string;
}

export const receivingService = {
  async confirmReceipt(params: ConfirmReceiptParams, userId: string, userEmail: string) {
    const { data: batch } = await supabase
      .from('batches')
      .select('batch_number, status')
      .eq('id', params.batch_id)
      .maybeSingle();

    if (!batch) throw new Error('Batch not found');

    const { data, error } = await supabase
      .from('receiving_records')
      .insert({
        batch_id: params.batch_id,
        receiving_site_id: params.receiving_site_id,
        expected_weight_grams: params.expected_weight_grams,
        actual_weight_grams: params.actual_weight_grams,
        variance_grams: 0,
        variance_percentage: 0,
        is_significant_variance: false,
        received_by: userId,
        reconciliation_comments: params.reconciliation_comments,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create receiving record');

    const newStatus = batch.status === 'shipped' ? 'received_airport' : 'received_refinery';

    await supabase
      .from('batches')
      .update({
        status: newStatus,
        current_site_id: params.receiving_site_id,
      })
      .eq('id', params.batch_id);

    await logBatchAction(
      userId,
      userEmail,
      'RECEIVE',
      batch.batch_number,
      `Received at site. Variance: ${data.variance_percentage}%`
    );

    return data;
  },

  async getPendingReceipts(siteId: string) {
    const { data, error } = await supabase
      .from('batches')
      .select(`
        *,
        origin_site:sites!batches_origin_site_id_fkey(name)
      `)
      .eq('current_site_id', siteId)
      .in('status', ['shipped', 'shipped_refinery'])
      .order('shipping_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getReceivingHistory(siteId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('receiving_records')
      .select(`
        *,
        batch:batches(batch_number, weight_grams),
        receiving_site:sites(name)
      `)
      .eq('receiving_site_id', siteId)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  async getVarianceAlerts(siteId?: string) {
    let query = supabase
      .from('receiving_records')
      .select(`
        *,
        batch:batches(batch_number),
        receiving_site:sites(name)
      `)
      .eq('is_significant_variance', true)
      .order('received_at', { ascending: false });

    if (siteId) {
      query = query.eq('receiving_site_id', siteId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async approveReconciliation(recordId: string, userId: string, userEmail: string) {
    const { data: record } = await supabase
      .from('receiving_records')
      .select('batch_id, batch:batches(batch_number)')
      .eq('id', recordId)
      .maybeSingle();

    if (!record) throw new Error('Receiving record not found');

    const { error } = await supabase
      .from('receiving_records')
      .update({
        reconciliation_approved_by: userId,
        reconciliation_approved_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (error) throw error;

    await logBatchAction(
      userId,
      userEmail,
      'APPROVE_RECONCILIATION',
      record.batch.batch_number,
      'Variance reconciliation approved'
    );

    return true;
  },
};
