import { supabase } from '@/lib/supabase';
import { logBatchAction } from '@/lib/auditLog';
import type { Database } from '@/types/database';

type Batch = Database['public']['Tables']['batches']['Row'];
type BatchInsert = Database['public']['Tables']['batches']['Insert'];
type BatchUpdate = Database['public']['Tables']['batches']['Update'];

export interface BatchWithDetails extends Batch {
  origin_site_name?: string;
  current_site_name?: string;
  refining_approved_at?: string;
  status_change_count?: number;
}

export interface CreateBatchParams {
  weight_grams: number;
  shipping_date: string;
  origin_site_id: string;
  current_site_id: string;
  comments?: string;
  transportation_company?: string;
}

export const batchService = {
  async createBatch(params: CreateBatchParams, userId: string, userEmail: string) {
    const batchNumber = await this.generateBatchNumber(params.origin_site_id);

    const { data, error } = await supabase
      .from('batches')
      .insert({
        batch_number: batchNumber,
        weight_grams: params.weight_grams,
        shipping_date: params.shipping_date,
        origin_site_id: params.origin_site_id,
        current_site_id: params.current_site_id,
        comments: params.comments,
        transportation_company: params.transportation_company,
        status: 'created',
        created_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create batch');

    await logBatchAction(userId, userEmail, 'CREATE', batchNumber, 'Batch created');

    return data;
  },

  async getBatchById(id: string) {
    const { data, error } = await supabase
      .from('batches')
      .select(`
        *,
        origin_site:sites!batches_origin_site_id_fkey(name, country),
        current_site:sites!batches_current_site_id_fkey(name, site_type),
        refining_records(final_fine_ounces, approved_at)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listBatches(filters?: {
    status?: string;
    site_id?: string;
    from_date?: string;
    to_date?: string;
  }) {
    let query = supabase
      .from('batches')
      .select(`
        *,
        origin_site:sites!batches_origin_site_id_fkey(name),
        current_site:sites!batches_current_site_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.site_id) {
      query = query.or(`origin_site_id.eq.${filters.site_id},current_site_id.eq.${filters.site_id}`);
    }
    if (filters?.from_date) {
      query = query.gte('shipping_date', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('shipping_date', filters.to_date);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async updateBatchStatus(
    batchId: string,
    newStatus: string,
    userId: string,
    userEmail: string,
    comments?: string
  ) {
    const { data: batch, error: fetchError } = await supabase
      .from('batches')
      .select('batch_number, status')
      .eq('id', batchId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!batch) throw new Error('Batch not found');

    const { error } = await supabase
      .from('batches')
      .update({ status: newStatus })
      .eq('id', batchId);

    if (error) throw error;

    await logBatchAction(
      userId,
      userEmail,
      'UPDATE_STATUS',
      batch.batch_number,
      `Status changed from ${batch.status} to ${newStatus}${comments ? ': ' + comments : ''}`
    );

    return true;
  },

  async getBatchTimeline(batchId: string) {
    const { data, error } = await supabase
      .from('batch_status_history')
      .select(`
        *,
        user:user_profiles(email, full_name)
      `)
      .eq('batch_id', batchId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async generateBatchNumber(siteId: string): Promise<string> {
    const { data: site } = await supabase
      .from('sites')
      .select('country')
      .eq('id', siteId)
      .maybeSingle();

    const country = site?.country || 'XX';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `BT-${year}${month}-${country}-${randomId}`;
  },

  async getAvailableInventory() {
    const { data, error } = await supabase.rpc('get_available_inventory');
    if (error) throw error;
    return data;
  },
};
