import { cn } from '@/utils/cn';

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
  label: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, label, variant, size = 'md' }: StatusBadgeProps) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    created: { color: 'bg-gray-100 text-gray-700', label: 'Created' },
    prepared: { color: 'bg-blue-100 text-blue-700', label: 'Prepared' },
    validated_for_refinery: { color: 'bg-green-100 text-green-700', label: 'Validated for Refinery' },
    received: { color: 'bg-purple-100 text-purple-700', label: 'Received' },
    received_airport: { color: 'bg-purple-100 text-purple-700', label: 'Received at Airport' },
    shipped_refinery: { color: 'bg-blue-100 text-blue-700', label: 'Shipped to Refinery' },
    received_refinery: { color: 'bg-purple-100 text-purple-700', label: 'Received at Refinery' },
    processing: { color: 'bg-yellow-100 text-yellow-700', label: 'Processing' },
    processed: { color: 'bg-accent-100 text-accent-700', label: 'Processed' },
    completed: { color: 'bg-accent-100 text-accent-700', label: 'Completed' },
    approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
    ready_for_sale: { color: 'bg-green-100 text-green-700', label: 'Ready for Sale' },
    sold: { color: 'bg-primary-100 text-primary-700', label: 'Sold' },
    paid: { color: 'bg-green-100 text-green-700', label: 'Paid' },
    pending: { color: 'bg-orange-100 text-orange-700', label: 'Pending' },
    rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    alert: { color: 'bg-red-100 text-red-700', label: 'Alert' }
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
  let displayLabel = label;

  if (variant) {
    colorClass = variantConfig[variant];
  } else if (status && statusConfig[status]) {
    const config = statusConfig[status];
    colorClass = config.color;
    displayLabel = label || config.label;
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
