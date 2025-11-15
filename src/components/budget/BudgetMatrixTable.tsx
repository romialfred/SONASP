import { useState } from 'react';
import { Calendar, Info, ChevronDown, ChevronRight } from 'lucide-react';
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

  const getQuarterColor = (quarter: number) => {
    const colors = {
      1: {
        bg: 'bg-gradient-to-r from-blue-50 to-blue-100',
        border: 'border-blue-300',
        icon: 'bg-blue-600',
        text: 'text-blue-900'
      },
      2: {
        bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100',
        border: 'border-emerald-300',
        icon: 'bg-emerald-600',
        text: 'text-emerald-900'
      },
      3: {
        bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
        border: 'border-amber-300',
        icon: 'bg-amber-600',
        text: 'text-amber-900'
      },
      4: {
        bg: 'bg-gradient-to-r from-purple-50 to-purple-100',
        border: 'border-purple-300',
        icon: 'bg-purple-600',
        text: 'text-purple-900'
      }
    };
    return colors[quarter as keyof typeof colors];
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
    const colors = getQuarterColor(quarter);

    return (
      <div key={quarter} className="mb-4 last:mb-0">
        {/* Quarter Header - Always Visible */}
        <div
          className={`
            flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md
            ${colors.bg} ${colors.border} shadow-sm
          `}
          onClick={() => toggleQuarter(quarter)}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className={`w-4 h-4 ${colors.text}`} />
            ) : (
              <ChevronRight className={`w-4 h-4 ${colors.text}`} />
            )}
            <div className={`p-1.5 rounded-md ${colors.icon} shadow-sm`}>
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className={`text-sm font-bold ${colors.text}`}>
              Trimestre {quarter}
            </span>

            {/* Month Names when collapsed */}
            {!isExpanded && (
              <span className="text-xs text-slate-500 font-medium ml-2">
                ({months.map(m => annualBudgetService.getMonthName(m).substring(0, 3)).join(', ')})
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div className="text-right">
              <span className="text-slate-500 font-medium block mb-0.5">Budget</span>
              <span className="font-bold text-base text-slate-900">
                {quarterTotals.budget.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                <span className="text-xs ml-1 text-slate-600">oz</span>
              </span>
            </div>
            {showForecastColumns && (
              <>
                <div className="text-right">
                  <span className="text-blue-600 font-medium block mb-0.5">Forecast</span>
                  <span className="font-bold text-base text-blue-700">
                    {quarterTotals.forecast.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                    <span className="text-xs ml-1 text-blue-600">oz</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 font-medium block mb-0.5">Écart</span>
                  <span className={`font-bold text-base ${quarterTotals.forecast - quarterTotals.budget >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {quarterTotals.forecast - quarterTotals.budget >= 0 ? '+' : ''}
                    {(quarterTotals.forecast - quarterTotals.budget).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                    <span className="text-xs ml-1">oz</span>
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
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Mois
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Jours
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Budget (OZ)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    /Jour
                  </th>
                  {showForecastColumns && (
                    <>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-blue-600 uppercase tracking-wide bg-blue-50/50">
                        Forecast (OZ)
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-blue-500 uppercase tracking-wide bg-blue-50/50">
                        /Jour
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide bg-blue-50/30">
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
                        ${editable ? 'hover:bg-blue-50/30' : 'hover:bg-slate-50'}
                      `}
                    >
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900 capitalize">
                        {monthName}
                      </td>
                      <td className="px-3 py-2 text-xs text-center text-slate-600 font-medium">
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
                              w-32 px-2 py-1 text-right text-sm font-semibold rounded border transition-all
                              ${focusedCell === `budget-${month}`
                                ? 'border-slate-400 ring-1 ring-slate-300 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                              }
                              bg-white text-slate-900 focus:outline-none
                            `}
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="text-right text-sm font-semibold text-slate-700 px-2 py-1">
                            {budget.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-slate-500 font-medium">
                        {dailyBudget.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                      </td>
                      {showForecastColumns && (
                        <>
                          <td className="px-3 py-2 bg-blue-50/20">
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
                                w-32 px-2 py-1 text-right text-sm font-semibold rounded border transition-all
                                ${focusedCell === `forecast-${month}`
                                  ? 'border-blue-500 ring-1 ring-blue-300 bg-blue-50'
                                  : 'border-blue-200 hover:border-blue-300'
                                }
                                ${!editable
                                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'bg-white text-slate-900'
                                }
                                focus:outline-none
                              `}
                              placeholder={budget.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-blue-600 font-semibold bg-blue-50/20">
                            {dailyForecast.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-2 bg-blue-50/10">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`text-xs font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {variance >= 0 ? '+' : ''}{variance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-[10px] font-semibold ${variance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
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
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-all shadow-sm hover:shadow"
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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <div className="bg-blue-500 rounded-full p-1.5 mt-0.5 flex-shrink-0">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-900 mb-1 text-xs">Mode Forecast - Révision T{selectedQuarter}</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Modifiez les prévisions pour les 3 mois du trimestre sélectionné.
              Les calculs journaliers et les écarts sont automatiques.
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
