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
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
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

export function BudgetManagementPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [mode, setMode] = useState<'budget' | 'forecast'>('budget');
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [groupTotals, setGroupTotals] = useState({ budget: 0, forecast: 0 });

  const [loading, setLoading] = useState(true);
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
    loadBudgetData();
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
      setLoading(true);

      if (!selectedCompanyId) {
        setLoading(false);
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
    if (mode !== 'forecast') return [];

    return [1, 2, 3, 4].map(quarter => {
      const months = annualBudgetService.getQuarterMonths(quarter);
      const total = months.reduce((sum, month) => {
        const key = `${quarter}-${month}`;
        const forecast = pendingForecasts[key] !== undefined
          ? pendingForecasts[key]
          : quarterlyForecasts.find(qf => qf.quarter === quarter && qf.month === month)?.forecast_oz || 0;
        return sum + Number(forecast);
      }, 0);

      return {
        name: `T${quarter}`,
        value: total,
        percentage: 0 // Will be calculated
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

  if (loading) {
    return <Loading message="Chargement du budget..." />;
  }

  return (
    <MainLayout>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-8">
          <div className="max-w-6xl mx-auto p-6 pr-3 space-y-6">
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
          <Card className="shadow-sm border-slate-200">
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

          {/* Budget Matrix */}
          <Card className="p-5 shadow-sm border-slate-200 bg-white">
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
          </Card>
        </div>
      </div>

      {/* Right Sidebar - Always Visible */}
      <div className="w-[420px] bg-gradient-to-b from-slate-50 to-white border-l border-slate-200/60 overflow-y-auto sticky top-0 h-screen">
        <div className="p-5 space-y-4">
          {/* Total Annuel Section - Always shows annual total */}
          <div className="bg-gradient-to-br from-slate-600/90 via-slate-700/85 to-slate-800/90 rounded-xl p-4 text-white shadow-md border border-slate-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="bg-white/15 rounded-lg p-1.5">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide">Total Annuel</span>
              </div>
              <span className="text-[10px] font-medium text-slate-200 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                12 mois
              </span>
            </div>
            <div className="text-3xl font-bold">
              {calculateYearTotal().toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
              <span className="text-base ml-1.5 font-semibold text-slate-200">oz</span>
            </div>
          </div>

          {/* Trimestre Total Section - Only in forecast mode */}
          {mode === 'forecast' && selectedQuarter && (
            <div className="bg-gradient-to-br from-teal-600/85 via-teal-700/80 to-cyan-700/85 rounded-xl p-4 text-white shadow-md border border-teal-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="bg-white/15 rounded-lg p-1.5">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide">Total T{selectedQuarter}</span>
                </div>
                <span className="text-[10px] font-medium text-teal-100 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  3 mois
                </span>
              </div>
              <div className="text-3xl font-bold">
                {calculateTotalBudget().toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                <span className="text-base ml-1.5 font-semibold text-teal-100">oz</span>
              </div>
            </div>
          )}

          {/* Quick Stats - Simplified */}
          <div className="space-y-2">
            <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 rounded-md p-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">Mode</span>
                </div>
                <span className="text-sm font-bold text-amber-900">
                  {mode === 'budget' ? 'Budget' : `Forecast T${selectedQuarter}`}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 rounded-md p-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">Modifications</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-emerald-900">
                    {Object.keys(mode === 'budget' ? pendingBudgets : pendingForecasts).length}
                  </span>
                  {hasPendingChanges() && (
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                  <ResponsiveContainer width="100%" height={240}>
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
                        outerRadius={75}
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
                  <ResponsiveContainer width="100%" height={240}>
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
                        outerRadius={75}
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
        </div>
      </div>
    </div>
    </MainLayout>
  );
}
