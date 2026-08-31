import { supabase } from '@/lib/supabase';
import type { ProductionStatus as CanonicalProductionStatus } from '@/constants/productionStatuses';
import { productionStatusService } from '@/services/productionStatusService';
import type { Database, Json } from '@/types/database';

type StatusChangeContextRpc = Database['public']['Functions']['can_change_status']['Args']['p_context'];
type ShippingPreparationDbUpdate = Database['public']['Tables']['shipping_preparations']['Update'];

// =====================================================
// TYPES
// =====================================================

export type ProductionStatus = 'prepared' | 'ready_for_customs' | 'shipped' | 'cancelled';

export type ShippingStatus =
  | 'waiting_customs_approval'
  | 'approved_by_customs'
  | 'ready_for_expedition'
  | 'cancelled';

export type FreightCustomsStatus =
  | 'ready_for_expedition'
  | 'shipped_to_refinery'
  | 'cancelled';

export type RefineryStatus =
  | 'shipped_to_refinery'
  | 'refined'
  | 'cancelled';

export type InventoryStatus =
  | 'in_inventory'
  | 'reserved'
  | 'sold';

export type SaleStatus =
  | 'in_sale'
  | 'sold'
  | 'paid'
  | 'cancelled';

export type StatusChangeContext =
  | 'production_management'
  | 'shipping_management'
  | 'freight_customs_management'
  | 'refining_process'
  | 'sales_management'
  | 'inventory_management'
  | 'system';

export type EntityType = 'production' | 'shipping' | 'freight_customs' | 'refinery' | 'inventory' | 'sale';

export interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  change_context: string;
  changed_by: string | null;
  changed_at: string;
  action_description: string | null;
  notes: string | null;
  user_email: string | null;
  user_name: string | null;
  metadata: Json;
}

export interface StatusChangeRequest {
  entityType: EntityType;
  entityId: string;
  newStatus: string;
  context: StatusChangeContext;
  notes?: string;
  metadata?: Json;
}

// =====================================================
// STATUS LABELS (Français)
// =====================================================

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  prepared: 'Préparé',
  ready_for_customs: 'Prêt pour la douane',
  shipped: 'Expédié',
  cancelled: 'Annulé',
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  waiting_customs_approval: 'Waiting for Custom approval',
  approved_by_customs: 'Approved by customs',
  ready_for_expedition: 'Ready for expedition',
  cancelled: 'Annulé',
};

export const FREIGHT_CUSTOMS_STATUS_LABELS: Record<FreightCustomsStatus, string> = {
  ready_for_expedition: 'Prêt pour Expédition',
  shipped_to_refinery: 'Expédié à la raffinerie',
  cancelled: 'Annulé',
};

export const REFINERY_STATUS_LABELS: Record<RefineryStatus, string> = {
  shipped_to_refinery: 'Expédié à la raffinerie',
  refined: 'Raffinée',
  cancelled: 'Annulé',
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  in_inventory: 'En inventaire',
  reserved: 'Réservé',
  sold: 'Vendu',
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  in_sale: 'En vente',
  sold: 'Vendu',
  paid: 'Payé',
  cancelled: 'Annulé',
};

// =====================================================
// STATUS COLORS
// =====================================================

