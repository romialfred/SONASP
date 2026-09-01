import { supabase } from '@/lib/supabase';
import {
  deleteSensitiveResource,
  uploadSensitiveFile,
} from '@/services/sensitiveUploadGateway';
import { secureRandomId } from '@/lib/secureRandom';

const db = supabase as any;
export const GRAMMES_PAR_ONCE_TROY = 31.1034768;

export type ReserveAllocationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VALIDATED_LEVEL_1'
  | 'VALIDATED_LEVEL_2' | 'TRANSFER_AUTHORIZED' | 'IN_TRANSIT'
  | 'RECEIVED' | 'RECONCILIATION_PENDING' | 'RECONCILED' | 'ACTIVE'
  | 'REJECTED' | 'CANCELLED' | 'DISCREPANCY_REVIEW';

export interface EligibleReserveInventory {
  id: string;
  lot_reference: string;
  certificate_number: string | null;
  entry_date: string;
  gross_weight_grams: number;
  fine_weight_grams: number;
  fineness_percentage: number;
  quantity_available_oz: number;
  processing_location: string | null;
  refinery_id: string | null;
  refinery_name: string | null;
  mining_company_id: string | null;
  source_name: string | null;
}

export interface ReserveDepository {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  address: string | null;
  administrative_region: string | null;
  organization_type: string;
  scope_metadata: Record<string, unknown>;
}

export interface ReserveAllocationItem {
  id: string;
  allocation_id: string;
  inventory_id: string;
  lot_reference: string;
  ingot_count: number;
  gross_weight_grams: number;
  fine_weight_grams: number;
  fineness_percentage: number;
  certificate_number: string | null;
  reserved_at: string;
  released_at: string | null;
}

export interface ReserveAllocationEvent {
  id: number;
  allocation_id: string;
  event_type: string;
  status_from: ReserveAllocationStatus | null;
  status_to: ReserveAllocationStatus;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string;
  comment: string | null;
  occurred_at: string;
}

