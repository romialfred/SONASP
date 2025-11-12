export type ProductionStatus = 'prepared' | 'shipped' | 'cancelled';

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
    description: 'Production créée et prête pour expédition'
  },
  shipped: {
    label: 'Expédié',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Production expédiée vers la raffinerie - Statut final du module Production'
  },
  cancelled: {
    label: 'Annulé',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Production annulée'
  }
};

export const STATUS_FLOW: ProductionStatus[] = ['prepared', 'shipped'];

export const NEXT_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  prepared: 'shipped',
  shipped: null,
  cancelled: null
};

export const PREVIOUS_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  prepared: null,
  shipped: 'prepared',
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
