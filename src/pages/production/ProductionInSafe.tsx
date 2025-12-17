/**
 * PAGE: Production In Safe (Production dans le Coffre)
 *
 * Cette page affiche UNIQUEMENT les productions qui sont physiquement dans le coffre.
 *
 * DIFFÉRENCES AVEC DailyProductionPage:
 * - DailyProductionPage: Affiche TOUTES les productions (y compris annulées)
 * - ProductionInSafe: Affiche UNIQUEMENT les productions actives (exclu 'cancelled')
 *
 * PLAGE DE DATES PAR DÉFAUT:
 * - Identique à DailyProductionPage: du 1er janvier de l'année en cours à aujourd'hui
 * - Cela garantit que toutes les entrées de Daily Production apparaissent ici (sauf annulées)
 *
 * FILTRES APPLIQUÉS AUTOMATIQUEMENT:
 * - status != 'cancelled' (les productions annulées ne sont pas dans le coffre)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, TrendingUp, TrendingDown, Minus, Shield, Calendar, CalendarDays, CalendarCheck } from 'lucide-react';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { ProductionStatus } from '@/constants/productionStatuses';
import { supabase } from '@/lib/supabase';
import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';
import { safeToFixed, safeToLocaleString } from '@/utils/numberUtils';

interface MiningCompany {
  id: string;
  name: string;
}

interface SafeProductionSummary {
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_estimated_oz: number;
  avg_fineness_pct: number;
  record_count: number;
}

interface PeriodData {
  actual: number;
  budget: number;
  forecast: number;
}

interface ForecastData {
  wtd: PeriodData;
  mtd: PeriodData;
  ytd: PeriodData;
}

export function ProductionInSafe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Summary data
  const [summary, setSummary] = useState<SafeProductionSummary>({
    total_bullion_grams: 0,
    total_pure_gold_grams: 0,
    total_estimated_oz: 0,
    avg_fineness_pct: 0,
    record_count: 0
  });

  // Forecast data with WTD, MTD, YTD
  const [forecasts, setForecasts] = useState<ForecastData>({
    wtd: { actual: 0, budget: 850, forecast: 780 },
    mtd: { actual: 0, budget: 2800, forecast: 2500 },
    ytd: { actual: 0, budget: 5500, forecast: 5000 }
  });

  useEffect(() => {
    loadMiningCompanies();
    loadProductions();
  }, [dateRange, selectedCompany, selectedStatus]);

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  const loadProductions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('daily_production')
        .select('*')
        .gte('production_date', dateRange.startDate)
        .lte('production_date', dateRange.endDate)
        .order('production_date', { ascending: false });

      // Exclure automatiquement les productions annulées du safe
      // Les productions annulées ne sont plus dans le coffre
      query = query.neq('status', 'cancelled');

      if (selectedCompany !== 'all') {
        query = query.eq('mining_company_id', selectedCompany);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      const productionData = data as DailyProduction[];
      setProductions(productionData);

      // Calculate summary
      const totalBullion = productionData.reduce((sum, p) => sum + (p.bullion_grams || 0), 0);
      const totalPureGold = productionData.reduce((sum, p) => sum + (p.pure_gold_grams || 0), 0);
      const totalOz = productionData.reduce((sum, p) => sum + (p.estimated_oz || 0), 0);
      const avgFineness = productionData.length > 0
        ? productionData.reduce((sum, p) => sum + (p.estimated_fineness_pct || 0), 0) / productionData.length
        : 0;

      setSummary({
        total_bullion_grams: totalBullion,
        total_pure_gold_grams: totalPureGold,
        total_estimated_oz: totalOz,
        avg_fineness_pct: avgFineness,
        record_count: productionData.length
      });

      // Calculate WTD, MTD, YTD actuals
      const now = new Date();

      // Week to Date (start of week = Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Month to Date
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Year to Date
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const wtdData = productionData.filter(p => new Date(p.production_date) >= startOfWeek);
      const mtdData = productionData.filter(p => new Date(p.production_date) >= startOfMonth);
      const ytdData = productionData.filter(p => new Date(p.production_date) >= startOfYear);

      setForecasts(prev => ({
        wtd: {
          ...prev.wtd,
          actual: wtdData.reduce((sum, p) => sum + p.estimated_oz, 0)
        },
        mtd: {
          ...prev.mtd,
          actual: mtdData.reduce((sum, p) => sum + p.estimated_oz, 0)
        },
        ytd: {
          ...prev.ytd,
          actual: ytdData.reduce((sum, p) => sum + p.estimated_oz, 0)
        }
      }));

    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (actual: number, target: number) => {
    if (target === 0) return actual === 0 ? 0 : -100;
    return ((actual - target) / target) * 100;
  };

  const getTrafficLight = (variancePercent: number) => {
    // variance% = ((actual - target) / target) * 100
    // positive = exceeds target (good), negative = below target (bad)
    if (variancePercent >= 0) return { color: 'bg-emerald-500', label: t('production.excellent'), textColor: 'text-emerald-700' };
    if (variancePercent >= -10) return { color: 'bg-yellow-500', label: t('production.attention'), textColor: 'text-yellow-700' };
    return { color: 'bg-red-500', label: t('production.critical'), textColor: 'text-red-700' };
  };

  const getOutlookIcon = (currentOz: number, index: number) => {
    if (index === 0) return <Minus className="w-4 h-4 text-gray-400" />;
    const previousOz = productions[index - 1]?.estimated_oz || 0;

    if (currentOz > previousOz) {
      return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    } else if (currentOz < previousOz) {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const exportToCSV = () => {
    if (productions.length === 0) {
      alert(t('production.noDataToExport'));
      return;
    }

    const headers = [
      'Date de Production',
      'Société',
      'Bullion (g)',
      'Finesse Estimée (%)',
      'Or Pur (g)',
      'Oz Estimées',
      'Bar Reference',
      'Statut'
    ];

    const rows = productions.map(p => [
      new Date(p.production_date).toLocaleDateString('fr-FR'),
      getCompanyName(p.mining_company_id),
      p.bullion_grams.toFixed(2),
      p.estimated_fineness_pct.toFixed(1),
      p.pure_gold_grams.toFixed(2),
      p.estimated_oz.toFixed(4),
      p.bar_reference || '',
      p.status || 'N/A'
    ]);

    rows.push([
      'TOTAL',
      '',
      summary.total_bullion_grams.toFixed(2),
      '',
      summary.total_pure_gold_grams.toFixed(2),
      summary.total_estimated_oz.toFixed(4),
      '',
      ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `production_in_safe_${dateRange.startDate}_to_${dateRange.endDate}.csv`;
    link.click();
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'N/A';
    const company = miningCompanies.find(c => c.id === companyId);
    return company?.name || 'N/A';
  };

  // Render Period Card Component
  const PeriodCard = ({
    title,
    icon: Icon,
    data,
    borderColor
  }: {
    title: string;
    icon: any;
    data: PeriodData;
    borderColor: string;
  }) => {
    const budgetPercentage = calculatePercentage(data.actual, data.budget);
    const forecastPercentage = calculatePercentage(data.actual, data.forecast);
    const budgetGap = data.actual - data.budget;
    const forecastGap = data.actual - data.forecast;
    const budgetStatus = getTrafficLight(budgetPercentage);
    const forecastStatus = getTrafficLight(forecastPercentage);

    return (
      <Card className={`${borderColor} shadow-md hover:shadow-lg transition-shadow`}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
            <Icon className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              {title}
            </h3>
          </div>

          {/* Main Values */}
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium text-gray-600">{t('production.actual')}</span>
              <span className="text-xl font-bold text-gray-900">
                {safeToFixed(data.actual, 0)} oz
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-600">{t('production.budget')}</span>
              <span className="text-sm font-medium text-gray-700">
                {safeToFixed(data.budget, 0)} oz
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-600">{t('production.forecast')}</span>
              <span className="text-sm font-medium text-gray-700">
                {safeToFixed(data.forecast, 0)} oz
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-3"></div>

          {/* vs Budget */}
          <div className="bg-gradient-to-br from-blue-50 to-white p-2.5 rounded-lg border border-blue-200 mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${budgetStatus.color}`} />
                <span className="text-xs font-medium text-gray-700">{t('production.vsBudget')}</span>
              </div>
              <span className={`text-xs font-semibold ${budgetStatus.textColor}`}>
                {budgetStatus.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-blue-700">
                {safeToFixed(budgetPercentage, 1)}%
              </span>
              <div className="flex items-center gap-1">
                {budgetGap >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span className={`text-xs font-semibold ${
                  budgetGap >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {budgetGap >= 0 ? '+' : ''}{safeToFixed(budgetGap, 0)} oz
                </span>
              </div>
            </div>
          </div>

          {/* vs Prévision */}
          <div className="bg-gradient-to-br from-emerald-50 to-white p-2.5 rounded-lg border border-emerald-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${forecastStatus.color}`} />
                <span className="text-xs font-medium text-gray-700">{t('production.vsForecast')}</span>
              </div>
              <span className={`text-xs font-semibold ${forecastStatus.textColor}`}>
                {forecastStatus.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-emerald-700">
                {safeToFixed(forecastPercentage, 1)}%
              </span>
              <div className="flex items-center gap-1">
                {forecastGap >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span className={`text-xs font-semibold ${
                  forecastGap >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {forecastGap >= 0 ? '+' : ''}{safeToFixed(forecastGap, 0)} oz
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {t('production.productionInSafe')}
                </h1>
                <p className="text-xs text-gray-600">
                  {t('production.factoryManagementDashboard')}
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('production.exportCsv')}
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-slate-200">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {t('production.miningCompany')}
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">{t('production.allCompanies')}</option>
                  {miningCompanies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {t('production.status')}
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">{t('production.allStatuses')}</option>
                  <option value="prepared">{t('production.prepared')}</option>
                  <option value="ready_for_customs">{t('production.readyForCustoms')}</option>
                  <option value="shipped">{t('production.shipped')}</option>
                  <option value="refined">{t('production.refined')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {t('production.startDate')}
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {t('production.endDate')}
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Production Table */}
        <Card className="border-slate-200 shadow-lg">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t('production.barInventory')}</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {summary.record_count} {summary.record_count > 1 ? t('production.barsCount') : t('production.barCount')} · {safeToFixed(summary.total_estimated_oz, 2)} {t('production.ozTotal')}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-b-2 border-slate-300">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.date')}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.company')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.bullionG')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.finenessPercent')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.pureGoldG')}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.estimatedOz')}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.reference')}
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.outlook')}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {t('production.statusLabel')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                      {t('production.loadingData')}
                    </td>
                  </tr>
                ) : productions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                      {t('production.noProductionFound')}
                    </td>
                  </tr>
                ) : (
                  productions.map((prod, index) => (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/production/${prod.id}`)}
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          {new Date(prod.production_date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-700">
                          {getCompanyName(prod.mining_company_id)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <span className="text-xs text-gray-900">
                          {safeToLocaleString(prod.bullion_grams, { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {safeToFixed(prod.estimated_fineness_pct, 2)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <span className="text-xs text-amber-600 font-medium">
                          {safeToLocaleString(prod.pure_gold_grams, { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <span className="text-xs font-medium text-emerald-700">
                          {safeToFixed(prod.estimated_oz, 2)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-700">
                          {prod.bar_reference || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center">
                          {getOutlookIcon(prod.estimated_oz, index)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <ProductionStatusBadge status={prod.status as ProductionStatus} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && productions.length > 0 && (
                <tfoot className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-3 py-2.5 text-xs font-medium uppercase text-gray-900">
                      {t('production.total')}
                    </td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-900">
                      {safeToLocaleString(summary.total_bullion_grams, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-700">
                      {t('production.average')}: {safeToFixed(summary.avg_fineness_pct, 2)}%
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-900">
                      {safeToLocaleString(summary.total_pure_gold_grams, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-medium text-emerald-900">
                      {safeToFixed(summary.total_estimated_oz, 2)}
                    </td>
                    <td colSpan={3} className="px-3 py-2.5 text-xs text-gray-900">
                      {summary.record_count} {summary.record_count > 1 ? t('production.barsCount') : t('production.barCount')}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {/* KPI Tiles - 3 Period Cards Harmonized */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PeriodCard
            title={t('production.weekToDate')}
            icon={Calendar}
            data={forecasts.wtd}
            borderColor="border-l-4 border-l-blue-500"
          />
          <PeriodCard
            title={t('production.monthToDate')}
            icon={CalendarDays}
            data={forecasts.mtd}
            borderColor="border-l-4 border-l-emerald-500"
          />
          <PeriodCard
            title={t('production.yearToDate')}
            icon={CalendarCheck}
            data={forecasts.ytd}
            borderColor="border-l-4 border-l-emerald-500"
          />
        </div>
      </div>
    </MainLayout>
  );
}
