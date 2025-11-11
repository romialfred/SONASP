export type ProductionStatus = 'prepared' | 'shipped' | 'refined' | 'sold';

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
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Production expédiée vers la raffinerie'
  },
  refined: {
    label: 'Raffiné',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Production raffinée et prête pour la vente'
  },
  sold: {
    label: 'Vendu',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Production vendue au client'
  }
};

export const STATUS_FLOW: ProductionStatus[] = ['prepared', 'shipped', 'refined', 'sold'];

export const NEXT_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  prepared: 'shipped',
  shipped: 'refined',
  refined: 'sold',
  sold: null
};

export const PREVIOUS_STATUS: Record<ProductionStatus, ProductionStatus | null> = {
  prepared: null,
  shipped: 'prepared',
  refined: 'shipped',
  sold: 'refined'
};

export function canTransitionTo(currentStatus: ProductionStatus, targetStatus: ProductionStatus): boolean {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const targetIndex = STATUS_FLOW.indexOf(targetStatus);

  return targetIndex > currentIndex && targetIndex <= currentIndex + 1;
}

export function getNextAllowedStatus(currentStatus: ProductionStatus): ProductionStatus | null {
  return NEXT_STATUS[currentStatus];
}
