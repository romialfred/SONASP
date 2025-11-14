import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, TrendingUp, TrendingDown, Minus, Shield, Calendar } from 'lucide-react';
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

interface ForecastData {
  ytd_forecast: number;
  ytd_budget: number;
  ytd_actual: number;
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

  const navigate = useNavigate();

  // Summary data
  const [summary, setSummary] = useState<SafeProductionSummary>({
    total_bullion_grams: 0,
    total_pure_gold_grams: 0,
    total_estimated_oz: 0,
    avg_fineness_pct: 0,
    record_count: 0
  });

  // Forecast data
  const [forecasts, setForecasts] = useState<ForecastData>({
    ytd_forecast: 5000,
    ytd_budget: 5500,
    ytd_actual: 0
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

      // Calculate YTD actual
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const ytdData = productionData.filter(p => new Date(p.production_date) >= startOfYear);
      setForecasts(prev => ({
        ...prev,
        ytd_actual: ytdData.reduce((sum, p) => sum + p.estimated_oz, 0)
      }));

    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (actual: number, target: number) => {
    if (target === 0) return 0;
    return (actual / target) * 100;
  };

  const getTrafficLight = (percentage: number) => {
    if (percentage >= 95) return { color: 'bg-emerald-500', label: 'Excellent' };
    if (percentage >= 85) return { color: 'bg-yellow-500', label: 'Attention' };
    return { color: 'bg-red-500', label: 'Critique' };
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
      alert('Aucune donnée à exporter');
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

  const forecastPercentage = calculatePercentage(forecasts.ytd_actual, forecasts.ytd_forecast);
  const budgetPercentage = calculatePercentage(forecasts.ytd_actual, forecasts.ytd_budget);
  const forecastTrafficLight = getTrafficLight(forecastPercentage);
  const budgetTrafficLight = getTrafficLight(budgetPercentage);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-amber-200">
                <Shield className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Production en Coffre-Fort
                </h1>
                <p className="text-sm text-gray-600">
                  Tableau de bord Management Usine
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="border-amber-300 hover:bg-amber-50 text-amber-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-amber-200">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Société Minière
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="all">Toutes</option>
                  {miningCompanies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="all">Tous</option>
                  <option value="prepared">Préparé</option>
                  <option value="ready_for_customs">Prêt pour Douane</option>
                  <option value="shipped">Expédié</option>
                  <option value="refined">Raffiné</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Date Début
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Date Fin
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Production Table - EN HAUT */}
        <Card className="border-amber-200 shadow-lg">
          <div className="p-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Inventaire des Barres</h3>
                <p className="text-xs text-gray-600 mt-1">
                  {summary.record_count} barre{summary.record_count > 1 ? 's' : ''} · {safeToFixed(summary.total_estimated_oz, 2)} oz au total
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border-b-2 border-amber-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Date Production
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Société
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Bullion (g)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Finesse %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Or Pur (g)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Oz Estimées
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Bar Reference
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Outlook
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                      Chargement des données...
                    </td>
                  </tr>
                ) : productions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                      Aucune production trouvée
                    </td>
                  </tr>
                ) : (
                  productions.map((prod, index) => (
                    <tr
                      key={prod.id}
                      className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/production/${prod.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {new Date(prod.production_date).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                        {getCompanyName(prod.mining_company_id)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {safeToLocaleString(prod.bullion_grams, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">
                        {safeToFixed(prod.estimated_fineness_pct, 2)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {safeToLocaleString(prod.pure_gold_grams, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-amber-700">
                        {safeToFixed(prod.estimated_oz, 2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700 font-medium">
                        {prod.bar_reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          {getOutlookIcon(prod.estimated_oz, index)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <ProductionStatusBadge status={prod.status as ProductionStatus} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && productions.length > 0 && (
                <tfoot className="bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 border-t-2 border-amber-300">
                  <tr>
                    <td className="px-4 py-4 text-xs font-bold uppercase text-gray-900">
                      Total
                    </td>
                    <td className="px-4 py-4"></td>
                    <td className="px-4 py-4 text-sm text-right font-bold text-gray-900">
                      {safeToLocaleString(summary.total_bullion_grams, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-medium text-gray-700">
                      Moy: {safeToFixed(summary.avg_fineness_pct, 2)}%
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-bold text-gray-900">
                      {safeToLocaleString(summary.total_pure_gold_grams, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-4 text-base text-right font-bold text-amber-900">
                      {safeToFixed(summary.total_estimated_oz, 2)}
                    </td>
                    <td colSpan={3} className="px-4 py-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {/* KPI Tiles - APRÈS LE TABLEAU */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Year to Date Progress */}
          <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-shadow">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Year to Date
                  </h3>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-medium text-gray-600">Réalisé</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {safeToFixed(forecasts.ytd_actual, 0)} oz
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Budget</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {safeToFixed(forecasts.ytd_budget, 0)} oz
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Forecast</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {safeToFixed(forecasts.ytd_forecast, 0)} oz
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-600">Progrès vs Budget</span>
                    <span className="text-xs font-bold text-gray-900">
                      {safeToFixed(budgetPercentage, 1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* vs Forecast */}
          <Card className="border-t-4 border-t-emerald-500 shadow-md hover:shadow-lg transition-shadow">
            <div className="p-5">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                vs Forecast
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${forecastTrafficLight.color}`} />
                    <span className="text-xs font-medium text-gray-600">Status</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {forecastTrafficLight.label}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-gray-600">Performance</span>
                    <span className="text-3xl font-bold text-emerald-700">
                      {safeToFixed(forecastPercentage, 1)}%
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {forecastPercentage >= 100 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      forecastPercentage >= 100 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {forecastPercentage >= 100 ? 'Au-dessus' : 'En-dessous'} de la prévision
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">Écart</span>
                  <span className={`font-bold ${
                    forecasts.ytd_actual >= forecasts.ytd_forecast
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}>
                    {forecasts.ytd_actual >= forecasts.ytd_forecast ? '+' : ''}
                    {safeToFixed(forecasts.ytd_actual - forecasts.ytd_forecast, 0)} oz
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* vs Budget */}
          <Card className="border-t-4 border-t-blue-500 shadow-md hover:shadow-lg transition-shadow">
            <div className="p-5">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                vs Budget
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${budgetTrafficLight.color}`} />
                    <span className="text-xs font-medium text-gray-600">Status</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {budgetTrafficLight.label}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-gray-600">Performance</span>
                    <span className="text-3xl font-bold text-blue-700">
                      {safeToFixed(budgetPercentage, 1)}%
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {budgetPercentage >= 100 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      budgetPercentage >= 100 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {budgetPercentage >= 100 ? 'Au-dessus' : 'En-dessous'} du budget
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">Écart</span>
                  <span className={`font-bold ${
                    forecasts.ytd_actual >= forecasts.ytd_budget
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}>
                    {forecasts.ytd_actual >= forecasts.ytd_budget ? '+' : ''}
                    {safeToFixed(forecasts.ytd_actual - forecasts.ytd_budget, 0)} oz
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
