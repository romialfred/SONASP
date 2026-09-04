import { cn } from '@/utils/cn';
import { formatStatusFr } from '@/utils/statusFormatter';

export type StatusType =
  | 'created'
  | 'prepared'
  | 'validated_for_refinery'
  | 'received'
  | 'received_airport'
  | 'shipped_refinery'
  | 'received_refinery'
  | 'processing'
  | 'processed'
  | 'completed'
  | 'approved'
  | 'ready_for_sale'
  | 'sold'
  | 'paid'
  | 'pending'
  | 'rejected'
  | 'alert';

export interface StatusBadgeProps {
  /** Accepte tout statut (mappé en interne via Record<string, …>). */
  status?: StatusType | string;
  label?: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, label, variant, size = 'md' }: StatusBadgeProps) {
  const statusConfig: Record<string, string> = {
    created: 'bg-gray-100 text-gray-700',
    prepared: 'bg-blue-100 text-blue-700',
    validated_for_refinery: 'bg-green-100 text-green-700',
    received: 'bg-purple-100 text-purple-700',
    received_airport: 'bg-purple-100 text-purple-700',
    shipped_refinery: 'bg-blue-100 text-blue-700',
    received_refinery: 'bg-purple-100 text-purple-700',
    processing: 'bg-yellow-100 text-yellow-700',
    processed: 'bg-accent-100 text-accent-700',
    completed: 'bg-accent-100 text-accent-700',
    approved: 'bg-green-100 text-green-700',
    ready_for_sale: 'bg-green-100 text-green-700',
    sold: 'bg-primary-100 text-primary-700',
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700',
    alert: 'bg-red-100 text-red-700'
  };

  const variantConfig = {
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
    neutral: 'bg-gray-100 text-gray-700'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  let colorClass = '';
  const displayLabel = label || formatStatusFr(status);

  if (variant) {
    colorClass = variantConfig[variant];
  } else if (status && statusConfig[status]) {
    colorClass = statusConfig[status];
  } else {
    colorClass = 'bg-gray-100 text-gray-700';
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      colorClass,
      sizeClasses[size]
    )}>
      {displayLabel}
    </span>
  );
}
