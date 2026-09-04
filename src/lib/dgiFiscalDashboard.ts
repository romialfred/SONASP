import type {
  DgiFiscalDashboardData,
  DgiFiscalPriorityLevel,
  DgiFiscalSummary,
} from '@/types/dgiFiscal';

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const csvNumberFormatter = new Intl.NumberFormat('fr-FR', {
  useGrouping: false,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function finiteNonNegative(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Les agrégats du serveur restent autoritatifs, mais les rapports et la jauge ne
 * doivent jamais propager une division par zéro, une valeur négative ou NaN.
 */
export function deriveFiscalSummary(
  expectedAmount: number | null | undefined,
  collectedAmount: number | null | undefined,
  declarationCount: number | null | undefined = null,
  previousCollectedAmount: number | null | undefined = null,
): DgiFiscalSummary {
  const expected = finiteNonNegative(expectedAmount);
  const collected = finiteNonNegative(collectedAmount);
  const previous = finiteNonNegative(previousCollectedAmount);
  const declarations = finiteNonNegative(declarationCount);
  const remaining = expected === null || collected === null
    ? null
    : Math.max(expected - collected, 0);
  const recoveryRate = expected !== null && expected > 0 && collected !== null
    ? Math.max(0, collected / expected * 100)
    : null;
  const trend = previous !== null && previous > 0 && collected !== null
    ? (collected - previous) / previous * 100
    : null;

  return {
    expectedAmount: expected,
    collectedAmount: collected,
    remainingAmount: remaining,
    recoveryRate,
    declarationCount: declarations,
    previousCollectedAmount: previous,
    collectedTrendPercent: Number.isFinite(trend) ? trend : null,
  };
}

export function formatFiscalAmount(value: number | null | undefined): string {
  const amount = finiteNonNegative(value);
  if (amount === null) return 'Indisponible';
  if (amount >= 1_000_000_000) return `${numberFormatter.format(amount / 1_000_000_000)} Md FCFA`;
  if (amount >= 1_000_000) return `${numberFormatter.format(amount / 1_000_000)} M FCFA`;
  return `${numberFormatter.format(amount)} FCFA`;
}

export function formatFiscalPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${numberFormatter.format(value)} %`
    : 'Indisponible';
}

/**
 * En l'absence d'un objectif paramétré, la référence est l'exhaustivité légale
 * de 100 %. Aucun objectif distinct n'est dessiné ou présenté comme configuré.
 */
export function recoveryPerformanceLabel(
  recoveryRate: number | null,
  objectiveRate: number | null,
): string {
  if (recoveryRate === null || !Number.isFinite(recoveryRate)) return 'Taux indisponible';
  const reference = objectiveRate !== null && Number.isFinite(objectiveRate) && objectiveRate > 0
    ? objectiveRate
    : 100;
  if (recoveryRate >= reference) return 'Niveau de recouvrement atteint';
  if (recoveryRate >= reference * 0.8) return 'Proche du niveau attendu';
  return 'Recouvrement à renforcer';
}

export function priorityLabel(priority: DgiFiscalPriorityLevel): string {
  if (priority === 'high') return 'Élevée';
  if (priority === 'watch') return 'À suivre';
  return 'Normale';
}

function csvCell(value: string | number | null | undefined): string {
  const printable = typeof value === 'number'
    ? (Number.isFinite(value) ? csvNumberFormatter.format(value) : '')
    : value ?? '';
  const escaped = String(printable).replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildDgiFiscalCsv(data: DgiFiscalDashboardData): string {
  const lines: Array<Array<string | number | null | undefined>> = [
    ['TABLEAU DE COLLECTE FISCALE DGI'],
    ['Période', data.period.startDate, data.period.endDate],
    [],
    ['SYNTHÈSE', 'Valeur'],
    ['Impôts et taxes attendus', data.summary.expectedAmount],
    ['Montant encaissé', data.summary.collectedAmount],
    ['Reste à recouvrer', data.summary.remainingAmount],
    ['Taux de recouvrement (%)', data.summary.recoveryRate],
    ['Déclarations', data.summary.declarationCount],
    [],
    ['COLLECTE MENSUELLE', 'Mois', 'Attendu (FCFA)', 'Encaissé (FCFA)'],
    ...data.monthly.map((point) => ['', point.label, point.expectedAmount, point.collectedAmount]),
    [],
    ['RÉPARTITION PAR NATURE', 'Nature', 'Montant (FCFA)', 'Part (%)'],
    ...data.taxBreakdown.map((item) => ['', item.label, item.amount, item.sharePercent]),
    [],
    ['PRINCIPAUX CONTRIBUTEURS', 'Opérateur', 'Montant encaissé (FCFA)'],
    ...data.contributors.map((item) => ['', item.name, item.amount]),
    [],
    ['RECOUVREMENTS PRIORITAIRES', 'Opérateur', 'Nature', 'Montant dû (FCFA)', 'Échéance', 'Priorité'],
    ...data.priorities.map((item) => [
      '', item.operatorName, item.taxNature, item.amountDue, item.dueDate, priorityLabel(item.priority),
    ]),
  ];

  return `\uFEFF${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}`;
}
