import { supabase } from '@/lib/supabase';

export interface ShippingPreparation {
  id: string;
  daily_production_id: string | null;
  mining_company_id: string | null;
  license_id: string | null;
  export_license_id: string | null;
  expedition_lot_number: string | null;
  seal_number: string | null;
  packing_list_url: string | null;
  packing_list_document_id: string | null;
  shipped_to_company: string | null;
  shipped_to_address: string | null;
  shipped_to_country: string | null;
  status: 'pending' | 'prepared' | 'validated_for_refinery' | 'in_refining' | 'refined' | 'sold' | 'cancelled';
  prepared_at: string | null;
  shipped_at: string | null;
  notes: string | null;
  total_net_weight_grams: number;
  total_gross_weight_grams: number;
  total_weight_oz: number;
  total_boxes: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  mining_company_name?: string | null;
  mining_companies?: { name: string } | null;
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

    // CRITICAL FIX: Ensure status is valid enum value from shipping_preparation_status
    // Source: supabase/migrations/20251114_004_correct_status_enums_verified.sql
    const validStatuses: ShippingStatus[] = ['ready_for_customs', 'approved_by_customs', 'ready_for_expedition'];
    const cleanPreparation = { ...preparation };

    if (!cleanPreparation.status || !validStatuses.includes(cleanPreparation.status as ShippingStatus)) {
      cleanPreparation.status = 'ready_for_customs';
      console.warn('Invalid or missing status, defaulting to: ready_for_customs');
    }

    const { data, error } = await supabase
      .from('shipping_preparations')
      .insert({
        ...cleanPreparation,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePreparation(id: string, updates: Partial<ShippingPreparation>): Promise<ShippingPreparation> {
    // CRITICAL FIX: Validate status before UPDATE using enum shipping_preparation_status
    const validStatuses: ShippingStatus[] = ['ready_for_customs', 'approved_by_customs', 'ready_for_expedition'];
    const cleanUpdates = { ...updates };

    if (cleanUpdates.status && !validStatuses.includes(cleanUpdates.status as ShippingStatus)) {
      cleanUpdates.status = 'ready_for_customs';
      console.warn('Invalid status in UPDATE, defaulting to: ready_for_customs');
    }

    const { data, error } = await supabase
      .from('shipping_preparations')
      .update(cleanUpdates)
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
      .select(`
        *,
        mining_companies!shipping_preparations_mining_company_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(prep => ({
      ...prep,
      mining_company_name: prep.mining_companies?.name || null
    }));
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

  /**
   * Update shipping preparation status
   */
  async updateStatus(
    preparationId: string,
    newStatus: ShippingPreparation['status'],
    notes?: string
  ): Promise<ShippingPreparation> {
    // Get current preparation to get old status
    const { data: currentPrep } = await supabase
      .from('shipping_preparations')
      .select('status')
      .eq('id', preparationId)
      .single();

    const oldStatus = currentPrep?.status;

    const updateData: any = { status: newStatus };

    // Update prepared_at timestamp when status changes to prepared
    if (newStatus === 'prepared') {
      updateData.prepared_at = new Date().toISOString();
    }

    // Update shipped_at timestamp when status changes to a shipping-related status
    if (newStatus === 'validated_for_refinery' || newStatus === 'in_refining') {
      updateData.shipped_at = new Date().toISOString();
    }

    // Append notes with status change log
    if (notes) {
      const { data: current } = await supabase
        .from('shipping_preparations')
        .select('notes')
        .eq('id', preparationId)
        .maybeSingle();

      const statusNote = `[${new Date().toLocaleString('fr-FR')}] Statut changé vers ${newStatus}${notes ? ': ' + notes : ''}`;
      updateData.notes = current?.notes
        ? `${current.notes}\n\n${statusNote}`
        : statusNote;
    }

    // Update shipping preparation
    const { data, error } = await supabase
      .from('shipping_preparations')
      .update(updateData)
      .eq('id', preparationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating shipping status:', error);
      throw error;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Create entry in unified_status_history
    if (oldStatus !== newStatus) {
      const { error: historyError } = await supabase
        .from('unified_status_history')
        .insert({
          entity_type: 'shipping',
          entity_id: preparationId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: user?.id,
          notes: notes || null,
          changed_at: new Date().toISOString()
        });

      if (historyError) {
        console.error('Error creating status history:', historyError);
      }
    }

    return data;
  }
}

export const shippingPreparationService = new ShippingPreparationService();
