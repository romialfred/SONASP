import { useState } from 'react';
import { Calendar, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { annualBudgetService, MonthlyBudget, QuarterlyForecast } from '../../services/annualBudgetService';
import { formatNumberWithSpaces } from '../../utils/numberUtils';

interface BudgetMatrixTableProps {
  mode: 'budget' | 'forecast';
  selectedQuarter: number | null;
  monthlyBudgets: MonthlyBudget[];
  quarterlyForecasts: QuarterlyForecast[];
  pendingBudgets: Record<number, number>;
  pendingForecasts: Record<string, number>;
  onBudgetChange: (month: number, value: number) => void;
  onForecastChange: (quarter: number, month: number, value: number) => void;
  expandedQuarters: Record<number, boolean>;
  onToggleQuarter: (quarter: number) => void;
}

export function BudgetMatrixTable({
  mode,
  selectedQuarter,
  monthlyBudgets,
  quarterlyForecasts,
  pendingBudgets,
  pendingForecasts,
  onBudgetChange,
  onForecastChange,
  expandedQuarters,
  onToggleQuarter
}: BudgetMatrixTableProps) {
  const year = new Date().getFullYear();
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

  const toggleQuarter = (quarter: number) => {
    onToggleQuarter(quarter);
  };

  const toggleAllQuarters = () => {
    const allExpanded = Object.values(expandedQuarters).every(v => v);
    const newState = !allExpanded;
    [1, 2, 3, 4].forEach(q => {
      if (expandedQuarters[q] !== newState) {
        onToggleQuarter(q);
      }
    });
  };

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
    const isExpanded = expandedQuarters[quarter];

    return (
      <div key={quarter} className="mb-4 last:mb-0">
        {/* Quarter Header - Always Visible */}
        <div
          className={`
            flex items-center justify-between px-4 py-3 rounded-lg border transition-colors cursor-pointer
            ${isActive ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}
          `}
          onClick={() => toggleQuarter(quarter)}
        >
          <div className="flex items-center gap-2.5">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-600" />
            )}
            <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              Trimestre {quarter}
            </span>

            {/* Month Names when collapsed */}
            {!isExpanded && (
              <span className="text-[11px] text-slate-500 font-medium">
                ({months.map(m => annualBudgetService.getMonthName(m).substring(0, 3)).join(', ')})
              </span>
            )}
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div className="text-right">
              <span className="text-slate-500 text-[10px] block mb-0.5">Prévision</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatNumberWithSpaces(quarterTotals.budget, 2)}
                <span className="text-[10px] ml-1 text-slate-500">oz</span>
              </span>
            </div>
            {showForecastColumns && (
              <>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block mb-0.5">Révision</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatNumberWithSpaces(quarterTotals.forecast, 2)}
                    <span className="text-[10px] ml-1 text-slate-500">oz</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block mb-0.5">Écart</span>
                  <span className={`text-sm ${quarterTotals.forecast - quarterTotals.budget >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {quarterTotals.forecast - quarterTotals.budget >= 0 ? '+' : ''}
                    {formatNumberWithSpaces(quarterTotals.forecast - quarterTotals.budget, 2)}
                    <span className="text-[10px] ml-1">oz</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Months Table - Collapsible */}
        {isExpanded && (
          <div className="border-x border-b border-slate-200 rounded-b-lg overflow-hidden bg-white shadow-sm mt-0.5">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Mois
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    Jours
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                    Prévision (oz)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    Par jour
                  </th>
                  {showForecastColumns && (
                    <>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                        Révision (oz)
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                        Par jour
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
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
                        transition-colors duration-100
                        ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}
                        hover:bg-emerald-50/20
                      `}
                    >
                      <td className="px-3 py-2 text-xs text-slate-900 capitalize">
                        {monthName}
                      </td>
                      <td className="px-3 py-2 text-xs text-center text-slate-600">
                        {days}
                      </td>
                      <td className="px-3 py-2">
                        {mode === 'budget' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={budget || ''}
                            onChange={e => onBudgetChange(month, parseFloat(e.target.value) || 0)}
                            onFocus={() => setFocusedCell(`budget-${month}`)}
                            onBlur={() => setFocusedCell(null)}
                            className={`
                              w-32 px-2 py-1 text-right text-sm rounded border transition-all
                              ${focusedCell === `budget-${month}`
                                ? 'border-slate-400 ring-1 ring-slate-300 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                              }
                              bg-white text-slate-900 focus:outline-none
                            `}
                            placeholder="0"
                          />
                        ) : (
                          <div className="text-right text-sm text-slate-700 px-2 py-1">
                            {formatNumberWithSpaces(budget, 2)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-slate-500">
                        {formatNumberWithSpaces(dailyBudget, 2)}
                      </td>
                      {showForecastColumns && (
                        <>
                          <td className="px-3 py-2">
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
                                w-32 px-2 py-1 text-right text-sm rounded border transition-all
                                ${focusedCell === `forecast-${month}`
                                  ? 'border-emerald-500 ring-1 ring-emerald-200 bg-emerald-50/40'
                                  : 'border-slate-200 hover:border-slate-300'
                                }
                                ${!editable
                                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'bg-white text-slate-900'
                                }
                                focus:outline-none
                              `}
                              placeholder={formatNumberWithSpaces(budget, 2)}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-600">
                            {formatNumberWithSpaces(dailyForecast, 2)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`text-xs ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {variance >= 0 ? '+' : ''}{formatNumberWithSpaces(variance, 2)}
                              </span>
                              <span className={`text-[10px] ${variance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {variancePercentage >= 0 ? '+' : ''}{Math.round(variancePercentage)}%
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
        )}
      </div>
    );
  };

  const allExpanded = Object.values(expandedQuarters).every(v => v);

  return (
    <div className="space-y-4">
      {/* Expand/Collapse All Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggleAllQuarters}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
        >
          {allExpanded ? (
            <>
              <ChevronRight className="w-4 h-4" />
              Réduire tous les trimestres
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Dérouler tous les trimestres
            </>
          )}
        </button>
      </div>

      {/* Info Banner */}
      {mode === 'forecast' && selectedQuarter && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 flex items-start gap-3">
          <div className="bg-white border border-emerald-200 rounded-full p-1.5 mt-0.5 flex-shrink-0">
            <Info className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex-1">
            <p className="text-emerald-900 mb-1 text-xs font-semibold">Révision du trimestre {selectedQuarter}</p>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Ajustez les trois mois sélectionnés ; les écarts sont calculés automatiquement.
            </p>
          </div>
        </div>
      )}

      {/* Quarter Tables */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map(quarter => renderQuarter(quarter))}
      </div>
    </div>
  );
}
