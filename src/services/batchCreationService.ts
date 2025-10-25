import { supabase } from '@/lib/supabase';

export interface CreateBatchData {
  supplier: string;
  origin_site_id: string;
  weight_grams: number;
  purity_percentage: number;
  shipping_date: string;
  carrier: string;
  destination: string;
  comments?: string;
}

export interface BatchResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function createBatch(data: CreateBatchData): Promise<BatchResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const batchNumber = generateBatchNumber();
    const weightOz = data.weight_grams / 31.1035;

    const batchData = {
      batch_number: batchNumber,
      status: 'created',
      supplier: data.supplier,
      origin_site_id: data.origin_site_id,
      current_site_id: data.origin_site_id,
      weight_grams: data.weight_grams,
      weight_ounces: weightOz,
      purity_percentage: data.purity_percentage,
      shipping_date: data.shipping_date,
      transportation_company: data.carrier,
      carrier: data.carrier,
      destination: data.destination,
      comments: data.comments || null,
      created_by: user.id,
    };

    const { data: batch, error } = await supabase
      .from('batches')
      .insert([batchData])
      .select()
      .single();

    if (error) {
      console.error('Error creating batch:', error);
      return { success: false, error: error.message };
    }

    await supabase.from('batch_status_history').insert([{
      batch_id: batch.id,
      status: 'created',
      changed_by: user.id,
      comments: 'Batch created',
    }]);

    return { success: true, data: batch };
  } catch (error: any) {
    console.error('Error in createBatch:', error);
    return { success: false, error: error.message || 'Failed to create batch' };
  }
}

function generateBatchNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `BT-${year}-${timestamp}`;
}

export async function getSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching sites:', error);
    return [];
  }

  return data || [];
}
