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
  Unlock
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

  if (loading) {
    return <Loading message="Chargement du budget..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/production/daily')}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion Budgétaire</h1>
            <p className="text-gray-600 mt-1">
              {mode === 'budget'
                ? 'Configuration du budget annuel de production'
                : `Révision trimestrielle - T${selectedQuarter}`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-900">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-900">{errorMessage}</p>
        </div>
      )}

      {/* Controls */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleModeChange('budget')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${mode === 'budget'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${mode === 'forecast'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Trimestre:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(quarter => {
                    const canRevise = annualBudgetService.canReviseQuarter(quarter, currentMonth);
                    return (
                      <button
                        key={quarter}
                        onClick={() => setSelectedQuarter(quarter)}
                        disabled={!canRevise && selectedYear === currentYear}
                        className={`
                          px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                          ${selectedQuarter === quarter
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }
                          ${!canRevise && selectedYear === currentYear
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                          }
                        `}
                      >
                        T{quarter}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={mode === 'budget' ? handleSaveBudgets : handleSaveForecasts}
            disabled={saving || !hasPendingChanges()}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </Card>

      {/* Budget Matrix */}
      <Card className="p-6">
        <BudgetMatrixTable
          year={selectedYear}
          monthlyBudgets={monthlyBudgets}
          quarterlyForecasts={quarterlyForecasts}
          onBudgetChange={handleBudgetChange}
          onForecastChange={handleForecastChange}
          readOnly={false}
          showForecasts={mode === 'forecast'}
          activeQuarter={selectedQuarter}
        />
      </Card>

      {/* Help Text */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-900 mb-2">Guide d'utilisation</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li><strong>Budget Annuel:</strong> Définissez le budget de production pour les 12 mois de l'année</li>
          <li><strong>Forecast:</strong> Révisez le budget en Mars (T1), Juin (T2), et Septembre (T3)</li>
          <li><strong>Calcul automatique:</strong> Le budget/forecast journalier est calculé automatiquement selon le nombre de jours du mois</li>
          <li><strong>Variance:</strong> La différence entre forecast et budget est calculée automatiquement</li>
        </ul>
      </div>
    </div>
  );
}
