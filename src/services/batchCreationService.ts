import { supabase } from '@/lib/supabase';
import { generateBatchNumber as generateBatchNumberNew, getCountryCode } from '@/utils/batchNumberGenerator';

export interface BatchData {
  shipping_date: string;
  weight_grams: number;
  site_id?: string;
  comments?: string;
  created_by?: string;
}

export interface CreateBatchData {
  mining_company_id: string;
  license_id: string;
  weight_grams: number;
  metal_type: 'gold' | 'silver' | 'zinc' | 'diamond' | 'other';
  shipping_date: string;
  mine_to_airport_transport_id: string;
  airport_to_refinery_transport_id: string;
  destination_refinery_id: string;
  documents?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
    uploaded_at: string;
  }>;
  comments?: string;
}

export async function createBatch(data: CreateBatchData) {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    // Get mining company information to determine country code
    let countryCode: 'GN' | 'ML' | 'LB' = 'GN'; // Default
    if (data.mining_company_id) {
      // Fetch mining company to get country
      const { data: companyData } = await supabase
        .from('mining_companies')
        .select('country')
        .eq('id', data.mining_company_id)
        .single();

      if (companyData?.country) {
        countryCode = getCountryCode(companyData.country);
      }
    }

    // Generate batch number with new format: CC-YYYY-MM-XXX
    const batchNumber = await generateBatchNumberNew({
      country: countryCode,
      date: new Date(data.shipping_date)
    });

    // Calculate weight in ounces
    const weightOunces = data.weight_grams / 31.1035;

    const { data: batch, error } = await supabase
      .from('batches')
      .insert({
        batch_number: batchNumber,
        shipping_date: data.shipping_date,
        weight_grams: data.weight_grams,
        weight_ounces: weightOunces,
        metal_type: data.metal_type,
        mining_company_id: data.mining_company_id,
        license_id: data.license_id,
        mine_to_airport_transport_id: data.mine_to_airport_transport_id,
        airport_to_refinery_transport_id: data.airport_to_refinery_transport_id,
        destination_refinery_id: data.destination_refinery_id,
        documents: data.documents || [],
        comments: data.comments,
        status: 'pending_factory_approval',
        created_by: userData.user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: batch };
  } catch (error: any) {
    console.error('Error creating batch:', error);
    const errorMessage = error?.message || error?.error_description || error?.hint || 'An unexpected error occurred';
    return { success: false, error: errorMessage };
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
