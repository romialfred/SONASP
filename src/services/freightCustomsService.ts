import { supabase } from '@/lib/supabase';

export type FreightCustomsStatus =
  | 'customs_pending'
  | 'customs_approved'
  | 'ready_for_transport'
  | 'shipped_to_refinery';

export type FreightDocumentType =
  | 'customs_declaration'
  | 'customs_approval'
  | 'transport_document'
  | 'bill_of_lading'
  | 'export_invoice'
  | 'bullion_summary'
  | 'other';

export interface FreightCustomsOperation {
  id: string;
  shipping_preparation_id: string;
  reference_number: string;
  status: FreightCustomsStatus;

  customs_office?: string | null;
  customs_officer_name?: string | null;
  customs_approval_date?: string | null;
  customs_reference_number?: string | null;

  transport_company_id?: string | null;
  freight_forwarder_contact?: string | null;
  estimated_departure_date?: string | null;
  actual_departure_date?: string | null;
  estimated_arrival_date?: string | null;
  actual_arrival_date?: string | null;

  awb_number?: string | null;
  tracking_number?: string | null;
  notes?: string | null;

  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  shipping_preparation?: any;
  transport_company?: any;
  documents?: FreightCustomsDocument[];
  invoice_data?: FreightCustomsInvoiceData | null;
}

export interface FreightCustomsDocument {
  id: string;
  freight_customs_operation_id: string;
  document_type: FreightDocumentType;
  title: string;
  description?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
}

export interface FreightCustomsInvoiceData {
  id: string;
  freight_customs_operation_id: string;

  sender_name?: string | null;
  sender_address?: string | null;
  sender_city?: string | null;
  sender_country?: string | null;
  sender_nif?: string | null;

  recipient_name?: string | null;
  recipient_address?: string | null;
  recipient_city?: string | null;
  recipient_country?: string | null;
  recipient_phone?: string | null;

  mine_name?: string | null;
  mine_location?: string | null;
  country_of_origin?: string | null;

  exchange_rate_fcfa_usd?: number | null;
  number_of_boxes?: number | null;
  box_type?: string | null;
  description?: string | null;

  metal_price_cfa_per_kg?: number | null;
  total_value_cfa?: number | null;
  total_value_usd?: number | null;

  created_at: string;
  updated_at: string;
}

