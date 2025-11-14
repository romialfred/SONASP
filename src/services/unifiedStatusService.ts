import { supabase } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export type ProductionStatus = 'prepared' | 'shipped' | 'cancelled';

export type ShippingStatus =
  | 'pending'
  | 'prepared'
  | 'validated_for_refinery'
  | 'in_refining'
  | 'refined'
  | 'sold'
  | 'cancelled';

export type StatusChangeContext =
  | 'production_management'
  | 'shipping_management'
  | 'refining_process'
  | 'sales_management'
  | 'inventory_management'
  | 'system';

export type EntityType = 'production' | 'shipping';

export interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  change_context: StatusChangeContext;
  changed_by: string | null;
  changed_at: string;
  action_description: string | null;
  notes: string | null;
  user_email: string | null;
  user_name: string | null;
  metadata: Record<string, any>;
}

export interface StatusChangeRequest {
  entityType: EntityType;
  entityId: string;
  newStatus: string;
  context: StatusChangeContext;
  notes?: string;
  metadata?: Record<string, any>;
}

// =====================================================
// STATUS LABELS (Français)
// =====================================================

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  prepared: 'Préparé',
  shipped: 'Expédié',
  cancelled: 'Annulé',
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  pending: 'En attente',
  prepared: 'Préparé',
  validated_for_refinery: 'Validé pour Raffinerie',
  in_refining: 'En Raffinage',
  refined: 'Raffiné',
  sold: 'Vendu',
  cancelled: 'Annulé',
};

// =====================================================
// STATUS COLORS
// =====================================================

export const PRODUCTION_STATUS_COLORS: Record<ProductionStatus, string> = {
  prepared: 'bg-blue-100 text-blue-800 border-blue-300',
  shipped: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const SHIPPING_STATUS_COLORS: Record<ShippingStatus, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-300',
  prepared: 'bg-blue-100 text-blue-800 border-blue-300',
  validated_for_refinery: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  in_refining: 'bg-purple-100 text-purple-800 border-purple-300',
  refined: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  sold: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

// =====================================================
// STATUS FLOWS (Transitions autorisées)
// =====================================================

export const PRODUCTION_STATUS_FLOW: Record<ProductionStatus, ProductionStatus[]> = {
  prepared: ['shipped', 'cancelled'],
  shipped: [], // Cannot change after shipped in production
  cancelled: [],
};

export const SHIPPING_STATUS_FLOW: Record<ShippingStatus, ShippingStatus[]> = {
  pending: ['prepared', 'cancelled'],
  prepared: ['validated_for_refinery', 'cancelled'],
  validated_for_refinery: ['in_refining', 'sold'],
  in_refining: ['refined'],
  refined: ['sold'],
  sold: [],
  cancelled: [],
};

// =====================================================
// SERVICE FUNCTIONS
// =====================================================

/**
 * Get status history for an entity (production or shipping)
 */
export async function getStatusHistory(
  entityType: EntityType,
  entityId: string
): Promise<{ success: boolean; data?: StatusHistoryEntry[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_unified_status_history', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });

    if (error) {
      console.error('Error fetching status history:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error in getStatusHistory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if status change is allowed
 */
export async function canChangeStatus(
  entityType: EntityType,
  entityId: string,
  currentStatus: string,
  newStatus: string,
  context: StatusChangeContext
): Promise<{ success: boolean; allowed?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('can_change_status', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_current_status: currentStatus,
      p_new_status: newStatus,
      p_context: context,
    });

    if (error) {
      console.error('Error checking status permission:', error);
      return { success: false, error: error.message };
    }

    return { success: true, allowed: data };
  } catch (error: any) {
    console.error('Error in canChangeStatus:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Change status of a production
 */
export async function changeProductionStatus(
  productionId: string,
  newStatus: ProductionStatus,
  context: StatusChangeContext = 'production_management',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current status first
    const { data: production, error: fetchError } = await supabase
      .from('daily_production')
      .select('status')
      .eq('id', productionId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Check if change is allowed
    const permission = await canChangeStatus(
      'production',
      productionId,
      production.status,
      newStatus,
      context
    );

    if (!permission.success || !permission.allowed) {
      return {
        success: false,
        error: 'Ce changement de statut n\'est pas autorisé dans ce contexte',
      };
    }

    // Update status
    const { error: updateError } = await supabase
      .from('daily_production')
      .update({ status: newStatus })
      .eq('id', productionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Add notes if provided (will be added via trigger)
    if (notes) {
      await supabase
        .from('unified_status_history')
        .update({ notes })
        .eq('entity_type', 'production')
        .eq('entity_id', productionId)
        .eq('new_status', newStatus)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error changing production status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Change status of a shipping
 */
export async function changeShippingStatus(
  shippingId: string,
  newStatus: ShippingStatus,
  context: StatusChangeContext = 'shipping_management',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current status first
    const { data: shipping, error: fetchError } = await supabase
      .from('shipping_preparations')
      .select('status')
      .eq('id', shippingId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Check if change is allowed
    const permission = await canChangeStatus(
      'shipping',
      shippingId,
      shipping.status,
      newStatus,
      context
    );

    if (!permission.success || !permission.allowed) {
      return {
        success: false,
        error: 'Ce changement de statut n\'est pas autorisé dans ce contexte',
      };
    }

    // Update status with timestamp fields
    const updateData: any = { status: newStatus };

    if (newStatus === 'prepared') {
      updateData.prepared_at = new Date().toISOString();
    } else if (newStatus === 'validated_for_refinery') {
      updateData.shipped_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('shipping_preparations')
      .update(updateData)
      .eq('id', shippingId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Add notes if provided
    if (notes) {
      await supabase
        .from('unified_status_history')
        .update({ notes })
        .eq('entity_type', 'shipping')
        .eq('entity_id', shippingId)
        .eq('new_status', newStatus)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error changing shipping status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get available shipments for refinery
 */
export async function getShipmentsForRefinery(): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('shipments_for_refinery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching shipments for refinery:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get available shipments for pre-sale
 */
export async function getShipmentsForPresale(): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('shipments_for_presale')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching shipments for presale:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get next available statuses for entity
 */
export function getNextStatuses(
  entityType: EntityType,
  currentStatus: string,
  context: StatusChangeContext
): string[] {
  if (entityType === 'production') {
    const prodStatus = currentStatus as ProductionStatus;

    // In production context, can only change if not shipped
    if (context === 'production_management') {
      if (prodStatus === 'shipped') {
        return []; // Cannot change once shipped
      }
      return PRODUCTION_STATUS_FLOW[prodStatus] || [];
    }

    return [];
  } else {
    const shipStatus = currentStatus as ShippingStatus;
    return SHIPPING_STATUS_FLOW[shipStatus] || [];
  }
}

/**
 * Get status label
 */
export function getStatusLabel(entityType: EntityType, status: string): string {
  if (entityType === 'production') {
    return PRODUCTION_STATUS_LABELS[status as ProductionStatus] || status;
  } else {
    return SHIPPING_STATUS_LABELS[status as ShippingStatus] || status;
  }
}

/**
 * Get status color classes
 */
export function getStatusColor(entityType: EntityType, status: string): string {
  if (entityType === 'production') {
    return PRODUCTION_STATUS_COLORS[status as ProductionStatus] || 'bg-gray-100 text-gray-800';
  } else {
    return SHIPPING_STATUS_COLORS[status as ShippingStatus] || 'bg-gray-100 text-gray-800';
  }
}
