/**
 * Statuts Unifiés du Workflow Complet
 *
 * Ce fichier définit TOUS les statuts possibles dans le système,
 * du début (Production) jusqu'à la fin (Vente/Paiement)
 */

export type UnifiedStatus =
  // Phase Production
  | 'prepared'
  | 'ready_for_customs'

  // Phase Shipping Preparation
  | 'customs_approved'
  | 'ready_for_expedition'

  // Phase Freight & Customs
  | 'shipped_to_refinery'

  // Phase Refinery
  | 'refined'

  // Phase Inventory
  | 'in_inventory'

  // Phase Sale
  | 'sold'
  | 'paid'

  // État d'exception
  | 'cancelled';

/**
 * Configuration visuelle et descriptive de chaque statut
 */
export const UNIFIED_STATUS_CONFIG: Record<UnifiedStatus, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  icon: string;
  phase: string;
}> = {
  // PHASE PRODUCTION
  prepared: {
    label: 'Préparé',
    shortLabel: 'Préparé',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Production créée et en attente de validation',
    icon: '📦',
    phase: 'Production'
  },
  ready_for_customs: {
    label: 'Prêt pour la Douane',
    shortLabel: 'Prêt Douane',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Production validée, en attente d\'approbation douanière',
    icon: '📋',
    phase: 'Production → Shipping'
  },

  // PHASE SHIPPING PREPARATION
  customs_approved: {
    label: 'Approuvé par la Douane',
    shortLabel: 'Douane OK',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Documents douaniers approuvés',
    icon: '✓',
    phase: 'Shipping Preparation'
  },
  ready_for_expedition: {
    label: 'Prêt pour Expédition',
    shortLabel: 'Prêt Envoi',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Prêt à être expédié vers la raffinerie',
    icon: '🚚',
    phase: 'Shipping Preparation'
  },

  // PHASE FREIGHT & CUSTOMS
  shipped_to_refinery: {
    label: 'Expédié à la Raffinerie',
    shortLabel: 'Expédié',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    description: 'En transit vers la raffinerie',
    icon: '✈️',
    phase: 'Freight & Customs'
  },

  // PHASE REFINERY
  refined: {
    label: 'Raffinage Terminé',
    shortLabel: 'Raffiné',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Or raffiné et prêt pour stockage',
    icon: '⚗️',
    phase: 'Refinery'
  },

  // PHASE INVENTORY
  in_inventory: {
    label: 'En Inventaire',
    shortLabel: 'Stock',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Or raffiné en stock',
    icon: '🏦',
    phase: 'Inventory'
  },

  // PHASE SALE
  sold: {
    label: 'Vendu',
    shortLabel: 'Vendu',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Vendu, en attente de paiement',
    icon: '✓',
    phase: 'Sale'
  },
  paid: {
    label: 'Payé',
    shortLabel: 'Payé',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    description: 'Paiement reçu - Transaction complète',
    icon: '✓✓',
    phase: 'Sale'
  },

  // ÉTAT D'EXCEPTION
  cancelled: {
    label: 'Annulé',
    shortLabel: 'Annulé',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Production ou transaction annulée',
    icon: '✗',
    phase: 'Annulé'
  }
};

/**
 * Workflow complet dans l'ordre chronologique
 * (exclut 'cancelled' qui est un état d'exception)
 */
export const COMPLETE_STATUS_FLOW: UnifiedStatus[] = [
  'prepared',
  'ready_for_customs',
  'customs_approved',
  'ready_for_expedition',
  'shipped_to_refinery',
  'refined',
  'in_inventory',
  'sold',
  'paid'
];

/**
 * Regroupement des statuts par phase
 */
export const STATUS_BY_PHASE = {
  production: ['prepared', 'ready_for_customs'] as UnifiedStatus[],
  shipping: ['customs_approved', 'ready_for_expedition'] as UnifiedStatus[],
  freight: ['shipped_to_refinery'] as UnifiedStatus[],
  refinery: ['refined'] as UnifiedStatus[],
  inventory: ['in_inventory'] as UnifiedStatus[],
  sale: ['sold', 'paid'] as UnifiedStatus[]
};

/**
 * Obtenir l'index d'un statut dans le workflow complet
 */
export function getStatusIndex(status: UnifiedStatus): number {
  return COMPLETE_STATUS_FLOW.indexOf(status);
}

/**
 * Vérifier si un statut A vient avant un statut B
 */
export function isStatusBefore(statusA: UnifiedStatus, statusB: UnifiedStatus): boolean {
  const indexA = getStatusIndex(statusA);
  const indexB = getStatusIndex(statusB);
  return indexA < indexB && indexA !== -1 && indexB !== -1;
}

/**
 * Vérifier si un statut A vient après un statut B
 */
export function isStatusAfter(statusA: UnifiedStatus, statusB: UnifiedStatus): boolean {
  return isStatusBefore(statusB, statusA);
}

/**
 * Vérifier si un statut est complété par rapport au statut actuel
 */
export function isStatusCompleted(status: UnifiedStatus, currentStatus: UnifiedStatus): boolean {
  if (currentStatus === 'cancelled') return false;
  return isStatusBefore(status, currentStatus) || status === currentStatus;
}

/**
 * Obtenir la phase d'un statut
 */
export function getStatusPhase(status: UnifiedStatus): string {
  return UNIFIED_STATUS_CONFIG[status]?.phase || 'Unknown';
}

/**
 * Obtenir le pourcentage de progression
 */
export function getProgressPercentage(currentStatus: UnifiedStatus): number {
  if (currentStatus === 'cancelled') return 0;

  const index = getStatusIndex(currentStatus);
  if (index === -1) return 0;

  return Math.round(((index + 1) / COMPLETE_STATUS_FLOW.length) * 100);
}

/**
 * Obtenir le statut suivant dans le workflow
 */
export function getNextStatus(currentStatus: UnifiedStatus): UnifiedStatus | null {
  const index = getStatusIndex(currentStatus);
  if (index === -1 || index >= COMPLETE_STATUS_FLOW.length - 1) {
    return null;
  }
  return COMPLETE_STATUS_FLOW[index + 1];
}

/**
 * Obtenir le statut précédent dans le workflow
 */
export function getPreviousStatus(currentStatus: UnifiedStatus): UnifiedStatus | null {
  const index = getStatusIndex(currentStatus);
  if (index <= 0) {
    return null;
  }
  return COMPLETE_STATUS_FLOW[index - 1];
}

/**
 * Vérifier si c'est un statut final
 */
export function isFinalStatus(status: UnifiedStatus): boolean {
  return status === 'paid' || status === 'cancelled';
}
