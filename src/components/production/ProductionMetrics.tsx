import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
  const [ytdSummary, setYtdSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, [dateRange.endDate, miningCompanyId]);

  const loadSummaries = async () => {
    try {
      setLoading(true);
      const [wtd, mtd, ytd] = await Promise.all([
        dailyProductionService.getWTDSummary(dateRange.endDate, miningCompanyId),
        dailyProductionService.getMTDSummary(dateRange.endDate, miningCompanyId),
        dailyProductionService.getMTDSummary(dateRange.endDate, miningCompanyId)
      ]);
      setWtdSummary(wtd);
      setMtdSummary(mtd);
      setYtdSummary(ytd);
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateVariance = (actual: number, target: number) => actual - target;
  const calculatePercentage = (actual: number, target: number) => {
    if (target === 0) return 0;
    return ((actual / target) * 100) - 100;
  };

  const renderPerformanceCard = (
    title: string,
    period: string,
    summary: ProductionSummary | null,
    borderColor: string,
    realiseBg: string,
    realiseTextColor: string
  ) => {
    if (!summary) return null;

    const varianceForecast = summary.variance_vs_forecast || 0;
    const varianceBudget = summary.variance_vs_budget || 0;
    const forecastPct = summary.forecast_oz && summary.forecast_oz > 0
      ? ((varianceForecast / summary.forecast_oz) * 100)
      : 0;
    const budgetPct = summary.budget_oz && summary.budget_oz > 0
      ? ((varianceBudget / summary.budget_oz) * 100)
      : 0;

    return (
      <Card className={`border-t-4 ${borderColor}`}>
        {/* Header - Style exact Production in Safe */}
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{period}</p>
        </div>

        {/* Content - Style exact Production in Safe */}
        <div className="p-3 space-y-2">
          {/* Prévision */}
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-600">Prévision</span>
            <span className="text-sm font-semibold text-gray-900">
              {summary.forecast_oz?.toFixed(2) || '0.00'} oz
            </span>
          </div>

          {/* Budget */}
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-600">Budget</span>
            <span className="text-sm font-semibold text-gray-900">
              {summary.budget_oz?.toFixed(2) || '0.00'} oz
            </span>
          </div>

          {/* Réalisé */}
          <div className={`flex justify-between items-center py-2 ${realiseBg} rounded-lg px-3`}>
            <span className={`text-xs font-semibold ${realiseTextColor}`}>Réalisé</span>
            <span className={`text-base font-bold ${realiseTextColor}`}>
              {summary.total_estimated_oz?.toFixed(2) || '0.00'} oz
            </span>
          </div>

          {/* vs Prévision */}
          <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${
            varianceForecast >= 0
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-orange-50 border border-orange-200'
          }`}>
            <span className="text-xs font-semibold text-gray-700">vs Prévision</span>
            <div className="flex items-center gap-1.5">
              {varianceForecast >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-orange-600" />
              )}
              <span className={`text-sm font-bold ${
                varianceForecast >= 0 ? 'text-emerald-700' : 'text-orange-700'
              }`}>
                {varianceForecast >= 0 ? '+' : ''}{varianceForecast.toFixed(0)}
              </span>
              <span className={`text-xs ${
                varianceForecast >= 0 ? 'text-emerald-600' : 'text-orange-600'
              }`}>
                ({forecastPct >= 0 ? '' : ''}{forecastPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* vs Budget */}
          <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${
            varianceBudget >= 0
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <span className="text-xs font-semibold text-gray-700">vs Budget</span>
            <div className="flex items-center gap-1.5">
              {varianceBudget >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className={`text-sm font-bold ${
                varianceBudget >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {varianceBudget >= 0 ? '+' : ''}{varianceBudget.toFixed(0)}
              </span>
              <span className={`text-xs ${
                varianceBudget >= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                ({budgetPct >= 0 ? '' : ''}{budgetPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* WTD, MTD et YTD Performance Cards - Style EXACT Production in Safe */}
      {(wtdSummary || mtdSummary || ytdSummary) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Performance Hebdomadaire */}
          {wtdSummary && renderPerformanceCard(
            'Performance Hebdomadaire',
            'Week to Date',
            wtdSummary,
            'border-t-blue-600',
            'bg-blue-50',
            'text-blue-900'
          )}

          {/* Performance Mensuelle */}
          {mtdSummary && renderPerformanceCard(
            'Performance Mensuelle',
            'Month to Date',
            mtdSummary,
            'border-t-purple-600',
            'bg-purple-50',
            'text-purple-900'
          )}

          {/* Performance Annuelle */}
          {ytdSummary && renderPerformanceCard(
            'Performance Annuelle',
            'Year to Date',
            ytdSummary,
            'border-t-emerald-600',
            'bg-emerald-50',
            'text-emerald-900'
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
