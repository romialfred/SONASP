import { supabase } from '@/lib/supabase';
import {
  deleteFreightCustomsBinary,
  getFreightCustomsBinaryUrl,
  uploadFreightCustomsBinary,
} from '@/services/freightCustomsBinaryGateway';

export type FreightCustomsStatus =
  | 'customs_pending'
  | 'customs_approved'
  | 'ready_for_transport'
  | 'ready_for_expedition'
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
  mining_company_id?: string;
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
  prepared_by?: string | null;
  customs_approved_by?: string | null;
  transport_prepared_by?: string | null;
  dispatched_by?: string | null;
  status_changed_at?: string | null;
  created_at: string;
  updated_at: string;
  // Relations de lecture RLS, conservées pour les écrans existants.
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

export interface FreightCustomsHistoryEntry {
  id: string;
  old_status: FreightCustomsStatus | null;
  new_status: FreightCustomsStatus;
  change_context: string;
  changed_by: string | null;
  changed_at: string;
  action_description: string | null;
  notes: string | null;
  user_email: string | null;
  user_name: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AvailableFreightShipment {
  id: string;
  reference_number: string;
  shipment_date?: string | null;
  status: 'ready_for_expedition';
  total_weight_grams: number;
  total_weight_oz: number;
  destination?: string | null;
  mining_company_id?: string;
  mining_companies?: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    localite?: string | null;
    country?: string | null;
    tax_id?: string | null;
  } | null;
}

export type FreightCustomsUpdate = Partial<Pick<
  FreightCustomsOperation,
  | 'customs_office'
  | 'customs_officer_name'
  | 'customs_reference_number'
  | 'transport_company_id'
  | 'freight_forwarder_contact'
  | 'estimated_departure_date'
  | 'estimated_arrival_date'
  | 'awb_number'
  | 'tracking_number'
  | 'notes'
>>;

export type FreightTransitionDetails = Partial<Pick<
  FreightCustomsOperation,
  | 'customs_office'
  | 'customs_officer_name'
  | 'customs_reference_number'
  | 'transport_company_id'
  | 'freight_forwarder_contact'
  | 'awb_number'
  | 'tracking_number'
  | 'notes'
>>;

export type FreightInvoiceInput = Partial<Pick<
  FreightCustomsInvoiceData,
  | 'recipient_name'
  | 'recipient_address'
  | 'recipient_city'
  | 'recipient_country'
  | 'recipient_phone'
  | 'exchange_rate_fcfa_usd'
  | 'number_of_boxes'
  | 'box_type'
  | 'description'
  | 'metal_price_cfa_per_kg'
  | 'total_value_cfa'
  | 'total_value_usd'
>>;

interface FreightRpcError {
  code?: string;
  message?: string;
}

type FreightRpcName =
  | 'snp_fret_creer_operation'
  | 'snp_fret_modifier_operation'
  | 'snp_fret_transitionner_operation'
  | 'snp_fret_enregistrer_facture'
  | 'get_unified_status_history';

const freightRpcClient = supabase as unknown as {
  rpc(
    functionName: FreightRpcName,
    parameters: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: FreightRpcError | null }>;
};

export class FreightCustomsConflictError extends Error {
  constructor() {
    super('Le dossier fret a changé entre-temps. Actualisez la page avant de réessayer.');
    this.name = 'FreightCustomsConflictError';
  }
}

export class FreightCustomsTransitionError extends Error {
  constructor(expectedStatus: FreightCustomsStatus, newStatus: FreightCustomsStatus) {
    super(`Transition fret interdite : ${expectedStatus} → ${newStatus}.`);
    this.name = 'FreightCustomsTransitionError';
  }
}

function isAllowedTransition(
  expectedStatus: FreightCustomsStatus,
  newStatus: FreightCustomsStatus,
): boolean {
  return (
    (expectedStatus === 'customs_pending' && newStatus === 'customs_approved')
    || (expectedStatus === 'customs_approved' && newStatus === 'ready_for_transport')
    || (
      (expectedStatus === 'ready_for_transport' || expectedStatus === 'ready_for_expedition')
      && newStatus === 'shipped_to_refinery'
    )
  );
}

function isOptimisticConflict(error: FreightRpcError): boolean {
  return error.code === '40001' || error.message?.includes('Conflit optimiste') === true;
}

