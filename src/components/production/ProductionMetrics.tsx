import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, Coins, Activity, Target, Calendar, CalendarRange } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DailyProduction, dailyProductionService, ProductionSummary } from '@/services/dailyProductionService';

interface ProductionMetricsProps {
  productions: DailyProduction[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  miningCompanyId?: string;
}

export function ProductionMetrics({ productions, dateRange, miningCompanyId }: ProductionMetricsProps) {
  const [wtdSummary, setWtdSummary] = useState<ProductionSummary | null>(null);
  const [mtdSummary, setMtdSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, [dateRange.endDate, miningCompanyId]);

  const loadSummaries = async () => {
    try {
      setLoading(true);
      const [wtd, mtd] = await Promise.all([
        dailyProductionService.getWTDSummary(dateRange.endDate, miningCompanyId),
        dailyProductionService.getMTDSummary(dateRange.endDate, miningCompanyId)
      ]);
      setWtdSummary(wtd);
      setMtdSummary(mtd);
    } catch (error) {
      console.error('Error loading summaries:', error);
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

  const renderVarianceCard = (title: string, summary: ProductionSummary | null, icon: any, period: string) => {
    if (!summary) return null;

    const Icon = icon;
    const varianceForecast = summary.variance_vs_forecast || 0;
    const varianceBudget = summary.variance_vs_budget || 0;
    const forecastPct = summary.forecast_oz && summary.forecast_oz > 0
      ? ((varianceForecast / summary.forecast_oz) * 100)
      : 0;
    const budgetPct = summary.budget_oz && summary.budget_oz > 0
      ? ((varianceBudget / summary.budget_oz) * 100)
      : 0;

    return (
      <Card className="p-5 hover:shadow-lg transition-shadow duration-200 border-l-4" style={{
        borderLeftColor: varianceForecast >= 0 ? '#10b981' : '#ef4444'
      }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500">{period}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Actual Production */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Actual Production</span>
              <span className="text-2xl font-bold text-blue-600">
                {summary.total_estimated_oz?.toFixed(2)} <span className="text-sm text-gray-600">oz</span>
              </span>
            </div>

            {/* Forecast Comparison */}
            <div className="bg-white/80 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">Forecast Target</span>
                <span className="text-sm font-semibold text-gray-700">
                  {summary.forecast_oz?.toFixed(2) || '0.00'} oz
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  {varianceForecast >= 0 ? (
                    <div className="p-1 rounded bg-green-100">
                      <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-1 rounded bg-red-100">
                      <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-gray-700">vs Forecast</span>
                </div>
                <div className="text-right">
                  <span className={`text-base font-bold ${
                    varianceForecast >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {varianceForecast >= 0 ? '+' : ''}{varianceForecast.toFixed(2)}
                  </span>
                  <span className={`text-xs ml-1 font-semibold ${
                    varianceForecast >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({forecastPct >= 0 ? '+' : ''}{forecastPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Budget Comparison */}
            <div className="bg-white/80 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">Budget Target</span>
                <span className="text-sm font-semibold text-gray-700">
                  {summary.budget_oz?.toFixed(2) || '0.00'} oz
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  {varianceBudget >= 0 ? (
                    <div className="p-1 rounded bg-green-100">
                      <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-1 rounded bg-red-100">
                      <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-gray-700">vs Budget</span>
                </div>
                <div className="text-right">
                  <span className={`text-base font-bold ${
                    varianceBudget >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {varianceBudget >= 0 ? '+' : ''}{varianceBudget.toFixed(2)}
                  </span>
                  <span className={`text-xs ml-1 font-semibold ${
                    varianceBudget >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({budgetPct >= 0 ? '+' : ''}{budgetPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-600 block mb-1">Avg Fineness</span>
              <div className="text-lg font-bold text-gray-900">
                {summary.avg_fineness_pct?.toFixed(2)}<span className="text-xs text-gray-600">%</span>
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-600 block mb-1">Records</span>
              <div className="text-lg font-bold text-gray-900">
                {summary.record_count}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Period Summary Cards */}
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

      {/* WTD and MTD Variance Cards */}
      {(wtdSummary || mtdSummary) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {wtdSummary && renderVarianceCard(
            'Week-To-Date (WTD)',
            wtdSummary,
            Calendar,
            'Semaine en cours'
          )}
          {mtdSummary && renderVarianceCard(
            'Month-To-Date (MTD)',
            mtdSummary,
            CalendarRange,
            'Mois en cours'
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Chargement des statistiques...</p>
        </div>
      )}
    </div>
  );
}
