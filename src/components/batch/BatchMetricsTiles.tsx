import { Package, Scale, TrendingUp } from 'lucide-react';
import { formatWeight } from '@/utils/batchUtils';
import { getBatchStatusLabel, getBatchStatusVariant } from '@/constants/batchStatuses';

interface StatusMetrics {
  status: string;
  count: number;
  totalWeightGrams: number;
  totalWeightOunces: number;
}

interface BatchMetricsTilesProps {
  metrics: StatusMetrics[];
}

export function BatchMetricsTiles({ metrics }: BatchMetricsTilesProps) {
  if (metrics.length === 0) {
    return null;
  }

  const getStatusColor = (status: string) => {
    const variant = getBatchStatusVariant(status);
    const colorMap = {
      success: 'from-emerald-500 to-emerald-600',
      warning: 'from-amber-500 to-amber-600',
      danger: 'from-red-500 to-red-600',
      info: 'from-blue-500 to-blue-600',
      default: 'from-gray-500 to-gray-600',
    };
    return colorMap[variant] || colorMap.default;
  };

  const getStatusBgColor = (status: string) => {
    const variant = getBatchStatusVariant(status);
    const colorMap = {
      success: 'bg-emerald-50 border-emerald-200',
      warning: 'bg-amber-50 border-amber-200',
      danger: 'bg-red-50 border-red-200',
      info: 'bg-blue-50 border-blue-200',
      default: 'bg-gray-50 border-gray-200',
    };
    return colorMap[variant] || colorMap.default;
  };

  const getStatusIconBg = (status: string) => {
    const variant = getBatchStatusVariant(status);
    const colorMap = {
      success: 'bg-emerald-100',
      warning: 'bg-amber-100',
      danger: 'bg-red-100',
      info: 'bg-blue-100',
      default: 'bg-gray-100',
    };
    return colorMap[variant] || colorMap.default;
  };

  const getStatusIconColor = (status: string) => {
    const variant = getBatchStatusVariant(status);
    const colorMap = {
      success: 'text-emerald-700',
      warning: 'text-amber-700',
      danger: 'text-red-700',
      info: 'text-blue-700',
      default: 'text-gray-700',
    };
    return colorMap[variant] || colorMap.default;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Métriques par Statut</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.status}
            className={`rounded-xl border p-5 ${getStatusBgColor(metric.status)} hover:shadow-lg transition-all duration-200`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${getStatusIconBg(metric.status)}`}>
                <Package className={`w-5 h-5 ${getStatusIconColor(metric.status)}`} />
              </div>
              <span className="text-2xl font-bold text-gray-900">{metric.count}</span>
            </div>

            {/* Status Label */}
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {getBatchStatusLabel(metric.status)}
            </h4>

            {/* Weights */}
            <div className="space-y-2">
              {/* Weight in Grams */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-600">Grammes</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {formatWeight(metric.totalWeightGrams)}
                </span>
              </div>

              {/* Weight in Ounces */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-600">Onces</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {metric.totalWeightOunces.toFixed(2)} oz
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 pt-3 border-t border-gray-200/50">
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getStatusColor(metric.status)} transition-all duration-300`}
                  style={{ width: `${Math.min((metric.totalWeightOunces / 10000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
