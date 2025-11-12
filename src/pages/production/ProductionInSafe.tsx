import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, TrendingUp, TrendingDown, Shield, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { DailyProduction } from '@/services/dailyProductionService';
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
  ytd_forecast: number;
  ytd_budget: number;
  ytd_actual: number;
  month_forecast: number;
  month_budget: number;
}

interface StatusCount {
  prepared: number;
  shipped: number;
  refined: number;
  sold: number;
}

export function ProductionInSafe() {
  const navigate = useNavigate();
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [summary, setSummary] = useState<SafeProductionSummary>({
    total_bullion_grams: 0,
    total_pure_gold_grams: 0,
    total_estimated_oz: 0,
    record_count: 0
  });

  const [statusCounts, setStatusCounts] = useState<StatusCount>({
    prepared: 0,
    shipped: 0,
    refined: 0,
    sold: 0
  });

  const [forecasts] = useState<ForecastData>({
    wtd_forecast: 732,
    wtd_budget: 807,
    wtd_actual: 0,
    mtd_forecast: 2368,
    mtd_budget: 2735,
    mtd_actual: 0,
    ytd_forecast: 12500,
    ytd_budget: 14000,
    ytd_actual: 0,
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

      const totalBullion = productionData.reduce((sum, p) => sum + p.bullion_grams, 0);
      const totalPureGold = productionData.reduce((sum, p) => sum + p.pure_gold_grams, 0);
      const totalOz = productionData.reduce((sum, p) => sum + p.estimated_oz, 0);

      setSummary({
        total_bullion_grams: totalBullion,
        total_pure_gold_grams: totalPureGold,
        total_estimated_oz: totalOz,
        record_count: productionData.length
      });

      const counts: StatusCount = {
        prepared: productionData.filter(p => p.status === 'prepared').length,
        shipped: productionData.filter(p => p.status === 'shipped').length,
        refined: productionData.filter(p => p.status === 'refined').length,
        sold: productionData.filter(p => p.status === 'sold').length
      };
      setStatusCounts(counts);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const wtdData = productionData.filter(p => new Date(p.production_date) >= startOfWeek);
      const mtdData = productionData.filter(p => new Date(p.production_date) >= startOfMonth);
      const ytdData = productionData.filter(p => new Date(p.production_date) >= startOfYear);

      forecasts.wtd_actual = wtdData.reduce((sum, p) => sum + p.estimated_oz, 0);
      forecasts.mtd_actual = mtdData.reduce((sum, p) => sum + p.estimated_oz, 0);
      forecasts.ytd_actual = ytdData.reduce((sum, p) => sum + p.estimated_oz, 0);

    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateVariance = (actual: number, target: number) => actual - target;

  const calculatePercentage = (actual: number, target: number) => {
    if (target === 0) return 0;
    return ((actual / target) * 100) - 100;
  };

  const generateSummaryText = (): string => {
    const totalBars = summary.record_count;
    const totalOz = Math.round(summary.total_estimated_oz);

    const statuses = [];
    if (statusCounts.prepared > 0) statuses.push(`${statusCounts.prepared} en préparation`);
    if (statusCounts.shipped > 0) statuses.push(`${statusCounts.shipped} expédiées`);
    if (statusCounts.refined > 0) statuses.push(`${statusCounts.refined} raffinées`);
    if (statusCounts.sold > 0) statuses.push(`${statusCounts.sold} vendues`);

    const wtdVariance = calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast);
    const mtdVariance = calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast);

    let perfText = '';
    if (wtdVariance < 0) {
      perfText = `Performance hebdomadaire en retard de ${Math.abs(Math.round(wtdVariance))} oz par rapport à la prévision.`;
    } else {
      perfText = `Performance hebdomadaire conforme avec ${Math.round(wtdVariance)} oz au-dessus de la prévision.`;
    }

    if (mtdVariance < 0) {
      perfText += ` Performance mensuelle nécessite attention (${Math.abs(Math.round(mtdVariance))} oz de retard).`;
    } else {
      perfText += ` Performance mensuelle sur la bonne voie (+${Math.round(mtdVariance)} oz).`;
    }

    return `${totalBars} barres totalisant ${totalOz} oz en coffre-fort (${statuses.join(', ')}). ${perfText}`;
  };

  const exportToCSV = () => {
    if (productions.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const headers = ['Date', 'Bullion (g)', 'Finesse (%)', 'Or Pur (g)', 'Oz Estimées', 'Référence', 'Société', 'Statut'];
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

    rows.push(['TOTAL', summary.total_bullion_grams.toFixed(2), '', summary.total_pure_gold_grams.toFixed(2), summary.total_estimated_oz.toFixed(4), '', '', '']);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
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

  const getStatusIcon = () => {
    const wtdVariance = calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast);
    const mtdVariance = calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast);

    if (wtdVariance >= 0 && mtdVariance >= 0) {
      return <CheckCircle className="w-5 h-5 text-emerald-600" />;
    } else if (wtdVariance < 0 || mtdVariance < 0) {
      return <AlertCircle className="w-5 h-5 text-amber-600" />;
    }
    return <Shield className="w-5 h-5 text-slate-600" />;
  };

  const handleRowClick = (productionId: string) => {
    navigate(`/production/${productionId}`, { state: { from: '/production/in-safe' } });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Shield className="w-6 h-6 text-slate-700" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Production en Coffre-Fort</h1>
            </div>
            <p className="text-sm text-gray-600">Suivi et analyse des barres d'or</p>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="border-slate-300 hover:bg-slate-50">
            <Download className="w-4 h-4 mr-2" />Exporter
          </Button>
        </div>

        <Card className="border-l-4 border-l-slate-700 bg-gradient-to-r from-slate-50 to-white">
          <div className="p-5">
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Résumé de la situation</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{generateSummaryText()}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Filtres</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Société Minière</label>
                <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500">
                  <option value="all">Toutes</option>
                  {miningCompanies.map(company => (<option key={company.id} value={company.id}>{company.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Statut</label>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500">
                  <option value="all">Tous</option>
                  <option value="prepared">Préparé</option>
                  <option value="shipped">Expédié</option>
                  <option value="refined">Raffiné</option>
                  <option value="sold">Vendu</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Date Début</label>
                <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Date Fin</label>
                <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Inventaire des Barres</h3>
                <p className="text-xs text-gray-600 mt-0.5">{summary.record_count} barres · {summary.total_estimated_oz.toFixed(0)} oz total</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Bullion (g)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Finesse (%)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Or Pur (g)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Oz Estimées</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Référence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Société</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">Chargement...</td></tr>
                ) : productions.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">Aucune production trouvée</td></tr>
                ) : (
                  productions.map((prod, index) => (
                    <tr key={prod.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors cursor-pointer`} onClick={() => handleRowClick(prod.id)}>
                      <td className="px-4 py-3 text-sm text-gray-900">{new Date(prod.production_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{prod.bullion_grams.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-blue-700">{prod.estimated_fineness_pct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{prod.pure_gold_grams.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">{prod.estimated_oz.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{prod.bar_reference || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{getCompanyName(prod.mining_company_id)}</td>
                      <td className="px-4 py-3 text-sm"><ProductionStatusBadge status={prod.status as ProductionStatus} size="sm" /></td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); handleRowClick(prod.id); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors">
                          <Eye className="w-3.5 h-3.5" />Voir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && productions.length > 0 && (
                <tfoot className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold uppercase">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{summary.total_bullion_grams.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{summary.total_pure_gold_grams.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{summary.total_estimated_oz.toFixed(2)}</td>
                    <td colSpan={4} className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-t-4 border-t-blue-600">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-900">Performance Hebdomadaire</h3>
              <p className="text-xs text-gray-500 mt-0.5">Week to Date</p>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-600">Prévision</span>
                <span className="text-sm font-semibold text-gray-900">{forecasts.wtd_forecast} oz</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-600">Budget</span>
                <span className="text-sm font-semibold text-gray-900">{forecasts.wtd_budget} oz</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-blue-50 rounded-lg px-3">
                <span className="text-xs font-semibold text-blue-900">Réalisé</span>
                <span className="text-base font-bold text-blue-900">{forecasts.wtd_actual.toFixed(0)} oz</span>
              </div>
              <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <span className="text-xs font-semibold text-gray-700">vs Prévision</span>
                <div className="flex items-center gap-1.5">
                  {calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                  <span className={`text-sm font-bold ${calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? '+' : ''}{calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast).toFixed(0)}</span>
                  <span className={`text-xs ${calculateVariance(forecasts.wtd_actual, forecasts.wtd_forecast) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>({calculatePercentage(forecasts.wtd_actual, forecasts.wtd_forecast).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-t-4 border-t-purple-600">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-900">Performance Mensuelle</h3>
              <p className="text-xs text-gray-500 mt-0.5">Month to Date</p>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-600">Prévision</span>
                <span className="text-sm font-semibold text-gray-900">{forecasts.mtd_forecast} oz</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-600">Budget</span>
                <span className="text-sm font-semibold text-gray-900">{forecasts.mtd_budget} oz</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-purple-50 rounded-lg px-3">
                <span className="text-xs font-semibold text-purple-900">Réalisé</span>
                <span className="text-base font-bold text-purple-900">{forecasts.mtd_actual.toFixed(0)} oz</span>
              </div>
              <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <span className="text-xs font-semibold text-gray-700">vs Prévision</span>
                <div className="flex items-center gap-1.5">
                  {calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-amber-600" />}
                  <span className={`text-sm font-bold ${calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? '+' : ''}{calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast).toFixed(0)}</span>
                  <span className={`text-xs ${calculateVariance(forecasts.mtd_actual, forecasts.mtd_forecast) >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>({calculatePercentage(forecasts.mtd_actual, forecasts.mtd_forecast).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-t-4 border-t-emerald-600">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-900">Performance Annuelle</h3>
              <p className="text-xs text-gray-500 mt-0.5">Year to Date</p>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-600">Prévision</span>
                <span className="text-sm font-semibold text-gray-900">{forecasts.ytd_forecast} oz</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-600">Budget</span>
                <span className="text-sm font-semibold text-gray-900">{forecasts.ytd_budget} oz</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-emerald-50 rounded-lg px-3">
                <span className="text-xs font-semibold text-emerald-900">Réalisé</span>
                <span className="text-base font-bold text-emerald-900">{forecasts.ytd_actual.toFixed(0)} oz</span>
              </div>
              <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${calculateVariance(forecasts.ytd_actual, forecasts.ytd_forecast) >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <span className="text-xs font-semibold text-gray-700">vs Prévision</span>
                <div className="flex items-center gap-1.5">
                  {calculateVariance(forecasts.ytd_actual, forecasts.ytd_forecast) >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-amber-600" />}
                  <span className={`text-sm font-bold ${calculateVariance(forecasts.ytd_actual, forecasts.ytd_forecast) >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{calculateVariance(forecasts.ytd_actual, forecasts.ytd_forecast) >= 0 ? '+' : ''}{calculateVariance(forecasts.ytd_actual, forecasts.ytd_forecast).toFixed(0)}</span>
                  <span className={`text-xs ${calculateVariance(forecasts.ytd_actual, forecasts.ytd_forecast) >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>({calculatePercentage(forecasts.ytd_actual, forecasts.ytd_forecast).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
            <div className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Budget Mensuel</span>
                <span className="text-xl font-bold text-slate-900">{forecasts.month_budget} oz</span>
              </div>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
            <div className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Prévision Mensuelle</span>
                <span className="text-xl font-bold text-slate-900">{forecasts.month_forecast} oz</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
