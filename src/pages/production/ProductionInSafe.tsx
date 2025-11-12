import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Filter, Download, TrendingUp, TrendingDown, Calendar, Building, Package } from 'lucide-react';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { ProductionStatus } from '@/constants/productionStatuses';
import { supabase } from '@/lib/supabase';
import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';

interface MiningCompany {
  id: string;
  name: string;
}

interface SafeProductionSummary {
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_estimated_oz: number;
  record_count: number;
}

interface ForecastData {
  wtd_forecast: number;
  wtd_budget: number;
  wtd_actual: number;
  mtd_forecast: number;
  mtd_budget: number;
  mtd_actual: number;
  month_forecast: number;
  month_budget: number;
}

export function ProductionInSafe() {
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Summary data
  const [summary, setSummary] = useState<SafeProductionSummary>({
    total_bullion_grams: 0,
    total_pure_gold_grams: 0,
    total_estimated_oz: 0,
    record_count: 0
  });

  // Forecast data (would come from DB in real implementation)
  const [forecasts] = useState<ForecastData>({
    wtd_forecast: 732,
    wtd_budget: 807,
    wtd_actual: 0,
    mtd_forecast: 2368,
    mtd_budget: 2735,
    mtd_actual: 0,
    month_forecast: 2368,
    month_budget: 2735
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
      const totalBullion = productionData.reduce((sum, p) => sum + p.bullion_grams, 0);
      const totalPureGold = productionData.reduce((sum, p) => sum + p.pure_gold_grams, 0);
      const totalOz = productionData.reduce((sum, p) => sum + p.estimated_oz, 0);

      setSummary({
        total_bullion_grams: totalBullion,
        total_pure_gold_grams: totalPureGold,
        total_estimated_oz: totalOz,
        record_count: productionData.length
      });

      // Calculate actual WTD and MTD
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const wtdData = productionData.filter(p => new Date(p.production_date) >= startOfWeek);
      const mtdData = productionData.filter(p => new Date(p.production_date) >= startOfMonth);

      forecasts.wtd_actual = wtdData.reduce((sum, p) => sum + p.estimated_oz, 0);
      forecasts.mtd_actual = mtdData.reduce((sum, p) => sum + p.estimated_oz, 0);

    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateVariance = (actual: number, target: number) => {
    return actual - target;
  };

  const calculatePercentage = (actual: number, target: number) => {
    if (target === 0) return 0;
    return ((actual / target) * 100) - 100;
  };

  const exportToCSV = () => {
    if (productions.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const headers = [
      'Date',
      'Bullion (g)',
      'Estimated Fineness (%)',
      'Pure Gold (g)',
      'Estimated Oz',
      'Bar Reference',
      'Société Minière',
      'Statut'
    ];

    const rows = productions.map(p => [
      new Date(p.production_date).toLocaleDateString('fr-FR'),
      p.bullion_grams.toFixed(2),
      p.estimated_fineness_pct.toFixed(1),
      p.pure_gold_grams.toFixed(2),
      p.estimated_oz.toFixed(4),
      p.bar_reference || '',
      getCompanyName(p.mining_company_id),
      p.status || 'N/A'
    ]);

    // Add total row
    rows.push([
      'TOTAL',
      summary.total_bullion_grams.toFixed(2),
      '',
      summary.total_pure_gold_grams.toFixed(2),
      summary.total_estimated_oz.toFixed(4),
      '',
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b-2 border-yellow-200 -mx-6 px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8 text-yellow-600" />
                Production In Safe
              </h1>
              <p className="text-gray-600 mt-1">
                Suivi des barres en coffre-fort et progression quotidienne
              </p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="shadow-sm hover:shadow-md transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 shadow-md">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Société Minière
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="all">Toutes les Sociétés</option>
                {miningCompanies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="all">Tous les Statuts</option>
                <option value="prepared">Préparé</option>
                <option value="shipped">Expédié</option>
                <option value="refined">Raffiné</option>
                <option value="sold">Vendu</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Début
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Fin
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>
        </Card>

        {/* Production Table */}
        <Card className="shadow-md overflow-hidden">
          <div className="bg-yellow-400 text-gray-900 py-3 px-6 border-b-4 border-yellow-500">
            <h2 className="text-xl font-bold">BULLION BAR IN SAFE</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-yellow-400">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-yellow-500">
                    DATE
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 border-r border-yellow-500">
                    BULLION (g)
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-red-700 border-r border-yellow-500">
                    ESTIMATED FINESSE (%)
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 border-r border-yellow-500">
                    PURE GOLD (g)
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-red-700 border-r border-yellow-500">
                    ESTIMATED Oz
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-yellow-500">
                    BAR REFERENCE
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-yellow-500">
                    SOCIÉTÉ MINIÈRE
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">
                    STATUT
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : productions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Aucune production trouvée
                    </td>
                  </tr>
                ) : (
                  productions.map((prod, index) => (
                    <tr
                      key={prod.id}
                      className={`${index % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} hover:bg-yellow-100 transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm border-r border-gray-200">
                        {new Date(prod.production_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium border-r border-gray-200">
                        {prod.bullion_grams.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-red-700 border-r border-gray-200">
                        {prod.estimated_fineness_pct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium border-r border-gray-200">
                        {prod.pure_gold_grams.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-red-700 border-r border-gray-200">
                        {prod.estimated_oz.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono border-r border-gray-200">
                        {prod.bar_reference || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm border-r border-gray-200">
                        {getCompanyName(prod.mining_company_id)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <ProductionStatusBadge status={prod.status as ProductionStatus} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
                {/* Total Row */}
                {!loading && productions.length > 0 && (
                  <tr className="bg-yellow-400 font-bold border-t-4 border-yellow-600">
                    <td className="px-4 py-3 text-sm font-bold border-r border-yellow-500">
                      TOTAL
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold border-r border-yellow-500">
                      {summary.total_bullion_grams.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 border-r border-yellow-500"></td>
                    <td className="px-4 py-3 text-sm text-right font-bold border-r border-yellow-500">
                      {summary.total_pure_gold_grams.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold border-r border-yellow-500">
                      {summary.total_estimated_oz.toFixed(0)}
                    </td>
                    <td colSpan={3} className="px-4 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* KPI Tiles Grid - Week to Date vs Month to Date */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Week to Date Section */}
          <Card className="shadow-lg">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-6 border-b-4 border-blue-700">
              <h3 className="text-lg font-bold">WEEK TO DATE (WTD)</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* WTD Forecast */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">WEEK TD FORECAST</span>
                <span className="text-lg font-bold text-gray-900">{forecasts.wtd_forecast} Oz</span>
              </div>

              {/* WTD Budget */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">WEEK TD BUDGET</span>
                <span className="text-lg font-bold text-gray-900">{forecasts.wtd_budget} Oz</span>
              </div>

              {/* WTD Actual */}
              <div className="flex justify-between items-center py-3 bg-blue-50 rounded-lg px-4 border-2 border-blue-200">
                <span className="text-sm font-bold text-blue-900">WEEK DT ACTUAL</span>
                <span className="text-xl font-bold text-blue-900">{forecasts.wtd_actual.toFixed(0)} Oz</span>
              </div>

              {/* WTD Actual vs Forecast */}
              <div className={`flex justify-between items-center py-3 px-4 rounded-lg ${
                calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <span className="text-sm font-bold">WEEK ACTUAL VS FORECAST</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`text-lg font-bold ${
                      calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {Math.abs(calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast)).toFixed(0)} Oz
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({calculatePercentage(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? '+' : ''}{calculatePercentage(forecasts.wtd_actual, forecasts.wtd_forecast).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* WTD Actual vs Budget */}
              <div className={`flex justify-between items-center py-3 px-4 rounded-lg ${
                calculateVariance(forecasts.wtd_actual, forecasts.wtd_budget) >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <span className="text-sm font-bold">WEEK ACTUAL VS BUDGET</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {calculateVariance(forecasts.wtd_actual, forecasts.wtd_budget) >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`text-lg font-bold ${
                      calculateVariance(forecasts.wtd_actual, forecasts.wtd_budget) >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {Math.abs(calculateVariance(forecasts.wtd_actual, forecasts.wtd_budget)).toFixed(0)} Oz
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    calculateVariance(forecasts.wtd_actual, forecasts.wtd_budget) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({calculatePercentage(forecasts.wtd_actual, forecasts.wtd_budget) >= 0 ? '+' : ''}{calculatePercentage(forecasts.wtd_actual, forecasts.wtd_budget).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Month to Date Section */}
          <Card className="shadow-lg">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white py-4 px-6 border-b-4 border-purple-700">
              <h3 className="text-lg font-bold">MONTH TO DATE (MTD)</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* MTD Forecast */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">MTD FORECAST</span>
                <span className="text-lg font-bold text-gray-900">{forecasts.mtd_forecast} Oz</span>
              </div>

              {/* MTD Budget */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">MTD BUDGET</span>
                <span className="text-lg font-bold text-gray-900">{forecasts.mtd_budget} Oz</span>
              </div>

              {/* MTD Actual */}
              <div className="flex justify-between items-center py-3 bg-purple-50 rounded-lg px-4 border-2 border-purple-200">
                <span className="text-sm font-bold text-purple-900">MONTH ACTUAL</span>
                <span className="text-xl font-bold text-purple-900">{forecasts.mtd_actual.toFixed(0)} Oz</span>
              </div>

              {/* MTD Actual vs Forecast */}
              <div className={`flex justify-between items-center py-3 px-4 rounded-lg ${
                calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <span className="text-sm font-bold">MTD ACTUAL vs MTD FORECAST</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-yellow-600" />
                    )}
                    <span className={`text-lg font-bold ${
                      calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {Math.abs(calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast)).toFixed(0)} Oz
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    ({calculatePercentage(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? '+' : ''}{calculatePercentage(forecasts.mtd_actual, forecasts.mtd_forecast).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* MTD Actual vs Budget */}
              <div className={`flex justify-between items-center py-3 px-4 rounded-lg ${
                calculateVariance(forecasts.mtd_actual, forecasts.mtd_budget) >= 0 ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <span className="text-sm font-bold">MTD ACTUAL vs MTD BUDGET</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {calculateVariance(forecasts.mtd_actual, forecasts.mtd_budget) >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-yellow-600" />
                    )}
                    <span className={`text-lg font-bold ${
                      calculateVariance(forecasts.mtd_actual, forecasts.mtd_budget) >= 0 ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {Math.abs(calculateVariance(forecasts.mtd_actual, forecasts.mtd_budget)).toFixed(0)} Oz
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    calculateVariance(forecasts.mtd_actual, forecasts.mtd_budget) >= 0 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    ({calculatePercentage(forecasts.mtd_actual, forecasts.mtd_budget) >= 0 ? '+' : ''}{calculatePercentage(forecasts.mtd_actual, forecasts.mtd_budget).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Monthly Targets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">MONTH BUDGET</span>
              <span className="text-2xl font-bold text-gray-900">{forecasts.month_budget} Oz</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">MONTH FORECAST</span>
              <span className="text-2xl font-bold text-gray-900">{forecasts.month_forecast} Oz</span>
            </div>
          </Card>
        </div>

        {/* Variance Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={`p-6 shadow-md ${
            calculateVariance(forecasts.mtd_actual, forecasts.month_forecast) >= 0 ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">MONTH FORCAST vs ACTUAL</span>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  {calculateVariance(forecasts.mtd_actual, forecasts.month_forecast) >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-yellow-600" />
                  )}
                  <span className={`text-2xl font-bold ${
                    calculateVariance(forecasts.mtd_actual, forecasts.month_forecast) >= 0 ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {Math.abs(calculateVariance(forecasts.mtd_actual, forecasts.month_forecast)).toFixed(0)} Oz
                  </span>
                </div>
                <span className={`text-sm font-semibold ${
                  calculateVariance(forecasts.mtd_actual, forecasts.month_forecast) >= 0 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  ({calculatePercentage(forecasts.mtd_actual, forecasts.month_forecast) >= 0 ? '+' : ''}{calculatePercentage(forecasts.mtd_actual, forecasts.month_forecast).toFixed(1)}%)
                </span>
              </div>
            </div>
          </Card>

          <Card className={`p-6 shadow-md ${
            calculateVariance(forecasts.mtd_actual, forecasts.month_budget) >= 0 ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">MONTH BUDGET vs MONTH ACTUAL</span>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  {calculateVariance(forecasts.mtd_actual, forecasts.month_budget) >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-yellow-600" />
                  )}
                  <span className={`text-2xl font-bold ${
                    calculateVariance(forecasts.mtd_actual, forecasts.month_budget) >= 0 ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {Math.abs(calculateVariance(forecasts.mtd_actual, forecasts.month_budget)).toFixed(0)} Oz
                  </span>
                </div>
                <span className={`text-sm font-semibold ${
                  calculateVariance(forecasts.mtd_actual, forecasts.month_budget) >= 0 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  ({calculatePercentage(forecasts.mtd_actual, forecasts.month_budget) >= 0 ? '+' : ''}{calculatePercentage(forecasts.mtd_actual, forecasts.month_budget).toFixed(1)}%)
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
