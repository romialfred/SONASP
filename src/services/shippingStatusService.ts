import { supabase } from '@/lib/supabase';
import { ShippingStatus } from '@/constants/shippingStatuses';
import {
  validateTransition,
  WorkflowModule,
} from '@/services/statusTransitionControlService';

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

export class ShippingStatusConflictError extends Error {
  constructor() {
    super('Le statut de cette expédition a été modifié entre-temps. Actualisez la fiche avant de réessayer.');
    this.name = 'ShippingStatusConflictError';
  }
}

interface ShippingStatusTransitionResult {
  status: ShippingStatus;
  previous_status: ShippingStatus;
}

interface ShippingStatusRpcError {
  code?: string;
  message?: string;
}

const shippingRpcClient = supabase as unknown as {
  rpc(
    functionName: 'snp_transition_shipping_preparation',
    parameters: {
      p_shipping_id: string;
      p_expected_status: ShippingStatus;
      p_new_status: ShippingStatus;
    },
  ): PromiseLike<{
    data: ShippingStatusTransitionResult | null;
    error: ShippingStatusRpcError | null;
  }>;
};

function isOptimisticConflict(error: ShippingStatusRpcError): boolean {
  return error.code === '40001' || error.message?.includes('Conflit optimiste') === true;
}

class ShippingStatusService {
  async changeStatus(
    shippingId: string,
    oldStatus: ShippingStatus,
    newStatus: ShippingStatus,
  ): Promise<ShippingStatus> {
    validateTransition(
      WorkflowModule.SHIPPING_PREPARATION,
      oldStatus,
      newStatus,
    );

    const { data, error: transitionError } = await shippingRpcClient.rpc(
      'snp_transition_shipping_preparation',
      {
        p_shipping_id: shippingId,
        p_expected_status: oldStatus,
        p_new_status: newStatus,
      },
    );

    if (transitionError) {
      if (isOptimisticConflict(transitionError)) {
        throw new ShippingStatusConflictError();
      }
      console.error('Erreur lors de la transition du statut d’expédition :', transitionError);
      throw transitionError;
    }

    if (!data?.status) {
      throw new Error('Le serveur n’a pas confirmé le nouveau statut de l’expédition.');
    }

    return data.status;
  }

  async getCurrentStatus(shippingId: string): Promise<ShippingStatus | null> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select('status')
      .eq('id', shippingId)
      .maybeSingle();

    if (error) {
      console.error('Erreur lors de la récupération du statut actuel de l’expédition :', error);
      throw error;
    }

    return data?.status as ShippingStatus || null;
  }
}

export const shippingStatusService = new ShippingStatusService();
