import { Clock, Package, Check, Building2, TrendingUp, DollarSign, XCircle, Plane, CheckCircle } from 'lucide-react';

/**
 * ENUM shipping_preparation_status défini dans la base de données
 * Source: supabase/migrations/20251114_004_correct_status_enums_verified.sql
 *
 * Valeurs autorisées:
 * - ready_for_customs: Prêt pour la douane
 * - approved_by_customs: Approuvé par la douane
 * - ready_for_expedition: Prêt pour Expédition
 */
export type ShippingStatus =
  | 'ready_for_customs'
  | 'approved_by_customs'
  | 'ready_for_expedition';

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
 * Workflow: ready_for_customs → approved_by_customs → ready_for_expedition
 */
export const SHIPPING_STATUSES: Record<ShippingStatus, ShippingStatusConfig> = {
  ready_for_customs: {
    value: 'ready_for_customs',
    label: 'Prêt pour Douane',
    description: 'Expédition préparée, en attente d\'approbation douanière',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    icon: Package,
    canTransitionTo: ['approved_by_customs'],
  },
  approved_by_customs: {
    value: 'approved_by_customs',
    label: 'Approuvé par Douane',
    description: 'Dédouanement validé, prêt pour expédition',
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
  return SHIPPING_STATUSES[status] || SHIPPING_STATUSES.ready_for_customs;
};

export const canTransitionToStatus = (
  from: ShippingStatus,
  to: ShippingStatus
): boolean => {
  const config = getShippingStatusConfig(from);
  return config.canTransitionTo.includes(to);
};
