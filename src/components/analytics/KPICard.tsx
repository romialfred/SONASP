import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ElementType;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  subtitle?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = 'blue',
  subtitle
}: KPICardProps) {
  const colorConfig = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
    red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
  };

  const config = colorConfig[color];

  const getTrendIcon = () => {
    if (change === undefined || change === 0) return Minus;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = () => {
    if (change === undefined || change === 0) return 'text-gray-500';
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  const TrendIcon = getTrendIcon();

  return (
    <div className={`bg-white border-2 ${config.border} rounded-lg p-4 hover:shadow-lg transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {Icon && (
          <div className={`${config.bg} p-2 rounded-lg`}>
            <Icon className={`h-5 w-5 ${config.text}`} />
          </div>
        )}
      </div>

      <div className="text-3xl font-bold text-gray-900 mb-2">
        {value}
      </div>

      {subtitle && (
        <div className="text-xs text-gray-500 mb-2">
          {subtitle}
        </div>
      )}

      {change !== undefined && (
        <div className="flex items-center gap-1">
          <TrendIcon className={`h-4 w-4 ${getTrendColor()}`} />
          <span className={`text-sm font-semibold ${getTrendColor()}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          {changeLabel && (
            <span className="text-xs text-gray-500 ml-1">
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
