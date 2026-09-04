export type DgiFiscalPriorityLevel = 'high' | 'watch' | 'normal';

export interface DgiFiscalPeriod {
  startDate: string;
  endDate: string;
}

export interface DgiFiscalSummary {
  expectedAmount: number | null;
  collectedAmount: number | null;
  remainingAmount: number | null;
  recoveryRate: number | null;
  declarationCount: number | null;
  previousCollectedAmount: number | null;
  collectedTrendPercent: number | null;
}

export interface DgiFiscalMonthlyPoint {
  month: string;
  label: string;
  expectedAmount: number | null;
  collectedAmount: number | null;
}

export interface DgiFiscalTaxBreakdown {
  code: string;
  label: string;
  amount: number | null;
  sharePercent: number | null;
}

export interface DgiFiscalContributor {
  id: string;
  name: string;
  amount: number | null;
}

export interface DgiFiscalPriority {
  id: string;
  operatorName: string;
  taxNature: string;
  amountDue: number | null;
  dueDate: string;
  priority: DgiFiscalPriorityLevel;
}

export interface DgiFiscalCounters {
  paymentsToReconcile: number | null;
  lateDeclarations: number | null;
  assessmentGaps: number | null;
}

export interface DgiFiscalDashboardData {
  hasData: boolean;
  partial: boolean;
  period: DgiFiscalPeriod;
  summary: DgiFiscalSummary;
  monthly: DgiFiscalMonthlyPoint[];
  taxBreakdown: DgiFiscalTaxBreakdown[];
  contributors: DgiFiscalContributor[];
  priorities: DgiFiscalPriority[];
  counters: DgiFiscalCounters;
  objectiveRate: number | null;
}
