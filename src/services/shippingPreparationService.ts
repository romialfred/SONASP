import { supabase } from '@/lib/supabase';

export interface ShippingPreparation {
  id: string;
  daily_production_id: string | null;
  mining_company_id: string | null;
  expedition_lot_number: string | null;
  seal_number: string | null;
  packing_list_url: string | null;
  packing_list_document_id: string | null;
  shipped_to_company: string | null;
  shipped_to_address: string | null;
  shipped_to_country: string | null;
  status: 'pending' | 'prepared' | 'shipped';
  prepared_at: string | null;
  shipped_at: string | null;
  notes: string | null;
  total_net_weight_grams: number;
  total_gross_weight_grams: number;
  total_boxes: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ShippingProductionItem {
  id: string;
  shipping_preparation_id: string;
  daily_production_id: string;
  ingot_box_number: string;
  net_weight_grams: number;
  gross_weight_grams: number;
  fineness_pct: number;
  pure_gold_grams: number;
  seal_number_1?: string;
  seal_number_2?: string;
  order_index: number;
  created_at: string;
}

export interface ShippingSignatory {
  id: string;
  shipping_preparation_id: string;
  position: string;
  name: string;
  signature_data: string | null;
  signed_at: string | null;
  order_index: number;
  created_at: string;
}

export interface ShippingIngot {
  id: string;
  shipping_preparation_id: string;
  ingot_box_number: string;
  net_weight_grams: number;
  gross_weight_grams: number;
  seal_number_1: string | null;
  seal_number_2: string | null;
  created_at: string;
}

export interface ShippingDocument {
  id: string;
  shipping_preparation_id: string;
  title: string;
  document_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

class ShippingPreparationService {
  async getPreparationById(id: string): Promise<ShippingPreparation | null> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getPreparationByProduction(productionId: string): Promise<ShippingPreparation | null> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select('*')
      .eq('daily_production_id', productionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createPreparation(preparation: Partial<ShippingPreparation>): Promise<ShippingPreparation> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('shipping_preparations')
      .insert({
        ...preparation,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePreparation(id: string, updates: Partial<ShippingPreparation>): Promise<ShippingPreparation> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSignatories(preparationId: string): Promise<ShippingSignatory[]> {
    const { data, error } = await supabase
      .from('shipping_signatories')
      .select('*')
      .eq('shipping_preparation_id', preparationId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createSignatory(signatory: Partial<ShippingSignatory>): Promise<ShippingSignatory> {
    const { data, error } = await supabase
      .from('shipping_signatories')
      .insert(signatory)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSignatory(id: string, updates: Partial<ShippingSignatory>): Promise<ShippingSignatory> {
    const { data, error } = await supabase
      .from('shipping_signatories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSignatory(id: string): Promise<void> {
    const { error } = await supabase
      .from('shipping_signatories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getProductionItems(preparationId: string): Promise<ShippingProductionItem[]> {
    const { data, error } = await supabase
      .from('shipping_production_items')
      .select('*')
      .eq('shipping_preparation_id', preparationId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async addProductionItem(item: Partial<ShippingProductionItem>): Promise<ShippingProductionItem> {
    const { data, error } = await supabase
      .from('shipping_production_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeProductionItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('shipping_production_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getAllPreparations(): Promise<ShippingPreparation[]> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getIngots(preparationId: string): Promise<ShippingIngot[]> {
    const { data, error } = await supabase
      .from('shipping_ingots')
      .select('*')
      .eq('shipping_preparation_id', preparationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createIngot(ingot: Partial<ShippingIngot>): Promise<ShippingIngot> {
    const { data, error } = await supabase
      .from('shipping_ingots')
      .insert(ingot)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateIngot(id: string, updates: Partial<ShippingIngot>): Promise<ShippingIngot> {
    const { data, error } = await supabase
      .from('shipping_ingots')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteIngot(id: string): Promise<void> {
    const { error } = await supabase
      .from('shipping_ingots')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getDocuments(preparationId: string): Promise<ShippingDocument[]> {
    const { data, error } = await supabase
      .from('shipping_documents')
      .select('*')
      .eq('shipping_preparation_id', preparationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async uploadDocument(preparationId: string, file: File, title: string): Promise<ShippingDocument> {
    const { data: { user } } = await supabase.auth.getUser();

    // Upload file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${preparationId}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shipping-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('shipping-documents')
      .getPublicUrl(fileName);

    // Create document record
    const { data, error } = await supabase
      .from('shipping_documents')
      .insert({
        shipping_preparation_id: preparationId,
        title,
        document_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteDocument(id: string, documentUrl: string): Promise<void> {
    // Delete from storage
    const fileName = documentUrl.split('/').slice(-2).join('/');
    await supabase.storage
      .from('shipping-documents')
      .remove([fileName]);

    // Delete record
    const { error } = await supabase
      .from('shipping_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Reserve quota on an export license for a shipping preparation
   */
  async reserveLicenseQuota(
    licenseId: string,
    shippingId: string,
    quantity: number
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('reserve_license_quota', {
      p_license_id: licenseId,
      p_shipping_id: shippingId,
      p_quantity: quantity,
      p_user_id: user?.id || null,
    });

    if (error) throw error;
    return data as boolean;
  }

  /**
   * Release quota from an export license (in case of cancellation)
   */
  async releaseLicenseQuota(
    licenseId: string,
    quantity: number
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('release_license_quota', {
      p_license_id: licenseId,
      p_quantity: quantity,
      p_user_id: user?.id || null,
    });

    if (error) throw error;
    return data as boolean;
  }
}

export const shippingPreparationService = new ShippingPreparationService();
