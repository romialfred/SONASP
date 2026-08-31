/**
 * API historique de mouvements par entité.
 *
 * Le schéma canonique journalise les mouvements par `inventory_id`; il ne
 * possède pas les anciennes colonnes `entity_type`, `entity_id`,
 * `reference_type` et `reference_id`. Une écriture cliente dans ce grand
 * livre contournerait aussi les RPC transactionnelles. Ces points d'entrée
 * conservés pour compatibilité échouent donc explicitement et sans mutation.
 */

export interface InventoryTransaction {
  id?: string;
  transaction_type: 'entry' | 'exit' | 'allocation' | 'deallocation' | 'adjustment';
  inventory_id: string;
  freight_shipment_id?: string | null;
  sale_id?: string | null;
  quantity_oz: number;
  quantity_grams?: number | null;
  balance_before_oz: number;
  balance_after_oz: number;
  transaction_reference?: string | null;
  notes?: string | null;
  created_by?: string;
  created_at?: string | null;
}

const RETIRED_MESSAGE =
  'Ce workflow historique est désactivé. Utilisez la création atomique de vente et ses lots de traçabilité.';

export async function createSaleInventoryTransactions(
  _saleId: string,
  _sellerId: string,
  _sellerType: 'mining_company' | 'customer',
  _customerId: string,
  _quantityOz: number,
  _userId?: string,
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: RETIRED_MESSAGE };
}

export async function getEntityInventoryBalance(
  _entityId: string,
  _entityType: 'mining_company' | 'customer' | 'refinery',
): Promise<{ oz: number; grams: number } | null> {
  return null;
}

export async function getEntityTransactionHistory(
  _entityId: string,
  _entityType: 'mining_company' | 'customer' | 'refinery',
  _limit = 50,
): Promise<InventoryTransaction[] | null> {
  return [];
}

export async function validateInventoryForSale(
  _sellerId: string,
  _sellerType: 'mining_company' | 'customer',
  _requestedOz: number,
): Promise<{ valid: boolean; availableOz: number; message?: string }> {
  return { valid: false, availableOz: 0, message: RETIRED_MESSAGE };
}
