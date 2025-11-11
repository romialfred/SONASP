import { PRODUCTION_STATUSES, ProductionStatus } from '@/constants/productionStatuses';

interface ProductionStatusBadgeProps {
  status: ProductionStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function ProductionStatusBadge({
  status,
  size = 'md',
  showIcon = false
}: ProductionStatusBadgeProps) {
  const statusConfig = PRODUCTION_STATUSES[status];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}
        ${sizeClasses[size]}
      `}
      title={statusConfig.description}
    >
      {showIcon && (
        <span className="w-2 h-2 rounded-full bg-current" />
      )}
      {statusConfig.label}
    </span>
  );
}
