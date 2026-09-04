import { supabase } from '@/lib/supabase';
import { deriveFiscalSummary } from '@/lib/dgiFiscalDashboard';
import type {
  DgiFiscalContributor,
  DgiFiscalDashboardData,
  DgiFiscalMonthlyPoint,
  DgiFiscalPriority,
  DgiFiscalPriorityLevel,
  DgiFiscalTaxBreakdown,
} from '@/types/dgiFiscal';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function stringOr(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function priorityOr(value: unknown): DgiFiscalPriorityLevel {
  return value === 'high' || value === 'watch' || value === 'normal' ? value : 'normal';
}

function normalizeMonthly(value: unknown): DgiFiscalMonthlyPoint[] {
  return asArray(value).map((entry) => {
    const item = asRecord(entry);
    return {
      month: stringOr(item.month),
      label: stringOr(item.label, stringOr(item.month)),
      expectedAmount: numberOrNull(item.expected_amount),
      collectedAmount: numberOrNull(item.collected_amount),
    };
  }).filter((item) => item.month && item.label);
}

function normalizeTaxBreakdown(value: unknown): DgiFiscalTaxBreakdown[] {
  return asArray(value).map((entry) => {
    const item = asRecord(entry);
    return {
      code: stringOr(item.code),
      label: stringOr(item.label, 'Nature fiscale non libellée'),
      amount: numberOrNull(item.amount),
      sharePercent: numberOrNull(item.share_percent),
    };
  }).filter((item) => item.code);
}

function normalizeContributors(value: unknown): DgiFiscalContributor[] {
  return asArray(value).map((entry) => {
    const item = asRecord(entry);
    return {
      id: stringOr(item.id),
      name: stringOr(item.name, 'Opérateur non libellé'),
      amount: numberOrNull(item.amount),
    };
  }).filter((item) => item.id);
}

function normalizePriorities(value: unknown): DgiFiscalPriority[] {
  return asArray(value).map((entry) => {
    const item = asRecord(entry);
    return {
      id: stringOr(item.id),
      operatorName: stringOr(item.operator_name, 'Opérateur non libellé'),
      taxNature: stringOr(item.tax_nature, 'Nature fiscale non libellée'),
      amountDue: numberOrNull(item.amount_due),
      dueDate: stringOr(item.due_date),
      priority: priorityOr(item.priority),
    };
  }).filter((item) => item.id && item.dueDate);
}

export function normalizeDgiFiscalDashboard(
  payload: unknown,
  fallbackPeriod: { startDate: string; endDate: string },
): DgiFiscalDashboardData {
  const root = asRecord(payload);
  const period = asRecord(root.period);
  const summary = asRecord(root.summary);
  const counters = asRecord(root.counters);
  const derivedSummary = deriveFiscalSummary(
    numberOrNull(summary.expected_amount),
    numberOrNull(summary.collected_amount),
    numberOrNull(summary.declaration_count),
    numberOrNull(summary.previous_collected_amount),
  );

  return {
    hasData: root.has_data === true,
    partial: root.partial === true,
    period: {
      startDate: stringOr(period.start_date, fallbackPeriod.startDate),
      endDate: stringOr(period.end_date, fallbackPeriod.endDate),
    },
    summary: derivedSummary,
    monthly: normalizeMonthly(root.monthly),
    taxBreakdown: normalizeTaxBreakdown(root.tax_breakdown),
    contributors: normalizeContributors(root.contributors),
    priorities: normalizePriorities(root.priorities),
    counters: {
      paymentsToReconcile: numberOrNull(counters.payments_to_reconcile),
      lateDeclarations: numberOrNull(counters.late_declarations),
      assessmentGaps: numberOrNull(counters.assessment_gaps),
    },
    objectiveRate: numberOrNull(root.objective_rate),
  };
}

export const dgiFiscalDashboardService = {
  async load(startDate: string, endDate: string): Promise<DgiFiscalDashboardData> {
    const { data, error } = await supabase.rpc('snp_dgi_charger_tableau_collecte', {
      p_date_debut: startDate,
      p_date_fin: endDate,
    });
    if (error) throw error;
    if (!data) throw new Error('Le tableau fiscal n’a retourné aucune réponse exploitable.');
    return normalizeDgiFiscalDashboard(data, { startDate, endDate });
  },
};