export const freightCustomsService = {
  /**
   * Récupère toutes les opérations douanières
   * Filtre uniquement les expéditions avec status = 'shipped'
   */
  async listOperations(): Promise<FreightCustomsOperation[]> {
    const { data, error } = await supabase
      .from('freight_customs_operations')
      .select(`
        *,
        shipping_preparation:shipping_preparations!inner(
          id,
          reference_number,
          status,
          shipment_date,
          total_weight_grams,
          total_weight_oz,
          destination,
          transport_company_id,
          mining_company_id,
          mining_companies(id, name)
        ),
        transport_company:transport_companies(
          id,
          name,
          contact_person,
          phone,
          email
        ),
        documents:freight_customs_documents(
          id,
          document_type,
          title,
          file_name,
          uploaded_at
        ),
        invoice_data:freight_customs_invoice_data(*)
      `)
      .eq('shipping_preparation.status', 'shipped')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère une opération douanière par ID
   */
  async getOperationById(id: string): Promise<FreightCustomsOperation | null> {
    const { data, error } = await supabase
      .from('freight_customs_operations')
      .select(`
        *,
        shipping_preparation:shipping_preparations(
          *,
          mining_companies(id, name),
          items:shipping_preparation_items(
            *,
            daily_productions(
              id,
              production_date,
              bar_reference,
              bullion_grams,
              estimated_fineness_pct,
              estimated_silver_pct,
              pure_gold_grams,
              silver_content_grams,
              estimated_oz
            )
          )
        ),
        transport_company:transport_companies(*),
        documents:freight_customs_documents(*),
        invoice_data:freight_customs_invoice_data(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Crée une nouvelle opération douanière
   */
  async createOperation(shippingPreparationId: string): Promise<FreightCustomsOperation> {
    // Générer le numéro de référence
    const { data: refData, error: refError } = await supabase
      .rpc('generate_freight_reference');

    if (refError) throw refError;

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('freight_customs_operations')
      .insert({
        shipping_preparation_id: shippingPreparationId,
        reference_number: refData,
        status: 'customs_pending',
        created_by: userData?.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Met à jour une opération douanière
   */
  async updateOperation(
    id: string,
    updates: Partial<FreightCustomsOperation>
  ): Promise<FreightCustomsOperation> {
    const { data, error } = await supabase
      .from('freight_customs_operations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Change le statut d'une opération
   */
  async updateStatus(
    id: string,
    status: FreightCustomsStatus,
    additionalData?: Partial<FreightCustomsOperation>
  ): Promise<FreightCustomsOperation> {
    const updates: any = { status, ...additionalData };

    // Ajouter la date d'approbation automatiquement si approuvé
    if (status === 'customs_approved' && !updates.customs_approval_date) {
      updates.customs_approval_date = new Date().toISOString();
    }

    // Ajouter la date de départ si expédié
    if (status === 'shipped_to_refinery' && !updates.actual_departure_date) {
      updates.actual_departure_date = new Date().toISOString();
    }

    return this.updateOperation(id, updates);
  },

  /**
   * Liste les documents d'une opération
   */
  async listDocuments(operationId: string): Promise<FreightCustomsDocument[]> {
    const { data, error } = await supabase
      .from('freight_customs_documents')
      .select('*')
      .eq('freight_customs_operation_id', operationId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Upload un document
   */
  async uploadDocument(
    operationId: string,
    documentType: FreightDocumentType,
    title: string,
    file: File,
    description?: string
  ): Promise<FreightCustomsDocument> {
    const { data: userData } = await supabase.auth.getUser();

    // Upload du fichier dans Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${operationId}/${Date.now()}.${fileExt}`;
    const filePath = `freight-customs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('freight-customs-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Créer l'entrée dans la base de données
    const { data, error } = await supabase
      .from('freight_customs_documents')
      .insert({
        freight_customs_operation_id: operationId,
        document_type: documentType,
        title,
        description,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userData?.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Récupère l'URL publique d'un document
   */
  async getDocumentUrl(filePath: string): Promise<string> {
    const { data } = supabase.storage
      .from('freight-customs-documents')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  /**
   * Supprime un document
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Récupérer le document pour obtenir le file_path
    const { data: doc, error: fetchError } = await supabase
      .from('freight_customs_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // Supprimer le fichier du storage
    if (doc.file_path) {
      const { error: storageError } = await supabase.storage
        .from('freight-customs-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;
    }

    // Supprimer l'entrée de la base de données
    const { error } = await supabase
      .from('freight_customs_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  /**
   * Sauvegarde ou met à jour les données de facture
   */
  async saveInvoiceData(
    operationId: string,
    invoiceData: Partial<FreightCustomsInvoiceData>
  ): Promise<FreightCustomsInvoiceData> {
    // Vérifier si des données existent déjà
    const { data: existing } = await supabase
      .from('freight_customs_invoice_data')
      .select('id')
      .eq('freight_customs_operation_id', operationId)
      .single();

    if (existing) {
      // Mise à jour
      const { data, error } = await supabase
        .from('freight_customs_invoice_data')
        .update(invoiceData)
        .eq('freight_customs_operation_id', operationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Création
      const { data, error } = await supabase
        .from('freight_customs_invoice_data')
        .insert({
          freight_customs_operation_id: operationId,
          ...invoiceData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  /**
   * Récupère les données de facture
   */
  async getInvoiceData(operationId: string): Promise<FreightCustomsInvoiceData | null> {
    const { data, error } = await supabase
      .from('freight_customs_invoice_data')
      .select('*')
      .eq('freight_customs_operation_id', operationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Récupère les expéditions disponibles pour créer des opérations douanières
   */
  async getAvailableShipments(): Promise<any[]> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select(`
        id,
        reference_number,
        shipment_date,
        status,
        total_weight_grams,
        total_weight_oz,
        destination,
        mining_companies(id, name),
        freight_customs_operations(id)
      `)
      .eq('status', 'shipped')
      .is('freight_customs_operations.id', null)
      .order('shipment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
