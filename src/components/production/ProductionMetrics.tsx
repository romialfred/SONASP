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

  const renderVarianceCard = (title: string, summary: ProductionSummary | null, icon: any, period: string, colorScheme: 'blue' | 'purple' | 'teal') => {
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

    const colorConfig = {
      blue: { border: '#3b82f6' },
      purple: { border: '#a855f7' },
      teal: { border: '#14b8a6' }
    };

    const colors = colorConfig[colorScheme];

    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 border-t-4" style={{
        borderTopColor: colors.border
      }}>
        {/* Header avec fond gris transparent - Style Production in Safe */}
        <div className="px-5 py-4" style={{ backgroundColor: 'rgba(107, 114, 128, 0.6)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/30 backdrop-blur-sm">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/90">{period}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">

        <div className="space-y-4">
          {/* Actual Production - Total avec transparence verte - Style Production in Safe */}
          <div className="rounded-xl p-4 border-2" style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.3)'
          }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-700">Réalisé</span>
              <span className="text-3xl font-bold text-emerald-700">
                {summary.total_estimated_oz?.toFixed(2)} <span className="text-base font-medium text-emerald-600">oz</span>
              </span>
            </div>

            {/* Forecast Comparison - Style Production in Safe */}
            <div className="bg-white rounded-lg p-3 mb-2 border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-600">Prévision</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {summary.forecast_oz?.toFixed(2) || '0.00'} oz
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  {varianceForecast >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-orange-500" />
                  )}
                  <span className="text-xs font-medium text-gray-600">vs Prévision</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold tabular-nums text-orange-500">
                    {varianceForecast >= 0 ? '+' : ''}{varianceForecast.toFixed(0)}
                  </span>
                  <span className="text-xs ml-1 font-medium text-orange-500">
                    ({forecastPct >= 0 ? '' : ''}{forecastPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Budget Comparison - Style Production in Safe */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-600">Budget</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {summary.budget_oz?.toFixed(2) || '0.00'} oz
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  {varianceBudget >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-xs font-medium text-gray-600">vs Budget</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold tabular-nums text-amber-500">
                    {varianceBudget >= 0 ? '+' : ''}{varianceBudget.toFixed(0)}
                  </span>
                  <span className="text-xs ml-1 font-medium text-amber-500">
                    ({budgetPct >= 0 ? '' : ''}{budgetPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métriques additionnelles supprimées - déjà présentes dans les sections Prévision/Budget */}
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
                <p className="metric-card-title">
                  {metric.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="metric-card-value">
                    {metric.value}
                  </span>
                  <span className="metric-card-unit">
                    {metric.unit}
                  </span>
                </div>
                <p className="metric-card-subtitle">
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

      {/* WTD, MTD and YTD Variance Cards - Style similaire à Production in Safe */}
      {(wtdSummary || mtdSummary) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {wtdSummary && renderVarianceCard(
            'Performance Hebdomadaire',
            wtdSummary,
            Calendar,
            'Week to Date',
            'blue'
          )}
          {mtdSummary && renderVarianceCard(
            'Performance Mensuelle',
            mtdSummary,
            CalendarRange,
            'Month to Date',
            'purple'
          )}
          {mtdSummary && renderVarianceCard(
            'Performance Annuelle',
            mtdSummary,
            CalendarRange,
            'Year to Date',
            'teal'
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
