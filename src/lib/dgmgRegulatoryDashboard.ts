import type {
  DgmgComplianceSummary,
  DgmgRegulatoryDashboardData,
  DgmgRegulatorySummary,
} from '@/types/dgmgRegulatory';

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const csvNumberFormatter = new Intl.NumberFormat('fr-FR', {
  useGrouping: false,
  maximumFractionDigits: 3,
});

function finiteNonNegative(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function deriveProductionTrend(
  currentGrams: number | null | undefined,
  previousGrams: number | null | undefined,
): number | null {
  const current = finiteNonNegative(currentGrams);
  const previous = finiteNonNegative(previousGrams);
  if (current === null || previous === null || previous === 0) return null;
  const trend = (current - previous) / previous * 100;
  return Number.isFinite(trend) ? trend : null;
}

export function deriveComplianceSummary(
  conforming: number | null | undefined,
  regularize: number | null | undefined,
  nonConforming: number | null | undefined,
): DgmgComplianceSummary {
  const compliant = finiteNonNegative(conforming);
  const toRegularize = finiteNonNegative(regularize);
  const nonCompliant = finiteNonNegative(nonConforming);
  if (compliant === null || toRegularize === null || nonCompliant === null) {
    return {
      conforming: compliant,
      regularize: toRegularize,
      nonConforming: nonCompliant,
      classifiedTotal: null,
      rate: null,
    };
  }
  const total = compliant + toRegularize + nonCompliant;
  const rate = total > 0 ? Math.min(Math.max(compliant / total * 100, 0), 100) : null;
  return {
    conforming: compliant,
    regularize: toRegularize,
    nonConforming: nonCompliant,
    classifiedTotal: total,
    rate: Number.isFinite(rate) ? rate : null,
  };
}

export function deriveDgmgSummary(
  values: Omit<DgmgRegulatorySummary, 'productionTrendPercent'>,
): DgmgRegulatorySummary {
  return {
    ...values,
    productionTrendPercent: deriveProductionTrend(
      values.productionGrams,
      values.previousProductionGrams,
    ),
  };
}

export function formatDgmgInteger(value: number | null | undefined): string {
  const safe = finiteNonNegative(value);
  return safe === null ? 'Indisponible' : numberFormatter.format(Math.round(safe));
}

export function formatDgmgPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${numberFormatter.format(Math.min(Math.max(value, 0), 100))} %`
    : 'Indisponible';
}

export function formatDgmgWeight(value: number | null | undefined): string {
  const grams = finiteNonNegative(value);
  if (grams === null) return 'Indisponible';
  if (grams >= 1_000_000) return `${numberFormatter.format(grams / 1_000_000)} t`;
  if (grams >= 1_000) return `${numberFormatter.format(grams / 1_000)} kg`;
  return `${numberFormatter.format(grams)} g`;
}

export function formatDgmgAxisKilograms(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${compactFormatter.format(value / 1_000)}`;
}

function csvCell(value: string | number | null | undefined): string {
  const printable = typeof value === 'number'
    ? (Number.isFinite(value) ? csvNumberFormatter.format(value) : '')
    : value ?? '';
  return `"${String(printable).replace(/"/g, '""')}"`;
}

export function buildDgmgRegulatoryCsv(data: DgmgRegulatoryDashboardData): string {
  const lines: Array<Array<string | number | null | undefined>> = [
    ['TABLEAU DE BORD RÉGLEMENTAIRE DGMG'],
    ['Période', data.period.startDate, data.period.endDate],
    ['Données partielles', data.partial ? 'Oui' : 'Non'],
    [],
    ['INDICATEURS', 'Valeur'],
    ['Sociétés minières agréées', data.summary.miningCompaniesTotal],
    ['Sociétés minières actives', data.summary.miningCompaniesActive],
    ['Sites enregistrés', data.summary.sitesTotal],
    ['Déclarations reçues', data.summary.declarationsTotal],
    ['Production déclarée (g)', data.summary.productionGrams],
    ['Contrôles à traiter', data.summary.controlsPending],
    [],
    ['PRODUCTION MENSUELLE', 'Mois', 'Mines industrielles (g)', 'Sites artisanaux (g)'],
    ...data.monthly.map((point) => [
      '', point.label, point.industrialGrams, point.artisanalGrams,
    ]),
    [],
    ['ACTIVITÉS RÉCENTES', 'Référence', 'Opérateur', 'Activité', 'Zone', 'Statut', 'Date'],
    ...data.activities.map((activity) => [
      '', activity.reference, activity.operatorName, activity.activity,
      activity.zone, activity.status, activity.occurredAt,
    ]),
    [],
    ['POINTS D’ATTENTION', 'Valeur'],
    ['Déclarations hors délai', data.attention.lateDeclarations],
    ['Licences arrivant à expiration', data.attention.expiringLicenses],
    ['Écarts de production à vérifier', data.attention.productionGaps],
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}`;
}
