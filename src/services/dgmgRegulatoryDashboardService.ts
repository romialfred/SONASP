import { supabase } from '@/lib/supabase';
import {
  deriveComplianceSummary,
  deriveDgmgSummary,
} from '@/lib/dgmgRegulatoryDashboard';
import type {
  DgmgActivityTone,
  DgmgFilterOption,
  DgmgProductionMonthlyPoint,
  DgmgRegulatoryActivity,
  DgmgRegulatoryDashboardData,
  DgmgRegulatoryFilters,
} from '@/types/dgmgRegulatory';

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

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringOr(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function toneOr(value: unknown): DgmgActivityTone {
  return value === 'success' || value === 'info' || value === 'warning'
    || value === 'danger' || value === 'neutral'
    ? value
    : 'neutral';
}

function normalizeOptions(value: unknown): DgmgFilterOption[] {
  const unique = new Map<string, DgmgFilterOption>();
  asArray(value).forEach((entry) => {
    const item = asRecord(entry);
    const option = {
      value: stringOr(item.value, ''),
      label: stringOr(item.label, ''),
    };
    if (option.value && option.label && !unique.has(option.value)) unique.set(option.value, option);
  });
  return [...unique.values()];
}

function normalizeMonthly(value: unknown): DgmgProductionMonthlyPoint[] {
  return asArray(value).map((entry) => {
    const item = asRecord(entry);
    return {
      month: stringOr(item.month, ''),
      label: stringOr(item.label, stringOr(item.month, '')),
      industrialGrams: numberOrNull(item.industrial_grams),
      artisanalGrams: numberOrNull(item.artisanal_grams),
    };
  }).filter((item) => item.month && item.label);
}

function normalizeActivities(value: unknown): DgmgRegulatoryActivity[] {
  return asArray(value).map((entry) => {
    const item = asRecord(entry);
    return {
      id: stringOr(item.id, ''),
      reference: stringOrNull(item.reference),
      operatorName: stringOr(item.operator_name, 'Opérateur non libellé'),
      activity: stringOr(item.activity, 'Activité non libellée'),
      zone: stringOrNull(item.zone),
      status: stringOrNull(item.status),
      statusTone: toneOr(item.status_tone),
      occurredAt: stringOr(item.occurred_at, ''),
    };
  }).filter((item) => item.id && item.occurredAt);
}

export function normalizeDgmgRegulatoryDashboard(
  payload: unknown,
  fallbackFilters: DgmgRegulatoryFilters,
): DgmgRegulatoryDashboardData {
  const root = asRecord(payload);
  const period = asRecord(root.period);
  const summary = asRecord(root.summary);
  const compliance = asRecord(root.compliance);
  const attention = asRecord(root.attention);
  const filterOptions = asRecord(root.filter_options);

  return {
    hasData: root.has_data === true,
    partial: root.partial === true,
    unavailableDimensions: asArray(root.unavailable_dimensions)
      .map(stringOrNull)
      .filter((item): item is string => item !== null),
    period: {
      startDate: stringOr(period.start_date, fallbackFilters.startDate),
      endDate: stringOr(period.end_date, fallbackFilters.endDate),
    },
    summary: deriveDgmgSummary({
      miningCompaniesTotal: numberOrNull(summary.mining_companies_total),
      miningCompaniesActive: numberOrNull(summary.mining_companies_active),
      sitesTotal: numberOrNull(summary.sites_total),
      industrialSitesTotal: numberOrNull(summary.industrial_sites_total),
      artisanalSitesTotal: numberOrNull(summary.artisanal_sites_total),
      declarationsTotal: numberOrNull(summary.declarations_total),
      onTimeRate: numberOrNull(summary.on_time_rate),
      productionGrams: numberOrNull(summary.production_grams),
      previousProductionGrams: numberOrNull(summary.previous_production_grams),
      controlsPending: numberOrNull(summary.controls_pending),
      priorityControls: numberOrNull(summary.priority_controls),
    }),
    monthly: normalizeMonthly(root.monthly),
    compliance: deriveComplianceSummary(
      numberOrNull(compliance.conforming),
      numberOrNull(compliance.regularize),
      numberOrNull(compliance.non_conforming),
    ),
    activities: normalizeActivities(root.activities),
    attention: {
      lateDeclarations: numberOrNull(attention.late_declarations),
      expiringLicenses: numberOrNull(attention.expiring_licenses),
      productionGaps: numberOrNull(attention.production_gaps),
    },
    filterOptions: {
      companies: normalizeOptions(filterOptions.companies),
      regions: normalizeOptions(filterOptions.regions),
      declarationStatuses: normalizeOptions(filterOptions.declaration_statuses),
    },
  };
}

export const dgmgRegulatoryDashboardService = {
  async load(
    filters: DgmgRegulatoryFilters,
    signal?: AbortSignal,
  ): Promise<DgmgRegulatoryDashboardData> {
    const query = supabase.rpc('snp_dgmg_charger_tableau_reglementaire', {
      p_date_debut: filters.startDate,
      p_date_fin: filters.endDate,
      p_type_site: filters.siteType,
      p_societe_id: filters.companyId,
      p_region: filters.region,
      p_statut_declaration: filters.declarationStatus,
    });
    const { data, error } = signal ? await query.abortSignal(signal) : await query;
    if (error) throw error;
    if (!data) throw new Error('Le tableau réglementaire n’a retourné aucune réponse exploitable.');
    return normalizeDgmgRegulatoryDashboard(data, filters);
  },
};
