import { supabase } from '@/lib/supabase';

export interface GoldInventoryEntry {
  id?: string;
  entry_date: string;
  freight_shipment_id?: string;
  refining_record_id?: string;
  weight_before_melting_grams: number;
  weight_after_melting_grams: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  final_fine_grams?: number;
  final_fine_oz?: number;
  variance_with_export_invoice_oz?: number;
  quantity_available_oz?: number;
  quantity_allocated_oz?: number;
  quantity_sold_oz?: number;
  transaction_type: 'entry' | 'exit';
  sale_id?: string;
  notes?: string;
  processing_location?: string;
  certificate_number?: string;
}

export interface InventoryTransaction {
  id: string;
  transaction_date: string;
  transaction_type: 'entry' | 'exit' | 'allocation' | 'deallocation' | 'adjustment';
  inventory_id: string;
  freight_shipment_id?: string;
  sale_id?: string;
  quantity_oz: number;
  quantity_grams?: number;
  balance_before_oz: number;
  balance_after_oz: number;
  transaction_reference?: string;
  notes?: string;
  created_by: string;
}

export interface MonthlyInventorySummary {
  month: string;
  total_entries: number;
  total_shipments: number;
  total_entries_oz: number;
  total_exits_oz: number;
  available_stock_oz: number;
  allocated_stock_oz: number;
  sold_stock_oz: number;
  avg_fineness_percentage: number;
  avg_metal_retained_percentage: number;
}

export async function addInventoryEntry(entry: GoldInventoryEntry) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const inventoryData = {
      ...entry,
      transaction_type: 'entry',
      created_by: user.id
    };

    const { data, error } = await supabase
      .from('gold_inventory')
      .insert(inventoryData)
      .select()
      .single();

    if (error) throw error;

    // Update freight shipment status to 'in_inventory' or another appropriate status
    if (entry.freight_shipment_id) {
      const { error: shipmentUpdateError } = await supabase
        .from('freight_shipments')
        .update({
          status: 'in_stock',
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.freight_shipment_id);

      if (shipmentUpdateError) console.error('Error updating shipment status:', shipmentUpdateError);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error adding inventory entry:', error);
    return { success: false, error };
  }
}

export async function getInventoryBalance() {
  try {
    const { data, error } = await supabase.rpc('get_available_inventory_balance');

    if (error) throw error;

    return { success: true, balance: data || 0 };
  } catch (error) {
    console.error('Error getting inventory balance:', error);
    return { success: false, balance: 0, error };
  }
}

