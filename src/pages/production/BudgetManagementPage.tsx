import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  TrendingUp,
  Save,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Lock,
  Unlock,
  Target,
  Activity,
  BarChart3,
  Info,
  Clock,
  Building2,
  PieChart
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { MainLayout } from '../../components/layout/MainLayout';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { BudgetMatrixTable } from '../../components/budget/BudgetMatrixTable';
import {
  annualBudgetService,
  AnnualBudget,
  MonthlyBudget,
  QuarterlyForecast,
  MonthlyBudgetInput,
  QuarterlyForecastInput
} from '../../services/annualBudgetService';

interface MiningCompany {
  id: string;
  name: string;
}

interface ProductionBrowserTabProps {
  monthlyBudgets: MonthlyBudget[];
  quarterlyForecasts: QuarterlyForecast[];
  pendingBudgets: Record<number, number>;
  pendingForecasts: Record<string, number>;
}

function ProductionBrowserTab({
  monthlyBudgets,
  quarterlyForecasts,
  pendingBudgets,
  pendingForecasts
}: ProductionBrowserTabProps) {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const exportData = () => {
    const data = months.map((month, index) => {
      const monthNum = index + 1;
      const quarter = Math.ceil(monthNum / 3);

      const budget = pendingBudgets[monthNum] !== undefined
        ? pendingBudgets[monthNum]
        : monthlyBudgets.find(mb => mb.month === monthNum)?.budget_oz || 0;

      const forecast = pendingForecasts[`${quarter}-${monthNum}`] !== undefined
        ? pendingForecasts[`${quarter}-${monthNum}`]
        : quarterlyForecasts.find(qf => qf.month === monthNum)?.forecast_oz || 0;

      return {
        Mois: month,
        Budget: Number(budget).toFixed(2),
        Actual: '0.00', // TODO: Connect to actual production data
        Forecast: Number(forecast).toFixed(2)
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Browser');

    // Style the header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      ws[address].s = { font: { bold: true }, fill: { fgColor: { rgb: "4F81BD" } } };
    }

    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    XLSX.writeFile(wb, `Production_Browser_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getChartData = () => {
    return months.map((month, index) => {
      const monthNum = index + 1;
      const quarter = Math.ceil(monthNum / 3);

      const budget = pendingBudgets[monthNum] !== undefined
        ? pendingBudgets[monthNum]
        : monthlyBudgets.find(mb => mb.month === monthNum)?.budget_oz || 0;

      const forecast = pendingForecasts[`${quarter}-${monthNum}`] !== undefined
        ? pendingForecasts[`${quarter}-${monthNum}`]
        : quarterlyForecasts.find(qf => qf.month === monthNum)?.forecast_oz || 0;

      return {
        name: month.substring(0, 3),
        Budget: Number(budget),
        Actual: 0, // TODO: Connect to actual production data
        Forecast: Number(forecast)
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Production Browser - Vue Annuelle</h3>
        <Button onClick={exportData} variant="primary" size="sm">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exporter Excel
        </Button>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border border-slate-500">
                Mois
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border border-slate-500 bg-blue-600">
                Budget (oz)
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border border-slate-500 bg-emerald-600">
                Actual (oz)
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border border-slate-500 bg-amber-600">
                Forecast (oz)
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((month, index) => {
              const monthNum = index + 1;
              const quarter = Math.ceil(monthNum / 3);

              const budget = pendingBudgets[monthNum] !== undefined
                ? pendingBudgets[monthNum]
                : monthlyBudgets.find(mb => mb.month === monthNum)?.budget_oz || 0;

              const forecast = pendingForecasts[`${quarter}-${monthNum}`] !== undefined
                ? pendingForecasts[`${quarter}-${monthNum}`]
                : quarterlyForecasts.find(qf => qf.month === monthNum)?.forecast_oz || 0;

              const isQuarterStart = monthNum % 3 === 1;

              return (
                <tr
                  key={month}
                  className={`
                    ${isQuarterStart ? 'border-t-2 border-slate-400' : ''}
                    ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    hover:bg-blue-50 transition-colors
                  `}
                >
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700 border border-slate-200">
                    {month}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-right border border-slate-200 bg-blue-50/50">
                    {Number(budget).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-right border border-slate-200 bg-emerald-50/50">
                    0.00
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-right border border-slate-200 bg-amber-50/50">
                    {Number(forecast).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 text-white font-bold border-t-2 border-slate-800">
              <td className="px-4 py-3 text-sm uppercase tracking-wide border border-slate-500">
                Total Annuel
              </td>
              <td className="px-4 py-3 text-sm text-right border border-slate-500">
                {monthlyBudgets.reduce((sum, mb) => sum + Number(mb.budget_oz || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-sm text-right border border-slate-500">
                0.00
              </td>
              <td className="px-4 py-3 text-sm text-right border border-slate-500">
                {quarterlyForecasts.reduce((sum, qf) => sum + Number(qf.forecast_oz || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-600" />
          Comparaison Mensuelle: Budget, Actual, Forecast
        </h3>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={getChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                label={{ value: 'Onces (oz)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b' } }}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz`]}
                contentStyle={{ fontSize: '12px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }}
              />
              <Bar dataKey="Budget" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Actual" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Forecast" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function BudgetManagementPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Months array for display
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [mode, setMode] = useState<'budget' | 'forecast'>('budget');
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'browser'>('matrix');
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [groupTotals, setGroupTotals] = useState({ budget: 0, forecast: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [annualBudget, setAnnualBudget] = useState<AnnualBudget | null>(null);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([]);
  const [quarterlyForecasts, setQuarterlyForecasts] = useState<QuarterlyForecast[]>([]);

  const [pendingBudgets, setPendingBudgets] = useState<Record<number, number>>({});
  const [pendingForecasts, setPendingForecasts] = useState<Record<string, number>>({});

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedQuarters, setExpandedQuarters] = useState<Record<number, boolean>>({1: true, 2: false, 3: false, 4: false});

  useEffect(() => {
    loadMiningCompanies();
  }, []);

  useEffect(() => {
    // Auto-select first company if available and no company selected
    if (miningCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(miningCompanies[0].id);
    }
  }, [miningCompanies]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadBudgetData();
    }
  }, [selectedYear, selectedCompanyId]);

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  const loadBudgetData = async () => {
    try {
      // Ne pas afficher le loading complet si on a déjà des données
      // Cela évite la page blanche lors du changement de filtre
      if (monthlyBudgets.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      if (!selectedCompanyId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await annualBudgetService.getMonthlyBudgetWithForecasts(
        selectedYear,
        'guinea',
        selectedCompanyId
      );

      setAnnualBudget(data.budget);
      setMonthlyBudgets(data.monthlyBudgets);
      setQuarterlyForecasts(data.quarterlyForecasts);

      setPendingBudgets({});
      setPendingForecasts({});
    } catch (error) {
      console.error('Error loading budget data:', error);
      showError('Erreur lors du chargement des données budgétaires');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBudgetChange = (month: number, value: number) => {
    setPendingBudgets(prev => ({
      ...prev,
      [month]: value
    }));
  };

  const handleForecastChange = (quarter: number, month: number, value: number) => {
    setPendingForecasts(prev => ({
      ...prev,
      [`${quarter}-${month}`]: value
    }));
  };

  const handleSaveBudgets = async () => {
    if (!selectedCompanyId) {
      showError('Veuillez sélectionner une compagnie minière');
      return;
    }

    try {
      setSaving(true);

      let budget = annualBudget;
      if (!budget) {
        budget = await annualBudgetService.createAnnualBudget(
          selectedYear,
          'guinea',
          selectedCompanyId
        );
        setAnnualBudget(budget);
      }

      const budgetInputs: MonthlyBudgetInput[] = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const existingBudget = monthlyBudgets.find(mb => mb.month === month);
        const pendingValue = pendingBudgets[month];

        return {
          month,
          budget_oz: pendingValue !== undefined ? pendingValue : (existingBudget?.budget_oz || 0)
        };
      });

      const savedBudgets = await annualBudgetService.upsertMonthlyBudgets(
        budget.id,
        budgetInputs,
        selectedCompanyId
      );
      setMonthlyBudgets(savedBudgets);
      setPendingBudgets({});

      showSuccess('Budget annuel enregistré avec succès');
    } catch (error) {
      console.error('Error saving budgets:', error);
      showError('Erreur lors de l\'enregistrement du budget');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveForecasts = async () => {
    if (!selectedQuarter || !annualBudget) return;

    if (selectedCompanyId === 'ALL') {
      showError('Veuillez sélectionner une compagnie minière spécifique pour enregistrer');
      return;
    }

    try {
      setSaving(true);

      const revisionDate = new Date(selectedYear, annualBudgetService.getRevisionMonth(selectedQuarter) - 1, 1);
      const quarterMonths = annualBudgetService.getQuarterMonths(selectedQuarter);

      const forecastInputs: QuarterlyForecastInput[] = quarterMonths.map(month => {
        const pendingValue = pendingForecasts[`${selectedQuarter}-${month}`];
        const existingForecast = quarterlyForecasts.find(
          qf => qf.quarter === selectedQuarter && qf.month === month
        );
        const existingBudget = monthlyBudgets.find(mb => mb.month === month);

        return {
          quarter: selectedQuarter,
          month,
          forecast_oz: pendingValue !== undefined
            ? pendingValue
            : (existingForecast?.forecast_oz || existingBudget?.budget_oz || 0),
          notes: `Révision T${selectedQuarter}`
        };
      });

      const savedForecasts = await annualBudgetService.upsertQuarterlyForecasts(
        annualBudget.id,
        selectedQuarter,
        revisionDate.toISOString().split('T')[0],
        forecastInputs,
        selectedCompanyId
      );

      setQuarterlyForecasts(prev => {
        const filtered = prev.filter(qf => !(qf.quarter === selectedQuarter));
        return [...filtered, ...savedForecasts];
      });

      setPendingForecasts({});
      showSuccess(`Forecast T${selectedQuarter} enregistré avec succès`);
    } catch (error) {
      console.error('Error saving forecasts:', error);
      showError('Erreur lors de l\'enregistrement du forecast');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (newMode: 'budget' | 'forecast') => {
    if (newMode === 'forecast' && !annualBudget) {
      showError('Veuillez d\'abord créer et enregistrer le budget annuel');
      return;
    }

    setMode(newMode);

    if (newMode === 'forecast') {
      const currentQuarter = annualBudgetService.getQuarterFromMonth(currentMonth);
      setSelectedQuarter(currentQuarter);
    } else {
      setSelectedQuarter(null);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const hasPendingChanges = () => {
    if (mode === 'budget') {
      return Object.keys(pendingBudgets).length > 0;
    } else {
      return Object.keys(pendingForecasts).length > 0;
    }
  };

  const getAvailableYears = () => {
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(i);
    }
    return years;
  };

  const calculateTotalBudget = () => {
    if (mode === 'budget') {
      // Calculer le total annuel (tous les 12 mois)
      return monthlyBudgets.reduce((sum, mb) => sum + Number(mb.budget_oz || 0), 0);
    } else if (selectedQuarter) {
      // Calculer le total du trimestre sélectionné
      const quarterMonths = annualBudgetService.getQuarterMonths(selectedQuarter);
      return quarterlyForecasts
        .filter(qf => qf.quarter === selectedQuarter && quarterMonths.includes(qf.month))
        .reduce((sum, qf) => sum + Number(qf.forecast_oz || 0), 0);
    }
    return 0;
  };

  const calculateYearTotal = () => {
    // Toujours calculer le total annuel (12 mois)
    return monthlyBudgets.reduce((sum, mb) => sum + Number(mb.budget_oz || 0), 0);
  };

  const getQuarterMonthsData = () => {
    if (!selectedQuarter || mode !== 'forecast') return [];

    const months = annualBudgetService.getQuarterMonths(selectedQuarter);
    return months.map(month => {
      const key = `${selectedQuarter}-${month}`;
      const forecast = pendingForecasts[key] !== undefined
        ? pendingForecasts[key]
        : quarterlyForecasts.find(qf => qf.quarter === selectedQuarter && qf.month === month)?.forecast_oz || 0;

      return {
        name: annualBudgetService.getMonthName(month),
        value: Number(forecast),
        percentage: 0 // Will be calculated
      };
    });
  };

  const getQuarterlyDistributionData = () => {
    return [1, 2, 3, 4].map(quarter => {
      const months = annualBudgetService.getQuarterMonths(quarter);
      const total = months.reduce((sum, month) => {
        if (mode === 'budget') {
          const budget = pendingBudgets[month] !== undefined
            ? pendingBudgets[month]
            : monthlyBudgets.find(mb => mb.month === month)?.budget_oz || 0;
          return sum + Number(budget);
        } else {
          const key = `${quarter}-${month}`;
          const forecast = pendingForecasts[key] !== undefined
            ? pendingForecasts[key]
            : quarterlyForecasts.find(qf => qf.quarter === quarter && qf.month === month)?.forecast_oz || 0;
          return sum + Number(forecast);
        }
      }, 0);

      return {
        name: `T${quarter}`,
        value: total,
        percentage: 0 // Will be calculated
      };
    });
  };

  const getMonthlyBudgetData = () => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
      const budget = pendingBudgets[month] !== undefined
        ? pendingBudgets[month]
        : monthlyBudgets.find(mb => mb.month === month)?.budget_oz || 0;

      return {
        name: annualBudgetService.getMonthName(month).substring(0, 3),
        value: Number(budget),
        month
      };
    });
  };

  const toggleQuarter = (quarter: number) => {
    setExpandedQuarters(prev => ({
      ...prev,
      [quarter]: !prev[quarter]
    }));
  };

  const handleQuarterSelect = (quarter: number) => {
    setSelectedQuarter(quarter);
    // Dérouler automatiquement le trimestre sélectionné
    if (!expandedQuarters[quarter]) {
      setExpandedQuarters(prev => ({
        ...prev,
        [quarter]: true
      }));
    }
  };

  const getQuarterStatus = (quarter: number) => {
    const hasData = quarterlyForecasts.some(qf => qf.quarter === quarter);
    const canRevise = annualBudgetService.canReviseQuarter(quarter, currentMonth);

    if (hasData) return 'completed';
    if (canRevise) return 'active';
    return 'upcoming';
  };

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Data');

    // Auto-size columns
    const maxWidth = data.reduce((w, r) => Math.max(w, ...Object.keys(r).map(k => String(r[k]).length)), 10);
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: maxWidth + 2 }));

    XLSX.writeFile(wb, filename);
  };

  return (
    <MainLayout>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-8">
          <div className="max-w-6xl mx-auto p-6 pr-3 space-y-6">

          {loading ? (
            /* Loading State - Only Content Area */
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
                <p className="text-lg text-slate-700 font-semibold">Chargement du budget...</p>
                <p className="text-sm text-slate-500 mt-2">Récupération des données budgétaires</p>
              </div>
            </div>
          ) : (
            <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                onClick={() => navigate('/production/daily')}
                className="flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Gestion Budgétaire
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  {mode === 'budget'
                    ? 'Configuration du budget annuel de production'
                    : `Révision trimestrielle - T${selectedQuarter}`
                  }
                </p>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={mode === 'budget' ? handleSaveBudgets : handleSaveForecasts}
              disabled={saving || !hasPendingChanges()}
              className="flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
              {hasPendingChanges() && (
                <span className="bg-white text-slate-800 px-2 py-0.5 rounded-full text-xs font-bold">
                  {Object.keys(mode === 'budget' ? pendingBudgets : pendingForecasts).length}
                </span>
              )}
            </Button>
          </div>

          {/* Notifications */}
          {successMessage && (
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-300 rounded-lg p-3 flex items-center gap-3 shadow-sm">
              <div className="bg-emerald-500 rounded-full p-1">
                <CheckCircle className="w-4 h-4 text-white flex-shrink-0" />
              </div>
              <p className="text-sm text-emerald-900 font-medium">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-300 rounded-lg p-3 flex items-center gap-3 shadow-sm">
              <div className="bg-red-500 rounded-full p-1">
                <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
              </div>
              <p className="text-sm text-red-900 font-medium">{errorMessage}</p>
            </div>
          )}

          {/* Controls */}
          <Card className="shadow-sm border-slate-200 relative">
            {refreshing && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 overflow-hidden">
                <div className="h-full bg-blue-600 animate-pulse" style={{ width: '100%' }}></div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-4">
                {/* Year Selector */}
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-md p-1.5 shadow-sm">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-slate-700 shadow-sm hover:shadow transition-shadow"
                  >
                    {getAvailableYears().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Mining Company Selector */}
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-md p-1.5 shadow-sm">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <select
                    value={selectedCompanyId}
                    onChange={e => setSelectedCompanyId(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold text-slate-700 shadow-sm hover:shadow transition-shadow min-w-[200px]"
                  >
                    {miningCompanies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center bg-slate-100 rounded-lg p-1 shadow-inner">
                  <button
                    onClick={() => handleModeChange('budget')}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all duration-200
                      ${mode === 'budget'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }
                    `}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Budget Annuel
                  </button>
                  <button
                    onClick={() => handleModeChange('forecast')}
                    disabled={!annualBudget}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all duration-200
                      ${mode === 'forecast'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }
                      ${!annualBudget ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Forecast
                  </button>
                </div>

                {/* Quarter Selector (Forecast Mode) */}
                {mode === 'forecast' && (
                  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">Trimestre:</span>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(quarter => {
                        const canRevise = annualBudgetService.canReviseQuarter(quarter, currentMonth);
                        const status = getQuarterStatus(quarter);

                        return (
                          <button
                            key={quarter}
                            onClick={() => handleQuarterSelect(quarter)}
                            disabled={!canRevise && selectedYear === currentYear}
                            className={`
                              relative px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200
                              ${selectedQuarter === quarter
                                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm'
                                : status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : status === 'active'
                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                              }
                              ${!canRevise && selectedYear === currentYear
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:shadow cursor-pointer'
                              }
                            `}
                          >
                            T{quarter}
                            {status === 'completed' && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Card className="p-0 shadow-sm border-slate-200 bg-white overflow-hidden">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => !refreshing && setActiveTab('matrix')}
                disabled={refreshing}
                className={`
                  flex-1 px-6 py-3 text-sm font-semibold transition-all
                  ${activeTab === 'matrix'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }
                  ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {mode === 'budget' ? 'Budget Matrix' : 'Forecast Matrix'}
              </button>
              <button
                onClick={() => !refreshing && setActiveTab('browser')}
                disabled={refreshing}
                className={`
                  flex-1 px-6 py-3 text-sm font-semibold transition-all
                  ${activeTab === 'browser'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }
                  ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                Production Browser
              </button>
            </div>

            <div className="p-5 relative">
              {refreshing && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                  <div className="flex items-center gap-2 text-blue-600">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium">Actualisation...</span>
                  </div>
                </div>
              )}
              {activeTab === 'matrix' ? (
                <BudgetMatrixTable
              mode={mode}
              selectedQuarter={selectedQuarter}
              monthlyBudgets={monthlyBudgets}
              quarterlyForecasts={quarterlyForecasts}
              pendingBudgets={pendingBudgets}
              pendingForecasts={pendingForecasts}
              onBudgetChange={handleBudgetChange}
              onForecastChange={handleForecastChange}
              expandedQuarters={expandedQuarters}
              onToggleQuarter={toggleQuarter}
            />
              ) : (
                <ProductionBrowserTab
                  monthlyBudgets={monthlyBudgets}
                  quarterlyForecasts={quarterlyForecasts}
                  pendingBudgets={pendingBudgets}
                  pendingForecasts={pendingForecasts}
                />
              )}
            </div>
          </Card>
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar - Conditional on loading and tab */}
      {!loading && (
      <div className="w-[420px] bg-gradient-to-b from-slate-50 to-white border-l border-slate-200/60 overflow-y-auto sticky top-0 h-screen">
        <div className="p-5 space-y-4">

        {activeTab === 'browser' ? (
          /* Production Browser Performance Sidebar */
          <>
          {/* Performance Annuelle */}
          <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-lg p-4 text-white shadow-lg border border-slate-600/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-white/15 rounded-lg p-1.5">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wide">Performance Annuelle</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Budget:</span>
                <span className="text-sm font-bold">{calculateYearTotal().toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Actual:</span>
                <span className="text-sm font-bold text-blue-300">0.00 oz</span>
              </div>
              <div className="h-px bg-white/20"></div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Variation:</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-sm font-bold text-red-400">-100.0%</span>
                  <span className="text-xs text-slate-400">(-{calculateYearTotal().toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance par Trimestre */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              Performance par Trimestre
            </h3>

            {[1, 2, 3, 4].map(quarter => {
              const quarterMonths = [
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12]
              ][quarter - 1];

              const quarterBudget = quarterMonths.reduce((sum, month) => {
                const budget = pendingBudgets[month] !== undefined
                  ? pendingBudgets[month]
                  : monthlyBudgets.find(mb => mb.month === month)?.budget_oz || 0;
                return sum + Number(budget);
              }, 0);

              const quarterActual = 0; // TODO: Connect to actual data
              const variance = quarterActual - quarterBudget;
              const variancePercent = quarterBudget > 0 ? (variance / quarterBudget) * 100 : -100;

              const trafficLight = variancePercent >= 0 ? 'green' : variancePercent >= -10 ? 'orange' : 'red';
              const trafficColor = {
                green: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-300', light: 'bg-emerald-50' },
                orange: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-300', light: 'bg-amber-50' },
                red: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-300', light: 'bg-red-50' }
              }[trafficLight];

              const quarterSummary = variancePercent >= 0
                ? `Excellent trimestre avec performance ${variancePercent.toFixed(1)}% au-dessus du budget. Objectifs largement dépassés.`
                : variancePercent >= -10
                ? `Performance légèrement en dessous du budget (${variancePercent.toFixed(1)}%). Ajustements mineurs nécessaires.`
                : `Performance critique avec écart de ${variancePercent.toFixed(1)}% du budget. Action corrective urgente requise.`;

              return (
                <div key={quarter} className={`bg-white rounded-lg border-2 ${trafficColor.border} shadow-sm p-3 hover:shadow-md transition-shadow`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${trafficColor.bg} shadow-sm`}></div>
                      <span className="text-sm font-bold text-slate-800">Trimestre {quarter}</span>
                    </div>
                    <span className={`text-xs font-bold ${trafficColor.text}`}>
                      {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Budget:</span>
                      <span className="font-semibold text-slate-800">{quarterBudget.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Actual:</span>
                      <span className="font-semibold text-blue-600">{quarterActual.toFixed(2)} oz</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Écart:</span>
                      <span className={`font-bold ${trafficColor.text}`}>
                        {variance >= 0 ? '+' : ''}{variance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz
                      </span>
                    </div>
                  </div>

                  {/* Summary Text */}
                  <div className={`${trafficColor.light} rounded-md p-2 border ${trafficColor.border}`}>
                    <p className="text-[10px] leading-relaxed text-slate-700">
                      {quarterSummary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance Mensuelle */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <BarChart3 className="w-4 h-4 text-slate-600" />
              Performance Mensuelle
            </h3>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm divide-y divide-slate-100">
              {months.map((month, index) => {
                const monthNum = index + 1;
                const budget = pendingBudgets[monthNum] !== undefined
                  ? pendingBudgets[monthNum]
                  : monthlyBudgets.find(mb => mb.month === monthNum)?.budget_oz || 0;

                const actual = 0; // TODO: Connect to actual data
                const variance = actual - budget;
                const variancePercent = budget > 0 ? (variance / budget) * 100 : -100;

                const trafficLight = variancePercent >= 0 ? 'green' : variancePercent >= -10 ? 'orange' : 'red';
                const dotColor = {
                  green: 'bg-emerald-500',
                  orange: 'bg-amber-500',
                  red: 'bg-red-500'
                }[trafficLight];

                return (
                  <div key={monthNum} className="p-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                        <span className="text-xs font-semibold text-slate-700">{month}</span>
                      </div>
                      <span className={`text-xs font-bold ${variancePercent >= 0 ? 'text-emerald-600' : variancePercent >= -10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{budget.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} oz</span>
                      <span className={variancePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {variance >= 0 ? '+' : ''}{variance.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} oz
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>
        ) : (
          /* Budget/Forecast Matrix Sidebar (Original) */
          <>
          {/* Total Annuel Section - Always shows annual total */}
          <div className="bg-gradient-to-br from-slate-600/90 via-slate-700/85 to-slate-800/90 rounded-lg p-3 text-white shadow-md border border-slate-500/30">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="bg-white/15 rounded-md p-1">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide">Total Annuel</span>
              </div>
              <span className="text-[9px] font-medium text-slate-200 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                12 mois
              </span>
            </div>
            <div className="text-2xl font-bold">
              {calculateYearTotal().toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
              <span className="text-sm ml-1.5 font-semibold text-slate-200">oz</span>
            </div>
          </div>

          {/* Trimestre Total Section - Only in forecast mode */}
          {mode === 'forecast' && selectedQuarter && (
            <div className="bg-gradient-to-br from-teal-600/85 via-teal-700/80 to-cyan-700/85 rounded-lg p-3 text-white shadow-md border border-teal-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="bg-white/15 rounded-md p-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Total T{selectedQuarter}</span>
                </div>
                <span className="text-[9px] font-medium text-teal-100 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  3 mois
                </span>
              </div>
              <div className="text-2xl font-bold">
                {calculateTotalBudget().toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                <span className="text-sm ml-1.5 font-semibold text-teal-100">oz</span>
              </div>
            </div>
          )}


          {/* Donut Chart - Budget by Quarter (Budget Mode Only) */}
          {mode === 'budget' && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-slate-600" />
                Budget par Trimestre
              </h3>
              <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie
                      data={(() => {
                        const data = getQuarterlyDistributionData();
                        const total = data.reduce((sum, item) => sum + item.value, 0);
                        return data.map(item => ({
                          ...item,
                          percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
                        }));
                      })()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      labelLine={false}
                      label={(entry) => `${entry.percentage}%`}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getQuarterlyDistributionData().map((entry, index) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                        return <Cell key={`cell-${index}`} fill={colors[index]} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz`]}
                      contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '6px' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      formatter={(value) => <span style={{ color: '#475569', fontWeight: 500 }}>{value}</span>}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Monthly Distribution Horizontal Bar Chart (Budget Mode) */}
          {mode === 'budget' && monthlyBudgets.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                Budget Mensuel
              </h3>
              <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart
                    data={getMonthlyBudgetData()}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      width={35}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz`, 'Budget']}
                      contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '6px' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                      {getMonthlyBudgetData().map((entry, index) => {
                        const colors = [
                          '#3b82f6', '#10b981', '#f59e0b', // Q1
                          '#06b6d4', '#14b8a6', '#84cc16', // Q2
                          '#f59e0b', '#f97316', '#ef4444', // Q3
                          '#8b5cf6', '#a855f7', '#6366f1'  // Q4
                        ];
                        return <Cell key={`cell-${index}`} fill={colors[index]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pie Charts - Forecast Mode */}
          {mode === 'forecast' && selectedQuarter && (
            <>
              {/* Monthly Distribution for Selected Quarter */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-slate-600" />
                  Distribution T{selectedQuarter} par Mois
                </h3>
                <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPie>
                      <Pie
                        data={(() => {
                          const data = getQuarterMonthsData();
                          const total = data.reduce((sum, item) => sum + item.value, 0);
                          return data.map(item => ({
                            ...item,
                            percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
                          }));
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={(entry) => `${entry.percentage}%`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getQuarterMonthsData().map((entry, index) => {
                          const colors = ['#64748b', '#14b8a6', '#f59e0b'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz`]}
                        contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '6px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        formatter={(value) => <span style={{ color: '#475569', fontWeight: 500 }}>{value}</span>}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quarterly Distribution */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-600" />
                  Distribution Annuelle par Trimestre
                </h3>
                <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPie>
                      <Pie
                        data={(() => {
                          const data = getQuarterlyDistributionData();
                          const total = data.reduce((sum, item) => sum + item.value, 0);
                          return data.map(item => ({
                            ...item,
                            percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
                          }));
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={(entry) => `${entry.percentage}%`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getQuarterlyDistributionData().map((entry, index) => {
                          const colors = ['#64748b', '#14b8a6', '#f59e0b', '#0891b2'];
                          return <Cell key={`cell-${index}`} fill={colors[index]} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz`]}
                        contentStyle={{ fontSize: '12px', padding: '8px', borderRadius: '6px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        formatter={(value) => <span style={{ color: '#475569', fontWeight: 500 }}>{value}</span>}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Quarter Progress */}
          {mode === 'forecast' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 px-1">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                Progrès des Révisions
              </h3>

              <div className="space-y-2">
                {[1, 2, 3, 4].map(q => {
                  const status = getQuarterStatus(q);
                  return (
                    <div
                      key={q}
                      className={`
                        rounded-xl p-3 border transition-all shadow-sm hover:shadow-md
                        ${status === 'completed'
                          ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 border-emerald-200/50'
                          : status === 'active'
                          ? 'bg-gradient-to-br from-amber-50 to-amber-100/80 border-amber-200/50'
                          : 'bg-gradient-to-br from-slate-50 to-slate-100/80 border-slate-200/50'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`
                          font-bold text-sm
                          ${status === 'completed' ? 'text-emerald-900' : status === 'active' ? 'text-amber-900' : 'text-slate-600'}
                        `}>
                          Trimestre {q}
                        </span>
                        <span className={`
                          text-[10px] px-2 py-1 rounded-full font-bold
                          ${status === 'completed'
                            ? 'bg-emerald-500 text-white'
                            : status === 'active'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-400 text-white'
                          }
                        `}>
                          {status === 'completed' ? '✓ Complété' : status === 'active' ? '● En cours' : '○ À venir'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-gradient-to-br from-blue-50 via-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200/50 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 shadow-sm">
                <Info className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wide">Aide</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {mode === 'budget'
                    ? 'Définissez le budget mensuel pour chaque mois de l\'année. Les valeurs sont en onces d\'or. Sélectionnez une compagnie minière ou visualisez le total du groupe.'
                    : 'Révisez les prévisions trimestrielles basées sur les performances actuelles et les projections futures. Ajustez les valeurs selon les conditions du marché.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Last Update */}
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 px-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">Mise à jour: {new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          </>
        )}
        </div>
      </div>
      )}
      </div>
    </MainLayout>
  );
}
