import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Tabs } from '@/components/ui/Tabs';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Factory,
  BarChart3,
  Download,
  Calendar,
  Filter,
  PieChart,
  LineChart as LineChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Truck,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from 'recharts';
import { AdvancedAnalyticsService } from '@/services/advancedAnalyticsService';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';

/**
 * Analytics Intelligence Center - Professional BI Dashboard
 *
 * Features:
 * - Global KPIs with drill-downs
 * - Production analytics (by company, period)
 * - Financial analytics (revenue, costs, royalties)
 * - Sales performance tracking
 * - Budget vs Actual comparisons
 * - Advanced filtering and exports
 */

const CHART_COLORS = {
  primary: ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
};

export function AnalyticsIntelligenceCenter() {
  const { t, i18n } = useTranslation();

  // State management
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [periodType, setPeriodType] = useState<'month' | 'quarter'>('month');

  // Analytics data
  const [globalKPIs, setGlobalKPIs] = useState<any>(null);
  const [financialKPIs, setFinancialKPIs] = useState<any>(null);
  const [productionByCompany, setProductionByCompany] = useState<any[]>([]);
  const [productionByPeriod, setProductionByPeriod] = useState<any[]>([]);
  const [revenueByCompany, setRevenueByCompany] = useState<any[]>([]);
  const [salesPerformance, setSalesPerformance] = useState<any[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<any[]>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<any[]>([]);

  // Load all analytics data
  const loadAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = dateRange;
      const companyId = selectedCompany === 'all' ? undefined : selectedCompany;

      // Load all analytics in parallel
      const [
        globalData,
        financialData,
        prodByCompany,
        prodByPeriod,
        revByCompany,
        salesPerf,
        costs,
        budget,
      ] = await Promise.all([
        AdvancedAnalyticsService.getGlobalProductionKPIs(startDate, endDate, companyId),
        AdvancedAnalyticsService.getFinancialKPIs(startDate, endDate),
        AdvancedAnalyticsService.getProductionByCompany(startDate, endDate),
        AdvancedAnalyticsService.getProductionByPeriod(startDate, endDate, periodType, companyId),
        AdvancedAnalyticsService.getRevenueByCompany(startDate, endDate),
        AdvancedAnalyticsService.getSalesPerformance(startDate, endDate, periodType),
        AdvancedAnalyticsService.getCostBreakdown(startDate, endDate),
        AdvancedAnalyticsService.getBudgetVsActual(new Date(startDate).getFullYear(), companyId),
      ]);

      setGlobalKPIs(globalData);
      setFinancialKPIs(financialData);
      setProductionByCompany(prodByCompany);
      setProductionByPeriod(prodByPeriod);
      setRevenueByCompany(revByCompany);
      setSalesPerformance(salesPerf);
      setCostBreakdown(costs);
      setBudgetVsActual(budget);
    } catch (error) {
      console.error('[Analytics] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCompany, periodType]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Export handlers
  const handleExportProduction = () => {
    AdvancedAnalyticsService.exportToCSV(productionByPeriod, 'production_analytics');
  };

  const handleExportFinancial = () => {
    AdvancedAnalyticsService.exportToCSV(salesPerformance, 'financial_analytics');
  };

  const handleExportBudget = () => {
    AdvancedAnalyticsService.exportToCSV(budgetVsActual, 'budget_vs_actual');
  };

  if (loading && !globalKPIs) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-200">
          <div>
            <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent mb-2">
              {t('pages.analytics.intelligenceCenter')}
            </h1>
            <p className="text-gray-600 text-lg">{t('pages.analytics.subtitle')}</p>
          </div>
          <Button
            onClick={loadAnalyticsData}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('pages.analytics.refresh')}
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('pages.analytics.startDate')}
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('pages.analytics.endDate')}
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  {t('pages.analytics.periodType')}
                </label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as 'month' | 'quarter')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="month">{t('pages.analytics.monthly')}</option>
                  <option value="quarter">{t('pages.analytics.quarterly')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Factory className="w-3 h-3" />
                  {t('pages.analytics.miningCompany')}
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">{t('pages.analytics.allCompanies')}</option>
                  {productionByCompany.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.companyName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global KPIs - Modern Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Production KPI */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  <TrendingUp className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">+12.5%</span>
                </div>
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">{t('pages.analytics.totalProduction')}</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {globalKPIs?.totalPureGoldOz.toFixed(2)} oz
                </p>
                <p className="text-blue-200 text-xs">
                  {globalKPIs?.productionCount} {t('pages.analytics.batchesProduced')}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue KPI */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  <TrendingUp className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">+18.3%</span>
                </div>
              </div>
              <div>
                <p className="text-emerald-100 text-sm font-medium mb-1">{t('pages.analytics.totalRevenue')}</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {formatCurrency(financialKPIs?.totalRevenue || 0)}
                </p>
                <p className="text-emerald-200 text-xs">
                  {financialKPIs?.totalQuantitySoldOz.toFixed(2)} oz sold
                </p>
              </div>
            </div>
          </div>

          {/* Royalties KPI */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div className="px-2 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">3%</span>
                </div>
              </div>
              <div>
                <p className="text-amber-100 text-sm font-medium mb-1">{t('pages.analytics.totalRoyalties')}</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {formatCurrency(financialKPIs?.totalRoyalties || 0)}
                </p>
                <p className="text-amber-200 text-xs">
                  {t('pages.analytics.standardRoyalty')}
                </p>
              </div>
            </div>
          </div>

          {/* Transport Costs KPI */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  <TrendingDown className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">-5.2%</span>
                </div>
              </div>
              <div>
                <p className="text-slate-100 text-sm font-medium mb-1">{t('pages.analytics.transportCosts')}</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {formatCurrency(financialKPIs?.totalTransportCosts || 0)}
                </p>
                <p className="text-slate-200 text-xs">
                  {t('pages.analytics.freightLogistics')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for detailed analytics */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { value: 'overview', label: t('pages.analytics.overview'), icon: <BarChart3 className="w-4 h-4" /> },
            { value: 'production', label: t('pages.analytics.production'), icon: <Package className="w-4 h-4" /> },
            { value: 'financial', label: t('pages.analytics.financial'), icon: <DollarSign className="w-4 h-4" /> },
            { value: 'budget', label: t('pages.analytics.budgetVsActual'), icon: <TrendingUp className="w-4 h-4" /> },
          ]}
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Production by Company */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                    <CardTitle className="flex items-center gap-2">
                      <Factory className="w-5 h-5 text-blue-600" />
                      {t('pages.analytics.productionDistribution')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={productionByCompany}
                          dataKey="totalPureGoldOz"
                          nameKey="companyName"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.companyName}: ${entry.percentage.toFixed(1)}%`}
                        >
                          {productionByCompany.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => `${value.toFixed(2)} oz`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200">
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-amber-600" />
                      {t('pages.analytics.costBreakdownAnalysis')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={costBreakdown}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.category}: ${formatCurrency(entry.amount)}`}
                        >
                          <Cell fill={CHART_COLORS.info} />
                          <Cell fill={CHART_COLORS.warning} />
                          <Cell fill={CHART_COLORS.success} />
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(value)} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue by Company Table */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      {t('pages.analytics.revenueDistribution')}
                    </CardTitle>
                    <Button
                      onClick={() => AdvancedAnalyticsService.exportToCSV(revenueByCompany, 'revenue_by_company')}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t('pages.analytics.export')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.company')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.revenue')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.royalties')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.quantity')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.sales')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.percentShare')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {revenueByCompany.map((company, index) => (
                          <tr key={index} className="hover:bg-emerald-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{company.companyName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-600 font-bold">{formatCurrency(company.totalRevenue)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-amber-600 font-semibold">{formatCurrency(company.totalRoyalties)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium">{company.totalQuantityOz.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">{company.salesCount}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
                                {company.percentage.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Production Tab */}
          {activeTab === 'production' && (
            <div className="space-y-6 mt-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <LineChartIcon className="w-5 h-5 text-blue-600" />
                      {t('pages.analytics.productionTrend')} ({periodType === 'month' ? t('pages.analytics.monthly') : t('pages.analytics.quarterly')})
                    </CardTitle>
                    <Button
                      onClick={handleExportProduction}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t('pages.analytics.export')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={productionByPeriod}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Ounces', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'Count', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="totalPureGoldOz" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.2} name="Gold Produced (oz)" />
                      <Bar yAxisId="right" dataKey="productionCount" fill="#10b981" name="Production Count" />
                      {budgetVsActual.length > 0 && (
                        <Line yAxisId="left" type="monotone" dataKey="budgetOz" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Budget Target (oz)" />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Production by Company Details */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="w-5 h-5 text-blue-600" />
                    {t('pages.analytics.productionPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.company')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.bullionGrams')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.pureGoldOz')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.avgFineness')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.batches')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.percentShare')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {productionByCompany.map((company, index) => (
                          <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{company.companyName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium">{company.totalBullionGrams.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-blue-600 font-bold">{company.totalPureGoldOz.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">{company.avgFinenessPct.toFixed(2)}%</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">{company.productionCount}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                                {company.percentage.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Financial Tab */}
          {activeTab === 'financial' && (
            <div className="space-y-6 mt-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <LineChartIcon className="w-5 h-5 text-emerald-600" />
                      {t('pages.analytics.salesPerformanceTrend')} ({periodType === 'month' ? t('pages.analytics.monthly') : t('pages.analytics.quarterly')})
                    </CardTitle>
                    <Button
                      onClick={handleExportFinancial}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t('pages.analytics.export')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={salesPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'Quantity (oz)', angle: 90, position: 'insideRight' }} />
                      <Tooltip formatter={(value: any, name: string) => name.includes('Revenue') ? formatCurrency(value) : `${value.toFixed(2)} oz`} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#10b981" name="Revenue" />
                      <Line yAxisId="right" type="monotone" dataKey="quantityOz" stroke="#3b82f6" strokeWidth={3} name="Quantity Sold (oz)" />
                      <Line yAxisId="left" type="monotone" dataKey="avgPrice" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Avg Price/oz" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-emerald-600" />
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('pages.analytics.totalRevenue')}</p>
                      <p className="text-3xl font-bold text-emerald-600 mb-2">{formatCurrency(financialKPIs?.totalRevenue || 0)}</p>
                      <p className="text-xs text-gray-500">{t('pages.analytics.grossProceeds')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-amber-600" />
                      </div>
                      <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">3%</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('pages.analytics.totalRoyalties')}</p>
                      <p className="text-3xl font-bold text-amber-600 mb-2">{formatCurrency(financialKPIs?.totalRoyalties || 0)}</p>
                      <p className="text-xs text-gray-500">{t('pages.analytics.standardRoyalty')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-blue-600" />
                      </div>
                      <ArrowDownRight className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('pages.analytics.netProceeds')}</p>
                      <p className="text-3xl font-bold text-blue-600 mb-2">{formatCurrency(financialKPIs?.netProceeds || 0)}</p>
                      <p className="text-xs text-gray-500">{t('pages.analytics.afterCostsRoyalties')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Budget vs Actual Tab */}
          {activeTab === 'budget' && (
            <div className="space-y-6 mt-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      {t('pages.analytics.budgetPerformance')}
                    </CardTitle>
                    <Button
                      onClick={handleExportBudget}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t('pages.analytics.export')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={budgetVsActual}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} label={{ value: 'Ounces (oz)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="budgetOz" fill="#a855f7" name="Budget Target" />
                      <Bar dataKey="actualOz" fill="#10b981" name="Actual Production" />
                      <Line type="monotone" dataKey="variance" stroke="#ef4444" strokeWidth={2} name="Variance" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Budget variance table */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    {t('pages.analytics.detailedVariance')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.period')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.budgetOz')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.actualOz')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.varianceOz')}</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.variancePct')}</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">{t('pages.analytics.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {budgetVsActual.map((item, index) => {
                          const isPositive = item.variance >= 0;
                          return (
                            <tr key={index} className="hover:bg-purple-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{item.periodLabel}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-purple-600">{item.budgetOz.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">{item.actualOz.toFixed(2)}</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isPositive ? '+' : ''}{item.variance.toFixed(2)}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isPositive ? '+' : ''}{item.variancePct.toFixed(1)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {isPositive ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
                                    <TrendingUp className="w-3 h-3" />
                                    {t('pages.analytics.aboveTarget')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                                    <TrendingDown className="w-3 h-3" />
                                    {t('pages.analytics.belowTarget')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
