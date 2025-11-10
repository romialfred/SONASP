import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Calculator, Info } from 'lucide-react';
import { annualBudgetService, MonthlyBudget, QuarterlyForecast } from '../../services/annualBudgetService';

interface BudgetMatrixTableProps {
  mode: 'budget' | 'forecast';
  selectedQuarter: number | null;
  monthlyBudgets: MonthlyBudget[];
  quarterlyForecasts: QuarterlyForecast[];
  pendingBudgets: Record<number, number>;
  pendingForecasts: Record<string, number>;
  onBudgetChange: (month: number, value: number) => void;
  onForecastChange: (quarter: number, month: number, value: number) => void;
}

export function BudgetMatrixTable({
  mode,
  selectedQuarter,
  monthlyBudgets,
  quarterlyForecasts,
  pendingBudgets,
  pendingForecasts,
  onBudgetChange,
  onForecastChange
}: BudgetMatrixTableProps) {
  const year = new Date().getFullYear();
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, number>>({});

  useEffect(() => {
    const values: Record<string, number> = {};
    monthlyBudgets.forEach(mb => {
      values[`budget-${mb.month}`] = mb.budget_oz;
    });
    quarterlyForecasts.forEach(qf => {
      values[`forecast-${qf.month}`] = qf.forecast_oz;
    });
    setLocalValues(values);
  }, [monthlyBudgets, quarterlyForecasts]);

  const getBudgetValue = (month: number): number => {
    return localValues[`budget-${month}`] || 0;
  };

  const getForecastValue = (month: number): number | null => {
    return localValues[`forecast-${month}`] || null;
  };

  const handleBudgetInput = (month: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalValues(prev => ({ ...prev, [`budget-${month}`]: numValue }));
  };

  const handleBudgetBlur = (month: number) => {
    const value = localValues[`budget-${month}`] || 0;
    onBudgetChange(month, value);
  };

  const handleForecastInput = (month: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalValues(prev => ({ ...prev, [`forecast-${month}`]: numValue }));
  };

  const handleForecastBlur = (month: number) => {
    const value = localValues[`forecast-${month}`] || 0;
    const quarter = annualBudgetService.getQuarterFromMonth(month);
    onForecastChange(quarter, month, value);
  };

  const getDailyBudget = (month: number): number => {
    const budget = getBudgetValue(month);
    const days = annualBudgetService.getDaysInMonth(month, year);
    return budget / days;
  };

  const getDailyForecast = (month: number): number | null => {
    const forecast = getForecastValue(month);
    if (forecast === null) return null;
    const days = annualBudgetService.getDaysInMonth(month, year);
    return forecast / days;
  };

  const getQuarterTotal = (quarter: number): { budget: number; forecast: number | null } => {
    const months = annualBudgetService.getQuarterMonths(quarter);
    const budget = months.reduce((sum, m) => sum + getBudgetValue(m), 0);
    const forecasts = months.map(m => getForecastValue(m));
    const forecast = forecasts.some(f => f !== null)
      ? forecasts.reduce((sum, f) => sum + (f || 0), 0)
      : null;
    return { budget, forecast };
  };

  const getYearTotal = (): { budget: number; forecast: number | null } => {
    const budget = Array.from({ length: 12 }, (_, i) => i + 1)
      .reduce((sum, m) => sum + getBudgetValue(m), 0);

    const allForecasts = Array.from({ length: 12 }, (_, i) => i + 1)
      .map(m => getForecastValue(m));

    const forecast = allForecasts.some(f => f !== null)
      ? allForecasts.reduce((sum, f) => sum + (f || 0), 0)
      : null;

    return { budget, forecast };
  };

  const isMonthEditable = (month: number): boolean => {
    if (readOnly) return false;
    if (!showForecasts) return true;
    if (activeQuarter === null) return false;
    const quarterMonths = annualBudgetService.getQuarterMonths(activeQuarter);
    return quarterMonths.includes(month);
  };

  const getVariance = (budget: number, forecast: number | null): number | null => {
    if (forecast === null) return null;
    return forecast - budget;
  };

  const getVariancePercentage = (budget: number, forecast: number | null): number | null => {
    if (forecast === null || budget === 0) return null;
    return ((forecast - budget) / budget) * 100;
  };

  const renderQuarter = (quarter: number) => {
    const months = annualBudgetService.getQuarterMonths(quarter);
    const quarterTotals = getQuarterTotal(quarter);
    const isActive = activeQuarter === quarter;

    return (
      <div key={quarter} className="mb-6">
        {/* Quarter Header */}
        <div className={`
          flex items-center justify-between p-3 rounded-t-lg border-b-2
          ${isActive
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500'
            : 'bg-gray-50 border-gray-300'
          }
        `}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
            <span className={`font-semibold ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>
              Trimestre {quarter}
            </span>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Budget: </span>
              <span className="font-semibold text-gray-900">{quarterTotals.budget.toFixed(2)} oz</span>
            </div>
            {quarterTotals.forecast !== null && (
              <div>
                <span className="text-gray-600">Forecast: </span>
                <span className="font-semibold text-indigo-600">{quarterTotals.forecast.toFixed(2)} oz</span>
              </div>
            )}
          </div>
        </div>

        {/* Months Table */}
        <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase w-32">
                  Mois
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase w-32">
                  Jours
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase w-40">
                  Budget (oz)
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase w-32">
                  Budget/Jour
                </th>
                {showForecasts && (
                  <>
                    <th className="px-4 py-2 text-right text-xs font-medium text-indigo-600 uppercase w-40">
                      Forecast (oz)
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-indigo-600 uppercase w-32">
                      Forecast/Jour
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase w-32">
                      Variance
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {months.map(month => {
                const budget = getBudgetValue(month);
                const forecast = getForecastValue(month);
                const dailyBudget = getDailyBudget(month);
                const dailyForecast = getDailyForecast(month);
                const variance = getVariance(budget, forecast);
                const variancePercentage = getVariancePercentage(budget, forecast);
                const days = annualBudgetService.getDaysInMonth(month, year);
                const monthName = annualBudgetService.getMonthName(month);
                const editable = isMonthEditable(month);

                return (
                  <tr key={month} className={`
                    transition-colors
                    ${editable ? 'hover:bg-blue-50' : 'hover:bg-gray-50'}
                  `}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {monthName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {days}
                    </td>
                    <td className="px-4 py-3">
                      {!showForecasts ? (
                        <input
                          type="number"
                          step="0.01"
                          value={budget || ''}
                          onChange={e => handleBudgetInput(month, e.target.value)}
                          onBlur={() => handleBudgetBlur(month)}
                          onFocus={() => setFocusedCell(`budget-${month}`)}
                          disabled={readOnly}
                          className={`
                            w-full px-3 py-1.5 text-right text-sm rounded border
                            ${focusedCell === `budget-${month}`
                              ? 'border-blue-500 ring-2 ring-blue-100'
                              : 'border-gray-200'
                            }
                            ${readOnly
                              ? 'bg-gray-50 text-gray-600 cursor-not-allowed'
                              : 'bg-white text-gray-900 hover:border-gray-300 focus:outline-none'
                            }
                          `}
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="text-right text-sm text-gray-600 px-3 py-1.5">
                          {budget.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                      {dailyBudget.toFixed(4)}
                    </td>
                    {showForecasts && (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={forecast || ''}
                            onChange={e => handleForecastInput(month, e.target.value)}
                            onBlur={() => handleForecastBlur(month)}
                            onFocus={() => setFocusedCell(`forecast-${month}`)}
                            disabled={!editable}
                            className={`
                              w-full px-3 py-1.5 text-right text-sm rounded border
                              ${focusedCell === `forecast-${month}`
                                ? 'border-indigo-500 ring-2 ring-indigo-100'
                                : 'border-gray-200'
                              }
                              ${!editable
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                : 'bg-white text-indigo-900 hover:border-indigo-300 focus:outline-none'
                              }
                            `}
                            placeholder={budget.toFixed(2)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-indigo-600">
                          {dailyForecast !== null ? dailyForecast.toFixed(4) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {variance !== null ? (
                            <div className="flex flex-col items-end">
                              <span className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
                              </span>
                              {variancePercentage !== null && (
                                <span className={`text-xs ${variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  ({variancePercentage >= 0 ? '+' : ''}{variancePercentage.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const yearTotals = getYearTotal();

  return (
    <div className="space-y-6">
      {/* Year Summary */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Calculator className="w-6 h-6 text-gray-700" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600">Total Annuel {year}</h3>
              <p className="text-2xl font-bold text-gray-900">{yearTotals.budget.toFixed(2)} oz</p>
            </div>
          </div>
          {yearTotals.forecast !== null && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Forecast Total</p>
              <p className="text-2xl font-bold text-indigo-600">{yearTotals.forecast.toFixed(2)} oz</p>
              {yearTotals.budget > 0 && (
                <p className={`text-sm ${
                  (yearTotals.forecast - yearTotals.budget) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {((yearTotals.forecast - yearTotals.budget) >= 0 ? '+' : '')}
                  {(yearTotals.forecast - yearTotals.budget).toFixed(2)} oz
                  ({((yearTotals.forecast - yearTotals.budget) / yearTotals.budget * 100).toFixed(1)}%)
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {showForecasts && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Mode Forecast - Révision Trimestrielle</p>
            <p className="text-blue-700">
              Modifiez uniquement les mois du trimestre sélectionné. Le forecast journalier est calculé automatiquement.
            </p>
          </div>
        </div>
      )}

      {/* Quarter Tables */}
      <div className="space-y-6">
        {[1, 2, 3, 4].map(quarter => renderQuarter(quarter))}
      </div>
    </div>
  );
}