export const PRODUCTION_STATUS_COLORS: Record<ProductionStatus, string> = {
  prepared: 'bg-blue-100 text-blue-800 border-blue-300',
  ready_for_customs: 'bg-amber-100 text-amber-800 border-amber-300',
  shipped: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const SHIPPING_STATUS_COLORS: Record<ShippingStatus, string> = {
  waiting_customs_approval: 'bg-slate-100 text-slate-800 border-slate-300',
  approved_by_customs: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ready_for_expedition: 'bg-blue-100 text-blue-800 border-blue-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const FREIGHT_CUSTOMS_STATUS_COLORS: Record<FreightCustomsStatus, string> = {
  ready_for_expedition: 'bg-blue-100 text-blue-800 border-blue-300',
  shipped_to_refinery: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const REFINERY_STATUS_COLORS: Record<RefineryStatus, string> = {
  shipped_to_refinery: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  refined: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const INVENTORY_STATUS_COLORS: Record<InventoryStatus, string> = {
  in_inventory: 'bg-slate-100 text-slate-800 border-slate-300',
  reserved: 'bg-amber-100 text-amber-800 border-amber-300',
  sold: 'bg-green-100 text-green-800 border-green-300',
};

export const SALE_STATUS_COLORS: Record<SaleStatus, string> = {
  in_sale: 'bg-amber-100 text-amber-800 border-amber-300',
  sold: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

// =====================================================
// STATUS FLOWS (Transitions autorisées)
// =====================================================

export const PRODUCTION_STATUS_FLOW: Record<ProductionStatus, ProductionStatus[]> = {
  prepared: ['ready_for_customs', 'cancelled'],
  ready_for_customs: ['shipped'],
  shipped: [], // Cannot change after shipped in production
  cancelled: [],
};

export const SHIPPING_STATUS_FLOW: Record<ShippingStatus, ShippingStatus[]> = {
  waiting_customs_approval: ['approved_by_customs', 'cancelled'],
  approved_by_customs: ['ready_for_expedition', 'cancelled'],
  ready_for_expedition: [],
  cancelled: [],
};

export const FREIGHT_CUSTOMS_STATUS_FLOW: Record<FreightCustomsStatus, FreightCustomsStatus[]> = {
  ready_for_expedition: ['shipped_to_refinery'],
  shipped_to_refinery: [],
  cancelled: [],
};

export const REFINERY_STATUS_FLOW: Record<RefineryStatus, RefineryStatus[]> = {
  shipped_to_refinery: ['refined'],
  refined: [],
  cancelled: [],
};

export const INVENTORY_STATUS_FLOW: Record<InventoryStatus, InventoryStatus[]> = {
  in_inventory: ['reserved', 'sold'],
  reserved: ['sold', 'in_inventory'],
  sold: [],
};

export const SALE_STATUS_FLOW: Record<SaleStatus, SaleStatus[]> = {
  in_sale: ['sold', 'cancelled'],
  sold: ['paid'],
  paid: [],
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
      p_context: context as StatusChangeContextRpc,
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

    await productionStatusService.updateStatus(
      productionId,
      newStatus as CanonicalProductionStatus,
      notes,
      { expectedStatus: production.status as CanonicalProductionStatus },
    );

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
    const updateData = { status: newStatus } as ShippingPreparationDbUpdate;

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
    if (context === 'production_management') {
      if (prodStatus === 'shipped') {
        return [];
      }
      return PRODUCTION_STATUS_FLOW[prodStatus] || [];
    }
    return [];
  } else if (entityType === 'shipping') {
    const shipStatus = currentStatus as ShippingStatus;
    return SHIPPING_STATUS_FLOW[shipStatus] || [];
  } else if (entityType === 'freight_customs') {
    const freightStatus = currentStatus as FreightCustomsStatus;
    return FREIGHT_CUSTOMS_STATUS_FLOW[freightStatus] || [];
  } else if (entityType === 'refinery') {
    const refineryStatus = currentStatus as RefineryStatus;
    return REFINERY_STATUS_FLOW[refineryStatus] || [];
  } else if (entityType === 'inventory') {
    const inventoryStatus = currentStatus as InventoryStatus;
    return INVENTORY_STATUS_FLOW[inventoryStatus] || [];
  } else if (entityType === 'sale') {
    const saleStatus = currentStatus as SaleStatus;
    return SALE_STATUS_FLOW[saleStatus] || [];
  }
  return [];
}

/**
 * Get status label
 */
export function getStatusLabel(entityType: EntityType, status: string): string {
  if (entityType === 'production') {
    return PRODUCTION_STATUS_LABELS[status as ProductionStatus] || status;
  } else if (entityType === 'shipping') {
    return SHIPPING_STATUS_LABELS[status as ShippingStatus] || status;
  } else if (entityType === 'freight_customs') {
    return FREIGHT_CUSTOMS_STATUS_LABELS[status as FreightCustomsStatus] || status;
  } else if (entityType === 'refinery') {
    return REFINERY_STATUS_LABELS[status as RefineryStatus] || status;
  } else if (entityType === 'inventory') {
    return INVENTORY_STATUS_LABELS[status as InventoryStatus] || status;
  } else if (entityType === 'sale') {
    return SALE_STATUS_LABELS[status as SaleStatus] || status;
  }
  return status;
}

/**
 * Get status color classes
 */
export function getStatusColor(entityType: EntityType, status: string): string {
  if (entityType === 'production') {
    return PRODUCTION_STATUS_COLORS[status as ProductionStatus] || 'bg-gray-100 text-gray-800';
  } else if (entityType === 'shipping') {
    return SHIPPING_STATUS_COLORS[status as ShippingStatus] || 'bg-gray-100 text-gray-800';
  } else if (entityType === 'freight_customs') {
    return FREIGHT_CUSTOMS_STATUS_COLORS[status as FreightCustomsStatus] || 'bg-gray-100 text-gray-800';
  } else if (entityType === 'refinery') {
    return REFINERY_STATUS_COLORS[status as RefineryStatus] || 'bg-gray-100 text-gray-800';
  } else if (entityType === 'inventory') {
    return INVENTORY_STATUS_COLORS[status as InventoryStatus] || 'bg-gray-100 text-gray-800';
  } else if (entityType === 'sale') {
    return SALE_STATUS_COLORS[status as SaleStatus] || 'bg-gray-100 text-gray-800';
  }
  return 'bg-gray-100 text-gray-800';
}
