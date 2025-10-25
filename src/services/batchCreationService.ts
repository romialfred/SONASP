import { supabase } from '@/lib/supabase';

export interface CreateBatchData {
  origin_site_id: string;
  weight_grams: number;
  purity_percentage: number;
  shipping_date: string;
  mine_to_airport_transport_id: string;
  airport_to_refinery_transport_id: string;
  destination_refinery_id: string;
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
      origin_site_id: data.origin_site_id,
      current_site_id: data.origin_site_id,
      weight_grams: data.weight_grams,
      weight_ounces: weightOz,
      purity_percentage: data.purity_percentage,
      shipping_date: data.shipping_date,
      mine_to_airport_transport_id: data.mine_to_airport_transport_id,
      airport_to_refinery_transport_id: data.airport_to_refinery_transport_id,
      destination_refinery_id: data.destination_refinery_id,
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

export async function getTransportCompanies(type?: 'mine_to_airport' | 'airport_to_refinery' | 'both') {
  let query = supabase
    .from('transport_companies')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (type && type !== 'both') {
    query = query.or(`company_type.eq.${type},company_type.eq.both`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching transport companies:', error);
    return [];
  }

  return data || [];
}

export async function getRefineries() {
  const { data, error } = await supabase
    .from('refineries')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching refineries:', error);
    return [];
  }

  return data || [];
}