function throwRpcError(error: FreightRpcError): never {
  if (isOptimisticConflict(error)) throw new FreightCustomsConflictError();
  throw error;
}

function unwrapComposite(value: unknown, label: string): Record<string, unknown> {
  const candidate = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error(`Le serveur n’a pas confirmé ${label}.`);
  }
  return candidate as Record<string, unknown>;
}

function requireOperation(value: unknown): FreightCustomsOperation {
  const row = unwrapComposite(value, 'l’opération fret');
  if (
    typeof row.id !== 'string'
    || typeof row.shipping_preparation_id !== 'string'
    || typeof row.reference_number !== 'string'
    || typeof row.status !== 'string'
    || typeof row.updated_at !== 'string'
  ) {
    throw new Error('La confirmation de l’opération fret est incomplète.');
  }
  return row as unknown as FreightCustomsOperation;
}

function requireInvoice(value: unknown): FreightCustomsInvoiceData {
  const row = unwrapComposite(value, 'la facture fret');
  if (typeof row.id !== 'string' || typeof row.freight_customs_operation_id !== 'string') {
    throw new Error('La confirmation de la facture fret est incomplète.');
  }
  return row as unknown as FreightCustomsInvoiceData;
}

function pickDefined(
  source: object,
  keys: readonly string[],
): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(
    keys
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]]),
  );
}

const OPERATION_UPDATE_KEYS = [
  'customs_office', 'customs_officer_name', 'customs_reference_number',
  'transport_company_id', 'freight_forwarder_contact',
  'estimated_departure_date', 'estimated_arrival_date', 'awb_number',
  'tracking_number', 'notes',
] as const;

const TRANSITION_DETAIL_KEYS = [
  'customs_office', 'customs_officer_name', 'customs_reference_number',
  'transport_company_id', 'freight_forwarder_contact', 'awb_number',
  'tracking_number', 'notes',
] as const;

const INVOICE_INPUT_KEYS = [
  'recipient_name', 'recipient_address', 'recipient_city', 'recipient_country',
  'recipient_phone', 'exchange_rate_fcfa_usd', 'number_of_boxes', 'box_type',
  'description', 'metal_price_cfa_per_kg', 'total_value_cfa', 'total_value_usd',
] as const;

