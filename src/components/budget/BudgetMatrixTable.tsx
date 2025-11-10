import { useState } from 'react';
import { Calendar, Calculator, Info } from 'lucide-react';
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

  const getBudgetValue = (month: number): number => {
    if (pendingBudgets[month] !== undefined) {
      return pendingBudgets[month];
    }
    const budget = monthlyBudgets.find(mb => mb.month === month);
    return budget?.budget_oz || 0;
  };

  const getForecastValue = (month: number): number => {
    const key = `${selectedQuarter}-${month}`;
    if (pendingForecasts[key] !== undefined) {
      return pendingForecasts[key];
    }
    const forecast = quarterlyForecasts.find(
      qf => qf.quarter === selectedQuarter && qf.month === month
    );
    return forecast?.forecast_oz || getBudgetValue(month);
  };

  const getDailyBudget = (month: number): number => {
    const budget = getBudgetValue(month);
    const days = annualBudgetService.getDaysInMonth(month, year);
    return days > 0 ? budget / days : 0;
  };

  const getDailyForecast = (month: number): number => {
    const forecast = getForecastValue(month);
    const days = annualBudgetService.getDaysInMonth(month, year);
    return days > 0 ? forecast / days : 0;
  };

  const getQuarterTotal = (quarter: number): { budget: number; forecast: number } => {
    const months = annualBudgetService.getQuarterMonths(quarter);
    const budget = months.reduce((sum, m) => sum + getBudgetValue(m), 0);
    const forecast = mode === 'forecast' && selectedQuarter === quarter
      ? months.reduce((sum, m) => sum + getForecastValue(m), 0)
      : budget;
    return { budget, forecast };
  };

  const isMonthEditable = (month: number): boolean => {
    if (mode === 'budget') return true;
    if (mode === 'forecast' && selectedQuarter) {
      const quarterMonths = annualBudgetService.getQuarterMonths(selectedQuarter);
      return quarterMonths.includes(month);
    }
    return false;
  };

  const getVariance = (budget: number, forecast: number): number => {
    return forecast - budget;
  };

  const getVariancePercentage = (budget: number, forecast: number): number => {
    if (budget === 0) return 0;
    return ((forecast - budget) / budget) * 100;
  };

  const renderQuarter = (quarter: number) => {
    const months = annualBudgetService.getQuarterMonths(quarter);
    const quarterTotals = getQuarterTotal(quarter);
    const isActive = selectedQuarter === quarter;
    const showForecastColumns = mode === 'forecast' && isActive;

    return (
      <div key={quarter} className="mb-6 last:mb-0">
        {/* Quarter Header */}
        <div className={`
          flex items-center justify-between p-4 rounded-t-xl border-b-2 transition-all
          ${isActive
            ? 'bg-gradient-to-r from-indigo-50 via-indigo-100 to-purple-50 border-indigo-400 shadow-md'
            : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-300'
          }
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${isActive ? 'bg-indigo-500 shadow-lg' : 'bg-slate-400'}
            `}>
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className={`text-lg font-bold ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
              Trimestre {quarter}
            </span>
          </div>
          <div className="flex gap-8 text-sm">
            <div className="text-right">
              <span className="text-slate-600 font-medium block">Budget</span>
              <span className="font-bold text-xl text-slate-900">{quarterTotals.budget.toFixed(2)} <span className="text-sm">oz</span></span>
            </div>
            {showForecastColumns && (
              <div className="text-right">
                <span className="text-indigo-600 font-medium block">Forecast</span>
                <span className="font-bold text-xl text-indigo-700">{quarterTotals.forecast.toFixed(2)} <span className="text-sm">oz</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Months Table */}
        <div className="border-x-2 border-b-2 border-slate-200 rounded-b-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mois
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Jours
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Budget (OZ)
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Budget/Jour
                </th>
                {showForecastColumns && (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50">
                      Forecast (OZ)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50">
                      Forecast/Jour
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider bg-gradient-to-r from-indigo-50 to-slate-50">
                      Écart
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((month, idx) => {
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
                  <tr
                    key={month}
                    className={`
                      transition-all duration-150
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                      ${editable ? 'hover:bg-indigo-50/50' : 'hover:bg-slate-100/50'}
                    `}
                  >
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 capitalize">
                      {monthName}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-600 font-semibold">
                      {days}
                    </td>
                    <td className="px-4 py-3">
                      {mode === 'budget' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={budget || ''}
                          onChange={e => onBudgetChange(month, parseFloat(e.target.value) || 0)}
                          onFocus={() => setFocusedCell(`budget-${month}`)}
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            w-full px-3 py-2 text-right text-sm font-semibold rounded-lg border-2 transition-all
                            ${focusedCell === `budget-${month}`
                              ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                            }
                            bg-white text-slate-900 focus:outline-none
                          `}
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="text-right text-sm font-semibold text-slate-700 px-3 py-2">
                          {budget.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-500 font-medium">
                      {dailyBudget.toFixed(4)}
                    </td>
                    {showForecastColumns && (
                      <>
                        <td className="px-4 py-3 bg-indigo-50/30">
                          <input
                            type="number"
                            step="0.01"
                            value={forecast || ''}
                            onChange={e => {
                              if (selectedQuarter) {
                                onForecastChange(selectedQuarter, month, parseFloat(e.target.value) || 0);
                              }
                            }}
                            onFocus={() => setFocusedCell(`forecast-${month}`)}
                            onBlur={() => setFocusedCell(null)}
                            disabled={!editable}
                            className={`
                              w-full px-3 py-2 text-right text-sm font-semibold rounded-lg border-2 transition-all
                              ${focusedCell === `forecast-${month}`
                                ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-100'
                                : 'border-indigo-200 hover:border-indigo-300'
                              }
                              ${!editable
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-white text-indigo-900'
                              }
                              focus:outline-none
                            `}
                            placeholder={budget.toFixed(2)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-indigo-600 font-semibold bg-indigo-50/30">
                          {dailyForecast.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 bg-gradient-to-r from-indigo-50/30 to-slate-50">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-sm font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {variance >= 0 ? '+' : ''}{variance.toFixed(2)} oz
                            </span>
                            <span className={`text-xs font-semibold ${variance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {variancePercentage >= 0 ? '+' : ''}{variancePercentage.toFixed(1)}%
                            </span>
                          </div>
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

  const calculateYearTotal = (): number => {
    return Array.from({ length: 12 }, (_, i) => i + 1)
      .reduce((sum, m) => sum + getBudgetValue(m), 0);
  };

  const yearTotal = calculateYearTotal();

  return (
    <div className="space-y-6">
      {/* Year Summary */}
      <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-white border-2 border-slate-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl shadow-md">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Total Annuel {year}</h3>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {yearTotal.toFixed(2)} <span className="text-lg font-semibold">oz</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      {mode === 'forecast' && selectedQuarter && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="bg-blue-500 rounded-full p-2 mt-0.5 flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-blue-900 mb-1">Mode Forecast - Révision T{selectedQuarter}</p>
            <p className="text-sm text-blue-700 leading-relaxed">
              Modifiez les prévisions pour les 3 mois du trimestre sélectionné.
              Les calculs journaliers et les écarts sont automatiques.
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