export interface ReserveAllocationDocument {
  id: string;
  allocation_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface ReserveAllocation {
  id: string;
  reference: string;
  allocation_date: string;
  status: ReserveAllocationStatus;
  reason: string | null;
  allocation_nature: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  decision_reference: string | null;
  decision_date: string | null;
  decision_authority: string | null;
  decision_department: string | null;
  decision_comment: string | null;
  control_results: Record<string, boolean>;
  depository_organization_id: string | null;
  deposit_type: string | null;
  planned_deposit_reference: string | null;
  planned_transfer_date: string | null;
  gold_price_fcfa_gram: number;
  gold_price_usd_oz?: number | null;
  gold_price_date?: string | null;
  gold_price_source?: string | null;
  usd_xof_rate: number;
  usd_xof_rate_date?: string | null;
  usd_xof_rate_source?: string | null;
  eur_xof_rate: number;
  eur_xof_rate_date?: string | null;
  eur_xof_rate_source?: string | null;
  lot_count: number;
  ingot_count: number;
  gross_weight_grams: number;
  fine_weight_grams: number;
  weighted_fineness: number;
  indicative_value_fcfa: number;
  indicative_value_usd: number;
  indicative_value_eur: number;
  valuation_source: string;
  valuation_at: string;
  valuation_frozen_at?: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator_name: string;
  depository: ReserveDepository | null;
  items: ReserveAllocationItem[];
  events: ReserveAllocationEvent[];
  documents: ReserveAllocationDocument[];
}

export interface ReserveAllocationPayload {
  allocation_date: string;
  reason: string;
  allocation_nature: string;
  priority: string;
  decision_reference: string;
  decision_date: string;
  decision_authority: string;
  decision_department: string;
  decision_comment: string;
  control_results: Record<string, boolean>;
  depository_organization_id: string;
  deposit_type: string;
  planned_deposit_reference: string;
  planned_transfer_date: string;
}

const asNumber = (value: unknown) => Number(value || 0);
const reserveActivationKeys = new Map<string, string>();

function activationStorageKey(allocationId: string) {
  return `sonasp:reserve-activation:${allocationId}`;
}

function activationRequestKey(allocationId: string): string {
  const storageKey = activationStorageKey(allocationId);
  try {
    const persisted = globalThis.sessionStorage?.getItem(storageKey);
    if (persisted) return persisted;
  } catch {
    // Le stockage peut être indisponible dans un contexte navigateur privé.
  }
  const existing = reserveActivationKeys.get(allocationId);
  if (existing) return existing;
  const created = secureRandomId();
  reserveActivationKeys.set(allocationId, created);
  try {
    globalThis.sessionStorage?.setItem(storageKey, created);
  } catch {
    // La mémoire de module conserve malgré tout la clé pendant la session.
  }
  return created;
}

function clearActivationRequestKey(allocationId: string) {
  reserveActivationKeys.delete(allocationId);
  try {
    globalThis.sessionStorage?.removeItem(activationStorageKey(allocationId));
  } catch {
    // Aucun nettoyage supplémentaire n'est nécessaire.
  }
}

function normalizeEligible(row: Record<string, unknown>): EligibleReserveInventory {
  return {
    ...(row as unknown as EligibleReserveInventory),
    gross_weight_grams: asNumber(row.gross_weight_grams),
    fine_weight_grams: asNumber(row.fine_weight_grams),
    fineness_percentage: asNumber(row.fineness_percentage),
    quantity_available_oz: asNumber(row.quantity_available_oz),
  };
}

function normalizeAllocation(
  row: Record<string, unknown>,
  organizations: Map<string, ReserveDepository>,
  profiles: Map<string, string>,
  items: ReserveAllocationItem[],
  events: ReserveAllocationEvent[],
  documents: ReserveAllocationDocument[],
): ReserveAllocation {
  const numericKeys = [
    'gold_price_fcfa_gram', 'gold_price_usd_oz', 'usd_xof_rate', 'eur_xof_rate', 'lot_count', 'ingot_count',
    'gross_weight_grams', 'fine_weight_grams', 'weighted_fineness',
    'indicative_value_fcfa', 'indicative_value_usd', 'indicative_value_eur',
  ] as const;
  const normalized = { ...row } as Record<string, unknown>;
  numericKeys.forEach((key) => { normalized[key] = asNumber(row[key]); });
  return {
    ...(normalized as unknown as ReserveAllocation),
    valuation_source: String(row.valuation_source || 'Indisponible'),
    valuation_at: String(row.valuation_at || row.updated_at || row.created_at || ''),
    creator_name: profiles.get(String(row.created_by)) || 'Utilisateur SONASP',
    depository: row.depository_organization_id
      ? organizations.get(String(row.depository_organization_id)) || null
      : null,
    items,
    events,
    documents,
  };
}

async function readAllAllocations(): Promise<ReserveAllocation[]> {
  const { data: allocationRows, error } = await db
    .from('reserve_allocations')
    .select('*')
    .order('allocation_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (allocationRows || []) as Record<string, unknown>[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => String(row.id));

  const [itemsResponse, eventsResponse, documentsResponse] = await Promise.all([
    db.from('reserve_allocation_items').select('*').in('allocation_id', ids).is('released_at', null),
    db.from('reserve_allocation_events').select('*').in('allocation_id', ids).order('occurred_at'),
    db.from('reserve_allocation_documents').select('*').in('allocation_id', ids).is('deleted_at', null).order('uploaded_at'),
  ]);
  if (itemsResponse.error) throw itemsResponse.error;
  if (eventsResponse.error) throw eventsResponse.error;
  if (documentsResponse.error) throw documentsResponse.error;

  const itemRows = (itemsResponse.data || []).map((item: Record<string, unknown>) => ({
    ...item,
    ingot_count: asNumber(item.ingot_count),
    gross_weight_grams: asNumber(item.gross_weight_grams),
    fine_weight_grams: asNumber(item.fine_weight_grams),
    fineness_percentage: asNumber(item.fineness_percentage),
  })) as ReserveAllocationItem[];
  const rawEvents = (eventsResponse.data || []) as Array<Record<string, unknown>>;
  const documents = (documentsResponse.data || []).map((document: Record<string, unknown>) => ({
    ...document,
    size_bytes: asNumber(document.size_bytes),
  })) as ReserveAllocationDocument[];

  const organizationIds = [...new Set(rows.map((row) => row.depository_organization_id).filter(Boolean).map(String))];
  const profileIds = [...new Set([
    ...rows.map((row) => row.created_by).filter(Boolean).map(String),
    ...rawEvents.map((event) => event.actor_id).filter(Boolean).map(String),
  ])];
  const [organizationsResponse, profilesResponse] = await Promise.all([
    organizationIds.length
      ? db.from('snp_organizations').select('id,code,name,short_name,address,administrative_region,organization_type,scope_metadata').in('id', organizationIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? db.from('user_profiles').select('id,full_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (organizationsResponse.error) throw organizationsResponse.error;
  if (profilesResponse.error) throw profilesResponse.error;

  const organizations = new Map<string, ReserveDepository>(
    (organizationsResponse.data || []).map((organization: ReserveDepository) => [organization.id, organization]),
  );
  const profiles = new Map<string, string>(
    (profilesResponse.data || []).map((profile: { id: string; full_name: string | null }) => [profile.id, profile.full_name || 'Utilisateur SONASP']),
  );
  const events = rawEvents.map((event) => ({
    ...event,
    actor_name: event.actor_id ? profiles.get(String(event.actor_id)) || 'Utilisateur SONASP' : 'Système',
  })) as ReserveAllocationEvent[];

  return rows.map((row) => normalizeAllocation(
    row,
    organizations,
    profiles,
    itemRows.filter((item) => item.allocation_id === row.id),
    events.filter((event) => event.allocation_id === row.id),
    documents.filter((document) => document.allocation_id === row.id),
  ));
}

export const reserveAllocationService = {
  async list(): Promise<ReserveAllocation[]> {
    return readAllAllocations();
  },

  async get(id: string): Promise<ReserveAllocation> {
    const allocation = (await readAllAllocations()).find((item) => item.id === id);
    if (!allocation) throw new Error('Affectation introuvable.');
    return allocation;
  },

  async listEligible(): Promise<EligibleReserveInventory[]> {
    const { data, error } = await db
      .from('snp_reserve_eligible_inventory')
      .select('*')
      .order('entry_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeEligible);
  },

  async listDepositories(): Promise<ReserveDepository[]> {
    const { data, error } = await db
      .from('snp_organizations')
      .select('id,code,name,short_name,address,administrative_region,organization_type,scope_metadata')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return ((data || []) as ReserveDepository[]).filter((organization) =>
      organization.scope_metadata?.is_reserve_depository === true,
    );
  },

  async saveDraft(
    id: string | null,
    payload: ReserveAllocationPayload,
    inventoryIds: string[],
  ): Promise<string> {
    const { data, error } = await db.rpc('snp_save_reserve_allocation', {
      p_allocation_id: id,
      p_payload: payload,
      p_inventory_ids: inventoryIds,
    });
    if (error) throw error;
    return String(data);
  },

  async transition(id: string, target: ReserveAllocationStatus, comment?: string): Promise<void> {
    const isActivation = target === 'ACTIVE';
    const { error } = await db.rpc(
      isActivation ? 'snp_activate_reserve_allocation' : 'snp_transition_reserve_allocation',
      isActivation
        ? {
            p_allocation_id: id,
            p_request_key: activationRequestKey(id),
            p_comment: comment || null,
          }
        : {
            p_allocation_id: id,
            p_target_status: target,
            p_comment: comment || null,
          },
    );
    if (error) throw error;
    if (isActivation) clearActivationRequestKey(id);
  },

  async uploadDocument(
    allocationId: string,
    documentType: string,
    file: File,
  ): Promise<void> {
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    if (!allowed.has(file.type)) throw new Error('Format refusé : utilisez un PDF, PNG ou JPEG.');
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) throw new Error('Le document doit peser au maximum 15 Mo.');
    await uploadSensitiveFile(
      'reserve-allocation-document',
      file,
      { fileName: file.name, allocationId, documentType },
      { mimeType: file.type },
    );
  },

  async signedDocumentUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from('reserve-documents').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  },

  async removeDocument(document: ReserveAllocationDocument): Promise<void> {
    await deleteSensitiveResource('reserve-allocation-document', document.id);
  },
};
