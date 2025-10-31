import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export type TrafficLightStatus = 'good' | 'warning' | 'critical';

interface TrafficLightIndicatorProps {
  status: TrafficLightStatus;
  label: string;
  value: string | number;
  threshold?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TrafficLightIndicator({
  status,
  label,
  value,
  threshold,
  size = 'md'
}: TrafficLightIndicatorProps) {
  const statusConfig = {
    good: {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-800',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      label: 'Good'
    },
    warning: {
      bg: 'bg-yellow-100',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      icon: AlertCircle,
      iconColor: 'text-yellow-600',
      label: 'Warning'
    },
    critical: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: XCircle,
      iconColor: 'text-red-600',
      label: 'Critical'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: { container: 'p-2', icon: 'h-4 w-4', value: 'text-lg', label: 'text-xs' },
    md: { container: 'p-4', icon: 'h-5 w-5', value: 'text-2xl', label: 'text-sm' },
    lg: { container: 'p-6', icon: 'h-6 w-6', value: 'text-3xl', label: 'text-base' }
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={`
        ${config.bg} ${config.border} border-2 rounded-lg ${sizes.container}
        transition-all hover:shadow-md
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`${config.bg} p-2 rounded-lg`}>
          <Icon className={`${sizes.icon} ${config.iconColor}`} />
        </div>
        <span className={`text-xs font-semibold ${config.text} uppercase px-2 py-1 rounded-full ${config.bg}`}>
          {config.label}
        </span>
      </div>
      <div className={`font-bold ${config.text} ${sizes.value} mb-1`}>
        {value}
      </div>
      <div className={`${sizes.label} text-gray-700 font-medium`}>
        {label}
      </div>
      {threshold && (
        <div className={`${sizes.label} text-gray-600 mt-1`}>
          Threshold: {threshold}
        </div>
      )}
    </div>
  );
}