export const freightCustomsService = {
  async listOperations(): Promise<FreightCustomsOperation[]> {
    const { data, error } = await supabase
      .from('freight_customs_operations')
      .select(`
        *,
        shipping_preparation:shipping_preparations!fk_shipping_preparation!inner(
          id, expedition_lot_number, total_boxes, reference_number:expedition_lot_number,
          status, shipment_date:prepared_at, total_weight_grams:total_net_weight_grams,
          total_weight_oz, destination:shipped_to_country, transport_company_id:freight_company_id,
          mining_company_id, mining_companies(id, name)
        ),
        transport_company:transport_companies(
          id, name, contact_person, phone, email
        ),
        documents:freight_customs_documents!fk_freight_operation(
          id, document_type, title, file_name, uploaded_at
        ),
        invoice_data:freight_customs_invoice_data!fk_freight_operation_invoice(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as FreightCustomsOperation[];
  },

  async getOperationById(id: string): Promise<FreightCustomsOperation | null> {
    const { data, error } = await supabase
      .from('freight_customs_operations')
      .select(`
        *,
        shipping_preparation:shipping_preparations!fk_shipping_preparation(
          *, reference_number:expedition_lot_number, shipment_date:prepared_at,
          total_weight_grams:total_net_weight_grams, destination:shipped_to_country,
          transport_company_id:freight_company_id,
          mining_companies(id, name, address, city, localite, country, tax_id),
          items:shipping_production_items(
            *,
            daily_productions:daily_production!shipping_production_items_daily_production_id_fkey(
              id, production_date, bar_reference, bullion_grams,
              estimated_fineness_pct, estimated_silver_pct, pure_gold_grams,
              silver_content_grams, estimated_oz
            )
          )
        ),
        transport_company:transport_companies(*),
        documents:freight_customs_documents!fk_freight_operation(*),
        invoice_data:freight_customs_invoice_data!fk_freight_operation_invoice(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as FreightCustomsOperation | null;
  },

  async createOperation(shippingPreparationId: string): Promise<FreightCustomsOperation> {
    const { data, error } = await freightRpcClient.rpc('snp_fret_creer_operation', {
      p_shipping_preparation_id: shippingPreparationId,
    });
    if (error) throwRpcError(error);
    return requireOperation(data);
  },

  async updateOperation(
    id: string,
    expectedUpdatedAt: string,
    updates: FreightCustomsUpdate,
  ): Promise<FreightCustomsOperation> {
    const { data, error } = await freightRpcClient.rpc('snp_fret_modifier_operation', {
      p_operation_id: id,
      p_expected_updated_at: expectedUpdatedAt,
      p_modifications: pickDefined(updates, OPERATION_UPDATE_KEYS),
    });
    if (error) throwRpcError(error);
    return requireOperation(data);
  },

  async transitionStatus(
    id: string,
    expectedStatus: FreightCustomsStatus,
    newStatus: FreightCustomsStatus,
    details: FreightTransitionDetails = {},
  ): Promise<FreightCustomsOperation> {
    if (!isAllowedTransition(expectedStatus, newStatus)) {
      throw new FreightCustomsTransitionError(expectedStatus, newStatus);
    }
    const { data, error } = await freightRpcClient.rpc('snp_fret_transitionner_operation', {
      p_operation_id: id,
      p_expected_status: expectedStatus,
      p_new_status: newStatus,
      p_details: pickDefined(details, TRANSITION_DETAIL_KEYS),
    });
    if (error) throwRpcError(error);
    const operation = requireOperation(data);
    if (operation.status !== newStatus) {
      throw new Error('Le serveur n’a pas confirmé la transition fret demandée.');
    }
    return operation;
  },

  async listDocuments(operationId: string): Promise<FreightCustomsDocument[]> {
    const { data, error } = await supabase
      .from('freight_customs_documents')
      .select('*')
      .eq('freight_customs_operation_id', operationId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as FreightCustomsDocument[];
  },

  async uploadDocument(
    operationId: string,
    documentType: FreightDocumentType,
    title: string,
    file: File,
    description?: string,
  ): Promise<FreightCustomsDocument> {
    return uploadFreightCustomsBinary({
      operationId,
      documentType,
      title,
      file,
      description,
    });
  },

  async getDocumentUrl(filePath: string): Promise<string> {
    return getFreightCustomsBinaryUrl(filePath);
  },

  async deleteDocument(documentId: string): Promise<void> {
    await deleteFreightCustomsBinary(documentId);
  },

  async saveInvoiceData(
    operationId: string,
    invoiceData: FreightInvoiceInput,
  ): Promise<FreightCustomsInvoiceData> {
    const { data, error } = await freightRpcClient.rpc('snp_fret_enregistrer_facture', {
      p_operation_id: operationId,
      p_donnees: pickDefined(invoiceData, INVOICE_INPUT_KEYS),
    });
    if (error) throwRpcError(error);
    return requireInvoice(data);
  },

  async getInvoiceData(operationId: string): Promise<FreightCustomsInvoiceData | null> {
    const { data, error } = await supabase
      .from('freight_customs_invoice_data')
      .select('*')
      .eq('freight_customs_operation_id', operationId)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as FreightCustomsInvoiceData | null;
  },

  async getStatusHistory(operationId: string): Promise<FreightCustomsHistoryEntry[]> {
    const { data, error } = await freightRpcClient.rpc('get_unified_status_history', {
      p_entity_type: 'freight_customs',
      p_entity_id: operationId,
    });
    if (error) throwRpcError(error);
    if (!Array.isArray(data)) {
      throw new Error('Le serveur n’a pas confirmé l’historique du dossier fret.');
    }
    return data as FreightCustomsHistoryEntry[];
  },

  async getAvailableShipments(): Promise<AvailableFreightShipment[]> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select(`
        id, reference_number:expedition_lot_number, shipment_date:prepared_at,
        status, total_weight_grams:total_net_weight_grams,
        total_weight_oz, destination:shipped_to_country, mining_company_id,
        mining_companies(id, name, address, city, localite, country, tax_id),
        freight_customs_operations!fk_shipping_preparation(id)
      `)
      .eq('status', 'ready_for_expedition')
      .is('freight_customs_operations.id', null)
      .order('prepared_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as AvailableFreightShipment[];
  },
};
