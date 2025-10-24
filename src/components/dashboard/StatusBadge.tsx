import { cn } from '@/utils/cn';

export type StatusType =
  | 'shipped'
  | 'received'
  | 'processing'
  | 'completed'
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'alert';

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const statusConfig = {
    shipped: { color: 'bg-blue-100 text-blue-700', label: 'Shipped' },
    received: { color: 'bg-purple-100 text-purple-700', label: 'Received' },
    processing: { color: 'bg-yellow-100 text-yellow-700', label: 'Processing' },
    completed: { color: 'bg-accent-100 text-accent-700', label: 'Completed' },
    approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
    pending: { color: 'bg-orange-100 text-orange-700', label: 'Pending' },
    rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    alert: { color: 'bg-red-100 text-red-700', label: 'Alert' }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const config = statusConfig[status];

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      config.color,
      sizeClasses[size]
    )}>
      {label || config.label}
    </span>
  );
}
