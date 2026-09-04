import { LucideIcon, HelpCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface MetricCardProps {
  title: string;
  value: string | number;
  valueInGrams?: number;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  cardBgColor?: string;
}

export function MetricCard({
  title,
  value,
  valueInGrams,
  subtitle,
  change,
  changeType = 'neutral',
  icon: Icon = HelpCircle,
  iconColor = 'text-primary-600',
  iconBgColor = 'bg-primary-100',
  cardBgColor = 'bg-white/40'
}: MetricCardProps) {
  const changeColors = {
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className={cn(
      "relative backdrop-blur-sm rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-200",
      cardBgColor
    )}>
      {/* Icon in top-left corner */}
      <div className={cn(
        'absolute top-4 left-4 w-10 h-10 rounded-lg flex items-center justify-center',
        iconBgColor
      )}>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>

      {/* Content with left padding to avoid icon overlap */}
      <div className="pl-14">
        <p className="text-xs font-medium text-gray-600 mb-1">
          {title}
        </p>

        <div className="space-y-0.5">
          <div className="text-xl font-bold text-gray-900">
            {value}
            {valueInGrams && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                ({valueInGrams.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} g)
              </span>
            )}
          </div>

          {subtitle && (
            <p className="text-xs text-gray-500">
              {subtitle}
            </p>
          )}

          {change && (
            <p className={cn('text-xs font-medium', changeColors[changeType])}>
              {change}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