export async function getAllInventoryEntries(filters?: {
  startDate?: string;
  endDate?: string;
  transactionType?: 'entry' | 'exit';
  batchId?: string;
}) {
  try {
    let query = supabase
      .from('gold_inventory')
      .select(`
        *,
        batch:batches(batch_number, metal_type),
        refining_record:refining_records(id),
        sale:sales(sale_number),
        creator:user_profiles!gold_inventory_created_by_fkey(full_name)
      `)
      .order('entry_date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('entry_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('entry_date', filters.endDate);
    }

    if (filters?.transactionType) {
      query = query.eq('transaction_type', filters.transactionType);
    }

    if (filters?.batchId) {
      query = query.eq('batch_id', filters.batchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching inventory entries:', error);
    return { success: false, data: [], error };
  }
}

export async function getCurrentInventoryStatus() {
  try {
    const { data, error } = await supabase
      .from('current_inventory_status')
      .select('*')
      .order('entry_date', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching current inventory status:', error);
    return { success: false, data: [], error };
  }
}

export async function getMonthlyInventorySummary() {
  try {
    const { data, error } = await supabase
      .from('monthly_inventory_summary')
      .select('*')
      .order('month', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return { success: false, data: [], error };
  }
}

export async function getInventoryTransactions(inventoryId?: string) {
  try {
    let query = supabase
      .from('inventory_transactions')
      .select(`
        *,
        inventory:gold_inventory(id, batch_id),
        batch:batches(batch_number),
        sale:sales(sale_number),
        creator:user_profiles!inventory_transactions_created_by_fkey(full_name)
      `)
      .order('transaction_date', { ascending: false });

    if (inventoryId) {
      query = query.eq('inventory_id', inventoryId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching inventory transactions:', error);
    return { success: false, data: [], error };
  }
}

export async function allocateInventoryToSale(saleId: string, quantityOz: number) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('allocate_inventory_to_sale', {
      p_sale_id: saleId,
      p_quantity_oz: quantityOz,
      p_user_id: user.id
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error allocating inventory to sale:', error);
    return { success: false, error };
  }
}

export async function releaseInventoryAllocation(saleId: string) {
  try {
    const { error } = await supabase.rpc('release_inventory_allocation', {
      p_sale_id: saleId
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error releasing inventory allocation:', error);
    return { success: false, error };
  }
}

export async function completeInventorySale(saleId: string) {
  try {
    const { error } = await supabase.rpc('complete_inventory_sale', {
      p_sale_id: saleId
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error completing inventory sale:', error);
    return { success: false, error };
  }
}

export async function checkInventorySufficient(quantityOz: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_inventory_sufficient', {
      p_quantity_oz: quantityOz
    });

    if (error) throw error;

    return data === true;
  } catch (error) {
    console.error('Error checking inventory sufficiency:', error);
    return false;
  }
}

export async function getInventoryForBatch(batchId: string) {
  try {
    const { data, error } = await supabase
      .from('gold_inventory')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching inventory for batch:', error);
    return { success: false, data: null, error };
  }
}

export async function calculateInventoryMetrics() {
  try {
    const { data: inventoryData, error } = await supabase
      .from('gold_inventory')
      .select('quantity_available_oz, quantity_allocated_oz, quantity_sold_oz, final_fine_oz')
      .eq('transaction_type', 'entry');

    if (error) throw error;

    const metrics = (inventoryData || []).reduce(
      (acc, item) => ({
        totalStock: acc.totalStock + (item.final_fine_oz || 0),
        availableStock: acc.availableStock + (item.quantity_available_oz || 0),
        allocatedStock: acc.allocatedStock + (item.quantity_allocated_oz || 0),
        soldStock: acc.soldStock + (item.quantity_sold_oz || 0)
      }),
      { totalStock: 0, availableStock: 0, allocatedStock: 0, soldStock: 0 }
    );

    return { success: true, metrics };
  } catch (error) {
    console.error('Error calculating inventory metrics:', error);
    return {
      success: false,
      metrics: { totalStock: 0, availableStock: 0, allocatedStock: 0, soldStock: 0 },
      error
    };
  }
}

export async function getInventoryBySeller(sellerId: string, sellerType: 'mining_company' | 'mansa') {
  try {
    if (sellerType === 'mining_company') {
      const { data, error } = await supabase
        .from('gold_inventory')
        .select(`
          quantity_available_oz,
          quantity_allocated_oz,
          quantity_sold_oz,
          final_fine_oz,
          final_fine_grams,
          batch:batches!inner(
            id,
            batch_number,
            mining_company_id
          )
        `)
        .eq('transaction_type', 'entry')
        .eq('batch.mining_company_id', sellerId);

      if (error) throw error;

      const totalAvailableOz = (data || []).reduce((sum, item) => sum + (item.quantity_available_oz || 0), 0);
      const totalAvailableGrams = (data || []).reduce((sum, item) => sum + (item.final_fine_grams || 0) * (item.quantity_available_oz || 0) / (item.final_fine_oz || 1), 0);

      return {
        success: true,
        availableOz: totalAvailableOz,
        availableGrams: totalAvailableGrams
      };
    } else {
      const { data, error } = await supabase
        .from('gold_inventory')
        .select('quantity_available_oz, final_fine_grams, final_fine_oz')
        .eq('transaction_type', 'entry');

      if (error) throw error;

      const totalAvailableOz = (data || []).reduce((sum, item) => sum + (item.quantity_available_oz || 0), 0);
      const totalAvailableGrams = (data || []).reduce((sum, item) => sum + (item.final_fine_grams || 0) * (item.quantity_available_oz || 0) / (item.final_fine_oz || 1), 0);

      return {
        success: true,
        availableOz: totalAvailableOz,
        availableGrams: totalAvailableGrams
      };
    }
  } catch (error) {
    console.error('Error fetching inventory by seller:', error);
    return {
      success: false,
      availableOz: 0,
      availableGrams: 0,
      error
    };
  }
}
