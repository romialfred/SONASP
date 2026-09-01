import { Package, CheckCircle, Truck, Plane } from 'lucide-react';
import type { FreightCustomsStatus } from '@/services/freightCustomsService';
import type { FreightShipmentStatus } from '@/services/freightShipmentService';

export type FreightStatus = FreightCustomsStatus | FreightShipmentStatus;

interface FreightStatusBadgeProps {
  status: FreightStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function FreightStatusBadge({ status, size = 'md', showIcon = true }: FreightStatusBadgeProps) {
  const getStatusConfig = (status: FreightStatus) => {
    switch (status) {
      case 'customs_pending':
        return {
          label: "Awaiting customs approval",
          icon: Package,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        };
      case 'customs_approved':
        return {
          label: "Customs approved",
          icon: CheckCircle,
          bgColor: 'bg-emerald-50',
          textColor: 'text-emerald-700',
          borderColor: 'border-emerald-200'
        };
      case 'ready_for_transport':
        return {
          label: "Ready for transport",
          icon: Truck,
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200'
        };
      case 'ready_for_expedition':
        return {
          label: "Ready for shipment",
          icon: Plane,
          bgColor: 'bg-indigo-50',
          textColor: 'text-indigo-700',
          borderColor: 'border-indigo-200'
        };
      case 'shipped_to_refinery':
        return {
          label: "Dispatched",
          icon: Plane,
          bgColor: 'bg-slate-100',
          textColor: 'text-slate-700',
          borderColor: 'border-slate-200'
        };
      case 'received_at_refinery':
        return {
          label: "Received at refinery",
          icon: CheckCircle,
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-800',
          borderColor: 'border-emerald-300'
        };
      case 'pending':
        return {
          label: "Pending",
          icon: Package,
          bgColor: 'bg-amber-50',
          textColor: 'text-amber-700',
          borderColor: 'border-amber-200'
        };
      case 'approved':
        return {
          label: "Approved",
          icon: CheckCircle,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300'
        };
      default:
        return {
          label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          icon: Package,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
}
