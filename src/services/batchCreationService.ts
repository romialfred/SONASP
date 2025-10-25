import { supabase } from '@/lib/supabase';
import { generateBatchNumber } from '@/utils/batchUtils';

export interface BatchData {
  shipping_date: string;
  weight_grams: number;
  site_id?: string;
  comments?: string;
  created_by?: string;
}

export interface CreateBatchData extends BatchData {
  transport_company_id?: string;
  refinery_id?: string;
}

export async function createBatch(data: BatchData) {
  try {
    const batchNumber = generateBatchNumber(data.site_id || 'SITE', new Date(data.shipping_date));

    const { data: batch, error } = await supabase
      .from('batches')
      .insert({
        batch_number: batchNumber,
        shipping_date: data.shipping_date,
        weight_grams: data.weight_grams,
        weight_oz: data.weight_grams / 31.1035,
        site_id: data.site_id,
        comments: data.comments,
        status: 'created',
        created_by: data.created_by,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: batch };
  } catch (error) {
    console.error('Error creating batch:', error);
    return { success: false, error };
  }
}

export async function updateBatchStatus(batchId: string, status: string, userId?: string) {
  try {
    const { data, error } = await supabase
      .from('batches')
      .update({
        status,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', batchId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating batch status:', error);
    return { success: false, error };
  }
}

export async function getBatchById(batchId: string) {
  try {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching batch:', error);
    return { success: false, error };
  }
}

export async function getAllBatches(filters?: { status?: string; site_id?: string }) {
  try {
    let query = supabase.from('batches').select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.site_id) {
      query = query.eq('site_id', filters.site_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching batches:', error);
    return { success: false, error };
  }
}

export async function getSites() {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('name');

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching sites:', error);
    return { success: false, error, data: [] };
  }
}

export async function getTransportCompanies() {
  try {
    const { data, error } = await supabase
      .from('transport_companies')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching transport companies:', error);
    return { success: false, error, data: [] };
  }
}

export async function getRefineries() {
  try {
    const { data, error } = await supabase
      .from('refineries')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching refineries:', error);
    return { success: false, error, data: [] };
  }
}
