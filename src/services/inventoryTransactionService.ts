import { supabase } from '@/lib/supabase';

export interface InventoryTransaction {
  id?: string;
  transaction_type: 'entry' | 'exit' | 'adjustment' | 'sale';
  entity_type: 'mining_company' | 'customer' | 'refinery';
  entity_id: string;
  quantity_oz: number;
  quantity_grams: number;
  reference_type?: 'sale' | 'purchase' | 'production' | 'refining';
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

/**
 * Create inventory transactions for a sale
 * - Exit transaction for the seller (mine)
 * - Entry transaction for the buyer (customer)
 */
export async function createSaleInventoryTransactions(
  saleId: string,
  sellerId: string,
  sellerType: 'mining_company' | 'customer',
  customerId: string,
  quantityOz: number,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const quantityGrams = quantityOz * 31.1034768;

    const transactions: InventoryTransaction[] = [
      {
        transaction_type: 'exit',
        entity_type: sellerType,
        entity_id: sellerId,
        quantity_oz: -Math.abs(quantityOz),
        quantity_grams: -Math.abs(quantityGrams),
        reference_type: 'sale',
        reference_id: saleId,
        notes: `Stock exit for sale ${saleId}`,
        created_by: userId
      },
      {
        transaction_type: 'entry',
        entity_type: 'customer',
        entity_id: customerId,
        quantity_oz: Math.abs(quantityOz),
        quantity_grams: Math.abs(quantityGrams),
        reference_type: 'purchase',
        reference_id: saleId,
        notes: `Stock entry from sale ${saleId}`,
        created_by: userId
      }
    ];

    const { error } = await supabase
      .from('inventory_transactions')
      .insert(transactions);

    if (error) {
      console.error('Error creating inventory transactions:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in createSaleInventoryTransactions:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Get inventory balance for an entity
 */
export async function getEntityInventoryBalance(
  entityId: string,
  entityType: 'mining_company' | 'customer' | 'refinery'
): Promise<{ oz: number; grams: number } | null> {
  try {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('quantity_oz, quantity_grams')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType);

    if (error) {
      console.error('Error fetching inventory balance:', error);
      return null;
    }

    const totalOz = (data || []).reduce((sum, t) => sum + (t.quantity_oz || 0), 0);
    const totalGrams = (data || []).reduce((sum, t) => sum + (t.quantity_grams || 0), 0);

    return { oz: totalOz, grams: totalGrams };
  } catch (error) {
    console.error('Error in getEntityInventoryBalance:', error);
    return null;
  }
}

/**
 * Get transaction history for an entity
 */
export async function getEntityTransactionHistory(
  entityId: string,
  entityType: 'mining_company' | 'customer' | 'refinery',
  limit: number = 50
): Promise<InventoryTransaction[] | null> {
  try {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transaction history:', error);
      return null;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEntityTransactionHistory:', error);
    return null;
  }
}

/**
 * Validate sufficient inventory before sale
 */
export async function validateInventoryForSale(
  sellerId: string,
  sellerType: 'mining_company' | 'customer',
  requestedOz: number
): Promise<{ valid: boolean; availableOz: number; message?: string }> {
  try {
    const balance = await getEntityInventoryBalance(sellerId, sellerType);

    if (!balance) {
      return {
        valid: false,
        availableOz: 0,
        message: 'Unable to fetch inventory balance'
      };
    }

    if (balance.oz < requestedOz) {
      return {
        valid: false,
        availableOz: balance.oz,
        message: `Insufficient inventory. Available: ${balance.oz.toFixed(2)} oz, Requested: ${requestedOz.toFixed(2)} oz`
      };
    }

    return {
      valid: true,
      availableOz: balance.oz
    };
  } catch (error) {
    console.error('Error in validateInventoryForSale:', error);
    return {
      valid: false,
      availableOz: 0,
      message: 'Error validating inventory'
    };
  }
}
