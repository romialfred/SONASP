/**
 * ENUM production_status_v2 défini dans la base de données
 * Source: supabase/migrations/20251114_004_correct_status_enums_verified.sql
 *
 * Valeurs autorisées (SHIPPED RETIRÉ):
 * - prepared: Préparé
 * - ready_for_customs: Prêt pour la Douane
 * - cancelled: Annulé
 */
export type ProductionStatus = 'prepared' | 'ready_for_customs' | 'cancelled';

export const PRODUCTION_STATUSES: Record<ProductionStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  prepared: {
    label: 'Préparé',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Production créée et en attente de validation'
  },
  ready_for_customs: {
    label: 'Prêt pour la Douane',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Production validée et prête pour inclusion dans une expédition'
  },
  cancelled: {
    label: 'Annulé',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Production annulée'
  }
};

export const STATUS_FLOW: ProductionStatus[] = ['prepared', 'ready_for_customs'];

export const NEXT_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  prepared: 'ready_for_customs',
  ready_for_customs: null,
  cancelled: null
};

export const PREVIOUS_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  prepared: null,
  ready_for_customs: 'prepared',
  cancelled: null
};

export function canTransitionTo(currentStatus: ProductionStatus, targetStatus: ProductionStatus): boolean {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const targetIndex = STATUS_FLOW.indexOf(targetStatus);

  return targetIndex > currentIndex && targetIndex <= currentIndex + 1;
}

export function getNextAllowedStatus(currentStatus: ProductionStatus): ProductionStatus | null {
  return NEXT_STATUS[currentStatus];
}
