import { supabase } from '@/lib/supabase';
import { ShippingStatus } from '@/constants/shippingStatuses';

export interface ShippingStatusHistoryEntry {
  id: string;
  shipping_preparation_id: string;
  old_status: ShippingStatus | null;
  new_status: ShippingStatus;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  user_email?: string;
}

class ShippingStatusService {
  async getStatusHistory(shippingId: string): Promise<ShippingStatusHistoryEntry[]> {
    const { data, error } = await supabase
      .from('shipping_status_history')
      .select(`
        *,
        user:users!shipping_status_history_changed_by_fkey(email)
      `)
      .eq('shipping_preparation_id', shippingId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching shipping status history:', error);
      throw error;
    }

    return (data || []).map(entry => ({
      ...entry,
      user_email: entry.user?.email || 'Système',
    }));
  }

  async changeStatus(
    shippingId: string,
    oldStatus: ShippingStatus | null,
    newStatus: ShippingStatus,
    userId: string,
    notes?: string
  ): Promise<void> {
    const { error: updateError } = await supabase
      .from('shipping_preparations')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shippingId);

    if (updateError) {
      console.error('Error updating shipping status:', updateError);
      throw updateError;
    }

    const { error: historyError } = await supabase
      .from('shipping_status_history')
      .insert({
        shipping_preparation_id: shippingId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: userId,
        notes: notes || null,
        changed_at: new Date().toISOString(),
      });

    if (historyError) {
      console.error('Error creating shipping status history:', historyError);
      throw historyError;
    }
  }

  async getCurrentStatus(shippingId: string): Promise<ShippingStatus | null> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select('status')
      .eq('id', shippingId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current shipping status:', error);
      throw error;
    }

    return data?.status as ShippingStatus || null;
  }
}

export const shippingStatusService = new ShippingStatusService();
