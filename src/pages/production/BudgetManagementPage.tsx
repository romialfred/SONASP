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
  Clock
} from 'lucide-react';
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

export function BudgetManagementPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [mode, setMode] = useState<'budget' | 'forecast'>('budget');
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [annualBudget, setAnnualBudget] = useState<AnnualBudget | null>(null);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([]);
  const [quarterlyForecasts, setQuarterlyForecasts] = useState<QuarterlyForecast[]>([]);

  const [pendingBudgets, setPendingBudgets] = useState<Record<number, number>>({});
  const [pendingForecasts, setPendingForecasts] = useState<Record<string, number>>({});

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadBudgetData();
  }, [selectedYear]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      const data = await annualBudgetService.getMonthlyBudgetWithForecasts(selectedYear);

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
    try {
      setSaving(true);

      let budget = annualBudget;
      if (!budget) {
        budget = await annualBudgetService.createAnnualBudget(selectedYear);
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

      const savedBudgets = await annualBudgetService.upsertMonthlyBudgets(budget.id, budgetInputs);
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
        forecastInputs
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
      return monthlyBudgets.reduce((sum, mb) => sum + Number(mb.budget_oz || 0), 0);
    } else if (selectedQuarter) {
      const quarterMonths = annualBudgetService.getQuarterMonths(selectedQuarter);
      return quarterlyForecasts
        .filter(qf => qf.quarter === selectedQuarter && quarterMonths.includes(qf.month))
        .reduce((sum, qf) => sum + Number(qf.forecast_oz || 0), 0);
    }
    return 0;
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-8">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
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
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Gestion Budgétaire
                </h1>
                <p className="text-slate-600 mt-1">
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
              className="flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
              {hasPendingChanges() && (
                <span className="bg-white text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {Object.keys(mode === 'budget' ? pendingBudgets : pendingForecasts).length}
                </span>
              )}
            </Button>
          </div>

          {/* Notifications */}
          {successMessage && (
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-300 rounded-xl p-4 flex items-center gap-3 shadow-md">
              <div className="bg-emerald-500 rounded-full p-1">
                <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
              </div>
              <p className="text-emerald-900 font-medium">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-300 rounded-xl p-4 flex items-center gap-3 shadow-md">
              <div className="bg-red-500 rounded-full p-1">
                <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
              </div>
              <p className="text-red-900 font-medium">{errorMessage}</p>
            </div>
          )}

          {/* Controls */}
          <Card className="shadow-lg border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Year Selector */}
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 shadow-md">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-700 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {getAvailableYears().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-1.5 shadow-inner">
                  <button
                    onClick={() => handleModeChange('budget')}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200
                      ${mode === 'budget'
                        ? 'bg-white text-slate-900 shadow-md transform scale-105'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }
                    `}
                  >
                    <Lock className="w-4 h-4" />
                    Budget Annuel
                  </button>
                  <button
                    onClick={() => handleModeChange('forecast')}
                    disabled={!annualBudget}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200
                      ${mode === 'forecast'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md transform scale-105'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }
                      ${!annualBudget ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Forecast
                  </button>
                </div>

                {/* Quarter Selector (Forecast Mode) */}
                {mode === 'forecast' && (
                  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-sm border border-slate-200">
                    <span className="text-sm font-semibold text-slate-700">Trimestre:</span>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(quarter => {
                        const canRevise = annualBudgetService.canReviseQuarter(quarter, currentMonth);
                        const status = getQuarterStatus(quarter);

                        return (
                          <button
                            key={quarter}
                            onClick={() => setSelectedQuarter(quarter)}
                            disabled={!canRevise && selectedYear === currentYear}
                            className={`
                              relative px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200
                              ${selectedQuarter === quarter
                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg transform scale-110'
                                : status === 'completed'
                                ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800 border-2 border-emerald-300'
                                : status === 'active'
                                ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border-2 border-amber-300'
                                : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                              }
                              ${!canRevise && selectedYear === currentYear
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:shadow-md cursor-pointer'
                              }
                            `}
                          >
                            T{quarter}
                            {status === 'completed' && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
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
          <Card className="p-6 shadow-xl border-slate-200 bg-gradient-to-br from-white to-slate-50">
            <BudgetMatrixTable
              mode={mode}
              selectedQuarter={selectedQuarter}
              monthlyBudgets={monthlyBudgets}
              quarterlyForecasts={quarterlyForecasts}
              pendingBudgets={pendingBudgets}
              pendingForecasts={pendingForecasts}
              onBudgetChange={handleBudgetChange}
              onForecastChange={handleForecastChange}
            />
          </Card>
        </div>
      </div>

      {/* Right Sidebar - Always Visible */}
      <div className="w-80 bg-white border-l border-slate-200 shadow-2xl overflow-y-auto sticky top-0 h-screen">
        <div className="p-6 space-y-6">
          {/* Total Section */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/20 rounded-full p-2">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">
                {mode === 'budget' ? 'Total Annuel' : `Total T${selectedQuarter}`}
              </h3>
            </div>
            <div className="text-4xl font-black mb-1">
              {calculateTotalBudget().toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
              <span className="text-xl ml-2 font-semibold">oz</span>
            </div>
            <p className="text-amber-100 text-sm">
              {mode === 'budget' ? '12 mois' : '3 mois'}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Statistiques Rapides
            </h3>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-blue-700 font-medium">Année</span>
                <span className="text-xl font-bold text-blue-900">{selectedYear}</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-indigo-700 font-medium">Mode</span>
                <span className="text-sm font-bold text-indigo-900">
                  {mode === 'budget' ? 'Budget' : `Forecast T${selectedQuarter}`}
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-purple-700 font-medium">Modifications</span>
                <span className="text-xl font-bold text-purple-900">
                  {Object.keys(mode === 'budget' ? pendingBudgets : pendingForecasts).length}
                </span>
              </div>
            </div>
          </div>

          {/* Quarter Progress */}
          {mode === 'forecast' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Progrès des Révisions
              </h3>

              <div className="space-y-2">
                {[1, 2, 3, 4].map(q => {
                  const status = getQuarterStatus(q);
                  return (
                    <div
                      key={q}
                      className={`
                        rounded-lg p-3 border-2 transition-all
                        ${status === 'completed'
                          ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-300'
                          : status === 'active'
                          ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300'
                          : 'bg-slate-50 border-slate-200'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">T{q}</span>
                        <span className={`
                          text-xs px-2 py-1 rounded-full font-bold
                          ${status === 'completed'
                            ? 'bg-emerald-500 text-white'
                            : status === 'active'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-300 text-slate-600'
                          }
                        `}>
                          {status === 'completed' ? '✓ Complété' : status === 'active' ? '● Actif' : '○ À venir'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-full p-2 mt-0.5">
                <Info className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 mb-1">Aide</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {mode === 'budget'
                    ? 'Définissez le budget mensuel pour chaque mois de l\'année. Les valeurs sont en onces d\'or.'
                    : 'Révisez les prévisions trimestrielles basées sur les performances actuelles et les projections futures.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Last Update */}
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-4 border-t border-slate-200">
            <Clock className="w-3 h-3" />
            <span>Dernière mise à jour: {new Date().toLocaleString('fr-FR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
