import { supabase } from '@/lib/supabase';
import { ProductionStatus, canTransitionTo } from '@/constants/productionStatuses';

export interface StatusHistoryEntry {
  id: string;
  production_id: string;
  old_status: ProductionStatus | null;
  new_status: ProductionStatus;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  user_email?: string;
}

class ProductionStatusService {
  async updateStatus(
    productionId: string,
    newStatus: ProductionStatus,
    notes?: string
  ): Promise<void> {
    try {
      const { data: production, error: fetchError } = await supabase
        .from('daily_production')
        .select('status')
        .eq('id', productionId)
        .single();

      if (fetchError) throw fetchError;

      if (!canTransitionTo(production.status as ProductionStatus, newStatus)) {
        throw new Error(
          `Transition de statut non autorisée: ${production.status} → ${newStatus}`
        );
      }

      const { error: updateError } = await supabase
        .from('daily_production')
        .update({ status: newStatus })
        .eq('id', productionId);

      if (updateError) throw updateError;

      if (notes) {
        const { data: history } = await supabase
          .from('production_status_history')
          .select('id')
          .eq('production_id', productionId)
          .eq('new_status', newStatus)
          .order('changed_at', { ascending: false })
          .limit(1)
          .single();

        if (history) {
          await supabase
            .from('production_status_history')
            .update({ notes })
            .eq('id', history.id);
        }
      }
    } catch (error: any) {
      console.error('Error updating production status:', error);
      throw new Error(error.message || 'Erreur lors de la mise à jour du statut');
    }
  }

  async getStatusHistory(productionId: string): Promise<StatusHistoryEntry[]> {
    try {
      const { data, error } = await supabase.rpc('get_production_status_history', {
        prod_id: productionId
      });

      if (error) {
        console.error('Error fetching status history:', error);
        // Return empty array instead of throwing to prevent UI breakage
        return [];
      }

      return (data || []) as StatusHistoryEntry[];
    } catch (error: any) {
      console.error('Error fetching status history:', error);
      // Return empty array instead of throwing to prevent UI breakage
      return [];
    }
  }

  async getProductionsByStatus(status?: ProductionStatus, miningCompanyId?: string) {
    try {
      let query = supabase
        .from('daily_production')
        .select('*')
        .order('production_date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (miningCompanyId) {
        query = query.eq('mining_company_id', miningCompanyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching productions by status:', error);
      throw new Error(error.message || 'Erreur lors du chargement des productions');
    }
  }

  async getStatusCounts(miningCompanyId?: string) {
    try {
      let query = supabase
        .from('daily_production')
        .select('status', { count: 'exact' });

      if (miningCompanyId) {
        query = query.eq('mining_company_id', miningCompanyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const counts: Record<ProductionStatus, number> = {
        prepared: 0,
        shipped: 0,
        refined: 0,
        sold: 0
      };

      if (data) {
        data.forEach((item: any) => {
          if (item.status in counts) {
            counts[item.status as ProductionStatus]++;
          }
        });
      }

      return counts;
    } catch (error: any) {
      console.error('Error fetching status counts:', error);
      return {
        prepared: 0,
        shipped: 0,
        refined: 0,
        sold: 0
      };
    }
  }
}

export const productionStatusService = new ProductionStatusService();
