import { supabase } from '@/lib/supabase';
import { ShippingStatus } from '@/constants/shippingStatuses';
import {
  createPrivateSignedUrl,
  PRIVATE_STORAGE_BUCKETS,
  requireStorageObjectPath,
} from '@/lib/privateStorage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';

const SHIPPING_DOCUMENTS_BUCKET = PRIVATE_STORAGE_BUCKETS.shippingDocuments;

export interface ShippingPreparation {
  id: string;
  reference_number: string;
  expedition_number: string;
  shipment_date: string;
  production_date: string;
  daily_production_id: string | null;
  mining_company_id: string | null;
  export_license_id: string | null;  // Primary license field
  refinery_id: string | null;        // UUID reference to refineries
  freight_company_id: string | null; // UUID reference to transport_companies
  expedition_lot_number: string | null;
  seal_number: string | null;
  seal_numbers: string[];
  packing_list_url: string | null;
  packing_list_document_id: string | null;
  shipped_to_company: string | null;  // Legacy TEXT field (keep for backward compatibility)
  shipped_to_address: string | null;  // Legacy TEXT field (keep for backward compatibility)
  shipped_to_country: string | null;
  status: ShippingStatus;
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

export type ShippingPreparationUpdate = Partial<Omit<
  ShippingPreparation,
  'id' | 'status' | 'created_at' | 'created_by'
>>;

export interface ShippingProductionItem {
  id: string;
  shipping_preparation_id: string;
  daily_production_id: string;
  box_number: string;
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
  full_name: string;
  title: string;
  organization?: string;
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

    // Une préparation entre toujours au premier état du workflow. Les transitions
    // suivantes passent exclusivement par shippingStatusService.
    const cleanPreparation = {
      ...preparation,
      status: 'waiting_for_customs_approval' as const,
    };

    // REGRESSION FIX: Convert empty strings to null for foreign key fields
    // This prevents foreign key constraint violations
    if (cleanPreparation.refinery_id === '') {
      cleanPreparation.refinery_id = null;
    }
    if (cleanPreparation.freight_company_id === '') {
      cleanPreparation.freight_company_id = null;
    }
    if (cleanPreparation.export_license_id === '') {
      cleanPreparation.export_license_id = null;
    }
    if (cleanPreparation.mining_company_id === '') {
      cleanPreparation.mining_company_id = null;
    }

    const { data, error } = await supabase
      .from('shipping_preparations')
      .insert({
        ...cleanPreparation,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error during shipping preparation creation:', error);
      throw this.formatBusinessError(error);
    }
    return data;
  }

  async updatePreparation(id: string, updates: ShippingPreparationUpdate): Promise<ShippingPreparation> {
    // Défense runtime pour les appelants JavaScript/non typés : une mise à jour
    // générale ne doit jamais devenir un second chemin de transition de statut.
    if ('status' in updates) {
      throw new Error('Le statut doit être modifié depuis le workflow d’expédition.');
    }
    const cleanUpdates = { ...updates };

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
    // CRITICAL: Only show expeditions that have at least one production item added
    // This prevents empty expeditions from appearing in the list
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select(`
        *,
        mining_companies!shipping_preparations_mining_company_id_fkey(name),
        shipping_production_items!inner(id)
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

  async generateExpeditionLotNumber(
    miningCompanyId: string,
    year?: number
  ): Promise<string> {
    const { data, error } = await supabase.rpc('get_next_expedition_lot_number', {
      p_mining_company_id: miningCompanyId,
      p_year: year || new Date().getFullYear(),
    });

    if (error) throw error;
    return data;
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
    const validatedFile = validateUploadFile(file, UPLOAD_POLICIES.shippingDocument);

    const fileName = `${preparationId}/${crypto.randomUUID()}.${validatedFile.extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SHIPPING_DOCUMENTS_BUCKET)
      .upload(fileName, file, {
        contentType: validatedFile.mimeType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('shipping_documents')
      .insert({
        shipping_preparation_id: preparationId,
        title,
        // Colonne legacy : elle contient désormais le chemin objet privé.
        document_url: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: validatedFile.mimeType,
        uploaded_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      await supabase.storage.from(SHIPPING_DOCUMENTS_BUCKET).remove([uploadData.path]);
      throw error;
    }
    return data;
  }

  async getDocumentUrl(documentReference: string, expiresInSeconds = 300): Promise<string> {
    return createPrivateSignedUrl(SHIPPING_DOCUMENTS_BUCKET, documentReference, expiresInSeconds);
  }

  async deleteDocument(id: string, documentUrl: string): Promise<void> {
    const fileName = requireStorageObjectPath(documentUrl, SHIPPING_DOCUMENTS_BUCKET);
    const { error: storageError } = await supabase.storage
      .from(SHIPPING_DOCUMENTS_BUCKET)
      .remove([fileName]);
    if (storageError) throw storageError;

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
   * Libère la réservation d'une expédition. La base dérive la licence, le
   * poids et l'acteur depuis l'expédition et le JWT courant.
   */
  async releaseLicenseQuota(
    shippingId: string,
    reason: string,
  ): Promise<boolean> {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10) {
      throw new Error('Le motif de libération doit contenir au moins 10 caractères.');
    }

    const { data, error } = await supabase.rpc('snp_release_shipping_license_quota', {
      p_shipping_id: shippingId,
      p_reason: normalizedReason,
    });

    if (error) throw error;
    return data as boolean;
  }

  private formatBusinessError(error: any): Error {
    const technicalMessage = error.message || JSON.stringify(error);

    if (technicalMessage.includes('foreign key constraint') || technicalMessage.includes('violates')) {
      if (technicalMessage.includes('refinery_id')) {
        const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. La raffinerie sélectionnée n\'est pas valide.');
        businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
        return businessError;
      }
      if (technicalMessage.includes('freight_company_id')) {
        const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. La compagnie de fret sélectionnée n\'est pas valide.');
        businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
        return businessError;
      }
      if (technicalMessage.includes('export_license_id')) {
        const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. La licence d\'exportation sélectionnée n\'est pas valide.');
        businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
        return businessError;
      }
      const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. Certaines données sélectionnées ne sont pas valides.');
      businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
      return businessError;
    }

    if (technicalMessage.includes('duplicate') || technicalMessage.includes('unique')) {
      const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. Un enregistrement similaire existe déjà.');
      businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
      return businessError;
    }

    if (technicalMessage.includes('permission') || technicalMessage.includes('policy')) {
      const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. Vous n\'avez pas les permissions nécessaires pour effectuer cette action.');
      businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
      return businessError;
    }

    const businessError: any = new Error('Il y a eu un problème technique lors de l\'enregistrement de la préparation. Veuillez réessayer ou contacter le support.');
    businessError.technicalDetails = `Erreur technique: ${technicalMessage}\n\nCode: ${error.code}\nDétails: ${error.details || 'N/A'}`;
    return businessError;
  }
}

export const shippingPreparationService = new ShippingPreparationService();
