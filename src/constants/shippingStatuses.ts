import { Clock, Package, Check, Building2, TrendingUp, DollarSign, XCircle, Plane, CheckCircle } from 'lucide-react';

/**
 * ENUM shipping_preparation_status défini dans la base de données
 * Source: supabase/migrations/20251114_009_fix_shipping_workflow_statuses.sql
 *
 * Workflow d'expédition avec approbation douanière:
 * 1. waiting_for_customs_approval → En attente approbation douane (STATUT INITIAL)
 *    - Assigné automatiquement à la création
 *    - Peut durer plusieurs jours
 *
 * 2. approved_by_customs → Douane approuvée
 *    - Transition manuelle via bouton "Customs Approved" dans Shipping Details
 *
 * 3. ready_for_expedition → Prêt pour expédition
 *    - Autorisé à être expédié (STATUT FINAL)
 */
export type ShippingStatus =
  | 'waiting_for_customs_approval'  // Statut initial (DEFAULT)
  | 'approved_by_customs'            // Après approbation manuelle
  | 'ready_for_expedition';          // Statut final

export interface ShippingStatusConfig {
  value: ShippingStatus;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  canTransitionTo: ShippingStatus[];
}

/**
 * Configuration des statuts d'expédition selon l'ENUM de la base de données
 * Workflow: waiting_for_customs_approval → approved_by_customs → ready_for_expedition
 */
export const SHIPPING_STATUSES: Record<ShippingStatus, ShippingStatusConfig> = {
  waiting_for_customs_approval: {
    value: 'waiting_for_customs_approval',
    label: 'En Attente Douane',
    description: 'Expédition créée, en attente d\'approbation douanière (peut durer plusieurs jours)',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: Clock,
    canTransitionTo: ['approved_by_customs'],
  },
  approved_by_customs: {
    value: 'approved_by_customs',
    label: 'Douane Approuvée',
    description: 'Approbation douanière obtenue, validation en cours',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    icon: CheckCircle,
    canTransitionTo: ['ready_for_expedition'],
  },
  ready_for_expedition: {
    value: 'ready_for_expedition',
    label: 'Prêt pour Expédition',
    description: 'Autorisé à être expédié vers la destination finale',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    icon: Plane,
    canTransitionTo: [],
  },
};

export const getShippingStatusConfig = (status: ShippingStatus): ShippingStatusConfig => {
  return SHIPPING_STATUSES[status] || SHIPPING_STATUSES.waiting_for_customs_approval;
};

export const canTransitionToStatus = (
  from: ShippingStatus,
  to: ShippingStatus
): boolean => {
  const config = getShippingStatusConfig(from);
  return config.canTransitionTo.includes(to);
};
