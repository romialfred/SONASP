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

export interface ProductionStatusTransitionResult {
  production_id: string;
  previous_status: ProductionStatus;
  status: ProductionStatus;
  request_id: string;
  audit_id: number;
  idempotent_replay: boolean;
}

interface ProductionStatusRpcError {
  code?: string;
  message?: string;
}

export class ProductionStatusConflictError extends Error {
  constructor() {
    super('Le statut de cette production a changé entre-temps. Actualisez le dossier avant de réessayer.');
    this.name = 'ProductionStatusConflictError';
  }
}

export function createProductionTransitionRequestId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Le navigateur ne fournit pas de générateur UUID sécurisé.');
  }
  return globalThis.crypto.randomUUID();
}

const productionTransitionRpc = supabase as unknown as {
  rpc(
    functionName: 'snp_transition_daily_production',
    parameters: {
      p_production_id: string;
      p_expected_status: ProductionStatus;
      p_new_status: ProductionStatus;
      p_request_id: string;
      p_notes: string | null;
    },
  ): PromiseLike<{
    data: ProductionStatusTransitionResult | null;
    error: ProductionStatusRpcError | null;
  }>;
};

function isOptimisticConflict(error: ProductionStatusRpcError): boolean {
  return error.code === '40001' || error.message?.includes('Conflit optimiste') === true;
}

class ProductionStatusService {
  async updateStatus(
    productionId: string,
    newStatus: ProductionStatus,
    notes?: string,
    options: {
      expectedStatus?: ProductionStatus;
      requestId?: string;
    } = {},
  ): Promise<ProductionStatusTransitionResult> {
    try {
      let expectedStatus = options.expectedStatus;
      if (!expectedStatus) {
        const { data: production, error: fetchError } = await supabase
          .from('daily_production')
          .select('status')
          .eq('id', productionId)
          .single();

        if (fetchError) throw fetchError;
        expectedStatus = production.status as ProductionStatus;
      }

      if (!canTransitionTo(expectedStatus, newStatus)) {
        throw new Error(
          `Transition de statut non autorisée: ${expectedStatus} → ${newStatus}`
        );
      }

      const { data, error } = await productionTransitionRpc.rpc(
        'snp_transition_daily_production',
        {
          p_production_id: productionId,
          p_expected_status: expectedStatus,
          p_new_status: newStatus,
          p_request_id: options.requestId || createProductionTransitionRequestId(),
          p_notes: notes?.trim() || null,
        },
      );

      if (error) {
        if (isOptimisticConflict(error)) throw new ProductionStatusConflictError();
        throw error;
      }

      if (!data?.status || data.status !== newStatus) {
        throw new Error('Le serveur n’a pas confirmé le nouveau statut de la production.');
      }
      return data;
    } catch (error: any) {
      console.error('Error updating production status:', error);
      if (error?.message) throw error;
      throw new Error('Erreur lors de la mise à jour du statut');
    }
  }

  async getStatusHistory(productionId: string): Promise<StatusHistoryEntry[]> {
    try {
      const { data, error } = await supabase
        .from('unified_status_history')
        .select(`
          id,
          entity_id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          notes,
          profiles:changed_by(email)
        `)
        .eq('entity_type', 'production')
        .eq('entity_id', productionId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching status history:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        production_id: item.entity_id,
        old_status: item.old_status,
        new_status: item.new_status,
        changed_by: item.changed_by,
        changed_at: item.changed_at,
        notes: item.notes,
        user_email: item.profiles?.email
      }));
    } catch (error: any) {
      console.error('Error fetching status history:', error);
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
        ready_for_customs: 0,
        cancelled: 0
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
        ready_for_customs: 0,
        cancelled: 0
      };
    }
  }
}

export const productionStatusService = new ProductionStatusService();
