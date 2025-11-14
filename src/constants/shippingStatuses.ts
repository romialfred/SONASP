import { Clock, Package, Check, Building2, TrendingUp, DollarSign, XCircle, Plane } from 'lucide-react';

export type ShippingStatus =
  | 'pending'
  | 'prepared'
  | 'validated_for_refinery'
  | 'in_refining'
  | 'refined'
  | 'in_sale'
  | 'sold'
  | 'cancelled';

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

export const SHIPPING_STATUSES: Record<ShippingStatus, ShippingStatusConfig> = {
  pending: {
    value: 'pending',
    label: 'En Attente',
    description: 'Expédition en attente de préparation',
    color: 'slate',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    icon: Clock,
    canTransitionTo: ['prepared', 'cancelled'],
  },
  prepared: {
    value: 'prepared',
    label: 'Préparée',
    description: 'Expédition préparée et prête pour validation',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    icon: Package,
    canTransitionTo: ['validated_for_refinery', 'cancelled'],
  },
  validated_for_refinery: {
    value: 'validated_for_refinery',
    label: 'Validée pour Raffinerie',
    description: 'Expédition validée et en route vers la raffinerie',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    icon: Plane,
    canTransitionTo: ['in_refining', 'cancelled'],
  },
  in_refining: {
    value: 'in_refining',
    label: 'En Raffinage',
    description: 'Matériaux en cours de raffinage',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    icon: Building2,
    canTransitionTo: ['refined', 'cancelled'],
  },
  refined: {
    value: 'refined',
    label: 'Raffinée',
    description: 'Raffinage terminé, prêt pour la vente',
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300',
    icon: Check,
    canTransitionTo: ['in_sale', 'cancelled'],
  },
  in_sale: {
    value: 'in_sale',
    label: 'En Vente',
    description: 'Matériaux disponibles et en vente',
    color: 'cyan',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300',
    icon: TrendingUp,
    canTransitionTo: ['sold', 'cancelled'],
  },
  sold: {
    value: 'sold',
    label: 'Vendue',
    description: 'Vente terminée et finalisée',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    icon: DollarSign,
    canTransitionTo: [],
  },
  cancelled: {
    value: 'cancelled',
    label: 'Annulée',
    description: 'Expédition annulée',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    icon: XCircle,
    canTransitionTo: [],
  },
};

export const getShippingStatusConfig = (status: ShippingStatus): ShippingStatusConfig => {
  return SHIPPING_STATUSES[status] || SHIPPING_STATUSES.pending;
};

export const canTransitionToStatus = (
  from: ShippingStatus,
  to: ShippingStatus
): boolean => {
  const config = getShippingStatusConfig(from);
  return config.canTransitionTo.includes(to);
};
