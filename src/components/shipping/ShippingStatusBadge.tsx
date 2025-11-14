import { ShippingStatus, getShippingStatusConfig } from '@/constants/shippingStatuses';

interface ShippingStatusBadgeProps {
  status: ShippingStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function ShippingStatusBadge({ status, size = 'md', showIcon = true }: ShippingStatusBadgeProps) {
  const config = getShippingStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </span>
  );
}
