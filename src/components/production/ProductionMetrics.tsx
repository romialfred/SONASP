import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, Coins, Activity, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DailyProduction, dailyProductionService } from '@/services/dailyProductionService';

interface ProductionMetricsProps {
  productions: DailyProduction[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export function ProductionMetrics({ productions, dateRange }: ProductionMetricsProps) {
  const [variance, setVariance] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVariance();
  }, [dateRange.endDate]);

  const loadVariance = async () => {
    try {
      setLoading(true);
      const data = await dailyProductionService.getProductionVariance(
        dateRange.endDate,
        'daily'
      );
      setVariance(data);
    } catch (error) {
      console.error('Error loading variance:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalBullion = productions.reduce((sum, p) => sum + p.bullion_grams, 0);
  const totalPureGold = productions.reduce((sum, p) => sum + p.pure_gold_grams, 0);
  const totalOz = productions.reduce((sum, p) => sum + p.estimated_oz, 0);
  const avgFineness = productions.length > 0
    ? productions.reduce((sum, p) => sum + p.estimated_fineness_pct, 0) / productions.length
    : 0;

  const metrics = [
    {
      label: 'Total Bullion',
      value: totalBullion.toFixed(2),
      unit: 'g',
      icon: Package,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Total Pure Gold',
      value: totalPureGold.toFixed(2),
      unit: 'g',
      icon: Coins,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Total Estimated',
      value: totalOz.toFixed(4),
      unit: 'oz',
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Avg Fineness',
      value: avgFineness.toFixed(2),
      unit: '%',
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {metric.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {metric.value}
                  </span>
                  <span className="text-sm text-gray-500">
                    {metric.unit}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {productions.length} enregistrement(s)
                </p>
              </div>
              <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Variance Cards */}
      {variance && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Variance vs Forecast */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">
                  Variance vs Forecast
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Comparison with daily forecast
                </p>
              </div>
              {variance.variance_vs_forecast >= 0 ? (
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="p-2 bg-red-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Actual:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {variance.actual_oz.toFixed(2)} oz
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Forecast:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {variance.forecast_oz.toFixed(2)} oz
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Variance:</span>
                  <span className={`text-lg font-bold ${
                    variance.variance_vs_forecast >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {variance.variance_vs_forecast >= 0 ? '+' : ''}
                    {variance.variance_vs_forecast.toFixed(2)} oz
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-xs ${
                    variance.variance_vs_forecast >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {variance.forecast_oz > 0
                      ? `${((variance.variance_vs_forecast / variance.forecast_oz) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Variance vs Budget */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">
                  Variance vs Budget
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Comparison with daily budget
                </p>
              </div>
              {variance.variance_vs_budget >= 0 ? (
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="p-2 bg-red-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Actual:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {variance.actual_oz.toFixed(2)} oz
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Budget:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {variance.budget_oz.toFixed(2)} oz
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Variance:</span>
                  <span className={`text-lg font-bold ${
                    variance.variance_vs_budget >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {variance.variance_vs_budget >= 0 ? '+' : ''}
                    {variance.variance_vs_budget.toFixed(2)} oz
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-xs ${
                    variance.variance_vs_budget >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {variance.budget_oz > 0
                      ? `${((variance.variance_vs_budget / variance.budget_oz) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
